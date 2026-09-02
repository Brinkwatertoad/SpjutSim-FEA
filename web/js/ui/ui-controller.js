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
    this.meshElementType = document.getElementById('mesh-element-type');
    this.meshPreset = document.getElementById('mesh-preset');
    this.meshCustomSizes = document.getElementById('mesh-custom-sizes');
    this.meshMinSize = document.getElementById('mesh-min-size');
    this.meshMaxSize = document.getElementById('mesh-max-size');
    this.generateMeshButton = document.getElementById('generate-mesh-button');
    this.cancelMeshButton = document.getElementById('cancel-mesh-button');
    this.deleteMeshButton = document.getElementById('delete-mesh-button');
    this.meshStatus = document.getElementById('mesh-status');
    this.viewportMode = document.getElementById('viewport-mode');
    this.displayStyle = document.getElementById('display-style');
    this.resultField = document.getElementById('result-field');
    this.deformationMode = document.getElementById('deformation-mode');
    this.deformationScale = document.getElementById('deformation-scale');
    this.deformationScaleReadout = document.getElementById('deformation-scale-readout');
    this.deformationAnimationToggle = document.getElementById('deformation-animation-toggle');
    this.meshOverlay = document.getElementById('mesh-overlay');
    this.preflightButton = document.getElementById('preflight-button');
    this.solveButton = document.getElementById('solve-button');
    this.cancelSolveButton = document.getElementById('cancel-solve-button');
    this.solveStatus = document.getElementById('solve-status');
    this.preflightSummary = document.getElementById('preflight-summary');
    this.resultsEmpty = document.getElementById('results-empty');
    this.resultsSummary = document.getElementById('results-summary');
    this.resultsValues = document.getElementById('results-values');
    this.diagnosticsSummary = document.getElementById('diagnostics-summary');
    this.diagnosticsValues = document.getElementById('diagnostics-values');
    this.resultLegend = document.getElementById('result-legend');
    this.legendTitle = document.getElementById('legend-title');
    this.legendMin = document.getElementById('legend-min');
    this.legendMax = document.getElementById('legend-max');
    this.legendStatus = document.getElementById('legend-status');
    this.probeOutput = document.getElementById('probe-output');
    this.customMeshSizes = null;
    this.generateMeshHandler = null;
    this.cancelMeshHandler = null;
    this.deleteMeshHandler = null;
    this.preflightHandler = null;
    this.solveHandler = null;
    this.cancelSolveHandler = null;
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
    this.settingsTabAppearance = document.getElementById('settings-tab-appearance');
    this.settingsPanelControls = document.getElementById('settings-panel-controls');
    this.settingsPanelAppearance = document.getElementById('settings-panel-appearance');
    this.navigationRotateButton = document.getElementById('navigation-rotate-button');
    this.navigationPanButton = document.getElementById('navigation-pan-button');
    this.navigationReverseZoom = document.getElementById('navigation-reverse-zoom');
    this.navigationRotateSensitivity = document.getElementById('navigation-rotate-sensitivity');
    this.navigationPanSensitivity = document.getElementById('navigation-pan-sensitivity');
    this.navigationZoomSensitivity = document.getElementById('navigation-zoom-sensitivity');
    this.navigationArrowStep = document.getElementById('navigation-arrow-step');
    this.settingsHub = null;
    this.settingsOpen = false;
    this.settingsShortcut = this.resolveSettingsShortcut();
    this.settingsMenuShortcut = document.querySelector('[data-ui-menu-action="settings"] .ui-menu-shortcut');
    this.analysisAuthoring = root.SpjutsimFEA.AnalysisAuthoringUI ? new root.SpjutsimFEA.AnalysisAuthoringUI(controller) : null;
    this.deformationAnimating = false;
    this.deformationAnimationFrame = null;
    this.deformationAnimationElapsedMs = 0;
    this.deformationAnimationLastTimestamp = null;
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

  UIController.prototype.resolveSettingsShortcut = function (platform, userAgent) {
    var resolvedPlatform = String(platform == null ? (root.navigator && root.navigator.platform) : platform || '');
    var resolvedUserAgent = String(userAgent == null ? (root.navigator && root.navigator.userAgent) : userAgent || '');
    var isMac = /Mac|iPhone|iPad|iPod/.test(resolvedPlatform);
    var isSafari = /Safari\//.test(resolvedUserAgent) && !/(Chrome|Chromium|CriOS|FxiOS|Edg|OPR)\//.test(resolvedUserAgent);
    if (isMac && !isSafari) { return { modifier: 'meta', label: '⌘,' }; }
    return { modifier: 'control', label: 'Ctrl+,' };
  };

  UIController.prototype.applySettingsShortcutPresentation = function () {
    if (!this.settingsMenuShortcut) { return; }
    this.settingsMenuShortcut.textContent = this.settingsShortcut.label;
    this.settingsMenuShortcut.parentElement.setAttribute(
      'aria-keyshortcuts', this.settingsShortcut.modifier === 'meta' ? 'Meta+,' : 'Control+,'
    );
  };

  UIController.prototype.isSettingsShortcut = function (event) {
    var usesModifier = this.settingsShortcut.modifier === 'meta' ? event && event.metaKey : event && event.ctrlKey;
    return Boolean(event && usesModifier && !event.altKey && !event.shiftKey &&
      (event.key === ',' || event.code === 'Comma'));
  };
  UIController.prototype.setImportHandler = function (handler) {
    this.importHandler = handler;
  };
  UIController.prototype.setMeshHandlers = function (generate, cancel, remove) {
    this.generateMeshHandler = generate;
    this.cancelMeshHandler = cancel;
    this.deleteMeshHandler = remove;
  };
  UIController.prototype.setSolveHandlers = function (preflight, solve, cancel) {
    this.preflightHandler = preflight;
    this.solveHandler = solve;
    this.cancelSolveHandler = cancel;
  };
  UIController.prototype.start = function () {
    var self = this;
    this.applySettingsShortcutPresentation();
    if (this.analysisAuthoring) { this.analysisAuthoring.start(); }
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
    if (this.meshElementType) {
      this.meshElementType.addEventListener('change', function () { self.updateMeshSettingsFromControls(); });
    }
    if (this.meshMinSize) { this.meshMinSize.addEventListener('change', function () { self.updateMeshSettingsFromControls(); }); }
    if (this.meshMaxSize) { this.meshMaxSize.addEventListener('change', function () { self.updateMeshSettingsFromControls(); }); }
    if (this.generateMeshButton) {
      this.generateMeshButton.addEventListener('click', function () { if (self.generateMeshHandler) { self.generateMeshHandler(); } });
    }
    if (this.cancelMeshButton) {
      this.cancelMeshButton.addEventListener('click', function () { if (self.cancelMeshHandler) { self.cancelMeshHandler(); } });
    }
    if (this.deleteMeshButton) {
      this.deleteMeshButton.addEventListener('click', function () { if (self.deleteMeshHandler) { self.deleteMeshHandler(); } });
    }
    if (this.viewportMode) {
      this.viewportMode.addEventListener('change', function () { self.updateViewportPresentation(); });
    }
    if (this.displayStyle) {
      this.displayStyle.addEventListener('change', function () { self.updateViewportPresentation(); });
    }
    if (this.resultField) { this.resultField.addEventListener('change', function () { self.updateViewportPresentation(); }); }
    if (this.deformationMode) { this.deformationMode.addEventListener('change', function () { self.updateViewportPresentation(); }); }
    if (this.deformationScale) {
      this.deformationScale.addEventListener('input', function () {
        if (self.deformationMode) { self.deformationMode.value = 'user'; }
        self.updateViewportPresentation();
      });
    }
    if (this.deformationAnimationToggle) { this.deformationAnimationToggle.addEventListener('click', function () { self.toggleDeformationAnimation(); }); }
    if (this.meshOverlay) { this.meshOverlay.addEventListener('change', function () { self.updateViewportPresentation(); }); }
    if (this.preflightButton) { this.preflightButton.addEventListener('click', function () { if (self.preflightHandler) { self.preflightHandler(); } }); }
    if (this.solveButton) { this.solveButton.addEventListener('click', function () { if (self.solveHandler) { self.solveHandler(); } }); }
    if (this.cancelSolveButton) { this.cancelSolveButton.addEventListener('click', function () { if (self.cancelSolveHandler) { self.cancelSolveHandler(); } }); }
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
      var settingsKeys = ['controls'];
      var settingsTabs = [this.settingsTabControls];
      var settingsPanels = [this.settingsPanelControls];
      if (this.settingsTabAppearance && this.settingsPanelAppearance) {
        settingsKeys.push('appearance'); settingsTabs.push(this.settingsTabAppearance); settingsPanels.push(this.settingsPanelAppearance);
      }
      this.settingsHub = root.PortableUISettingsHub.createSettingsHub({
        keys: settingsKeys, tabs: settingsTabs, panels: settingsPanels
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
      if (self.analysisAuthoring && self.analysisAuthoring.handleDocumentKeyDown(event)) { return; }
      if (event.key !== 'Escape' || !self.controller.document.selectedFaceIds.length) { return; }
      self.controller.clearSelectedFaces();
      event.preventDefault();
    });
    this.renderNavigationPreferences();
    this.controller.subscribe(function (documentState) { self.render(documentState); });
  };
  UIController.prototype.render = function (documentState) {
    var state = documentState.geometryImport || { status: 'idle' };
    var message = 'Choose a STEP, IGES, or BREP solid to begin.';
    if (state.status === 'importing') {
      message = (state.progress && state.progress.userMessage) || 'Importing CAD geometry…';
    } else if (state.status === 'succeeded' && documentState.geometry) {
      message = documentState.geometry.sourceName + ': ' + documentState.geometry.faceIds.length + ' faces imported.';
    } else if (state.status === 'failed') {
      message = (state.error && state.error.userMessage) || 'The CAD file could not be imported.';
    }
    if (this.geometryStatus) { this.geometryStatus.textContent = message; }
    if (this.importButton) { this.importButton.disabled = state.status === 'importing'; }
    this.renderFaceSelection(documentState);
    this.renderMesh(documentState);
    this.renderViewportPresentation(documentState);
    this.renderSolve(documentState);
    this.renderResults(documentState);
    if (this.analysisAuthoring) { this.analysisAuthoring.render(documentState); }
  };
  UIController.prototype.updateMeshSettingsFromControls = function () {
    var preset = this.meshPreset.value;
    var settings = { preset: preset, elementType: this.meshElementType ? this.meshElementType.value : 'tet4' };
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
    var elementLabel = settings.elementType === 'tet10' ? 'Tet10' : 'Tet4';
    if (this.meshElementType) { this.meshElementType.value = settings.elementType; this.meshElementType.disabled = !hasGeometry || isGenerating; }
    if (this.meshPreset) { this.meshPreset.value = settings.preset; this.meshPreset.disabled = !hasGeometry || isGenerating; }
    if (this.meshCustomSizes) { this.meshCustomSizes.hidden = settings.preset !== 'custom'; }
    if (this.meshMinSize) { this.meshMinSize.value = settings.preset === 'custom' ? settings.minSizeM : ''; this.meshMinSize.disabled = !hasGeometry || isGenerating; }
    if (this.meshMaxSize) { this.meshMaxSize.value = settings.preset === 'custom' ? settings.maxSizeM : ''; this.meshMaxSize.disabled = !hasGeometry || isGenerating; }
    if (isGenerating) {
      message = (generation.progress && generation.progress.userMessage) || 'Generating ' + elementLabel + ' mesh…';
    } else if (generation.status === 'failed') {
      message = (generation.error && generation.error.userMessage) || 'The mesh could not be generated.';
    } else if (documentState.meshMetadata) {
      message = documentState.meshMetadata.statistics.elementCount + ' ' + elementLabel + ' elements; ' + documentState.meshMetadata.statistics.nodeCount + ' nodes.';
      if (documentState.meshMetadata.quality.warning) { message += ' ' + documentState.meshMetadata.quality.warning; }
    } else if (hasGeometry) {
      message = 'Ready to generate a ' + elementLabel + ' mesh.';
    }
    if (this.meshStatus) { this.meshStatus.textContent = message; }
    if (this.generateMeshButton) { this.generateMeshButton.disabled = !hasGeometry || isGenerating; }
    if (this.generateMeshButton) { this.generateMeshButton.textContent = documentState.mesh ? 'Regenerate mesh' : 'Generate mesh'; }
    if (this.cancelMeshButton) { this.cancelMeshButton.hidden = !isGenerating; }
    if (this.deleteMeshButton) { this.deleteMeshButton.hidden = !documentState.mesh || isGenerating; }
  };
  UIController.prototype.updateViewportPresentation = function () {
    var current = this.controller.document.viewportPresentation || {};
    var mode = this.viewportMode ? this.viewportMode.value : 'model';
    var field = this.resultField ? this.resultField.value : current.field;
    var deformationMode = this.deformationMode ? this.deformationMode.value : current.deformationMode;
    if (mode === 'stress' && ['vonMises', 'maxPrincipal', 'minPrincipal'].indexOf(field) < 0) { field = 'vonMises'; }
    if (mode === 'deformation' && ['displacementMagnitude', 'ux', 'uy', 'uz'].indexOf(field) < 0) { field = 'displacementMagnitude'; }
    try {
      this.controller.replaceViewportPresentation({
        mode: mode, displayStyle: this.displayStyle ? this.displayStyle.value : 'lines', field: field,
        meshOverlay: Boolean(this.meshOverlay && this.meshOverlay.checked), deformationMode: deformationMode,
        deformationScale: this.resolveDeformationScale(deformationMode),
        userDeformationScale: Math.max(0, Number(this.deformationScale && this.deformationScale.value) || 0)
      });
    } catch (error) {
      this.renderViewportPresentation(this.controller.document);
    }
  };
  UIController.prototype.renderViewportPresentation = function (documentState) {
    var presentation = documentState.viewportPresentation || { mode: 'model', displayStyle: 'lines' };
    var meshAvailable = Boolean(documentState.mesh);
    var resultsAvailable = Boolean(documentState.results);
    if (this.viewportMode) {
      var meshOption = this.viewportMode.querySelector('option[value="mesh"]');
      var stressOption = this.viewportMode.querySelector('option[value="stress"]');
      var deformationOption = this.viewportMode.querySelector('option[value="deformation"]');
      this.viewportMode.value = presentation.mode;
      if (meshOption) { meshOption.disabled = !meshAvailable; }
      if (stressOption) { stressOption.disabled = !resultsAvailable; }
      if (deformationOption) { deformationOption.disabled = !resultsAvailable; }
    }
    if (this.displayStyle) {
      this.displayStyle.value = presentation.displayStyle;
      this.displayStyle.disabled = false;
    }
    if (this.resultField) {
      this.resultField.value = presentation.field || (presentation.mode === 'deformation' ? 'displacementMagnitude' : 'vonMises');
      this.resultField.disabled = !resultsAvailable || (presentation.mode !== 'stress' && presentation.mode !== 'deformation');
      Array.from(this.resultField.options).forEach(function (option) {
        var stress = ['vonMises', 'maxPrincipal', 'minPrincipal'].indexOf(option.value) >= 0;
        option.hidden = presentation.mode === 'stress' ? !stress : (presentation.mode === 'deformation' ? stress : false);
      });
    }
    if (this.deformationMode) { this.deformationMode.value = presentation.deformationMode || 'undeformed'; this.deformationMode.disabled = !resultsAvailable; }
    var deformationVisible = resultsAvailable && presentation.mode === 'deformation';
    if ((!deformationVisible || !(presentation.deformationScale > 0)) && this.deformationAnimating) { this.stopDeformationAnimation(); }
    if (this.deformationScale) {
      this.deformationScale.value = Number.isFinite(presentation.userDeformationScale) ? presentation.userDeformationScale : 100;
      this.deformationScale.hidden = !deformationVisible;
    }
    if (this.deformationScaleReadout) {
      this.deformationScaleReadout.hidden = !deformationVisible;
      if (!this.deformationAnimating) { this.deformationScaleReadout.textContent = 'x' + Number(presentation.deformationScale || 0).toLocaleString(undefined, { maximumSignificantDigits: 4 }); }
    }
    if (this.deformationAnimationToggle) {
      this.deformationAnimationToggle.hidden = !deformationVisible;
      this.deformationAnimationToggle.disabled = !deformationVisible || !(presentation.deformationScale > 0);
    }
    if (this.meshOverlay) { this.meshOverlay.checked = presentation.meshOverlay === true; this.meshOverlay.disabled = !meshAvailable || !resultsAvailable; }
    this.renderLegend(documentState);
  };

  UIController.prototype.updateDeformationAnimationToggle = function () {
    if (!this.deformationAnimationToggle) { return; }
    this.deformationAnimationToggle.textContent = this.deformationAnimating ? 'Stop' : 'Play';
    this.deformationAnimationToggle.setAttribute('aria-pressed', this.deformationAnimating ? 'true' : 'false');
    this.deformationAnimationToggle.setAttribute('aria-label', (this.deformationAnimating ? 'Stop' : 'Play') + ' deformed shape animation');
  };

  UIController.prototype.stepDeformationAnimation = function (timestamp) {
    var self = this;
    var multiplier;
    if (!this.deformationAnimating) { return; }
    if (!document.hidden) {
      if (this.deformationAnimationLastTimestamp !== null) {
        this.deformationAnimationElapsedMs += timestamp - this.deformationAnimationLastTimestamp;
      }
      this.deformationAnimationLastTimestamp = timestamp;
      multiplier = root.SpjutsimFEA.deformationAnimationMultiplier(this.deformationAnimationElapsedMs);
      if (this.viewport) { this.viewport.setDeformationAnimationMultiplier(multiplier); }
      if (this.deformationScaleReadout) {
        this.deformationScaleReadout.textContent = 'x' + (this.controller.document.viewportPresentation.deformationScale * multiplier)
          .toLocaleString(undefined, { maximumSignificantDigits: 4 });
      }
    } else {
      this.deformationAnimationLastTimestamp = null;
    }
    this.deformationAnimationFrame = root.requestAnimationFrame(function (nextTimestamp) { self.stepDeformationAnimation(nextTimestamp); });
  };

  UIController.prototype.startDeformationAnimation = function () {
    var self = this;
    var presentation = this.controller.document.viewportPresentation;
    if (this.deformationAnimating || !this.controller.document.results || presentation.mode !== 'deformation' || !(presentation.deformationScale > 0)) { return; }
    this.deformationAnimating = true;
    this.deformationAnimationElapsedMs = 0;
    this.deformationAnimationLastTimestamp = null;
    this.updateDeformationAnimationToggle();
    this.deformationAnimationFrame = root.requestAnimationFrame(function (timestamp) { self.stepDeformationAnimation(timestamp); });
  };

  UIController.prototype.stopDeformationAnimation = function () {
    if (this.deformationAnimationFrame !== null) { root.cancelAnimationFrame(this.deformationAnimationFrame); }
    this.deformationAnimationFrame = null;
    this.deformationAnimationLastTimestamp = null;
    this.deformationAnimating = false;
    if (this.viewport) { this.viewport.setDeformationAnimationMultiplier(1); }
    this.updateDeformationAnimationToggle();
    if (this.deformationScaleReadout) {
      this.deformationScaleReadout.textContent = 'x' + Number(this.controller.document.viewportPresentation.deformationScale || 0)
        .toLocaleString(undefined, { maximumSignificantDigits: 4 });
    }
  };

  UIController.prototype.toggleDeformationAnimation = function () {
    if (this.deformationAnimating) { this.stopDeformationAnimation(); } else { this.startDeformationAnimation(); }
  };

  UIController.prototype.dispose = function () { this.stopDeformationAnimation(); };

  UIController.prototype.resolveDeformationScale = function (mode) {
    var result = this.controller.document.results;
    var positions;
    var min;
    var max;
    var index;
    var diagonal;
    var maximumDisplacement;
    if (mode === 'undeformed' || !result) { return 0; }
    if (mode === 'true-scale') { return 1; }
    if (mode === 'user') { return Math.max(0, Number(this.deformationScale && this.deformationScale.value) || 0); }
    positions = result.originalSurface.nodePositionsM;
    min = [Infinity, Infinity, Infinity]; max = [-Infinity, -Infinity, -Infinity];
    for (index = 0; index < positions.length; index += 3) {
      min[0] = Math.min(min[0], positions[index]); min[1] = Math.min(min[1], positions[index + 1]); min[2] = Math.min(min[2], positions[index + 2]);
      max[0] = Math.max(max[0], positions[index]); max[1] = Math.max(max[1], positions[index + 1]); max[2] = Math.max(max[2], positions[index + 2]);
    }
    diagonal = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    maximumDisplacement = result.extrema.maxDisplacement.valueM;
    return maximumDisplacement > 0 ? diagonal * 0.1 / maximumDisplacement : 1;
  };

  function formatNumber(value, unit) {
    if (!Number.isFinite(value)) { return '—'; }
    return value.toLocaleString(undefined, { maximumSignificantDigits: 5 }) + (unit ? ' ' + unit : '');
  }
  function formatBytes(bytes) { return formatNumber(bytes / 1073741824, 'GiB'); }
  function replaceDefinitionList(element, entries) {
    if (!element) { return; }
    element.textContent = '';
    entries.forEach(function (entry) {
      var term = document.createElement('dt');
      var value = document.createElement('dd');
      term.textContent = entry[0]; value.textContent = entry[1]; element.append(term, value);
    });
  }

  UIController.prototype.renderSolve = function (documentState) {
    var preflight = documentState.solvePreflight || { status: 'idle' };
    var execution = documentState.solveExecution || { status: 'idle' };
    var running = preflight.status === 'running' || execution.status === 'running';
    var message = 'Generate a mesh and finish the analysis definition.';
    if (preflight.status === 'running') { message = (preflight.progress && preflight.progress.userMessage) || 'Running solve preflight…'; }
    else if (execution.status === 'running') { message = (execution.progress && execution.progress.userMessage) || 'Solving…'; }
    else if (preflight.status === 'failed') { message = (preflight.error && preflight.error.userMessage) || preflight.error && preflight.error.message || 'Preflight failed.'; }
    else if (execution.status === 'failed') { message = (execution.error && execution.error.userMessage) || 'Solve failed.'; }
    else if (execution.status === 'cancelled' || preflight.status === 'cancelled') { message = 'Solve cancelled; partial results were discarded.'; }
    else if (preflight.status === 'ready') {
      message = preflight.result.exceedsWasmCap ? 'Estimate exceeds the WebAssembly cap; generate a coarser mesh.' : 'Preflight complete. Review the estimate, then solve.';
    } else if (documentState.mesh && documentState.mesh.elementType === 'tet10') {
      message = 'Tet10 mesh inspection is available; Tet10 Solve is enabled in Task 13.';
    } else if (documentState.mesh) { message = 'Run preflight to validate constraints and estimate solve memory.'; }
    if (documentState.resultInvalidation && documentState.resultInvalidation.stale) { message += ' Previous results are stale.'; }
    if (this.solveStatus) { this.solveStatus.textContent = message; this.solveStatus.classList.toggle('fea-error', preflight.status === 'failed' || execution.status === 'failed'); }
    if (this.preflightButton) { this.preflightButton.disabled = !documentState.mesh || documentState.mesh.elementType === 'tet10' || running; }
    if (this.solveButton) { this.solveButton.disabled = preflight.status !== 'ready' || preflight.result.exceedsWasmCap || running; }
    if (this.cancelSolveButton) { this.cancelSolveButton.hidden = !running; }
    if (this.preflightSummary) {
      this.preflightSummary.hidden = preflight.status !== 'ready';
      if (preflight.status === 'ready') {
        replaceDefinitionList(this.preflightSummary, [
          ['Mesh', preflight.result.nodeCount + ' nodes / ' + preflight.result.elementCount + ' Tet4'],
          ['System', preflight.result.degreeOfFreedomCount + ' DOF / ' + preflight.result.exactNnz + ' nnz'],
          ['Memory', formatBytes(preflight.result.estimatedPeakBytes) + ' (' + preflight.result.classification + ')'],
          ['WASM cap', formatBytes(preflight.result.wasmHeapCapBytes)],
          ['Device hint', preflight.result.deviceMemoryGiBHint ? formatNumber(preflight.result.deviceMemoryGiBHint, 'GiB') : 'Unavailable'],
          ['Analysis', preflight.result.constraintCount + ' constrained DOF / ' + preflight.result.loadCount + ' loads'],
          ['Stability', preflight.result.constraintStability.status === 'fully-constrained' ? 'Fully constrained (mesh)' : 'Underconstrained (mesh)'],
          ['Quality', formatNumber(preflight.result.quality.minimum, 'γ min')]
        ]);
      }
    }
  };

  UIController.prototype.renderResults = function (documentState) {
    var result = documentState.results;
    if (this.resultsEmpty) { this.resultsEmpty.hidden = Boolean(result); }
    if (this.resultsSummary) { this.resultsSummary.hidden = !result; }
    if (this.diagnosticsSummary) { this.diagnosticsSummary.hidden = !result; }
    if (!result) { return; }
    replaceDefinitionList(this.resultsValues, [
      ['Max displacement', formatNumber(result.extrema.maxDisplacement.valueM * 1000, 'mm')],
      ['Raw von Mises max', formatNumber(result.extrema.rawVonMisesMax.valuePa / 1e6, 'MPa')],
      ['Displayed VM max', formatNumber(result.extrema.displayedVonMisesMax.valuePa / 1e6, 'MPa')],
      ['Max principal', formatNumber(result.extrema.rawMaxPrincipal.valuePa / 1e6, 'MPa')],
      ['Min principal', formatNumber(result.extrema.rawMinPrincipal.valuePa / 1e6, 'MPa')],
      ['Applied force', result.equilibrium.totalAppliedForceN.map(function (v) { return formatNumber(v, 'N'); }).join(', ')],
      ['Reaction', result.equilibrium.totalReactionN.map(function (v) { return formatNumber(v, 'N'); }).join(', ')]
    ]);
    replaceDefinitionList(this.diagnosticsValues, [
      ['Iterations', String(result.solverStatistics.iterations)],
      ['Solver residual', formatNumber(result.solverStatistics.finalRelativeResidual)],
      ['Force balance', formatNumber(result.equilibrium.relativeResidual)],
      ['Solve time', formatNumber(result.solverStatistics.solveDurationMs, 'ms')],
      ['Mesh', result.meshStatistics.nodeCount + ' nodes / ' + result.meshStatistics.elementCount + ' elements'],
      ['WASM memory', formatBytes(result.solverStatistics.wasmMemoryBytes)],
      ['Warnings', result.warnings.length ? result.warnings.join(' ') : 'None']
    ]);
  };

  UIController.prototype.renderLegend = function (documentState) {
    var result = documentState.results;
    var presentation = documentState.viewportPresentation || {};
    var definitions = {
      vonMises: ['von Mises stress', 'MPa', 1e6], maxPrincipal: ['maximum principal stress', 'MPa', 1e6],
      minPrincipal: ['minimum principal stress', 'MPa', 1e6], displacementMagnitude: ['displacement magnitude', 'mm', 1e-3],
      ux: ['Ux', 'mm', 1e-3], uy: ['Uy', 'mm', 1e-3], uz: ['Uz', 'mm', 1e-3]
    };
    var definition = definitions[presentation.field];
    var fieldRange = result && result.ranges[presentation.field];
    var show = Boolean(result && definition && (presentation.mode === 'stress' || presentation.mode === 'deformation'));
    if (!this.resultLegend) { return; }
    this.resultLegend.hidden = !show;
    if (!show) { return; }
    this.legendTitle.textContent = definition[0] + ' (' + definition[1] + ')';
    this.legendMin.textContent = formatNumber(fieldRange.minimum / definition[2]);
    this.legendMax.textContent = formatNumber(fieldRange.maximum / definition[2]);
    this.legendStatus.textContent = 'Unclipped range · deformation ×' + formatNumber(presentation.deformationScale || 0);
  };

  UIController.prototype.renderProbe = function (probe) {
    if (!this.probeOutput) { return; }
    this.probeOutput.hidden = !probe;
    if (!probe) { return; }
    this.probeOutput.textContent = 'FaceId ' + probe.faceId + ' · xyz ' + probe.coordinatesM.map(function (v) { return formatNumber(v, 'm'); }).join(', ') +
      ' · u ' + probe.displacementM.map(function (v) { return formatNumber(v * 1000, 'mm'); }).join(', ') +
      ' · ' + probe.fieldLabel + ' ' + formatNumber(probe.fieldValue / probe.unitScale, probe.unit);
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
