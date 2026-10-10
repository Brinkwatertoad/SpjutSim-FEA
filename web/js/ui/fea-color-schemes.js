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
      appBackground: '#e8e7e3', surface: '#f0efeb', text: '#25272b', accent: '#0f62fe', danger: '#da1e28',
      canvasBackground: '#e3e5e8', canvasGeometry: '#25272b', selection: '#0f62fe'
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
    if (this.library().empty) {
      this.overlay = portable.normalizeLibraryOverlay(null);
      this.activeSchemeId = 'fea-classic';
      this.storageWarning = 'Saved color schemes were empty; FEA Classic is active in memory.';
    }
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
    // Measure the final palette's scrollbar geometry for the application root.
    // Scoped previews must not change the host document's scrollbar metrics.
    var doc = this.rootElement.ownerDocument;
    if (this.rootElement === doc.documentElement) {
      if (!root.PortableUIShellBehaviors || typeof root.PortableUIShellBehaviors.applyScrollbarMetrics !== 'function') {
        throw new Error('The UI Kit scrollbar measurement helper must load before applying the FEA document palette.');
      }
      root.PortableUIShellBehaviors.applyScrollbarMetrics(doc);
    }
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

  FEAColorSchemes.prototype.mutationInput = function () {
    return {factorySchemes:FACTORY_COLOR_SCHEMES,overlay:this.overlay,schemeId:this.activeEntry().id,
      activeSchemeId:this.activeSchemeId,defaultSchemeId:'fea-classic'};
  };

  FEAColorSchemes.prototype.publishChange = function () {
    this.persist();
    return this.applyActive();
  };

  FEAColorSchemes.prototype.updateRole = function (section, role, value) {
    var color = portable.normalizeColor(value), patch = {};
    if (!color) { throw new Error('Use a six-digit hex color, such as #4387f5.'); }
    if (section === 'authored' && portable.SHARED_AUTHORED_COLOR_ROLES.includes(role) ||
        section === 'derivedOverrides' && ['secondaryText','panelSurface','border','canvasText','gridMajor','gridMinor','canvasFill','hover','placementPreview'].includes(role)) {
      patch[section] = {};patch[section][role] = color;
    } else if (section === 'extensions.fea' && REQUIRED_EXTENSIONS.fea.includes(role)) {
      patch.extensions = {fea:{}};patch.extensions.fea[role] = color;
    } else { throw new Error('The selected color role is unavailable.'); }
    this.overlay = portable.updateScheme(Object.assign(this.mutationInput(),{patch:patch}));
    return this.publishChange();
  };

  FEAColorSchemes.prototype.rename = function (label) {
    label = String(label || '').trim();
    if (!label) { throw new Error('Enter a color scheme name.'); }
    this.overlay = portable.updateScheme(Object.assign(this.mutationInput(),{patch:{label:label}}));
    return this.publishChange();
  };

  FEAColorSchemes.prototype.duplicate = function () {
    var result = portable.duplicateScheme(this.mutationInput());
    this.overlay = result.overlay;this.activeSchemeId = result.scheme.id;
    this.publishChange();
    return this.activeSchemeId;
  };

  FEAColorSchemes.prototype.remove = function () {
    if (this.library().entries.length < 2) { throw new Error('Keep at least one color scheme.'); }
    var result = portable.deleteScheme(this.mutationInput());
    this.overlay = result.overlay;this.activeSchemeId = result.activeSchemeId;
    return this.publishChange();
  };

  FEAColorSchemes.prototype.restore = function () {
    this.overlay = portable.restoreScheme(this.mutationInput());
    return this.publishChange();
  };

  FEAColorSchemes.prototype.reset = function () {
    this.overlay = portable.resetSchemeLibrary();this.activeSchemeId = 'fea-classic';
    return this.publishChange();
  };

  FEAColorSchemes.prototype.clearOverride = function (role) {
    this.overlay = portable.clearSchemeOverride(Object.assign(this.mutationInput(),{section:'derivedOverrides',role:role}));
    return this.publishChange();
  };

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.PortableUIColorSchemes = portable;
  root.SpjutsimFEA.FACTORY_COLOR_SCHEMES = FACTORY_COLOR_SCHEMES;
  root.SpjutsimFEA.FEAColorSchemes = FEAColorSchemes;
}(globalThis));
