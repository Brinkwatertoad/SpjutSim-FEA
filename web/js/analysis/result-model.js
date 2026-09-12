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

  function finiteLocation(location) {
    return Array.isArray(location) && location.length === 3 && location.every(Number.isFinite);
  }

  function nodeLocationMatches(location, node, positions) {
    return finiteLocation(location) && [0, 1, 2].every(function (axis) {
      return Math.fround(location[axis]) === positions[node * 3 + axis];
    });
  }

  function validateRangeMetadata(result) {
    var fieldNames = ['vonMisesPa', 'maxPrincipalPa', 'minPrincipalPa', 'displacementMagnitudeM', 'uxM', 'uyM', 'uzM'];
    var rangeNames = ['vonMises', 'maxPrincipal', 'minPrincipal', 'displacementMagnitude', 'ux', 'uy', 'uz'];
    var boundary = result.originalSurface.triangleConnectivity;
    var positions = result.originalSurface.nodePositionsM;
    var minima = [Infinity, Infinity, Infinity, Infinity, Infinity, Infinity, Infinity];
    var maxima = [-Infinity, -Infinity, -Infinity, -Infinity, -Infinity, -Infinity, -Infinity];
    var minNodes = [-1, -1, -1, -1, -1, -1, -1];
    var maxNodes = [-1, -1, -1, -1, -1, -1, -1];
    // Reuse one boundary traversal for all fields, with constant-size extrema storage.
    for (var index = 0; index < boundary.length; index += 1) {
      var node = boundary[index];
      for (var field = 0; field < fieldNames.length; field += 1) {
        var value = result.surfaceFields[fieldNames[field]][node];
        if (value < minima[field]) { minima[field] = value; minNodes[field] = node; }
        if (value > maxima[field]) { maxima[field] = value; maxNodes[field] = node; }
      }
    }
    for (var fieldIndex = 0; fieldIndex < fieldNames.length; fieldIndex += 1) {
      var range = result.ranges[rangeNames[fieldIndex]];
      if (!range || range.locationOwner !== 'surface-node' || range.minimum !== minima[fieldIndex] ||
          range.maximum !== maxima[fieldIndex] || range.minimumNodeIndex !== minNodes[fieldIndex] ||
          range.maximumNodeIndex !== maxNodes[fieldIndex] ||
          !nodeLocationMatches(range.minimumLocationM, range.minimumNodeIndex, positions) ||
          !nodeLocationMatches(range.maximumLocationM, range.maximumNodeIndex, positions)) { return false; }
    }
    var peak = result.extrema.displayedVonMisesMax;
    return peak && peak.locationOwner === 'surface-node' && peak.valuePa === maxima[0] &&
      peak.nodeIndex === maxNodes[0] && nodeLocationMatches(peak.locationM, peak.nodeIndex, positions);
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
    if (!result || result.schemaVersion !== 2 || result.rangeMetadataVersion !== 1 || !result.ranges || result.analysisRevision !== expectedRevision ||
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
    if (!Number.isInteger(elementCount) || elementCount <= 0 ||
        !validFiniteArray(surface.nodePositionsM, Float32Array, nodeCount * 3)) {
      return { valid: false, reason: 'invalid-result-mesh' };
    }
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
    var rawMaxima = { rawVonMisesMax: -Infinity, rawMaxPrincipal: -Infinity, rawMinPrincipal: Infinity };
    for (index = 0; index < sampleCount; index += 1) {
      if (result.recoverySampleFields.elementIndices[index] !== Math.floor(index / (result.elementType === 'tet10' ? 4 : 1))) {
        return { valid: false, reason: 'recovery-sample-element-out-of-range' };
      }
      if (result.recoverySampleFields.vonMisesPa[index] < 0) { return { valid: false, reason: 'invalid-von-mises-stress' }; }
      rawMaxima.rawVonMisesMax = Math.max(rawMaxima.rawVonMisesMax, result.recoverySampleFields.vonMisesPa[index]);
      rawMaxima.rawMaxPrincipal = Math.max(rawMaxima.rawMaxPrincipal, result.recoverySampleFields.maxPrincipalPa[index]);
      rawMaxima.rawMinPrincipal = Math.min(rawMaxima.rawMinPrincipal, result.recoverySampleFields.minPrincipalPa[index]);
    }
    if (!Number.isFinite(result.equilibrium.relativeResidual) || result.equilibrium.relativeResidual < 0 ||
        !Number.isFinite(result.solverStatistics.finalRelativeResidual) || result.solverStatistics.finalRelativeResidual < 0) {
      return { valid: false, reason: 'invalid-result-diagnostics' };
    }
    var rawFields = { rawVonMisesMax: 'vonMisesPa', rawMaxPrincipal: 'maxPrincipalPa', rawMinPrincipal: 'minPrincipalPa' };
    var peakNames = Object.keys(rawFields);
    for (index = 0; index < peakNames.length; index += 1) {
      var peakName = peakNames[index];
      var peak = result.extrema[peakName];
      if (!peak || peak.locationOwner !== 'solver-sample' || peak.isInterior !== true ||
          !Number.isInteger(peak.sampleIndex) || peak.sampleIndex < 0 || peak.sampleIndex >= sampleCount ||
          peak.elementIndex !== result.recoverySampleFields.elementIndices[peak.sampleIndex] ||
          peak.valuePa !== result.recoverySampleFields[rawFields[peakName]][peak.sampleIndex] ||
          peak.valuePa !== rawMaxima[peakName] || !finiteLocation(peak.locationM)) {
        return { valid: false, reason: 'invalid-result-extrema' };
      }
    }
    var rawPeak = result.extrema.rawVonMisesMax;
    if (rawPeak.faceId !== rawPeak.nearbyBoundaryFaceId ||
        (rawPeak.nearbyBoundaryFaceId !== null && surface.faceIds.indexOf(rawPeak.nearbyBoundaryFaceId) < 0)) {
      return { valid: false, reason: 'invalid-peak-nearby-face' };
    }
    var displacementPeak = result.extrema.maxDisplacement;
    var maximumDisplacement = -Infinity;
    for (index = 0; index < nodeCount; index += 1) { maximumDisplacement = Math.max(maximumDisplacement, result.displacementMagnitudeM[index]); }
    if (!displacementPeak || displacementPeak.locationOwner !== 'volume-node' ||
        !Number.isInteger(displacementPeak.nodeIndex) || displacementPeak.nodeIndex < 0 || displacementPeak.nodeIndex >= nodeCount ||
        displacementPeak.valueM !== result.displacementMagnitudeM[displacementPeak.nodeIndex] ||
        displacementPeak.valueM !== maximumDisplacement ||
        !nodeLocationMatches(displacementPeak.locationM, displacementPeak.nodeIndex, surface.nodePositionsM)) {
      return { valid: false, reason: 'invalid-displacement-extremum' };
    }
    if (!validateRangeMetadata(result)) { return { valid: false, reason: 'invalid-surface-range-metadata' }; }
    return { valid: true };
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  // Display scaling is distinct from the measured boundary-only ranges.
  root.SpjutsimFEA.getResultDisplayRange = function (result, field) {
    return field === 'vonMises' ? { minimum: 0, maximum: result.extrema.rawVonMisesMax.valuePa } : result.ranges[field];
  };
  root.SpjutsimFEA.validatePreflightResult = validatePreflightResult;
  root.SpjutsimFEA.validateResultModel = validateResultModel;
}(globalThis));
