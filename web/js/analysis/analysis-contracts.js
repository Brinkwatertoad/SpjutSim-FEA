(function (root) {
  'use strict';

  /** @typedef {'youngsModulusPa'|'densityKgM3'|'strengthPa'|'displacementM'|'pressurePa'|'forceN'} EngineeringQuantity */
  /** @typedef {{name?: string, youngsModulusPa: number, poissonsRatio: number, densityKgM3?: number, tensileYieldPa?: number, compressiveYieldPa?: number, ultimateTensilePa?: number, ultimateCompressivePa?: number}} IsotropicMaterial */
  /** @typedef {{id: string, name: string, type: 'support', faceIds: string[], componentsM: {x?: number, y?: number, z?: number}}} BoundaryCondition */
  /** @typedef {{id: string, name: string, type: 'pressure'|'total-force', faceIds: string[], pressurePa?: number, direction?: 'surface-normal', forceN?: number[]}} SurfaceLoad */
  /** @typedef {{enabled: boolean, accelerationMS2: number[]}} GravityLoad */

  var DISPLAY_UNITS = {
    youngsModulusPa: { symbol: 'GPa', siPerDisplayUnit: 1e9 },
    densityKgM3: { symbol: 'kg/m³', siPerDisplayUnit: 1 },
    strengthPa: { symbol: 'MPa', siPerDisplayUnit: 1e6 },
    displacementM: { symbol: 'mm', siPerDisplayUnit: 1e-3 },
    pressurePa: { symbol: 'MPa', siPerDisplayUnit: 1e6 },
    forceN: { symbol: 'N', siPerDisplayUnit: 1 }
  };

  function issue(code, message, field) {
    return { code: code, message: message, field: field || null };
  }

  function result(value, errors, warnings) {
    return { valid: errors.length === 0, value: errors.length === 0 ? value : null, errors: errors, warnings: warnings || [] };
  }

  function displayToSI(quantity, displayValue) {
    var unit = DISPLAY_UNITS[quantity];
    var numeric = typeof displayValue === 'number' ? displayValue : Number(String(displayValue).trim());
    if (!unit || !Number.isFinite(numeric)) { throw new Error('Enter a finite value for ' + quantity + '.'); }
    return numeric * unit.siPerDisplayUnit;
  }

  function siToDisplay(quantity, siValue) {
    var unit = DISPLAY_UNITS[quantity];
    if (!unit || !Number.isFinite(siValue)) { throw new Error('A finite SI value is required for ' + quantity + '.'); }
    return siValue / unit.siPerDisplayUnit;
  }

  function optionalPositive(source, target, key, label, errors) {
    if (source[key] === undefined || source[key] === null || source[key] === '') { return; }
    if (!Number.isFinite(source[key]) || source[key] <= 0) {
      errors.push(issue('INVALID_POSITIVE_VALUE', label + ' must be a finite value greater than zero.', key));
      return;
    }
    target[key] = source[key];
  }

  /** Validate and normalize the public IsotropicMaterial contract. */
  function validateIsotropicMaterial(material, gravity) {
    var errors = [];
    var warnings = [];
    var value = {};
    if (!material || typeof material !== 'object' || Array.isArray(material)) {
      return result(null, [issue('INVALID_MATERIAL', 'Enter the material properties.', 'material')]);
    }
    if (material.name !== undefined) {
      if (typeof material.name !== 'string' || material.name.trim().length === 0) {
        errors.push(issue('INVALID_MATERIAL_NAME', 'Material name cannot be blank.', 'name'));
      } else {
        value.name = material.name.trim();
      }
    }
    if (!Number.isFinite(material.youngsModulusPa) || material.youngsModulusPa <= 0) {
      errors.push(issue('INVALID_YOUNGS_MODULUS', "Young's modulus must be a finite value greater than zero.", 'youngsModulusPa'));
    } else {
      value.youngsModulusPa = material.youngsModulusPa;
    }
    if (!Number.isFinite(material.poissonsRatio) || material.poissonsRatio <= -1 || material.poissonsRatio >= 0.5) {
      errors.push(issue('INVALID_POISSONS_RATIO', "Poisson's ratio must be greater than -1 and less than 0.5.", 'poissonsRatio'));
    } else {
      value.poissonsRatio = material.poissonsRatio;
      if (material.poissonsRatio < 0) {
        warnings.push(issue('UNUSUAL_POISSONS_RATIO', 'A negative Poisson\'s ratio is unusual for ordinary engineering solids, but is mathematically valid.', 'poissonsRatio'));
      }
    }
    optionalPositive(material, value, 'densityKgM3', 'Density', errors);
    optionalPositive(material, value, 'tensileYieldPa', 'Tensile yield strength', errors);
    optionalPositive(material, value, 'compressiveYieldPa', 'Compressive yield strength', errors);
    optionalPositive(material, value, 'ultimateTensilePa', 'Ultimate tensile strength', errors);
    optionalPositive(material, value, 'ultimateCompressivePa', 'Ultimate compressive strength', errors);
    if (gravity && gravity.enabled && value.densityKgM3 === undefined) {
      errors.push(issue('DENSITY_REQUIRED_FOR_GRAVITY', 'Enter material density before enabling gravity.', 'densityKgM3'));
    }
    return result(value, errors, warnings);
  }

  function validateKnownFaceIds(faceIds, knownFaceIds) {
    var errors = [];
    var known = new Set(Array.isArray(knownFaceIds) ? knownFaceIds : []);
    var seen = new Set();
    if (!Array.isArray(faceIds) || faceIds.length === 0) {
      return result(null, [issue('FACES_REQUIRED', 'Select at least one CAD face.', 'faceIds')]);
    }
    faceIds.forEach(function (faceId) {
      if (typeof faceId !== 'string' || !known.has(faceId)) {
        errors.push(issue('UNKNOWN_FACE', 'One or more selected CAD faces no longer exist.', 'faceIds'));
      } else if (seen.has(faceId)) {
        errors.push(issue('DUPLICATE_FACE', 'A CAD face can appear only once in an analysis item.', 'faceIds'));
      }
      seen.add(faceId);
    });
    return result(errors.length ? null : faceIds.slice(), errors);
  }

  function validateNamedItem(item, kind, knownFaceIds) {
    var errors = [];
    var faces = validateKnownFaceIds(item && item.faceIds, knownFaceIds);
    var value = {};
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return result(null, [issue('INVALID_' + kind.toUpperCase(), 'Enter a valid ' + kind + '.', kind)]);
    }
    if (typeof item.id !== 'string' || item.id.length === 0) { errors.push(issue('ITEM_ID_REQUIRED', 'Analysis item identifier is required.', 'id')); }
    else { value.id = item.id; }
    if (typeof item.name !== 'string' || item.name.trim().length === 0) { errors.push(issue('ITEM_NAME_REQUIRED', 'Enter a name for this ' + kind + '.', 'name')); }
    else { value.name = item.name.trim(); }
    if (!faces.valid) { errors = errors.concat(faces.errors); }
    else { value.faceIds = faces.value; }
    return { errors: errors, value: value };
  }

  function validateBoundaryCondition(item, knownFaceIds) {
    var base = validateNamedItem(item, 'support', knownFaceIds);
    var value = base.value;
    var constrainedCount = 0;
    var errors = base.errors;
    if (!item || item.type !== 'support') {
      errors.push(issue('INVALID_SUPPORT_TYPE', 'Enter a component-based support.', 'type'));
      return result(value, errors);
    }
    value.type = 'support';
    value.componentsM = {};
    if (!item.componentsM || typeof item.componentsM !== 'object' || Array.isArray(item.componentsM)) {
      errors.push(issue('DISPLACEMENT_COMPONENT_REQUIRED', 'Enable and enter at least one support component.', 'componentsM'));
      return result(value, errors);
    }
    Object.keys(item.componentsM).forEach(function (axis) {
      if (['x', 'y', 'z'].indexOf(axis) === -1) {
        errors.push(issue('INVALID_DISPLACEMENT_COMPONENT', 'Support components must use global X, Y, or Z.', 'componentsM'));
      }
    });
    ['x', 'y', 'z'].forEach(function (axis) {
      if (item.componentsM[axis] === undefined) { return; }
      constrainedCount += 1;
      if (!Number.isFinite(item.componentsM[axis])) {
        errors.push(issue('INVALID_DISPLACEMENT_COMPONENT', 'Every enabled support component needs a finite value.', 'componentsM.' + axis));
      } else {
        value.componentsM[axis] = item.componentsM[axis];
      }
    });
    if (constrainedCount === 0) {
      errors.push(issue('DISPLACEMENT_COMPONENT_REQUIRED', 'Enable and enter at least one support component.', 'componentsM'));
    }
    return result(value, errors);
  }

  function finiteVector(vector) {
    return Array.isArray(vector) && vector.length === 3 && vector.every(Number.isFinite);
  }

  function nonzeroVector(vector) {
    return finiteVector(vector) && Math.hypot(vector[0], vector[1], vector[2]) > 0;
  }

  function validateLoad(item, knownFaceIds) {
    var base = validateNamedItem(item, 'load', knownFaceIds);
    var value = base.value;
    var errors = base.errors;
    if (!item || (item.type !== 'pressure' && item.type !== 'total-force')) {
      errors.push(issue('INVALID_LOAD_TYPE', 'Choose Pressure or Total force.', 'type'));
      return result(value, errors);
    }
    value.type = item.type;
    if (item.type === 'pressure') {
      if (!Number.isFinite(item.pressurePa) || item.pressurePa === 0) {
        errors.push(issue('INVALID_PRESSURE', 'Pressure must be a finite, non-zero value.', 'pressurePa'));
      } else {
        value.pressurePa = item.pressurePa;
        value.direction = 'surface-normal';
      }
    } else if (!nonzeroVector(item.forceN)) {
      errors.push(issue('INVALID_FORCE_VECTOR', 'Total force must be a finite, non-zero three-component vector.', 'forceN'));
    } else {
      value.forceN = item.forceN.slice();
    }
    return result(value, errors);
  }

  function validateGravity(gravity, material) {
    var errors = [];
    var value;
    if (!gravity || typeof gravity !== 'object' || typeof gravity.enabled !== 'boolean') {
      return result(null, [issue('INVALID_GRAVITY', 'Gravity settings are incomplete.', 'gravity')]);
    }
    if (!nonzeroVector(gravity.accelerationMS2)) {
      errors.push(issue('INVALID_GRAVITY_VECTOR', 'Gravity acceleration must be a finite, non-zero three-component vector.', 'accelerationMS2'));
    }
    if (gravity.enabled && (!material || !Number.isFinite(material.densityKgM3) || material.densityKgM3 <= 0)) {
      errors.push(issue('DENSITY_REQUIRED_FOR_GRAVITY', 'Enter material density before enabling gravity.', 'densityKgM3'));
    }
    value = { enabled: gravity.enabled, accelerationMS2: finiteVector(gravity.accelerationMS2) ? gravity.accelerationMS2.slice() : [] };
    return result(value, errors);
  }

  function firstValidationMessage(validation) {
    return validation && validation.errors && validation.errors.length ? validation.errors[0].message : 'The analysis item is invalid.';
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.DISPLAY_UNITS = DISPLAY_UNITS;
  root.SpjutsimFEA.displayToSI = displayToSI;
  root.SpjutsimFEA.siToDisplay = siToDisplay;
  root.SpjutsimFEA.validateIsotropicMaterial = validateIsotropicMaterial;
  root.SpjutsimFEA.validateKnownFaceIds = validateKnownFaceIds;
  root.SpjutsimFEA.validateBoundaryCondition = validateBoundaryCondition;
  root.SpjutsimFEA.validateLoad = validateLoad;
  root.SpjutsimFEA.validateGravity = validateGravity;
  root.SpjutsimFEA.firstValidationMessage = firstValidationMessage;
}(globalThis));
