(async function (root) {
  'use strict';
  // Optional local diagnostic: the supplied funnel is not a redistributable fixture.
  var api = root.SpjutsimFEA, status = document.getElementById('test-status');
  var events = [], mesher, solver;
  function assert(value, message) { if (!value) { throw new Error(message); } }
  function progress(item) {
    events.push({ elapsedMs: performance.now(), stage: item.stage, userMessage: item.userMessage });
    document.getElementById('progress').textContent = item.userMessage;
  }
  try {
    var name = 'Better Vented Parametric Funnel.stl';
    var response = await fetch('../fixtures/stl/' + encodeURIComponent(name));
    assert(response.ok, 'Place the supplied funnel in tests/fixtures/stl before running this optional diagnostic.');
    var bytes = await response.arrayBuffer();
    var options = { version: 2, lengthUnit: 'mm', patchAngleDegrees: 40,
      normalization: 'none', surfaceMode: 'original', reconstructionToleranceM: null };
    mesher = new api.MesherClient({ onProgress: progress });
    var geometry = await mesher.importGeometry({ sourceName: name, sourceFormat: 'stl', sourceBytes: bytes, importOptions: options });
    mesher.dispose();
    mesher = new api.MesherClient({ onProgress: progress });
    var mesh = await mesher.generateMesh({ geometry: geometry, sourceBytes: bytes, settings: { preset: 'coarse', elementType: 'tet10' } });
    mesher.dispose();
    var app = new api.AppController({ document: api.createAnalysisDocument() });
    app.replaceGeometry(geometry, { sourceName: name, sourceFormat: 'stl', sourceBytes: bytes, importOptions: options });
    app.replaceMaterial({ name: 'ABS', youngsModulusPa: 2.4e9, poissonsRatio: 0.37, densityKgM3: 1050 });
    app.completeMeshGeneration(mesh);
    var faces = mesh.boundaryFaces.faceRanges.map(function (range) {
      var z = 0;
      for (var i = range.start; i < range.start + range.count; i++) {
        z += mesh.nodePositionsM[3 * mesh.boundaryFaces.triangleConnectivity[i] + 2];
      }
      return { id: range.faceId, z: z / range.count };
    }).sort(function (a, b) { return a.z - b.z; });
    app.replaceSelectedFaces([faces[0].id]);
    app.createBoundaryCondition({ type: 'support', componentsM: { x: 0, y: 0, z: 0 } });
    app.replaceSelectedFaces([faces[faces.length - 1].id]);
    app.createLoad({ type: 'pressure', pressurePa: 1e6 });
    app.replaceSolveTimeLimit(120000);
    solver = new api.SolverClient({ onProgress: progress });
    var revision = app.beginSolvePreflight();
    var preflight = await solver.preflight(api.prepareSolverInput(app.document), revision, 8);
    assert(app.completeSolvePreflight(revision, preflight), 'Preflight was discarded');
    app.beginSolve();
    var error, result, started = performance.now();
    try { result = await solver.solve(revision, app.document.solveSettings, false); }
    catch (failure) { error = failure.diagnostic; }
    assert(!result && error && error.code === 'SOLVER_NOT_CONVERGED', 'Funnel must not publish an unconverged result');
    var stats = error.diagnostics;
    assert(stats.terminationReason === 6 && stats.durationMs >= 120000 && stats.durationMs < 130000,
      'Funnel did not terminate within the selected PCG time budget');
    assert(events.filter(function (item) { return item.stage === 'solve' && /iteration /.test(item.userMessage); }).length > 10,
      'Long-running WASM solve did not deliver ongoing progress');
    assert(!events.some(function (item) { return item.stage === 'recovery' || item.stage === 'visualization'; }),
      'Failed solve started result recovery');
    var evidence = { importOptions: options, supportFace: faces[0], pressureFace: faces[faces.length - 1],
      material: app.document.material, pressurePa: 1e6, preflight: preflight, quality: mesh.quality,
      wallTimeMs: performance.now() - started, error: error, events: events };
    root.__stlSolveEvidence = evidence;
    document.getElementById('report').textContent = JSON.stringify(evidence, null, 2);
    status.textContent = 'Passed — bounded nonconvergence with live progress; no result accepted in this trial';
    status.dataset.result = 'passed';
  } catch (error) {
    status.textContent = 'Failed: ' + error.message;
    status.dataset.result = 'failed';
    throw error;
  } finally {
    if (mesher) { mesher.dispose(); }
    if (solver) { solver.dispose(); }
  }
}(globalThis));
