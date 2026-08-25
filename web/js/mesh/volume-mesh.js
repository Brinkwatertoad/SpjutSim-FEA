(function (root) {
  'use strict';

  /** @typedef {'coarse'|'normal'|'fine'|'custom'} MeshPreset */
  /** @typedef {{preset: MeshPreset, elementType: 'tet4', minSizeM?: number, maxSizeM?: number}} MeshSettings */
  /** @typedef {{faceId: string, start: number, count: number}} BoundaryFaceRange */
  /** @typedef {{triangleConnectivity: Uint32Array, faceRanges: BoundaryFaceRange[]}} BoundaryFaces */
  /** @typedef {Object} VolumeMeshResult
   * @property {'tet4'} elementType
   * @property {Float64Array} nodePositionsM
   * @property {Uint32Array} elementConnectivity
   * @property {BoundaryFaces} boundaryFaces
   * @property {Object<string, BoundaryFaceRange>} geometryFaceMap
   * @property {Object} statistics
   * @property {Object} quality
   * @property {Object} memoryInputs
   */

  var PRESET_DIVISORS = { coarse: 15, normal: 30, fine: 60 };

  function validation(valid, reason) { return { valid: valid, reason: reason || null }; }

  function boundingBoxDiagonalM(boundingBoxM) {
    var boxValidation = root.SpjutsimFEA.validateBoundingBoxM(boundingBoxM);
    var dx;
    var dy;
    var dz;
    if (!boxValidation.valid) { return NaN; }
    dx = boundingBoxM.maxM[0] - boundingBoxM.minM[0];
    dy = boundingBoxM.maxM[1] - boundingBoxM.minM[1];
    dz = boundingBoxM.maxM[2] - boundingBoxM.minM[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  function validateMeshSettings(settings, boundingBoxM) {
    var diagonal = boundingBoxDiagonalM(boundingBoxM);
    if (!settings || typeof settings !== 'object' || Array.isArray(settings) ||
        (settings.preset !== 'coarse' && settings.preset !== 'normal' && settings.preset !== 'fine' && settings.preset !== 'custom') ||
        settings.elementType !== 'tet4') {
      return validation(false, 'invalid-mesh-settings');
    }
    if (!Number.isFinite(diagonal) || diagonal <= 0) { return validation(false, 'invalid-bounding-box'); }
    if (settings.preset === 'custom') {
      if (!Number.isFinite(settings.minSizeM) || !Number.isFinite(settings.maxSizeM) ||
          settings.minSizeM <= 0 || settings.maxSizeM <= 0 || settings.minSizeM > settings.maxSizeM) {
        return validation(false, 'invalid-custom-size-range');
      }
    }
    return validation(true);
  }

  function resolveMeshSettings(settings, boundingBoxM) {
    var valid = validateMeshSettings(settings, boundingBoxM);
    var maxSizeM;
    if (!valid.valid) { throw new Error('Invalid mesh settings: ' + valid.reason); }
    if (settings.preset === 'custom') {
      return {
        preset: 'custom', elementType: 'tet4', minSizeM: settings.minSizeM, maxSizeM: settings.maxSizeM
      };
    }
    maxSizeM = boundingBoxDiagonalM(boundingBoxM) / PRESET_DIVISORS[settings.preset];
    return {
      preset: settings.preset, elementType: 'tet4', minSizeM: maxSizeM / 4, maxSizeM: maxSizeM
    };
  }

  function validRange(range, faceIds, previousEnd, totalLength) {
    return Boolean(range && typeof range === 'object' && typeof range.faceId === 'string' &&
      faceIds.indexOf(range.faceId) !== -1 && Number.isInteger(range.start) && Number.isInteger(range.count) &&
      range.start === previousEnd && range.count > 0 && range.count % 3 === 0 && range.start + range.count <= totalLength);
  }

  function validateVolumeMeshResult(result, expectedFaceIds) {
    var nodeCount;
    var index;
    var previousEnd = 0;
    var ranges;
    var boundary;
    var range;
    var mapRange;
    if (!result || typeof result !== 'object' || Array.isArray(result) || result.elementType !== 'tet4' ||
        !(result.nodePositionsM instanceof Float64Array) || !(result.elementConnectivity instanceof Uint32Array) ||
        !result.boundaryFaces || typeof result.boundaryFaces !== 'object' ||
        !(result.boundaryFaces.triangleConnectivity instanceof Uint32Array) || !Array.isArray(result.boundaryFaces.faceRanges) ||
        !result.geometryFaceMap || typeof result.geometryFaceMap !== 'object' || Array.isArray(result.geometryFaceMap) ||
        !result.statistics || !result.quality || !result.memoryInputs) {
      return validation(false, 'invalid-volume-mesh-shape');
    }
    if (result.nodePositionsM.length === 0 || result.nodePositionsM.length % 3 !== 0 ||
        result.elementConnectivity.length === 0 || result.elementConnectivity.length % 4 !== 0 ||
        result.boundaryFaces.triangleConnectivity.length === 0 || result.boundaryFaces.triangleConnectivity.length % 3 !== 0) {
      return validation(false, 'inconsistent-volume-mesh-length');
    }
    nodeCount = result.nodePositionsM.length / 3;
    for (index = 0; index < result.nodePositionsM.length; index += 1) {
      if (!Number.isFinite(result.nodePositionsM[index])) { return validation(false, 'non-finite-node-position'); }
    }
    for (index = 0; index < result.elementConnectivity.length; index += 1) {
      if (result.elementConnectivity[index] >= nodeCount) { return validation(false, 'element-index-out-of-range'); }
    }
    boundary = result.boundaryFaces.triangleConnectivity;
    for (index = 0; index < boundary.length; index += 1) {
      if (boundary[index] >= nodeCount) { return validation(false, 'boundary-index-out-of-range'); }
    }
    ranges = result.boundaryFaces.faceRanges;
    if (!Array.isArray(expectedFaceIds) || ranges.length !== expectedFaceIds.length) { return validation(false, 'boundary-face-count-mismatch'); }
    for (index = 0; index < ranges.length; index += 1) {
      range = ranges[index];
      if (!validRange(range, expectedFaceIds, previousEnd, boundary.length) ||
          ranges.slice(0, index).some(function (previous) { return previous.faceId === range.faceId; })) {
        return validation(false, 'invalid-boundary-face-range');
      }
      mapRange = result.geometryFaceMap[range.faceId];
      if (!mapRange || mapRange.start !== range.start || mapRange.count !== range.count || mapRange.faceId !== range.faceId) {
        return validation(false, 'incomplete-geometry-face-map');
      }
      previousEnd = range.start + range.count;
    }
    if (previousEnd !== boundary.length || Object.keys(result.geometryFaceMap).length !== ranges.length) {
      return validation(false, 'incomplete-boundary-mapping');
    }
    if (result.statistics.nodeCount !== nodeCount || result.statistics.elementCount !== result.elementConnectivity.length / 4 ||
        result.statistics.boundaryTriangleCount !== boundary.length / 3 ||
        !Number.isFinite(result.statistics.minCharacteristicSizeM) || !Number.isFinite(result.statistics.maxCharacteristicSizeM) ||
        result.statistics.minCharacteristicSizeM <= 0 || result.statistics.minCharacteristicSizeM > result.statistics.maxCharacteristicSizeM ||
        result.quality.metric !== 'gamma' || !Number.isFinite(result.quality.minimum) ||
        !Number.isInteger(result.quality.invertedElementCount) || !Number.isInteger(result.quality.nearZeroJacobianCount) ||
        result.quality.invertedElementCount < 0 || result.quality.nearZeroJacobianCount < 0 ||
        result.memoryInputs.nodeCount !== nodeCount || result.memoryInputs.elementCount !== result.elementConnectivity.length / 4) {
      return validation(false, 'invalid-volume-mesh-metadata');
    }
    return validation(true);
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.boundingBoxDiagonalM = boundingBoxDiagonalM;
  root.SpjutsimFEA.validateMeshSettings = validateMeshSettings;
  root.SpjutsimFEA.resolveMeshSettings = resolveMeshSettings;
  root.SpjutsimFEA.validateVolumeMeshResult = validateVolumeMeshResult;
}(globalThis));
