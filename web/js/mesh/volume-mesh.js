(function (root) {
  'use strict';

  /** @typedef {'coarse'|'normal'|'fine'|'custom'} MeshPreset */
  /** @typedef {'tet4'|'tet10'} MeshElementType */
  /** @typedef {{preset: MeshPreset, elementType: MeshElementType, minSizeM?: number, maxSizeM?: number}} MeshSettings */
  /** @typedef {{faceId: string, start: number, count: number}} BoundaryFaceRange */
  /** @typedef {{solverElementType: 'tri3'|'tri6', solverConnectivity: Uint32Array, solverFaceRanges: BoundaryFaceRange[], triangleConnectivity: Uint32Array, faceRanges: BoundaryFaceRange[]}} BoundaryFaces */
  /** @typedef {Object} VolumeMeshResult
   * @property {MeshElementType} elementType
   * @property {Float64Array} nodePositionsM
   * @property {Uint32Array} elementConnectivity
   * @property {BoundaryFaces} boundaryFaces
   * @property {Object<string, BoundaryFaceRange>} geometryFaceMap
   * @property {Object} statistics
   * @property {Object} quality
   * @property {Object} memoryInputs
   */

  var PRESET_DIVISORS = { coarse: 15, normal: 30, fine: 60 };
  var ELEMENT_DESCRIPTORS = Object.freeze({
    tet4: Object.freeze({ elementType: 'tet4', volumeNodes: 4, solverFaceType: 'tri3', solverFaceNodes: 3 }),
    tet10: Object.freeze({ elementType: 'tet10', volumeNodes: 10, solverFaceType: 'tri6', solverFaceNodes: 6 })
  });

  function validation(valid, reason) { return { valid: valid, reason: reason || null }; }

  function meshElementDescriptor(elementType) {
    return ELEMENT_DESCRIPTORS[elementType] || null;
  }

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
        !meshElementDescriptor(settings.elementType)) {
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
        preset: 'custom', elementType: settings.elementType, minSizeM: settings.minSizeM, maxSizeM: settings.maxSizeM
      };
    }
    maxSizeM = boundingBoxDiagonalM(boundingBoxM) / PRESET_DIVISORS[settings.preset];
    return {
      preset: settings.preset, elementType: settings.elementType, minSizeM: maxSizeM / 4, maxSizeM: maxSizeM
    };
  }

  function validRange(range, faceIds, previousEnd, totalLength, arity) {
    return Boolean(range && typeof range === 'object' && typeof range.faceId === 'string' &&
      faceIds.indexOf(range.faceId) !== -1 && Number.isInteger(range.start) && Number.isInteger(range.count) &&
      range.start === previousEnd && range.count > 0 && range.count % arity === 0 && range.start + range.count <= totalLength);
  }

  function validFaceRanges(ranges, faceIds, connectivityLength, arity) {
    var previousEnd = 0;
    var index;
    if (!Array.isArray(ranges) || ranges.length !== faceIds.length) { return false; }
    for (index = 0; index < ranges.length; index += 1) {
      if (!validRange(ranges[index], faceIds, previousEnd, connectivityLength, arity) ||
          ranges.slice(0, index).some(function (previous) { return previous.faceId === ranges[index].faceId; })) {
        return false;
      }
      previousEnd = ranges[index].start + ranges[index].count;
    }
    return previousEnd === connectivityLength;
  }

  function validateVolumeMeshResult(result, expectedFaceIds) {
    var nodeCount;
    var index;
    var ranges;
    var boundary;
    var solverBoundary;
    var solverRanges;
    var range;
    var mapRange;
    var descriptor = result && meshElementDescriptor(result.elementType);
    if (!result || typeof result !== 'object' || Array.isArray(result) || !descriptor ||
        !(result.nodePositionsM instanceof Float64Array) || !(result.elementConnectivity instanceof Uint32Array) ||
        !result.boundaryFaces || typeof result.boundaryFaces !== 'object' ||
        result.boundaryFaces.solverElementType !== descriptor.solverFaceType ||
        !(result.boundaryFaces.solverConnectivity instanceof Uint32Array) || !Array.isArray(result.boundaryFaces.solverFaceRanges) ||
        !(result.boundaryFaces.triangleConnectivity instanceof Uint32Array) || !Array.isArray(result.boundaryFaces.faceRanges) ||
        !result.geometryFaceMap || typeof result.geometryFaceMap !== 'object' || Array.isArray(result.geometryFaceMap) ||
        !result.statistics || !result.quality || !result.memoryInputs) {
      return validation(false, 'invalid-volume-mesh-shape');
    }
    if (result.nodePositionsM.length === 0 || result.nodePositionsM.length % 3 !== 0 ||
        result.elementConnectivity.length === 0 || result.elementConnectivity.length % descriptor.volumeNodes !== 0 ||
        result.boundaryFaces.solverConnectivity.length === 0 || result.boundaryFaces.solverConnectivity.length % descriptor.solverFaceNodes !== 0 ||
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
    solverBoundary = result.boundaryFaces.solverConnectivity;
    for (index = 0; index < solverBoundary.length; index += 1) {
      if (solverBoundary[index] >= nodeCount) { return validation(false, 'solver-boundary-index-out-of-range'); }
    }
    boundary = result.boundaryFaces.triangleConnectivity;
    for (index = 0; index < boundary.length; index += 1) {
      if (boundary[index] >= nodeCount) { return validation(false, 'boundary-index-out-of-range'); }
    }
    ranges = result.boundaryFaces.faceRanges;
    solverRanges = result.boundaryFaces.solverFaceRanges;
    if (!Array.isArray(expectedFaceIds) ||
        !validFaceRanges(ranges, expectedFaceIds, boundary.length, 3) ||
        !validFaceRanges(solverRanges, expectedFaceIds, solverBoundary.length, descriptor.solverFaceNodes)) {
      return validation(false, 'invalid-boundary-face-range');
    }
    for (index = 0; index < ranges.length; index += 1) {
      range = ranges[index];
      mapRange = result.geometryFaceMap[range.faceId];
      if (!mapRange || mapRange.start !== range.start || mapRange.count !== range.count || mapRange.faceId !== range.faceId) {
        return validation(false, 'incomplete-geometry-face-map');
      }
    }
    if (Object.keys(result.geometryFaceMap).length !== ranges.length) {
      return validation(false, 'incomplete-boundary-mapping');
    }
    if (result.statistics.nodeCount !== nodeCount || result.statistics.elementCount !== result.elementConnectivity.length / descriptor.volumeNodes ||
        result.statistics.boundaryTriangleCount !== boundary.length / 3 ||
        result.statistics.boundaryElementCount !== solverBoundary.length / descriptor.solverFaceNodes ||
        !Number.isFinite(result.statistics.minCharacteristicSizeM) || !Number.isFinite(result.statistics.maxCharacteristicSizeM) ||
        result.statistics.minCharacteristicSizeM <= 0 || result.statistics.minCharacteristicSizeM > result.statistics.maxCharacteristicSizeM ||
        result.quality.metric !== 'gamma' || !Number.isFinite(result.quality.minimum) ||
        !Number.isFinite(result.quality.minimumJacobian) || result.quality.minimumJacobian <= 0 ||
        !Number.isFinite(result.quality.maximumEdgeRatio) || result.quality.maximumEdgeRatio < 1 ||
        !Number.isInteger(result.quality.invertedElementCount) || !Number.isInteger(result.quality.nearZeroJacobianCount) ||
        result.quality.invertedElementCount !== 0 || result.quality.nearZeroJacobianCount !== 0 ||
        result.memoryInputs.nodeCount !== nodeCount || result.memoryInputs.elementCount !== result.elementConnectivity.length / descriptor.volumeNodes ||
        result.memoryInputs.connectivityEntries !== result.elementConnectivity.length ||
        result.memoryInputs.boundaryConnectivityEntries !== solverBoundary.length) {
      return validation(false, 'invalid-volume-mesh-metadata');
    }
    return validation(true);
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.meshElementDescriptor = meshElementDescriptor;
  root.SpjutsimFEA.boundingBoxDiagonalM = boundingBoxDiagonalM;
  root.SpjutsimFEA.validateMeshSettings = validateMeshSettings;
  root.SpjutsimFEA.resolveMeshSettings = resolveMeshSettings;
  root.SpjutsimFEA.validateVolumeMeshResult = validateVolumeMeshResult;
}(globalThis));
