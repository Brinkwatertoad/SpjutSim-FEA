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
   * @property {{start: number, count: number, faceIds: FaceId[]}[]=} ranges Contiguous CAD-curve ranges and adjacent faces.
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
   * @property {{rotation: number[], operations: string[]}} orientation
   * @property {FaceId[]} faceIds
   * @property {BoundingBoxM} boundingBoxM
   * @property {number=} volumeM3
   * @property {SurfaceMesh} preview
   */

  function validFiniteVector(value) {
    return Array.isArray(value) && value.length === 3 && !value.includes(undefined) && value.every(Number.isFinite);
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
    // Optional for older preview producers; current CAD imports include ownership.
    if (preview.featureEdges.ranges !== undefined) {
      if (!Array.isArray(preview.featureEdges.ranges)) { return validation(false, 'invalid-feature-edge-ranges'); }
      var edgeEnd = 0, knownFaces = new Set(faceIds);
      for (var edgeRange of preview.featureEdges.ranges) {
        if (!edgeRange || !Number.isSafeInteger(edgeRange.start) || !Number.isSafeInteger(edgeRange.count) ||
            edgeRange.start !== edgeEnd || edgeRange.count <= 0 || edgeRange.count % 2 !== 0 ||
            !Array.isArray(edgeRange.faceIds) || !edgeRange.faceIds.length ||
            new Set(edgeRange.faceIds).size !== edgeRange.faceIds.length ||
            edgeRange.faceIds.some(function (id) { return !knownFaces.has(id); })) {
          return validation(false, 'invalid-feature-edge-range');
        }
        edgeEnd += edgeRange.count;
        if (edgeEnd > preview.featureEdges.indices.length) { return validation(false, 'feature-edge-range-overflow'); }
      }
      if (edgeEnd !== preview.featureEdges.indices.length) { return validation(false, 'incomplete-feature-edge-ranges'); }
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
    var orientation;
    if (!model || typeof model !== 'object' || Array.isArray(model) ||
        typeof model.geometryId !== 'string' || model.geometryId.length === 0 ||
        typeof model.sourceName !== 'string' || sourceFormatForFilename(model.sourceName) !== model.sourceFormat ||
        !SUPPORTED_CAD_FORMATS[model.sourceFormat] || !Array.isArray(model.faceIds) || model.faceIds.length === 0 ||
        model.faceIds.some(function (faceId) { return typeof faceId !== 'string' || faceId.length === 0; }) ||
        new Set(model.faceIds).size !== model.faceIds.length) {
      return validation(false, 'invalid-geometry-model');
    }
    orientation = root.SpjutsimFEA.validateRigidOrientation(model.orientation);
    if (!orientation.valid) { return orientation; }
    boundingBox = validateBoundingBoxM(model.boundingBoxM);
    if (!boundingBox.valid) { return boundingBox; }
    if (model.volumeM3 !== undefined && (!Number.isFinite(model.volumeM3) || model.volumeM3 <= 0)) {
      return validation(false, 'invalid-volume');
    }
    if(model.cylindricalFaces !== undefined){
      if(!model.cylindricalFaces || typeof model.cylindricalFaces!=='object' || Array.isArray(model.cylindricalFaces) || Object.keys(model.cylindricalFaces).some(function(id){
        var c=model.cylindricalFaces[id],vector=function(v){return Array.isArray(v)&&v.length===3&&[0,1,2].every(function(i){return Number.isFinite(v[i]);});};
        return !model.faceIds.includes(id)||!c||c.version!==1||!vector(c.originM)||!vector(c.axis)||!vector(c.radialStart)||Math.abs(Math.hypot.apply(null,c.axis)-1)>1e-10||Math.abs(Math.hypot.apply(null,c.radialStart)-1)>1e-10||Math.abs(c.axis.reduce(function(sum,x,i){return sum+x*c.radialStart[i];},0))>1e-10||!Number.isFinite(c.radiusM)||c.radiusM<=0||!Number.isFinite(c.lengthM)||c.lengthM<=0||!Number.isFinite(c.angularExtentRad)||c.angularExtentRad<=0||c.angularExtentRad>2*Math.PI+1e-8;
      }))return validation(false,'invalid-cylinder-descriptor');
    }
    if (model.planarFaces !== undefined) {
      if (!model.planarFaces || typeof model.planarFaces !== 'object' || Array.isArray(model.planarFaces) ||
          Object.keys(model.planarFaces).some(function(id) {
            var plane=model.planarFaces[id];
            return !model.faceIds.includes(id) || !plane || plane.version!==1 || !validFiniteVector(plane.originM) ||
              !validFiniteVector(plane.normal) || Math.abs(Math.hypot.apply(null,plane.normal)-1)>1e-10;
          })) { return validation(false,'invalid-planar-descriptor'); }
    }
    preview = validatePreview(model.preview, model.faceIds);
    return preview.valid ? validation(true) : preview;
  }

  function modelInformation(state) {
    var geometry = state && state.geometry, density = state && state.material && state.material.densityKgM3;
    var volume = geometry && Number.isFinite(geometry.volumeM3) && geometry.volumeM3 > 0 ? geometry.volumeM3 : null;
    var mass = volume !== null && Number.isFinite(density) && density > 0 ? volume * density : null;
    return {volumeM3: volume, massKg: Number.isFinite(mass) ? mass : null,
      dimensionsM: geometry ? geometry.boundingBoxM.maxM.map(function(value,axis){return value-geometry.boundingBoxM.minM[axis];}) : null};
  }

  function createGeometryId() {
    return 'geometry-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function resolveBearingBand(geometry,faceIds){
    var descriptors=geometry && geometry.cylindricalFaces;
    if(!descriptors || !Array.isArray(faceIds)||!faceIds.length)throw Error('Select a full circular cylindrical band. Partial cylinders, cones and noncircular faces are unsupported.');
    var first=descriptors[faceIds[0]];if(!first)throw Error('Select cylindrical CAD faces for bearing loading.');
    var dot=function(a,b){return a.reduce(function(sum,x,i){return sum+x*b[i];},0);};
    var axis=first.axis,x=first.radialStart,y=[axis[1]*x[2]-axis[2]*x[1],axis[2]*x[0]-axis[0]*x[2],axis[0]*x[1]-axis[1]*x[0]],intervals=[];
    var tolerance=Math.max(first.radiusM,first.lengthM)*1e-8;
    faceIds.forEach(function(id){
      var c=descriptors[id];if(!c)throw Error('Every bearing target must be a supported circular cylindrical face.');
      var aligned=dot(axis,c.axis),delta=c.originM.map(function(v,i){return v-first.originM[i];}),axial=dot(delta,axis);
      var start=aligned>0?axial:axial-c.lengthM;
      if(Math.abs(Math.abs(aligned)-1)>1e-10 || Math.abs(c.radiusM-first.radiusM)>tolerance || Math.abs(c.lengthM-first.lengthM)>tolerance || Math.abs(start)>tolerance || Math.hypot.apply(null,delta.map(function(v,i){return v-axial*axis[i];}))>tolerance)
        throw Error('Bearing faces must be coaxial with the same radius and uniform axial extent.');
      var angle=Math.atan2(dot(c.radialStart,y),dot(c.radialStart,x));if(aligned<0)angle-=c.angularExtentRad;
      angle=((angle%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
      if(Math.abs(c.angularExtentRad-2*Math.PI)<1e-8){intervals.push([0,2*Math.PI]);return;}
      if(Math.abs(angle-2*Math.PI)<1e-8)angle=0;
      var end=angle+c.angularExtentRad;
      if(Math.abs(end-2*Math.PI)<1e-8)end=2*Math.PI;
      if(end>2*Math.PI){intervals.push([angle,2*Math.PI]);intervals.push([0,end-2*Math.PI]);}else intervals.push([angle,end]);
    });
    intervals.sort(function(a,b){return a[0]-b[0];});var covered=0;
    intervals.forEach(function(interval){if(Math.abs(interval[0]-covered)>1e-8)throw Error('Select the full circular bearing band, without gaps or overlapping faces.');covered=interval[1];});
    if(Math.abs(covered-2*Math.PI)>1e-8)throw Error('Select a full 360° bearing band. Partial cylindrical selections are unsupported.');
    var rotation=geometry.orientation.rotation;
    return {version:1,axis:root.SpjutsimFEA.transformVector3(rotation,axis),centerM:root.SpjutsimFEA.transformVector3(rotation,first.originM.map(function(v,i){return v+axis[i]*first.lengthM/2;})),radiusM:first.radiusM,lengthM:first.lengthM};
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.resolveBearingBand=resolveBearingBand;
  root.SpjutsimFEA.SUPPORTED_CAD_FORMATS = SUPPORTED_CAD_FORMATS;
  root.SpjutsimFEA.sourceFormatForFilename = sourceFormatForFilename;
  root.SpjutsimFEA.validateImportRequest = validateImportRequest;
  root.SpjutsimFEA.validateBoundingBoxM = validateBoundingBoxM;
  root.SpjutsimFEA.validatePreview = validatePreview;
  root.SpjutsimFEA.validateGeometryModel = validateGeometryModel;
  root.SpjutsimFEA.createGeometryId = createGeometryId;
  root.SpjutsimFEA.modelInformation = modelInformation;
}(globalThis));
