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
    root.SpjutsimLocalRuntimeWorkers = { solver: "'use strict';", fem: "'use strict';" };
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
      geometryId: 'geometry-test', sourceName: 'cube.step', sourceFormat: 'step', orientation: api.identityRigidOrientation(),
      faceIds: ['opaque-face'], boundingBoxM: { minM: [0, 0, 0], maxM: [1, 1, 1] }, volumeM3: 1,
      preview: {
        positionsM: new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
        normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
        indices: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
        faceRanges: [{ faceId: 'opaque-face', start: 0, count: 12 }],
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

  function validResultModel() {
    var scalar = new Float32Array([10, 20, 30, 40]);
    return {
      schemaVersion: 1, analysisRevision: 0, elementType: 'tet4',
      originalSurface: {
        nodePositionsM: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
        triangleConnectivity: new Uint32Array([0, 2, 1]), faceIds: ['opaque-face'],
        triangleFaceIndices: new Uint32Array([0]), triangleElementIndices: new Uint32Array([0])
      },
      displacementM: new Float64Array([0, 0, 0, 0.01, 0, 0, 0, 0.01, 0, 0, 0, 0.01]),
      displacementMagnitudeM: new Float64Array([0, 0.01, 0.01, 0.01]),
      reactionsN: new Float64Array(12),
      rawElementFields: { strain: new Float64Array(6), stressPa: new Float64Array(6),
        vonMisesPa: new Float64Array([40]), maxPrincipalPa: new Float64Array([30]), minPrincipalPa: new Float64Array([-10]) },
      surfaceFields: { vonMisesPa: scalar, maxPrincipalPa: new Float32Array(scalar), minPrincipalPa: new Float32Array(scalar),
        displacementMagnitudeM: new Float32Array([0, 0.01, 0.01, 0.01]), uxM: new Float32Array([0, 0.01, 0, 0]),
        uyM: new Float32Array([0, 0, 0.01, 0]), uzM: new Float32Array([0, 0, 0, 0.01]) },
      ranges: { vonMises: { minimum: 10, maximum: 40 }, maxPrincipal: { minimum: 10, maximum: 40 },
        minPrincipal: { minimum: 10, maximum: 40 }, displacementMagnitude: { minimum: 0, maximum: 0.01 },
        ux: { minimum: 0, maximum: 0.01 }, uy: { minimum: 0, maximum: 0.01 }, uz: { minimum: 0, maximum: 0.01 } },
      extrema: { maxDisplacement: { valueM: 0.01 }, rawVonMisesMax: { valuePa: 40 },
        displayedVonMisesMax: { valuePa: 40 }, rawMaxPrincipal: { valuePa: 30 }, rawMinPrincipal: { valuePa: -10 } },
      equilibrium: { totalReactionN: [-1, 0, 0], totalAppliedForceN: [1, 0, 0], relativeResidual: 0 },
      solverStatistics: { iterations: 1, finalRelativeResidual: 0, solveDurationMs: 1, wasmMemoryBytes: 16777216 },
      meshStatistics: { nodeCount: 4, elementCount: 1 }, preflight: {}, warnings: []
    };
  }

  function testGeometryContractAndInvalidation() {
    var geometry = validGeometry();
    var controller = new api.AppController({ document: api.createAnalysisDocument() });
    controller.document.boundaryConditions = [{ type: 'support', componentsM: { x: 0, y: 0, z: 0 } }];
    controller.document.loads = [{ type: 'pressure' }];
    controller.document.meshMetadata = { nodeCount: 4 };
    controller.document.results = { displacement: 1 };
    controller.replaceGeometry(geometry, { sourceName: 'cube.step', sourceFormat: 'step', sourceBytes: new Uint8Array([1]).buffer });
    assert(api.validateGeometryModel(geometry).valid, 'valid geometry contract was rejected');
    assert(controller.document.boundaryConditions.length === 0 && controller.document.loads.length === 0, 'geometry replacement retained boundary state');
    assert(controller.document.meshMetadata === null && controller.document.results === null, 'geometry replacement retained derived state');
    assert(controller.geometrySource.sourceBytes.byteLength === 1 && controller.geometrySource.sourceFormat === 'step', 'canonical CAD source was not retained');
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
    controller.replaceGeometry(validGeometry(), { sourceName: 'cube.step', sourceFormat: 'step', sourceBytes: new Uint8Array([2]).buffer });
    assert(controller.document.selectedFaceIds.length === 0, 'geometry replacement retained selected faces');
    geometry.preview.indices[2] = 4;
    assert(!api.validateGeometryModel(geometry).valid, 'out-of-range preview index was accepted');
    assert(api.sourceFormatForFilename('MODEL.STP') === 'step', 'STP format detection failed');
    assert(api.sourceFormatForFilename('model.IGES') === 'iges' && api.sourceFormatForFilename('model.igs') === 'iges', 'IGES format detection failed');
    assert(api.sourceFormatForFilename('model.BREP') === 'brep' && api.sourceFormatForFilename('model.obj') === null, 'BREP or unsupported format detection failed');
    assert(api.validateImportRequest({ sourceName: 'model.igs', sourceFormat: 'iges', sourceBytes: new Uint8Array([1]).buffer }).valid,
      'valid IGES import request was rejected');
    assert(!api.validateImportRequest({ sourceName: 'model.igs', sourceFormat: 'step', sourceBytes: new Uint8Array([1]).buffer }).valid,
      'source extension/format mismatch was accepted');
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

  function testOrientationInvalidationPreservesAuthoredSetup() {
    var controller = new api.AppController({ document: api.createAnalysisDocument() });
    var source = { sourceName: 'cube.step', sourceFormat: 'step', sourceBytes: new Uint8Array([8]).buffer };
    controller.replaceGeometry(validGeometry(), source);
    controller.replaceSelectedFaces(['opaque-face']);
    controller.document.material = { name: 'Test', youngsModulusPa: 1e9, poissonsRatio: 0.25 };
    controller.document.boundaryConditions = [{ id: 'support-1', name: 'Support 1', type: 'support', faceIds: ['opaque-face'], componentsM: { x: 0, y: 0, z: 0 } }];
    controller.document.loads = [{ id: 'load-1', name: 'Load 1', type: 'total-force', forceN: [1, 2, 3], faceIds: ['opaque-face'] }];
    controller.completeMeshGeneration(validVolumeMesh());
    controller.document.results = { solved: true };
    var revision = controller.document.analysisRevision;
    var sourceReference = controller.geometrySource;
    controller.rotateGeometryAroundGlobalAxis('z', 90);
    assert(controller.document.geometry.orientation.operations.join('') === 'Z +90°', 'controller did not update geometry orientation');
    assert(controller.document.material.name === 'Test' && controller.document.boundaryConditions.length === 1 && controller.document.loads.length === 1,
      'orientation discarded authored material, supports, or loads');
    assert(controller.document.selectedFaceIds.join('|') === 'opaque-face', 'orientation discarded selected CAD faces');
    assert(controller.geometrySource === sourceReference, 'orientation replaced the canonical CAD source');
    assert(controller.document.mesh === null && controller.document.meshMetadata === null && controller.document.results === null,
      'orientation retained stale mesh or results');
    assert(controller.document.analysisRevision === revision + 1 && controller.document.resultInvalidation.reason === 'orientation',
      'orientation did not advance the analysis revision with the correct reason');
  }

  function testCustomMeshPresetCanBeEntered() {
    var controller = new api.AppController({ document: api.createAnalysisDocument() });
    var ui = new api.UIController(controller);
    controller.replaceGeometry(validGeometry(), { sourceName: 'cube.step', sourceFormat: 'step', sourceBytes: new Uint8Array([1]).buffer });
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
    var controller = new api.AppController({ document: api.createAnalysisDocument() });
    var faceId = validGeometry().faceIds[0];
    var cameraBefore;
    var distanceBefore;
    viewport.setGeometryPreview(validGeometry());
    controller.replaceGeometry(validGeometry(), { sourceName: 'cube.step', sourceFormat: 'step', sourceBytes: new Uint8Array([9]).buffer });
    controller.replaceSelectedFaces([faceId]);
    var revisionBeforeSelectionClear = controller.document.analysisRevision;
    viewport.setFacePickHandler(function (pickedFaceId) {
      if (!pickedFaceId) { controller.clearSelectedFaces(); }
      else { controller.replaceSelectedFaces([pickedFaceId]); }
    });
    var rect = viewport.canvas.getBoundingClientRect();
    viewport.pointerClickListener({ button: 0, shiftKey: false, clientX: rect.left, clientY: rect.top });
    assert(controller.document.selectedFaceIds.length === 0, 'empty viewport click did not report a no-hit pick');
    assert(controller.document.analysisRevision === revisionBeforeSelectionClear, 'background selection clearing invalidated analysis results');
    controller.replaceSelectedFaces([faceId]);
    viewport.pointerDownListener({ pointerId: 81, pointerType: 'mouse', button: 0, clientX: rect.left, clientY: rect.top });
    viewport.pointerMoveListener({ pointerId: 81, pointerType: 'mouse', button: 0, clientX: rect.left + 20, clientY: rect.top + 10 });
    viewport.pointerUpListener({ pointerId: 81, pointerType: 'mouse', button: 0, clientX: rect.left + 20, clientY: rect.top + 10 });
    viewport.pointerClickListener({ button: 0, shiftKey: false, clientX: rect.left, clientY: rect.top });
    assert(controller.document.selectedFaceIds.length === 1, 'camera drag was misreported as a background click');
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
    var viewState = viewport.captureViewState();
    var result = validResultModel();
    viewport.setResultModel(result);
    viewport.setPresentation({ mode: 'stress', displayStyle: 'lines', field: 'vonMises', meshOverlay: false,
      deformationMode: 'undeformed', deformationScale: 0, userDeformationScale: 1 });
    assert(viewport.resultSurface.visible && viewport.resultSurface.geometry.getAttribute('color').array.some(function (value) { return value > 0; }),
      'Stress view did not prepare the contour surface');
    viewport.setPresentation({ mode: 'deformation', displayStyle: 'lines', field: 'displacementMagnitude', meshOverlay: true,
      deformationMode: 'user', deformationScale: 10, userDeformationScale: 10 });
    assert(Math.abs(viewport.resultSurface.geometry.getAttribute('position').array[3] - 1.1) < 1e-6,
      'user deformation scale was not applied');
    viewport.setDeformationAnimationMultiplier(0);
    assert(Math.abs(viewport.resultSurface.geometry.getAttribute('position').array[3] - 1) < 1e-6,
      'zero animation multiplier did not restore the undeformed shape');
    viewport.setDeformationAnimationMultiplier(0.5);
    assert(Math.abs(viewport.resultSurface.geometry.getAttribute('position').array[3] - 1.05) < 1e-6,
      'animation multiplier did not interpolate the deformation');
    viewport.setDeformationAnimationMultiplier(1);
    assert(viewport.resultDisplay.userData.lines.visible, 'compatible result view hid the requested mesh overlay');
    assert(JSON.stringify(viewport.captureViewState()) === JSON.stringify(viewState), 'result mode switches changed the camera');
    var resultGeometry = viewport.resultSurface.geometry;
    var disposedResultGeometry = false;
    var disposeResultGeometry = resultGeometry.dispose;
    resultGeometry.dispose = function () { disposedResultGeometry = true; disposeResultGeometry.call(resultGeometry); };
    viewport.setResultModel(null);
    assert(disposedResultGeometry && viewport.resultSurface === null, 'result GPU buffers were not disposed on invalidation');
    viewport.dispose();
  }

  function testDeformationAnimationControls() {
    var controller = new api.AppController({ document: api.createAnalysisDocument() });
    var ui = new api.UIController(controller);
    var originalRequestAnimationFrame = root.requestAnimationFrame;
    var originalCancelAnimationFrame = root.cancelAnimationFrame;
    var scheduledFrame = null;
    var effectiveMultiplier = null;
    var revision;
    var viewport = {
      setNavigationPreferences: function () {},
      setDeformationAnimationMultiplier: function (multiplier) { effectiveMultiplier = multiplier; }
    };
    controller.document.mesh = validVolumeMesh();
    controller.document.results = validResultModel();
    controller.document.viewportPresentation = {
      mode: 'deformation', displayStyle: 'lines', field: 'displacementMagnitude', meshOverlay: false,
      deformationMode: 'user', deformationScale: 200, userDeformationScale: 200
    };
    root.requestAnimationFrame = function (callback) { scheduledFrame = callback; return 17; };
    root.cancelAnimationFrame = function () {};
    try {
      ui.setViewportController(viewport);
      ui.renderViewportPresentation(controller.document);
      revision = controller.document.analysisRevision;
      assert(!ui.deformationAnimationToggle.hidden && !ui.deformationAnimationToggle.disabled,
        'deformation animation controls were unavailable for solved deformation results');
      ui.startDeformationAnimation();
      assert(ui.deformationAnimating && ui.deformationAnimationToggle.textContent === 'Stop' &&
        ui.deformationAnimationToggle.getAttribute('aria-pressed') === 'true',
      'Play did not expose the active Stop state');
      scheduledFrame(100);
      scheduledFrame(700);
      assert(Math.abs(effectiveMultiplier - 0.5) < 1e-12 && ui.deformationScaleReadout.textContent === 'x100',
        'animation did not interpolate the selected scale in the viewport and readout');
      assert(controller.document.analysisRevision === revision && controller.document.viewportPresentation.deformationScale === 200,
        'animation mutated analysis state or the selected deformation scale');
      ui.stopDeformationAnimation();
      assert(!ui.deformationAnimating && effectiveMultiplier === 1 && ui.deformationScale.value === '200' &&
        ui.deformationAnimationToggle.textContent === 'Play' && ui.deformationScaleReadout.textContent === 'x200',
      'Stop did not restore the selected deformation scale and Play state');
      ui.startDeformationAnimation();
      controller.document.viewportPresentation.mode = 'stress';
      ui.renderViewportPresentation(controller.document);
      assert(!ui.deformationAnimating && effectiveMultiplier === 1 && ui.deformationAnimationToggle.hidden,
        'leaving Deformation view did not stop and hide the animation');
      controller.document.viewportPresentation.mode = 'deformation';
      controller.document.viewportPresentation.deformationMode = 'undeformed';
      controller.document.viewportPresentation.deformationScale = 0;
      ui.renderViewportPresentation(controller.document);
      assert(ui.deformationAnimationToggle.disabled,
        'undeformed shape mode left the animation control enabled');
    } finally {
      ui.dispose();
      root.requestAnimationFrame = originalRequestAnimationFrame;
      root.cancelAnimationFrame = originalCancelAnimationFrame;
    }
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
      geometryId: 'geometry-test', sourceName: 'cube.step', sourceFormat: 'step', sourceBytes: original
    }).then(function () {
      assert(posted.sourceBytes !== original, 'canonical CAD bytes were transferred directly');
      assert(posted.sourceFormat === 'step', 'source format was not sent to the mesher');
      assert(original.byteLength === 3, 'canonical CAD bytes were detached');
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
      geometry: geometry, settings: { preset: 'normal', elementType: 'tet4' }, sourceBytes: original
    }).then(function (mesh) {
      assert(api.validateVolumeMeshResult(mesh, geometry.faceIds).valid, 'valid volume mesh contract was rejected');
      assert(posted.sourceBytes !== original, 'canonical CAD bytes were transferred directly for meshing');
      assert(posted.sourceFormat === 'step', 'geometry source format was not sent for remeshing');
      assert(posted.orientation && posted.orientation.rotation.join(',') === geometry.orientation.rotation.join(','),
        'geometry orientation was not sent for remeshing');
      assert(original.byteLength === 3, 'canonical CAD bytes were detached by meshing');
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
    var editorOpen = true;
    ui.analysisAuthoring = {
      start: function () {}, render: function () {},
      handleDocumentKeyDown: function (keyEvent) {
        if (!editorOpen) { return false; }
        editorOpen = false; keyEvent.preventDefault(); return true;
      }
    };
    controller.replaceGeometry(validGeometry(), { sourceName: 'cube.step', sourceFormat: 'step', sourceBytes: new Uint8Array([1]).buffer });
    controller.replaceSelectedFaces(['opaque-face']);
    ui.start();
    document.dispatchEvent(event);
    assert(controller.document.selectedFaceIds.length === 1, 'Escape cleared selection before closing the setup editor');
    assert(!editorOpen && event.defaultPrevented, 'Escape did not give the setup editor first priority');
    event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    document.dispatchEvent(event);
    assert(controller.document.selectedFaceIds.length === 0, 'Escape did not clear selected faces');
    assert(event.defaultPrevented, 'Escape did not consume the selection-clear shortcut');
    controller.replaceSelectedFaces(['opaque-face']);
    var menuGroup = document.querySelector('[data-ui-menu-group]');
    menuGroup.dataset.open = 'true';
    menuGroup.querySelector('[data-ui-menu-button]').setAttribute('aria-expanded', 'true');
    event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    assert(controller.document.selectedFaceIds.length === 1, 'Escape cleared selection instead of dismissing the open menu first');
    assert(menuGroup.dataset.open === 'false' && event.defaultPrevented, 'Escape did not dismiss and consume the open menu');
  }

  root.SpjutsimWorkerRuntimeTests = Promise.resolve().then(function () {
    testResponseValidation();
    testGeometryContractAndInvalidation();
    testPreviewRequiresOneRangePerFace();
    testOrientationInvalidationPreservesAuthoredSetup();
    testCustomMeshPresetCanBeEntered();
    testDisplayStyleIsAvailableInModelView();
    testViewportCameraNavigation();
    testDeformationAnimationControls();
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
