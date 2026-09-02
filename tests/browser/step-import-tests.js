(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');
  var igesGeometry;
  var brepGeometry;

  function assert(condition, message) {
    if (!condition) { throw new Error(message); }
  }

  function approximately(actual, expected, tolerance) {
    return Math.abs(actual - expected) <= tolerance;
  }

  function readFixture(name) {
    return fetch('../fixtures/' + name).then(function (response) {
      if (!response.ok) { throw new Error('The ' + name + ' fixture could not be read.'); }
      return response.arrayBuffer();
    });
  }

  function importOnce(request) {
    var client = new api.MesherClient();
    return client.importGeometry(request).finally(function () { client.dispose(); });
  }

  function meshOnce(geometry, sourceBytes) {
    var client = new api.MesherClient();
    return client.generateMesh({
      geometry: geometry, sourceBytes: sourceBytes,
      settings: { preset: 'coarse', elementType: 'tet4' }
    }).finally(function () { client.dispose(); });
  }

  function assertUnitCube(geometry, format) {
    var bounds = geometry.boundingBoxM;
    assert(geometry.sourceFormat === format, format + ' source format was not retained');
    assert(geometry.faceIds.length === 6, format + ' cube did not expose six CAD faces');
    assert(approximately(geometry.volumeM3, 1, 1e-9), format + ' cube volume was not 1 m³ (received ' + geometry.volumeM3 + ')');
    assert(bounds.minM.every(function (value) { return approximately(value, 0, 2e-7); }), format + ' lower bounds were not meter-based');
    assert(bounds.maxM.every(function (value) { return approximately(value, 1, 2e-7); }), format + ' upper bounds were not meter-based');
    assert(api.validateGeometryModel(geometry).valid, format + ' geometry did not satisfy the public contract');
  }

  readFixture('generated-unit-cube-m.step').then(function (sourceBytes) {
    return importOnce({
      geometryId: 'step-import-test-cube',
      sourceName: 'generated-unit-cube-m.step',
      sourceFormat: 'step', sourceBytes: sourceBytes
    });
  }).then(function (geometry) {
    assertUnitCube(geometry, 'step');
    return readFixture('generated-unit-cube-m.iges');
  }).then(function (sourceBytes) {
    return importOnce({ geometryId: 'iges-import-test-cube', sourceName: 'generated-unit-cube-m.iges', sourceFormat: 'iges', sourceBytes: sourceBytes });
  }).then(function (geometry) {
    assertUnitCube(geometry, 'iges');
    igesGeometry = geometry;
    return readFixture('generated-unit-cube-m.iges');
  }).then(function (sourceBytes) {
    return meshOnce(igesGeometry, sourceBytes);
  }).then(function (mesh) {
    assert(api.validateVolumeMeshResult(mesh, igesGeometry.faceIds).valid, 'IGES geometry could not be remeshed through its retained source format');
    return readFixture('generated-unit-cube-m.brep');
  }).then(function (sourceBytes) {
    return importOnce({ geometryId: 'brep-import-test-cube', sourceName: 'generated-unit-cube-m.brep', sourceFormat: 'brep', sourceBytes: sourceBytes });
  }).then(function (geometry) {
    assertUnitCube(geometry, 'brep');
    brepGeometry = geometry;
    return readFixture('generated-unit-cube-m.brep');
  }).then(function (sourceBytes) {
    return meshOnce(brepGeometry, sourceBytes);
  }).then(function (mesh) {
    assert(api.validateVolumeMeshResult(mesh, brepGeometry.faceIds).valid, 'BREP geometry could not be remeshed through its retained source format');
    return importOnce({ geometryId: 'format-mismatch', sourceName: 'wrong.iges', sourceFormat: 'step', sourceBytes: new Uint8Array([1]).buffer }).then(function () {
      throw new Error('extension/format mismatch was accepted');
    }).catch(function (error) {
      assert(error.diagnostic && error.diagnostic.code === 'INVALID_IMPORT_REQUEST', 'format mismatch did not produce an invalid-request diagnostic');
    });
  }).then(function () {
    return readFixture('generated-two-unit-cubes-m.step');
  }).then(function (sourceBytes) {
    return importOnce({
      geometryId: 'step-import-test-two-cubes',
      sourceName: 'generated-two-unit-cubes-m.step',
      sourceFormat: 'step', sourceBytes: sourceBytes
    }).then(function () {
      throw new Error('two-solid fixture was accepted');
    }).catch(function (error) {
      assert(error.diagnostic && error.diagnostic.code === 'MULTIPLE_SOLIDS_UNSUPPORTED', 'expected multiple-solid diagnostic');
    });
  }).then(function () {
    return readFixture('invalid-step-text.step');
  }).then(function (sourceBytes) {
    return importOnce({
      geometryId: 'step-import-test-invalid',
      sourceName: 'invalid-step-text.step',
      sourceFormat: 'step', sourceBytes: sourceBytes
    }).then(function () {
      throw new Error('invalid STEP fixture was accepted');
    }).catch(function (error) {
      assert(error.diagnostic && error.diagnostic.code === 'GEOMETRY_NO_SOLID',
        'expected no-solid diagnostic for invalid CAD text (received ' + (error.diagnostic && error.diagnostic.code) + ')');
    });
  }).then(function () {
    status.textContent = 'Passed';
    status.dataset.result = 'passed';
    document.title = 'CAD import tests: Passed';
  }).catch(function (error) {
    status.textContent = (error.diagnostic && error.diagnostic.userMessage) || error.message;
    status.dataset.result = 'failed';
    document.title = 'CAD import tests: Failed';
    throw error;
  });
}(globalThis));
