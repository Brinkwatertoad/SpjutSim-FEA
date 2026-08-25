'use strict';
var WORKER_PROTOCOL_VERSION = 1;

self.postMessage({
  protocol: WORKER_PROTOCOL_VERSION,
  type: 'ready',
  worker: 'mesher'
});

self.onmessage = function (event) {
  self.postMessage({
    protocol: WORKER_PROTOCOL_VERSION,
    requestId: event.data.requestId,
    type: 'error',
    error: {
      code: 'MESHER_NOT_IMPLEMENTED',
      stage: 'mesh',
      userMessage: 'Meshing is not implemented in the framework milestone.',
      recoverable: true
    }
  });
};
