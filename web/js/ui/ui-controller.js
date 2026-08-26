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
    this.viewport = null;
    this.navigationPreferences = this.loadNavigationPreferences();
    this.applicationMenu = document.getElementById('application-menu');
    this.fitViewButton = document.getElementById('fit-view-button');
    this.resetViewButton = document.getElementById('reset-view-button');
    this.settingsBackdrop = document.getElementById('settings-backdrop');
    this.settingsDialog = document.getElementById('settings-dialog');
    this.closeSettingsButton = document.getElementById('close-settings-button');
    this.resetNavigationSettingsButton = document.getElementById('reset-navigation-settings-button');
    this.settingsTabControls = document.getElementById('settings-tab-controls');
    this.settingsPanelControls = document.getElementById('settings-panel-controls');
    this.navigationRotateButton = document.getElementById('navigation-rotate-button');
    this.navigationPanButton = document.getElementById('navigation-pan-button');
    this.navigationReverseZoom = document.getElementById('navigation-reverse-zoom');
    this.navigationRotateSensitivity = document.getElementById('navigation-rotate-sensitivity');
    this.navigationPanSensitivity = document.getElementById('navigation-pan-sensitivity');
    this.navigationZoomSensitivity = document.getElementById('navigation-zoom-sensitivity');
    this.navigationArrowStep = document.getElementById('navigation-arrow-step');
    this.settingsHub = null;
    this.settingsOpen = false;
  }

  UIController.prototype.loadNavigationPreferences = function () {
    var storage = null;
    try { storage = root.localStorage; } catch (error) { storage = null; }
    return root.SpjutsimFEA.loadViewportNavigationPreferences(storage);
  };

  UIController.prototype.saveNavigationPreferences = function () {
    var storage = null;
    try { storage = root.localStorage; } catch (error) { storage = null; }
    this.navigationPreferences = root.SpjutsimFEA.saveViewportNavigationPreferences(this.navigationPreferences, storage);
    if (this.viewport) { this.viewport.setNavigationPreferences(this.navigationPreferences); }
    this.renderNavigationPreferences();
  };

  UIController.prototype.setViewportController = function (viewport) {
    this.viewport = viewport || null;
    if (this.viewport) { this.viewport.setNavigationPreferences(this.navigationPreferences); }
    this.renderNavigationPreferences();
  };

  UIController.prototype.renderNavigationPreferences = function () {
    var preferences = this.navigationPreferences;
    if (this.navigationRotateButton) { this.navigationRotateButton.value = String(preferences.rotateButton); }
    if (this.navigationPanButton) { this.navigationPanButton.value = String(preferences.panButton); }
    if (this.navigationReverseZoom) { this.navigationReverseZoom.checked = preferences.reverseZoom; }
    if (this.navigationRotateSensitivity) { this.navigationRotateSensitivity.value = String(preferences.rotateSensitivity); }
    if (this.navigationPanSensitivity) { this.navigationPanSensitivity.value = String(preferences.panSensitivity); }
    if (this.navigationZoomSensitivity) { this.navigationZoomSensitivity.value = String(preferences.zoomSensitivity); }
    if (this.navigationArrowStep) { this.navigationArrowStep.value = String(preferences.arrowStep); }
  };

  UIController.prototype.readNavigationPreferences = function (changedField) {
    var source = Object.assign({}, this.navigationPreferences, {
      rotateButton: this.navigationRotateButton ? Number(this.navigationRotateButton.value) : this.navigationPreferences.rotateButton,
      panButton: this.navigationPanButton ? Number(this.navigationPanButton.value) : this.navigationPreferences.panButton,
      reverseZoom: this.navigationReverseZoom ? this.navigationReverseZoom.checked : this.navigationPreferences.reverseZoom,
      rotateSensitivity: this.navigationRotateSensitivity ? Number(this.navigationRotateSensitivity.value) : this.navigationPreferences.rotateSensitivity,
      panSensitivity: this.navigationPanSensitivity ? Number(this.navigationPanSensitivity.value) : this.navigationPreferences.panSensitivity,
      zoomSensitivity: this.navigationZoomSensitivity ? Number(this.navigationZoomSensitivity.value) : this.navigationPreferences.zoomSensitivity,
      arrowStep: this.navigationArrowStep ? Number(this.navigationArrowStep.value) : this.navigationPreferences.arrowStep
    });
    if (source.rotateButton === source.panButton) {
      if (changedField === 'rotateButton') { source.panButton = source.rotateButton === 0 ? 2 : 0; }
      else { source.rotateButton = source.panButton === 0 ? 2 : 0; }
    }
    this.navigationPreferences = root.SpjutsimFEA.normalizeViewportNavigationPreferences(source);
    this.saveNavigationPreferences();
  };

  UIController.prototype.openSettings = function (opener) {
    if (!this.settingsBackdrop || !this.settingsDialog || !this.settingsHub) { return; }
    this.settingsOpen = true;
    this.settingsHub.setOpener(opener || document.activeElement);
    this.settingsBackdrop.hidden = false;
    this.settingsHub.setActive('controls', { focusSelector: '#navigation-rotate-button' });
  };

  UIController.prototype.closeSettings = function () {
    if (!this.settingsOpen || !this.settingsBackdrop) { return; }
    this.settingsOpen = false;
    this.settingsBackdrop.hidden = true;
    this.settingsHub.restoreOpenerFocus();
  };

  UIController.prototype.trapSettingsFocus = function (event) {
    var focusable;
    var index;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSettings();
      return;
    }
    if (event.key !== 'Tab') { return; }
    focusable = Array.from(this.settingsDialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    if (!focusable.length) { return; }
    index = focusable.indexOf(document.activeElement);
    if (event.shiftKey && (index <= 0)) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
    else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0].focus(); }
  };

  UIController.prototype.isSettingsShortcut = function (event) {
    return Boolean(event && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey &&
      (event.key === ',' || event.code === 'Comma'));
  };
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
    if (this.fitViewButton) { this.fitViewButton.addEventListener('click', function () { if (self.viewport) { self.viewport.fitCurrentModel(); } }); }
    if (this.resetViewButton) { this.resetViewButton.addEventListener('click', function () { if (self.viewport) { self.viewport.resetView(); } }); }
    if (this.applicationMenu && root.PortableUIShellBehaviors) {
      this.menuController = root.PortableUIShellBehaviors.createMenuController({
        menuBar: this.applicationMenu,
        document: document,
        dispatchAction: function (action) {
          if (action === 'import-step' && self.importButton) { self.importButton.click(); }
          if (action === 'fit-view' && self.viewport) { self.viewport.fitCurrentModel(); }
          if (action === 'reset-view' && self.viewport) { self.viewport.resetView(); }
          if (action === 'settings') {
            self.openSettings(self.applicationMenu.querySelector('[data-ui-menu-action="settings"]').closest('[data-ui-menu-group]').querySelector('[data-ui-menu-button]'));
          }
        }
      });
    }
    if (this.settingsTabControls && this.settingsPanelControls && root.PortableUISettingsHub) {
      this.settingsHub = root.PortableUISettingsHub.createSettingsHub({
        keys: ['controls'], tabs: [this.settingsTabControls], panels: [this.settingsPanelControls]
      });
    }
    if (this.closeSettingsButton) { this.closeSettingsButton.addEventListener('click', function () { self.closeSettings(); }); }
    if (this.resetNavigationSettingsButton) {
      this.resetNavigationSettingsButton.addEventListener('click', function () {
        self.navigationPreferences = root.SpjutsimFEA.normalizeViewportNavigationPreferences();
        self.saveNavigationPreferences();
      });
    }
    [
      [this.navigationRotateButton, 'rotateButton'], [this.navigationPanButton, 'panButton'],
      [this.navigationReverseZoom, 'reverseZoom'], [this.navigationRotateSensitivity, 'rotateSensitivity'],
      [this.navigationPanSensitivity, 'panSensitivity'], [this.navigationZoomSensitivity, 'zoomSensitivity'],
      [this.navigationArrowStep, 'arrowStep']
    ].forEach(function (entry) {
      if (entry[0]) { entry[0].addEventListener('change', function () { self.readNavigationPreferences(entry[1]); }); }
    });
    if (this.settingsBackdrop) {
      this.settingsBackdrop.addEventListener('click', function (event) { if (event.target === self.settingsBackdrop) { self.closeSettings(); } });
    }
    if (this.settingsDialog) { this.settingsDialog.addEventListener('keydown', function (event) { self.trapSettingsFocus(event); }); }
    document.addEventListener('keydown', function (event) {
      var target = event.target;
      var tag = String(target && target.tagName || '').toUpperCase();
      var editable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (target && target.isContentEditable);
      if (event.defaultPrevented) { return; }
      if (self.isSettingsShortcut(event) && !editable && !self.settingsOpen) {
        event.preventDefault();
        self.openSettings(document.activeElement);
        return;
      }
      if (self.settingsOpen) { return; }
      if (event.key !== 'Escape' || !self.controller.document.selectedFaceIds.length) { return; }
      self.controller.clearSelectedFaces();
      event.preventDefault();
    });
    this.renderNavigationPreferences();
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
