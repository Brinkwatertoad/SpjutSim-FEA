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
    if (kind === 'solver') {
      if (typeof runtime.fem !== 'string') {
        throw startupFailure(
          'FEM_RUNTIME_SOURCE_MISSING',
          'The local FEM runtime is unavailable. Rebuild the FEM WebAssembly artifact.',
          { worker: kind }
        );
      }
      return runtime.fem + '\n' + runtime[kind];
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

  function exerciseWorker(kind, timeoutMilliseconds) {
    var worker;
    if (kind === 'mesher') {
      return exerciseMesherRuntime();
    }
    return startLocalWorker(kind).then(function (startedWorker) {
      worker = startedWorker;
      return new Promise(function (resolve, reject) {
        var requestId = kind + '-startup-check';
        var settled = false;
        var timeout = root.setTimeout(function () {
          finish(startupFailure(
            'LOCAL_WORKER_RESPONSE_TIMEOUT',
            'The ' + kind + ' worker did not complete its startup check.',
            { worker: kind, request: 'startup-check' }
          ));
        }, timeoutMilliseconds || 10000);

        function finish(error, message) {
          if (settled) { return; }
          settled = true;
          root.clearTimeout(timeout);
          if (error) {
            reject(error);
            return;
          }
          resolve(message);
        }

        worker.onmessage = function (event) {
          var message = event.data;
          var validation;
          if (message && typeof message.requestId === 'string' && message.requestId !== requestId) {
            return;
          }
          validation = root.SpjutsimFEA.validateWorkerResponse(message, requestId, 'diagnostics-result');
          if (!validation.valid || validation.error || message.result.apiVersion !== 1 ||
              message.result.runtimeMode !== 'serial-local-embedded') {
            finish(startupFailure(
              'LOCAL_WORKER_INVALID_RESPONSE',
              'The ' + kind + ' worker returned an invalid startup response.',
              { worker: kind, reason: validation.reason || 'unexpected-error-code' }
            ));
            return;
          }
          finish(null, message);
        };
        worker.onerror = function (event) {
          finish(startupFailure(
            'LOCAL_WORKER_EXECUTION_FAILED',
            'The ' + kind + ' worker failed during its startup check.',
            { worker: kind, message: event.message || null }
          ));
        };
        worker.onmessageerror = function () {
          finish(startupFailure(
            'LOCAL_WORKER_MESSAGE_FAILED',
            'The ' + kind + ' worker could not exchange its startup response.',
            { worker: kind, request: 'startup-check' }
          ));
        };
        try {
          worker.postMessage({
            protocol: root.SpjutsimFEA.WORKER_PROTOCOL_VERSION,
            type: 'diagnostics',
            requestId: requestId
          });
        } catch (error) {
          finish(startupFailure(
            'LOCAL_WORKER_MESSAGE_FAILED',
            'The ' + kind + ' worker could not receive its startup request.',
            { worker: kind, message: error && error.message }
          ));
        }
      });
    }).finally(function () {
      if (worker) { worker.terminate(); }
    });
  }

  function expectedMesherResponseType(requestType) {
    return requestType === 'box-smoke' ? 'box-smoke-result' : 'diagnostics-result';
  }

  function requestWorker(worker, type, timeoutMilliseconds) {
    return new Promise(function (resolve, reject) {
      var requestId = type + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
      var settled = false;
      var timeout = root.setTimeout(function () {
        finish(startupFailure(
          'LOCAL_WORKER_RESPONSE_TIMEOUT',
          'The mesher did not complete its ' + type + ' request.',
          { worker: 'mesher', request: type }
        ));
      }, timeoutMilliseconds || 120000);

      function finish(error, message) {
        if (settled) { return; }
        settled = true;
        root.clearTimeout(timeout);
        if (error) {
          reject(error);
          return;
        }
        resolve(message);
      }

      worker.onmessage = function (event) {
        var message = event.data;
        var validation;
        if (message && typeof message.requestId === 'string' && message.requestId !== requestId) {
          return;
        }
        validation = root.SpjutsimFEA.validateWorkerResponse(
          message,
          requestId,
          expectedMesherResponseType(type)
        );
        if (!validation.valid) {
          finish(startupFailure(
            'LOCAL_WORKER_INVALID_RESPONSE',
            'The mesher returned an invalid ' + type + ' response.',
            { worker: 'mesher', request: type, reason: validation.reason }
          ));
          return;
        }
        if (validation.error) {
          var failure = new Error(message.error.userMessage);
          failure.diagnostic = message.error;
          finish(failure);
          return;
        }
        finish(null, message);
      };
      worker.onerror = function (event) {
        finish(startupFailure(
          'LOCAL_WORKER_EXECUTION_FAILED',
          'The mesher failed while processing ' + type + '.',
          { worker: 'mesher', request: type, message: event.message || null }
        ));
      };
      worker.onmessageerror = function () {
        finish(startupFailure(
          'LOCAL_WORKER_MESSAGE_FAILED',
          'The mesher could not exchange its ' + type + ' response.',
          { worker: 'mesher', request: type }
        ));
      };
      try {
        worker.postMessage({
          protocol: root.SpjutsimFEA.WORKER_PROTOCOL_VERSION,
          type: type,
          requestId: requestId
        });
      } catch (error) {
        finish(startupFailure(
          'LOCAL_WORKER_MESSAGE_FAILED',
          'The mesher could not receive its ' + type + ' request.',
          { worker: 'mesher', request: type, message: error && error.message }
        ));
      }
    });
  }

  function validMesherDiagnostics(result) {
    return Boolean(
      result && typeof result.gmshVersion === 'string' && result.gmshVersion.length > 0 &&
      result.runtimeMode === 'serial-local-embedded' &&
      result.capabilities && typeof result.capabilities === 'object' &&
      Number.isFinite(result.wasmMemoryBytes) && result.wasmMemoryBytes > 0
    );
  }

  function exerciseMesherRuntime() {
    var worker;
    return startLocalWorker('mesher').then(function (startedWorker) {
      worker = startedWorker;
      return requestWorker(worker, 'diagnostics');
    }).then(function (diagnosticsMessage) {
      if (!validMesherDiagnostics(diagnosticsMessage.result)) {
        throw startupFailure(
          'GMSH_DIAGNOSTICS_INVALID',
          'The local geometry engine returned invalid diagnostics.',
          { worker: 'mesher', result: diagnosticsMessage.result || null }
        );
      }
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
