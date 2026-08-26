(function (root) {
  'use strict';
  function UIController(controller) {
    this.controller = controller;
    this.importHandler = null;
    this.importButton = document.getElementById('import-step-button');
    this.importInput = document.getElementById('import-step-input');
    this.geometryStatus = document.getElementById('geometry-status');
    this.faceSelectionStatus = document.getElementById('face-selection-status');
    this.clearFaceSelectionButton = document.getElementById('clear-face-selection-button');
    this.meshPreset = document.getElementById('mesh-preset');
    this.meshCustomSizes = document.getElementById('mesh-custom-sizes');
    this.meshMinSize = document.getElementById('mesh-min-size');
    this.meshMaxSize = document.getElementById('mesh-max-size');
    this.generateMeshButton = document.getElementById('generate-mesh-button');
    this.cancelMeshButton = document.getElementById('cancel-mesh-button');
    this.meshStatus = document.getElementById('mesh-status');
    this.customMeshSizes = null;
    this.generateMeshHandler = null;
    this.cancelMeshHandler = null;
  }
  UIController.prototype.setImportHandler = function (handler) {
    this.importHandler = handler;
  };
  UIController.prototype.setMeshHandlers = function (generate, cancel) {
    this.generateMeshHandler = generate;
    this.cancelMeshHandler = cancel;
  };
  UIController.prototype.start = function () {
    var self = this;
    if (this.importButton && this.importInput) {
      this.importButton.addEventListener('click', function () { self.importInput.click(); });
      this.importInput.addEventListener('change', function () {
        var file = self.importInput.files && self.importInput.files[0];
        self.importInput.value = '';
        if (file && self.importHandler) { self.importHandler(file); }
      });
    }
    if (this.clearFaceSelectionButton) {
      this.clearFaceSelectionButton.addEventListener('click', function () {
        self.controller.clearSelectedFaces();
      });
    }
    if (this.meshPreset) {
      this.meshPreset.addEventListener('change', function () { self.updateMeshSettingsFromControls(); });
    }
    if (this.meshMinSize) { this.meshMinSize.addEventListener('change', function () { self.updateMeshSettingsFromControls(); }); }
    if (this.meshMaxSize) { this.meshMaxSize.addEventListener('change', function () { self.updateMeshSettingsFromControls(); }); }
    if (this.generateMeshButton) {
      this.generateMeshButton.addEventListener('click', function () { if (self.generateMeshHandler) { self.generateMeshHandler(); } });
    }
    if (this.cancelMeshButton) {
      this.cancelMeshButton.addEventListener('click', function () { if (self.cancelMeshHandler) { self.cancelMeshHandler(); } });
    }
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || !self.controller.document.selectedFaceIds.length) { return; }
      self.controller.clearSelectedFaces();
      event.preventDefault();
    });
    this.controller.subscribe(function (documentState) { self.render(documentState); });
  };
  UIController.prototype.render = function (documentState) {
    var state = documentState.geometryImport || { status: 'idle' };
    var message = 'Choose a STEP solid to begin.';
    if (state.status === 'importing') {
      message = (state.progress && state.progress.userMessage) || 'Importing STEP geometry…';
    } else if (state.status === 'succeeded' && documentState.geometry) {
      message = documentState.geometry.sourceName + ': ' + documentState.geometry.faceIds.length + ' faces imported.';
    } else if (state.status === 'failed') {
      message = (state.error && state.error.userMessage) || 'The STEP file could not be imported.';
    }
    if (this.geometryStatus) { this.geometryStatus.textContent = message; }
    if (this.importButton) { this.importButton.disabled = state.status === 'importing'; }
    this.renderFaceSelection(documentState);
    this.renderMesh(documentState);
  };
  UIController.prototype.updateMeshSettingsFromControls = function () {
    var preset = this.meshPreset.value;
    var settings = { preset: preset, elementType: 'tet4' };
    if (preset === 'custom') {
      var minimum = Number(this.meshMinSize.value);
      var maximum = Number(this.meshMaxSize.value);
      if (!(minimum > 0) || !(maximum > 0)) {
        var defaults = this.customMeshSizes || root.SpjutsimFEA.resolveMeshSettings(
          this.controller.document.meshSettings,
          this.controller.document.geometry && this.controller.document.geometry.boundingBoxM
        );
        minimum = defaults.minSizeM;
        maximum = defaults.maxSizeM;
      }
      settings.minSizeM = minimum;
      settings.maxSizeM = maximum;
    }
    try {
      this.controller.replaceMeshSettings(settings);
      if (preset === 'custom') {
        this.customMeshSizes = { minSizeM: settings.minSizeM, maxSizeM: settings.maxSizeM };
      }
    } catch (error) {
      this.renderMesh(this.controller.document);
    }
  };
  UIController.prototype.renderMesh = function (documentState) {
    var settings = documentState.meshSettings || { preset: 'normal', elementType: 'tet4' };
    var generation = documentState.meshGeneration || { status: 'idle' };
    var hasGeometry = Boolean(documentState.geometry);
    var isGenerating = generation.status === 'generating';
    var message = 'Import geometry to generate a mesh.';
    if (this.meshPreset) { this.meshPreset.value = settings.preset; this.meshPreset.disabled = !hasGeometry || isGenerating; }
    if (this.meshCustomSizes) { this.meshCustomSizes.hidden = settings.preset !== 'custom'; }
    if (this.meshMinSize) { this.meshMinSize.value = settings.preset === 'custom' ? settings.minSizeM : ''; this.meshMinSize.disabled = !hasGeometry || isGenerating; }
    if (this.meshMaxSize) { this.meshMaxSize.value = settings.preset === 'custom' ? settings.maxSizeM : ''; this.meshMaxSize.disabled = !hasGeometry || isGenerating; }
    if (isGenerating) {
      message = (generation.progress && generation.progress.userMessage) || 'Generating Tet4 mesh…';
    } else if (generation.status === 'failed') {
      message = (generation.error && generation.error.userMessage) || 'The mesh could not be generated.';
    } else if (documentState.meshMetadata) {
      message = documentState.meshMetadata.statistics.elementCount + ' Tet4 elements; ' + documentState.meshMetadata.statistics.nodeCount + ' nodes.';
      if (documentState.meshMetadata.quality.warning) { message += ' ' + documentState.meshMetadata.quality.warning; }
    } else if (hasGeometry) {
      message = 'Ready to generate a Tet4 mesh.';
    }
    if (this.meshStatus) { this.meshStatus.textContent = message; }
    if (this.generateMeshButton) { this.generateMeshButton.disabled = !hasGeometry || isGenerating; }
    if (this.cancelMeshButton) { this.cancelMeshButton.hidden = !isGenerating; }
  };
  UIController.prototype.renderFaceSelection = function (documentState) {
    var selectedFaceIds = Array.isArray(documentState.selectedFaceIds) ? documentState.selectedFaceIds : [];
    var message;
    if (!documentState.geometry) {
      message = 'Import geometry to select faces.';
    } else if (selectedFaceIds.length === 0) {
      message = 'No faces selected. Click a face to select it; Shift-click to add or remove a face.';
    } else {
      message = selectedFaceIds.length + (selectedFaceIds.length === 1 ? ' face selected.' : ' faces selected.');
    }
    if (this.faceSelectionStatus) { this.faceSelectionStatus.textContent = message; }
    if (this.clearFaceSelectionButton) { this.clearFaceSelectionButton.disabled = selectedFaceIds.length === 0; }
  };
  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.UIController = UIController;
}(globalThis));
