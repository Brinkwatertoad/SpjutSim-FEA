(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');
  var client = new api.MesherClient();

  function assert(condition, message) { if (!condition) { throw new Error(message); } }
  function readFixture() {
    return fetch('../fixtures/generated-unit-cube-m.step').then(function (response) {
      if (!response.ok) { throw new Error('Cube fixture could not be read.'); }
      return response.arrayBuffer();
    });
  }
  function signedSixVolume(positions, a, b, c, d) {
    var ax = positions[b * 3] - positions[a * 3]; var ay = positions[b * 3 + 1] - positions[a * 3 + 1]; var az = positions[b * 3 + 2] - positions[a * 3 + 2];
    var bx = positions[c * 3] - positions[a * 3]; var by = positions[c * 3 + 1] - positions[a * 3 + 1]; var bz = positions[c * 3 + 2] - positions[a * 3 + 2];
    var cx = positions[d * 3] - positions[a * 3]; var cy = positions[d * 3 + 1] - positions[a * 3 + 1]; var cz = positions[d * 3 + 2] - positions[a * 3 + 2];
    return ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  function surfaceArea(mesh) {
    var positions = mesh.nodePositionsM; var indices = mesh.boundaryFaces.triangleConnectivity; var total = 0; var index;
    for (index = 0; index < indices.length; index += 3) {
      var a = indices[index] * 3; var b = indices[index + 1] * 3; var c = indices[index + 2] * 3;
      var abx = positions[b] - positions[a]; var aby = positions[b + 1] - positions[a + 1]; var abz = positions[b + 2] - positions[a + 2];
      var acx = positions[c] - positions[a]; var acy = positions[c + 1] - positions[a + 1]; var acz = positions[c + 2] - positions[a + 2];
      total += 0.5 * Math.sqrt(Math.pow(aby * acz - abz * acy, 2) + Math.pow(abz * acx - abx * acz, 2) + Math.pow(abx * acy - aby * acx, 2));
    }
    return total;
  }
  function verifyOutwardBoundaryWinding(mesh) {
    var positions = mesh.nodePositionsM;
    var indices = mesh.boundaryFaces.triangleConnectivity;
    var index;
    for (index = 0; index < indices.length; index += 3) {
      var a = indices[index] * 3; var b = indices[index + 1] * 3; var c = indices[index + 2] * 3;
      var abx = positions[b] - positions[a]; var aby = positions[b + 1] - positions[a + 1]; var abz = positions[b + 2] - positions[a + 2];
      var acx = positions[c] - positions[a]; var acy = positions[c + 1] - positions[a + 1]; var acz = positions[c + 2] - positions[a + 2];
      var nx = aby * acz - abz * acy; var ny = abz * acx - abx * acz; var nz = abx * acy - aby * acx;
      var centerX = (positions[a] + positions[b] + positions[c]) / 3 - 0.5;
      var centerY = (positions[a + 1] + positions[b + 1] + positions[c + 1]) / 3 - 0.5;
      var centerZ = (positions[a + 2] + positions[b + 2] + positions[c + 2]) / 3 - 0.5;
      assert(nx * centerX + ny * centerY + nz * centerZ > 0, 'boundary triangle was not oriented outward');
    }
  }
  function verifyMesh(mesh, faceIds) {
    var index;
    assert(api.validateVolumeMeshResult(mesh, faceIds).valid, 'mesh did not satisfy the public contract');
    assert(mesh.quality.invertedElementCount === 0, 'mesh reported inverted tetrahedra');
    assert(mesh.quality.nearZeroJacobianCount === 0, 'mesh returned near-zero-Jacobian tetrahedra');
    assert(mesh.boundaryFaces.faceRanges.length === 6, 'cube boundary did not retain all six CAD faces');
    assert(Math.abs(surfaceArea(mesh) - 6) < 2e-6, 'cube surface area was not preserved');
    verifyOutwardBoundaryWinding(mesh);
    for (index = 0; index < mesh.elementConnectivity.length; index += 4) {
      assert(signedSixVolume(mesh.nodePositionsM, mesh.elementConnectivity[index], mesh.elementConnectivity[index + 1], mesh.elementConnectivity[index + 2], mesh.elementConnectivity[index + 3]) > 0, 'inverted Tet4 connectivity was returned');
    }
  }

  readFixture().then(function (sourceBytes) {
    return client.importGeometry({ geometryId: 'tet4-cube', sourceName: 'generated-unit-cube-m.step', sourceFormat: 'step', sourceBytes: sourceBytes }).then(function (geometry) {
      var faceSet = geometry.faceIds.slice().sort().join('|');
      var counts = [];
      var settings = [
        { preset: 'coarse', elementType: 'tet4' }, { preset: 'normal', elementType: 'tet4' },
        { preset: 'fine', elementType: 'tet4' }, { preset: 'custom', elementType: 'tet4', minSizeM: 0.05, maxSizeM: 0.1 }
      ];
      return settings.reduce(function (sequence, setting) {
        return sequence.then(function () {
          return client.generateMesh({ geometry: geometry, settings: setting, sourceBytes: sourceBytes }).then(function (mesh) {
            verifyMesh(mesh, geometry.faceIds);
            assert(mesh.boundaryFaces.faceRanges.map(function (range) { return range.faceId; }).sort().join('|') === faceSet, 'FaceId set changed after remeshing');
            counts.push(mesh.statistics.elementCount);
          });
        });
      }, Promise.resolve()).then(function () {
        assert(counts[1] > counts[0] && counts[2] > counts[1], 'finer presets did not increase mesh resolution');
      });
    });
  }).then(function () {
    status.textContent = 'Passed'; status.dataset.result = 'passed'; document.title = 'Tet4 mesh tests: Passed';
  }).catch(function (error) {
    status.textContent = (error.diagnostic && error.diagnostic.userMessage) || error.message; status.dataset.result = 'failed'; document.title = 'Tet4 mesh tests: Failed'; throw error;
  }).finally(function () { client.dispose(); });
}(globalThis));
