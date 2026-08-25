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
  }
  UIController.prototype.setImportHandler = function (handler) {
    this.importHandler = handler;
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
