'use strict';
var WORKER_PROTOCOL_VERSION = 1;
var gmshPromise = null;
var requestQueue = Promise.resolve();

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
    if (!(message.stepBytes instanceof ArrayBuffer) || message.stepBytes.byteLength === 0 ||
        typeof message.sourceName !== 'string' || !/\.(step|stp)$/i.test(message.sourceName) ||
        typeof message.geometryId !== 'string' || message.geometryId.length === 0) {
      return workerError(
        'INVALID_IMPORT_REQUEST',
        'import',
        'Choose a non-empty .step or .stp file.',
        'Import requests require stepBytes, sourceName, and geometryId.'
      );
    }
  }
  if (message.type === 'mesh') {
    if (!(message.stepBytes instanceof ArrayBuffer) || message.stepBytes.byteLength === 0 ||
        typeof message.sourceName !== 'string' || !/\.(step|stp)$/i.test(message.sourceName) ||
        typeof message.geometryId !== 'string' || message.geometryId.length === 0 ||
        !Array.isArray(message.faceIds) || message.faceIds.length === 0 ||
        message.faceIds.some(function (faceId) { return typeof faceId !== 'string' || faceId.length === 0; }) ||
        !message.settings || message.settings.elementType !== 'tet4' ||
        !Number.isFinite(message.settings.minSizeM) || !Number.isFinite(message.settings.maxSizeM) ||
        message.settings.minSizeM <= 0 || message.settings.minSizeM > message.settings.maxSizeM) {
      return workerError(
        'INVALID_MESH_REQUEST', 'mesh', 'Choose valid Tet4 mesh settings.',
        'Mesh requests require canonical STEP bytes, stable FaceIds, and a positive min/max size range.'
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
      throw knownImportError('GEOMETRY_NOT_CLOSED', 'The STEP file does not contain a usable closed solid.', 'Invalid solid bounding box.');
    }
  }
  return { minM: minM, maxM: maxM };
}

function extractPreview(gmsh, surfaceTags, geometryId) {
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
      throw knownImportError('GEOMETRY_NOT_CLOSED', 'The STEP file could not be converted into a usable surface preview.', 'Surface node coordinate count does not match node tags.');
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
        throw knownImportError('GEOMETRY_NOT_CLOSED', 'The STEP file could not be converted into a usable surface preview.', 'Triangle connectivity is incomplete.');
      }
      for (elementIndex = 0; elementIndex < connectivity.length; elementIndex += 3) {
        var a = indexByNodeTag[String(connectivity[elementIndex])];
        var b = indexByNodeTag[String(connectivity[elementIndex + 1])];
        var c = indexByNodeTag[String(connectivity[elementIndex + 2])];
        if (a === undefined || b === undefined || c === undefined) {
          throw knownImportError('GEOMETRY_NOT_CLOSED', 'The STEP file could not be converted into a usable surface preview.', 'Triangle references a node outside its surface.');
        }
        indices.push(a, b, c);
      }
    }
    if (indices.length === start) {
      throw knownImportError('GEOMETRY_NOT_CLOSED', 'The STEP file could not be converted into a usable surface preview.', 'Surface has no triangle elements.');
    }
    faceIds.push(faceId);
    faceRanges.push({ faceId: faceId, start: start, count: indices.length - start });
  }
  return {
    faceIds: faceIds,
    preview: {
      positionsM: new Float64Array(positions),
      indices: new Uint32Array(indices),
      faceRanges: faceRanges
    }
  };
}

function importGeometry(gmsh, message) {
  var temporaryPath = '/spjutsim-import-' + message.requestId.replace(/[^A-Za-z0-9_-]/g, '_') + '.step';
  var solids;
  var surfaces;
  var preview;
  var volume;
  try {
    progress(message.requestId, 'import', 'Reading STEP geometry…');
    gmsh.clear();
    gmsh.model.add(message.geometryId);
    gmsh.option.setString('Geometry.OCCTargetUnit', 'M');
    gmsh.FS.writeFile(temporaryPath, new Uint8Array(message.stepBytes));
    gmsh.model.occ.importShapes(temporaryPath, true, 'step');
    gmsh.model.occ.synchronize();
    solids = entityTags(gmsh.model.getEntities(3));
    if (solids.length === 0) {
      throw knownImportError('GEOMETRY_NO_SOLID', 'The STEP file does not contain a usable 3D solid.', 'No dimension-3 entities were imported.');
    }
    if (solids.length !== 1) {
      throw knownImportError('MULTIPLE_SOLIDS_UNSUPPORTED', 'This analysis supports exactly one solid body.', 'Imported ' + solids.length + ' dimension-3 entities.');
    }
    volume = gmsh.model.occ.getMass(3, solids[0]).mass;
    if (!Number.isFinite(volume) || volume <= 0) {
      throw knownImportError('GEOMETRY_NOT_CLOSED', 'The STEP file does not contain a usable closed solid.', 'Solid volume is not positive.');
    }
    surfaces = entityTags(gmsh.model.getEntities(2));
    if (surfaces.length === 0) {
      throw knownImportError('GEOMETRY_NOT_CLOSED', 'The STEP file does not contain a usable closed solid.', 'Imported solid has no boundary surfaces.');
    }
    progress(message.requestId, 'preview', 'Creating surface preview…');
    try {
      gmsh.model.mesh.generate(2);
      preview = extractPreview(gmsh, surfaces, message.geometryId);
    } catch (error) {
      throw importErrorFor(error, 'GEOMETRY_NOT_CLOSED', 'The STEP file could not be converted into a closed surface.');
    }
    return {
      geometryId: message.geometryId,
      sourceName: message.sourceName,
      sourceFormat: 'step',
      faceIds: preview.faceIds,
      boundingBoxM: boundingBoxM(gmsh, solids[0]),
      volumeM3: volume,
      preview: preview.preview
    };
  } catch (error) {
    throw importErrorFor(error, 'GEOMETRY_IMPORT_FAILED', 'The STEP file could not be read.');
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
  gmsh.option.setString('Geometry.OCCTargetUnit', 'M');
  gmsh.FS.writeFile(temporaryPath, new Uint8Array(message.stepBytes));
  gmsh.model.occ.importShapes(temporaryPath, true, 'step');
  gmsh.model.occ.synchronize();
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

function extractBoundaryFaces(gmsh, surfaceTags, faceIds, indexByNodeTag) {
  var connectivity = [];
  var faceRanges = [];
  var geometryFaceMap = Object.create(null);
  var surfaceIndex;
  for (surfaceIndex = 0; surfaceIndex < surfaceTags.length; surfaceIndex += 1) {
    var start = connectivity.length;
    var extracted = extractElementConnectivity(
      gmsh.model.mesh.getElements(2, surfaceTags[surfaceIndex]), 2, 3, indexByNodeTag, 'BOUNDARY_EXTRACTION_FAILED'
    );
    var faceId = faceIds[surfaceIndex];
    var range;
    Array.prototype.push.apply(connectivity, extracted.connectivity);
    range = { faceId: faceId, start: start, count: connectivity.length - start };
    faceRanges.push(range);
    geometryFaceMap[faceId] = { faceId: faceId, start: range.start, count: range.count };
  }
  return {
    triangleConnectivity: new Uint32Array(connectivity), faceRanges: faceRanges, geometryFaceMap: geometryFaceMap
  };
}

function quantile(sortedValues, fraction) {
  return sortedValues[Math.min(sortedValues.length - 1, Math.max(0, Math.round((sortedValues.length - 1) * fraction)))];
}

function meshStatistics(positions, connectivity, gammaQualities, diagonalM) {
  var minEdge = Infinity;
  var maxEdge = 0;
  var inverted = 0;
  var nearZero = 0;
  var index;
  var nearZeroSixVolume = MESH_NEAR_ZERO_JACOBIAN_RELATIVE * diagonalM * diagonalM * diagonalM * 6;
  var edgePairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  for (index = 0; index < connectivity.length; index += 4) {
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
    if (sixVolume <= 0) { inverted += 1; }
    if (Math.abs(sixVolume) <= nearZeroSixVolume) { nearZero += 1; }
    for (edgeIndex = 0; edgeIndex < edgePairs.length; edgeIndex += 1) {
      var first = ids[edgePairs[edgeIndex][0]] * 3;
      var second = ids[edgePairs[edgeIndex][1]] * 3;
      var dx = positions[second] - positions[first];
      var dy = positions[second + 1] - positions[first + 1];
      var dz = positions[second + 2] - positions[first + 2];
      var length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      minEdge = Math.min(minEdge, length);
      maxEdge = Math.max(maxEdge, length);
    }
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
      warning: gammaQualities[0] < MESH_POOR_GAMMA_THRESHOLD ? 'Some elements have low gamma quality.' : null
    }
  };
}

function generateMesh(gmsh, message) {
  var temporaryPath = '/spjutsim-mesh-' + message.requestId.replace(/[^A-Za-z0-9_-]/g, '_') + '.step';
  var restored;
  var nodes;
  var tetrahedra;
  var boundary;
  var qualityResult;
  var gammaQualities;
  var box;
  var diagonalM;
  var summary;
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
    progress(message.requestId, 'mesh-generate', 'Generating Tet4 volume mesh…');
    gmsh.model.mesh.generate(3);
    progress(message.requestId, 'mesh-extract', 'Extracting solver-ready mesh data…');
    nodes = denseNodeMap(gmsh);
    tetrahedra = extractElementConnectivity(gmsh.model.mesh.getElements(3, restored.solidTag), 4, 4, nodes.indexByNodeTag, 'MESH_EXTRACTION_FAILED');
    boundary = extractBoundaryFaces(gmsh, restored.surfaceTags, message.faceIds, nodes.indexByNodeTag);
    qualityResult = gmsh.model.mesh.getElementQualities(tetrahedra.elementTags, 'gamma');
    gammaQualities = Array.prototype.slice.call((qualityResult && qualityResult.elementsQuality) || qualityResult || []);
    if (gammaQualities.length !== tetrahedra.elementTags.length || gammaQualities.some(function (value) { return !Number.isFinite(value); })) {
      throw knownMeshError('MESH_QUALITY_FAILED', 'The generated mesh quality could not be evaluated.', 'Gmsh gamma quality output did not match tetrahedron count.');
    }
    summary = meshStatistics(nodes.positions, tetrahedra.connectivity, gammaQualities, diagonalM);
    if (summary.invertedElementCount > 0) {
      throw knownMeshError('INVERTED_ELEMENTS', 'The generated mesh contains inverted elements.', 'Found ' + summary.invertedElementCount + ' non-positive Tet4 Jacobians.');
    }
    return {
      elementType: 'tet4', nodePositionsM: nodes.positions, elementConnectivity: new Uint32Array(tetrahedra.connectivity),
      boundaryFaces: { triangleConnectivity: boundary.triangleConnectivity, faceRanges: boundary.faceRanges }, geometryFaceMap: boundary.geometryFaceMap,
      statistics: { nodeCount: nodes.positions.length / 3, elementCount: tetrahedra.connectivity.length / 4, boundaryTriangleCount: boundary.triangleConnectivity.length / 3, minCharacteristicSizeM: summary.minCharacteristicSizeM, maxCharacteristicSizeM: summary.maxCharacteristicSizeM },
      quality: summary.quality,
      memoryInputs: { nodeCount: nodes.positions.length / 3, elementCount: tetrahedra.connectivity.length / 4, degreeOfFreedomCount: nodes.positions.length, connectivityEntries: tetrahedra.connectivity.length, boundaryConnectivityEntries: boundary.triangleConnectivity.length }
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
      }, [result.preview.positionsM.buffer, result.preview.indices.buffer]);
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
      (normalizedError && normalizedError.userMessage) || (message.type === 'import' ? 'The STEP file could not be read.' : (message.type === 'mesh' ? 'The volume mesh could not be generated.' : 'The local geometry engine could not complete its operation.')),
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
