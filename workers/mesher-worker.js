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
  if (message.type !== 'initialize' && message.type !== 'diagnostics' && message.type !== 'box-smoke') {
    return workerError(
      'UNKNOWN_MESHER_REQUEST',
      'worker',
      'The mesher received an unsupported request.',
      'Unsupported request type: ' + message.type + '.'
    );
  }
  return null;
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
    result = message.type === 'box-smoke' ? runBoxSmoke(gmsh) : diagnostics(gmsh);
    self.postMessage({
      protocol: WORKER_PROTOCOL_VERSION,
      requestId: message.requestId,
      type: message.type === 'box-smoke' ? 'box-smoke-result' : 'diagnostics-result',
      result: result
    });
  } catch (error) {
    errorResponse(message.requestId, workerError(
      'MESHER_OPERATION_FAILED',
      'geometry',
      'The local geometry engine could not complete its operation.',
      error && error.message
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
