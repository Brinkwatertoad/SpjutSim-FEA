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
    if (!result || typeof result !== 'object' || result.modelVersion !== 1 || result.elementType !== 'tet4' ||
        classifications.indexOf(result.classification) < 0 ||
        !Number.isInteger(result.nodeCount) || result.nodeCount <= 0 ||
        !Number.isInteger(result.elementCount) || result.elementCount <= 0 ||
        result.degreeOfFreedomCount !== result.nodeCount * 3 ||
        !Number.isFinite(result.exactNnz) || result.exactNnz <= 0 ||
        !Number.isFinite(result.estimatedPeakBytes) || result.estimatedPeakBytes <= 0 ||
        !Number.isFinite(result.wasmHeapCapBytes) || result.wasmHeapCapBytes <= 0 ||
        typeof result.exceedsWasmCap !== 'boolean' || typeof result.requiresEightGiBConfirmation !== 'boolean' ||
        !Number.isInteger(result.constraintCount) || !Number.isInteger(result.loadCount) || !Array.isArray(result.warnings)) {
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
    if (!result || result.schemaVersion !== 1 || result.analysisRevision !== expectedRevision || result.elementType !== 'tet4' ||
        !result.originalSurface || !result.surfaceFields || !result.rawElementFields || !result.extrema ||
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
    if (!Number.isFinite(result.equilibrium.relativeResidual) || result.equilibrium.relativeResidual < 0 ||
        !Number.isFinite(result.solverStatistics.finalRelativeResidual) || result.solverStatistics.finalRelativeResidual < 0) {
      return { valid: false, reason: 'invalid-result-diagnostics' };
    }
    return { valid: true };
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.validatePreflightResult = validatePreflightResult;
  root.SpjutsimFEA.validateResultModel = validateResultModel;
}(globalThis));
