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
        normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        indices: new Uint32Array([0, 1, 2]),
        faceRanges: [{ faceId: 'opaque-face', start: 0, count: 3 }],
        featureEdges: { positionsM: new Float64Array([0, 0, 0, 1, 0, 0]), indices: new Uint32Array([0, 1]) }
      }
    };
  }

  function validVolumeMesh() {
    return {
      elementType: 'tet4',
      nodePositionsM: new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
      elementConnectivity: new Uint32Array([0, 1, 2, 3]),
      boundaryFaces: { triangleConnectivity: new Uint32Array([0, 2, 1]), faceRanges: [{ faceId: 'opaque-face', start: 0, count: 3 }] },
      geometryFaceMap: { 'opaque-face': { faceId: 'opaque-face', start: 0, count: 3 } },
      statistics: { nodeCount: 4, elementCount: 1, boundaryTriangleCount: 1, minCharacteristicSizeM: 1, maxCharacteristicSizeM: Math.sqrt(2) },
      quality: { metric: 'gamma', minimum: 0.7, p05: 0.7, median: 0.7, poorElementCount: 0, invertedElementCount: 0, nearZeroJacobianCount: 0, warning: null },
      memoryInputs: { nodeCount: 4, elementCount: 1, degreeOfFreedomCount: 12, connectivityEntries: 4, boundaryConnectivityEntries: 3 }
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
    controller.beginMeshGeneration();
    var mesh = validVolumeMesh();
    controller.completeMeshGeneration(mesh);
    assert(controller.document.mesh && controller.document.meshMetadata.statistics.elementCount === 1, 'valid volume mesh was not stored');
    assert(controller.document.viewportPresentation.mode === 'mesh', 'successful mesh did not activate Mesh view');
    controller.replaceViewportPresentation({ mode: 'model', displayStyle: 'wireframe' });
    assert(controller.document.viewportPresentation.displayStyle === 'wireframe', 'display style was not stored for Model view');
    assert(controller.document.mesh === mesh, 'presentation change invalidated mesh data');
    controller.replaceMeshSettings({ preset: 'coarse', elementType: 'tet4' });
    assert(controller.document.mesh === null && controller.document.meshMetadata === null && controller.document.results === null, 'mesh setting change did not invalidate derived state');
    assert(controller.document.selectedFaceIds.length === 1, 'mesh setting change cleared selected faces');
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

  function testPreviewRequiresOneRangePerFace() {
    var geometry = validGeometry();
    geometry.faceIds = ['face-a', 'face-b'];
    geometry.preview.positionsM = new Float64Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 0, 0, 1, 0, 0, 0, 1
    ]);
    geometry.preview.indices = new Uint32Array([0, 1, 2, 3, 4, 5]);
    geometry.preview.faceRanges = [
      { faceId: 'face-a', start: 0, count: 3 },
      { faceId: 'face-a', start: 3, count: 3 }
    ];
    assert(!api.validateGeometryModel(geometry).valid, 'duplicate preview FaceId ranges were accepted');
  }

  function testCustomMeshPresetCanBeEntered() {
    var controller = new api.AppController({ document: api.createAnalysisDocument() });
    var ui = new api.UIController(controller);
    controller.replaceGeometry(validGeometry(), { sourceName: 'cube.step', stepBytes: new Uint8Array([1]).buffer });
    ui.render(controller.document);
    ui.meshPreset.value = 'custom';
    ui.meshMinSize.value = '';
    ui.meshMaxSize.value = '';
    ui.updateMeshSettingsFromControls();
    assert(controller.document.meshSettings.preset === 'custom', 'custom preset reverted before sizes could be entered');
    assert(controller.document.meshSettings.minSizeM > 0 &&
      controller.document.meshSettings.minSizeM <= controller.document.meshSettings.maxSizeM,
      'custom preset did not receive a valid initial size range');
  }

  function testDisplayStyleIsAvailableInModelView() {
    var controller = new api.AppController({ document: api.createAnalysisDocument() });
    var ui = new api.UIController(controller);
    ui.render(controller.document);
    assert(!ui.displayStyle.disabled, 'display style was disabled in Model view');
    ui.displayStyle.value = 'wireframe';
    ui.updateViewportPresentation();
    assert(controller.document.viewportPresentation.displayStyle === 'wireframe', 'Model display style change was not applied');
  }

  function testViewportCameraNavigation() {
    var viewport = new api.ViewportController(document.getElementById('viewport'));
    var faceId = validGeometry().faceIds[0];
    var cameraBefore;
    var distanceBefore;
    viewport.setGeometryPreview(validGeometry());
    viewport.setPresentation({ mode: 'model', displayStyle: 'wireframe' });
    assert(!viewport.previewMesh.visible &&
      viewport.importedGeometry.getObjectByName('imported-geometry-feature-edges').visible,
      'Model wireframe exposed preview tessellation edges');
    viewport.setPresentation({ mode: 'model', displayStyle: 'lines' });
    assert(viewport.previewMesh.visible, 'shaded Model display did not restore the preview surface');
    viewport.setSelectedFaceIds([faceId]);
    cameraBefore = viewport.camera.position.clone();
    viewport.orbitByPixels(0, 24);
    assert(viewport.camera.position.distanceTo(cameraBefore) > 0.01, 'orbit input did not move the camera');
    assert(viewport.camera.position.y > cameraBefore.y, 'vertical orbit input used the unswapped pointer Y axis');
    assert(viewport.selectedFaceIds.has(faceId), 'orbit input changed the selected faces');
    distanceBefore = viewport.camera.position.distanceTo(viewport.viewTarget);
    viewport.zoomByWheelDelta(-120);
    assert(viewport.camera.position.distanceTo(viewport.viewTarget) < distanceBefore, 'wheel input did not zoom the camera');
    assert(viewport.selectedFaceIds.has(faceId), 'zoom input changed the selected faces');
    viewport.setMeshDisplay(validVolumeMesh());
    viewport.setPresentation({ mode: 'mesh', displayStyle: 'wireframe' });
    assert(viewport.meshSurface.material[0].wireframe && !viewport.meshDisplay.userData.lines.visible,
      'Mesh wireframe display was not applied');
    assert(!viewport.importedGeometry.getObjectByName('imported-geometry-feature-edges').visible,
      'Mesh view retained Model feature edges');
    viewport.dispose();
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

  function testMeshContractAndDedicatedTransferCopy() {
    var originalStartWorker = api.startLocalWorker;
    var original = new Uint8Array([1, 2, 3]).buffer;
    var posted;
    var geometry = validGeometry();
    var worker = {
      postMessage: function (message) {
        posted = message;
        root.setTimeout(function () {
          worker.onmessage({ data: { protocol: 1, requestId: message.requestId, type: 'mesh-result', result: validVolumeMesh() } });
        }, 0);
      },
      terminate: function () {}
    };
    api.startLocalWorker = function () { return Promise.resolve(worker); };
    return new api.MesherClient().generateMesh({
      geometry: geometry, settings: { preset: 'normal', elementType: 'tet4' }, stepBytes: original
    }).then(function (mesh) {
      assert(api.validateVolumeMeshResult(mesh, geometry.faceIds).valid, 'valid volume mesh contract was rejected');
      assert(posted.stepBytes !== original, 'canonical STEP bytes were transferred directly for meshing');
      assert(original.byteLength === 3, 'canonical STEP bytes were detached by meshing');
      mesh.boundaryFaces.triangleConnectivity[2] = 4;
      assert(!api.validateVolumeMeshResult(mesh, geometry.faceIds).valid, 'out-of-range boundary connectivity was accepted');
      mesh = validVolumeMesh();
      mesh.quality.nearZeroJacobianCount = 1;
      assert(!api.validateVolumeMeshResult(mesh, geometry.faceIds).valid, 'near-zero-Jacobian mesh was accepted as solver-ready');
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
    testPreviewRequiresOneRangePerFace();
    testCustomMeshPresetCanBeEntered();
    testDisplayStyleIsAvailableInModelView();
    testViewportCameraNavigation();
    testEscapeClearsFaceSelection();
    return testSolverTimeoutTerminatesWorker().then(testMesherClientUsesDedicatedTransferCopy).then(testMeshContractAndDedicatedTransferCopy);
  }).then(function () {
    status.textContent = 'Passed';
    status.dataset.result = 'passed';
  }).catch(function (error) {
    status.textContent = error.message;
    status.dataset.result = 'failed';
    throw error;
  });
}(globalThis));
