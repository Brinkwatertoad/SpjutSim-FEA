(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');
  function assert(value, message) { if (!value) { throw new Error(message); } }
  function level(h, displacement, energy, stress, x) {
    return { targetSizeM: h, maximumDisplacementM: displacement, strainEnergyJ: energy,
      rawVonMisesMaxPa: stress, peakLocationM: [x || 0, 0, 0], peakFaceId: 'loaded' };
  }
  try {
    assert(api.convergenceRelativeChange(0, 0) === 0 && api.convergenceRelativeChange(1, 0) === Infinity,
      'zero-denominator behavior was not explicit');
    var settings = api.createConvergenceSettings();
    assert(settings.refinementFactor === 0.7 && settings.maxLevels === 4,
      'default refinement settings were wrong');
    var converged = api.classifyConvergence([level(1, 1, 1, 100), level(.7, 1.02, 1.02, 105)], 'criteria-met', settings);
    assert(converged.status === 'converged', 'exact convergence thresholds failed');
    var unresolved = api.classifyConvergence([level(1, 1, 1, 100), level(.7, 1.01, 1.01, 130)], 'criteria-met', settings);
    assert(unresolved.status === 'converged-stress-unresolved' && unresolved.likelyStressSingularity,
      'concentrated rising stress was not classified separately');
    assert(api.classifyConvergence([level(1, 1, 1, 100)], 'resource-limit', settings).status === 'indeterminate-resource-limit',
      'resource stop was not indeterminate');
    assert(api.classifyConvergence([], 'failed', settings).status === 'failed', 'failure stop was hidden');
    status.textContent = 'Passed'; status.dataset.result = 'passed';
  } catch (error) {
    status.textContent = error.message; status.dataset.result = 'failed'; throw error;
  }
}(globalThis));
