(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');
  function assert(condition, message) { if (!condition) { throw new Error(message); } }
  try {
    assert(api.selectYieldStrength({ tensileYieldPa: 250, compressiveYieldPa: 200 }).valuePa === 200,
      'smaller tensile/compressive yield was not selected');
    assert(api.selectYieldStrength({ tensileYieldPa: 250 }).source === 'tensile-yield',
      'single tensile yield was not selected');
    assert(!api.selectYieldStrength({ ultimateTensilePa: 400 }).available,
      'ultimate strength was incorrectly used as yield');
    var derived = api.deriveFactorOfSafety({
      recoverySampleFields: { vonMisesPa: new Float64Array([0, 50, 100]), elementIndices: new Uint32Array([0, 0, 1]) },
      surfaceFields: { vonMisesPa: new Float32Array([0, 25, 100]) }
    }, { tensileYieldPa: 200 }, 10);
    assert(derived.rawValues[0] === Infinity && derived.rawMinimum.value === 2 && derived.rawMinimum.sampleIndex === 2,
      'raw FoS did not preserve infinity or minimum ownership');
    assert(derived.surfaceValues[0] === Infinity && derived.displayedMinimum === 2 && derived.contourCeiling === 10,
      'displayed FoS or contour ceiling was wrong');
    assert(api.deriveFactorOfSafety({ recoverySampleFields: { vonMisesPa: new Float64Array([1]), elementIndices: new Uint32Array([0]) },
      surfaceFields: { vonMisesPa: new Float32Array([1]) } }, {}, 10) === null,
      'FoS was created without yield strength');
    status.textContent = 'Passed'; status.dataset.result = 'passed';
  } catch (error) {
    status.textContent = error.message; status.dataset.result = 'failed'; throw error;
  }
}(globalThis));
