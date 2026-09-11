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
   * @property {'step'|'iges'|'brep'|'stl'} sourceFormat
   * @property {{rotation: number[], operations: string[]}} orientation
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
    brep: Object.freeze({ format: 'brep', extensions: Object.freeze(['brep']), label: 'OpenCASCADE BREP' }),
    stl: Object.freeze({ format: 'stl', extensions: Object.freeze(['stl']), label: 'STL' })
  });

  function validateStlOptions(options) {
    return Boolean(options && (options.version === 1 || options.version === 2 &&
      (options.surfaceMode === 'original' && options.reconstructionToleranceM === null ||
       options.surfaceMode === 'reconstruct' && Number.isFinite(options.reconstructionToleranceM) && options.reconstructionToleranceM > 0)) && options.normalization === 'none' &&
      ['m','mm','cm','in','ft'].includes(options.lengthUnit) && Number.isFinite(options.patchAngleDegrees) &&
      options.patchAngleDegrees >= 1 && options.patchAngleDegrees <= 179);
  }

  function sameStlOptions(left, right) {
    return validateStlOptions(left) && validateStlOptions(right) &&
      left.version === right.version && left.lengthUnit === right.lengthUnit && left.patchAngleDegrees === right.patchAngleDegrees &&
      (left.version === 1 || left.surfaceMode === right.surfaceMode && left.reconstructionToleranceM === right.reconstructionToleranceM);
  }

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
    if (request.sourceFormat === 'stl' && !validateStlOptions(request.importOptions)) {
      return validation(false, 'invalid-stl-options');
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

  function validateStlSurfaceMetadata(model) {
    var metadata=model.sourceMetadata,options=model.importOptions,original=model.originalPreview||model.preview;
    if (!original || !(original.indices instanceof Uint32Array) || original.indices.length !== metadata.triangleCount*3) { return false; }
    if (options.version===1) { return !model.originalPreview; }
    if (metadata.surfaceMode!==options.surfaceMode) { return false; }
    if (options.surfaceMode==='original') { return metadata.reconstruction===null && !model.originalPreview; }
    var reconstruction=metadata.reconstruction;
    return Boolean(model.originalPreview && validatePreview(original,model.faceIds).valid && reconstruction && reconstruction.version===1 &&
      reconstruction.toleranceM===options.reconstructionToleranceM && Number.isFinite(reconstruction.maximumDeviationM) && reconstruction.maximumDeviationM>=0 &&
      reconstruction.maximumDeviationM<=reconstruction.toleranceM && Array.isArray(reconstruction.surfaces) && reconstruction.surfaces.length===model.faceIds.length &&
      reconstruction.surfaces.every(function(surface,index){return surface && ['plane','cylinder','cone'].includes(surface.kind) && surface.patchIndex===index &&
        Number.isInteger(surface.triangleCount) && surface.triangleCount>0 && Number.isFinite(surface.maximumDeviationM) && surface.maximumDeviationM>=0 && surface.maximumDeviationM<=reconstruction.toleranceM;}) &&
      reconstruction.surfaces.reduce(function(sum,surface){return sum+surface.triangleCount;},0)===metadata.triangleCount);
  }

  function validateGeometryModel(model) {
    var boundingBox;
    var preview;
    var orientation;
    if (!model || typeof model !== 'object' || Array.isArray(model) ||
        typeof model.geometryId !== 'string' || model.geometryId.length === 0 ||
        typeof model.sourceName !== 'string' || sourceFormatForFilename(model.sourceName) !== model.sourceFormat ||
        !SUPPORTED_CAD_FORMATS[model.sourceFormat] || !Array.isArray(model.faceIds) || model.faceIds.length === 0 ||
        model.faceIds.some(function (faceId) { return typeof faceId !== 'string' || faceId.length === 0; }) ||
        new Set(model.faceIds).size !== model.faceIds.length) {
      return validation(false, 'invalid-geometry-model');
    }
    if (model.sourceFormat === 'stl' && (!validateStlOptions(model.importOptions) || model.surfaceKind !== 'stl-patch' ||
        !model.sourceMetadata || model.sourceMetadata.version !== model.importOptions.version || !/^[a-f0-9]{64}$/.test(model.sourceMetadata.sha256) ||
        !Number.isInteger(model.sourceMetadata.triangleCount) || model.sourceMetadata.triangleCount < 1 || model.sourceMetadata.triangleCount > 50000 ||
        !Number.isInteger(model.sourceMetadata.internalSurfaceCount) || model.sourceMetadata.internalSurfaceCount < 1 || model.sourceMetadata.internalSurfaceCount > 512 ||
        !model.sourceMetadata.validation || model.sourceMetadata.validation.status !== 'valid' || model.sourceMetadata.validation.version !== 1 ||
        model.sourceMetadata.validation.triangleCount !== model.sourceMetadata.triangleCount ||
        !Number.isInteger(model.sourceMetadata.validation.intersectionCandidates) || model.sourceMetadata.validation.intersectionCandidates < 0 ||
        model.sourceMetadata.validation.intersectionCandidates > 2000000 || model.faceIds.some(function(id){return !/^stl:[a-f0-9]{64}$/.test(id);}) ||
        !validateStlSurfaceMetadata(model))) {
      return validation(false, 'invalid-stl-source-contract');
    }
    orientation = root.SpjutsimFEA.validateRigidOrientation(model.orientation);
    if (!orientation.valid) { return orientation; }
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
  root.SpjutsimFEA.validateStlOptions = validateStlOptions;
  root.SpjutsimFEA.sameStlOptions = sameStlOptions;
  root.SpjutsimFEA.validateBoundingBoxM = validateBoundingBoxM;
  root.SpjutsimFEA.validatePreview = validatePreview;
  root.SpjutsimFEA.validateGeometryModel = validateGeometryModel;
  root.SpjutsimFEA.createGeometryId = createGeometryId;
}(globalThis));
