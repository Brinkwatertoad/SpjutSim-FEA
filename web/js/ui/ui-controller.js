(function (root) {
  'use strict';
  function UIController(controller) {
    this.controller = controller;
    this.importHandler = null;
    this.importButton = document.getElementById('import-step-button');
    this.importInput = document.getElementById('import-step-input');
    this.geometryStatus = document.getElementById('geometry-status');
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
  };
  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.UIController = UIController;
}(globalThis));
