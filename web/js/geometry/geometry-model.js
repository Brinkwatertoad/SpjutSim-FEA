(function (root) {
  'use strict';

  /** @typedef {string} FaceId */

  /**
   * @typedef {Object} BoundingBoxM
   * @property {[number, number, number]} minM
   * @property {[number, number, number]} maxM
   */

  /**
   * @typedef {Object} PreviewFaceRange
   * @property {FaceId} faceId
   * @property {number} start Index offset in `indices`.
   * @property {number} count Number of triangle indices.
   */

  /**
   * @typedef {Object} SurfaceMesh
   * @property {Float64Array} positionsM
   * @property {Uint32Array} indices
   * @property {PreviewFaceRange[]} faceRanges
   */

  /**
   * @typedef {Object} GeometryModel
   * @property {string} geometryId
   * @property {string} sourceName
   * @property {'step'} sourceFormat
   * @property {FaceId[]} faceIds
   * @property {BoundingBoxM} boundingBoxM
   * @property {number=} volumeM3
   * @property {SurfaceMesh} preview
   */

  function validFiniteVector(value) {
    return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
  }

  function validation(valid, reason) {
    return { valid: valid, reason: reason || null };
  }

  function isStepFilename(name) {
    return typeof name === 'string' && /\.(step|stp)$/i.test(name.trim());
  }

  function validateImportRequest(request) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return validation(false, 'invalid-request');
    }
    if (!isStepFilename(request.sourceName)) {
      return validation(false, 'unsupported-extension');
    }
    if (!(request.stepBytes instanceof ArrayBuffer) || request.stepBytes.byteLength === 0) {
      return validation(false, 'invalid-step-bytes');
    }
    if (request.geometryId !== undefined && (typeof request.geometryId !== 'string' || request.geometryId.length === 0)) {
      return validation(false, 'invalid-geometry-id');
    }
    return validation(true);
  }

  function validateBoundingBoxM(boundingBoxM) {
    if (!boundingBoxM || typeof boundingBoxM !== 'object' ||
        !validFiniteVector(boundingBoxM.minM) || !validFiniteVector(boundingBoxM.maxM)) {
      return validation(false, 'invalid-bounding-box');
    }
    for (var axis = 0; axis < 3; axis += 1) {
      if (boundingBoxM.minM[axis] >= boundingBoxM.maxM[axis]) {
        return validation(false, 'degenerate-bounding-box');
      }
    }
    return validation(true);
  }

  function validatePreview(preview, faceIds) {
    var index;
    var previousEnd = 0;
    var vertexCount;
    if (!preview || typeof preview !== 'object' ||
        !(preview.positionsM instanceof Float64Array) ||
        !(preview.indices instanceof Uint32Array) || !Array.isArray(preview.faceRanges)) {
      return validation(false, 'invalid-preview-buffers');
    }
    if (preview.positionsM.length === 0 || preview.positionsM.length % 3 !== 0 ||
        preview.indices.length === 0 || preview.indices.length % 3 !== 0) {
      return validation(false, 'inconsistent-preview-length');
    }
    vertexCount = preview.positionsM.length / 3;
    for (index = 0; index < preview.positionsM.length; index += 1) {
      if (!Number.isFinite(preview.positionsM[index])) {
        return validation(false, 'non-finite-preview-position');
      }
    }
    for (index = 0; index < preview.indices.length; index += 1) {
      if (preview.indices[index] >= vertexCount) {
        return validation(false, 'preview-index-out-of-range');
      }
    }
    if (preview.faceRanges.length !== faceIds.length) {
      return validation(false, 'face-range-count-mismatch');
    }
    for (index = 0; index < preview.faceRanges.length; index += 1) {
      var range = preview.faceRanges[index];
      if (!range || typeof range.faceId !== 'string' || faceIds.indexOf(range.faceId) === -1 ||
          !Number.isInteger(range.start) || !Number.isInteger(range.count) ||
          range.start !== previousEnd || range.count <= 0 || range.count % 3 !== 0 ||
          range.start + range.count > preview.indices.length) {
        return validation(false, 'invalid-face-range');
      }
      previousEnd = range.start + range.count;
    }
    return previousEnd === preview.indices.length ? validation(true) : validation(false, 'incomplete-face-ranges');
  }

  function validateGeometryModel(model) {
    var boundingBox;
    var preview;
    if (!model || typeof model !== 'object' || Array.isArray(model) ||
        typeof model.geometryId !== 'string' || model.geometryId.length === 0 ||
        typeof model.sourceName !== 'string' || !isStepFilename(model.sourceName) ||
        model.sourceFormat !== 'step' || !Array.isArray(model.faceIds) || model.faceIds.length === 0 ||
        model.faceIds.some(function (faceId) { return typeof faceId !== 'string' || faceId.length === 0; }) ||
        new Set(model.faceIds).size !== model.faceIds.length) {
      return validation(false, 'invalid-geometry-model');
    }
    boundingBox = validateBoundingBoxM(model.boundingBoxM);
    if (!boundingBox.valid) { return boundingBox; }
    if (model.volumeM3 !== undefined && (!Number.isFinite(model.volumeM3) || model.volumeM3 <= 0)) {
      return validation(false, 'invalid-volume');
    }
    preview = validatePreview(model.preview, model.faceIds);
    return preview.valid ? validation(true) : preview;
  }

  function createGeometryId() {
    return 'geometry-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.isStepFilename = isStepFilename;
  root.SpjutsimFEA.validateImportRequest = validateImportRequest;
  root.SpjutsimFEA.validateBoundingBoxM = validateBoundingBoxM;
  root.SpjutsimFEA.validatePreview = validatePreview;
  root.SpjutsimFEA.validateGeometryModel = validateGeometryModel;
  root.SpjutsimFEA.createGeometryId = createGeometryId;
}(globalThis));
