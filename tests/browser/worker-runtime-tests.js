(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');

  function assert(condition, message) {
    if (!condition) { throw new Error(message); }
  }

  function testResponseValidation() {
    var wrongType = api.validateWorkerResponse({
      protocol: 1,
      requestId: 'diagnostics-1',
      type: 'box-smoke-result',
      result: {}
    }, 'diagnostics-1', 'diagnostics-result');
    assert(!wrongType.valid && wrongType.reason === 'unexpected-response-type', 'wrong response type was accepted');

    var wrongProtocol = api.validateWorkerResponse({
      protocol: 2,
      requestId: 'diagnostics-1',
      type: 'diagnostics-result',
      result: {}
    }, 'diagnostics-1', 'diagnostics-result');
    assert(!wrongProtocol.valid && wrongProtocol.reason === 'invalid-envelope', 'version-mismatched response was accepted');

    var malformedError = api.validateWorkerResponse({
      protocol: 1,
      requestId: 'diagnostics-1',
      type: 'error',
      error: { code: 'BROKEN' }
    }, 'diagnostics-1', 'diagnostics-result');
    assert(!malformedError.valid && malformedError.reason === 'invalid-structured-error', 'malformed structured error was accepted');
  }

  function testSolverTimeoutTerminatesWorker() {
    var OriginalWorker = root.Worker;
    var worker;

    function SilentWorker() {
      worker = this;
      this.terminated = false;
      root.setTimeout(function () {
        worker.onmessage({ data: { protocol: 1, type: 'ready', worker: 'solver' } });
      }, 0);
    }
    SilentWorker.prototype.postMessage = function () {};
    SilentWorker.prototype.terminate = function () { this.terminated = true; };

    root.Worker = SilentWorker;
    root.SpjutsimLocalRuntimeWorkers = { solver: "'use strict';" };
    return api.exerciseWorker('solver', 10).then(function () {
      throw new Error('silent solver unexpectedly completed');
    }).catch(function (error) {
      assert(error.diagnostic && error.diagnostic.code === 'LOCAL_WORKER_RESPONSE_TIMEOUT', 'solver timeout was not structured');
      assert(worker.terminated, 'worker.terminated was false after timeout');
    }).finally(function () {
      root.Worker = OriginalWorker;
      delete root.SpjutsimLocalRuntimeWorkers;
    });
  }

  root.SpjutsimWorkerRuntimeTests = Promise.resolve().then(function () {
    testResponseValidation();
    return testSolverTimeoutTerminatesWorker();
  }).then(function () {
    status.textContent = 'Passed';
    status.dataset.result = 'passed';
  }).catch(function (error) {
    status.textContent = error.message;
    status.dataset.result = 'failed';
    throw error;
  });
}(globalThis));
