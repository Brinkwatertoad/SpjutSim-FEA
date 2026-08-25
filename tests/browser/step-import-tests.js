(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');
  var client = new api.MesherClient();

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

  readFixture('generated-unit-cube-m.step').then(function (stepBytes) {
    return client.importGeometry({
      geometryId: 'step-import-test-cube',
      sourceName: 'generated-unit-cube-m.step',
      stepBytes: stepBytes
    });
  }).then(function (geometry) {
    var bounds = geometry.boundingBoxM;
    assert(geometry.faceIds.length === 6, 'expected six opaque CAD face IDs');
    assert(approximately(geometry.volumeM3, 1, 1e-9), 'expected a 1 m³ cube volume');
    assert(bounds.minM.every(function (value) { return approximately(value, 0, 2e-7); }), 'expected meter-based lower bounds');
    assert(bounds.maxM.every(function (value) { return approximately(value, 1, 2e-7); }), 'expected meter-based upper bounds');
    assert(api.validateGeometryModel(geometry).valid, 'returned geometry did not satisfy the public contract');
    return readFixture('generated-two-unit-cubes-m.step');
  }).then(function (stepBytes) {
    return client.importGeometry({
      geometryId: 'step-import-test-two-cubes',
      sourceName: 'generated-two-unit-cubes-m.step',
      stepBytes: stepBytes
    }).then(function () {
      throw new Error('two-solid fixture was accepted');
    }).catch(function (error) {
      assert(error.diagnostic && error.diagnostic.code === 'MULTIPLE_SOLIDS_UNSUPPORTED', 'expected multiple-solid diagnostic');
    });
  }).then(function () {
    return readFixture('invalid-step-text.step');
  }).then(function (stepBytes) {
    return client.importGeometry({
      geometryId: 'step-import-test-invalid',
      sourceName: 'invalid-step-text.step',
      stepBytes: stepBytes
    }).then(function () {
      throw new Error('invalid STEP fixture was accepted');
    }).catch(function (error) {
      assert(error.diagnostic && error.diagnostic.code === 'GEOMETRY_IMPORT_FAILED', 'expected unreadable-STEP diagnostic');
    });
  }).then(function () {
    status.textContent = 'Passed';
    status.dataset.result = 'passed';
    document.title = 'STEP import tests: Passed';
  }).catch(function (error) {
    status.textContent = (error.diagnostic && error.diagnostic.userMessage) || error.message;
    status.dataset.result = 'failed';
    document.title = 'STEP import tests: Failed';
    throw error;
  }).finally(function () {
    client.dispose();
  });
}(globalThis));
