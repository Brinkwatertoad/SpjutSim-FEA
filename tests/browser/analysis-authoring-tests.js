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

  function memoryStorage(initial) {
    var values = Object.assign({}, initial || {});
    return {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; },
      setItem: function (key, value) { values[key] = String(value); },
      removeItem: function (key) { delete values[key]; },
      read: function (key) { return values[key]; }
    };
  }

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

  function testMaterialCatalog() {
    var factories = api.FACTORY_MATERIALS;
    var storage = memoryStorage();
    var catalog = new api.MaterialCatalog(storage);
    var saved;
    var snapshot;
    assert(factories.length === 8, 'material catalog did not expose all eight reviewed built-ins');
    factories.forEach(function (entry) {
      var validation = api.validateIsotropicMaterial(entry.material);
      assert(validation.valid, entry.id + ' did not contain a valid isotropic material');
      assert(Object.isFrozen(entry) && Object.isFrozen(entry.material), entry.id + ' factory record was mutable');
      Object.keys(entry.material).forEach(function (field) {
        if (field !== 'name') { assert(entry.metadata.fieldProvenance[field], entry.id + ' lacked field-level provenance for ' + field); }
      });
    });
    assert(factories[0].material.youngsModulusPa === 200e9 && factories[0].material.tensileYieldPa === 250e6 &&
      factories[0].material.ultimateTensilePa === 400e6 && factories[0].material.densityKgM3 === 7850,
    'Steel A36 did not retain the exact reviewed Truss seed');
    assert(factories[1].material.youngsModulusPa === 69e9 && factories[1].material.tensileYieldPa === 276e6 &&
      factories[1].material.ultimateTensilePa === 310e6 && factories[1].material.densityKgM3 === 2700,
    'Aluminum 6061-T6 did not retain the exact reviewed Truss seed');
    assert(factories[0].metadata.fieldProvenance.poissonsRatio.url !== factories[0].metadata.fieldProvenance.youngsModulusPa.url,
      'partial Truss provenance was incorrectly applied to the steel Poisson ratio');
    assert(factories.find(function (entry) { return entry.material.name === 'TPU'; }).metadata.warning.indexOf('linear-isotropic') !== -1,
      'TPU did not include the prominent model-limitation warning');
    snapshot = catalog.materialSnapshot(factories[0].id);
    snapshot.youngsModulusPa = 1;
    assert(catalog.materialSnapshot(factories[0].id).youngsModulusPa === 200e9, 'catalog snapshot mutation changed a factory record');

    saved = catalog.saveUser({ name: 'My material', youngsModulusPa: 4e9, poissonsRatio: 0.31 });
    assert(saved.entry.id === 'user.material.1' && !saved.storageWarning, 'custom material was not assigned a stable persisted ID');
    expectError(function () { catalog.saveUser({ name: 'my MATERIAL', youngsModulusPa: 5e9, poissonsRatio: 0.3 }); }, 'already exists');
    catalog.replaceUser(saved.entry.id, { name: 'My replacement', youngsModulusPa: 5e9, poissonsRatio: 0.3 });
    assert(catalog.get(saved.entry.id).material.youngsModulusPa === 5e9, 'explicit custom replacement failed');
    catalog.removeUser(saved.entry.id);
    assert(catalog.get(saved.entry.id) === null, 'explicit custom removal failed');
    saved = catalog.saveUser({ name: 'Next material', youngsModulusPa: 6e9, poissonsRatio: 0.29 });
    assert(saved.entry.id === 'user.material.2', 'deleted user material sequence was reused');
    assert(new api.MaterialCatalog(storage).get(saved.entry.id), 'valid stored user catalog did not reload');

    var corrupt = memoryStorage();
    corrupt.setItem(api.MATERIAL_CATALOG_STORAGE_KEY, '{bad');
    assert(new api.MaterialCatalog(corrupt).loadWarning, 'corrupt material storage did not produce a guarded warning');
    var unsupported = memoryStorage();
    unsupported.setItem(api.MATERIAL_CATALOG_STORAGE_KEY, JSON.stringify({ schemaVersion: 99, nextUserSequence: 1, materials: [] }));
    assert(new api.MaterialCatalog(unsupported).loadWarning, 'unsupported material storage schema was accepted');
    var failing = new api.MaterialCatalog({ getItem: function () { return null; }, setItem: function () { throw new Error('quota'); } });
    saved = failing.saveUser({ name: 'Session only', youngsModulusPa: 1e9, poissonsRatio: 0.25 });
    assert(saved.storageWarning && failing.get(saved.entry.id), 'storage failure prevented current-session use of a valid material');
  }

  function testSymmetricCurvedFaceGlyph() {
    var positions = new Float64Array([
      1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1
    ]);
    var indices = new Uint32Array([
      0, 2, 4, 2, 1, 4, 1, 3, 4, 3, 0, 4,
      2, 0, 5, 1, 2, 5, 3, 1, 5, 0, 3, 5
    ]);
    var face = api.faceCentroidNormal({
      positionsM: positions, indices: indices,
      faceMap: { curved: { faceId: 'curved', start: 0, count: indices.length } }
    }, 'curved');
    assert(face !== null, 'symmetric curved face cancelled its representative glyph normal');
    assert(Math.hypot(face.positionM[0], face.positionM[1], face.positionM[2]) > 0.4,
      'symmetric curved-face glyph was placed inside the solid');
    assert(Math.hypot(face.outwardNormal[0], face.outwardNormal[1], face.outwardNormal[2]) > 0.999,
      'symmetric curved-face glyph did not retain a finite local normal');
  }

  function testSetupInspectorSummaries() {
    var state = api.createAnalysisDocument();
    state.geometry = cubeGeometry('cube-summary');
    state.material = { name: 'Steel A36', youngsModulusPa: 200e9, poissonsRatio: 0.3, densityKgM3: 7850 };
    state.boundaryConditions = [
      { id: 'support-1', name: 'Support 1', type: 'fixed', faceIds: ['face-x-', 'face-y-'] },
      { id: 'support-2', name: 'Support 2', type: 'prescribed-displacement', faceIds: ['face-z-'], uxM: 0, uzM: 0.001 }
    ];
    state.loads = [
      { id: 'load-1', name: 'Load 1', type: 'pressure', faceIds: ['face-x+'], pressurePa: 1.5e6 },
      { id: 'load-2', name: 'Load 2', type: 'total-force', faceIds: ['face-y+'], forceN: [120, -30, 45] }
    ];
    state.gravity = { enabled: true, accelerationMS2: [0, 0, -9.80665] };

    var rows = api.buildSetupInspectorRows(state);
    assert(rows.map(function (row) { return row.kind + ':' + row.itemId; }).join('|') ===
      'model:model|support:support-1|support:support-2|load:load-1|load:load-2|gravity:gravity',
      'setup rows were not emitted in stable document order');
    assert(rows[0].primaryText === 'cube.step' && rows[0].secondaryText === 'Steel A36 · STEP',
      'model row omitted source or material');
    assert(rows[0].metaText === '6 faces', 'model row omitted face count');
    assert(rows[1].secondaryText === 'Fixed · X, Y, Z' && rows[1].metaText === '2 faces',
      'fixed support row omitted constrained components or face count');
    assert(rows[2].secondaryText === 'X 0 mm · Z 1 mm', 'prescribed support row omitted displacement values');
    assert(rows[3].secondaryText === 'Pressure · 1.5 MPa', 'pressure row omitted display units');
    assert(rows[4].secondaryText === 'Force · [120, −30, 45] N', 'force row omitted vector or display units');
    assert(rows[5].secondaryText === '[0, 0, −9.80665] m/s²', 'gravity row omitted acceleration');
    assert(rows.every(function (row) { return row.ariaLabel.indexOf(row.primaryText) !== -1; }),
      'setup row accessible label omitted its primary text');

    state.gravity.enabled = false;
    assert(api.buildSetupInspectorRows(state).length === 5, 'disabled gravity was included as a setup row');
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

  function testGeneratedNamesAndSequences() {
    var state = api.createAnalysisDocument();
    var controller = new api.AppController({ document: state });
    var support1;
    var support2;
    var load1;
    controller.replaceGeometry(cubeGeometry('cube-names'), { sourceName: 'cube.step', stepBytes: new Uint8Array([7]).buffer });
    controller.replaceSelectedFaces(['face-x-']);
    support1 = controller.createBoundaryCondition({ name: 'Ignored', type: 'fixed' });
    support2 = controller.createBoundaryCondition({ type: 'fixed' });
    controller.removeBoundaryCondition(support1);
    assert(state.boundaryConditions[0].name === 'Support 2', 'support deletion reused or changed a generated number');
    controller.createBoundaryCondition({ type: 'fixed' });
    assert(state.boundaryConditions[1].name === 'Support 3', 'support sequence was not monotonic');
    controller.replaceBoundaryCondition(support2, { name: 'Renamed', type: 'fixed' });
    assert(state.boundaryConditions[0].name === 'Support 2', 'editing changed a generated support name');
    controller.replaceSelectedFaces(['face-x+']);
    load1 = controller.createLoad({ name: 'Ignored', type: 'pressure', pressurePa: 1e6 });
    assert(state.loads[0].name === 'Load 1', 'load sequence was not independent from the support sequence');
    controller.replaceLoad(load1, { name: 'Renamed', type: 'pressure', pressurePa: 2e6 });
    assert(state.loads[0].name === 'Load 1', 'editing changed a generated load name');
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
    try { root.localStorage.removeItem(api.MATERIAL_CATALOG_STORAGE_KEY); } catch (error) { /* Storage may be unavailable in hardened browser profiles. */ }
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
    document.getElementById('support-form').requestSubmit();
    assert(state.boundaryConditions.length === 1 && state.boundaryConditions[0].name === 'Support 1', 'keyboard form submission did not add an auto-named support');
    controller.replaceSelectedFaces(['face-x+']);
    document.getElementById('load-pressure').value = '1.5';
    document.getElementById('load-form').requestSubmit();
    assert(state.loads.length === 1 && state.loads[0].name === 'Load 1' && state.loads[0].pressurePa === 1.5e6, 'keyboard form submission did not add an auto-named pressure load');
    assert(document.getElementById('support-list').querySelector('button') && document.getElementById('load-list').querySelector('button'),
      'authored items were not exposed as keyboard-focusable buttons');

    assert(document.getElementById('support-form').compareDocumentPosition(document.getElementById('support-list')) & Node.DOCUMENT_POSITION_FOLLOWING,
      'support list was not ordered below its form');
    assert(document.getElementById('support-status').compareDocumentPosition(document.getElementById('support-list')) & Node.DOCUMENT_POSITION_FOLLOWING,
      'support list was not ordered below feedback');
    assert(document.getElementById('load-form').compareDocumentPosition(document.getElementById('load-list')) & Node.DOCUMENT_POSITION_FOLLOWING,
      'load list was not ordered below its form');

    document.getElementById('support-type').value = 'prescribed-displacement';
    document.getElementById('support-type').dispatchEvent(new Event('change'));
    authoring.beginSupportEdit(state.boundaryConditions[0].id);
    assert(document.getElementById('support-type').value === 'fixed', 'support edit did not show the item type');
    authoring.resetSupportForm();
    assert(document.getElementById('support-type').value === 'prescribed-displacement', 'support add mode did not restore its remembered type');
    assert(document.getElementById('load-type').value === 'pressure', 'support type memory interfered with the load type');
    document.getElementById('load-type').value = 'total-force';
    document.getElementById('load-type').dispatchEvent(new Event('change'));
    authoring.beginLoadEdit(state.loads[0].id);
    assert(document.getElementById('load-type').value === 'pressure', 'load edit did not show the item type');
    authoring.resetLoadForm();
    assert(document.getElementById('load-type').value === 'total-force', 'load add mode did not restore its remembered type');
  }

  try {
    testContractsAndConversions();
    testMaterialCatalog();
    testSymmetricCurvedFaceGlyph();
    testSetupInspectorSummaries();
    expectError(testControllerAndProjection, 'only once');
    testGeneratedNamesAndSequences();
    runCompleteControllerProjectionTest();
    testKeyboardSemanticAuthoring();
    status.textContent = 'Passed'; status.dataset.result = 'passed'; document.title = 'Analysis authoring tests: Passed';
  } catch (error) {
    status.textContent = error.message; status.dataset.result = 'failed'; document.title = 'Analysis authoring tests: Failed'; throw error;
  }
}(globalThis));
