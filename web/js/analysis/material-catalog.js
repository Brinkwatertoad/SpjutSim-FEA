(function (root) {
  'use strict';

  var STORAGE_KEY = 'spjutsim-fea.material-catalog';
  var STORAGE_SCHEMA_VERSION = 1;
  var TRUSS_SOURCE = {
    label: 'SpjutSim-Truss factory catalog, reviewed commit 42d9b006 (2026-08-28)',
    url: 'https://github.com/Brinkwatertoad/2D-Truss-Solver/blob/42d9b00650f47297bd6dc3bf0e8ab3087590d303/engineering-libraries.js'
  };
  var NASA_POISSON_SOURCE = {
    label: "NASA TN D-8160, Poisson's Ratio Measurements (table I)",
    url: 'https://ntrs.nasa.gov/api/citations/19770082063/downloads/19770082063.pdf'
  };
  var COEXTRUSION_SOURCE = {
    label: 'Materials 2023, 16, 820, Modeling Materials Coextrusion in Polymers Additive Manufacturing',
    url: 'https://doi.org/10.3390/ma16020820'
  };
  var ABS_SOURCE = {
    label: 'Composites Part B 2017, Isotropic and anisotropic elasticity and yielding of 3D printed material',
    url: 'https://doi.org/10.1016/j.compositesb.2016.06.069'
  };
  var POLYMER_FEA_SOURCE = {
    label: 'iJOE 2025, numerical study material inputs for ABS, PLA, and PETG',
    url: 'https://online-journals.org/index.php/i-joe/article/download/54635/16271/174987'
  };
  var TPU_SOURCE = {
    label: 'Materials Horizons 2024 supplementary information, TPU FEA material characterization',
    url: 'https://www.rsc.org/suppdata/d4/mh/d4mh01173b/d4mh01173b1.pdf'
  };
  var NYLON_SOURCE = {
    label: 'Polymers 2020, 12, 302, FDM nylon mechanical properties',
    url: 'https://doi.org/10.3390/polym12020302'
  };
  var NYLON_DENSITY_SOURCE = {
    label: 'Sustainability 2024, 16, 356, FIBERLOGY nylon filament density',
    url: 'https://doi.org/10.3390/su16010356'
  };

  function clone(value) {
    if (value == null || typeof value !== 'object') { return value; }
    if (Array.isArray(value)) { return value.map(clone); }
    var copy = {};
    Object.keys(value).forEach(function (key) { copy[key] = clone(value[key]); });
    return copy;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) { return value; }
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function sourceFields(source, fields) {
    var result = {};
    fields.forEach(function (field) { result[field] = source; });
    return result;
  }

  function mergeFields() {
    var result = {};
    Array.prototype.slice.call(arguments).forEach(function (group) { Object.assign(result, group); });
    return result;
  }

  function factoryRecord(id, material, fieldProvenance, notes, warning) {
    var validation = root.SpjutsimFEA.validateIsotropicMaterial(material);
    if (!validation.valid || !material.name) { throw new Error('Invalid checked-in material catalog record: ' + id); }
    Object.keys(validation.value).forEach(function (field) {
      if (field !== 'name' && !fieldProvenance[field]) { throw new Error('Missing provenance for ' + id + '.' + field); }
    });
    return deepFreeze({
      id: id,
      layer: 'factory',
      material: validation.value,
      metadata: { fieldProvenance: fieldProvenance, notes: notes || '', warning: warning || '' }
    });
  }

  var PRINT_VARIABILITY = 'Printed properties vary substantially with brand, moisture, orientation, layer bonding, infill, temperature, and process. Verify this starting point against the actual filament and printed test coupons.';
  var FACTORY_MATERIALS = deepFreeze([
    factoryRecord('factory.material.steel.astm-a36', {
      name: 'Steel (ASTM A36)', youngsModulusPa: 200e9, poissonsRatio: 0.26, densityKgM3: 7850,
      tensileYieldPa: 250e6, ultimateTensilePa: 400e6
    }, mergeFields(
      sourceFields(TRUSS_SOURCE, ['youngsModulusPa', 'densityKgM3', 'tensileYieldPa', 'ultimateTensilePa']),
      sourceFields(NASA_POISSON_SOURCE, ['poissonsRatio'])
    ), 'Generic hot-rolled A36 starting point. Confirm product form, thickness, specification revision, and mill certification.'),
    factoryRecord('factory.material.aluminum.6061-t6', {
      name: 'Aluminum (6061-T6)', youngsModulusPa: 69e9, poissonsRatio: 0.33, densityKgM3: 2700,
      tensileYieldPa: 276e6, ultimateTensilePa: 310e6
    }, mergeFields(
      sourceFields(TRUSS_SOURCE, ['youngsModulusPa', 'densityKgM3', 'tensileYieldPa', 'ultimateTensilePa']),
      sourceFields(NASA_POISSON_SOURCE, ['poissonsRatio'])
    ), 'Generic 6061-T6 starting point. Confirm temper, product form, direction, and certification.'),
    factoryRecord('factory.material.polymer.pla', {
      name: 'PLA', youngsModulusPa: 3.425e9, poissonsRatio: 0.33, densityKgM3: 1240, ultimateTensilePa: 63.9e6
    }, sourceFields(COEXTRUSION_SOURCE, ['youngsModulusPa', 'poissonsRatio', 'densityKgM3', 'ultimateTensilePa']), PRINT_VARIABILITY),
    factoryRecord('factory.material.polymer.abs', {
      name: 'ABS', youngsModulusPa: 2.4e9, poissonsRatio: 0.37, densityKgM3: 1050, tensileYieldPa: 26.84e6
    }, mergeFields(
      sourceFields(ABS_SOURCE, ['youngsModulusPa', 'poissonsRatio', 'tensileYieldPa']),
      sourceFields(POLYMER_FEA_SOURCE, ['densityKgM3'])
    ), PRINT_VARIABILITY),
    factoryRecord('factory.material.polymer.asa', {
      name: 'ASA', youngsModulusPa: 1.812e9, poissonsRatio: 0.38, densityKgM3: 1070, ultimateTensilePa: 35.7e6
    }, sourceFields(COEXTRUSION_SOURCE, ['youngsModulusPa', 'poissonsRatio', 'densityKgM3', 'ultimateTensilePa']), PRINT_VARIABILITY),
    factoryRecord('factory.material.polymer.petg', {
      name: 'PETG', youngsModulusPa: 2.2e9, poissonsRatio: 0.33, densityKgM3: 1290, ultimateTensilePa: 53e6
    }, sourceFields(POLYMER_FEA_SOURCE, ['youngsModulusPa', 'poissonsRatio', 'densityKgM3', 'ultimateTensilePa']), PRINT_VARIABILITY),
    factoryRecord('factory.material.polymer.tpu', {
      name: 'TPU', youngsModulusPa: 35.4e6, poissonsRatio: 0.4, densityKgM3: 1177
    }, sourceFields(TPU_SOURCE, ['youngsModulusPa', 'poissonsRatio', 'densityKgM3']), PRINT_VARIABILITY,
    'TPU commonly undergoes large deformation and nonlinear, rate-dependent behavior; this small-strain linear-isotropic model may be inappropriate.'),
    factoryRecord('factory.material.polymer.nylon', {
      name: 'Nylon', youngsModulusPa: 0.493e9, poissonsRatio: 0.39, densityKgM3: 1010,
      tensileYieldPa: 3.61e6, ultimateTensilePa: 44.79e6
    }, mergeFields(
      sourceFields(NYLON_SOURCE, ['youngsModulusPa', 'poissonsRatio', 'tensileYieldPa', 'ultimateTensilePa']),
      sourceFields(NYLON_DENSITY_SOURCE, ['densityKgM3'])
    ), PRINT_VARIABILITY + ' Nylon is hygroscopic; conditioning can materially change its response.')
  ]);

  function normalizedName(name) { return String(name || '').trim().toLowerCase(); }

  function validateUserEntry(raw) {
    var validation;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        typeof raw.id !== 'string' || raw.id.indexOf('user.material.') !== 0) { return null; }
    validation = root.SpjutsimFEA.validateIsotropicMaterial(raw.material);
    if (!validation.valid || !validation.value.name) { return null; }
    return {
      id: raw.id, layer: 'user', material: validation.value,
      metadata: { source: 'User', notes: raw.metadata && typeof raw.metadata.notes === 'string' ? raw.metadata.notes : '' }
    };
  }

  function MaterialCatalog(storage) {
    this.storage = storage || null;
    this.userEntries = [];
    this.nextUserSequence = 1;
    this.loadWarning = null;
    this.load();
  }

  MaterialCatalog.prototype.load = function () {
    var raw;
    var parsed;
    if (!this.storage || typeof this.storage.getItem !== 'function') { return; }
    try {
      raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) { return; }
      parsed = JSON.parse(raw);
      if (!parsed || parsed.schemaVersion !== STORAGE_SCHEMA_VERSION || !Array.isArray(parsed.materials) ||
          !Number.isSafeInteger(parsed.nextUserSequence) || parsed.nextUserSequence < 1) {
        throw new Error('unsupported schema');
      }
      this.userEntries = parsed.materials.map(validateUserEntry);
      if (this.userEntries.some(function (entry) { return !entry; })) { throw new Error('invalid entry'); }
      var seen = new Set();
      var seenIds = new Set();
      FACTORY_MATERIALS.forEach(function (entry) { seen.add(normalizedName(entry.material.name)); });
      this.userEntries.forEach(function (entry) {
        var name = normalizedName(entry.material.name);
        if (seen.has(name) || seenIds.has(entry.id)) { throw new Error('duplicate material'); }
        seen.add(name);
        seenIds.add(entry.id);
      });
      if (this.userEntries.some(function (entry) {
        var sequence = Number(entry.id.slice('user.material.'.length));
        return !Number.isSafeInteger(sequence) || sequence < 1 || sequence >= parsed.nextUserSequence;
      })) { throw new Error('invalid material sequence'); }
      this.nextUserSequence = parsed.nextUserSequence;
    } catch (error) {
      this.userEntries = [];
      this.nextUserSequence = 1;
      this.loadWarning = 'Saved materials could not be loaded because browser storage is corrupt, unsupported, or unavailable.';
    }
  };

  MaterialCatalog.prototype.persist = function () {
    if (!this.storage || typeof this.storage.setItem !== 'function') {
      return 'The material is applied, but browser storage is unavailable so it will not be retained.';
    }
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify({
        schemaVersion: STORAGE_SCHEMA_VERSION,
        nextUserSequence: this.nextUserSequence,
        materials: this.userEntries
      }));
      return null;
    } catch (error) {
      return 'The material is applied, but it could not be saved in browser storage. Check storage permissions or available space.';
    }
  };

  MaterialCatalog.prototype.list = function () {
    return FACTORY_MATERIALS.concat(this.userEntries).map(clone);
  };

  MaterialCatalog.prototype.get = function (id) {
    var entry = FACTORY_MATERIALS.concat(this.userEntries).find(function (candidate) { return candidate.id === id; });
    return entry ? clone(entry) : null;
  };

  MaterialCatalog.prototype.materialSnapshot = function (id) {
    var entry = this.get(id);
    return entry ? clone(entry.material) : null;
  };

  MaterialCatalog.prototype.assertUniqueName = function (name, excludedId) {
    var normalized = normalizedName(name);
    if (FACTORY_MATERIALS.concat(this.userEntries).some(function (entry) {
      return entry.id !== excludedId && normalizedName(entry.material.name) === normalized;
    })) { throw new Error('A material named "' + String(name).trim() + '" already exists. Choose a unique name or explicitly replace the saved entry.'); }
  };

  MaterialCatalog.prototype.saveUser = function (material) {
    var validation = root.SpjutsimFEA.validateIsotropicMaterial(material);
    var entry;
    if (!validation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validation)); }
    if (!validation.value.name) { throw new Error('Enter a name before saving a custom material.'); }
    this.assertUniqueName(validation.value.name);
    entry = {
      id: 'user.material.' + this.nextUserSequence,
      layer: 'user', material: validation.value, metadata: { source: 'User', notes: '' }
    };
    this.nextUserSequence += 1;
    this.userEntries.push(entry);
    return { entry: clone(entry), storageWarning: this.persist() };
  };

  MaterialCatalog.prototype.replaceUser = function (id, material) {
    var index = this.userEntries.findIndex(function (entry) { return entry.id === id; });
    var validation = root.SpjutsimFEA.validateIsotropicMaterial(material);
    if (index < 0) { throw new Error('Only a saved user material can be replaced.'); }
    if (!validation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validation)); }
    if (!validation.value.name) { throw new Error('Enter a name before replacing a saved material.'); }
    this.assertUniqueName(validation.value.name, id);
    this.userEntries[index] = { id: id, layer: 'user', material: validation.value, metadata: { source: 'User', notes: '' } };
    return { entry: clone(this.userEntries[index]), storageWarning: this.persist() };
  };

  MaterialCatalog.prototype.removeUser = function (id) {
    var index = this.userEntries.findIndex(function (entry) { return entry.id === id; });
    if (index < 0) { throw new Error('Only a saved user material can be removed.'); }
    this.userEntries.splice(index, 1);
    return { storageWarning: this.persist() };
  };

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.MATERIAL_CATALOG_STORAGE_KEY = STORAGE_KEY;
  root.SpjutsimFEA.MATERIAL_CATALOG_SCHEMA_VERSION = STORAGE_SCHEMA_VERSION;
  root.SpjutsimFEA.FACTORY_MATERIALS = FACTORY_MATERIALS;
  root.SpjutsimFEA.MaterialCatalog = MaterialCatalog;
}(globalThis));
