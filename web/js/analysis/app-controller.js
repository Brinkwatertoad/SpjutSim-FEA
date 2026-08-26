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

  function validateViewportPresentation(presentation, meshAvailable, resultsAvailable) {
    var fields = ['vonMises', 'maxPrincipal', 'minPrincipal', 'displacementMagnitude', 'ux', 'uy', 'uz'];
    var deformationModes = ['undeformed', 'true-scale', 'auto', 'user'];
    if (!presentation || typeof presentation !== 'object' || Array.isArray(presentation) ||
        ['model', 'mesh', 'stress', 'deformation'].indexOf(presentation.mode) < 0 ||
        (presentation.displayStyle !== 'lines' && presentation.displayStyle !== 'wireframe')) {
      throw new Error('Invalid viewport presentation.');
    }
    if (presentation.mode === 'mesh' && !meshAvailable) {
      throw new Error('Generate a mesh before selecting Mesh view.');
    }
    if ((presentation.mode === 'stress' || presentation.mode === 'deformation') && !resultsAvailable) {
      throw new Error('Solve the analysis before selecting a result view.');
    }
    if (presentation.field !== undefined && fields.indexOf(presentation.field) < 0) { throw new Error('Invalid result field.'); }
    if (presentation.deformationMode !== undefined && deformationModes.indexOf(presentation.deformationMode) < 0) {
      throw new Error('Invalid deformation mode.');
    }
    if (presentation.userDeformationScale !== undefined &&
        (!Number.isFinite(presentation.userDeformationScale) || presentation.userDeformationScale < 0)) {
      throw new Error('Deformation scale must be a finite non-negative value.');
    }
    return {
      mode: presentation.mode, displayStyle: presentation.displayStyle,
      field: presentation.field || (presentation.mode === 'deformation' ? 'displacementMagnitude' : 'vonMises'),
      meshOverlay: presentation.meshOverlay === true,
      deformationMode: presentation.deformationMode || 'undeformed',
      deformationScale: Number.isFinite(presentation.deformationScale) ? presentation.deformationScale : 0,
      userDeformationScale: Number.isFinite(presentation.userDeformationScale) ? presentation.userDeformationScale : 1
    };
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
    var hadResults = Boolean(this.document.results);
    this.document.results = null;
    this.document.convergenceStudy = null;
    this.document.analysisRevision = (this.document.analysisRevision || 0) + 1;
    this.document.resultInvalidation = { reason: reason, revision: this.document.analysisRevision, stale: hadResults };
    this.document.solvePreflight = { status: 'idle', result: null, error: null, progress: null, analysisRevision: null };
    this.document.solveExecution = { status: 'idle', error: null, progress: null, analysisRevision: null };
    if (this.document.viewportPresentation.mode === 'stress' || this.document.viewportPresentation.mode === 'deformation') {
      this.document.viewportPresentation = Object.assign({}, this.document.viewportPresentation, { mode: this.document.mesh ? 'mesh' : 'model' });
    }
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
    this.document.viewportPresentation = validateViewportPresentation(presentation, Boolean(this.document.mesh), Boolean(this.document.results));
    this.notify();
  };

  AppController.prototype.beginSolvePreflight = function () {
    if (!this.document.mesh) { throw new Error('Generate a mesh before preflight.'); }
    this.document.solvePreflight = { status: 'running', result: null, error: null, progress: null,
      analysisRevision: this.document.analysisRevision };
    this.document.solveExecution = { status: 'idle', error: null, progress: null, analysisRevision: null };
    this.notify();
    return this.document.analysisRevision;
  };

  AppController.prototype.reportSolveProgress = function (progress) {
    var target = this.document.solveExecution.status === 'running' ? this.document.solveExecution : this.document.solvePreflight;
    if (target.status !== 'running') { return; }
    target.progress = progress;
    this.notify();
  };

  AppController.prototype.completeSolvePreflight = function (revision, result) {
    if (revision !== this.document.analysisRevision || this.document.solvePreflight.status !== 'running') { return false; }
    var validation = root.SpjutsimFEA.validatePreflightResult(result);
    if (!validation.valid) { throw new Error('Invalid solve preflight: ' + validation.reason); }
    this.document.solvePreflight = { status: 'ready', result: result, error: null, progress: null, analysisRevision: revision };
    this.notify();
    return true;
  };

  AppController.prototype.failSolvePreflight = function (revision, error) {
    if (revision !== this.document.analysisRevision) { return false; }
    this.document.solvePreflight = { status: 'failed', result: null,
      error: error && error.diagnostic ? error.diagnostic : error, progress: null, analysisRevision: revision };
    this.notify();
    return true;
  };

  AppController.prototype.beginSolve = function () {
    var preflight = this.document.solvePreflight;
    if (preflight.status !== 'ready' || preflight.analysisRevision !== this.document.analysisRevision || preflight.result.exceedsWasmCap) {
      throw new Error('Complete a valid solve preflight before solving.');
    }
    this.document.solveExecution = { status: 'running', error: null, progress: null, analysisRevision: this.document.analysisRevision };
    this.notify();
    return this.document.analysisRevision;
  };

  AppController.prototype.completeSolve = function (revision, result) {
    if (revision !== this.document.analysisRevision || this.document.solveExecution.status !== 'running') { return false; }
    var validation = root.SpjutsimFEA.validateResultModel(result, revision);
    if (!validation.valid) { throw new Error('Invalid solve result: ' + validation.reason); }
    this.document.results = result;
    this.document.solveExecution = { status: 'succeeded', error: null, progress: null, analysisRevision: revision };
    this.document.resultInvalidation = null;
    this.document.viewportPresentation = Object.assign({}, this.document.viewportPresentation, {
      mode: 'stress', field: 'vonMises', deformationMode: 'undeformed', deformationScale: 0
    });
    this.notify();
    return true;
  };

  AppController.prototype.failSolve = function (revision, error) {
    if (revision !== this.document.analysisRevision) { return false; }
    this.document.solveExecution = { status: 'failed', error: error && error.diagnostic ? error.diagnostic : error,
      progress: null, analysisRevision: revision };
    this.notify();
    return true;
  };

  AppController.prototype.cancelSolve = function () {
    var wasRunning = this.document.solveExecution.status === 'running' || this.document.solvePreflight.status === 'running';
    if (!wasRunning) { return; }
    if (this.document.solveExecution.status === 'running') {
      this.document.solveExecution = { status: 'cancelled', error: null, progress: null, analysisRevision: this.document.analysisRevision };
    } else {
      this.document.solvePreflight = { status: 'cancelled', result: null, error: null, progress: null, analysisRevision: this.document.analysisRevision };
    }
    this.notify();
  };

  AppController.prototype.discardSolvePreflight = function () {
    if (this.document.solvePreflight.status === 'idle' && this.document.solveExecution.status !== 'running') { return; }
    this.document.solvePreflight = { status: 'idle', result: null, error: null, progress: null, analysisRevision: null };
    if (this.document.solveExecution.status !== 'succeeded') {
      this.document.solveExecution = { status: 'idle', error: null, progress: null, analysisRevision: null };
    }
    this.notify();
  };

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.AppController = AppController;
}(globalThis));
