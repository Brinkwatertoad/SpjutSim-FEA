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

  function validGeometry() {
    return {
      geometryId: 'geometry-test', sourceName: 'cube.step', sourceFormat: 'step',
      faceIds: ['opaque-face'], boundingBoxM: { minM: [0, 0, 0], maxM: [1, 1, 1] }, volumeM3: 1,
      preview: {
        positionsM: new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
        faceRanges: [{ faceId: 'opaque-face', start: 0, count: 3 }]
      }
    };
  }

  function testGeometryContractAndInvalidation() {
    var geometry = validGeometry();
    var controller = new api.AppController({ document: api.createAnalysisDocument() });
    controller.document.boundaryConditions = [{ type: 'fixed' }];
    controller.document.loads = [{ type: 'pressure' }];
    controller.document.meshMetadata = { nodeCount: 4 };
    controller.document.results = { displacement: 1 };
    controller.replaceGeometry(geometry, { sourceName: 'cube.step', stepBytes: new Uint8Array([1]).buffer });
    assert(api.validateGeometryModel(geometry).valid, 'valid geometry contract was rejected');
    assert(controller.document.boundaryConditions.length === 0 && controller.document.loads.length === 0, 'geometry replacement retained boundary state');
    assert(controller.document.meshMetadata === null && controller.document.results === null, 'geometry replacement retained derived state');
    assert(controller.stepSource.stepBytes.byteLength === 1, 'canonical STEP source was not retained');
    controller.replaceSelectedFaces(['opaque-face']);
    assert(controller.document.selectedFaceIds.length === 1, 'face selection was not stored in application state');
    controller.toggleSelectedFace('opaque-face');
    assert(controller.document.selectedFaceIds.length === 0, 'face selection did not toggle off');
    controller.toggleSelectedFace('opaque-face');
    controller.clearSelectedFaces();
    assert(controller.document.selectedFaceIds.length === 0, 'face selection did not clear');
    try {
      controller.replaceSelectedFaces(['unknown-face']);
      throw new Error('unknown FaceId was accepted');
    } catch (error) {
      assert(error.message === 'Unknown CAD face identifier.', 'unknown FaceId did not report a stable error');
    }
    controller.replaceSelectedFaces(['opaque-face']);
    controller.replaceGeometry(validGeometry(), { sourceName: 'cube.step', stepBytes: new Uint8Array([2]).buffer });
    assert(controller.document.selectedFaceIds.length === 0, 'geometry replacement retained selected faces');
    geometry.preview.indices[2] = 3;
    assert(!api.validateGeometryModel(geometry).valid, 'out-of-range preview index was accepted');
    assert(api.isStepFilename('MODEL.STP') && !api.isStepFilename('model.iges'), 'STEP extension filtering is incorrect');
  }

  function testMesherClientUsesDedicatedTransferCopy() {
    var originalStartWorker = api.startLocalWorker;
    var original = new Uint8Array([1, 2, 3]).buffer;
    var posted;
    var worker = {
      postMessage: function (message) {
        posted = message;
        root.setTimeout(function () {
          worker.onmessage({ data: {
            protocol: 1, requestId: message.requestId, type: 'import-result', result: validGeometry()
          } });
        }, 0);
      },
      terminate: function () {}
    };
    api.startLocalWorker = function () { return Promise.resolve(worker); };
    return new api.MesherClient().importGeometry({
      geometryId: 'geometry-test', sourceName: 'cube.step', stepBytes: original
    }).then(function () {
      assert(posted.stepBytes !== original, 'canonical STEP bytes were transferred directly');
      assert(original.byteLength === 3, 'canonical STEP bytes were detached');
    }).finally(function () { api.startLocalWorker = originalStartWorker; });
  }

  function testEscapeClearsFaceSelection() {
    var controller = new api.AppController({ document: api.createAnalysisDocument() });
    var ui = new api.UIController(controller);
    var event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    controller.replaceGeometry(validGeometry(), { sourceName: 'cube.step', stepBytes: new Uint8Array([1]).buffer });
    controller.replaceSelectedFaces(['opaque-face']);
    ui.start();
    document.dispatchEvent(event);
    assert(controller.document.selectedFaceIds.length === 0, 'Escape did not clear selected faces');
    assert(event.defaultPrevented, 'Escape did not consume the selection-clear shortcut');
  }

  root.SpjutsimWorkerRuntimeTests = Promise.resolve().then(function () {
    testResponseValidation();
    testGeometryContractAndInvalidation();
    testEscapeClearsFaceSelection();
    return testSolverTimeoutTerminatesWorker().then(testMesherClientUsesDedicatedTransferCopy);
  }).then(function () {
    status.textContent = 'Passed';
    status.dataset.result = 'passed';
  }).catch(function (error) {
    status.textContent = error.message;
    status.dataset.result = 'failed';
    throw error;
  });
}(globalThis));
