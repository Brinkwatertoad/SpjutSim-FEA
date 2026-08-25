(function (root) {
  'use strict';
  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.WORKER_PROTOCOL_VERSION = 1;
  root.SpjutsimFEA.isWorkerMessage = function (message) {
    return Boolean(message && message.protocol === 1 && typeof message.type === 'string' && typeof message.requestId === 'string');
  };
}(globalThis));
