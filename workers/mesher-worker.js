'use strict';
self.onmessage = function (event) {
  self.postMessage({ protocol: 1, requestId: event.data.requestId, type: 'error', error: { code: 'MESHER_NOT_IMPLEMENTED', stage: 'mesh', userMessage: 'Meshing is not implemented in the framework milestone.', recoverable: true } });
};
