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
  if (message.type !== 'initialize' && message.type !== 'diagnostics' && message.type !== 'box-smoke' && message.type !== 'import') {
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
      (normalizedError && normalizedError.code) || (message.type === 'import' ? 'GEOMETRY_IMPORT_FAILED' : 'MESHER_OPERATION_FAILED'),
      (normalizedError && normalizedError.stage) || (message.type === 'import' ? 'import' : 'geometry'),
      (normalizedError && normalizedError.userMessage) || (message.type === 'import' ? 'The STEP file could not be read.' : 'The local geometry engine could not complete its operation.'),
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
