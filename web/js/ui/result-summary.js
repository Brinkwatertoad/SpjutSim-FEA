(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  function formatNumber(value, unit) { return api.formatResultNumber(value) + (unit ? ' ' + unit : ''); }
  function formatBytes(bytes) { return formatNumber(bytes / 1073741824, 'GiB'); }
  // Undeformed geometry bounds in the study's global axes, never exaggerated result bounds.
  function resultSummaryRows(documentState) {
    var result = documentState.results;
    if (!result) { return { values: [], diagnostics: [] }; }
    var presentation = documentState.viewportPresentation || {};
    var stressUnit = presentation.stressUnit || 'MPa', lengthUnit = presentation.lengthUnit || 'mm';
    function stress(value) { return api.formatResultMagnitude(value, stressUnit); }
    function displacement(value) { return api.formatResultMagnitude(value, lengthUnit); }
    var box = documentState.geometry && documentState.geometry.boundingBoxM;
    var size = box ? box.maxM.map(function (v, i) { return displacement(v - box.minM[i]); }).join(' × ') : 'Unavailable';
    var entries = [
      ['Original part size (X × Y × Z)', size],
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
}(globalThis));
