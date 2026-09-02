(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');
  var controller = new api.AppController({ document: api.createAnalysisDocument() });
  var mesher = new api.MesherClient();
  var solver;
  var sourceBytes;
  function assert(condition, message) { if (!condition) { throw new Error(message); } }
  function near(actual, expected, relative, absolute) {
    return Math.abs(actual - expected) <= Math.max(absolute || 0, relative * Math.max(Math.abs(actual), Math.abs(expected)));
  }
  function faceCenter(mesh, faceId) {
    var range = mesh.geometryFaceMap[faceId];
    var indices = mesh.boundaryFaces.triangleConnectivity;
    var sum = [0, 0, 0];
    var count = 0;
    var offset;
    var axis;
    for (offset = range.start; offset < range.start + range.count; offset += 1) {
      for (axis = 0; axis < 3; axis += 1) { sum[axis] += mesh.nodePositionsM[indices[offset] * 3 + axis]; }
      count += 1;
    }
    return sum.map(function (value) { return value / count; });
  }
  function axisFace(mesh, axis, maximum) {
    return mesh.boundaryFaces.faceRanges.map(function (range) {
      return { faceId: range.faceId, coordinate: faceCenter(mesh, range.faceId)[axis] };
    }).sort(function (a, b) { return maximum ? b.coordinate - a.coordinate : a.coordinate - b.coordinate; })[0].faceId;
  }
  function addPrescribed(faceId, component) {
    var definition = { name: component.toUpperCase() + ' symmetry', type: 'support', componentsM: {} };
    definition.componentsM[component.slice(1)] = 0;
    controller.replaceSelectedFaces([faceId]);
    controller.createBoundaryCondition(definition);
  }

  fetch('../fixtures/generated-unit-cube-m.step').then(function (response) { return response.arrayBuffer(); }).then(function (bytes) {
    sourceBytes = bytes;
    controller.beginGeometryImport('generated-unit-cube-m.step');
    return mesher.importGeometry({ geometryId: 'cube-wasm-slice', sourceName: 'generated-unit-cube-m.step', sourceFormat: 'step', sourceBytes: bytes });
  }).then(function (geometry) {
    controller.replaceGeometry(geometry, { sourceName: geometry.sourceName, sourceFormat: geometry.sourceFormat, sourceBytes: sourceBytes });
    controller.replaceMaterial({ name: 'Patch material', youngsModulusPa: 1e9, poissonsRatio: 0.25, densityKgM3: 1000 });
    controller.beginMeshGeneration();
    return mesher.generateMesh({ geometry: geometry, settings: { preset: 'coarse', elementType: 'tet4' }, sourceBytes: sourceBytes });
  }).then(function (mesh) {
    controller.completeMeshGeneration(mesh);
    mesher.dispose();
    addPrescribed(axisFace(mesh, 0, false), 'ux');
    addPrescribed(axisFace(mesh, 1, false), 'uy');
    addPrescribed(axisFace(mesh, 2, false), 'uz');
    controller.replaceSelectedFaces([axisFace(mesh, 0, true)]);
    controller.createLoad({ name: 'Axial force', type: 'total-force', forceN: [1000, 0, 0] });
    solver = new api.SolverClient();
    var revision = controller.beginSolvePreflight();
    return solver.preflight(api.prepareSolverInput(controller.document), revision, 8).then(function (preflight) {
      assert(preflight.nodeCount === mesh.statistics.nodeCount && preflight.elementCount === mesh.statistics.elementCount,
        'cube preflight did not use the authored mesh');
      controller.completeSolvePreflight(revision, preflight);
      controller.beginSolve();
      return solver.solve(revision, controller.document.solveSettings, false).then(function (result) { return [revision, result]; });
    });
  }).then(function (solved) {
    var revision = solved[0];
    var result = solved[1];
    var maximumLoadedUx = -Infinity;
    var node;
    for (node = 0; node < result.originalSurface.nodePositionsM.length / 3; node += 1) {
      if (result.originalSurface.nodePositionsM[node * 3] > 1 - 1e-7) {
        maximumLoadedUx = Math.max(maximumLoadedUx, result.displacementM[node * 3]);
      }
    }
    assert(near(maximumLoadedUx, 1e-6, 2e-5, 1e-11), 'cube axial displacement missed the analytical target');
    assert(near(result.extrema.rawVonMisesMax.valuePa, 1000, 2e-4, 1e-3), 'cube axial stress missed the analytical target');
    assert(near(result.equilibrium.totalReactionN[0], -1000, 1e-7, 1e-5) && result.equilibrium.relativeResidual < 1e-6,
      'cube reaction equilibrium failed');
    controller.completeSolve(revision, result);
    ['model', 'mesh', 'stress', 'deformation'].forEach(function (mode) {
      controller.replaceViewportPresentation(Object.assign({}, controller.document.viewportPresentation, {
        mode: mode, field: mode === 'deformation' ? 'displacementMagnitude' : 'vonMises'
      }));
      assert(controller.document.results === result, mode + ' view changed the solved result');
    });
    status.textContent = 'Passed'; status.dataset.result = 'passed'; document.title = 'Cube WASM vertical slice: Passed';
  }).catch(function (error) {
    status.textContent = (error.diagnostic && error.diagnostic.userMessage) || error.message;
    status.dataset.result = 'failed'; document.title = 'Cube WASM vertical slice: Failed'; throw error;
  }).finally(function () { mesher.dispose(); if (solver) { solver.dispose(); } });
}(globalThis));
