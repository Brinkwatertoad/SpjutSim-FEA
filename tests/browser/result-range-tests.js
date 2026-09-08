(function (root) {
  'use strict';
  var status = document.getElementById('test-status');
  function assert(condition, message) { if (!condition) { throw new Error(message); } }
  try {
    // Execute the shipped worker's pure postprocessing helper; FEM initialization is unused here.
    var boundaryRanges = new Function('createSpjutsimFemModule', 'self',
      root.SpjutsimLocalRuntimeWorkers.solver + '\nreturn boundaryRanges;')(
      function () { return Promise.resolve({}); }, { postMessage: function () {} });
    var positions = new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    var stress = new Float32Array([10, 20, 30, 999]);
    var fields = { stress: stress, signed: new Float32Array([-4, -2, -3, -999]) };
    var ranges = boundaryRanges(new Uint32Array([0, 1, 2, 2, 0, 1]), fields, positions);
    assert(ranges.stress.minimum === 10 && ranges.stress.maximum === 30 && stress[3] === 999,
      'surface range included an unused interior node or changed engineering values');
    assert(ranges.signed.minimum === -4 && ranges.signed.maximum === -2,
      'boundary minimum or negative component range was incorrect');
    assert(ranges.stress.locationOwner === 'surface-node' && ranges.stress.maximumNodeIndex === 2 &&
      ranges.stress.maximumLocationM.join() === '0,1,0', 'surface peak location ownership was lost');
    [new Uint32Array(), new Uint32Array([0, 1]), new Uint32Array([0, 1, 4]), [0, 1, 2]].forEach(function (boundary) {
      var rejected = false;
      try { boundaryRanges(boundary, fields, positions); } catch (error) { rejected = true; }
      assert(rejected, 'empty or invalid boundary connectivity was accepted');
    });
    [NaN, Infinity, -Infinity].forEach(function (value) {
      var rejected = false;
      try { boundaryRanges(new Uint32Array([0, 1, 2]), { stress: new Float32Array([10, value, 30, 999]) }, positions); }
      catch (error) { rejected = true; }
      assert(rejected, 'nonfinite boundary value was accepted');
    });
    status.textContent = 'Passed'; status.dataset.result = 'passed';
  } catch (error) { status.textContent = error.message; status.dataset.result = 'failed'; throw error; }
}(globalThis));
