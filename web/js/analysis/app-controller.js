(function (root) {
  'use strict';

  function AppController(options) {
    this.document = options.document;
    this.listeners = [];
    this.stepSource = null;
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

  AppController.prototype.subscribe = function (listener) {
    this.listeners.push(listener);
    listener(this.document);
  };

  AppController.prototype.notify = function () {
    var documentState = this.document;
    this.listeners.forEach(function (listener) { listener(documentState); });
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
    this.document.results = null;
    this.document.convergenceStudy = null;
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
    this.document.results = null;
    this.document.convergenceStudy = null;
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

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.AppController = AppController;
}(globalThis));
