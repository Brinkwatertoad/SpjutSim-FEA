(function (root) {
  'use strict';
  var SINGULARITY_WARNING = 'Global response appears converged, but peak stress is not mesh-converged and may be singular. Do not use the reported peak directly for factor-of-safety decisions without reviewing the local geometry and boundary condition.';

  function createConvergenceSettings(overrides) {
    var value = Object.assign({ schemaVersion: 1, refinementFactor: 0.7, maxLevels: 4,
      displacementTolerance: 0.02, strainEnergyTolerance: 0.02,
      stressTolerance: 0.05, concentrationDistanceRatio: 0.02 }, overrides || {});
    if (!(value.refinementFactor > 0 && value.refinementFactor < 1) ||
        !Number.isInteger(value.maxLevels) || value.maxLevels < 2 || value.maxLevels > 4 ||
        !(value.displacementTolerance > 0) || !(value.strainEnergyTolerance > 0) ||
        !(value.stressTolerance > 0) || !(value.concentrationDistanceRatio > 0)) {
      throw new Error('Invalid convergence-study settings.');
    }
    return value;
  }

  function convergenceRelativeChange(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) { return Infinity; }
    if (previous === 0) { return current === 0 ? 0 : Infinity; }
    return Math.abs(current - previous) / Math.abs(previous);
  }

  function peakConcentrated(previous, current, modelDiagonal, settings) {
    var sameFace = previous.peakFaceId && current.peakFaceId && previous.peakFaceId === current.peakFaceId;
    var distance = previous.peakLocationM && current.peakLocationM
      ? Math.hypot(current.peakLocationM[0] - previous.peakLocationM[0],
        current.peakLocationM[1] - previous.peakLocationM[1], current.peakLocationM[2] - previous.peakLocationM[2]) : Infinity;
    return Boolean(sameFace || (Number.isFinite(modelDiagonal) && modelDiagonal > 0 &&
      distance / modelDiagonal <= settings.concentrationDistanceRatio));
  }

  function within(value, limit) {
    return value <= limit + 1e-12 * Math.max(1, Math.abs(limit));
  }

  function classifyConvergence(levels, stopReason, suppliedSettings, modelDiagonal) {
    var settings = createConvergenceSettings(suppliedSettings);
    var result = { status: 'unconverged', globalConverged: false, stressStable: false,
      likelyStressSingularity: false, warning: null, changes: null, stopReason: stopReason || 'level-limit' };
    if (stopReason === 'failed') { result.status = 'failed'; return result; }
    if (stopReason === 'resource-limit' || stopReason === 'high-memory-confirmation') {
      result.status = 'indeterminate-resource-limit'; return result;
    }
    if (!Array.isArray(levels) || levels.length < 2) { return result; }
    var previous = levels[levels.length - 2];
    var current = levels[levels.length - 1];
    result.changes = {
      maximumDisplacement: convergenceRelativeChange(current.maximumDisplacementM, previous.maximumDisplacementM),
      strainEnergy: convergenceRelativeChange(current.strainEnergyJ, previous.strainEnergyJ),
      rawVonMisesMax: convergenceRelativeChange(current.rawVonMisesMaxPa, previous.rawVonMisesMaxPa)
    };
    result.globalConverged = within(result.changes.maximumDisplacement, settings.displacementTolerance) &&
      within(result.changes.strainEnergy, settings.strainEnergyTolerance);
    result.stressStable = within(result.changes.rawVonMisesMax, settings.stressTolerance);
    if (result.globalConverged && result.stressStable) { result.status = 'converged'; }
    else if (result.globalConverged) {
      result.status = 'converged-stress-unresolved';
      result.likelyStressSingularity = current.rawVonMisesMaxPa > previous.rawVonMisesMaxPa * (1 + settings.stressTolerance) &&
        peakConcentrated(previous, current, modelDiagonal, settings);
      if (result.likelyStressSingularity) { result.warning = SINGULARITY_WARNING; }
    }
    return result;
  }

  function convergenceLevelSummary(index, targetSizeM, mesh, preflight, result) {
    return Object.freeze({ level: index + 1, targetSizeM: targetSizeM,
      nodeCount: mesh.statistics.nodeCount, elementCount: mesh.statistics.elementCount,
      degreeOfFreedomCount: preflight.degreeOfFreedomCount,
      maximumDisplacementM: result.extrema.maxDisplacement.valueM,
      strainEnergyJ: result.solverStatistics.strainEnergyJ,
      rawVonMisesMaxPa: result.extrema.rawVonMisesMax.valuePa,
      minimumFactorOfSafety: result.factorOfSafety ? result.factorOfSafety.rawMinimum.value : null,
      iterations: result.solverStatistics.iterations, solveDurationMs: result.solverStatistics.solveDurationMs,
      estimatedPeakBytes: preflight.estimatedPeakBytes,
      peakLocationM: result.extrema.rawVonMisesMax.locationM,
      peakFaceId: result.extrema.rawVonMisesMax.faceId || null });
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.CONVERGENCE_SINGULARITY_WARNING = SINGULARITY_WARNING;
  root.SpjutsimFEA.createConvergenceSettings = createConvergenceSettings;
  root.SpjutsimFEA.convergenceRelativeChange = convergenceRelativeChange;
  root.SpjutsimFEA.classifyConvergence = classifyConvergence;
  root.SpjutsimFEA.convergenceLevelSummary = convergenceLevelSummary;
}(globalThis));
