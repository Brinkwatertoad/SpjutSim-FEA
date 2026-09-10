(function (root) {
  'use strict';
  function UIController(controller) {
    this.controller = controller;
    this.importHandler = null;
    this.importButton = document.getElementById('import-step-button');
    this.importInput = document.getElementById('import-step-input');
    this.geometryStatus = document.getElementById('geometry-status');
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
    this.solveReadinessStatus = document.getElementById('solve-readiness');
    this.checksRevision = document.getElementById('checks-revision');
    this.checksFindings = document.getElementById('checks-findings');
    this.checksSummary = document.getElementById('checks-summary');
    this.solveStatus = document.getElementById('solve-status');
    this.preflightSummary = document.getElementById('preflight-summary');
    this.solveOutputStatus = document.getElementById('solve-output-status');
    this.resultsEmpty = document.getElementById('results-empty');
    this.resultsSummary = document.getElementById('results-summary');
    this.resultsValues = document.getElementById('results-values');
    this.peakHeadline = document.getElementById('peak-headline');
    this.yieldHeadline = document.getElementById('yield-headline');
    this.trustHeadline = document.getElementById('trust-headline');
    this.locatePeakButton = document.getElementById('locate-peak-button');
    this.peakLocationStatus = document.getElementById('peak-location-status');
    this.diagnosticsSummary = document.getElementById('diagnostics-summary');
    this.diagnosticsValues = document.getElementById('diagnostics-values');
    this.convergenceSummary = document.getElementById('convergence-summary');
    this.startConvergenceButton = document.getElementById('start-convergence-button');
    this.cancelConvergenceButton = document.getElementById('cancel-convergence-button');
    this.convergenceStatus = document.getElementById('convergence-status');
    this.convergenceTable = document.getElementById('convergence-table');
    this.convergencePlot = document.getElementById('convergence-plot');
    this.outputTabs = Array.prototype.slice.call(document.querySelectorAll('[data-output-tab]'));
    this.outputPanels = Array.prototype.slice.call(document.querySelectorAll('[data-output-panel]'));
    this.resultLegend = document.getElementById('result-legend');
    this.legendTitle = document.getElementById('legend-title');
    this.legendMin = document.getElementById('legend-min');
    this.legendMax = document.getElementById('legend-max');
    this.stressUnit = document.getElementById('stress-unit');
    this.lengthUnit = document.getElementById('length-unit');
    this.legendOrientation = document.getElementById('legend-orientation');
    this.colorRangeMode = document.getElementById('color-range-mode');
    this.colorRangeMin = document.getElementById('color-range-min');
    this.colorRangeMax = document.getElementById('color-range-max');
    this.colorRangeLock = document.getElementById('color-range-lock');
    this.colorRangeError = document.getElementById('color-range-error');
    this.legendTicks = document.getElementById('legend-ticks');
    this.legendStatus = document.getElementById('legend-status');
    this.probeOutput = document.getElementById('probe-output');
    this.customMeshSizes = null;
    this.generateMeshHandler = null;
    this.cancelMeshHandler = null;
    this.deleteMeshHandler = null;
    this.preflightHandler = null;
    this.solveHandler = null;
    this.cancelSolveHandler = null;
    this.startConvergenceHandler = null;
    this.cancelConvergenceHandler = null;
    this.viewport = null;
    this.workspaceLayout = null;
    this.selectOutputTab = null;
    this.navigationPreferences = this.loadNavigationPreferences();
    try {
      var saved = JSON.parse(root.localStorage.getItem('spjutsim-fea-display-v1'));
      if (saved && this.controller.document.viewportPresentation) {
        var current = this.controller.document.viewportPresentation;
        this.controller.replaceViewportPresentation(Object.assign({},current,{
          legendOrientation:saved.legendOrientation === 'horizontal' ? 'horizontal' : 'vertical',
          displayStyle:['shaded', 'shaded-edges', 'wireframe'].indexOf(saved.displayStyle) >= 0 ? saved.displayStyle : 'shaded-edges'
        }));
      }
    } catch (ignored) { /* Invalid or unavailable preferences use defaults. */ }
    this.applicationMenu = document.getElementById('application-menu');
    this.fitViewButton = document.getElementById('fit-view-button');
    this.perspectiveToggle = document.getElementById('perspective-toggle');
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

  UIController.prototype.renderProjectionCommands = function () {
    var projection = this.navigationPreferences.projection || 'orthographic';
    if (this.perspectiveToggle) { this.perspectiveToggle.checked = projection === 'perspective'; }
    Array.from(document.querySelectorAll('[data-ui-menu-action^="projection-"]')).forEach(function (button) {
      button.setAttribute('aria-checked', String(button.dataset.uiMenuAction === 'projection-' + projection));
    });
  };

  UIController.prototype.renderNavigationPreferences = function () {
    this.renderProjectionCommands();
    var preferences = this.navigationPreferences;
    var buttons = ['Left','Middle','Right'];
    var help = buttons[preferences.rotateButton] + ' drag rotates · ' + buttons[preferences.panButton] + ' drag pans · Wheel or pinch zooms · Arrow keys rotate';
    var helpElement = document.getElementById('viewport-help'), canvas = document.getElementById('viewport');
    if (helpElement) { helpElement.textContent = help; }
    if (canvas) { canvas.setAttribute('aria-label','3D viewport. ' + help); }
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
      if (changedField === 'rotateButton') { source.panButton = this.navigationPreferences.rotateButton; }
      else { source.rotateButton = this.navigationPreferences.panButton; }
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
  UIController.prototype.setConvergenceHandlers = function (start, cancel) {
    this.startConvergenceHandler = start;
    this.cancelConvergenceHandler = cancel;
  };
  UIController.prototype.start = function () {
    var self = this;
    this.applySettingsShortcutPresentation();
    if (this.locatePeakButton) { this.locatePeakButton.addEventListener('click', function () {
      if(self.viewport)self.viewport.locatePeak();
    }); }
    this.renderProjectionCommands();
    this.selectOutputTab = configureOutputTabs(this.outputTabs, this.outputPanels);
    var workspace = document.querySelector(".fea-workspace");
    if (workspace && root.SpjutsimFEA.WorkspaceLayout) { this.workspaceLayout = new root.SpjutsimFEA.WorkspaceLayout(workspace); }
    if (this.analysisAuthoring) { this.analysisAuthoring.start(); }
    if (this.importButton && this.importInput) {
      this.importButton.addEventListener('click', function () { self.importInput.click(); });
      this.importInput.addEventListener('change', function () {
        var file = self.importInput.files && self.importInput.files[0];
        self.importInput.value = '';
        if (file && self.importHandler) { self.importHandler(file); }
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
    Array.from(document.querySelectorAll('[data-view-mode]')).forEach(function (button) {
      button.addEventListener('click', function () { self.viewportMode.value = button.dataset.viewMode; self.updateViewportPresentation(); });
    });
    [this.stressUnit, this.lengthUnit, this.legendOrientation, this.colorRangeMode, this.colorRangeMin, this.colorRangeMax, this.colorRangeLock].forEach(function (control) {
      if (control) { control.addEventListener('change', function () { if (control === self.colorRangeMin || control === self.colorRangeMax) { self.colorRangeMode.value = 'manual'; } self.updateViewportPresentation(); }); }
    });
    var displayPopover = document.getElementById('display-popover');
    if (displayPopover) {
      displayPopover.addEventListener('toggle', function () {
        if (!displayPopover.open) { return; }
        var bounds = displayPopover.getBoundingClientRect(), canvas = document.getElementById('viewport').getBoundingClientRect();
        var options = displayPopover.querySelector('.fea-display-options');
        options.style.left = Math.max(canvas.left + 6, Math.min(bounds.left, canvas.right - 266)) + 'px';
        options.style.top = Math.min(bounds.bottom + 4, canvas.bottom - 100) + 'px';
        options.style.maxHeight = Math.max(70, canvas.bottom - parseFloat(options.style.top) - 12) + 'px';
      });
      document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && displayPopover.open) { displayPopover.open = false; displayPopover.querySelector('summary').focus(); event.preventDefault(); } });
      document.addEventListener('pointerdown', function (event) { if (!displayPopover.contains(event.target)) { displayPopover.open = false; } });
    }
    if (this.resultLegend && root.SpjutsimFEA.LegendLayout && this.resultLegend.closest('.fea-canvas')) {
      this.legendLayout = new root.SpjutsimFEA.LegendLayout(this.resultLegend,function(){ self.renderLegend(self.controller.document); });
    } else if (this.resultLegend && root.ResizeObserver) {
      this.legendResizeObserver = new root.ResizeObserver(function () { self.renderLegend(self.controller.document); });
      this.legendResizeObserver.observe(this.resultLegend.parentElement);
    }
    ['show-loads','show-gravity','show-supports'].forEach(function(id){var control=document.getElementById(id);if(control)control.addEventListener('change',function(){self.controller.replaceViewportPresentation(Object.assign({},self.controller.document.viewportPresentation,id==='show-loads'?{showLoads:control.checked}:id==='show-supports'?{showSupports:control.checked}:{showGravity:control.checked}));});});
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
    if (this.preflightButton) { this.preflightButton.addEventListener('click', function () { if (self.preflightHandler) { self.showOutputPanel("checks"); self.preflightHandler(); } }); }
    Array.from(document.querySelectorAll('[data-history-action]:not([data-ui-menu-action])')).forEach(function (button) {
      button.addEventListener('click',function () { self.runHistoryAction(button.dataset.historyAction); });
    });
    var viewChecks = document.getElementById('view-checks-button');
    if (viewChecks) { viewChecks.addEventListener('click',function () { self.showOutputPanel('checks'); }); }
    if (this.solveButton) { this.solveButton.addEventListener('click', function () { if (self.solveHandler) { self.solveHandler(); } }); }
    if (this.cancelSolveButton) { this.cancelSolveButton.addEventListener('click', function () { if (self.cancelSolveHandler) { self.cancelSolveHandler(); } }); }
    if (this.startConvergenceButton) { this.startConvergenceButton.addEventListener('click', function () { if (self.startConvergenceHandler) { self.showOutputPanel("convergence"); self.startConvergenceHandler(); } }); }
    if (this.cancelConvergenceButton) { this.cancelConvergenceButton.addEventListener('click', function () { if (self.cancelConvergenceHandler) { self.cancelConvergenceHandler(); } }); }
    if (this.fitViewButton) { this.fitViewButton.addEventListener('click', function () { if (self.viewport) { self.viewport.fitCurrentModel(); } }); }
    if (this.perspectiveToggle) {
      this.perspectiveToggle.addEventListener('change', function () {
        if (!self.viewport) { return; }
        self.viewport.setProjection(self.perspectiveToggle.checked ? 'perspective' : 'orthographic');
        self.navigationPreferences = self.viewport.getNavigationPreferences();
        self.saveNavigationPreferences(); self.renderProjectionCommands();
      });
    }
    if (this.resetViewButton) { this.resetViewButton.addEventListener('click', function () { if (self.viewport) { self.viewport.resetView(); } }); }
    if (this.applicationMenu && root.PortableUIShellBehaviors) {
      this.menuController = root.PortableUIShellBehaviors.createMenuController({
        menuBar: this.applicationMenu,
        document: document,
        dispatchAction: function (action) {
          if (action === 'undo' || action === 'redo') { self.runHistoryAction(action); }
          if (action === 'import-step' && self.importButton) { self.importButton.click(); }
          if (action === 'fit-view' && self.viewport) { self.viewport.fitCurrentModel(); }
          if (action === 'reset-view' && self.viewport) { self.viewport.resetView(); }
          if (action.indexOf('camera-') === 0 && self.viewport) { self.viewport.setViewOrientation(action.slice(7)); }
          if (action.indexOf('projection-') === 0 && self.viewport) {
            self.viewport.setProjection(action.slice(11));
            self.navigationPreferences = self.viewport.getNavigationPreferences();
            self.saveNavigationPreferences(); self.renderProjectionCommands();
          }
          if (action === 'about') {
            var dialog = document.getElementById('about-dialog');
            var opener = self.applicationMenu.querySelector('[data-ui-menu-action="about"]').closest('[data-ui-menu-group]').querySelector('[data-ui-menu-button]');
            opener.focus(); dialog.showModal();
          }
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
      if (event.defaultPrevented || document.querySelector('dialog[open]')) { return; }
      if (self.handleHistoryShortcut(event)) { return; }
      if (self.isSettingsShortcut(event) && !editable && !self.settingsOpen) {
        event.preventDefault();
        self.openSettings(document.activeElement);
        return;
      }
      if (self.settingsOpen) { return; }
      if (self.analysisAuthoring && self.analysisAuthoring.handleDocumentKeyDown(event)) { return; }
      if(event.key==='Escape' && !editable && self.viewport && self.viewport.selectedResultPoint){self.viewport.selectResultPoint(null);event.preventDefault();return;}
      if (event.key !== 'Escape' || !self.controller.document.selectedFaceIds.length) { return; }
      self.controller.clearSelectedFaces();
      event.preventDefault();
    });
    this.renderNavigationPreferences();
    this.controller.subscribe(function (documentState) { self.render(documentState); });
  };
  UIController.prototype.renderHistory = function () {
    if (!this.controller.historyState) { return; }
    var state=this.controller.historyState();
    Array.from(document.querySelectorAll('[data-history-action]')).forEach(function (button) {
      var undo=button.dataset.historyAction === 'undo', label=undo ? state.undoLabel : state.redoLabel;
      button.disabled=undo ? !state.canUndo : !state.canRedo;
      var text=(undo ? 'Undo' : 'Redo') + (label ? ' “' + label + '”' : '');
      if (button.dataset.uiMenuAction) { button.textContent=text; }
      button.setAttribute('aria-label',text); button.title=button.disabled ? state.message : text;
    });
    var status=document.getElementById('history-status');
    if (status) { status.textContent=state.message; }
  };
  UIController.prototype.runHistoryAction = function (action) {
    if (!this.controller.historyState) { return; }
    var state=this.controller.historyState();
    if (!(action === 'undo' ? state.canUndo : state.canRedo)) { return; }
    try {
      if (action === 'undo') { this.controller.undoEngineeringEdit(); } else { this.controller.redoEngineeringEdit(); }
      if (this.analysisAuthoring) { this.analysisAuthoring.announceSetup(this.controller.historyNotice); }
    } catch(error) {
      var status=document.getElementById('app-status') || document.getElementById('history-status'); if (status) { status.textContent=error.message; }
    }
  };
  UIController.prototype.handleHistoryShortcut = function (event) {
    if (event.defaultPrevented || event.altKey || event.isComposing || this.settingsOpen || !this.controller.historyState) { return false; }
    var target=event.target, tag=target && target.tagName;
    if (['INPUT','TEXTAREA','SELECT'].indexOf(tag) >= 0 || (target && target.isContentEditable)) { return false; }
    if (Array.from(document.querySelectorAll('[role="dialog"],dialog[open]')).some(function (dialog) { return !dialog.closest('[hidden]') && dialog.getClientRects().length; })) { return false; }
    var mac=/Mac|iPhone|iPad/.test(root.navigator && root.navigator.platform || '');
    if (mac ? (!event.metaKey || event.ctrlKey) : (!event.ctrlKey || event.metaKey)) { return false; }
    var key=event.key.toLowerCase(), action;
    if (key === 'z') { action=event.shiftKey ? 'redo' : 'undo'; }
    else if (!mac && key === 'y' && !event.shiftKey) { action='redo'; }
    else { return false; }
    var state=this.controller.historyState();
    if (!(action === 'undo' ? state.canUndo : state.canRedo)) { return false; }
    event.preventDefault(); this.runHistoryAction(action); return true;
  };

  UIController.prototype.renderActivity = function (state) {
    var element=document.getElementById('app-status'),spinner=document.getElementById('activity-spinner');if(!element)return;
    var tasks=[state.solveExecution,state.solvePreflight,state.meshGeneration,state.geometryImport,state.convergenceStudy].filter(Boolean);
    var active=tasks.find(function(task){return ['running','generating','importing'].indexOf(task.status)>=0;});
    var message=this.runtimeStatus || 'Starting…';
    if(active){message=active.progress && active.progress.userMessage || (active===state.meshGeneration?'Generating mesh…':active===state.geometryImport?'Importing geometry…':active===state.solvePreflight?'Checking model…':active===state.convergenceStudy?'Running convergence study…':'Solving…');}
    else {
      var failed=tasks.find(function(task){return task.status==='failed';});
      if(failed)message=failed.error && (failed.error.userMessage || failed.error.message) || 'Operation failed. Open Checks for details.';
      else if(state.assignmentDraft)message='Previewing '+state.assignmentDraft.kind+' · Apply or Cancel';
      else if(state.solveExecution && state.solveExecution.status==='cancelled')message='Simulation cancelled';
      else if(state.results)message='Solve complete';
      else if(state.solvePreflight && state.solvePreflight.status==='ready')message=state.solvePreflight.result.exceedsWasmCap?'Memory limit reached · use a coarser mesh':'Model checks passed';
      else if(state.meshGeneration && state.meshGeneration.status==='succeeded')message='Mesh ready';
      else if(state.geometry)message='Model ready';
    }
    element.textContent=message;element.title=message;if(spinner)spinner.hidden=!active;
  };
  UIController.prototype.render = function (documentState) {
    this.renderHistory();
    this.renderActivity(documentState);
    var state = documentState.geometryImport || { status: 'idle' };
    var convergenceRunning = Boolean(documentState.convergenceStudy && documentState.convergenceStudy.status === 'running');
    var message = 'Choose a STEP, IGES, or BREP solid to begin.';
    if (state.status === 'importing') {
      message = (state.progress && state.progress.userMessage) || 'Importing CAD geometry…';
    } else if (state.status === 'succeeded' && documentState.geometry) {
      message = documentState.geometry.sourceName + ': ' + documentState.geometry.faceIds.length + ' faces imported.';
    } else if (state.status === 'failed') {
      message = (state.error && state.error.userMessage) || 'The CAD file could not be imported.';
    }
    if (this.geometryStatus) { this.geometryStatus.textContent = message; }
    if (this.importButton) { this.importButton.disabled = state.status === 'importing' || convergenceRunning; }
    this.renderMesh(documentState);
    this.renderViewportPresentation(documentState);
    this.renderSolve(documentState);
    this.renderResults(documentState);
    this.renderConvergence(documentState);
    if (this.analysisAuthoring) { this.analysisAuthoring.render(documentState); }
  };
  UIController.prototype.updateMeshSettingsFromControls = function () {
    var preset = this.meshPreset.value;
    var settings = { preset: preset, elementType: this.meshElementType ? this.meshElementType.value : 'tet10' };
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
    var settings = documentState.meshSettings || { preset: 'normal', elementType: 'tet10' };
    var generation = documentState.meshGeneration || { status: 'idle' };
    var hasGeometry = Boolean(documentState.geometry);
    var isGenerating = generation.status === 'generating';
    var convergenceRunning = Boolean(documentState.convergenceStudy && documentState.convergenceStudy.status === 'running');
    var message = 'Import geometry to generate a mesh.';
    var elementLabel = settings.elementType === 'tet10' ? 'Tet10' : 'Tet4';
    if (this.meshElementType) { this.meshElementType.value = settings.elementType; this.meshElementType.disabled = !hasGeometry || isGenerating || convergenceRunning; }
    if (this.meshPreset) { this.meshPreset.value = settings.preset; this.meshPreset.disabled = !hasGeometry || isGenerating || convergenceRunning; }
    if (this.meshCustomSizes) { this.meshCustomSizes.hidden = settings.preset !== 'custom'; }
    if (this.meshMinSize) { this.meshMinSize.value = settings.preset === 'custom' ? settings.minSizeM : ''; this.meshMinSize.disabled = !hasGeometry || isGenerating || convergenceRunning; }
    if (this.meshMaxSize) { this.meshMaxSize.value = settings.preset === 'custom' ? settings.maxSizeM : ''; this.meshMaxSize.disabled = !hasGeometry || isGenerating || convergenceRunning; }
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
    if (this.generateMeshButton) { this.generateMeshButton.disabled = !hasGeometry || isGenerating || convergenceRunning; }
    if (this.generateMeshButton) { this.generateMeshButton.textContent = documentState.mesh ? 'Regenerate mesh' : 'Generate mesh'; }
    if (this.cancelMeshButton) { this.cancelMeshButton.hidden = !isGenerating; }
    if (this.deleteMeshButton) { this.deleteMeshButton.hidden = !documentState.mesh || isGenerating || convergenceRunning; }
  };
  UIController.prototype.updateViewportPresentation = function () {
    var current = this.controller.document.viewportPresentation || {};
    var mode = this.viewportMode ? this.viewportMode.value : 'model';
    var field = this.resultField ? this.resultField.value : current.field;
    var deformationMode = mode === 'stress' ? 'undeformed' : (mode === 'deformation' && current.mode !== 'deformation' ? 'auto' : (this.deformationMode ? this.deformationMode.value : current.deformationMode));
    if (mode === 'stress' && ['vonMises', 'factorOfSafety', 'maxPrincipal', 'minPrincipal'].indexOf(field) < 0) { field = 'vonMises'; }
    if (mode === 'deformation' && ['displacementMagnitude', 'ux', 'uy', 'uz'].indexOf(field) < 0) { field = 'displacementMagnitude'; }
    try {
      var range = current.colorRange;
      if (this.colorRangeMode && this.controller.document.results) {
        var automatic = root.SpjutsimFEA.getResultDisplayRange(this.controller.document.results, field);
        var unitScale = root.SpjutsimFEA.resultFieldDefinition(field, current)[2];
        var manual = this.colorRangeMode.value === 'manual';
        range = {field:field, mode:manual ? 'manual' : 'automatic', locked:this.colorRangeLock.checked,
          minimum:manual ? (this.colorRangeMin.value === '' ? NaN : Number(this.colorRangeMin.value) * unitScale) : automatic.minimum,
          maximum:manual ? (this.colorRangeMax.value === '' ? NaN : Number(this.colorRangeMax.value) * unitScale) : automatic.maximum};
        if (field !== current.field) { range = {field:field,mode:'automatic',locked:false}; }
        else if (!manual && range.locked && current.colorRange && current.colorRange.locked) { range = current.colorRange; }
      }
      this.controller.replaceViewportPresentation({
        stressUnit: this.stressUnit ? this.stressUnit.value : current.stressUnit,
        lengthUnit: this.lengthUnit ? this.lengthUnit.value : current.lengthUnit,
        legendOrientation: this.legendOrientation ? this.legendOrientation.value : current.legendOrientation,
        colorRange: range, showGravity:current.showGravity, showLoads:current.showLoads, showSupports:current.showSupports,
        mode: mode, displayStyle: this.displayStyle ? this.displayStyle.value : 'shaded-edges', field: field,
        meshOverlay: Boolean(this.meshOverlay && this.meshOverlay.checked), deformationMode: deformationMode,
        deformationScale: this.resolveDeformationScale(deformationMode),
        userDeformationScale: Math.max(0, Number(this.deformationScale && this.deformationScale.value) || 0)
      });
      if (this.colorRangeError) { this.colorRangeError.textContent = ''; }
      try { root.localStorage.setItem('spjutsim-fea-display-v1', JSON.stringify({legendOrientation:this.controller.document.viewportPresentation.legendOrientation,displayStyle:this.controller.document.viewportPresentation.displayStyle})); } catch (ignored) {}
    } catch (error) {
      if (this.colorRangeError) { this.colorRangeError.textContent = error.message; }
      if (this.colorRangeMode && this.colorRangeMode.value === 'manual' && this.controller.document.results) { this.colorRangeMin.disabled = false; this.colorRangeMax.disabled = false; }
    }
  };
  UIController.prototype.renderViewportPresentation = function (documentState) {
    var presentation = documentState.viewportPresentation || { mode: 'model', displayStyle: 'lines' };
    ['show-loads','show-gravity','show-supports'].forEach(function(id){var c=document.getElementById(id);if(c){c.checked=presentation[id==='show-loads'?'showLoads':id==='show-supports'?'showSupports':'showGravity']!==false;c.disabled=id==='show-gravity' && !documentState.gravity.enabled;}});
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
    Array.from(document.querySelectorAll('[data-view-mode]')).forEach(function (button) {
      button.disabled = button.dataset.viewMode === 'mesh' ? !meshAvailable : (button.dataset.viewMode !== 'model' && !resultsAvailable);
      button.setAttribute('aria-pressed', String(button.dataset.viewMode === presentation.mode));
    });
    var resultContext = document.getElementById('result-context');
    if (resultContext) { resultContext.hidden = !resultsAvailable || ['stress','deformation'].indexOf(presentation.mode) < 0; }
    var deformationContext = document.getElementById('deformation-context');
    if (deformationContext) { deformationContext.hidden = !resultsAvailable || presentation.mode !== 'deformation'; }
    if (this.stressUnit) { this.stressUnit.value = presentation.stressUnit || 'MPa'; }
    if (this.lengthUnit) { this.lengthUnit.value = presentation.lengthUnit || 'mm'; }
    if (this.legendOrientation) { this.legendOrientation.value = presentation.legendOrientation || 'vertical'; }
    if (this.colorRangeMode) {
      this.colorRangeMode.value = presentation.colorRange && presentation.colorRange.mode || 'automatic';
      this.colorRangeLock.checked = Boolean(presentation.colorRange && presentation.colorRange.locked);
      [this.colorRangeMode,this.colorRangeLock].forEach(function (control) { control.disabled = !resultsAvailable; });
      [this.colorRangeMin,this.colorRangeMax].forEach(function (control) { control.disabled = !resultsAvailable; }, this);
    }
    if (this.displayStyle) {
      this.displayStyle.value = presentation.displayStyle;
      this.displayStyle.disabled = false;
    }
    if (this.resultField) {
      this.resultField.value = presentation.field || (presentation.mode === 'deformation' ? 'displacementMagnitude' : 'vonMises');
      this.resultField.disabled = !resultsAvailable || (presentation.mode !== 'stress' && presentation.mode !== 'deformation');
      Array.from(this.resultField.options).forEach(function (option) {
        var stress = ['vonMises', 'factorOfSafety', 'maxPrincipal', 'minPrincipal'].indexOf(option.value) >= 0;
        option.hidden = presentation.mode === 'stress' ? !stress : (presentation.mode === 'deformation' ? stress : false);
        option.disabled = option.value === 'factorOfSafety' && !(documentState.results && documentState.results.factorOfSafety);
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

  UIController.prototype.dispose = function () {
    this.stopDeformationAnimation();
    if (this.workspaceLayout) { this.workspaceLayout.dispose(); }
    if (this.legendResizeObserver) { this.legendResizeObserver.disconnect(); }
    if (this.legendLayout) { this.legendLayout.dispose(); }
  };

  UIController.prototype.showOutputPanel = function (panelId) {
    var panel = this.outputPanels.find(function (item) { return item.dataset.outputPanel === panelId || item.id === panelId; });
    if (!panel) { return false; }
    if (this.workspaceLayout) { this.workspaceLayout.setPaneOpen("results", true); }
    if (this.selectOutputTab) { this.selectOutputTab(panel.dataset.outputPanel, true); }
    return true;
  };

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
    if (root.SpjutsimFEA.formatResultNumber) { return root.SpjutsimFEA.formatResultNumber(value) + (unit ? ' ' + unit : ''); }
    if (value === Infinity) { return '∞' + (unit ? ' ' + unit : ''); }
    if (!Number.isFinite(value)) { return '—'; }
    return value.toLocaleString(undefined, { maximumSignificantDigits: 5 }) + (unit ? ' ' + unit : '');
  }
  function formatBytes(bytes) { return formatNumber(bytes / 1073741824, 'GiB'); }
  function configureOutputTabs(tabs, panels) {
    function select(name, moveFocus) {
      var selected = null;
      tabs.forEach(function (tab) {
        var active = tab.dataset.outputTab === name;
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.tabIndex = active ? 0 : -1;
        if (active) { selected = tab; }
      });
      panels.forEach(function (panel) { panel.hidden = panel.dataset.outputPanel !== name; });
      if (moveFocus && selected) { selected.focus(); }
    }
    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () { select(tab.dataset.outputTab, false); });
      tab.addEventListener('keydown', function (event) {
        var next = index;
        if (event.key === 'ArrowRight') { next = (index + 1) % tabs.length; }
        else if (event.key === 'ArrowLeft') { next = (index + tabs.length - 1) % tabs.length; }
        else if (event.key === 'Home') { next = 0; }
        else if (event.key === 'End') { next = tabs.length - 1; }
        else { return; }
        event.preventDefault();
        select(tabs[next].dataset.outputTab, true);
      });
    });
    var initial = tabs.find(function (tab) { return tab.getAttribute('aria-selected') === 'true'; }) || tabs[0];
    if (initial) { select(initial.dataset.outputTab, false); }
    return select;
  }
  function convergenceErrorMessage(error) {
    var value = error && error.diagnostic ? error.diagnostic : error;
    return value && (value.userMessage || value.message) || null;
  }
  function convergenceStatusMessage(study) {
    var levels = study && Array.isArray(study.levels) ? study.levels : [];
    var classification = study && study.classification;
    var statusLabels = { converged: 'Converged', 'converged-stress-unresolved': 'Converged globally; stress unresolved',
      unconverged: 'Unconverged', 'indeterminate-resource-limit': 'Indeterminate — resource limit', failed: 'Failed' };
    var message;
    var errorMessage;
    if (!study) { return 'Not studied.'; }
    if (study.status === 'running') {
      return 'Level ' + ((study.progress && study.progress.level) || levels.length + 1) + ': ' +
        ((study.progress && study.progress.stage) || 'preparing') + '…';
    }
    if (study.status === 'cancelled') { return 'Cancelled — completed levels remain available in the table.'; }
    message = statusLabels[classification && classification.status] || study.status;
    errorMessage = convergenceErrorMessage(study.error);
    if (errorMessage) { message += ' — ' + errorMessage; }
    else if (study.stopReason === 'high-memory-confirmation') { message += ' — high-memory confirmation was declined.'; }
    else if (study.stopReason === 'resource-limit') { message += ' — the next level exceeded the configured memory limit.'; }
    else if (study.stopReason === 'level-limit' && classification && !classification.globalConverged) {
      message += ' — the four-level limit was reached.';
    }
    if (classification && classification.warning) { message += ' ' + classification.warning; }
    return message;
  }
  function legendRangeStatus(fieldRange, deformationScale) {
    return (fieldRange && fieldRange.clipped ? 'Clipped visualization range' : 'Unclipped range') +
      ' · deformation ×' + formatNumber(deformationScale || 0);
  }
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
    var convergenceRunning = Boolean(documentState.convergenceStudy && documentState.convergenceStudy.status === 'running');
    var message = 'Generate a mesh and finish the analysis definition.';
    if (preflight.status === 'running') { message = (preflight.progress && preflight.progress.userMessage) || 'Checking model…'; }
    else if (execution.status === 'running') { message = (execution.progress && execution.progress.userMessage) || 'Solving…'; }
    else if (preflight.status === 'failed') { message = (preflight.error && preflight.error.userMessage) || preflight.error && preflight.error.message || 'Model check failed.'; }
    else if (execution.status === 'failed') { message = (execution.error && execution.error.userMessage) || 'Solve failed.'; }
    else if (execution.status === 'cancelled' || preflight.status === 'cancelled') { message = 'Solve cancelled; partial results were discarded.'; }
    else if (execution.status === 'succeeded') { message = 'Solve complete.'; }
    else if (preflight.status === 'ready') {
      message = preflight.result.exceedsWasmCap ? 'Estimate exceeds the WebAssembly cap; generate a coarser mesh.' : 'Checks passed. Solve can proceed.';
    } else if (documentState.mesh) { message = 'Solve will check constraints and memory before starting.'; }
    if (documentState.resultInvalidation && documentState.resultInvalidation.stale) { message += ' Previous results are stale.'; }
    if (this.solveStatus) { this.solveStatus.textContent = message; this.solveStatus.classList.toggle('fea-error', preflight.status === 'failed' || execution.status === 'failed'); }
    if (this.solveOutputStatus) {
      this.solveOutputStatus.hidden = !(running || preflight.status === 'failed' || execution.status === 'failed' ||
        preflight.status === 'cancelled' || execution.status === 'cancelled' ||
        (preflight.status === 'ready' && preflight.result.exceedsWasmCap));
      this.solveOutputStatus.textContent = message;
    }
    var readiness = root.SpjutsimFEA.solveReadiness(documentState);
    if (this.solveReadinessStatus) { this.solveReadinessStatus.textContent = readiness.label + (documentState.assignmentDraft ? ' · Apply/Cancel preview' : ''); this.solveReadinessStatus.title = readiness.message; }
    if (this.preflightButton) { this.preflightButton.disabled = !readiness.canCheck; this.preflightButton.title = readiness.message; }
    if (this.solveButton) { this.solveButton.disabled = !readiness.canRequestSolve; this.solveButton.title = readiness.message; }
    if (this.solveStatus) { this.solveStatus.textContent = message + ' ' + readiness.message; }
    this.renderChecks(documentState);
    if (this.cancelSolveButton) { this.cancelSolveButton.hidden = !running; }
    preflight = documentState.lastSolveCheck || preflight;
    if (this.preflightSummary) {
      this.preflightSummary.hidden = preflight.status !== 'ready';
      if (preflight.status === 'ready') {
        replaceDefinitionList(this.preflightSummary, [
          ['Mesh', preflight.result.nodeCount + ' nodes / ' + preflight.result.elementCount + ' ' + preflight.result.elementType.toUpperCase()],
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

  UIController.prototype.renderChecks = function (state) {
    if (!this.checksFindings) { return; }
    var report = state.solvePreflight.status === 'running' ? state.solvePreflight : state.lastSolveCheck || state.solvePreflight;
    var stale = report && report.analysisRevision !== null && report.analysisRevision !== undefined && report.analysisRevision !== state.analysisRevision;
    this.checksRevision.textContent = report && report.status==='running' ? 'Checking current setup…' : !report || report.analysisRevision == null ? 'No completed check yet.' :
      (stale ? 'Stale report' : 'Current report') + ' · setup revision ' + report.analysisRevision + (stale ? '; current revision ' + state.analysisRevision + '. Check again before solving.' : '.');
    this.checksRevision.classList.toggle('fea-warning',Boolean(stale));
    this.checksFindings.replaceChildren();
    var self = this;
    function finding(message,kind) {
      var li = document.createElement('li'); li.append(document.createTextNode(message + ' '));
      if (kind) {
        var link = document.createElement('button'); link.type='button'; link.textContent={model:'Import model',material:'Edit material',support:'Edit supports',load:'Edit loads',mesh:'Edit mesh settings'}[kind];
        link.addEventListener('click',function () {
          if (self.workspaceLayout) { self.workspaceLayout.setPaneOpen('setup',true); }
          if (self.analysisAuthoring) {
            var item = kind === 'support' ? state.boundaryConditions[0] : kind === 'load' ? state.loads[0] : null;
            self.analysisAuthoring.openInspectorRow(kind,item ? item.id : (kind === 'support' || kind === 'load' ? 'new' : kind),link);
            var editor = document.getElementById(kind + '-editor');
            var input = editor && editor.querySelector('input:not([disabled]),select:not([disabled]),button:not([disabled])');
            if (input) { input.focus(); }
          }
        }); li.append(link);
      }
      self.checksFindings.append(li);
    }
    if (!state.geometry) { finding('Import one closed solid.','model'); }
    if (!state.material) { finding('Define the material.','material'); }
    if (!(state.boundaryConditions || []).length) { finding('Add supports to constrain rigid motion.','support'); }
    if (!state.mesh) { finding('Generate a current mesh.','mesh'); }
    if (state.constraintStability && state.constraintStability.status !== 'fully-constrained') { finding('Unrestrained motion: '+state.constraintStability.modes.filter(function(m){return m.status!=='constrained';}).map(function(m){return m.id;}).join(', ')+'. Add support components that prevent these motions.','support'); }
    if (state.assignmentDraft) { finding('Apply or Cancel the current assignment preview.'); }
    if (report && report.error) {
      var message = report.error.userMessage || report.error.message || 'The check failed. Review Setup and check again.';
      var kind = /mesh|memory|cap/i.test(message) ? 'mesh' : /material|density/i.test(message) ? 'material' : /load|force/i.test(message) ? 'load' : 'support';
      var repair=kind==='support' ? ' Constrain the free translations/rotations listed below by adding or changing support components.' : kind==='material' ? ' Enter valid stiffness, Poisson ratio, and density when using gravity.' : kind==='mesh' ? ' Choose Coarse (or increase the custom element size), regenerate the mesh, then select Solve.' : ' Check the load value, direction, and assigned faces, then select Solve.';
      finding(message+repair,kind);
    }
    var result = report && report.result;
    this.checksSummary.replaceChildren();
    if (result) {
      if (result.exceedsWasmCap) { finding('Estimated memory exceeds the WebAssembly cap. Use a coarser mesh.','mesh'); }
      if (result.requiresEightGiBConfirmation) { finding('This estimate is at least 8 GiB. Solve requires explicit high-memory confirmation.','mesh'); }
      replaceDefinitionList(this.checksSummary,[['Estimated memory',formatBytes(result.estimatedPeakBytes)],['Constraints',result.constraintStability && result.constraintStability.status === 'fully-constrained' ? 'Fully constrained (mesh)' : 'Review supports']]);
    }
  };

  UIController.prototype.renderResults = function (documentState) {
    var result = documentState.results;
    if (this.resultSummaryModel !== result) {
      this.resultSummaryModel = result;
      if (this.peakLocationStatus) { this.peakLocationStatus.textContent = ''; }
    }
    if (this.resultsEmpty) { this.resultsEmpty.hidden = Boolean(result); }
    if (this.resultsSummary) { this.resultsSummary.hidden = !result; }
    if (this.diagnosticsSummary) { this.diagnosticsSummary.hidden = !result; }
    if (!result) { if (this.peakLocationStatus) { this.peakLocationStatus.textContent = ''; } return; }
    if (this.peakHeadline) { this.peakHeadline.textContent = 'Peak von Mises — unaveraged solver samples: ' + formatNumber(result.extrema.rawVonMisesMax.valuePa / 1e6, 'MPa'); }
    if (this.yieldHeadline) { this.yieldHeadline.textContent = result.factorOfSafety ? 'Yield FoS — unaveraged solver samples: ' + formatNumber(result.factorOfSafety.rawMinimum.value) : 'Yield FoS unavailable — supply a tensile or compressive yield strength.'; }
    if (this.trustHeadline) { this.trustHeadline.textContent = 'Convergence: ' + convergenceStatusMessage(documentState.convergenceStudy) + ' Review support/load concentrations for possible singularities; one solve does not establish safety.'; }
    var entries = [
      ['Element', result.elementType.toUpperCase()],
      ['System', result.meshStatistics.nodeCount + ' nodes / ' + result.meshStatistics.elementCount + ' elements / ' + result.meshStatistics.nodeCount * 3 + ' DOF'],
      ['Max displacement', formatNumber(result.extrema.maxDisplacement.valueM * 1000, 'mm')],
      ['Max displacement location', result.extrema.maxDisplacement.locationM.map(function (v) { return formatNumber(v, 'm'); }).join(', ')],
      ['Peak von Mises — unaveraged solver samples', formatNumber(result.extrema.rawVonMisesMax.valuePa / 1e6, 'MPa')],
      ['Interior solver sample location', result.extrema.rawVonMisesMax.locationM.map(function (v) { return formatNumber(v, 'm'); }).join(', ')],
      ['Smoothed surface von Mises max', formatNumber(result.extrema.displayedVonMisesMax.valuePa / 1e6, 'MPa')],
      ['Max principal', formatNumber(result.extrema.rawMaxPrincipal.valuePa / 1e6, 'MPa')],
      ['Min principal', formatNumber(result.extrema.rawMinPrincipal.valuePa / 1e6, 'MPa')],
      ['Applied force', result.equilibrium.totalAppliedForceN.map(function (v) { return formatNumber(v, 'N'); }).join(', ')],
      ['Reaction', result.equilibrium.totalReactionN.map(function (v) { return formatNumber(v, 'N'); }).join(', ')],
      ['Strain energy', formatNumber(result.solverStatistics.strainEnergyJ, 'J')],
      ['Convergence', result.convergenceStatus === 'not-run' ? 'Not studied' : result.convergenceStatus],
      ['Assumptions', result.assumptions.join(', ')]
    ];
    if (result.factorOfSafety) {
      entries.splice(7, 0,
        ['Yield FoS — unaveraged samples', formatNumber(result.factorOfSafety.rawMinimum.value)],
        ['Smoothed surface minimum FoS (uncapped)', formatNumber(result.factorOfSafety.displayedMinimum)],
        ['FoS criterion', 'von Mises yield · ' + formatNumber(result.factorOfSafety.strength.valuePa / 1e6, 'MPa')]);
    }
    replaceDefinitionList(this.resultsValues, entries);
    replaceDefinitionList(this.diagnosticsValues, [
      ['Iterations', String(result.solverStatistics.iterations)],
      ['Solver residual', formatNumber(result.solverStatistics.finalRelativeResidual)],
      ['Force balance', formatNumber(result.equilibrium.relativeResidual)],
      ['Solve time', formatNumber(result.solverStatistics.solveDurationMs, 'ms')],
      ['Mesh', result.meshStatistics.nodeCount + ' nodes / ' + result.meshStatistics.elementCount + ' ' + result.elementType.toUpperCase() + ' elements'],
      ['WASM memory', formatBytes(result.solverStatistics.wasmMemoryBytes)],
      ['Warnings', result.warnings.length ? result.warnings.join(' ') : 'None']
    ]);
  };

  UIController.prototype.renderConvergence = function (documentState) {
    var study = documentState.convergenceStudy;
    var levels = study ? study.levels : [];
    var running = Boolean(study && study.status === 'running');
    var otherWorkerRunning = documentState.geometryImport.status === 'importing' ||
      documentState.meshGeneration.status === 'generating' || documentState.solvePreflight.status === 'running' ||
      documentState.solveExecution.status === 'running';
    if (this.startConvergenceButton) { this.startConvergenceButton.disabled = running || otherWorkerRunning || Boolean(documentState.assignmentDraft) || !documentState.geometry || !documentState.material; }
    if (this.startConvergenceButton) { this.startConvergenceButton.textContent = study ? 'Restart study' : 'Start study'; }
    if (this.cancelConvergenceButton) { this.cancelConvergenceButton.hidden = !running; }
    if (this.convergenceStatus) {
      this.convergenceStatus.textContent = convergenceStatusMessage(study);
    }
    if (this.convergenceTable) {
      var body = this.convergenceTable.tBodies[0];
      body.textContent = '';
      levels.forEach(function (level) {
        var row = body.insertRow();
        [level.level, formatNumber(level.targetSizeM), level.degreeOfFreedomCount,
          formatNumber(level.maximumDisplacementM), formatNumber(level.strainEnergyJ),
          formatNumber(level.rawVonMisesMaxPa), formatBytes(level.estimatedPeakBytes)].forEach(function (value) {
          row.insertCell().textContent = String(value);
        });
        var action = row.insertCell();
        if (study.selectedLevel === level.level && study.selectedResult) {
          var button = document.createElement('button');
          button.type = 'button'; button.textContent = 'View';
          button.setAttribute('aria-label', 'View convergence level ' + level.level);
          button.addEventListener('click', function () { this.controller.selectConvergenceLevel(level.level); }.bind(this));
          action.appendChild(button);
        } else { action.textContent = 'Released'; }
      }, this);
    }
    if (this.convergencePlot) {
      this.convergencePlot.textContent = '';
      var plot = this.convergencePlot;
      [['maximumDisplacementM', '#2563eb'], ['strainEnergyJ', '#16a34a'], ['rawVonMisesMaxPa', '#dc2626']].forEach(function (series) {
        var maximum = Math.max.apply(null, levels.map(function (level) { return Math.abs(level[series[0]]); }).concat([1e-30]));
        var minimumDof = levels.length ? Math.min.apply(null, levels.map(function (level) { return level.degreeOfFreedomCount; })) : 0;
        var maximumDof = levels.length ? Math.max.apply(null, levels.map(function (level) { return level.degreeOfFreedomCount; })) : 1;
        var points = levels.map(function (level, index) {
          var x = maximumDof === minimumDof ? 160 : 10 + (level.degreeOfFreedomCount - minimumDof) * 300 / (maximumDof - minimumDof);
          return x + ',' + (110 - 100 * Math.abs(level[series[0]]) / maximum);
        }).join(' ');
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        line.setAttribute('points', points); line.setAttribute('fill', 'none');
        line.setAttribute('stroke', series[1]); line.setAttribute('stroke-width', '2');
        plot.appendChild(line);
      });
    }
  };

  UIController.prototype.renderLegend = function (documentState) {
    var result = documentState.results;
    var presentation = documentState.viewportPresentation || {};
    var definition = root.SpjutsimFEA.resultFieldDefinition(presentation.field, presentation);
    var fieldRange = result && root.SpjutsimFEA.resolveColorRange(result, presentation);
    var show = Boolean(result && definition && (presentation.mode === 'stress' || presentation.mode === 'deformation'));
    if (!this.resultLegend) { return; }
    this.resultLegend.hidden = !show;
    if (!show) { return; }
    this.legendTitle.textContent = definition[0] + (definition[1] ? ' (' + definition[1] + ')' : '');
    this.legendMin.textContent = formatNumber(fieldRange.minimum / definition[2]);
    this.legendMax.textContent = formatNumber(fieldRange.maximum / definition[2]);
    var orientation = presentation.legendOrientation || 'vertical';
    this.resultLegend.dataset.orientation = orientation;
    if (this.legendLayout) { this.legendLayout.apply(); }
    if (this.legendTicks) {
      var height = Math.max(44, Math.min(264, (this.resultLegend.closest('.fea-canvas') || this.resultLegend.parentElement).clientHeight - 240));
      if (this.legendLayout) { height = this.resultLegend.querySelector('.fea-legend-scale').clientHeight; }
      this.resultLegend.style.setProperty('--legend-height', height + 'px');
      this.legendTicks.replaceChildren();
      root.SpjutsimFEA.buildLegendTicks(fieldRange, orientation, height).forEach(function (tick) {
        var label = document.createElement('span');
        label.style.top = (tick.position * 100) + '%';
        label.textContent = formatNumber(tick.value / definition[2]) + (presentation.field === 'factorOfSafety' && tick.value === 10 ? '+' : '');
        this.legendTicks.appendChild(label);
      }, this);
    }
    if (presentation.field === 'factorOfSafety' && fieldRange.maximum === 10) { this.legendMax.textContent = '10+'; }
    if (this.colorRangeMin && document.activeElement !== this.colorRangeMin) { this.colorRangeMin.value = fieldRange.minimum / definition[2]; }
    if (this.colorRangeMax && document.activeElement !== this.colorRangeMax) { this.colorRangeMax.value = fieldRange.maximum / definition[2]; }
    this.legendStatus.hidden = !fieldRange.clipped && presentation.field === 'vonMises';
    this.legendStatus.textContent = legendRangeStatus(fieldRange, presentation.deformationScale);
    this.resultLegend.title = presentation.field === 'vonMises' ?
      'Colors show smoothed surface values. ' + (presentation.colorRange && (presentation.colorRange.mode === 'manual' || presentation.colorRange.locked) ? 'User color limits; clipped values use endpoint colors. ' : 'Scale: zero to the whole-model solver-sample peak. ') + 'Smoothed surface maximum: ' +
        formatNumber(result.ranges.vonMises.maximum / 1e6, 'MPa') + '.' : '';
  };

  UIController.prototype.positionProbe = function (point) {
    if(!this.probeOutput)return;
    var canvas=document.getElementById('viewport');if(!canvas)return;
    this.probeOutput.hidden=!point.visible;
    var width=this.probeOutput.offsetWidth,height=this.probeOutput.offsetHeight;
    this.probeOutput.style.left=Math.max(0,Math.min(canvas.clientWidth-width,point.x+12))+'px';
    this.probeOutput.style.top=Math.max(0,Math.min(canvas.clientHeight-height,point.y+12))+'px';
  };
  UIController.prototype.renderProbe = function (probe) {
    if (!this.probeOutput) { return; }
    this.probeOutput.hidden = !probe;
    if (!probe) { return; }
    this.probeOutput.textContent = probe.fieldLabel + ': ' + formatNumber(probe.fieldValue / probe.unitScale,probe.unit) +
      '\nUndeformed xyz: ' + probe.coordinatesM.map(function(v){return formatNumber(v,'m');}).join(', ') +
      (probe.displacementM ? '\nu: '+probe.displacementM.map(function(v){return formatNumber(v*1000,'mm');}).join(', ') : '') +
      (probe.faceId ? '\nFace: '+probe.faceId : '\nInternal recovery sample; shown through the surface.') + '\nClick background or Escape to clear.';

  };
  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.configureOutputTabs = configureOutputTabs;
  root.SpjutsimFEA.convergenceStatusMessage = convergenceStatusMessage;
  root.SpjutsimFEA.legendRangeStatus = legendRangeStatus;
  root.SpjutsimFEA.UIController = UIController;
}(globalThis));
