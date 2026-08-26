(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');

  function assert(condition, message) { if (!condition) { throw new Error(message); } }
  function expectError(action, phrase) {
    var error = null;
    try { action(); } catch (caught) { error = caught; }
    assert(error && error.message.indexOf(phrase) !== -1, 'Expected actionable error containing: ' + phrase);
  }

  function cubeTopology() {
    return {
      positions: new Float64Array([
        0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0,
        0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1
      ]),
      indices: new Uint32Array([
        0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
        0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2,
        0, 3, 2, 0, 2, 1, 4, 5, 6, 4, 6, 7
      ]),
      faceIds: ['face-x-', 'face-x+', 'face-y-', 'face-y+', 'face-z-', 'face-z+']
    };
  }

  function ranges(faceIds) {
    return faceIds.map(function (faceId, index) { return { faceId: faceId, start: index * 6, count: 6 }; });
  }

  function cubeGeometry(id) {
    var cube = cubeTopology();
    return {
      geometryId: id, sourceName: 'cube.step', sourceFormat: 'step', faceIds: cube.faceIds,
      boundingBoxM: { minM: [0, 0, 0], maxM: [1, 1, 1] }, volumeM3: 1,
      preview: {
        positionsM: cube.positions, normals: new Float32Array(cube.positions.length), indices: cube.indices,
        faceRanges: ranges(cube.faceIds), featureEdges: { positionsM: new Float64Array(0), indices: new Uint32Array(0) }
      }
    };
  }

  function cubeMesh() {
    var cube = cubeTopology();
    var faceRanges = ranges(cube.faceIds);
    var faceMap = {};
    faceRanges.forEach(function (range) { faceMap[range.faceId] = range; });
    return {
      elementType: 'tet4', nodePositionsM: cube.positions,
      elementConnectivity: new Uint32Array([0, 1, 3, 4]),
      boundaryFaces: { triangleConnectivity: cube.indices, faceRanges: faceRanges }, geometryFaceMap: faceMap,
      statistics: { nodeCount: 8, elementCount: 1, boundaryTriangleCount: 12, minCharacteristicSizeM: 1, maxCharacteristicSizeM: 1 },
      quality: { metric: 'gamma', minimum: 0.5, invertedElementCount: 0, nearZeroJacobianCount: 0 },
      memoryInputs: { nodeCount: 8, elementCount: 1 }
    };
  }

  function sumForces(values) {
    var sum = [0, 0, 0];
    for (var index = 0; index < values.length; index += 3) {
      sum[0] += values[index]; sum[1] += values[index + 1]; sum[2] += values[index + 2];
    }
    return sum;
  }

  function near(a, b, tolerance) { return Math.abs(a - b) <= (tolerance || Math.max(1e-9, Math.abs(b) * 1e-12)); }

  function testContractsAndConversions() {
    assert(api.displayToSI('youngsModulusPa', 210) === 210e9, 'GPa input was not stored as Pa');
    assert(api.siToDisplay('displacementM', 0.0015) === 1.5, 'meter displacement was not displayed in mm');
    assert(api.displayToSI('pressurePa', api.siToDisplay('pressurePa', 3.25e6)) === 3.25e6, 'pressure conversion did not round trip');
    assert(!api.validateIsotropicMaterial({ youngsModulusPa: 0, poissonsRatio: 0.3 }).valid, 'zero modulus was accepted');
    assert(!api.validateIsotropicMaterial({ youngsModulusPa: 1, poissonsRatio: 0.5 }).valid, 'invalid Poisson ratio was accepted');
    assert(api.validateIsotropicMaterial({ youngsModulusPa: 1, poissonsRatio: -0.2 }).warnings.length === 1,
      'unusual-but-valid material did not produce a warning');
    assert(!api.validateKnownFaceIds(['face-x-', 'face-x-'], ['face-x-']).valid, 'duplicate faces were accepted');
    assert(!api.validateKnownFaceIds(['missing'], ['face-x-']).valid, 'unknown faces were accepted');
    assert(!api.validateGravity({ enabled: true, accelerationMS2: [0, 0, -9.8] }, null).valid, 'gravity did not require density');
  }

  function testControllerAndProjection() {
    var geometry = cubeGeometry('cube-a');
    var documentState = api.createAnalysisDocument();
    var controller = new api.AppController({ document: documentState });
    var mesh = cubeMesh();
    var meshReference;
    var fixedId;
    var prescribedId;
    var pressureId;
    var forceId;
    controller.replaceGeometry(geometry, { sourceName: 'cube.step', stepBytes: new Uint8Array([1]).buffer });
    expectError(function () { controller.createBoundaryCondition({ name: 'Empty', type: 'fixed' }); }, 'Select at least one');
    controller.replaceMaterial({ name: 'Steel', youngsModulusPa: 210e9, poissonsRatio: 0.3, densityKgM3: 7850 });
    controller.completeMeshGeneration(mesh);
    meshReference = documentState.mesh;
    documentState.results = { displacement: true };
    controller.replaceSelectedFaces(['face-x-']);
    fixedId = controller.createBoundaryCondition({ name: 'Fixed end', type: 'fixed' });
    assert(documentState.mesh === meshReference && documentState.results === null, 'support edit invalidated mesh or retained results');
    controller.replaceSelectedFaces(['face-x+']);
    prescribedId = controller.createBoundaryCondition({ name: 'Guide', type: 'prescribed-displacement', uyM: 0 });
    expectError(function () {
      controller.replaceBoundaryCondition(prescribedId, { faceIds: ['face-x+'], name: 'Incomplete', type: 'prescribed-displacement' });
    }, 'at least one prescribed');
    controller.replaceBoundaryCondition(prescribedId, { faceIds: ['face-x+', 'face-x+'], name: 'Duplicate', type: 'fixed' });
  }

  function runCompleteControllerProjectionTest() {
    var geometry = cubeGeometry('cube-b');
    var state = api.createAnalysisDocument();
    var controller = new api.AppController({ document: state });
    var mesh = cubeMesh();
    var ids = {};
    var projection;
    var pressureSum;
    var forceSum;
    var glyphs;
    controller.replaceGeometry(geometry, { sourceName: 'cube.step', stepBytes: new Uint8Array([2]).buffer });
    controller.replaceMaterial({ name: 'Steel', youngsModulusPa: 210e9, poissonsRatio: 0.3, densityKgM3: 7850 });
    controller.completeMeshGeneration(mesh);
    controller.replaceSelectedFaces(['face-x-']); ids.fixed = controller.createBoundaryCondition({ name: 'Fixed', type: 'fixed' });
    controller.replaceSelectedFaces(['face-x+']); ids.prescribed = controller.createBoundaryCondition({ name: 'Prescribed', type: 'prescribed-displacement', uxM: 0.001 });
    controller.selectBoundaryCondition(ids.fixed);
    assert(state.selectedFaceIds[0] === 'face-x-', 'support face highlight did not round trip');
    controller.replaceSelectedFaces(['face-y-']); ids.pressure = controller.createLoad({ name: 'Pressure', type: 'pressure', pressurePa: 2e6 });
    controller.replaceSelectedFaces(['face-y+', 'face-z-']); ids.force = controller.createLoad({ name: 'Force', type: 'total-force', forceN: [120, -30, 45] });
    controller.selectLoad(ids.force);
    assert(state.selectedFaceIds.join('|') === 'face-y+|face-z-', 'load face highlight did not round trip');
    controller.replaceGravity({ enabled: true, accelerationMS2: [0, 0, -9.80665] });
    projection = api.prepareSolverInput(state);
    assert(projection.boundaryConditions[0].nodeIndices.length === 4, 'fixed face did not map to its four unique boundary nodes');
    pressureSum = sumForces(projection.loads[0].equivalentNodalForcesN);
    assert(near(pressureSum[0], 0) && near(pressureSum[1], 2e6) && near(pressureSum[2], 0), 'positive pressure did not integrate inward');
    forceSum = sumForces(projection.loads[1].equivalentNodalForcesN);
    assert(near(forceSum[0], 120) && near(forceSum[1], -30) && near(forceSum[2], 45), 'total force was divided by nodes instead of integrated by area');
    glyphs = api.buildAnalysisGlyphDescriptors(state);
    assert(glyphs.length === 6, 'support/load/gravity glyph count was incorrect');
    assert(glyphs.find(function (glyph) { return glyph.itemId === ids.pressure; }).direction[1] > 0.999,
      'pressure glyph did not point inward on the selected cube face');
    controller.completeMeshGeneration(cubeMesh());
    assert(api.buildAnalysisGlyphDescriptors(state).length === glyphs.length, 'glyphs were not stable across remeshes');
    var allFacesState = Object.assign({}, state, {
      boundaryConditions: [{ id: 'all-faces', name: 'All faces', type: 'fixed', faceIds: geometry.faceIds.slice() }],
      loads: [], gravity: { enabled: false, accelerationMS2: [0, 0, -9.80665] }
    });
    var expectedNormals = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
    api.buildAnalysisGlyphDescriptors(allFacesState).forEach(function (glyph, index) {
      assert(near(glyph.direction[0], expectedNormals[index][0]) && near(glyph.direction[1], expectedNormals[index][1]) && near(glyph.direction[2], expectedNormals[index][2]),
        'glyph orientation was incorrect on one of the six cube faces');
    });
    controller.removeBoundaryCondition(ids.prescribed);
    controller.removeLoad(ids.force);
    assert(state.boundaryConditions.length === 1 && state.loads.length === 1, 'analysis item removal failed');
    expectError(function () { controller.removeLoad('missing'); }, 'Unknown load');
    controller.replaceGravity({ enabled: false, accelerationMS2: [0, 0, -9.80665] });
    controller.clearMaterial();
    controller.replaceGeometry(cubeGeometry('cube-c'), { sourceName: 'cube.step', stepBytes: new Uint8Array([3]).buffer });
    assert(state.boundaryConditions.length === 0 && state.loads.length === 0 && state.mesh === null,
      'geometry replacement did not clear face-dependent analysis items');
  }

  function testKeyboardSemanticAuthoring() {
    var state = api.createAnalysisDocument();
    var controller = new api.AppController({ document: state });
    var authoring = new api.AnalysisAuthoringUI(controller);
    controller.replaceGeometry(cubeGeometry('cube-ui'), { sourceName: 'cube.step', stepBytes: new Uint8Array([4]).buffer });
    authoring.start();
    controller.subscribe(function (documentState) { authoring.render(documentState); });
    document.getElementById('material-name').value = 'Keyboard steel';
    document.getElementById('material-youngs').value = '200';
    document.getElementById('material-poisson').value = '0.3';
    document.getElementById('material-density').value = '7800';
    document.getElementById('material-form').requestSubmit();
    assert(state.material && state.material.youngsModulusPa === 200e9, 'keyboard form submission did not store material in SI units');
    controller.replaceSelectedFaces(['face-x-']);
    document.getElementById('support-name').value = 'Keyboard fixed';
    document.getElementById('support-form').requestSubmit();
    assert(state.boundaryConditions.length === 1, 'keyboard form submission did not add a support');
    controller.replaceSelectedFaces(['face-x+']);
    document.getElementById('load-name').value = 'Keyboard pressure';
    document.getElementById('load-pressure').value = '1.5';
    document.getElementById('load-form').requestSubmit();
    assert(state.loads.length === 1 && state.loads[0].pressurePa === 1.5e6, 'keyboard form submission did not add a pressure load');
    assert(document.getElementById('support-list').querySelector('button') && document.getElementById('load-list').querySelector('button'),
      'authored items were not exposed as keyboard-focusable buttons');
  }

  try {
    testContractsAndConversions();
    expectError(testControllerAndProjection, 'only once');
    runCompleteControllerProjectionTest();
    testKeyboardSemanticAuthoring();
    status.textContent = 'Passed'; status.dataset.result = 'passed'; document.title = 'Analysis authoring tests: Passed';
  } catch (error) {
    status.textContent = error.message; status.dataset.result = 'failed'; document.title = 'Analysis authoring tests: Failed'; throw error;
  }
}(globalThis));
