(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');
  var controller = new api.AppController({ document: api.createAnalysisDocument() });
  var sourceBytes;
  function assert(value, message) { if (!value) { throw new Error(message); } }
  function faceCenter(mesh, faceId) {
    var range = mesh.geometryFaceMap[faceId], indices = mesh.boundaryFaces.triangleConnectivity;
    var sum = [0, 0, 0], count = 0;
    for (var offset = range.start; offset < range.start + range.count; offset += 1) {
      for (var axis = 0; axis < 3; axis += 1) { sum[axis] += mesh.nodePositionsM[indices[offset] * 3 + axis]; }
      count += 1;
    }
    return sum.map(function (value) { return value / count; });
  }
  function axisFace(mesh, axis, maximum) {
    return mesh.boundaryFaces.faceRanges.map(function (range) { return { id: range.faceId, value: faceCenter(mesh, range.faceId)[axis] }; })
      .sort(function (a, b) { return maximum ? b.value - a.value : a.value - b.value; })[0].id;
  }
  function support(faceId, axis) {
    var definition = { name: axis + ' symmetry', type: 'support', componentsM: {} };
    definition.componentsM[axis] = 0; controller.replaceSelectedFaces([faceId]); controller.createBoundaryCondition(definition);
  }
  var seedMesher = new api.MesherClient();
  fetch('../fixtures/generated-unit-cube-m.step').then(function (response) { return response.arrayBuffer(); }).then(function (bytes) {
    sourceBytes = bytes; controller.beginGeometryImport('generated-unit-cube-m.step');
    return seedMesher.importGeometry({ geometryId: 'convergence-cube', sourceName: 'generated-unit-cube-m.step', sourceFormat: 'step', sourceBytes: bytes });
  }).then(function (geometry) {
    controller.replaceGeometry(geometry, { sourceName: geometry.sourceName, sourceFormat: geometry.sourceFormat, sourceBytes: sourceBytes });
    controller.replaceMaterial({ name: 'Analytical cube', youngsModulusPa: 1e9, poissonsRatio: .25, densityKgM3: 1000, tensileYieldPa: 250e6 });
    return seedMesher.generateMesh({ geometry: geometry, settings: { preset: 'coarse', elementType: 'tet10' }, sourceBytes: sourceBytes });
  }).then(function (seed) {
    seedMesher.dispose();
    support(axisFace(seed, 0, false), 'x'); support(axisFace(seed, 1, false), 'y'); support(axisFace(seed, 2, false), 'z');
    controller.replaceSelectedFaces([axisFace(seed, 0, true)]);
    controller.createLoad({ name: 'Axial force', type: 'total-force', forceN: [1000, 0, 0] });
    var levels = [], completion;
    var runner = new api.ConvergenceRunner({
      prepareLevel: async function (target, index, control) {
        var mesher = new api.MesherClient(), solver;
        control.cancelCurrent = function () { mesher.cancel(); if (solver) { solver.cancel(); } };
        var mesh = await mesher.generateMesh({ geometry: controller.document.geometry,
          settings: { preset: 'custom', elementType: 'tet10', minSizeM: target / 4, maxSizeM: target }, sourceBytes: sourceBytes });
        mesher.dispose(); solver = new api.SolverClient(); control.cancelCurrent = function () { solver.cancel(); };
        var input = api.prepareSolverInput(Object.assign({}, controller.document, { mesh: mesh,
          meshMetadata: { statistics: mesh.statistics, quality: mesh.quality, memoryInputs: mesh.memoryInputs } }));
        var preflight = await solver.preflight(input, controller.document.analysisRevision, 8);
        return { mesh: mesh, preflight: preflight, material: controller.document.material,
          solve: function () { return solver.solve(controller.document.analysisRevision, controller.document.solveSettings, false); },
          dispose: function () { solver.dispose(); } };
      },
      onLevel: function (level) { levels.push(level); }, onComplete: function (value) { completion = value; }
    });
    return runner.start(0.2, { maxLevels: 2 }, Math.sqrt(3)).then(function () {
      root.__spjutsimConvergenceEvidence = { levels: levels, classification: completion };
      assert(levels.length === 2 && levels[1].targetSizeM === levels[0].targetSizeM * .7, 'refinement sequence was not deterministic');
      assert(completion.status === 'converged' && completion.stressStable, 'analytical axial cube did not converge');
      assert(Math.abs(levels[1].maximumDisplacementM - Math.sqrt(1.125) * 1e-6) < 1e-10 && Math.abs(levels[1].rawVonMisesMaxPa - 1000) < 1,
        'converged cube missed analytical displacement or stress');
      status.textContent = 'Passed'; status.dataset.result = 'passed';
    });
  }).catch(function (error) { status.textContent = error.message; status.dataset.result = 'failed'; throw error; })
    .finally(function () { seedMesher.dispose(); });
}(globalThis));
