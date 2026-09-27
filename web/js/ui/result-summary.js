(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  function formatNumber(value, unit) { return api.formatResultNumber(value) + (unit ? ' ' + unit : ''); }
  function formatBytes(bytes) { return formatNumber(bytes / 1073741824, 'GiB'); }
  function resultGuidance(state) {
    var study = state.convergenceStudy, classification = study && study.classification;
    var globalStable = classification && classification.globalConverged;
    var stressStable = classification && classification.stressStable;
    var changes = classification && classification.changes, settings = study && study.settings;
    function comparison(value, limit, label) {
      if (!Number.isFinite(value)) { return label + ' changed from zero; refine further to assess stability.'; }
      return label + ' changed ' + api.formatResultNumber(value * 100) + '%; ' +
        (value <= limit + 1e-12 ? 'within' : 'above') + ' the ' + api.formatResultNumber(limit * 100) + '% refinement threshold.';
    }
    var displacement = globalStable ? 'Displacement and energy stabilized across the last refinement.' :
      (!study ? 'Mesh sensitivity not studied. Choose Check with a finer mesh to compare displacement.' : 'Mesh check incomplete or outside its thresholds. Review convergence for the next step.');
    var stress = stressStable ? 'Peak stress stabilized across the last refinement.' : 'Locate the peak, inspect supports and loads, and refine to check stress stability.';
    if (changes && settings) {
      displacement = comparison(changes.maximumDisplacement, settings.displacementTolerance, 'Displacement') + ' ' +
        comparison(changes.strainEnergy, settings.strainEnergyTolerance, 'Strain energy');
      stress = comparison(changes.rawVonMisesMax, settings.stressTolerance, 'Peak stress') +
        (stressStable ? '' : ' Inspect the peak and refine further. Peak-based FoS cannot yet establish whether this region meets your requirement.');
    }
    var fos = state.results.factorOfSafety, unit = (state.viewportPresentation || {}).stressUnit || 'MPa';
    var sources = {'tensile-yield':'tensile yield','compressive-yield':'compressive yield',
      'tensile-yield-minimum':'tensile yield (smaller supplied strength)','compressive-yield-minimum':'compressive yield (smaller supplied strength)'};
    var yieldBasis = fos ? 'Criterion: von Mises yielding. Strength used: ' + (sources[fos.strength.source] || 'yield strength') +
      ', ' + api.formatResultMagnitude(fos.strength.valuePa, unit) + '. FoS = strength ÷ peak von Mises (' +
      api.formatResultMagnitude(state.results.extrema.rawVonMisesMax.valuePa, unit) + '). ' : '';
    return {
      displacement: displacement + ' Design displacement limits are a separate requirement.',
      stress: 'Unaveraged peak; the smoothed surface may show a lower maximum. ' + stress,
      yield: fos ? yieldBasis + 'This is not a safety verdict; compare with your required FoS and review stress stability.' :
        'Add a suitable tensile or compressive yield strength in Material to calculate yield FoS. Use strength data appropriate to the actual part.'
    };
  }
  // Undeformed geometry bounds in the study's global axes, never exaggerated result bounds.
  function resultSummaryRows(documentState) {
    var result = documentState.results;
    if (!result) { return { values: [], diagnostics: [] }; }
    var presentation = documentState.viewportPresentation || {};
    var stressUnit = presentation.stressUnit || 'MPa', lengthUnit = presentation.lengthUnit || 'mm';
    function stress(value) { return api.formatResultMagnitude(value, stressUnit); }
    function displacement(value) { return api.formatResultMagnitude(value, lengthUnit); }
    var info = api.modelInformation(documentState);

    var box = documentState.geometry && documentState.geometry.boundingBoxM;
    var size = box ? box.maxM.map(function (v, i) { return displacement(v - box.minM[i]); }).join(' × ') : 'Unavailable';
    var entries = [
      ['Original part size (X × Y × Z)', size],
      ['CAD volume', info.volumeM3 === null ? 'Unavailable' : api.formatResultMagnitude(info.volumeM3, api.preferredUnit('volumeM3'))],
      ['Mass (homogeneous density)', info.massKg === null ? 'Unavailable' : api.formatResultMagnitude(info.massKg, api.preferredUnit('massKg'))],
      ['Element', result.elementType.toUpperCase()],
      ['System', result.meshStatistics.nodeCount + ' nodes / ' + result.meshStatistics.elementCount + ' elements / ' + result.meshStatistics.nodeCount * 3 + ' DOF'],
      ['Max displacement', displacement(result.extrema.maxDisplacement.valueM)],
      ['Max displacement location', result.extrema.maxDisplacement.locationM.map(function (v) { return api.formatResultMagnitude(v, api.preferredUnit('lengthM')); }).join(', ')],
      ['Peak von Mises — unaveraged solver samples', stress(result.extrema.rawVonMisesMax.valuePa)],
      ['Interior solver sample location', result.extrema.rawVonMisesMax.locationM.map(function (v) { return api.formatResultMagnitude(v, api.preferredUnit('lengthM')); }).join(', ')],
      ['Smoothed surface von Mises max', stress(result.extrema.displayedVonMisesMax.valuePa)],
      ['Max principal', stress(result.extrema.rawMaxPrincipal.valuePa)],
      ['Min principal', stress(result.extrema.rawMinPrincipal.valuePa)],
      ['Applied force', result.equilibrium.totalAppliedForceN.map(function (v) { return api.formatResultMagnitude(v, api.preferredUnit('forceN')); }).join(', ')],
      ['Reaction', result.equilibrium.totalReactionN.map(function (v) { return api.formatResultMagnitude(v, api.preferredUnit('forceN')); }).join(', ')],
      ['Strain energy', api.formatResultMagnitude(result.solverStatistics.strainEnergyJ, api.preferredUnit('energyJ'))],
      ['Convergence', result.convergenceStatus === 'not-run' ? 'Not studied' : result.convergenceStatus],
      ['Assumptions', result.assumptions.join(', ')]
    ];
    if (result.factorOfSafety) {
      entries.splice(8, 0,
        ['Yield FoS — unaveraged samples', formatNumber(result.factorOfSafety.rawMinimum.value)],
        ['Smoothed surface minimum FoS (uncapped)', formatNumber(result.factorOfSafety.displayedMinimum)],
        ['FoS criterion', 'von Mises yield · ' + stress(result.factorOfSafety.strength.valuePa)]);
    }
    return { values: entries, diagnostics: [
      ['Iterations', String(result.solverStatistics.iterations)],
      ['Solver residual', formatNumber(result.solverStatistics.finalRelativeResidual)],
      ['Force balance', formatNumber(result.equilibrium.relativeResidual)],
      ['Solve time', formatNumber(result.solverStatistics.solveDurationMs, 'ms')],
      ['Mesh', result.meshStatistics.nodeCount + ' nodes / ' + result.meshStatistics.elementCount + ' ' + result.elementType.toUpperCase() + ' elements'],
      ['WASM memory', formatBytes(result.solverStatistics.wasmMemoryBytes)],
      ['Warnings', result.warnings.length ? result.warnings.join(' ') : 'None']
    ] };
  }
  api.resultSummaryRows = resultSummaryRows;
  api.resultGuidance = resultGuidance;
}(globalThis));
