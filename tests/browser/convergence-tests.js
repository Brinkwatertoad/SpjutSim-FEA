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
    var unresolved = api.classifyConvergence([level(1, 1, 1, 100), level(.7, 1.01, 1.01, 130)], 'criteria-met', settings, 1);
    assert(unresolved.status === 'converged-stress-unresolved' && unresolved.likelyStressSingularity,
      'concentrated rising stress was not classified separately');
    var separated = api.classifyConvergence([
      level(1, 1, 1, 100, 0), level(.7, 1.01, 1.01, 130, 0.5)
    ], 'criteria-met', settings, 1);
    assert(separated.status === 'converged-stress-unresolved' && !separated.likelyStressSingularity,
      'a peak moving across the same CAD face was incorrectly classified as concentrated');
    assert(api.classifyConvergence([level(1, 1, 1, 100)], 'resource-limit', settings).status === 'indeterminate-resource-limit',
      'resource stop was not indeterminate');
    assert(api.classifyConvergence([], 'failed', settings).status === 'failed', 'failure stop was hidden');
    assert(api.convergenceStatusMessage({ status: 'failed', classification: { status: 'failed', stopReason: 'failed' },
      error: { diagnostic: { userMessage: 'The quadratic mesh is inverted.' } } }) === 'Failed — The quadratic mesh is inverted.',
    'convergence failure omitted its actionable diagnostic');
    assert(api.legendRangeStatus({ clipped: true }, 5) === 'Clipped visualization range · deformation ×5',
      'clipped factor-of-safety legend was labeled as unclipped');

    var tabs = Array.from(document.querySelectorAll('[data-output-tab]'));
    var panels = Array.from(document.querySelectorAll('[data-output-panel]'));
    api.configureOutputTabs(tabs, panels);
    document.getElementById('test-convergence-tab').click();
    assert(document.getElementById('test-convergence-tab').getAttribute('aria-selected') === 'true' &&
      !document.getElementById('convergence-summary').hidden && document.getElementById('test-results-panel').hidden,
    'output tabs did not select only the requested panel');
    document.getElementById('test-convergence-tab').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert(document.getElementById('test-diagnostics-tab').getAttribute('aria-selected') === 'true' &&
      document.activeElement === document.getElementById('test-diagnostics-tab'),
    'output tabs did not support keyboard selection and focus');
    document.getElementById('test-convergence-tab').click();
    var tableScroll = document.querySelector('.fea-table-scroll');
    assert(getComputedStyle(tableScroll).overflowX === 'auto', 'convergence table does not scroll inside the results pane');
    assert(document.getElementById('convergence-plot').getBoundingClientRect().width <=
      document.getElementById('convergence-summary').getBoundingClientRect().width,
    'convergence plot overflows the results pane');
    if (matchMedia('(max-width: 900px)').matches) {
      assert(getComputedStyle(document.getElementById('test-output')).display !== 'none',
        'narrow layouts hide all results and convergence controls');
    }

    var assigned = {};
    function color(name) { return { set: function (value) { assigned[name] = value; } }; }
    var viewport = {
      scene: { background: color('background') },
      previewMesh: { material: [{ color: color('geometry') }, { color: color('selection'), emissive: color('selectionEmissive') }] },
      importedGeometry: { getObjectByName: function () { return { material: { color: color('featureEdges') } }; } },
      meshSurface: { material: [{ color: color('meshGeometry') }, { color: color('meshSelection'), emissive: color('meshSelectionEmissive') }] },
      meshDisplay: { userData: { lines: { material: { color: color('meshLines') } } } },
      resultDisplay: { userData: { lines: { material: { color: color('resultLines') } } } },
      rebuildReferenceGrid: function () { assigned.grid = true; },
      rebuildAnalysisOverlay: function () { assigned.overlay = true; },
      rebuildAxisTriad: function () { assigned.triad = true; }
    };
    document.documentElement.style.setProperty('--ui-color-canvas', '#010101');
    document.documentElement.style.setProperty('--ui-color-geometry', '#020202');
    document.documentElement.style.setProperty('--ui-color-selection', '#030303');
    document.documentElement.style.setProperty('--ui-color-grid-major', '#040404');
    api.refreshViewportTheme(viewport);
    assert(assigned.background === '#010101' && assigned.geometry === '#020202' && assigned.selection === '#030303' &&
      assigned.featureEdges === '#040404' && assigned.meshGeometry === '#020202' && assigned.meshSelection === '#030303' &&
      assigned.meshLines === '#040404' && assigned.resultLines === '#040404' && assigned.grid && assigned.overlay && assigned.triad,
    'live theme refresh left existing viewport materials on the previous scheme');
    status.textContent = 'Passed'; status.dataset.result = 'passed';
  } catch (error) {
    status.textContent = error.message; status.dataset.result = 'failed'; throw error;
  }
}(globalThis));
