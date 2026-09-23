(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');
  function assert(condition, message) { if (!condition) { throw new Error(message); } }

  function tetraMesh() {
    var ranges = ['fixed', 'side-a', 'side-b', 'loaded'].map(function (faceId, index) {
      return { faceId: faceId, start: index * 3, count: 3 };
    });
    var map = {};
    ranges.forEach(function (range) { map[range.faceId] = Object.assign({}, range); });
    return {
      elementType: 'tet4',
      // Incline the fixed face so the free-node displacement components couple.
      nodePositionsM: new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0.3, 0, 0, 1]),
      elementConnectivity: new Uint32Array([0, 1, 2, 3]),
      boundaryFaces: { solverElementType: 'tri3', solverConnectivity: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]),
        solverFaceRanges: ranges.map(function (range) { return Object.assign({}, range); }),
        triangleConnectivity: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]), faceRanges: ranges },
      geometryFaceMap: map,
      statistics: { nodeCount: 4, elementCount: 1, boundaryTriangleCount: 4, boundaryElementCount: 4,
        minCharacteristicSizeM: 1, maxCharacteristicSizeM: Math.sqrt(2) },
      quality: { metric: 'gamma', minimum: 0.7, p05: 0.7, median: 0.7, poorElementCount: 0,
        minimumJacobian: 1, maximumEdgeRatio: Math.sqrt(2),
        invertedElementCount: 0, nearZeroJacobianCount: 0, warning: null },
      memoryInputs: { nodeCount: 4, elementCount: 1, degreeOfFreedomCount: 12,
        connectivityEntries: 4, boundaryConnectivityEntries: 12 }
    };
  }

  function analysis() {
    var documentState = api.createAnalysisDocument();
    documentState.geometry = { faceIds: ['fixed', 'side-a', 'side-b', 'loaded'] };
    documentState.mesh = tetraMesh();
    documentState.meshMetadata = { statistics: documentState.mesh.statistics, quality: documentState.mesh.quality,
      memoryInputs: documentState.mesh.memoryInputs };
    documentState.material = { youngsModulusPa: 210e9, poissonsRatio: 0.3, densityKgM3: 7850, tensileYieldPa: 250e6 };
    documentState.boundaryConditions = [{ id: 'support-1', name: 'Fixed', type: 'support', faceIds: ['fixed'], componentsM: { x: 0, y: 0, z: 0 } }];
    documentState.loads = [{ id: 'load-1', name: 'Load', type: 'total-force', faceIds: ['loaded'], forceN: [0, 0, -1000] }];
    return documentState;
  }

  async function zeroStressProjectRoundTrip() {
    var mesh = tetraMesh();
    mesh.nodePositionsM[8] = 0; // Unit right tetrahedron: exact linear derivatives.
    var geometry = {
      geometryId: 'zero-stress', sourceName: 'tetra.step', sourceFormat: 'step',
      orientation: api.identityRigidOrientation(),
      faceIds: mesh.boundaryFaces.faceRanges.map(function (range) { return range.faceId; }),
      boundingBoxM: {minM: [0, 0, 0], maxM: [1, 1, 1]}, volumeM3: 1 / 6,
      preview: {positionsM: mesh.nodePositionsM, normals: new Float32Array(12),
        indices: mesh.boundaryFaces.triangleConnectivity, faceRanges: mesh.boundaryFaces.faceRanges,
        featureEdges: {positionsM: new Float64Array(0), indices: new Uint32Array(0)}}
    };
    var app = new api.AppController({document: api.createAnalysisDocument()});
    // The source is only packaged here; actual CAD import has separate round-trip coverage.
    app.replaceGeometry(geometry, {sourceName: 'tetra.step', sourceFormat: 'step', sourceBytes: new Uint8Array([1]).buffer});
    app.replaceMaterial({youngsModulusPa: 1048576, poissonsRatio: 0, tensileYieldPa: 250e6});
    app.replaceMeshSettings({elementType: 'tet4', preset: 'normal'});
    app.document.mesh = mesh;
    app.replaceSelectedFaces(geometry.faceIds);
    app.createBoundaryCondition({type: 'support', componentsM: {x: 1 / 1024, y: 0, z: 0}});
    var solver = new api.SolverClient();
    try {
      var revision = app.beginSolvePreflight();
      app.completeSolvePreflight(revision, await solver.preflight(api.prepareSolverInput(app.document), revision));
      app.beginSolve();
      app.completeSolve(revision, await solver.solve(revision, app.document.solveSettings, true));
      var result = app.document.results;
      assert(api.validateResultModel(result, revision).valid && result.extrema.rawVonMisesMax.valuePa === 0,
        'Rigid translation must produce a valid zero-stress result');
      assert(result.factorOfSafety.rawMinimum.value === Infinity, 'Zero-stress FoS must remain unbounded');
      app.replaceViewportPresentation(Object.assign({}, app.document.viewportPresentation, {field: 'factorOfSafety'}));
      var blob = await api.writeProjectFile(await api.createProjectSnapshot(app, {includeDerived: true}));
      var saved = await api.readProjectFile(blob);
      var restored = api.prepareProjectCandidate(saved, geometry);
      assert(!restored.cacheWarning && restored.document.results.factorOfSafety.rawMinimum.value === Infinity,
        'Cached zero-stress results lost their unbounded FoS');
      assert(restored.document.viewportPresentation.field === 'factorOfSafety', 'Reopening lost the FoS view');
      assert(restored.document.results.surfaceFields.factorOfSafety.every(function (value) { return value === 10; }),
        'Reopened infinite FoS must retain finite capped contour values');
      assert(restored.document.solvePreflight.status === 'idle', 'Cached results restored prepared solver state');
      assert(app.document.results === result && result.factorOfSafety.rawMinimum.value === Infinity,
        'Saving modified the installed results');
      result.solverStatistics.strainEnergyJ = Infinity;
      var rejected = false;
      try { await api.writeProjectFile(await api.createProjectSnapshot(app, {includeDerived: true})); }
      catch (error) { rejected = true; }
      assert(rejected, 'Nonfinite physical result metadata must still be rejected');
    } finally { solver.dispose(); }
  }

  var documentState = analysis();
  var controller = new api.AppController({ document: documentState });
  var input = api.prepareSolverInput(documentState);
  assert(input.constraintStability && input.constraintStability.basis === 'mesh' && input.constraintStability.rank === 6,
    'solver input omitted mesh-exact rigid-body stability metadata');
  var sourceByteLength = documentState.mesh.nodePositionsM.byteLength;
  var progressStages = [];
  var iterationProgress = [];
  var client = new api.SolverClient({ onProgress: function (item) {
    progressStages.push(item.stage);
    if (item.stage === 'solve' && /iteration /i.test(item.userMessage)) { iterationProgress.push(item.userMessage); }
  } });
  var revision = controller.beginSolvePreflight();
  client.preflight(input, revision, 8).then(function (preflight) {
    assert(progressStages.indexOf('preflight') >= 0, 'Preflight progress was not reported');
    assert(documentState.mesh.nodePositionsM.byteLength === sourceByteLength, 'preflight detached the controller-owned mesh');
    assert(preflight.exactNnz > 0 && preflight.degreeOfFreedomCount === 12, 'native preflight counts were invalid');
    assert(preflight.wasmHeapCapBytes === 3758096384, 'configured WASM cap was not surfaced');
    assert(preflight.constraintStability && preflight.constraintStability.rank === 6,
      'solve preflight omitted mesh-exact rigid-body stability metadata');
    assert(controller.completeSolvePreflight(revision, preflight), 'current preflight was discarded');
    controller.beginSolve();
    return client.solve(revision, { relativeTolerance: 1e-14, equilibriumTolerance: 1e-6, maxIterations: 1 }, false)
      .then(function () { throw new Error('One-iteration solve accepted an unconverged result'); }, function (error) {
        assert(error.diagnostic && error.diagnostic.code === 'SOLVER_NOT_CONVERGED' &&
          error.diagnostic.diagnostics.iterations === 1, 'Budget failure omitted native solver diagnostics');
        assert(progressStages.indexOf('recovery') < 0, 'Failed solve announced result recovery');
        assert(iterationProgress.length >= 2, 'Budget failure omitted its final progress');
        progressStages = []; iterationProgress = [];
        return client.solve(revision, documentState.solveSettings, false);
      });
  }).then(async function (result) {
    assert(api.validateResultModel(result, revision).valid, 'WASM result model failed runtime validation');
    assert(result.rangeMetadataVersion === 1 && result.extrema.rawVonMisesMax.locationOwner === 'solver-sample' &&
      result.extrema.displayedVonMisesMax.locationOwner === 'surface-node', 'result peak ownership was not versioned');
    function rejects(changes, message) {
      assert(!api.validateResultModel(Object.assign({}, result, changes), revision).valid, message);
    }
    rejects({ rangeMetadataVersion: 99 }, 'unknown range metadata version was accepted');
    rejects({ ranges: Object.assign({}, result.ranges, { vonMises: Object.assign({}, result.ranges.vonMises,
      { maximum: result.ranges.vonMises.maximum + 1 }) }) }, 'contradictory surface range was accepted');
    rejects({ extrema: Object.assign({}, result.extrema, { rawVonMisesMax: Object.assign({}, result.extrema.rawVonMisesMax,
      { valuePa: result.extrema.rawVonMisesMax.valuePa + 1 }) }) }, 'contradictory solver-sample peak was accepted');
    rejects({ extrema: Object.assign({}, result.extrema, { rawVonMisesMax: Object.assign({}, result.extrema.rawVonMisesMax,
      { elementIndex: 999 }) }) }, 'sample-to-element linkage was not validated');
    rejects({ extrema: Object.assign({}, result.extrema, { rawVonMisesMax: Object.assign({}, result.extrema.rawVonMisesMax,
      { locationM: [Infinity, 0, 0] }) }) }, 'nonfinite recovery location was accepted');
    rejects({ extrema: Object.assign({}, result.extrema, { displayedVonMisesMax: Object.assign({}, result.extrema.displayedVonMisesMax,
      { locationOwner: 'solver-sample' }) }) }, 'surface node was accepted as solver sample');
    assert(result.solverStatistics.finalRelativeResidual < 1e-8, 'Tet4 solve did not converge to tolerance');
    assert(iterationProgress.length >= 2 && /residual/i.test(iterationProgress[0]),
      'native solve omitted live iteration/residual progress');
    assert(progressStages.indexOf('assembly') < progressStages.indexOf('solve') &&
      progressStages.lastIndexOf('solve') < progressStages.indexOf('recovery'),
      'native solver phase progress was out of order');
    var memoryPhases = result.solverStatistics.wasmMemoryByPhaseBytes;
    assert(memoryPhases && ['inputLoaded', 'graphPreflight', 'assembly', 'solve', 'postprocess'].every(function (phase) {
      return Number.isFinite(memoryPhases[phase]) && memoryPhases[phase] > 0;
    }), 'solver result omitted phase memory high-water measurements');
    assert(result.solverStatistics.wasmMemoryHighWaterBytes === memoryPhases.postprocess &&
      memoryPhases.inputLoaded <= memoryPhases.graphPreflight && memoryPhases.graphPreflight <= memoryPhases.assembly &&
      memoryPhases.assembly <= memoryPhases.solve && memoryPhases.solve <= memoryPhases.postprocess,
    'solver memory high-water measurements were not monotonic');
    assert(result.equilibrium.relativeResidual < 1e-6, 'reaction equilibrium check failed');
    assert(result.extrema.rawVonMisesMax.valuePa > 0, 'raw stress peak was not recovered');
    assert(result.extrema.displayedVonMisesMax.valuePa > 0, 'smoothed surface stress was not prepared');
    assert(controller.completeSolve(revision, result), 'current solve result was discarded');
    assert(documentState.results.factorOfSafety && documentState.results.factorOfSafety.rawMinimum.value > 0,
      'yield-based factor of safety was not added to the trusted result');
    assert(documentState.results.convergenceStatus === 'not-run' && documentState.results.assumptions.length === 4,
      'single-solve trust metadata was incomplete');
    var trustedResult = documentState.results;
    assert(documentState.viewportPresentation.mode === 'stress' && documentState.viewportPresentation.field === 'vonMises',
      'Stress/von Mises was not activated after solve');
    controller.replaceViewportPresentation(Object.assign({}, documentState.viewportPresentation, { mode: 'mesh' }));
    assert(documentState.results === trustedResult, 'presentation-only mode switch changed solved data');
    controller.replaceMaterial({ youngsModulusPa: 200e9, poissonsRatio: 0.3, densityKgM3: 7850 });
    assert(documentState.results === null && documentState.resultInvalidation.stale, 'engineering edit did not mark results stale');
    assert(progressStages.indexOf('assembly') >= 0 && progressStages.indexOf('solve') >= 0 && progressStages.indexOf('visualization') >= 0,
      'coarse solver progress stages were not reported');
    await zeroStressProjectRoundTrip();
    status.textContent = 'Passed'; status.dataset.result = 'passed';
  }).catch(function (error) {
    status.textContent = error.message; status.dataset.result = 'failed'; throw error;
  }).finally(function () { client.dispose(); });
}(globalThis));
