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
      nodePositionsM: new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
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
    documentState.material = { youngsModulusPa: 210e9, poissonsRatio: 0.3, densityKgM3: 7850 };
    documentState.boundaryConditions = [{ id: 'support-1', name: 'Fixed', type: 'support', faceIds: ['fixed'], componentsM: { x: 0, y: 0, z: 0 } }];
    documentState.loads = [{ id: 'load-1', name: 'Load', type: 'total-force', faceIds: ['loaded'], forceN: [0, 0, -1000] }];
    return documentState;
  }

  var documentState = analysis();
  var controller = new api.AppController({ document: documentState });
  var input = api.prepareSolverInput(documentState);
  assert(input.constraintStability && input.constraintStability.basis === 'mesh' && input.constraintStability.rank === 6,
    'solver input omitted mesh-exact rigid-body stability metadata');
  var sourceByteLength = documentState.mesh.nodePositionsM.byteLength;
  var progressStages = [];
  var client = new api.SolverClient({ onProgress: function (item) { progressStages.push(item.stage); } });
  var revision = controller.beginSolvePreflight();
  client.preflight(input, revision, 8).then(function (preflight) {
    assert(documentState.mesh.nodePositionsM.byteLength === sourceByteLength, 'preflight detached the controller-owned mesh');
    assert(preflight.exactNnz > 0 && preflight.degreeOfFreedomCount === 12, 'native preflight counts were invalid');
    assert(preflight.wasmHeapCapBytes === 3758096384, 'configured WASM cap was not surfaced');
    assert(preflight.constraintStability && preflight.constraintStability.rank === 6,
      'solve preflight omitted mesh-exact rigid-body stability metadata');
    assert(controller.completeSolvePreflight(revision, preflight), 'current preflight was discarded');
    controller.beginSolve();
    return client.solve(revision, documentState.solveSettings, false);
  }).then(function (result) {
    assert(api.validateResultModel(result, revision).valid, 'WASM result model failed runtime validation');
    assert(result.solverStatistics.finalRelativeResidual < 1e-8, 'Tet4 solve did not converge to tolerance');
    assert(result.equilibrium.relativeResidual < 1e-6, 'reaction equilibrium check failed');
    assert(result.extrema.rawVonMisesMax.valuePa > 0, 'raw stress peak was not recovered');
    assert(result.extrema.displayedVonMisesMax.valuePa > 0, 'smoothed surface stress was not prepared');
    assert(controller.completeSolve(revision, result), 'current solve result was discarded');
    assert(documentState.viewportPresentation.mode === 'stress' && documentState.viewportPresentation.field === 'vonMises',
      'Stress/von Mises was not activated after solve');
    controller.replaceViewportPresentation(Object.assign({}, documentState.viewportPresentation, { mode: 'mesh' }));
    assert(documentState.results === result, 'presentation-only mode switch changed solved data');
    controller.replaceMaterial({ youngsModulusPa: 200e9, poissonsRatio: 0.3, densityKgM3: 7850 });
    assert(documentState.results === null && documentState.resultInvalidation.stale, 'engineering edit did not mark results stale');
    assert(progressStages.indexOf('preflight') >= 0 && progressStages.indexOf('solve') >= 0 && progressStages.indexOf('visualization') >= 0,
      'coarse solver progress stages were not reported');
    status.textContent = 'Passed'; status.dataset.result = 'passed';
  }).catch(function (error) {
    status.textContent = error.message; status.dataset.result = 'failed'; throw error;
  }).finally(function () { client.dispose(); });
}(globalThis));
