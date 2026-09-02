(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');
  var client = new api.MesherClient();
  var edgePairs = [[0, 1], [1, 2], [2, 0], [0, 3], [2, 3], [3, 1]];

  function assert(condition, message) { if (!condition) { throw new Error(message); } }
  function midpointMatches(positions, first, second, middle) {
    var axis;
    for (axis = 0; axis < 3; axis += 1) {
      if (Math.abs(positions[middle * 3 + axis] -
          (positions[first * 3 + axis] + positions[second * 3 + axis]) / 2) > 2e-7) { return false; }
    }
    return true;
  }
  function verify(mesh, faceIds, straightEdges) {
    var offset;
    var edge;
    var boundary = mesh.boundaryFaces;
    var validation = api.validateVolumeMeshResult(mesh, faceIds);
    assert(validation.valid, 'Tet10 mesh contract failed: ' + validation.reason);
    assert(mesh.elementType === 'tet10' && mesh.elementConnectivity.length % 10 === 0,
      'volume connectivity was not Tet10');
    assert(boundary.solverElementType === 'tri6' && boundary.solverConnectivity.length % 6 === 0,
      'quadratic boundary connectivity was lost');
    assert(boundary.triangleConnectivity.length === boundary.solverConnectivity.length * 2,
      'each Tri6 boundary face was not split into four display triangles');
    assert(mesh.quality.minimumJacobian > 0 && mesh.quality.maximumEdgeRatio >= 1,
      'quadratic quality metadata was invalid');
    if (straightEdges) {
      for (offset = 0; offset < mesh.elementConnectivity.length; offset += 10) {
        for (edge = 0; edge < edgePairs.length; edge += 1) {
          assert(midpointMatches(mesh.nodePositionsM,
            mesh.elementConnectivity[offset + edgePairs[edge][0]],
            mesh.elementConnectivity[offset + edgePairs[edge][1]],
            mesh.elementConnectivity[offset + 4 + edge]),
          'Gmsh Tet10 edge-node ordering was not converted correctly');
        }
      }
    }
  }

  function runFixture(sourceName, straightEdges) {
    return fetch('../fixtures/' + sourceName).then(function (response) {
      if (!response.ok) { throw new Error(sourceName + ' fixture could not be read.'); }
      return response.arrayBuffer();
    }).then(function (sourceBytes) {
      return client.importGeometry({ geometryId: 'tet10-' + sourceName, sourceName: sourceName,
        sourceFormat: 'step', sourceBytes: sourceBytes }).then(function (geometry) {
        return client.generateMesh({ geometry: geometry, settings: { preset: 'coarse', elementType: 'tet10' },
          sourceBytes: sourceBytes }).then(function (mesh) { verify(mesh, geometry.faceIds, straightEdges); });
      });
    });
  }

  [
    ['generated-unit-cube-m.step', true],
    ['generated-cylinder-r0_5-h1-m.step', false],
    ['generated-sphere-r0_5-m.step', false]
  ].reduce(function (sequence, fixture) {
    return sequence.then(function () { return runFixture(fixture[0], fixture[1]); });
  }, Promise.resolve()).then(function () {
  }).then(function () {
    status.textContent = 'Passed'; status.dataset.result = 'passed'; document.title = 'Tet10 mesh tests: Passed';
  }).catch(function (error) {
    status.textContent = (error.diagnostic && error.diagnostic.userMessage) || error.message;
    status.dataset.result = 'failed'; document.title = 'Tet10 mesh tests: Failed'; throw error;
  }).finally(function () { client.dispose(); });
}(globalThis));
