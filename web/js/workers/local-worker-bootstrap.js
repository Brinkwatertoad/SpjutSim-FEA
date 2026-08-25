(function (root) {
  'use strict';

  function startupError(code, userMessage, detail) {
    return {
      code: code,
      stage: 'worker-startup',
      userMessage: userMessage,
      recoverable: true,
      detail: detail || null
    };
  }

  function startupFailure(code, userMessage, detail) {
    var error = new Error(userMessage);
    error.diagnostic = startupError(code, userMessage, detail);
    return error;
  }

  function workerSource(kind) {
    var runtime = root.SpjutsimLocalRuntimeWorkers;
    if (!runtime || typeof runtime[kind] !== 'string') {
      throw startupFailure(
        'LOCAL_WORKER_SOURCE_MISSING',
        'The ' + kind + ' worker source is unavailable. Regenerate the local runtime artifacts.',
        { worker: kind }
      );
    }
    if (kind === 'mesher') {
      if (typeof runtime.gmsh !== 'string') {
        throw startupFailure(
          'GMSH_RUNTIME_SOURCE_MISSING',
          'The local geometry runtime is unavailable. Regenerate the Gmsh local runtime artifact.',
          { worker: kind }
        );
      }
      return runtime.gmsh + '\n' + runtime[kind];
    }
    return runtime[kind];
  }

  function startLocalWorker(kind) {
    var source;
    var url;
    var worker;
    try {
      source = workerSource(kind);
      url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      worker = new Worker(url);
    } catch (error) {
      if (url) { URL.revokeObjectURL(url); }
      return Promise.reject(error.diagnostic ? error : startupFailure(
        'LOCAL_WORKER_CREATE_FAILED',
        'The ' + kind + ' worker could not be started in this browser.',
        { worker: kind, message: error && error.message }
      ));
    }

    return new Promise(function (resolve, reject) {
      var settled = false;
      var readyTimeout = root.setTimeout(function () {
        finish(startupFailure(
          'LOCAL_WORKER_READY_TIMEOUT',
          'The ' + kind + ' worker did not report that it loaded.',
          { worker: kind }
        ));
      }, kind === 'mesher' ? 30000 : 10000);
      function finish(error) {
        if (settled) { return; }
        settled = true;
        root.clearTimeout(readyTimeout);
        URL.revokeObjectURL(url);
        if (error) {
          worker.terminate();
          reject(error);
          return;
        }
        resolve(worker);
      }

      worker.onmessage = function (event) {
        var message = event.data;
        if (message && message.protocol === root.SpjutsimFEA.WORKER_PROTOCOL_VERSION && message.type === 'ready' && message.worker === kind) {
          finish(null);
          return;
        }
        finish(startupFailure(
          'LOCAL_WORKER_INVALID_READY_MESSAGE',
          'The ' + kind + ' worker returned an invalid ready message.',
          { worker: kind }
        ));
      };
      worker.onerror = function (event) {
        finish(startupFailure(
          'LOCAL_WORKER_STARTUP_FAILED',
          'The ' + kind + ' worker failed while loading.',
          { worker: kind, message: event.message || null }
        ));
      };
      worker.onmessageerror = function () {
        finish(startupFailure(
          'LOCAL_WORKER_MESSAGE_FAILED',
          'The ' + kind + ' worker could not exchange its startup message.',
          { worker: kind }
        ));
      };
    });
  }

  function exerciseWorker(kind) {
    if (kind === 'mesher') {
      return exerciseMesherRuntime();
    }
    return startLocalWorker(kind).then(function (worker) {
      return new Promise(function (resolve, reject) {
        var requestId = kind + '-startup-check';
        var expectedCode = 'SOLVER_NOT_IMPLEMENTED';
        worker.onmessage = function (event) {
          var message = event.data;
          worker.terminate();
          if (!root.SpjutsimFEA.isWorkerMessage(message) || message.requestId !== requestId || message.type !== 'error' || !message.error || message.error.code !== expectedCode) {
            reject(startupFailure(
              'LOCAL_WORKER_INVALID_RESPONSE',
              'The ' + kind + ' worker returned an invalid startup response.',
              { worker: kind }
            ));
            return;
          }
          resolve(message);
        };
        worker.onerror = function (event) {
          worker.terminate();
          reject(startupFailure(
            'LOCAL_WORKER_EXECUTION_FAILED',
            'The ' + kind + ' worker failed during its startup check.',
            { worker: kind, message: event.message || null }
          ));
        };
        worker.postMessage({
          protocol: root.SpjutsimFEA.WORKER_PROTOCOL_VERSION,
          type: 'startup-check',
          requestId: requestId
        });
      });
    });
  }

  function requestWorker(worker, type, timeoutMilliseconds) {
    return new Promise(function (resolve, reject) {
      var requestId = type + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
      var timeout = root.setTimeout(function () {
        reject(startupFailure(
          'LOCAL_WORKER_RESPONSE_TIMEOUT',
          'The mesher did not complete its ' + type + ' request.',
          { worker: 'mesher', request: type }
        ));
      }, timeoutMilliseconds || 120000);
      worker.onmessage = function (event) {
        var message = event.data;
        if (!root.SpjutsimFEA.isWorkerMessage(message) || message.requestId !== requestId) {
          return;
        }
        root.clearTimeout(timeout);
        if (message.type === 'error') {
          var failure = new Error(message.error && message.error.userMessage || 'The mesher request failed.');
          failure.diagnostic = message.error;
          reject(failure);
          return;
        }
        resolve(message);
      };
      worker.onerror = function (event) {
        root.clearTimeout(timeout);
        reject(startupFailure(
          'LOCAL_WORKER_EXECUTION_FAILED',
          'The mesher failed while processing ' + type + '.',
          { worker: 'mesher', request: type, message: event.message || null }
        ));
      };
      worker.postMessage({
        protocol: root.SpjutsimFEA.WORKER_PROTOCOL_VERSION,
        type: type,
        requestId: requestId
      });
    });
  }

  function exerciseMesherRuntime() {
    var worker;
    return startLocalWorker('mesher').then(function (startedWorker) {
      worker = startedWorker;
      return requestWorker(worker, 'diagnostics');
    }).then(function (diagnosticsMessage) {
      return requestWorker(worker, 'box-smoke').then(function (smokeMessage) {
        var smoke = smokeMessage.result;
        if (!smoke || Math.abs(smoke.volume - 1) > 1e-9 || smoke.surfaceCount !== 6 || smoke.solidCount !== 1) {
          throw startupFailure(
            'GMSH_BOX_SMOKE_INVALID',
            'The local geometry engine returned an invalid box result.',
            { worker: 'mesher', result: smoke || null }
          );
        }
        return { diagnostics: diagnosticsMessage.result, smoke: smokeMessage.result };
      });
    }).finally(function () {
      if (worker) { worker.terminate(); }
    });
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.startLocalWorker = startLocalWorker;
  root.SpjutsimFEA.exerciseWorker = exerciseWorker;
  root.SpjutsimFEA.exerciseMesherRuntime = exerciseMesherRuntime;
}(globalThis));
