'use strict';
var WORKER_PROTOCOL_VERSION = 2;
var gmshPromise = null;
var requestQueue = Promise.resolve();

// Preview tessellation is intentionally independent of analysis mesh presets.
// This maximum surface edge length is a scale-aware, benchmark-adjustable tessellation tolerance.
var PREVIEW_MAX_SURFACE_EDGE_LENGTH_FRACTION = 0.025;
var PREVIEW_CURVATURE_SEGMENTS_PER_2PI = 48;
var PREVIEW_RELATIVE_TRIANGLE_AREA_SQUARED = 1e-28;
var CAD_FORMAT_EXTENSIONS = Object.freeze({ step: /\.(step|stp)$/i, iges: /\.(iges|igs)$/i, brep: /\.brep$/i });

function validCadSource(message) {
  return message && CAD_FORMAT_EXTENSIONS[message.sourceFormat] &&
    typeof message.sourceName === 'string' && CAD_FORMAT_EXTENSIONS[message.sourceFormat].test(message.sourceName) &&
    message.sourceBytes instanceof ArrayBuffer && message.sourceBytes.byteLength > 0;
}

function validOrientation(orientation) {
  var matrix = orientation && orientation.rotation;
  var row;
  var column;
  var dot;
  if (!Array.isArray(matrix) || matrix.length !== 9 || matrix.some(function (value) { return !Number.isFinite(value); })) { return false; }
  for (row = 0; row < 3; row += 1) {
    for (column = 0; column < 3; column += 1) {
      dot = matrix[row * 3] * matrix[column * 3] + matrix[row * 3 + 1] * matrix[column * 3 + 1] + matrix[row * 3 + 2] * matrix[column * 3 + 2];
      if (Math.abs(dot - (row === column ? 1 : 0)) > 1e-10) { return false; }
    }
  }
  return Math.abs(matrix[0] * (matrix[4] * matrix[8] - matrix[5] * matrix[7]) -
    matrix[1] * (matrix[3] * matrix[8] - matrix[5] * matrix[6]) +
    matrix[2] * (matrix[3] * matrix[7] - matrix[4] * matrix[6]) - 1) <= 1e-10;
}

function workerError(code, stage, userMessage, developerMessage, recoverable) {
  return {
    code: code,
    stage: stage,
    userMessage: userMessage,
    developerMessage: developerMessage || null,
    recoverable: recoverable !== false
  };
}

function errorResponse(requestId, error) {
  self.postMessage({
    protocol: WORKER_PROTOCOL_VERSION,
    requestId: typeof requestId === 'string' ? requestId : 'invalid-request',
    type: 'error',
    error: error
  });
}

function validateRequest(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.requestId !== 'string' || typeof message.type !== 'string') {
    return workerError(
      'INVALID_WORKER_REQUEST',
      'worker',
      'The mesher received an invalid request.',
      'Expected an object with string requestId and type fields.'
    );
  }
  if (message.protocol !== WORKER_PROTOCOL_VERSION) {
    return workerError(
      'WORKER_PROTOCOL_MISMATCH',
      'worker',
      'The mesher runtime is incompatible with this application version.',
      'Received protocol ' + String(message.protocol) + '; expected ' + WORKER_PROTOCOL_VERSION + '.',
      false
    );
  }
  if (message.type !== 'initialize' && message.type !== 'diagnostics' && message.type !== 'box-smoke' && message.type !== 'import' && message.type !== 'mesh') {
    return workerError(
      'UNKNOWN_MESHER_REQUEST',
      'worker',
      'The mesher received an unsupported request.',
      'Unsupported request type: ' + message.type + '.'
    );
  }
  if (message.type === 'import') {
    if (!validCadSource(message) || typeof message.geometryId !== 'string' || message.geometryId.length === 0) {
      return workerError(
        'INVALID_IMPORT_REQUEST',
        'import',
        'Choose a non-empty STEP, IGES, or BREP file.',
        'Import requests require matching sourceBytes, sourceName, sourceFormat, and geometryId.'
      );
    }
  }
  if (message.type === 'mesh') {
    if (!validCadSource(message) || typeof message.geometryId !== 'string' || message.geometryId.length === 0 ||
        !validOrientation(message.orientation) || !Array.isArray(message.faceIds) || message.faceIds.length === 0 ||
        message.faceIds.some(function (faceId) { return typeof faceId !== 'string' || faceId.length === 0; }) ||
        !message.settings || (message.settings.elementType !== 'tet4' && message.settings.elementType !== 'tet10') ||
        !Number.isFinite(message.settings.minSizeM) || !Number.isFinite(message.settings.maxSizeM) ||
        message.settings.minSizeM <= 0 || message.settings.minSizeM > message.settings.maxSizeM) {
      return workerError(
        'INVALID_MESH_REQUEST', 'mesh', 'Choose valid tetrahedral mesh settings.',
        'Mesh requests require a canonical CAD source, stable FaceIds, and a positive min/max size range.'
      );
    }
  }
  return null;
}

function progress(requestId, stage, userMessage) {
  self.postMessage({
    protocol: WORKER_PROTOCOL_VERSION,
    requestId: requestId,
    type: 'progress',
    progress: { stage: stage, userMessage: userMessage }
  });
}

function dimTags(result) {
  return result && Array.isArray(result.dimTags) ? result.dimTags : [];
}

function entityTags(result) {
  var values = dimTags(result);
  var tags = [];
  var index;
  for (index = 1; index < values.length; index += 2) {
    tags.push(values[index]);
  }
  return tags;
}

var IGES_UNIT_SCALE_M = Object.freeze({
  1: 0.0254, 2: 0.001, 4: 0.3048, 5: 1609.344, 6: 1,
  7: 1000, 8: 0.0000254, 9: 0.000001, 10: 0.01, 11: 0.0000000254
});

function igesGlobalParameters(sourceBytes) {
  var text = new TextDecoder('ascii').decode(new Uint8Array(sourceBytes));
  var globalData = text.split(/\r?\n/).filter(function (line) {
    return line.length > 72 && line.charAt(72) === 'G';
  }).map(function (line) { return line.slice(0, 72); }).join('');
  var values = [];
  var index = 0;
  var start;
  var length;
  while (index < globalData.length && globalData.charAt(index) !== ';') {
    if (globalData.charAt(index) === ',') { values.push(''); index += 1; continue; }
    start = index;
    while (index < globalData.length && /[0-9]/.test(globalData.charAt(index))) { index += 1; }
    if (index > start && /[Hh]/.test(globalData.charAt(index))) {
      length = Number(globalData.slice(start, index));
      index += 1;
      values.push(globalData.slice(index, index + length));
      index += length;
    } else {
      index = start;
      while (index < globalData.length && globalData.charAt(index) !== ',' && globalData.charAt(index) !== ';') { index += 1; }
      values.push(globalData.slice(start, index).trim());
    }
    if (globalData.charAt(index) === ',') { index += 1; }
  }
  return values;
}

function igesScaleToMeters(sourceBytes) {
  var parameters = igesGlobalParameters(sourceBytes);
  var unitFlag = Number(parameters[13]);
  var scale = IGES_UNIT_SCALE_M[unitFlag];
  if (!Number.isFinite(scale)) {
    throw knownImportError(
      'IGES_UNITS_UNSUPPORTED',
      'The IGES file uses an unsupported or unreadable length unit.',
      'IGES global unit flag was ' + String(parameters[13]) + '.'
    );
  }
  return scale;
}

function importCadShapes(gmsh, message, temporaryPath) {
  var imported;
  var scaleM = 1;
  gmsh.option.restoreDefaults();
  gmsh.option.setString('Geometry.OCCTargetUnit', message.sourceFormat === 'step' ? 'M' : '');
  gmsh.FS.writeFile(temporaryPath, new Uint8Array(message.sourceBytes));
  imported = gmsh.model.occ.importShapes(temporaryPath, true, message.sourceFormat);
  if (message.sourceFormat === 'iges') {
    scaleM = igesScaleToMeters(message.sourceBytes);
    if (scaleM !== 1) { gmsh.model.occ.dilate(imported.outDimTags, 0, 0, 0, scaleM, scaleM, scaleM); }
  }
  gmsh.model.occ.synchronize();
  if (message.sourceFormat === 'iges' && entityTags(gmsh.model.getEntities(3)).length === 0) {
    gmsh.model.occ.healShapes([], 1e-8, true, true, true, true, true);
    gmsh.model.occ.synchronize();
  }
}

function importErrorFor(error, fallbackCode, fallbackMessage) {
  if (error && typeof error.code === 'string' && typeof error.stage === 'string' && typeof error.userMessage === 'string') {
    return error;
  }
  if (error && error.spjutsimError) { return error.spjutsimError; }
  return workerError(
    fallbackCode,
    'import',
    fallbackMessage,
    error && error.message
  );
}

function knownImportError(code, userMessage, developerMessage) {
  var error = new Error(developerMessage || userMessage);
  error.spjutsimError = workerError(code, 'import', userMessage, developerMessage);
  return error;
}

function knownMeshError(code, userMessage, developerMessage) {
  var error = new Error(developerMessage || userMessage);
  error.spjutsimError = workerError(code, 'mesh', userMessage, developerMessage);
  return error;
}

function boundingBoxM(gmsh, solidTag) {
  var box = gmsh.model.getBoundingBox(3, solidTag);
  var minM = [box.xmin, box.ymin, box.zmin];
  var maxM = [box.xmax, box.ymax, box.zmax];
  var axis;
  for (axis = 0; axis < 3; axis += 1) {
    if (!Number.isFinite(minM[axis]) || !Number.isFinite(maxM[axis]) || minM[axis] >= maxM[axis]) {
      throw knownImportError('GEOMETRY_NOT_CLOSED', 'The CAD file does not contain a usable closed solid.', 'Invalid solid bounding box.');
    }
  }
  return { minM: minM, maxM: maxM };
}

function configurePreviewTessellation(gmsh, boundingBox) {
  var dx = boundingBox.maxM[0] - boundingBox.minM[0];
  var dy = boundingBox.maxM[1] - boundingBox.minM[1];
  var dz = boundingBox.maxM[2] - boundingBox.minM[2];
  var diagonalM = Math.sqrt(dx * dx + dy * dy + dz * dz);
  gmsh.option.setNumber('Mesh.MeshSizeMin', diagonalM * PREVIEW_MAX_SURFACE_EDGE_LENGTH_FRACTION / 4);
  gmsh.option.setNumber('Mesh.MeshSizeMax', diagonalM * PREVIEW_MAX_SURFACE_EDGE_LENGTH_FRACTION);
  gmsh.option.setNumber('Mesh.MeshSizeFromCurvature', PREVIEW_CURVATURE_SEGMENTS_PER_2PI);
  gmsh.option.setNumber('Mesh.MeshSizeExtendFromBoundary', 0);
  return diagonalM;
}

function smoothFaceNormals(positions, indices, faceRanges, modelScaleM) {
  var normals = new Float32Array(positions.length);
  var rangeIndex;
  for (rangeIndex = 0; rangeIndex < faceRanges.length; rangeIndex += 1) {
    var range = faceRanges[rangeIndex];
    var index;
    for (index = range.start; index < range.start + range.count; index += 3) {
      var a = indices[index] * 3;
      var b = indices[index + 1] * 3;
      var c = indices[index + 2] * 3;
      var abx = (positions[b] - positions[a]) / modelScaleM; var aby = (positions[b + 1] - positions[a + 1]) / modelScaleM; var abz = (positions[b + 2] - positions[a + 2]) / modelScaleM;
      var acx = (positions[c] - positions[a]) / modelScaleM; var acy = (positions[c + 1] - positions[a + 1]) / modelScaleM; var acz = (positions[c + 2] - positions[a + 2]) / modelScaleM;
      var nx = aby * acz - abz * acy; var ny = abz * acx - abx * acz; var nz = abx * acy - aby * acx;
      normals[a] += nx; normals[a + 1] += ny; normals[a + 2] += nz;
      normals[b] += nx; normals[b + 1] += ny; normals[b + 2] += nz;
      normals[c] += nx; normals[c + 1] += ny; normals[c + 2] += nz;
    }
  }
  for (rangeIndex = 0; rangeIndex < normals.length; rangeIndex += 3) {
    var length = Math.sqrt(normals[rangeIndex] * normals[rangeIndex] + normals[rangeIndex + 1] * normals[rangeIndex + 1] + normals[rangeIndex + 2] * normals[rangeIndex + 2]);
    // Surface-node queries can include a periodic seam node that no retained triangle references.
    // Give it a finite fallback normal; referenced vertices have accumulated a non-zero area normal.
    if (!(length > 0)) { normals[rangeIndex] = 0; normals[rangeIndex + 1] = 0; normals[rangeIndex + 2] = 1; }
    else { normals[rangeIndex] /= length; normals[rangeIndex + 1] /= length; normals[rangeIndex + 2] /= length; }
  }
  return normals;
}

function triangleHasArea(positions, a, b, c, modelScaleM) {
  var abx = (positions[b * 3] - positions[a * 3]) / modelScaleM; var aby = (positions[b * 3 + 1] - positions[a * 3 + 1]) / modelScaleM; var abz = (positions[b * 3 + 2] - positions[a * 3 + 2]) / modelScaleM;
  var acx = (positions[c * 3] - positions[a * 3]) / modelScaleM; var acy = (positions[c * 3 + 1] - positions[a * 3 + 1]) / modelScaleM; var acz = (positions[c * 3 + 2] - positions[a * 3 + 2]) / modelScaleM;
  var nx = aby * acz - abz * acy; var ny = abz * acx - abx * acz; var nz = abx * acy - aby * acx;
  return nx * nx + ny * ny + nz * nz > PREVIEW_RELATIVE_TRIANGLE_AREA_SQUARED;
}

function extractFeatureEdges(gmsh) {
  var positions = [];
  var indices = [];
  var curveTags = entityTags(gmsh.model.getEntities(1));
  var curveIndex;
  for (curveIndex = 0; curveIndex < curveTags.length; curveIndex += 1) {
    var adjacencies = gmsh.model.getAdjacencies(1, curveTags[curveIndex]);
    // A periodic seam is a topological curve on only one face, not a visible CAD feature.
    if (!adjacencies || !adjacencies.upward || adjacencies.upward.length < 2) { continue; }
    var nodes = gmsh.model.mesh.getNodes(1, curveTags[curveIndex], true, false);
    var elements = gmsh.model.mesh.getElements(1, curveTags[curveIndex]);
    var nodeTags = nodes.nodeTags || [];
    var coordinates = nodes.coord || [];
    var indexByNodeTag = Object.create(null);
    var localIndex;
    var typeIndex;
    if (coordinates.length !== nodeTags.length * 3) {
      throw knownImportError('GEOMETRY_NOT_CLOSED', 'The CAD file could not be converted into a usable surface preview.', 'Feature-edge node coordinate count does not match node tags.');
    }
    for (localIndex = 0; localIndex < nodeTags.length; localIndex += 1) {
      indexByNodeTag[String(nodeTags[localIndex])] = positions.length / 3;
      positions.push(coordinates[localIndex * 3], coordinates[localIndex * 3 + 1], coordinates[localIndex * 3 + 2]);
    }
    for (typeIndex = 0; typeIndex < (elements.elementTypes || []).length; typeIndex += 1) {
      var connectivity = (elements.nodeTags || [])[typeIndex] || [];
      var edgeIndex;
      if (elements.elementTypes[typeIndex] !== 1) { continue; }
      for (edgeIndex = 0; edgeIndex < connectivity.length; edgeIndex += 2) {
        var first = indexByNodeTag[String(connectivity[edgeIndex])];
        var second = indexByNodeTag[String(connectivity[edgeIndex + 1])];
        if (first === undefined || second === undefined) {
          throw knownImportError('GEOMETRY_NOT_CLOSED', 'The CAD file could not be converted into a usable surface preview.', 'Feature edge references a missing node.');
        }
        indices.push(first, second);
      }
    }
  }
  return { positionsM: new Float64Array(positions), indices: new Uint32Array(indices) };
}

function extractPreview(gmsh, surfaceTags, geometryId, modelScaleM) {
  var positions = [];
  var indices = [];
  var faceIds = [];
  var faceRanges = [];
  var surfaceIndex;
  for (surfaceIndex = 0; surfaceIndex < surfaceTags.length; surfaceIndex += 1) {
    var surfaceTag = surfaceTags[surfaceIndex];
    var nodes = gmsh.model.mesh.getNodes(2, surfaceTag, true, false);
    var elements = gmsh.model.mesh.getElements(2, surfaceTag);
    var coordinates = nodes.coord || [];
    var nodeTags = nodes.nodeTags || [];
    var indexByNodeTag = Object.create(null);
    var localIndex;
    var typeIndex;
    var start = indices.length;
    var faceId = 'face-' + geometryId + '-' + (surfaceIndex + 1);
    if (coordinates.length !== nodeTags.length * 3) {
      throw knownImportError('GEOMETRY_NOT_CLOSED', 'The CAD file could not be converted into a usable surface preview.', 'Surface node coordinate count does not match node tags.');
    }
    for (localIndex = 0; localIndex < nodeTags.length; localIndex += 1) {
      indexByNodeTag[String(nodeTags[localIndex])] = positions.length / 3;
      positions.push(coordinates[localIndex * 3], coordinates[localIndex * 3 + 1], coordinates[localIndex * 3 + 2]);
    }
    for (typeIndex = 0; typeIndex < (elements.elementTypes || []).length; typeIndex += 1) {
      var type = elements.elementTypes[typeIndex];
      var connectivity = (elements.nodeTags || [])[typeIndex] || [];
      var elementIndex;
      if (type !== 2) { continue; }
      if (connectivity.length % 3 !== 0) {
        throw knownImportError('GEOMETRY_NOT_CLOSED', 'The CAD file could not be converted into a usable surface preview.', 'Triangle connectivity is incomplete.');
      }
      for (elementIndex = 0; elementIndex < connectivity.length; elementIndex += 3) {
        var a = indexByNodeTag[String(connectivity[elementIndex])];
        var b = indexByNodeTag[String(connectivity[elementIndex + 1])];
        var c = indexByNodeTag[String(connectivity[elementIndex + 2])];
        if (a === undefined || b === undefined || c === undefined) {
          throw knownImportError('GEOMETRY_NOT_CLOSED', 'The CAD file could not be converted into a usable surface preview.', 'Triangle references a node outside its surface.');
        }
        if (triangleHasArea(positions, a, b, c, modelScaleM)) { indices.push(a, b, c); }
      }
    }
    if (indices.length === start) {
      throw knownImportError('GEOMETRY_NOT_CLOSED', 'The CAD file could not be converted into a usable surface preview.', 'Surface has no triangle elements.');
    }
    faceIds.push(faceId);
    faceRanges.push({ faceId: faceId, start: start, count: indices.length - start });
  }
  return {
    faceIds: faceIds,
    preview: {
      positionsM: new Float64Array(positions),
      normals: smoothFaceNormals(positions, indices, faceRanges, modelScaleM),
      indices: new Uint32Array(indices),
      faceRanges: faceRanges,
      featureEdges: extractFeatureEdges(gmsh)
    }
  };
}

function importGeometry(gmsh, message) {
  var temporaryPath = '/spjutsim-import-' + message.requestId.replace(/[^A-Za-z0-9_-]/g, '_') + '.' + message.sourceFormat;
  var solids;
  var surfaces;
  var preview;
  var volume;
  var box;
  var previewScaleM;
  try {
    progress(message.requestId, 'import', 'Reading CAD geometry…');
    gmsh.clear();
    gmsh.model.add(message.geometryId);
    importCadShapes(gmsh, message, temporaryPath);
    solids = entityTags(gmsh.model.getEntities(3));
    if (solids.length === 0) {
      throw knownImportError('GEOMETRY_NO_SOLID', 'The CAD file does not contain a usable 3D solid.', 'No dimension-3 entities were imported.');
    }
    if (solids.length !== 1) {
      throw knownImportError('MULTIPLE_SOLIDS_UNSUPPORTED', 'This analysis supports exactly one solid body.', 'Imported ' + solids.length + ' dimension-3 entities.');
    }
    volume = gmsh.model.occ.getMass(3, solids[0]).mass;
    if (!Number.isFinite(volume) || volume <= 0) {
      throw knownImportError('GEOMETRY_NOT_CLOSED', 'The CAD file does not contain a usable closed solid.', 'Solid volume is not positive.');
    }
    surfaces = entityTags(gmsh.model.getEntities(2));
    if (surfaces.length === 0) {
      throw knownImportError('GEOMETRY_NOT_CLOSED', 'The CAD file does not contain a usable closed solid.', 'Imported solid has no boundary surfaces.');
    }
    box = boundingBoxM(gmsh, solids[0]);
    progress(message.requestId, 'preview', 'Creating surface preview…');
    try {
      previewScaleM = configurePreviewTessellation(gmsh, box);
      gmsh.model.mesh.setOutwardOrientation(solids[0]);
      gmsh.model.mesh.generate(2);
      preview = extractPreview(gmsh, surfaces, message.geometryId, previewScaleM);
    } catch (error) {
      throw importErrorFor(error, 'GEOMETRY_NOT_CLOSED', 'The CAD file could not be converted into a closed surface.');
    }
    return {
      geometryId: message.geometryId,
      sourceName: message.sourceName,
      sourceFormat: message.sourceFormat,
      orientation: { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], operations: [] },
      faceIds: preview.faceIds,
      boundingBoxM: box,
      volumeM3: volume,
      preview: preview.preview
    };
  } catch (error) {
    throw importErrorFor(error, 'GEOMETRY_IMPORT_FAILED', 'The CAD file could not be read.');
  } finally {
    try { gmsh.FS.unlink(temporaryPath); } catch (ignore) {}
    try { gmsh.clear(); } catch (ignoreClear) {}
  }
}

var MESH_POOR_GAMMA_THRESHOLD = 0.1;
var MESH_NEAR_ZERO_JACOBIAN_RELATIVE = 1e-12;

function restoreMeshGeometry(gmsh, message, temporaryPath) {
  var solids;
  var surfaces;
  gmsh.clear();
  gmsh.model.add(message.geometryId);
  importCadShapes(gmsh, message, temporaryPath);
  solids = entityTags(gmsh.model.getEntities(3));
  surfaces = entityTags(gmsh.model.getEntities(2));
  if (solids.length !== 1 || surfaces.length !== message.faceIds.length) {
    throw knownMeshError(
      'MESH_GEOMETRY_MISMATCH', 'The imported geometry no longer matches its CAD face mapping.',
      'Expected one solid and ' + message.faceIds.length + ' surfaces; received ' + solids.length + ' solid(s) and ' + surfaces.length + ' surface(s).'
    );
  }
  return { solidTag: solids[0], surfaceTags: surfaces };
}

function denseNodeMap(gmsh) {
  var nodes = gmsh.model.mesh.getNodes();
  var nodeTags = nodes.nodeTags || [];
  var coordinates = nodes.coord || [];
  var positions;
  var indexByNodeTag = Object.create(null);
  var index;
  if (nodeTags.length === 0 || coordinates.length !== nodeTags.length * 3) {
    throw knownMeshError('MESH_EXTRACTION_FAILED', 'The generated mesh has invalid node data.', 'Global node coordinate count does not match node tags.');
  }
  positions = new Float64Array(coordinates.length);
  for (index = 0; index < nodeTags.length; index += 1) {
    if (!Number.isFinite(coordinates[index * 3]) || !Number.isFinite(coordinates[index * 3 + 1]) || !Number.isFinite(coordinates[index * 3 + 2])) {
      throw knownMeshError('MESH_EXTRACTION_FAILED', 'The generated mesh contains invalid node coordinates.', 'Non-finite global node coordinate.');
    }
    indexByNodeTag[String(nodeTags[index])] = index;
    positions[index * 3] = coordinates[index * 3];
    positions[index * 3 + 1] = coordinates[index * 3 + 1];
    positions[index * 3 + 2] = coordinates[index * 3 + 2];
  }
  return { positions: positions, indexByNodeTag: indexByNodeTag };
}

function extractElementConnectivity(elements, expectedType, nodesPerElement, indexByNodeTag, errorCode) {
  var types = elements.elementTypes || [];
  var blocks = elements.nodeTags || [];
  var tags = elements.elementTags || [];
  var connectivity = [];
  var elementTags = [];
  var typeIndex;
  for (typeIndex = 0; typeIndex < types.length; typeIndex += 1) {
    var block = blocks[typeIndex] || [];
    var blockTags = tags[typeIndex] || [];
    var item;
    if (types[typeIndex] !== expectedType) { continue; }
    if (block.length === 0 || block.length % nodesPerElement !== 0 || blockTags.length !== block.length / nodesPerElement) {
      throw knownMeshError(errorCode, 'The generated mesh contains incomplete element connectivity.', 'Unexpected Gmsh element block for type ' + expectedType + '.');
    }
    for (item = 0; item < block.length; item += 1) {
      var denseIndex = indexByNodeTag[String(block[item])];
      if (denseIndex === undefined) {
        throw knownMeshError(errorCode, 'The generated mesh references a missing node.', 'Element referenced Gmsh node tag ' + String(block[item]) + '.');
      }
      connectivity.push(denseIndex);
    }
    for (item = 0; item < blockTags.length; item += 1) { elementTags.push(blockTags[item]); }
  }
  if (connectivity.length === 0) {
    throw knownMeshError(errorCode, 'The generated mesh contains no required elements.', 'No Gmsh type ' + expectedType + ' elements were extracted.');
  }
  return { connectivity: connectivity, elementTags: elementTags };
}

function appendDisplayTriangles(connectivity, nodes, elementType) {
  if (elementType === 'tri3') {
    connectivity.push(nodes[0], nodes[1], nodes[2]);
    return;
  }
  // Application Tri6 order follows Gmsh: vertices 0/1/2, then edges
  // 0-1, 1-2, and 2-0. Four linear triangles preserve the curved mid-nodes.
  connectivity.push(
    nodes[0], nodes[3], nodes[5],
    nodes[3], nodes[1], nodes[4],
    nodes[5], nodes[4], nodes[2],
    nodes[3], nodes[4], nodes[5]
  );
}

function extractBoundaryFaces(gmsh, surfaceTags, faceIds, indexByNodeTag, descriptor) {
  var solverConnectivity = [];
  var displayConnectivity = [];
  var solverFaceRanges = [];
  var faceRanges = [];
  var geometryFaceMap = Object.create(null);
  var surfaceIndex;
  for (surfaceIndex = 0; surfaceIndex < surfaceTags.length; surfaceIndex += 1) {
    var solverStart = solverConnectivity.length;
    var displayStart = displayConnectivity.length;
    var extracted = extractElementConnectivity(
      gmsh.model.mesh.getElements(2, surfaceTags[surfaceIndex]), descriptor.gmshFaceType,
      descriptor.solverFaceNodes, indexByNodeTag, 'BOUNDARY_EXTRACTION_FAILED'
    );
    var faceId = faceIds[surfaceIndex];
    var range;
    var connectivityIndex;
    for (connectivityIndex = 0; connectivityIndex < extracted.connectivity.length; connectivityIndex += 1) {
      solverConnectivity.push(extracted.connectivity[connectivityIndex]);
    }
    for (connectivityIndex = 0; connectivityIndex < extracted.connectivity.length; connectivityIndex += descriptor.solverFaceNodes) {
      appendDisplayTriangles(displayConnectivity,
        extracted.connectivity.slice(connectivityIndex, connectivityIndex + descriptor.solverFaceNodes),
        descriptor.solverFaceType);
    }
    solverFaceRanges.push({ faceId: faceId, start: solverStart, count: solverConnectivity.length - solverStart });
    range = { faceId: faceId, start: displayStart, count: displayConnectivity.length - displayStart };
    faceRanges.push(range);
    geometryFaceMap[faceId] = { faceId: faceId, start: range.start, count: range.count };
  }
  return {
    solverElementType: descriptor.solverFaceType,
    solverConnectivity: new Uint32Array(solverConnectivity),
    solverFaceRanges: solverFaceRanges,
    triangleConnectivity: new Uint32Array(displayConnectivity),
    faceRanges: faceRanges,
    geometryFaceMap: geometryFaceMap
  };
}

function quantile(sortedValues, fraction) {
  return sortedValues[Math.min(sortedValues.length - 1, Math.max(0, Math.round((sortedValues.length - 1) * fraction)))];
}

var TET10_QUADRATURE_A = 0.5854101966249685;
var TET10_QUADRATURE_B = 0.1381966011250105;
var TET10_QUADRATURE_BARYCENTRIC = [
  [TET10_QUADRATURE_A, TET10_QUADRATURE_B, TET10_QUADRATURE_B, TET10_QUADRATURE_B],
  [TET10_QUADRATURE_B, TET10_QUADRATURE_A, TET10_QUADRATURE_B, TET10_QUADRATURE_B],
  [TET10_QUADRATURE_B, TET10_QUADRATURE_B, TET10_QUADRATURE_A, TET10_QUADRATURE_B],
  [TET10_QUADRATURE_B, TET10_QUADRATURE_B, TET10_QUADRATURE_B, TET10_QUADRATURE_A]
];
var TET10_EDGE_PAIRS = [[0, 1], [1, 2], [2, 0], [0, 3], [2, 3], [3, 1]];
var BARYCENTRIC_DERIVATIVES = [[-1, -1, -1], [1, 0, 0], [0, 1, 0], [0, 0, 1]];

function tet10JacobianDeterminant(positions, ids, barycentric) {
  var derivatives = [];
  var node;
  var axis;
  for (node = 0; node < 4; node += 1) {
    derivatives.push(BARYCENTRIC_DERIVATIVES[node].map(function (value) { return (4 * barycentric[node] - 1) * value; }));
  }
  TET10_EDGE_PAIRS.forEach(function (pair) {
    derivatives.push([0, 1, 2].map(function (coordinate) {
      return 4 * (BARYCENTRIC_DERIVATIVES[pair[0]][coordinate] * barycentric[pair[1]] +
        barycentric[pair[0]] * BARYCENTRIC_DERIVATIVES[pair[1]][coordinate]);
    }));
  });
  var jacobian = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (node = 0; node < 10; node += 1) {
    for (axis = 0; axis < 3; axis += 1) {
      jacobian[0][axis] += positions[ids[node] * 3] * derivatives[node][axis];
      jacobian[1][axis] += positions[ids[node] * 3 + 1] * derivatives[node][axis];
      jacobian[2][axis] += positions[ids[node] * 3 + 2] * derivatives[node][axis];
    }
  }
  return jacobian[0][0] * (jacobian[1][1] * jacobian[2][2] - jacobian[1][2] * jacobian[2][1]) -
    jacobian[0][1] * (jacobian[1][0] * jacobian[2][2] - jacobian[1][2] * jacobian[2][0]) +
    jacobian[0][2] * (jacobian[1][0] * jacobian[2][1] - jacobian[1][1] * jacobian[2][0]);
}

function meshStatistics(positions, connectivity, gammaQualities, diagonalM, descriptor) {
  var minEdge = Infinity;
  var maxEdge = 0;
  var maximumEdgeRatio = 1;
  var minimumJacobian = Infinity;
  var inverted = 0;
  var nearZero = 0;
  var index;
  var nearZeroSixVolume = MESH_NEAR_ZERO_JACOBIAN_RELATIVE * diagonalM * diagonalM * diagonalM * 6;
  var edgePairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  for (index = 0; index < connectivity.length; index += descriptor.volumeNodes) {
    var ids = [connectivity[index], connectivity[index + 1], connectivity[index + 2], connectivity[index + 3]];
    var ax = positions[ids[1] * 3] - positions[ids[0] * 3];
    var ay = positions[ids[1] * 3 + 1] - positions[ids[0] * 3 + 1];
    var az = positions[ids[1] * 3 + 2] - positions[ids[0] * 3 + 2];
    var bx = positions[ids[2] * 3] - positions[ids[0] * 3];
    var by = positions[ids[2] * 3 + 1] - positions[ids[0] * 3 + 1];
    var bz = positions[ids[2] * 3 + 2] - positions[ids[0] * 3 + 2];
    var cx = positions[ids[3] * 3] - positions[ids[0] * 3];
    var cy = positions[ids[3] * 3 + 1] - positions[ids[0] * 3 + 1];
    var cz = positions[ids[3] * 3 + 2] - positions[ids[0] * 3 + 2];
    var sixVolume = ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
    var edgeIndex;
    var elementMinimumJacobian = sixVolume;
    if (descriptor.elementType === 'tet10') {
      var tet10Ids = Array.prototype.slice.call(connectivity, index, index + 10);
      elementMinimumJacobian = Math.min.apply(null, TET10_QUADRATURE_BARYCENTRIC.map(function (point) {
        return tet10JacobianDeterminant(positions, tet10Ids, point);
      }));
    }
    minimumJacobian = Math.min(minimumJacobian, elementMinimumJacobian);
    if (elementMinimumJacobian <= 0) { inverted += 1; }
    if (Math.abs(elementMinimumJacobian) <= nearZeroSixVolume) { nearZero += 1; }
    var elementMinEdge = Infinity;
    var elementMaxEdge = 0;
    for (edgeIndex = 0; edgeIndex < edgePairs.length; edgeIndex += 1) {
      var first = ids[edgePairs[edgeIndex][0]] * 3;
      var second = ids[edgePairs[edgeIndex][1]] * 3;
      var dx = positions[second] - positions[first];
      var dy = positions[second + 1] - positions[first + 1];
      var dz = positions[second + 2] - positions[first + 2];
      var length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      minEdge = Math.min(minEdge, length);
      maxEdge = Math.max(maxEdge, length);
      elementMinEdge = Math.min(elementMinEdge, length);
      elementMaxEdge = Math.max(elementMaxEdge, length);
    }
    maximumEdgeRatio = Math.max(maximumEdgeRatio, elementMaxEdge / elementMinEdge);
  }
  gammaQualities.sort(function (left, right) { return left - right; });
  return {
    minCharacteristicSizeM: minEdge,
    maxCharacteristicSizeM: maxEdge,
    invertedElementCount: inverted,
    nearZeroJacobianCount: nearZero,
    quality: {
      metric: 'gamma', minimum: gammaQualities[0], p05: quantile(gammaQualities, 0.05),
      median: quantile(gammaQualities, 0.5), poorElementCount: gammaQualities.filter(function (value) { return value < MESH_POOR_GAMMA_THRESHOLD; }).length,
      invertedElementCount: inverted, nearZeroJacobianCount: nearZero,
      minimumJacobian: minimumJacobian, maximumEdgeRatio: maximumEdgeRatio,
      warning: gammaQualities[0] < MESH_POOR_GAMMA_THRESHOLD ? 'Some elements have low gamma quality.' : null
    }
  };
}

function rotatePositionsInPlace(positions, rotation) {
  var index;
  var x;
  var y;
  var z;
  for (index = 0; index < positions.length; index += 3) {
    x = positions[index]; y = positions[index + 1]; z = positions[index + 2];
    positions[index] = rotation[0] * x + rotation[1] * y + rotation[2] * z;
    positions[index + 1] = rotation[3] * x + rotation[4] * y + rotation[5] * z;
    positions[index + 2] = rotation[6] * x + rotation[7] * y + rotation[8] * z;
  }
}

function generateMesh(gmsh, message) {
  var temporaryPath = '/spjutsim-mesh-' + message.requestId.replace(/[^A-Za-z0-9_-]/g, '_') + '.' + message.sourceFormat;
  var restored;
  var nodes;
  var tetrahedra;
  var boundary;
  var qualityResult;
  var gammaQualities;
  var box;
  var diagonalM;
  var summary;
  var descriptor = message.settings.elementType === 'tet10'
    ? { elementType: 'tet10', volumeNodes: 10, gmshVolumeType: 11, solverFaceType: 'tri6', solverFaceNodes: 6, gmshFaceType: 9 }
    : { elementType: 'tet4', volumeNodes: 4, gmshVolumeType: 4, solverFaceType: 'tri3', solverFaceNodes: 3, gmshFaceType: 2 };
  try {
    progress(message.requestId, 'mesh-import', 'Restoring CAD geometry…');
    restored = restoreMeshGeometry(gmsh, message, temporaryPath);
    box = boundingBoxM(gmsh, restored.solidTag);
    diagonalM = Math.sqrt(Math.pow(box.maxM[0] - box.minM[0], 2) + Math.pow(box.maxM[1] - box.minM[1], 2) + Math.pow(box.maxM[2] - box.minM[2], 2));
    gmsh.option.setNumber('Mesh.ElementOrder', 1);
    gmsh.option.setNumber('Mesh.MeshSizeMin', message.settings.minSizeM);
    gmsh.option.setNumber('Mesh.MeshSizeMax', message.settings.maxSizeM);
    gmsh.option.setNumber('Mesh.MeshSizeFromCurvature', 1);
    gmsh.option.setNumber('Mesh.MeshSizeExtendFromBoundary', 1);
    gmsh.model.mesh.setOutwardOrientation(restored.solidTag);
    progress(message.requestId, 'mesh-generate', 'Generating first-order tetrahedral volume mesh…');
    gmsh.model.mesh.generate(3);
    if (descriptor.elementType === 'tet10') {
      progress(message.requestId, 'mesh-upgrade', 'Converting the volume mesh to Tet10…');
      gmsh.model.mesh.setOrder(2);
      progress(message.requestId, 'mesh-optimize', 'Optimizing the quadratic mesh…');
      gmsh.model.mesh.optimize('HighOrder');
    }
    progress(message.requestId, 'mesh-extract', 'Extracting solver-ready mesh data…');
    nodes = denseNodeMap(gmsh);
    tetrahedra = extractElementConnectivity(gmsh.model.mesh.getElements(3, restored.solidTag), descriptor.gmshVolumeType,
      descriptor.volumeNodes, nodes.indexByNodeTag, 'MESH_EXTRACTION_FAILED');
    boundary = extractBoundaryFaces(gmsh, restored.surfaceTags, message.faceIds, nodes.indexByNodeTag, descriptor);
    rotatePositionsInPlace(nodes.positions, message.orientation.rotation);
    qualityResult = gmsh.model.mesh.getElementQualities(tetrahedra.elementTags, 'gamma');
    gammaQualities = Array.prototype.slice.call((qualityResult && qualityResult.elementsQuality) || qualityResult || []);
    if (gammaQualities.length !== tetrahedra.elementTags.length || gammaQualities.some(function (value) { return !Number.isFinite(value); })) {
      throw knownMeshError('MESH_QUALITY_FAILED', 'The generated mesh quality could not be evaluated.', 'Gmsh gamma quality output did not match tetrahedron count.');
    }
    summary = meshStatistics(nodes.positions, tetrahedra.connectivity, gammaQualities, diagonalM, descriptor);
    if (summary.invertedElementCount > 0) {
      throw knownMeshError('INVERTED_ELEMENTS', 'The generated mesh contains inverted elements.', 'Found ' + summary.invertedElementCount + ' non-positive ' + descriptor.elementType + ' Jacobians.');
    }
    if (summary.nearZeroJacobianCount > 0) {
      throw knownMeshError('DEGENERATE_ELEMENTS', 'The generated mesh contains degenerate elements.', 'Found ' + summary.nearZeroJacobianCount + ' near-zero ' + descriptor.elementType + ' Jacobians.');
    }
    return {
      elementType: descriptor.elementType, nodePositionsM: nodes.positions, elementConnectivity: new Uint32Array(tetrahedra.connectivity),
      boundaryFaces: { solverElementType: boundary.solverElementType, solverConnectivity: boundary.solverConnectivity,
        solverFaceRanges: boundary.solverFaceRanges, triangleConnectivity: boundary.triangleConnectivity, faceRanges: boundary.faceRanges },
      geometryFaceMap: boundary.geometryFaceMap,
      statistics: { nodeCount: nodes.positions.length / 3, elementCount: tetrahedra.connectivity.length / descriptor.volumeNodes,
        boundaryTriangleCount: boundary.triangleConnectivity.length / 3,
        boundaryElementCount: boundary.solverConnectivity.length / descriptor.solverFaceNodes,
        minCharacteristicSizeM: summary.minCharacteristicSizeM, maxCharacteristicSizeM: summary.maxCharacteristicSizeM, boundingBoxDiagonalM: diagonalM },
      quality: summary.quality,
      memoryInputs: { nodeCount: nodes.positions.length / 3, elementCount: tetrahedra.connectivity.length / descriptor.volumeNodes,
        degreeOfFreedomCount: nodes.positions.length, connectivityEntries: tetrahedra.connectivity.length,
        boundaryConnectivityEntries: boundary.solverConnectivity.length }
    };
  } catch (error) {
    if (error && error.spjutsimError) { throw error; }
    throw knownMeshError('MESH_GENERATION_FAILED', 'The volume mesh could not be generated.', error && error.message);
  } finally {
    try { gmsh.FS.unlink(temporaryPath); } catch (ignore) {}
    try { gmsh.clear(); } catch (ignoreClear) {}
  }
}

function initializeGmsh() {
  if (!gmshPromise) {
    gmshPromise = initializeSpjutsimGmsh({
      print: function () {},
      printErr: function () {}
    }).then(function (gmsh) {
      gmsh.initialize();
      return gmsh;
    }).catch(function (error) {
      gmshPromise = null;
      throw error;
    });
  }
  return gmshPromise;
}

function diagnostics(gmsh) {
  return {
    gmshVersion: SPJUTSIM_GMSH_DESCRIPTOR.version,
    runtimeMode: 'serial-local-embedded',
    capabilities: {
      openCascade: Boolean(gmsh.model && gmsh.model.occ && gmsh.model.occ.addBox),
      step: Boolean(gmsh.model && gmsh.model.occ && gmsh.model.occ.importShapes),
      threads: false,
      sharedArrayBuffer: false,
      runtimeNetwork: false
    },
    wasmMemoryBytes: gmsh.module.wasmMemory.buffer.byteLength
  };
}

function runBoxSmoke(gmsh) {
  var boxTag;
  var mass;
  var surfaces;
  gmsh.clear();
  try {
    gmsh.model.add('spjutsim-runtime-box');
    boxTag = gmsh.model.occ.addBox(0, 0, 0, 1, 1, 1);
    gmsh.model.occ.synchronize();
    mass = gmsh.model.occ.getMass(3, boxTag).mass;
    surfaces = gmsh.model.getEntities(2).dimTags;
    return {
      volume: mass,
      surfaceCount: surfaces.length / 2,
      solidCount: gmsh.model.getEntities(3).dimTags.length / 2
    };
  } finally {
    gmsh.clear();
  }
}

async function handleRequest(message) {
  var validationError = validateRequest(message);
  var gmsh;
  var result;
  if (validationError) {
    errorResponse(message && message.requestId, validationError);
    return;
  }

  try {
    gmsh = await initializeGmsh();
  } catch (error) {
    errorResponse(message.requestId, workerError(
      'MESHER_INITIALIZATION_FAILED',
      'initialize',
      'The local geometry engine could not be initialized.',
      error && error.message
    ));
    return;
  }

  try {
    if (message.type === 'import') {
      result = importGeometry(gmsh, message);
      self.postMessage({
        protocol: WORKER_PROTOCOL_VERSION,
        requestId: message.requestId,
        type: 'import-result',
        result: result
      }, [
        result.preview.positionsM.buffer, result.preview.normals.buffer, result.preview.indices.buffer,
        result.preview.featureEdges.positionsM.buffer, result.preview.featureEdges.indices.buffer
      ]);
      return;
    }
    if (message.type === 'mesh') {
      result = generateMesh(gmsh, message);
      self.postMessage({
        protocol: WORKER_PROTOCOL_VERSION,
        requestId: message.requestId,
        type: 'mesh-result',
        result: result
      }, [
        result.nodePositionsM.buffer,
        result.elementConnectivity.buffer,
        result.boundaryFaces.solverConnectivity.buffer,
        result.boundaryFaces.triangleConnectivity.buffer
      ]);
      return;
    }
    result = message.type === 'box-smoke' ? runBoxSmoke(gmsh) : diagnostics(gmsh);
    self.postMessage({
      protocol: WORKER_PROTOCOL_VERSION,
      requestId: message.requestId,
      type: message.type === 'box-smoke' ? 'box-smoke-result' : 'diagnostics-result',
      result: result
    });
  } catch (error) {
    var normalizedError = (error && error.spjutsimError) || error;
    errorResponse(message.requestId, workerError(
      (normalizedError && normalizedError.code) || (message.type === 'import' ? 'GEOMETRY_IMPORT_FAILED' : (message.type === 'mesh' ? 'MESH_GENERATION_FAILED' : 'MESHER_OPERATION_FAILED')),
      (normalizedError && normalizedError.stage) || (message.type === 'import' ? 'import' : (message.type === 'mesh' ? 'mesh' : 'geometry')),
      (normalizedError && normalizedError.userMessage) || (message.type === 'import' ? 'The CAD file could not be read.' : (message.type === 'mesh' ? 'The volume mesh could not be generated.' : 'The local geometry engine could not complete its operation.')),
      (normalizedError && normalizedError.developerMessage) || (error && error.message)
    ));
  }
}

self.postMessage({
  protocol: WORKER_PROTOCOL_VERSION,
  type: 'ready',
  worker: 'mesher'
});

self.onmessage = function (event) {
  requestQueue = requestQueue.then(function () {
    return handleRequest(event.data);
  }).catch(function (error) {
    errorResponse(event.data && event.data.requestId, workerError(
      'MESHER_OPERATION_FAILED',
      'worker',
      'The mesher stopped processing the request.',
      error && error.message
    ));
  });
};
