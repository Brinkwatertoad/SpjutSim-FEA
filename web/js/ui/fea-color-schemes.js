(function (root) {
  'use strict';

  var portable = root.PortableUIColorSchemes;
  var ACTIVE_KEY = 'spjutsim-fea-color-scheme-active';
  var LIBRARY_KEY = 'spjutsim-fea-color-scheme-library-v1';
  var REQUIRED_EXTENSIONS = { fea: ['load', 'support', 'axisX', 'axisY', 'axisZ'] };
  var FEA_EXTENSIONS = { fea: { load: '#ef4444', support: '#22c55e', axisX: '#ef4444', axisY: '#22c55e', axisZ: '#3b82f6' } };

  function scheme(id, label, authored) {
    return { id: id, label: label, authored: authored, extensions: FEA_EXTENSIONS };
  }

  if (!portable) { throw new Error('The UI Kit portable color-scheme contract must load before the FEA adapter.'); }

  var FACTORY_COLOR_SCHEMES = portable.normalizeFactorySchemes([
    scheme('fea-classic', 'FEA Classic', {
      appBackground: '#17191d', surface: '#202329', text: '#f2f3f5', accent: '#4387f5', danger: '#da1e28',
      canvasBackground: '#111318', canvasGeometry: '#f4f1ea', selection: '#38bdf8'
    }),
    scheme('light', 'Light Mode', {
      appBackground: '#f6f4ef', surface: '#ffffff', text: '#1d1d1f', accent: '#0f62fe', danger: '#da1e28',
      canvasBackground: '#ffffff', canvasGeometry: '#1d1d1f', selection: '#0f62fe'
    }),
    scheme('dark', 'Dark Mode', {
      appBackground: '#111827', surface: '#1f2937', text: '#f4f1ea', accent: '#93c5fd', danger: '#da1e28',
      canvasBackground: '#111827', canvasGeometry: '#f4f1ea', selection: '#93c5fd'
    }),
    scheme('vivid', 'Vivid', {
      appBackground: '#f6f4ef', surface: '#ffffff', text: '#1d1d1f', accent: '#0f62fe', danger: '#da1e28',
      canvasBackground: '#ffffff', canvasGeometry: '#198038', selection: '#0f62fe'
    })
  ]);

  function FEAColorSchemes(storage, rootElement) {
    this.storage = storage || null;
    this.rootElement = rootElement || document.documentElement;
    this.overlay = portable.normalizeLibraryOverlay(null);
    this.activeSchemeId = 'fea-classic';
    this.storageWarning = null;
    this.load();
    this.applyActive();
  }

  FEAColorSchemes.prototype.load = function () {
    var rawOverlay;
    var active;
    if (!this.storage) { return; }
    try {
      rawOverlay = this.storage.getItem(LIBRARY_KEY);
      active = this.storage.getItem(ACTIVE_KEY);
      if (rawOverlay) { this.overlay = portable.normalizeLibraryOverlay(JSON.parse(rawOverlay)); }
      if (active) { this.activeSchemeId = active; }
    } catch (error) {
      this.overlay = portable.normalizeLibraryOverlay(null);
      this.activeSchemeId = 'fea-classic';
      this.storageWarning = 'Saved color schemes could not be read; FEA Classic is active in memory.';
    }
  };

  FEAColorSchemes.prototype.library = function () {
    return portable.resolveSchemeLibrary({
      factorySchemes: FACTORY_COLOR_SCHEMES, overlay: this.overlay,
      defaultSchemeId: 'fea-classic', activeSchemeId: this.activeSchemeId
    });
  };

  FEAColorSchemes.prototype.activeEntry = function () {
    var library = this.library();
    this.activeSchemeId = library.activeSchemeId;
    return library.entries.find(function (entry) { return entry.id === library.activeSchemeId; });
  };

  FEAColorSchemes.prototype.activePalette = function () {
    var entry = portable.completeSchemeForHost({
      scheme: this.activeEntry(), fallbackScheme: FACTORY_COLOR_SCHEMES[0], requiredExtensions: REQUIRED_EXTENSIONS
    });
    return portable.resolvePalette(entry);
  };

  FEAColorSchemes.prototype.persist = function () {
    if (!this.storage) { return; }
    try {
      this.storage.setItem(ACTIVE_KEY, this.activeSchemeId);
      this.storage.setItem(LIBRARY_KEY, JSON.stringify(this.overlay));
      this.storageWarning = null;
    } catch (error) {
      this.storageWarning = 'Color scheme changes are active, but this browser could not save them.';
    }
  };

  FEAColorSchemes.prototype.applyActive = function () {
    var palette = this.activePalette();
    var style = this.rootElement.style;
    var css = {
      '--app-background': palette.appBackground, '--surface': palette.surface, '--text': palette.text,
      '--secondary-text': palette.secondaryText, '--accent': palette.accent, '--border': palette.border,
      '--canvas-background': palette.canvasBackground,
      '--ui-color-bg': palette.appBackground, '--ui-color-surface': palette.surface,
      '--ui-color-panel': palette.panelSurface, '--ui-color-border': palette.border,
      '--ui-color-border-soft': palette.border, '--ui-color-text': palette.text,
      '--ui-color-text-muted': palette.secondaryText, '--ui-color-accent': palette.accent,
      '--ui-color-selection-text': palette.selectionText, '--ui-color-danger': palette.danger,
      '--ui-color-canvas': palette.canvasBackground, '--ui-color-grid-major': palette.gridMajor,
      '--ui-color-grid-minor': palette.gridMinor, '--ui-color-geometry': palette.canvasGeometry,
      '--ui-color-canvas-text': palette.canvasText, '--ui-color-hover': palette.hover,
      '--ui-color-preview': palette.placementPreview, '--ui-color-selection': palette.selection,
      '--ui-color-load': palette.extensions.fea.load, '--ui-color-support': palette.extensions.fea.support,
      '--ui-color-axis-x': palette.extensions.fea.axisX, '--ui-color-axis-y': palette.extensions.fea.axisY,
      '--ui-color-axis-z': palette.extensions.fea.axisZ
    };
    Object.keys(css).forEach(function (name) { style.setProperty(name, css[name]); });
    this.rootElement.dataset.colorScheme = this.activeSchemeId;
    style.colorScheme = portable.relativeLuminance(palette.appBackground) < 0.35 ? 'dark' : 'light';
    return palette;
  };

  FEAColorSchemes.prototype.select = function (schemeId) {
    var library = this.library();
    if (!library.entries.some(function (entry) { return entry.id === schemeId; })) {
      throw new Error('The selected color scheme is unavailable.');
    }
    this.activeSchemeId = schemeId;
    this.persist();
    return this.applyActive();
  };

  FEAColorSchemes.prototype.importDocument = function (documentValue) {
    var result = portable.importSchemeDocument({
      document: documentValue, factorySchemes: FACTORY_COLOR_SCHEMES, overlay: this.overlay,
      fallbackScheme: FACTORY_COLOR_SCHEMES[0], requiredExtensions: REQUIRED_EXTENSIONS
    });
    this.overlay = result.overlay;
    this.activeSchemeId = result.importedSchemeIds[0];
    this.persist();
    this.applyActive();
    return result;
  };

  FEAColorSchemes.prototype.exportActive = function () {
    var entry = this.activeEntry();
    return {
      filename: entry.id + '.spjutsim-color-scheme.json',
      text: portable.serializeSchemeDocument(entry)
    };
  };

  FEAColorSchemes.prototype.renderControls = function () {
    var select = document.getElementById('color-scheme-select');
    var status = document.getElementById('color-scheme-status');
    var library = this.library();
    if (select) {
      select.replaceChildren();
      library.entries.forEach(function (entry) {
        var option = document.createElement('option');
        option.value = entry.id; option.textContent = entry.label + (entry.custom ? ' (imported)' : '');
        select.append(option);
      });
      select.value = library.activeSchemeId;
    }
    if (status) { status.textContent = this.storageWarning || ('Active: ' + this.activeEntry().label); }
  };

  FEAColorSchemes.prototype.bindControls = function () {
    var self = this;
    var select = document.getElementById('color-scheme-select');
    var importButton = document.getElementById('color-scheme-import-button');
    var importInput = document.getElementById('color-scheme-import-input');
    var exportButton = document.getElementById('color-scheme-export-button');
    var status = document.getElementById('color-scheme-status');
    if (!select) { return; }
    this.renderControls();
    select.addEventListener('change', function () {
      try { self.select(select.value); self.renderControls(); }
      catch (error) { self.renderControls(); status.textContent = error.message; }
    });
    if (importButton && importInput) {
      importButton.addEventListener('click', function () { importInput.click(); });
      importInput.addEventListener('change', function () {
        var file = importInput.files && importInput.files[0];
        importInput.value = '';
        if (!file) { return; }
        file.text().then(function (text) {
          self.importDocument(text);
          self.renderControls();
          status.textContent = 'Imported and activated ' + self.activeEntry().label + '.';
        }).catch(function (error) { status.textContent = 'Import failed: ' + error.message; });
      });
    }
    if (exportButton) {
      exportButton.addEventListener('click', function () {
        var exported = self.exportActive();
        var url = root.URL.createObjectURL(new Blob([exported.text], { type: 'application/json' }));
        var anchor = document.createElement('a');
        anchor.href = url; anchor.download = exported.filename; anchor.click();
        root.setTimeout(function () { root.URL.revokeObjectURL(url); }, 0);
        status.textContent = 'Exported ' + self.activeEntry().label + '.';
      });
    }
  };

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.PortableUIColorSchemes = portable;
  root.SpjutsimFEA.FACTORY_COLOR_SCHEMES = FACTORY_COLOR_SCHEMES;
  root.SpjutsimFEA.FEAColorSchemes = FEAColorSchemes;
}(globalThis));
