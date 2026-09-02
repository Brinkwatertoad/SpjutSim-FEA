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
      geometryId: id, sourceName: 'cube.step', sourceFormat: 'step', orientation: api.identityRigidOrientation(), faceIds: cube.faceIds,
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
    var oneAxis = api.validateBoundaryCondition({ id: 'support-x', name: 'Support X', type: 'support',
      faceIds: ['face-x-'], componentsM: { x: 0.001 } }, ['face-x-']);
    var twoAxis = api.validateBoundaryCondition({ id: 'support-yz', name: 'Support YZ', type: 'support',
      faceIds: ['face-x-'], componentsM: { y: 0, z: -0.002 } }, ['face-x-']);
    assert(oneAxis.valid && oneAxis.value.componentsM.x === 0.001 && twoAxis.valid && twoAxis.value.componentsM.z === -0.002,
      'one- and two-axis component supports were not retained in SI units');
    assert(!api.validateBoundaryCondition({ id: 'empty', name: 'Empty', type: 'support', faceIds: ['face-x-'], componentsM: {} }, ['face-x-']).valid,
      'support without an enabled component was accepted');
    assert(!api.validateBoundaryCondition({ id: 'bad', name: 'Bad', type: 'support', faceIds: ['face-x-'], componentsM: { x: NaN } }, ['face-x-']).valid,
      'non-finite support component was accepted');
    assert(!api.validateBoundaryCondition({ id: 'legacy', name: 'Legacy', type: 'fixed', faceIds: ['face-x-'] }, ['face-x-']).valid,
      'legacy fixed support contract was accepted');
  }

  function testRigidOrientationContracts() {
    var identity = api.identityRigidOrientation();
    var quarterTurn = api.axisRotationMatrix('z', 90);
    var rotatedVector = api.transformVector3(quarterTurn, [1, 0, 0]);
    var geometry = cubeGeometry('orientation-cube');
    var rotated = api.rotateGeometryAroundGlobalAxis(geometry, 'z', 90);
    var composed = api.rotateGeometryAroundGlobalAxis(rotated, 'x', -90);
    var cancelled = api.rotateGeometryAroundGlobalAxis(api.rotateGeometryAroundGlobalAxis(geometry, 'z', 45), 'z', -45);
    var topNormal = api.analyzeGeometryFaceNormal(geometry, 'face-z+');
    var opposite = api.shortestRotationMatrix([0, 0, 1], [0, 0, -1]);
    var curved = api.analyzeGeometryFaceNormal({ preview: {
      positionsM: new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 3, 4, 5]), faceRanges: [{ faceId: 'curved', start: 0, count: 6 }]
    } }, 'curved');
    assert(api.validateRigidOrientation(identity).valid, 'identity orientation was rejected');
    assert(!api.validateRigidOrientation({ rotation: [2, 0, 0, 0, 1, 0, 0, 0, 1], operations: [] }).valid,
      'scaled orientation matrix was accepted');
    assert(near(rotatedVector[0], 0) && near(rotatedVector[1], 1) && near(rotatedVector[2], 0),
      'positive global Z rotation used the wrong sign or axis');
    assert(near(rotated.preview.positionsM[3], 0) && near(rotated.preview.positionsM[4], 1),
      'preview positions were not rotated');
    assert(near(rotated.boundingBoxM.minM[0], -1) && near(rotated.boundingBoxM.maxM[0], 0) &&
      near(rotated.boundingBoxM.minM[1], 0) && near(rotated.boundingBoxM.maxM[1], 1),
    'oriented bounds were not recomputed');
    assert(rotated.orientation.operations.join(' · ') === 'Z +90°', 'orientation summary did not retain the signed axis operation');
    assert(api.validateRigidOrientation(composed.orientation).valid, 'composed orientation lost orthonormality');
    assert(near(cancelled.boundingBoxM.minM[0], 0) && near(cancelled.boundingBoxM.maxM[0], 1) &&
      near(cancelled.boundingBoxM.minM[1], 0) && near(cancelled.boundingBoxM.maxM[1], 1),
    'canceling arbitrary rotations inflated the model bounds');
    assert(geometry.preview.positionsM[3] === 1 && geometry.orientation.operations.length === 0,
      'orientation mutated the source geometry');
    assert(near(topNormal.normal[0], 0) && near(topNormal.normal[1], 0) && near(topNormal.normal[2], 1) && !topNormal.warning,
      'planar face area-weighted normal was incorrect');
    rotatedVector = api.transformVector3(opposite, [0, 0, 1]);
    assert(near(rotatedVector[0], 0) && near(rotatedVector[1], 0) && near(rotatedVector[2], -1),
      'deterministic antiparallel face alignment was incorrect');
    assert(curved.warning, 'strongly non-planar face did not produce an orientation warning');
    expectError(function () {
      api.analyzeGeometryFaceNormal({ preview: {
        positionsM: new Float64Array([0, 0, 0, 1, 0, 0, 2, 0, 0]), indices: new Uint32Array([0, 1, 2]),
        faceRanges: [{ faceId: 'flat', start: 0, count: 3 }]
      } }, 'flat');
    }, 'stable normal');
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
      { id: 'support-1', name: 'Support 1', type: 'support', faceIds: ['face-x-', 'face-y-'], componentsM: { x: 0, y: 0, z: 0 } },
      { id: 'support-2', name: 'Support 2', type: 'support', faceIds: ['face-z-'], componentsM: { x: 0, z: 0.001 } }
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
    assert(rows[0].metaText === '6 faces · Original orientation', 'model row omitted face count or orientation');
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

  function testSetupInspectorMarkup() {
    [
      'setup-inspector', 'setup-inspector-status', 'setup-inspector-model-list',
      'setup-inspector-support-list', 'setup-inspector-load-list',
      'setup-inspector-form-stash', 'setup-add-support-button', 'setup-add-load-button',
      'model-rotation-axis', 'model-rotation-angle', 'rotate-model-positive',
      'rotate-model-negative', 'reset-model-orientation', 'model-orientation-status',
      'model-face-direction', 'orient-selected-face'
    ].forEach(function (id) {
      assert(document.getElementById(id), 'missing inspector node #' + id);
    });
    assert(document.querySelectorAll('#material-form').length === 1, 'material form was duplicated');
    assert(document.querySelectorAll('#support-form').length === 1, 'support form was duplicated');
    assert(document.querySelectorAll('#load-form').length === 1, 'load form was duplicated');
    assert(document.querySelectorAll('#gravity-form').length === 1, 'gravity form was duplicated');
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
    controller.replaceGeometry(geometry, { sourceName: 'cube.step', sourceFormat: 'step', sourceBytes: new Uint8Array([1]).buffer });
    expectError(function () { controller.createBoundaryCondition({ name: 'Empty', type: 'support', componentsM: { x: 0 } }); }, 'Select at least one');
    controller.replaceMaterial({ name: 'Steel', youngsModulusPa: 210e9, poissonsRatio: 0.3, densityKgM3: 7850 });
    controller.completeMeshGeneration(mesh);
    meshReference = documentState.mesh;
    documentState.results = { displacement: true };
    controller.replaceSelectedFaces(['face-x-']);
    fixedId = controller.createBoundaryCondition({ name: 'Fixed end', type: 'support', componentsM: { x: 0, y: 0, z: 0 } });
    assert(documentState.mesh === meshReference && documentState.results === null, 'support edit invalidated mesh or retained results');
    controller.replaceSelectedFaces(['face-x+']);
    prescribedId = controller.createBoundaryCondition({ name: 'Guide', type: 'support', componentsM: { y: 0 } });
    expectError(function () {
      controller.replaceBoundaryCondition(prescribedId, { faceIds: ['face-x+'], name: 'Incomplete', type: 'support', componentsM: {} });
    }, 'at least one support');
    controller.replaceBoundaryCondition(prescribedId, { faceIds: ['face-x+', 'face-x+'], name: 'Duplicate', type: 'support', componentsM: { x: 0 } });
  }

  function testGeneratedNamesAndSequences() {
    var state = api.createAnalysisDocument();
    var controller = new api.AppController({ document: state });
    var support1;
    var support2;
    var load1;
    controller.replaceGeometry(cubeGeometry('cube-names'), { sourceName: 'cube.step', sourceFormat: 'step', sourceBytes: new Uint8Array([7]).buffer });
    controller.replaceSelectedFaces(['face-x-']);
    support1 = controller.createBoundaryCondition({ name: 'Ignored', type: 'support', componentsM: { x: 0, y: 0, z: 0 } });
    support2 = controller.createBoundaryCondition({ type: 'support', componentsM: { x: 0, y: 0, z: 0 } });
    controller.removeBoundaryCondition(support1);
    assert(state.boundaryConditions[0].name === 'Support 2', 'support deletion reused or changed a generated number');
    controller.createBoundaryCondition({ type: 'support', componentsM: { x: 0, y: 0, z: 0 } });
    assert(state.boundaryConditions[1].name === 'Support 3', 'support sequence was not monotonic');
    controller.replaceBoundaryCondition(support2, { name: 'Renamed', type: 'support', componentsM: { x: 0, y: 0, z: 0 } });
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
    controller.replaceGeometry(geometry, { sourceName: 'cube.step', sourceFormat: 'step', sourceBytes: new Uint8Array([2]).buffer });
    controller.replaceMaterial({ name: 'Steel', youngsModulusPa: 210e9, poissonsRatio: 0.3, densityKgM3: 7850 });
    controller.completeMeshGeneration(mesh);
    controller.replaceSelectedFaces(['face-x-']); ids.fixed = controller.createBoundaryCondition({ name: 'Fixed', type: 'support', componentsM: { x: 0, y: 0, z: 0 } });
    controller.replaceSelectedFaces(['face-x+']); ids.prescribed = controller.createBoundaryCondition({ name: 'Prescribed', type: 'support', componentsM: { x: 0.001 } });
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
      boundaryConditions: [{ id: 'all-faces', name: 'All faces', type: 'support', faceIds: geometry.faceIds.slice(), componentsM: { x: 0, y: 0, z: 0 } }],
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
    controller.replaceGeometry(cubeGeometry('cube-c'), { sourceName: 'cube.step', sourceFormat: 'step', sourceBytes: new Uint8Array([3]).buffer });
    assert(state.boundaryConditions.length === 0 && state.loads.length === 0 && state.mesh === null,
      'geometry replacement did not clear face-dependent analysis items');
  }

  function testKeyboardSemanticAuthoring() {
    var state = api.createAnalysisDocument();
    var controller = new api.AppController({ document: state });
    try { root.localStorage.removeItem(api.MATERIAL_CATALOG_STORAGE_KEY); } catch (error) { /* Storage may be unavailable in hardened browser profiles. */ }
    var authoring = new api.AnalysisAuthoringUI(controller);
    controller.replaceGeometry(cubeGeometry('cube-ui'), { sourceName: 'cube.step', sourceFormat: 'step', sourceBytes: new Uint8Array([4]).buffer });
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
    var inspectorRows = Array.from(document.querySelectorAll('[data-setup-row]'));
    assert(inspectorRows.map(function (row) { return row.dataset.setupKind; }).join('|') === 'model|support|load',
      'compact setup rows were not rendered in model/support/load order');
    var modelTrigger = document.querySelector('[data-setup-kind="model"] [data-setup-row-trigger]');
    modelTrigger.click();
    assert(document.getElementById('model-rotation-angle').value === '90', 'model rotation did not default to 90 degrees');
    document.getElementById('model-rotation-axis').value = 'z';
    document.getElementById('rotate-model-positive').click();
    assert(state.geometry.orientation.operations.join('') === 'Z +90°', 'positive axis rotation was not applied');
    assert(state.boundaryConditions[0].faceIds.join('|') === 'face-x-' && state.loads[0].pressurePa === 1.5e6,
      'model orientation rotated or discarded global authored setup');
    assert(document.querySelector('[data-setup-kind="model"] .fea-setup-row-meta').textContent.indexOf('Z +90°') !== -1,
      'compact Model row omitted its orientation summary');
    document.getElementById('model-rotation-angle').value = '30';
    document.getElementById('rotate-model-negative').click();
    assert(state.geometry.orientation.operations[1] === 'Z −30°', 'negative axis rotation was not applied');
    document.getElementById('reset-model-orientation').click();
    assert(state.geometry.orientation.operations.length === 0 && near(state.geometry.preview.positionsM[3], 1),
      'orientation reset did not restore the imported model frame');
    assert(document.getElementById('model-orientation-status').textContent === 'Model orientation reset.',
      'orientation reset was not announced in the Model editor');
    controller.replaceSelectedFaces(['face-z+']);
    document.getElementById('model-face-direction').value = '-z';
    document.getElementById('orient-selected-face').click();
    var alignedNormal = api.analyzeGeometryFaceNormal(state.geometry, 'face-z+').normal;
    assert(near(alignedNormal[0], 0) && near(alignedNormal[1], 0) && near(alignedNormal[2], -1),
      'selected face was not aligned to the requested global direction');
    assert(state.geometry.orientation.operations[0] === 'Face → −Z', 'face alignment was omitted from the orientation summary');
    assert(state.selectedFaceIds.join('|') === 'face-z+', 'face alignment changed the selected CAD face identity');
    document.getElementById('reset-model-orientation').click();
    authoring.closeInspectorRow({ cancelEdit: true });
    var supportTrigger = document.querySelector('[data-setup-kind="support"][data-item-id="support-1"] [data-setup-row-trigger]');
    assert(supportTrigger && supportTrigger.getAttribute('aria-expanded') === 'false', 'support setup row was missing or not collapsed');
    controller.replaceSelectedFaces(['face-z+']);
    supportTrigger.click();
    assert(state.selectedFaceIds.join('|') === 'face-x-', 'support setup row did not highlight its faces');
    supportTrigger = document.querySelector('[data-setup-kind="support"][data-item-id="support-1"] [data-setup-row-trigger]');
    assert(supportTrigger.getAttribute('aria-expanded') === 'true', 'selected setup row did not expose expanded state');
    assert(document.getElementById('setup-inspector-status').textContent === 'Editing Support 1.',
      'opening a setup item was not announced');
    assert(supportTrigger.getAttribute('aria-label').indexOf('Support 1') !== -1 && supportTrigger.getAttribute('aria-label').indexOf('1 face') !== -1,
      'setup row accessible name omitted its item summary');
    assert(document.getElementById('support-form').closest('[data-setup-editor-host]'), 'support form was not mounted in the selected row');
    var escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    var selectedBeforeEscape = state.selectedFaceIds.slice();
    assert(authoring.handleDocumentKeyDown(escapeEvent), 'inline editor did not consume Escape');
    assert(escapeEvent.defaultPrevented && !authoring.activeInspectorKind, 'Escape did not close and consume the inline editor');
    assert(state.selectedFaceIds.join('|') === selectedBeforeEscape.join('|'), 'closing inline editor cleared selected CAD faces');
    supportTrigger = document.querySelector('[data-setup-kind="support"][data-item-id="support-1"] [data-setup-row-trigger]');
    supportTrigger.click();
    supportTrigger.focus();
    document.getElementById('cancel-support-edit').click();
    assert(!document.getElementById('support-form').closest('[data-setup-editor-host]'), 'cancel did not close the inline support editor');
    assert(document.activeElement && document.activeElement.dataset.itemId !== 'support-1' &&
      document.activeElement.closest('[data-item-id="support-1"]'), 'cancel did not return focus to the support row');
    supportTrigger = document.querySelector('[data-setup-kind="support"][data-item-id="support-1"] [data-setup-row-trigger]');
    supportTrigger.click();
    document.getElementById('setup-add-load-button').click();
    assert(document.getElementById('load-form').closest('[data-setup-editor-host]'), 'load add form was not mounted inline');
    assert(!document.getElementById('support-form').closest('[data-setup-editor-host]'), 'two inline editors remained mounted');
    authoring.closeInspectorRow({ cancelEdit: true });

    document.getElementById('support-type').value = 'custom';
    document.getElementById('support-type').dispatchEvent(new Event('change'));
    authoring.beginSupportEdit(state.boundaryConditions[0].id);
    assert(document.getElementById('support-type').value === 'fixed', 'support edit did not show the item type');
    authoring.resetSupportForm();
    assert(document.getElementById('support-type').value === 'custom', 'support add mode did not restore its remembered type');
    assert(document.getElementById('load-type').value === 'pressure', 'support type memory interfered with the load type');
    supportTrigger = document.querySelector('[data-setup-kind="support"][data-item-id="support-1"] [data-setup-row-trigger]');
    supportTrigger.click();
    document.getElementById('support-type').value = 'custom';
    document.getElementById('support-type').dispatchEvent(new Event('change'));
    document.getElementById('support-ux-enabled').checked = false;
    document.getElementById('support-ux-enabled').dispatchEvent(new Event('change'));
    document.getElementById('support-uy-enabled').checked = true;
    document.getElementById('support-uy-enabled').dispatchEvent(new Event('change'));
    document.getElementById('support-uy').value = '0';
    document.getElementById('support-uz-enabled').checked = true;
    document.getElementById('support-uz-enabled').dispatchEvent(new Event('change'));
    document.getElementById('support-uz').value = '1.25';
    document.getElementById('support-form').requestSubmit();
    assert(state.boundaryConditions[0].type === 'support' && state.boundaryConditions[0].componentsM.x === undefined &&
      state.boundaryConditions[0].componentsM.y === 0 && state.boundaryConditions[0].componentsM.z === 0.00125,
    'custom two-axis support did not save the enabled global components');
    assert(document.querySelector('[data-setup-kind="support"][data-item-id="support-1"] .fea-setup-row-summary').textContent === 'Y 0 mm · Z 1.25 mm',
      'compact support row did not show its component values');
    document.getElementById('load-type').value = 'total-force';
    document.getElementById('load-type').dispatchEvent(new Event('change'));
    authoring.beginLoadEdit(state.loads[0].id);
    assert(document.getElementById('load-type').value === 'pressure', 'load edit did not show the item type');
    authoring.resetLoadForm();
    assert(document.getElementById('load-type').value === 'total-force', 'load add mode did not restore its remembered type');

    var loadItemId = state.loads[0].id;
    var loadTrigger = document.querySelector('[data-setup-kind="load"][data-item-id="' + loadItemId + '"] [data-setup-row-trigger]');
    loadTrigger.focus(); loadTrigger.click();
    document.getElementById('load-pressure').value = '2.25';
    document.getElementById('load-form').requestSubmit();
    assert(state.loads[0].pressurePa === 2.25e6, 'inline load save did not update the controller state');
    assert(!document.getElementById('load-form').closest('[data-setup-editor-host]'), 'successful save did not close the inline editor');
    assert(document.activeElement && document.activeElement.closest('[data-item-id="' + loadItemId + '"]'), 'save did not return focus to the updated row');

    document.querySelector('[data-setup-kind="load"][data-item-id="' + loadItemId + '"] [data-setup-row-trigger]').click();
    var removeLoad = document.getElementById('remove-load-item-button');
    assert(removeLoad, 'inline load editor omitted its remove action');
    removeLoad.click();
    assert(state.loads.length === 0, 'inline remove action did not delete the load');
    assert(document.activeElement === document.getElementById('setup-add-load-button'), 'deleting a row did not return focus to the load add action');
    assert(document.getElementById('setup-inspector-status').textContent === 'Load removed.', 'load removal was not announced');

    controller.replaceSelectedFaces(['face-y-']); controller.createBoundaryCondition({ type: 'support', componentsM: { x: 0, y: 0, z: 0 } });
    controller.replaceSelectedFaces(['face-z-']); controller.createBoundaryCondition({ type: 'support', componentsM: { x: 0, y: 0, z: 0 } });
    controller.replaceSelectedFaces(['face-y+']); controller.createLoad({ type: 'pressure', pressurePa: 2e6 });
    controller.replaceSelectedFaces(['face-z+']); controller.createLoad({ type: 'total-force', forceN: [0, 0, -500] });
    controller.replaceGravity({ enabled: true, accelerationMS2: [0, 0, -9.80665] });
    var inspector = document.getElementById('setup-inspector');
    assert(inspector.scrollHeight <= inspector.parentElement.clientHeight,
      'ordinary model/material/support/load setup did not fit in the normal tools-pane viewport');

    var gravityTrigger = document.querySelector('[data-setup-kind="gravity"] [data-setup-row-trigger]');
    gravityTrigger.click();
    document.getElementById('gravity-enabled').checked = false;
    document.getElementById('gravity-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    assert(!document.querySelector('[data-setup-kind="gravity"]'), 'disabled gravity remained in the compact setup list');
    assert(authoring.activeInspectorKind === null, 'disabling gravity left a missing inspector row active');
    assert(document.activeElement === document.getElementById('setup-add-load-button'), 'disabling gravity did not return focus to the load add action');
    assert(document.getElementById('setup-inspector-status').textContent === 'Gravity disabled.', 'gravity change was not announced');
  }

  try {
    testContractsAndConversions();
    testRigidOrientationContracts();
    testMaterialCatalog();
    testSymmetricCurvedFaceGlyph();
    testSetupInspectorSummaries();
    testSetupInspectorMarkup();
    expectError(testControllerAndProjection, 'only once');
    testGeneratedNamesAndSequences();
    runCompleteControllerProjectionTest();
    testKeyboardSemanticAuthoring();
    status.textContent = 'Passed'; status.dataset.result = 'passed'; document.title = 'Analysis authoring tests: Passed';
  } catch (error) {
    status.textContent = error.message; status.dataset.result = 'failed'; document.title = 'Analysis authoring tests: Failed'; throw error;
  }
}(globalThis));
