(function (root) {
  'use strict';
  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.WORKER_PROTOCOL_VERSION = 1;
  root.SpjutsimFEA.isWorkerMessage = function (message) {
    return Boolean(message && message.protocol === 1 && typeof message.type === 'string' && typeof message.requestId === 'string');
  };
  root.SpjutsimFEA.isStructuredWorkerError = function (error) {
    return Boolean(
      error && typeof error === 'object' && !Array.isArray(error) &&
      typeof error.code === 'string' && error.code.length > 0 &&
      typeof error.stage === 'string' && error.stage.length > 0 &&
      typeof error.userMessage === 'string' && error.userMessage.length > 0 &&
      typeof error.recoverable === 'boolean'
    );
  };
  root.SpjutsimFEA.validateWorkerResponse = function (message, requestId, expectedType) {
    if (!root.SpjutsimFEA.isWorkerMessage(message)) {
      return { valid: false, reason: 'invalid-envelope' };
    }
    if (message.requestId !== requestId) {
      return { valid: false, reason: 'request-id-mismatch' };
    }
    if (message.type === 'error') {
      if (!root.SpjutsimFEA.isStructuredWorkerError(message.error)) {
        return { valid: false, reason: 'invalid-structured-error' };
      }
      return { valid: true, error: true };
    }
    if (message.type !== expectedType) {
      return { valid: false, reason: 'unexpected-response-type' };
    }
    if (!message.result || typeof message.result !== 'object' || Array.isArray(message.result)) {
      return { valid: false, reason: 'invalid-result' };
    }
    return { valid: true, error: false };
  };
}(globalThis));
