(function (root) {
  'use strict';

  function AppController(options) {
    this.document = options.document;
    this.listeners = [];
    this.geometrySource = null;
    this.nextAnalysisItemSequence = 1;
    this.nextSupportNameSequence = 1;
    this.nextLoadNameSequence = 1;
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
    var fields = ['vonMises', 'factorOfSafety', 'maxPrincipal', 'minPrincipal', 'displacementMagnitude', 'ux', 'uy', 'uz'];
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

  AppController.prototype.refreshConstraintStability = function () {
    this.document.constraintStability = root.SpjutsimFEA.analyzeDocumentConstraintStability(this.document);
    return this.document.constraintStability;
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

  AppController.prototype.restoreGeometryImportStatus = function () {
    this.document.geometryImport = this.document.geometry
      ? { status: 'succeeded', sourceName: this.document.geometry.sourceName, error: null }
      : { status: 'idle', sourceName: null, error: null };
    this.notify();
  };

  /** Replace engineering state that depends on the imported geometry. */
  AppController.prototype.replaceGeometry = function (geometry, source) {
    var validation = root.SpjutsimFEA.validateGeometryModel(geometry);
    if (!validation.valid) {
      throw new Error('Invalid geometry model: ' + validation.reason);
    }
    if (!source || typeof source.sourceName !== 'string' || source.sourceFormat !== geometry.sourceFormat ||
        root.SpjutsimFEA.sourceFormatForFilename(source.sourceName) !== source.sourceFormat ||
        !(source.sourceBytes instanceof ArrayBuffer) || source.sourceBytes.byteLength === 0) {
      throw new Error('A non-empty canonical CAD source matching the geometry format is required.');
    }
    this.geometrySource = { sourceName: source.sourceName, sourceFormat: source.sourceFormat, sourceBytes: source.sourceBytes };
    this.document.geometry = geometry;
    this.document.selectedFaceIds = [];
    this.document.boundaryConditions = [];
    this.document.loads = [];
    this.document.meshMetadata = null;
    this.document.mesh = null;
    this.document.viewportPresentation = { mode: 'model', displayStyle: this.document.viewportPresentation.displayStyle };
    this.document.meshGeneration = { status: 'idle', error: null, progress: null };
    this.refreshConstraintStability();
    this.invalidateResults('geometry');
    this.document.geometryImport = { status: 'succeeded', sourceName: source.sourceName, error: null };
    this.notify();
  };

  /** Atomically install a replacement geometry and a completely validated setup transfer. */
  AppController.prototype.replaceGeometryWithSetup = function (geometry, source, transfer) {
    var geometryValidation = root.SpjutsimFEA.validateGeometryModel(geometry);
    var materialValidation;
    var gravityValidation;
    var meshValidation;
    var supports;
    var loads;
    var viewportPreferences;
    if (!geometryValidation.valid) { throw new Error('Invalid replacement geometry: ' + geometryValidation.reason); }
    if (!source || typeof source.sourceName !== 'string' || source.sourceFormat !== geometry.sourceFormat ||
        root.SpjutsimFEA.sourceFormatForFilename(source.sourceName) !== source.sourceFormat ||
        !(source.sourceBytes instanceof ArrayBuffer) || !source.sourceBytes.byteLength) {
      throw new Error('A non-empty canonical CAD source matching the replacement geometry is required.');
    }
    if (!transfer || !Array.isArray(transfer.boundaryConditions) || !Array.isArray(transfer.loads)) {
      throw new Error('A completed replacement setup transfer is required.');
    }
    materialValidation = transfer.material === null ? { valid: true, value: null }
      : root.SpjutsimFEA.validateIsotropicMaterial(transfer.material, transfer.gravity);
    if (!materialValidation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(materialValidation)); }
    gravityValidation = root.SpjutsimFEA.validateGravity(transfer.gravity, materialValidation.value);
    if (!gravityValidation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(gravityValidation)); }
    supports = transfer.boundaryConditions.map(function (item) {
      var validation = root.SpjutsimFEA.validateBoundaryCondition(item, geometry.faceIds);
      if (!validation.valid) { throw new Error('Invalid selected CAD faces for replacement support: ' + root.SpjutsimFEA.firstValidationMessage(validation)); }
      return validation.value;
    });
    loads = transfer.loads.map(function (item) {
      var validation = root.SpjutsimFEA.validateLoad(item, geometry.faceIds);
      if (!validation.valid) { throw new Error('Invalid selected CAD faces for replacement load: ' + root.SpjutsimFEA.firstValidationMessage(validation)); }
      return validation.value;
    });
    meshValidation = root.SpjutsimFEA.validateMeshSettings(transfer.meshSettings, geometry.boundingBoxM);
    if (!meshValidation.valid) { throw new Error('Invalid transferred mesh settings: ' + meshValidation.reason); }
    if (!transfer.solveSettings || !Number.isFinite(transfer.solveSettings.relativeTolerance) || transfer.solveSettings.relativeTolerance <= 0 ||
        !Number.isFinite(transfer.solveSettings.equilibriumTolerance) || transfer.solveSettings.equilibriumTolerance <= 0 ||
        !Number.isFinite(transfer.solveSettings.maxIterations) || transfer.solveSettings.maxIterations < 0) {
      throw new Error('Invalid transferred solve settings.');
    }
    viewportPreferences = transfer.viewportPreferences || {};

    this.geometrySource = { sourceName: source.sourceName, sourceFormat: source.sourceFormat, sourceBytes: source.sourceBytes };
    this.document.geometry = geometry;
    this.document.material = materialValidation.value;
    this.document.boundaryConditions = supports;
    this.document.loads = loads;
    this.document.gravity = gravityValidation.value;
    this.document.meshSettings = Object.assign({}, transfer.meshSettings);
    this.document.solveSettings = Object.assign({}, transfer.solveSettings);
    this.document.selectedFaceIds = [];
    this.document.meshMetadata = null;
    this.document.mesh = null;
    this.document.meshGeneration = { status: 'idle', error: null, progress: null };
    this.refreshConstraintStability();
    this.invalidateResults('geometry');
    this.document.viewportPresentation = {
      mode: 'model', displayStyle: viewportPreferences.displayStyle || 'lines', field: 'vonMises', meshOverlay: false,
      deformationMode: 'undeformed', deformationScale: 0,
      userDeformationScale: Number.isFinite(viewportPreferences.userDeformationScale) ? viewportPreferences.userDeformationScale : 100
    };
    this.document.geometryImport = { status: 'succeeded', sourceName: source.sourceName, error: null };
    this.notify();
  };

  AppController.prototype.clearGeometry = function () {
    this.geometrySource = null;
    this.document.geometry = null;
    this.document.selectedFaceIds = [];
    this.document.boundaryConditions = [];
    this.document.loads = [];
    this.document.meshMetadata = null;
    this.document.mesh = null;
    this.document.viewportPresentation = { mode: 'model', displayStyle: this.document.viewportPresentation.displayStyle };
    this.document.meshGeneration = { status: 'idle', error: null, progress: null };
    this.refreshConstraintStability();
    this.invalidateResults('geometry');
    this.document.geometryImport = { status: 'idle', sourceName: null, error: null };
    this.notify();
  };

  AppController.prototype.replaceOrientedGeometry = function (oriented) {
    var validation;
    validation = root.SpjutsimFEA.validateGeometryModel(oriented);
    if (!validation.valid) { throw new Error('Invalid oriented geometry: ' + validation.reason); }
    this.document.geometry = oriented;
    this.document.mesh = null;
    this.document.meshMetadata = null;
    this.document.meshGeneration = { status: 'idle', error: null, progress: null };
    this.refreshConstraintStability();
    this.document.viewportPresentation = Object.assign({}, this.document.viewportPresentation, { mode: 'model' });
    this.invalidateResults('orientation');
    this.notify();
    return oriented.orientation;
  };

  AppController.prototype.applyGeometryRotation = function (rotation, operationLabel) {
    if (!this.document.geometry) { throw new Error('Import geometry before changing model orientation.'); }
    return this.replaceOrientedGeometry(root.SpjutsimFEA.applyRotationToGeometry(this.document.geometry, rotation, operationLabel));
  };

  AppController.prototype.rotateGeometryAroundGlobalAxis = function (axis, degrees) {
    var rotation = root.SpjutsimFEA.axisRotationMatrix(axis, degrees);
    var normalized = Number(Number(degrees).toPrecision(8));
    var label = axis.toUpperCase() + ' ' + (normalized >= 0 ? '+' : '−') + Math.abs(normalized) + '°';
    return this.applyGeometryRotation(rotation, label);
  };

  AppController.prototype.resetGeometryOrientation = function () {
    if (!this.document.geometry) { throw new Error('Import geometry before changing model orientation.'); }
    return this.replaceOrientedGeometry(root.SpjutsimFEA.resetGeometryOrientation(this.document.geometry));
  };

  AppController.prototype.orientSelectedFaceToDirection = function (direction) {
    var directions = {
      '+x': { vector: [1, 0, 0], label: '+X' }, '-x': { vector: [-1, 0, 0], label: '−X' },
      '+y': { vector: [0, 1, 0], label: '+Y' }, '-y': { vector: [0, -1, 0], label: '−Y' },
      '+z': { vector: [0, 0, 1], label: '+Z' }, '-z': { vector: [0, 0, -1], label: '−Z' }
    };
    var target = directions[direction];
    var result;
    if (!this.document.geometry) { throw new Error('Import geometry before changing model orientation.'); }
    if (this.document.selectedFaceIds.length !== 1) {
      throw new Error('Select exactly one CAD face to orient it to a global direction.');
    }
    if (!target) { throw new Error('Choose a global +X, −X, +Y, −Y, +Z, or −Z direction.'); }
    result = root.SpjutsimFEA.alignGeometryFaceNormal(
      this.document.geometry, this.document.selectedFaceIds[0], target.vector, target.label
    );
    this.replaceOrientedGeometry(result.geometry);
    return result;
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
    if (!this.document.selectedFaceIds.length) { return; }
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
      id: this.createAnalysisItemId('support'),
      name: 'Support ' + this.nextSupportNameSequence,
      faceIds: this.document.selectedFaceIds.slice()
    });
    var validation = root.SpjutsimFEA.validateBoundaryCondition(candidate, this.document.geometry && this.document.geometry.faceIds);
    if (!validation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validation)); }
    this.document.boundaryConditions.push(validation.value);
    this.nextSupportNameSequence += 1;
    this.refreshConstraintStability();
    this.invalidateResults('boundary-conditions');
    this.notify();
    return validation.value.id;
  };

  AppController.prototype.replaceBoundaryCondition = function (id, definition) {
    var index = findItem(this.document.boundaryConditions, id, 'support');
    var existing = this.document.boundaryConditions[index];
    var candidate = Object.assign({}, definition, {
      id: id,
      name: existing.name,
      type: definition.type === undefined ? existing.type : definition.type,
      faceIds: definition.faceIds === undefined ? existing.faceIds.slice() : definition.faceIds
    });
    var validation = root.SpjutsimFEA.validateBoundaryCondition(candidate, this.document.geometry && this.document.geometry.faceIds);
    if (!validation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validation)); }
    this.document.boundaryConditions[index] = validation.value;
    this.refreshConstraintStability();
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
    this.refreshConstraintStability();
    this.invalidateResults('boundary-conditions');
    this.notify();
  };

  AppController.prototype.createLoad = function (definition) {
    var candidate = Object.assign({}, definition, {
      id: this.createAnalysisItemId('load'),
      name: 'Load ' + this.nextLoadNameSequence,
      faceIds: this.document.selectedFaceIds.slice()
    });
    var validation = root.SpjutsimFEA.validateLoad(candidate, this.document.geometry && this.document.geometry.faceIds);
    if (!validation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validation)); }
    this.document.loads.push(validation.value);
    this.nextLoadNameSequence += 1;
    this.invalidateResults('loads');
    this.notify();
    return validation.value.id;
  };

  AppController.prototype.replaceLoad = function (id, definition) {
    var index = findItem(this.document.loads, id, 'load');
    var existing = this.document.loads[index];
    var candidate = Object.assign({}, definition, {
      id: id,
      name: existing.name,
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
    this.refreshConstraintStability();
    this.invalidateResults('mesh-settings');
    this.document.meshGeneration = { status: 'idle', error: null, progress: null };
    this.document.viewportPresentation = { mode: 'model', displayStyle: this.document.viewportPresentation.displayStyle };
    this.notify();
  };

  AppController.prototype.beginMeshGeneration = function () {
    if (!this.document.geometry || !this.geometrySource) { throw new Error('Import geometry before generating a mesh.'); }
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
    this.refreshConstraintStability();
    this.invalidateResults('mesh');
    this.document.meshGeneration = { status: 'succeeded', error: null, progress: null };
    this.notify();
  };

  AppController.prototype.clearMesh = function () {
    this.document.mesh = null;
    this.document.meshMetadata = null;
    this.refreshConstraintStability();
    this.invalidateResults('mesh');
    this.document.meshGeneration = { status: 'idle', error: null, progress: null };
    this.document.viewportPresentation = { mode: 'model', displayStyle: this.document.viewportPresentation.displayStyle };
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
    this.document.results = root.SpjutsimFEA.decorateResultWithTrust(result, this.document.material);
    this.document.solveExecution = { status: 'succeeded', error: null, progress: null, analysisRevision: revision };
    this.document.resultInvalidation = null;
    this.document.viewportPresentation = Object.assign({}, this.document.viewportPresentation, {
      mode: 'stress', field: 'vonMises', deformationMode: 'undeformed', deformationScale: 0
    });
    this.notify();
    return true;
  };

  AppController.prototype.beginConvergenceStudy = function (settings) {
    if (!this.document.geometry || !this.document.material || !this.geometrySource) {
      throw new Error('Import geometry and define a material before starting convergence.');
    }
    this.document.convergenceStudy = { schemaVersion: 1, status: 'running',
      settings: root.SpjutsimFEA.createConvergenceSettings(settings), levels: [],
      classification: null, stopReason: null, error: null, progress: null,
      selectedLevel: null, selectedResult: null, analysisRevision: this.document.analysisRevision };
    this.notify();
    return this.document.analysisRevision;
  };

  AppController.prototype.reportConvergenceProgress = function (revision, progress) {
    var study = this.document.convergenceStudy;
    if (!study || study.status !== 'running' || revision !== this.document.analysisRevision) { return false; }
    study.progress = progress; this.notify(); return true;
  };

  AppController.prototype.completeConvergenceLevel = function (revision, summary, result) {
    var study = this.document.convergenceStudy;
    if (!study || study.status !== 'running' || revision !== this.document.analysisRevision) { return false; }
    study.levels.push(summary);
    study.selectedLevel = summary.level;
    study.selectedResult = result;
    this.document.results = result;
    this.document.viewportPresentation = Object.assign({}, this.document.viewportPresentation,
      { mode: 'stress', field: 'vonMises' });
    this.notify(); return true;
  };

  AppController.prototype.completeConvergenceStudy = function (revision, classification, error) {
    var study = this.document.convergenceStudy;
    if (!study || revision !== this.document.analysisRevision) { return false; }
    study.status = classification.stopReason === 'cancelled' ? 'cancelled' :
      classification.status === 'failed' ? 'failed' : 'completed';
    study.classification = classification;
    study.stopReason = classification.stopReason;
    study.error = error || null;
    study.progress = null;
    if (study.selectedResult) {
      study.selectedResult.convergenceStatus = classification.status;
      if (classification.warning && study.selectedResult.warnings.indexOf(classification.warning) < 0) {
        study.selectedResult.warnings.push(classification.warning);
      }
    }
    this.notify(); return true;
  };

  AppController.prototype.cancelConvergenceStudy = function () {
    var study = this.document.convergenceStudy;
    if (!study || study.status !== 'running') { return false; }
    study.status = 'cancelled'; study.stopReason = 'cancelled'; study.progress = null;
    this.notify(); return true;
  };

  AppController.prototype.restartConvergenceStudy = function () {
    var settings = this.document.convergenceStudy && this.document.convergenceStudy.settings;
    return this.beginConvergenceStudy(settings);
  };

  AppController.prototype.selectConvergenceLevel = function (level) {
    var study = this.document.convergenceStudy;
    if (!study || study.selectedLevel !== level || !study.selectedResult) { return false; }
    this.document.results = study.selectedResult; this.notify(); return true;
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
