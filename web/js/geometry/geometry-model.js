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
   * @typedef {Object} PolylineMesh
   * @property {Float64Array} positionsM
   * @property {Uint32Array} indices Line-segment endpoint indices.
   */

  /**
   * @typedef {Object} SurfaceMesh
   * @property {Float64Array} positionsM
   * @property {Float32Array} normals Renderer-ready, per-face smooth normals.
   * @property {Uint32Array} indices
   * @property {PreviewFaceRange[]} faceRanges
   * @property {PolylineMesh} featureEdges Actual CAD feature-edge polylines.
   */

  /**
   * @typedef {Object} GeometryModel
   * @property {string} geometryId
   * @property {string} sourceName
   * @property {'step'|'iges'|'brep'} sourceFormat
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

  var SUPPORTED_CAD_FORMATS = Object.freeze({
    step: Object.freeze({ format: 'step', extensions: Object.freeze(['step', 'stp']), label: 'STEP' }),
    iges: Object.freeze({ format: 'iges', extensions: Object.freeze(['iges', 'igs']), label: 'IGES' }),
    brep: Object.freeze({ format: 'brep', extensions: Object.freeze(['brep']), label: 'OpenCASCADE BREP' })
  });

  function sourceFormatForFilename(name) {
    var match;
    var extension;
    var format;
    if (typeof name !== 'string') { return null; }
    match = name.trim().match(/\.([^.]+)$/);
    if (!match) { return null; }
    extension = match[1].toLowerCase();
    format = Object.keys(SUPPORTED_CAD_FORMATS).find(function (candidate) {
      return SUPPORTED_CAD_FORMATS[candidate].extensions.indexOf(extension) !== -1;
    });
    return format || null;
  }

  function validateImportRequest(request) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return validation(false, 'invalid-request');
    }
    if (!sourceFormatForFilename(request.sourceName)) {
      return validation(false, 'unsupported-extension');
    }
    if (!SUPPORTED_CAD_FORMATS[request.sourceFormat] || sourceFormatForFilename(request.sourceName) !== request.sourceFormat) {
      return validation(false, 'source-format-mismatch');
    }
    if (!(request.sourceBytes instanceof ArrayBuffer) || request.sourceBytes.byteLength === 0) {
      return validation(false, 'invalid-source-bytes');
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
    var previewVertexCount;
    var featureEdgeVertexCount;
    var rangedFaceIds = new Set();
    if (!preview || typeof preview !== 'object' ||
        !(preview.positionsM instanceof Float64Array) || !(preview.normals instanceof Float32Array) ||
        !(preview.indices instanceof Uint32Array) || !Array.isArray(preview.faceRanges)) {
      return validation(false, 'invalid-preview-buffers');
    }
    if (preview.positionsM.length === 0 || preview.positionsM.length % 3 !== 0 ||
        preview.normals.length !== preview.positionsM.length ||
        preview.indices.length === 0 || preview.indices.length % 3 !== 0) {
      return validation(false, 'inconsistent-preview-length');
    }
    previewVertexCount = preview.positionsM.length / 3;
    for (index = 0; index < preview.positionsM.length; index += 1) {
      if (!Number.isFinite(preview.positionsM[index]) || !Number.isFinite(preview.normals[index])) {
        return validation(false, 'non-finite-preview-position');
      }
    }
    if (!preview.featureEdges || !(preview.featureEdges.positionsM instanceof Float64Array) ||
        !(preview.featureEdges.indices instanceof Uint32Array) ||
        preview.featureEdges.positionsM.length % 3 !== 0 || preview.featureEdges.indices.length % 2 !== 0) {
      return validation(false, 'invalid-feature-edge-buffers');
    }
    featureEdgeVertexCount = preview.featureEdges.positionsM.length / 3;
    for (index = 0; index < preview.featureEdges.positionsM.length; index += 1) {
      if (!Number.isFinite(preview.featureEdges.positionsM[index])) { return validation(false, 'non-finite-feature-edge-position'); }
    }
    for (index = 0; index < preview.featureEdges.indices.length; index += 1) {
      if (preview.featureEdges.indices[index] >= featureEdgeVertexCount) { return validation(false, 'feature-edge-index-out-of-range'); }
    }
    for (index = 0; index < preview.indices.length; index += 1) {
      if (preview.indices[index] >= previewVertexCount) {
        return validation(false, 'preview-index-out-of-range');
      }
    }
    if (preview.faceRanges.length !== faceIds.length) {
      return validation(false, 'face-range-count-mismatch');
    }
    for (index = 0; index < preview.faceRanges.length; index += 1) {
      var range = preview.faceRanges[index];
      if (!range || typeof range.faceId !== 'string' || faceIds.indexOf(range.faceId) === -1 ||
          rangedFaceIds.has(range.faceId) ||
          !Number.isInteger(range.start) || !Number.isInteger(range.count) ||
          range.start !== previousEnd || range.count <= 0 || range.count % 3 !== 0 ||
          range.start + range.count > preview.indices.length) {
        return validation(false, 'invalid-face-range');
      }
      rangedFaceIds.add(range.faceId);
      previousEnd = range.start + range.count;
    }
    return previousEnd === preview.indices.length ? validation(true) : validation(false, 'incomplete-face-ranges');
  }

  function validateGeometryModel(model) {
    var boundingBox;
    var preview;
    if (!model || typeof model !== 'object' || Array.isArray(model) ||
        typeof model.geometryId !== 'string' || model.geometryId.length === 0 ||
        typeof model.sourceName !== 'string' || sourceFormatForFilename(model.sourceName) !== model.sourceFormat ||
        !SUPPORTED_CAD_FORMATS[model.sourceFormat] || !Array.isArray(model.faceIds) || model.faceIds.length === 0 ||
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
  root.SpjutsimFEA.SUPPORTED_CAD_FORMATS = SUPPORTED_CAD_FORMATS;
  root.SpjutsimFEA.sourceFormatForFilename = sourceFormatForFilename;
  root.SpjutsimFEA.validateImportRequest = validateImportRequest;
  root.SpjutsimFEA.validateBoundingBoxM = validateBoundingBoxM;
  root.SpjutsimFEA.validatePreview = validatePreview;
  root.SpjutsimFEA.validateGeometryModel = validateGeometryModel;
  root.SpjutsimFEA.createGeometryId = createGeometryId;
}(globalThis));
