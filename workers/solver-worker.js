'use strict';
self.onmessage = function (event) {
  self.postMessage({ protocol: 1, requestId: event.data.requestId, type: 'error', error: { code: 'SOLVER_NOT_IMPLEMENTED', stage: 'solve', userMessage: 'Solving is not implemented in the framework milestone.', recoverable: true } });
};
