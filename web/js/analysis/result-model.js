(function (root) {
  'use strict';

  function validFiniteArray(value, Type, length) {
    var index;
    if (!(value instanceof Type) || value.length !== length) { return false; }
    for (index = 0; index < value.length; index += 1) {
      if (!Number.isFinite(value[index])) { return false; }
    }
    return true;
  }

  function validatePreflightResult(result) {
    var classifications = ['likely-safe', 'caution', 'likely-insufficient'];
    if (!result || typeof result !== 'object' || result.modelVersion !== 1 ||
        ['tet4', 'tet10'].indexOf(result.elementType) < 0 ||
        classifications.indexOf(result.classification) < 0 ||
        !Number.isInteger(result.nodeCount) || result.nodeCount <= 0 ||
        !Number.isInteger(result.elementCount) || result.elementCount <= 0 ||
        result.degreeOfFreedomCount !== result.nodeCount * 3 ||
        !Number.isFinite(result.exactNnz) || result.exactNnz <= 0 ||
        !Number.isFinite(result.estimatedPeakBytes) || result.estimatedPeakBytes <= 0 ||
        !Number.isFinite(result.wasmHeapCapBytes) || result.wasmHeapCapBytes <= 0 ||
        typeof result.exceedsWasmCap !== 'boolean' || typeof result.requiresEightGiBConfirmation !== 'boolean' ||
        !Number.isInteger(result.constraintCount) || !Number.isInteger(result.loadCount) || !Array.isArray(result.warnings) ||
        !result.constraintStability || result.constraintStability.basis !== 'mesh' || result.constraintStability.rank !== 6 ||
        result.constraintStability.status !== 'fully-constrained' || !Array.isArray(result.constraintStability.modes) ||
        result.constraintStability.modes.length !== 6) {
      return { valid: false, reason: 'invalid-preflight-result' };
    }
    return { valid: true };
  }

  function validateResultModel(result, expectedRevision) {
    var surface;
    var nodeCount;
    var elementCount;
    var index;
    var requiredSurfaceFields = ['vonMisesPa', 'maxPrincipalPa', 'minPrincipalPa', 'displacementMagnitudeM', 'uxM', 'uyM', 'uzM'];
    var requiredElementFields = { strain: 6, stressPa: 6, vonMisesPa: 1, maxPrincipalPa: 1, minPrincipalPa: 1 };
    if (!result || result.schemaVersion !== 2 || result.analysisRevision !== expectedRevision ||
        ['tet4', 'tet10'].indexOf(result.elementType) < 0 ||
        !result.originalSurface || !result.surfaceFields || !result.rawElementFields || !result.recoverySampleFields || !result.extrema ||
        !result.equilibrium || !result.solverStatistics || !result.meshStatistics || !Array.isArray(result.warnings)) {
      return { valid: false, reason: 'invalid-result-envelope' };
    }
    surface = result.originalSurface;
    if (!(surface.nodePositionsM instanceof Float32Array) || !surface.nodePositionsM.length || surface.nodePositionsM.length % 3 ||
        !(surface.triangleConnectivity instanceof Uint32Array) || !surface.triangleConnectivity.length || surface.triangleConnectivity.length % 3 ||
        !(surface.triangleFaceIndices instanceof Uint32Array) || surface.triangleFaceIndices.length !== surface.triangleConnectivity.length / 3 ||
        !(surface.triangleElementIndices instanceof Uint32Array) || surface.triangleElementIndices.length !== surface.triangleConnectivity.length / 3 ||
        !Array.isArray(surface.faceIds) || !surface.faceIds.length) {
      return { valid: false, reason: 'invalid-result-surface' };
    }
    nodeCount = surface.nodePositionsM.length / 3;
    elementCount = result.meshStatistics.elementCount;
    if (!validFiniteArray(result.displacementM, Float64Array, nodeCount * 3) ||
        !validFiniteArray(result.displacementMagnitudeM, Float64Array, nodeCount) ||
        !validFiniteArray(result.reactionsN, Float64Array, nodeCount * 3)) {
      return { valid: false, reason: 'invalid-result-node-field' };
    }
    for (index = 0; index < surface.triangleConnectivity.length; index += 1) {
      if (surface.triangleConnectivity[index] >= nodeCount) { return { valid: false, reason: 'result-surface-index-out-of-range' }; }
    }
    for (index = 0; index < surface.triangleFaceIndices.length; index += 1) {
      if (surface.triangleFaceIndices[index] >= surface.faceIds.length || surface.triangleElementIndices[index] >= elementCount) {
        return { valid: false, reason: 'result-mapping-index-out-of-range' };
      }
    }
    for (index = 0; index < requiredSurfaceFields.length; index += 1) {
      if (!validFiniteArray(result.surfaceFields[requiredSurfaceFields[index]], Float32Array, nodeCount)) {
        return { valid: false, reason: 'invalid-smoothed-surface-field' };
      }
    }
    for (index = 0; index < Object.keys(requiredElementFields).length; index += 1) {
      var name = Object.keys(requiredElementFields)[index];
      if (!validFiniteArray(result.rawElementFields[name], Float64Array, elementCount * requiredElementFields[name])) {
        return { valid: false, reason: 'invalid-raw-result-field' };
      }
    }
    var sampleCount = result.elementType === 'tet10' ? elementCount * 4 : elementCount;
    if (!validFiniteArray(result.recoverySampleFields.strain, Float64Array, sampleCount * 6) ||
        !validFiniteArray(result.recoverySampleFields.stressPa, Float64Array, sampleCount * 6) ||
        !validFiniteArray(result.recoverySampleFields.vonMisesPa, Float64Array, sampleCount) ||
        !validFiniteArray(result.recoverySampleFields.maxPrincipalPa, Float64Array, sampleCount) ||
        !validFiniteArray(result.recoverySampleFields.minPrincipalPa, Float64Array, sampleCount) ||
        !(result.recoverySampleFields.elementIndices instanceof Uint32Array) ||
        result.recoverySampleFields.elementIndices.length !== sampleCount) {
      return { valid: false, reason: 'invalid-recovery-sample-field' };
    }
    for (index = 0; index < sampleCount; index += 1) {
      if (result.recoverySampleFields.elementIndices[index] >= elementCount) {
        return { valid: false, reason: 'recovery-sample-element-out-of-range' };
      }
    }
    if (!Number.isFinite(result.equilibrium.relativeResidual) || result.equilibrium.relativeResidual < 0 ||
        !Number.isFinite(result.solverStatistics.finalRelativeResidual) || result.solverStatistics.finalRelativeResidual < 0) {
      return { valid: false, reason: 'invalid-result-diagnostics' };
    }
    if (!result.extrema.maxDisplacement || !Number.isFinite(result.extrema.maxDisplacement.valueM) ||
        !Array.isArray(result.extrema.maxDisplacement.locationM) || result.extrema.maxDisplacement.locationM.length !== 3 ||
        !result.extrema.rawVonMisesMax || !Number.isFinite(result.extrema.rawVonMisesMax.valuePa) ||
        !Number.isInteger(result.extrema.rawVonMisesMax.sampleIndex) ||
        result.extrema.rawVonMisesMax.sampleIndex < 0 || result.extrema.rawVonMisesMax.sampleIndex >= sampleCount ||
        !Array.isArray(result.extrema.rawVonMisesMax.locationM) || result.extrema.rawVonMisesMax.locationM.length !== 3) {
      return { valid: false, reason: 'invalid-result-extrema' };
    }
    return { valid: true };
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.validatePreflightResult = validatePreflightResult;
  root.SpjutsimFEA.validateResultModel = validateResultModel;
}(globalThis));
