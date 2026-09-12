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
      surfaceFields: { vonMisesPa: new Float32Array([0, 25, 100]) },
      originalSurface: { triangleConnectivity: new Uint32Array([0, 1, 2]) }
    }, { tensileYieldPa: 200 }, 10);
    assert(derived.rawValues[0] === Infinity && derived.rawMinimum.value === 2 && derived.rawMinimum.sampleIndex === 2,
      'raw FoS did not preserve infinity or minimum ownership');
    assert(derived.surfaceValues[0] === Infinity && derived.displayedMinimum === 2 && derived.contourCeiling === 10,
      'displayed FoS or contour ceiling was wrong');
    assert(api.deriveFactorOfSafety({ recoverySampleFields: { vonMisesPa: new Float64Array([1]), elementIndices: new Uint32Array([0]) },
      surfaceFields: { vonMisesPa: new Float32Array([1]) } }, {}, 10) === null,
      'FoS was created without yield strength');
    var boundary = api.deriveFactorOfSafety({
      recoverySampleFields: { vonMisesPa: new Float64Array([10, 20, 30, 999]), elementIndices: new Uint32Array([0, 0, 0, 0]) },
      surfaceFields: { vonMisesPa: new Float32Array([10, 20, 30, 999]) },
      originalSurface: { triangleConnectivity: new Uint32Array([0, 1, 2, 2, 1, 0]) }
    }, { tensileYieldPa: 300 }, 10);
    assert(boundary.displayedMinimum === 10 && boundary.rawMinimum.value === 300 / 999,
      'unused interior node contaminated displayed FoS or raw engineering FoS changed');
    assert(boundary.displayedRange.maximum === 30 && boundary.displayedRange.maximumNodeIndex === 0 &&
      boundary.displayedRange.minimumNodeIndex === 2, 'uncapped boundary FoS range or ownership was lost');
    var zero = api.deriveFactorOfSafety({
      recoverySampleFields: { vonMisesPa: new Float64Array([0]), elementIndices: new Uint32Array([0]) },
      surfaceFields: { vonMisesPa: new Float32Array([0, 0, 0]) },
      originalSurface: { triangleConnectivity: new Uint32Array([2, 1, 0]) }
    }, { tensileYieldPa: 300 }, 10);
    assert(zero.displayedMinimum === Infinity && zero.displayedRange.maximum === Infinity &&
      zero.displayedRange.minimumNodeIndex === 2 && zero.contourValues[2] === 10,
      'zero-stress FoS lost infinity, node ownership, or finite contour cap');
    [new Uint32Array(), new Uint32Array([0, 1]), new Uint32Array([0, 1, 3])].forEach(function (connectivity) {
      var rejected = false;
      try { api.deriveFactorOfSafety({
        recoverySampleFields: { vonMisesPa: new Float64Array([1]), elementIndices: new Uint32Array([0]) },
        surfaceFields: { vonMisesPa: new Float32Array([1, 2, 3]) },
        originalSurface: { triangleConnectivity: connectivity }
      }, { tensileYieldPa: 300 }, 10); } catch (error) { rejected = true; }
      assert(rejected, 'invalid FoS boundary was accepted');
    });
    var decorated = api.decorateResultWithTrust({
      recoverySampleFields: { vonMisesPa: new Float64Array([100, 150, 75, 1]), elementIndices: new Uint32Array([0, 0, 0, 0]) },
      surfaceFields: { vonMisesPa: new Float32Array([100, 150, 75, 1]) },
      originalSurface: { triangleConnectivity: new Uint32Array([0, 1, 2]),
        nodePositionsM: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]) },
      extrema: { maxDisplacement: { valueM: 0 }, rawVonMisesMax: { locationM: [0.25, 0.25, 0.25] } }, ranges: {}
    }, { tensileYieldPa: 300 });
    assert(decorated.ranges.factorOfSafety.minimum === 2 && decorated.ranges.factorOfSafety.maximum === 4 &&
      !decorated.ranges.factorOfSafety.clipped, 'FoS contour range included an interior node or an unused cap');
    assert(decorated.ranges.factorOfSafety.maximumNodeIndex === 2 &&
      decorated.ranges.factorOfSafety.maximumLocationM.join() === '0,1,0', 'FoS range lost surface location ownership');
    status.textContent = 'Passed'; status.dataset.result = 'passed';
  } catch (error) {
    status.textContent = error.message; status.dataset.result = 'failed'; throw error;
  }
}(globalThis));
