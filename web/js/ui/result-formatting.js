(function (root) {
  'use strict';

  function formatResultNumber(value, significantDigits) {
    if (value === Infinity) { return '∞'; }
    if (value === -Infinity) { return '−∞'; }
    if (!Number.isFinite(value)) { return '—'; }
    if (value === 0) { return '0'; }
    var digits = Number.isInteger(significantDigits) && significantDigits >= 1 && significantDigits <= 15 ? significantDigits : 4;
    var rounded = Number(value.toPrecision(digits));
    return Math.abs(rounded) >= 1e6 || Math.abs(rounded) < 1e-3
      ? rounded.toExponential().replace(/\.0+(?=e)/, '') : String(rounded);
  }

  // International pound/inch and standard gravity, expressed in SI.
  var psiPa = 0.45359237 * 9.80665 / (0.0254 * 0.0254);
  var resultUnitScales = Object.freeze({Pa:1,kPa:1e3,MPa:1e6,GPa:1e9,psi:psiPa,ksi:psiPa*1000,
    m:1,mm:1e-3,'µm':1e-6,in:0.0254,N:1,kN:1e3,J:1});

  // The caller chooses one explicit unit for a field, shared by its legend and probes.
  function formatResultMagnitude(valueSI, unit, significantDigits) {
    var scales = resultUnitScales;
    if (!Object.prototype.hasOwnProperty.call(scales, unit)) { throw new Error('Unsupported result unit: ' + unit); }
    return formatResultNumber(valueSI / scales[unit], significantDigits) + ' ' + unit;
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.RESULT_UNIT_SCALES = resultUnitScales;
  root.SpjutsimFEA.formatResultNumber = formatResultNumber;
  root.SpjutsimFEA.formatResultMagnitude = formatResultMagnitude;
}(globalThis));
