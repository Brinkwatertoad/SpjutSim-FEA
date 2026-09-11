(async function (root) {
  'use strict';
  // Optional local diagnostic: the supplied funnel is not a redistributable fixture.
  var api = root.SpjutsimFEA, status = document.getElementById('test-status');
  var events = [], mesher, solver;
  var query = new URLSearchParams(location.search), remesh = query.get('surfaceMode') === 'remesh';
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
      normalization: 'none', surfaceMode: remesh ? 'remesh' : 'original', reconstructionToleranceM: null };
    if (remesh) { options.remeshFeatureAngleDegrees = 40; }
    var preset = query.get('preset') || 'coarse';
    mesher = new api.MesherClient({ onProgress: progress });
    var geometry = await mesher.importGeometry({ sourceName: name, sourceFormat: 'stl', sourceBytes: bytes, importOptions: options });
    mesher.dispose();
    mesher = new api.MesherClient({ onProgress: progress });
    var meshStarted = performance.now();
    var mesh = await mesher.generateMesh({ geometry: geometry, sourceBytes: bytes, settings: { preset: preset, elementType: 'tet10' } });
    var meshDurationMs = performance.now() - meshStarted;
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
    if (remesh) {
      assert(mesh.quality.stlBoundaryAreas && mesh.quality.warning.includes('boundary area') && preflight.warnings.includes(mesh.quality.warning),
        'Boundary area/load fidelity warning was lost before solving');
    }
    assert(app.completeSolvePreflight(revision, preflight), 'Preflight was discarded');
    app.beginSolve();
    var error, result, started = performance.now();
    try { result = await solver.solve(revision, app.document.solveSettings, false); }
    catch (failure) { error = failure.diagnostic; }
    if (remesh) {
      assert(result && !error && result.solverStatistics.finalRelativeResidual <= 1e-8 && result.equilibrium.relativeResidual < 1e-6,
        'Experimental funnel remesh did not produce a converged, balanced solution');
      assert(mesh.statistics.nodeCount < 99000 && mesh.quality.minimum > 1e-6, 'Experimental remesh retained the original oversized, low-quality discretization');
    } else {
      assert(!result && error && error.code === 'SOLVER_NOT_CONVERGED', 'Funnel must not publish an unconverged result');
      var stats = error.diagnostics;
      assert(stats.terminationReason === 6 && stats.durationMs >= 120000 && stats.durationMs < 130000,
        'Funnel did not terminate within the selected PCG time budget');
      assert(events.filter(function (item) { return item.stage === 'solve' && /iteration /.test(item.userMessage); }).length > 10,
        'Long-running WASM solve did not deliver ongoing progress');
      assert(!events.some(function (item) { return item.stage === 'recovery' || item.stage === 'visualization'; }),
        'Failed solve started result recovery');
    }
    // Straight Tet10 edges make corner tetrahedron volumes exact for this mode.
    var volume = 0, positions = mesh.nodePositionsM, elements = mesh.elementConnectivity;
    for (var element = 0; element < elements.length; element += 10) {
      var a = elements[element] * 3, b = elements[element + 1] * 3, c = elements[element + 2] * 3, d = elements[element + 3] * 3;
      var u = [0, 1, 2].map(function (axis) { return positions[b + axis] - positions[a + axis]; });
      var v = [0, 1, 2].map(function (axis) { return positions[c + axis] - positions[a + axis]; });
      var w = [0, 1, 2].map(function (axis) { return positions[d + axis] - positions[a + axis]; });
      volume += (u[0] * (v[1]*w[2]-v[2]*w[1]) - u[1] * (v[0]*w[2]-v[2]*w[0]) + u[2] * (v[0]*w[1]-v[1]*w[0])) / 6;
    }
    var evidence = { importOptions: options, supportFace: faces[0], pressureFace: faces[faces.length - 1],
      material: app.document.material, pressurePa: 1e6, preflight: preflight, quality: mesh.quality,
      preset: preset, meshDurationMs: meshDurationMs, statistics: mesh.statistics, sourceMetadata: geometry.sourceMetadata,
      sourceVolumeM3: geometry.volumeM3, meshVolumeM3: volume, relativeVolumeError: Math.abs(volume/geometry.volumeM3-1),
      wallTimeMs: performance.now() - started, error: error, solverStatistics: result && result.solverStatistics,
      equilibrium: result && result.equilibrium, extrema: result && result.extrema, events: events };
    root.__stlSolveEvidence = evidence;
    document.getElementById('report').textContent = JSON.stringify(evidence, null, 2);
    status.textContent = remesh ? 'Passed — experimental remesh converged; inspect refinement and geometry evidence separately' :
      'Passed — bounded nonconvergence with live progress; no result accepted in this trial';
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
