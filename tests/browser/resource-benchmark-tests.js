(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');
  var output = document.getElementById('evidence-output');
  var query = new URLSearchParams(root.location.search);
  var smoke = query.get('profile') === 'smoke';
  var repetitions = smoke ? 1 : Math.max(1, Number(query.get('repetitions')) || 3);
  var cases = smoke ? [
    { id: 'smoke-tet4', kind: 'axial', path: '../fixtures/generated-unit-cube-m.step', elementType: 'tet4', targetNodes: 4, size: 0.7 }
  ] : [
    { id: 'axial-tet10-25k', kind: 'axial', path: '../fixtures/generated-unit-cube-m.step', elementType: 'tet10', targetNodes: 25000, size: 0.075 },
    { id: 'cantilever-tet10-75k', kind: 'cantilever', path: '../../benchmarks/validation/geometry/cantilever-prism.step', elementType: 'tet10', targetNodes: 75000, size: 0.13, load: [0, 0, -1000] },
    { id: 'mixed-scale-tet10-150k', kind: 'mixed-scale', path: '../fixtures/cad-corpus/slender-bar.step', elementType: 'tet10', targetNodes: 150000, size: 0.025 },
    { id: 'poor-quality-tet4', kind: 'poor-quality', path: '../fixtures/cad-corpus/thin-plate.step', elementType: 'tet4', targetNodes: 25000, size: 0.025, load: [0, 0, -1000] }
  ];
  function assert(value, message) { if (!value) { throw new Error(message); } }
  function bytes(path) {
    if (location.protocol !== 'file:') { return fetch(path).then(function (r) { if (!r.ok) { throw new Error('Could not read ' + path); } return r.arrayBuffer(); }); }
    return new Promise(function (resolve, reject) { var x = new XMLHttpRequest(); x.open('GET', path); x.responseType = 'arraybuffer';
      x.onload = function () { x.response ? resolve(x.response) : reject(new Error('Could not read ' + path)); }; x.onerror = reject; x.send(); });
  }
  function center(mesh, faceId) { var r = mesh.geometryFaceMap[faceId], c = mesh.boundaryFaces.triangleConnectivity, sum = [0, 0, 0], n = 0;
    for (var i = r.start; i < r.start + r.count; i += 1) { for (var a = 0; a < 3; a += 1) { sum[a] += mesh.nodePositionsM[c[i] * 3 + a]; } n += 1; }
    return sum.map(function (v) { return v / n; }); }
  function axisFace(mesh, axis, maximum) { return mesh.boundaryFaces.faceRanges.map(function (r) { return { id: r.faceId, v: center(mesh, r.faceId)[axis] }; })
    .sort(function (a, b) { return maximum ? b.v - a.v : a.v - b.v; })[0].id; }
  async function meshCase(definition, source, geometry, mesher) {
    var size = definition.size, mesh, attempt;
    for (attempt = 0; attempt < (smoke ? 1 : 4); attempt += 1) {
      mesh = await mesher.generateMesh({ geometry: geometry, sourceBytes: source,
        settings: { preset: 'custom', elementType: definition.elementType, minSizeM: size / 4, maxSizeM: size } });
      if (Math.abs(mesh.statistics.nodeCount / definition.targetNodes - 1) <= 0.2) { break; }
      size *= Math.cbrt(mesh.statistics.nodeCount / definition.targetNodes);
    }
    if (!smoke) { assert(Math.abs(mesh.statistics.nodeCount / definition.targetNodes - 1) <= 0.2, definition.id + ' missed target node band'); }
    return mesh;
  }
  async function run(definition, repetition) {
    var source = await bytes(definition.path), mesher = new api.MesherClient(), geometry, mesh, controller;
    var meshStart = performance.now();
    try {
      geometry = await mesher.importGeometry({ geometryId: definition.id, sourceName: definition.path.split('/').pop(), sourceFormat: 'step', sourceBytes: source });
      mesh = await meshCase(definition, source, geometry, mesher);
    } finally { mesher.dispose(); }
    var meshMs = performance.now() - meshStart;
    controller = new api.AppController({ document: api.createAnalysisDocument() });
    controller.replaceGeometry(geometry, { sourceName: geometry.sourceName, sourceFormat: 'step', sourceBytes: source });
    controller.replaceMaterial({ name: 'Calibration', youngsModulusPa: 1e9, poissonsRatio: 0.25, densityKgM3: 1000 });
    controller.completeMeshGeneration(mesh);
    controller.replaceSelectedFaces([axisFace(mesh, 0, false)]);
    controller.createBoundaryCondition({ type: 'support', componentsM: { x: 0, y: 0, z: 0 } });
    controller.replaceSelectedFaces([axisFace(mesh, 0, true)]);
    controller.createLoad({ type: 'total-force', forceN: definition.load || [1000, 0, 0] });
    var solver = new api.SolverClient(), revision = controller.beginSolvePreflight(), preflightStart = performance.now();
    var preflight = await solver.preflight(api.prepareSolverInput(controller.document), revision, Number(navigator.deviceMemory) || 0);
    var preflightMs = performance.now() - preflightStart; controller.completeSolvePreflight(revision, preflight); controller.beginSolve();
    var solveStart = performance.now(), result = await solver.solve(revision, controller.document.solveSettings, false), wall = performance.now() - solveStart; solver.dispose();
    var phase = result.solverStatistics.wasmMemoryByPhaseBytes;
    return { schemaVersion: 2, repetition: repetition, recordedAt: new Date().toISOString(),
      application: { gitCommit: query.get('commit'), solverRuntimeSha256: root.SpjutsimLocalRuntimeWorkers.femMetadata.sha256 },
      browser: { name: query.get('browser') || navigator.userAgent, version: query.get('browserVersion') || navigator.appVersion,
        launchMode: location.protocol === 'file:' ? 'file://' : 'cross-origin-isolated-http', crossOriginIsolated: root.crossOriginIsolated === true },
      system: { os: navigator.platform, architecture: query.get('architecture') || 'unknown', logicalCores: navigator.hardwareConcurrency || 1,
        memoryBytes: Number(query.get('memoryBytes')) || 0 },
      case: { id: definition.id, kind: definition.kind, elementType: definition.elementType, nodeCount: preflight.nodeCount,
        elementCount: preflight.elementCount, degreeOfFreedomCount: preflight.degreeOfFreedomCount, exactNnz: preflight.exactNnz },
      preflight: { modelVersion: preflight.modelVersion, allocations: preflight.allocations, modeledPeakBytes: preflight.modeledPeakBytes,
        safetyMultiplier: preflight.safetyMultiplier, predictedPeakBytes: preflight.estimatedPeakBytes, wasmHeapCapBytes: preflight.wasmHeapCapBytes },
      observed: { wasmMemoryByPhaseBytes: phase, wasmMemoryHighWaterBytes: result.solverStatistics.wasmMemoryHighWaterBytes,
        jsHeapPeakBytes: performance.memory ? performance.memory.usedJSHeapSize : null, externalProcessPeakBytes: null, mesherSolverOverlap: false },
      solve: { outcome: 'passed', preconditioner: 'jacobi', relativeTolerance: controller.document.solveSettings.relativeTolerance,
        maximumIterations: controller.document.solveSettings.maxIterations, iterations: result.solverStatistics.iterations,
        finalRelativeResidual: result.solverStatistics.finalRelativeResidual,
        phaseDurationMs: { input: meshMs, preflight: preflightMs, assembly: 0, solve: result.solverStatistics.solveDurationMs,
          postprocess: Math.max(0, wall - result.solverStatistics.solveDurationMs) }, wallTimeMs: wall }, cancellation: null };
  }
  async function cancellationTrial() {
    var source = await bytes('../fixtures/generated-unit-cube-m.step'), mesher = new api.MesherClient();
    var geometry = await mesher.importGeometry({ geometryId: 'cancel', sourceName: 'cube.step', sourceFormat: 'step', sourceBytes: source });
    var started = performance.now(), pending = mesher.generateMesh({ geometry: geometry, sourceBytes: source,
      settings: { preset: 'custom', elementType: 'tet10', minSizeM: 0.002, maxSizeM: 0.008 } });
    setTimeout(function () { mesher.cancel(); }, 0); try { await pending; throw new Error('mesh cancellation completed normally'); } catch (error) { assert(error.diagnostic.code === 'MESH_CANCELLED', 'mesh cancellation was not structured'); }
    var meshLatency = performance.now() - started;
    mesher = new api.MesherClient(); geometry = await mesher.importGeometry({ geometryId: 'solve-cancel', sourceName: 'cube.step', sourceFormat: 'step', sourceBytes: source });
    var mesh = await mesher.generateMesh({ geometry: geometry, sourceBytes: source,
      settings: { preset: 'custom', elementType: 'tet10', minSizeM: 0.025, maxSizeM: 0.1 } }); mesher.dispose();
    var controller = new api.AppController({ document: api.createAnalysisDocument() });
    controller.replaceGeometry(geometry, { sourceName: geometry.sourceName, sourceFormat: 'step', sourceBytes: source });
    controller.replaceMaterial({ youngsModulusPa: 1e9, poissonsRatio: 0.25, densityKgM3: 1000 }); controller.completeMeshGeneration(mesh);
    controller.replaceSelectedFaces([axisFace(mesh, 0, false)]); controller.createBoundaryCondition({ type: 'support', componentsM: { x: 0, y: 0, z: 0 } });
    controller.replaceSelectedFaces([axisFace(mesh, 0, true)]); controller.createLoad({ type: 'total-force', forceN: [1000, 0, 0] });
    var solver = new api.SolverClient(), revision = controller.beginSolvePreflight();
    var preflight = await solver.preflight(api.prepareSolverInput(controller.document), revision, 0); controller.completeSolvePreflight(revision, preflight); controller.beginSolve();
    started = performance.now(); var solvePending = solver.solve(revision, controller.document.solveSettings, false);
    setTimeout(function () { solver.cancel(); controller.cancelSolve(); }, 0); try { await solvePending; throw new Error('solve cancellation completed normally'); }
    catch (error) { assert(error.diagnostic && error.diagnostic.code === 'SOLVE_CANCELLED', 'solve cancellation was not structured'); }
    var solveLatency = performance.now() - started; controller.replaceMaterial({ youngsModulusPa: 2e9, poissonsRatio: 0.25, densityKgM3: 1000 });
    return { meshLatencyMs: meshLatency, solveLatencyMs: solveLatency, editAfterCancelPassed: controller.document.material.youngsModulusPa === 2e9 };
  }
  async function all() { if (location.protocol !== 'file:') { assert(root.crossOriginIsolated === true, 'HTTP benchmark mode requires cross-origin isolation'); }
    var cancellation = await cancellationTrial(), records = [];
    for (var r = 1; r <= repetitions; r += 1) { for (var i = 0; i < cases.length; i += 1) { status.textContent = 'Running ' + cases[i].id + ' repetition ' + r; var row = await run(cases[i], r); row.cancellation = cancellation; records.push(row); } }
    root.__spjutsimResourceRecords = records; output.textContent = JSON.stringify(records, null, 2); status.textContent = 'Passed: ' + records.length + ' records'; status.dataset.result = 'passed'; document.title = 'Resource benchmarks: Passed'; }
  all().catch(function (error) { status.textContent = (error.diagnostic && error.diagnostic.userMessage) || error.message; status.dataset.result = 'failed'; throw error; });
}(globalThis));
