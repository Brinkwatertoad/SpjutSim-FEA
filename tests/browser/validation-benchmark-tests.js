(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');
  var output = document.getElementById('evidence-output');
  var material = { name: 'Validation material', youngsModulusPa: 1e9, poissonsRatio: 0.25, densityKgM3: 1000, tensileYieldPa: 250e6 };
  var cases = [
    { id: 'axial-traction', manifest: '../../benchmarks/validation/cases/axial-traction.json', startSize: 0.2,
      supports: [{ axis: 0, side: 'min', components: { x: 0 } }, { axis: 1, side: 'min', components: { y: 0 } }, { axis: 2, side: 'min', components: { z: 0 } }],
      load: { axis: 0, side: 'max', definition: { type: 'total-force', forceN: [1000, 0, 0] } } },
    { id: 'cantilever-bending', manifest: '../../benchmarks/validation/cases/cantilever-bending.json', startSize: 0.3,
      supports: [{ axis: 0, side: 'min', components: { x: 0, y: 0, z: 0 } }],
      load: { axis: 0, side: 'max', definition: { type: 'total-force', forceN: [0, 0, -1000] } } },
    { id: 'uniform-pressure', manifest: '../../benchmarks/validation/cases/uniform-pressure.json', startSize: 0.2,
      supports: [{ axis: 0, side: 'min', components: { x: 0 } }, { axis: 1, side: 'min', components: { y: 0 } }, { axis: 2, side: 'min', components: { z: 0 } }],
      load: { axis: 0, side: 'max', definition: { type: 'pressure', pressurePa: 1000 } } },
    { id: 'gravity-reaction', manifest: '../../benchmarks/validation/cases/gravity-reaction.json', startSize: 0.2,
      supports: [{ axis: 2, side: 'min', components: { z: 0 } }, { axis: 0, side: 'min', components: { x: 0 } }, { axis: 1, side: 'min', components: { y: 0 } }],
      gravity: [0, 0, -9.81] },
    { id: 'notched-prism-stress', manifest: '../../benchmarks/validation/cases/notched-prism-stress.json', startSize: 0.25,
      supports: [{ axis: 0, side: 'min', components: { x: 0, y: 0, z: 0 } }],
      load: { axis: 0, side: 'max', definition: { type: 'total-force', forceN: [1000, 0, 0] } }, probeM: [1.5, 0.5, 0.1] }
  ];

  function assert(value, message) { if (!value) { throw new Error(message); } }
  function readBytes(path) {
    if (root.location.protocol !== 'file:') {
      return fetch(path).then(function (response) { if (!response.ok) { throw new Error('Could not read ' + path); } return response.arrayBuffer(); });
    }
    return new Promise(function (resolve, reject) {
      var request = new XMLHttpRequest();
      request.open('GET', path);
      request.responseType = 'arraybuffer';
      request.onload = function () { if (request.response) { resolve(request.response); } else { reject(new Error('Could not read ' + path)); } };
      request.onerror = function () { reject(new Error('Could not read ' + path)); };
      request.send();
    });
  }
  function readJson(path) { return readBytes(path).then(function (bytes) { return JSON.parse(new TextDecoder().decode(bytes)); }); }
  function faceCenter(mesh, faceId) {
    var range = mesh.geometryFaceMap[faceId]; var triangles = mesh.boundaryFaces.triangleConnectivity;
    var sum = [0, 0, 0]; var count = 0; var offset; var axis;
    for (offset = range.start; offset < range.start + range.count; offset += 1) {
      for (axis = 0; axis < 3; axis += 1) { sum[axis] += mesh.nodePositionsM[triangles[offset] * 3 + axis]; }
      count += 1;
    }
    return sum.map(function (value) { return value / count; });
  }
  function axisFace(mesh, axis, side) {
    return mesh.boundaryFaces.faceRanges.map(function (range) { return { id: range.faceId, value: faceCenter(mesh, range.faceId)[axis] }; })
      .sort(function (left, right) { return side === 'max' ? right.value - left.value : left.value - right.value; })[0].id;
  }
  function addSupport(controller, faceId, components) {
    controller.replaceSelectedFaces([faceId]);
    controller.createBoundaryCondition({ type: 'support', componentsM: components });
  }
  function recoveryLocation(mesh, element, sample) {
    var a = 0.5854101966249685; var b = 0.1381966011250105; var barycentric = [b, b, b, b];
    var edges = [[0, 1], [1, 2], [2, 0], [0, 3], [2, 3], [3, 1]]; var weights; var location = [0, 0, 0];
    barycentric[sample % 4] = a;
    weights = barycentric.map(function (value) { return value * (2 * value - 1); });
    edges.forEach(function (edge) { weights.push(4 * barycentric[edge[0]] * barycentric[edge[1]]); });
    weights.forEach(function (weight, localNode) {
      var node = mesh.elementConnectivity[element * 10 + localNode];
      location[0] += weight * mesh.nodePositionsM[node * 3];
      location[1] += weight * mesh.nodePositionsM[node * 3 + 1];
      location[2] += weight * mesh.nodePositionsM[node * 3 + 2];
    });
    return location;
  }
  function nearestRecovery(mesh, result, target) {
    var best = { distance: Infinity, valuePa: null, locationM: null }; var index;
    for (index = 0; index < result.recoverySampleFields.vonMisesPa.length; index += 1) {
      var location = recoveryLocation(mesh, result.recoverySampleFields.elementIndices[index], index % 4);
      var distance = Math.hypot(location[0] - target[0], location[1] - target[1], location[2] - target[2]);
      if (distance < best.distance) { best = { distance: distance, valuePa: result.recoverySampleFields.vonMisesPa[index], locationM: location }; }
    }
    return best;
  }
  function nearestNodeDisplacement(mesh, result, target) {
    var best = { distance: Infinity, valueM: null, vectorM: null, locationM: null }; var node;
    for (node = 0; node < mesh.nodePositionsM.length / 3; node += 1) {
      var location = [mesh.nodePositionsM[node * 3], mesh.nodePositionsM[node * 3 + 1], mesh.nodePositionsM[node * 3 + 2]];
      var distance = Math.hypot(location[0] - target[0], location[1] - target[1], location[2] - target[2]);
      if (distance < best.distance) { best = { distance: distance, valueM: result.displacementMagnitudeM[node],
        vectorM: [result.displacementM[node * 3], result.displacementM[node * 3 + 1], result.displacementM[node * 3 + 2]], locationM: location }; }
    }
    return best;
  }
  async function runCase(definition) {
    var manifest = await readJson(definition.manifest); var source = '../../' + manifest.geometry.path;
    assert(manifest.caseId === definition.id && manifest.revision === 1, definition.id + ' manifest identity mismatch');
    var sourceBytes = await readBytes(source); var controller = new api.AppController({ document: api.createAnalysisDocument() });
    var seedMesher = new api.MesherClient(); var geometry; var seed;
    try {
      geometry = await seedMesher.importGeometry({ geometryId: definition.id, sourceName: source.split('/').pop(), sourceFormat: 'step', sourceBytes: sourceBytes });
      controller.replaceGeometry(geometry, { sourceName: geometry.sourceName, sourceFormat: 'step', sourceBytes: sourceBytes });
      controller.replaceMaterial(material);
      seed = await seedMesher.generateMesh({ geometry: geometry, settings: { preset: 'custom', elementType: 'tet10', minSizeM: definition.startSize / 4, maxSizeM: definition.startSize }, sourceBytes: sourceBytes });
    } finally { seedMesher.dispose(); }
    definition.supports.forEach(function (support) { addSupport(controller, axisFace(seed, support.axis, support.side), support.components); });
    if (definition.load) { controller.replaceSelectedFaces([axisFace(seed, definition.load.axis, definition.load.side)]); controller.createLoad(definition.load.definition); }
    if (definition.gravity) { controller.replaceGravity({ enabled: true, accelerationMS2: definition.gravity }); }
    var levels = []; var completion; var failure; var currentMesh;
    var runner = new api.ConvergenceRunner({
      prepareLevel: async function (target, index, control) {
        var mesher = new api.MesherClient(); var solver;
        control.cancelCurrent = function () { mesher.cancel(); if (solver) { solver.cancel(); } };
        var mesh = await mesher.generateMesh({ geometry: geometry, settings: { preset: 'custom', elementType: 'tet10', minSizeM: target / 4, maxSizeM: target }, sourceBytes: sourceBytes });
        currentMesh = mesh;
        mesher.dispose(); solver = new api.SolverClient(); control.cancelCurrent = function () { solver.cancel(); };
        var documentState = Object.assign({}, controller.document, { mesh: mesh, meshMetadata: { statistics: mesh.statistics, quality: mesh.quality, memoryInputs: mesh.memoryInputs } });
        var input = api.prepareSolverInput(documentState); var preflight = await solver.preflight(input, controller.document.analysisRevision, 8);
        return { mesh: mesh, preflight: preflight, material: material,
          solve: function () { return solver.solve(controller.document.analysisRevision, controller.document.solveSettings, false); },
          dispose: function () { solver.dispose(); } };
      },
      onLevel: function (summary, result) {
        var mesh = arguments.length > 2 ? arguments[2] : null;
        var row = Object.assign({}, summary, { equilibriumRelativeResidual: result.equilibrium.relativeResidual,
          totalReactionN: result.equilibrium.totalReactionN, rawVonMisesLocationM: result.extrema.rawVonMisesMax.locationM });
        if (definition.probeM) { row.rawStressProbe = nearestRecovery(currentMesh, result, definition.probeM); }
        var bounds = geometry.boundingBoxM;
        row.displacementProbe = nearestNodeDisplacement(currentMesh, result,
          definition.displacementProbeM || [bounds.maxM[0], (bounds.minM[1] + bounds.maxM[1]) / 2, (bounds.minM[2] + bounds.maxM[2]) / 2]);
        levels.push(row);
      },
      onComplete: function (value, error) { completion = value; failure = error; }
    });
    var bounds = geometry.boundingBoxM;
    var diagonal = Math.hypot(bounds.maxM[0] - bounds.minM[0], bounds.maxM[1] - bounds.minM[1], bounds.maxM[2] - bounds.minM[2]);
    await runner.start(definition.startSize, { maxLevels: 3 }, diagonal);
    if (failure) { throw failure; }
    assert(levels.length >= 2, definition.id + ' did not complete two levels');
    return { caseId: definition.id, caseRevision: manifest.revision, source: source, levels: levels, convergence: completion,
      probeM: definition.probeM || null };
  }
  async function runAll() {
    var evidence = []; var index;
    for (index = 0; index < cases.length; index += 1) {
      status.textContent = 'Running ' + cases[index].id + '…';
      evidence.push(await runCase(cases[index]));
    }
    root.__spjutsimValidationEvidence = { schemaVersion: 1, cases: evidence };
    output.textContent = JSON.stringify(root.__spjutsimValidationEvidence, null, 2);
    status.textContent = 'Passed'; status.dataset.result = 'passed'; document.title = 'Validation benchmarks: Passed';
  }
  runAll().catch(function (error) { status.textContent = (error.diagnostic && error.diagnostic.userMessage) || error.message; status.dataset.result = 'failed'; document.title = 'Validation benchmarks: Failed'; throw error; });
}(globalThis));
