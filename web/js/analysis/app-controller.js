(function (root) {
  'use strict';

  function AppController(options) {
    this.document = options.document;
    this.listeners = [];
    this.stepSource = null;
    this.nextAnalysisItemSequence = 1;
  }

  function findItem(items, id, label) {
    var index = items.findIndex(function (item) { return item.id === id; });
    if (index === -1) { throw new Error('Unknown ' + label + ' identifier.'); }
    return index;
  }

  function validatedFaceIds(geometry, faceIds) {
    var knownFaceIds;
    var uniqueFaceIds;
    if (!Array.isArray(faceIds)) {
      throw new Error('Selected faces must be an array of FaceId values.');
    }
    if (!geometry) {
      if (faceIds.length === 0) { return []; }
      throw new Error('Cannot select faces before geometry is available.');
    }
    knownFaceIds = new Set(geometry.faceIds);
    uniqueFaceIds = [];
    faceIds.forEach(function (faceId) {
      if (typeof faceId !== 'string' || !knownFaceIds.has(faceId)) {
        throw new Error('Unknown CAD face identifier.');
      }
      if (uniqueFaceIds.indexOf(faceId) === -1) { uniqueFaceIds.push(faceId); }
    });
    return uniqueFaceIds;
  }

  function validateViewportPresentation(presentation, meshAvailable) {
    if (!presentation || typeof presentation !== 'object' || Array.isArray(presentation) ||
        (presentation.mode !== 'model' && presentation.mode !== 'mesh') ||
        (presentation.displayStyle !== 'lines' && presentation.displayStyle !== 'wireframe')) {
      throw new Error('Invalid viewport presentation.');
    }
    if (presentation.mode === 'mesh' && !meshAvailable) {
      throw new Error('Generate a mesh before selecting Mesh view.');
    }
    return { mode: presentation.mode, displayStyle: presentation.displayStyle };
  }

  AppController.prototype.subscribe = function (listener) {
    this.listeners.push(listener);
    listener(this.document);
  };

  AppController.prototype.notify = function () {
    var documentState = this.document;
    this.listeners.forEach(function (listener) { listener(documentState); });
  };

  AppController.prototype.invalidateResults = function (reason) {
    this.document.results = null;
    this.document.convergenceStudy = null;
    this.document.analysisRevision = (this.document.analysisRevision || 0) + 1;
    this.document.resultInvalidation = { reason: reason, revision: this.document.analysisRevision };
  };

  AppController.prototype.createAnalysisItemId = function (prefix) {
    var id = prefix + '-' + this.nextAnalysisItemSequence;
    this.nextAnalysisItemSequence += 1;
    return id;
  };

  AppController.prototype.beginGeometryImport = function (sourceName) {
    this.document.geometryImport = { status: 'importing', sourceName: sourceName, error: null };
    this.notify();
  };

  AppController.prototype.reportGeometryImportProgress = function (progress) {
    if (this.document.geometryImport.status !== 'importing') { return; }
    this.document.geometryImport = {
      status: 'importing', sourceName: this.document.geometryImport.sourceName,
      progress: progress, error: null
    };
    this.notify();
  };

  AppController.prototype.failGeometryImport = function (error) {
    this.document.geometryImport = {
      status: 'failed', sourceName: this.document.geometryImport.sourceName,
      error: error && error.diagnostic ? error.diagnostic : error
    };
    this.notify();
  };

  /** Replace engineering state that depends on the imported geometry. */
  AppController.prototype.replaceGeometry = function (geometry, source) {
    var validation = root.SpjutsimFEA.validateGeometryModel(geometry);
    if (!validation.valid) {
      throw new Error('Invalid geometry model: ' + validation.reason);
    }
    if (!source || typeof source.sourceName !== 'string' || !(source.stepBytes instanceof ArrayBuffer) || source.stepBytes.byteLength === 0) {
      throw new Error('A non-empty canonical STEP source is required.');
    }
    this.stepSource = { sourceName: source.sourceName, stepBytes: source.stepBytes };
    this.document.geometry = geometry;
    this.document.selectedFaceIds = [];
    this.document.boundaryConditions = [];
    this.document.loads = [];
    this.document.meshMetadata = null;
    this.document.mesh = null;
    this.document.viewportPresentation = { mode: 'model', displayStyle: this.document.viewportPresentation.displayStyle };
    this.document.meshGeneration = { status: 'idle', error: null, progress: null };
    this.invalidateResults('geometry');
    this.document.geometryImport = { status: 'succeeded', sourceName: source.sourceName, error: null };
    this.notify();
  };

  AppController.prototype.clearGeometry = function () {
    this.stepSource = null;
    this.document.geometry = null;
    this.document.selectedFaceIds = [];
    this.document.boundaryConditions = [];
    this.document.loads = [];
    this.document.meshMetadata = null;
    this.document.mesh = null;
    this.document.viewportPresentation = { mode: 'model', displayStyle: this.document.viewportPresentation.displayStyle };
    this.document.meshGeneration = { status: 'idle', error: null, progress: null };
    this.invalidateResults('geometry');
    this.document.geometryImport = { status: 'idle', sourceName: null, error: null };
    this.notify();
  };

  /** Replace the UI-only set of selected CAD faces. */
  AppController.prototype.replaceSelectedFaces = function (faceIds) {
    this.document.selectedFaceIds = validatedFaceIds(this.document.geometry, faceIds);
    this.notify();
  };

  /** Toggle a single known CAD face without creating a boundary condition. */
  AppController.prototype.toggleSelectedFace = function (faceId) {
    var selectedFaceIds = validatedFaceIds(this.document.geometry, [faceId]);
    var selectedFaceId = selectedFaceIds[0];
    var nextSelectedFaceIds = this.document.selectedFaceIds.slice();
    var index = nextSelectedFaceIds.indexOf(selectedFaceId);
    if (index === -1) {
      nextSelectedFaceIds.push(selectedFaceId);
    } else {
      nextSelectedFaceIds.splice(index, 1);
    }
    this.document.selectedFaceIds = nextSelectedFaceIds;
    this.notify();
  };

  AppController.prototype.clearSelectedFaces = function () {
    this.document.selectedFaceIds = [];
    this.notify();
  };

  /** Replace the single homogeneous material while keeping geometry and mesh intact. */
  AppController.prototype.replaceMaterial = function (material) {
    var validation = root.SpjutsimFEA.validateIsotropicMaterial(material, this.document.gravity);
    if (!validation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validation)); }
    this.document.material = validation.value;
    this.invalidateResults('material');
    this.notify();
    return validation;
  };

  AppController.prototype.clearMaterial = function () {
    if (this.document.gravity.enabled) { throw new Error('Disable gravity before removing the material.'); }
    this.document.material = null;
    this.invalidateResults('material');
    this.notify();
  };

  AppController.prototype.createBoundaryCondition = function (definition) {
    var candidate = Object.assign({}, definition, {
      id: this.createAnalysisItemId('support'), faceIds: this.document.selectedFaceIds.slice()
    });
    var validation = root.SpjutsimFEA.validateBoundaryCondition(candidate, this.document.geometry && this.document.geometry.faceIds);
    if (!validation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validation)); }
    this.document.boundaryConditions.push(validation.value);
    this.invalidateResults('boundary-conditions');
    this.notify();
    return validation.value.id;
  };

  AppController.prototype.replaceBoundaryCondition = function (id, definition) {
    var index = findItem(this.document.boundaryConditions, id, 'support');
    var existing = this.document.boundaryConditions[index];
    var candidate = Object.assign({}, definition, {
      id: id,
      name: definition.name === undefined ? existing.name : definition.name,
      type: definition.type === undefined ? existing.type : definition.type,
      faceIds: definition.faceIds === undefined ? existing.faceIds.slice() : definition.faceIds
    });
    var validation = root.SpjutsimFEA.validateBoundaryCondition(candidate, this.document.geometry && this.document.geometry.faceIds);
    if (!validation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validation)); }
    this.document.boundaryConditions[index] = validation.value;
    this.invalidateResults('boundary-conditions');
    this.notify();
  };

  AppController.prototype.selectBoundaryCondition = function (id) {
    var index = findItem(this.document.boundaryConditions, id, 'support');
    this.document.selectedFaceIds = validatedFaceIds(this.document.geometry, this.document.boundaryConditions[index].faceIds);
    this.notify();
  };

  AppController.prototype.removeBoundaryCondition = function (id) {
    var index = findItem(this.document.boundaryConditions, id, 'support');
    this.document.boundaryConditions.splice(index, 1);
    this.invalidateResults('boundary-conditions');
    this.notify();
  };

  AppController.prototype.createLoad = function (definition) {
    var candidate = Object.assign({}, definition, {
      id: this.createAnalysisItemId('load'), faceIds: this.document.selectedFaceIds.slice()
    });
    var validation = root.SpjutsimFEA.validateLoad(candidate, this.document.geometry && this.document.geometry.faceIds);
    if (!validation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validation)); }
    this.document.loads.push(validation.value);
    this.invalidateResults('loads');
    this.notify();
    return validation.value.id;
  };

  AppController.prototype.replaceLoad = function (id, definition) {
    var index = findItem(this.document.loads, id, 'load');
    var existing = this.document.loads[index];
    var candidate = Object.assign({}, definition, {
      id: id,
      name: definition.name === undefined ? existing.name : definition.name,
      type: definition.type === undefined ? existing.type : definition.type,
      faceIds: definition.faceIds === undefined ? existing.faceIds.slice() : definition.faceIds
    });
    var validation = root.SpjutsimFEA.validateLoad(candidate, this.document.geometry && this.document.geometry.faceIds);
    if (!validation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validation)); }
    this.document.loads[index] = validation.value;
    this.invalidateResults('loads');
    this.notify();
  };

  AppController.prototype.selectLoad = function (id) {
    var index = findItem(this.document.loads, id, 'load');
    this.document.selectedFaceIds = validatedFaceIds(this.document.geometry, this.document.loads[index].faceIds);
    this.notify();
  };

  AppController.prototype.removeLoad = function (id) {
    var index = findItem(this.document.loads, id, 'load');
    this.document.loads.splice(index, 1);
    this.invalidateResults('loads');
    this.notify();
  };

  AppController.prototype.replaceGravity = function (gravity) {
    var validation = root.SpjutsimFEA.validateGravity(gravity, this.document.material);
    if (!validation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validation)); }
    this.document.gravity = validation.value;
    this.invalidateResults('gravity');
    this.notify();
  };

  AppController.prototype.replaceMeshSettings = function (settings) {
    var validation = root.SpjutsimFEA.validateMeshSettings(settings, this.document.geometry && this.document.geometry.boundingBoxM);
    if (!validation.valid) { throw new Error('Invalid mesh settings: ' + validation.reason); }
    this.document.meshSettings = Object.assign({}, settings);
    this.document.mesh = null;
    this.document.meshMetadata = null;
    this.invalidateResults('mesh-settings');
    this.document.meshGeneration = { status: 'idle', error: null, progress: null };
    this.document.viewportPresentation = { mode: 'model', displayStyle: this.document.viewportPresentation.displayStyle };
    this.notify();
  };

  AppController.prototype.beginMeshGeneration = function () {
    if (!this.document.geometry || !this.stepSource) { throw new Error('Import geometry before generating a mesh.'); }
    this.document.meshGeneration = { status: 'generating', error: null, progress: null };
    this.notify();
  };

  AppController.prototype.reportMeshProgress = function (progress) {
    if (this.document.meshGeneration.status !== 'generating') { return; }
    this.document.meshGeneration = { status: 'generating', error: null, progress: progress };
    this.notify();
  };

  AppController.prototype.completeMeshGeneration = function (mesh) {
    var validation = root.SpjutsimFEA.validateVolumeMeshResult(mesh, this.document.geometry && this.document.geometry.faceIds);
    if (!validation.valid) { throw new Error('Invalid volume mesh: ' + validation.reason); }
    this.document.mesh = mesh;
    this.document.viewportPresentation = { mode: 'mesh', displayStyle: this.document.viewportPresentation.displayStyle };
    this.document.meshMetadata = { statistics: mesh.statistics, quality: mesh.quality, memoryInputs: mesh.memoryInputs };
    this.invalidateResults('mesh');
    this.document.meshGeneration = { status: 'succeeded', error: null, progress: null };
    this.notify();
  };

  AppController.prototype.failMeshGeneration = function (error) {
    this.document.meshGeneration = { status: 'failed', error: error && error.diagnostic ? error.diagnostic : error, progress: null };
    this.notify();
  };

  /** Update viewport-only state without invalidating imported or analysis data. */
  AppController.prototype.replaceViewportPresentation = function (presentation) {
    this.document.viewportPresentation = validateViewportPresentation(presentation, Boolean(this.document.mesh));
    this.notify();
  };

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.AppController = AppController;
}(globalThis));
