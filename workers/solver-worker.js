'use strict';
var WORKER_PROTOCOL_VERSION = 1;

self.postMessage({
  protocol: WORKER_PROTOCOL_VERSION,
  type: 'ready',
  worker: 'solver'
});

self.onmessage = function (event) {
  self.postMessage({
    protocol: WORKER_PROTOCOL_VERSION,
    requestId: event.data.requestId,
    type: 'error',
    error: {
      code: 'SOLVER_NOT_IMPLEMENTED',
      stage: 'solve',
      userMessage: 'Solving is not implemented in the framework milestone.',
      recoverable: true
    }
  });
};
