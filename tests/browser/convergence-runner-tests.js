(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');
  function assert(value, message) { if (!value) { throw new Error(message); } }
  function output(index, active) {
    var value = index ? 1.01 : 1;
    return { mesh: { statistics: { nodeCount: 10 + index, elementCount: 2 + index } },
      preflight: { degreeOfFreedomCount: 30 + index * 3, estimatedPeakBytes: 1000, exceedsWasmCap: false,
        requiresEightGiBConfirmation: false }, material: {},
      solve: function () { return Promise.resolve({ warnings: [], meshStatistics: { boundingBoxDiagonalM: 1 },
        recoverySampleFields: { vonMisesPa: new Float64Array([100]), elementIndices: new Uint32Array([0]) },
        surfaceFields: { vonMisesPa: new Float32Array([100]) },
        extrema: { maxDisplacement: { valueM: value }, rawVonMisesMax: { valuePa: 100, locationM: [0, 0, 0] } },
        solverStatistics: { strainEnergyJ: value, iterations: 2, solveDurationMs: 1 } }); },
      dispose: function () { active.count -= 1; } };
  }
  var active = { count: 0, maximum: 0 };
  var targets = [];
  var completion;
  var runner = new api.ConvergenceRunner({
    prepareLevel: function (target, index) { targets.push(target); active.count += 1; active.maximum = Math.max(active.maximum, active.count); return Promise.resolve(output(index, active)); },
    onLevel: function () {}, onComplete: function (classification) { completion = classification; }
  });
  runner.start(1).then(function () {
    assert(targets.length === 2 && targets[1] === 0.7, 'runner did not refine deterministically');
    assert(active.maximum === 1 && active.count === 0, 'level resources overlapped or leaked');
    assert(completion.status === 'converged', 'runner did not stop after global convergence');
    var resourceCompletion;
    var resourceOutput = output(0, { count: 1 });
    resourceOutput.preflight.exceedsWasmCap = true;
    resourceOutput.solve = function () { throw new Error('over-cap level was solved'); };
    var resourceRunner = new api.ConvergenceRunner({ prepareLevel: function () { return Promise.resolve(resourceOutput); },
      onComplete: function (classification) { resourceCompletion = classification; } });
    return resourceRunner.start(1).then(function () {
      assert(resourceCompletion.status === 'indeterminate-resource-limit', 'over-cap level was not stopped safely');
      var cancellationCompletion;
      var cancellationRunner = new api.ConvergenceRunner({
        prepareLevel: function (target, index) { return Promise.resolve(output(index, { count: 1 })); },
        onLevel: function () { cancellationRunner.cancel(); },
        onComplete: function (classification) { cancellationCompletion = classification; }
      });
      return cancellationRunner.start(1).then(function () {
        assert(cancellationCompletion.stopReason === 'cancelled', 'cancelled study continued refining');
      });
    });
  }).then(function () {
    status.textContent = 'Passed'; status.dataset.result = 'passed';
  }).catch(function (error) { status.textContent = error.message; status.dataset.result = 'failed'; throw error; });
}(globalThis));
