(function(root){
 var api=root.SpjutsimFEA;
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
      boundaryFaces: { solverElementType: 'tri3', solverConnectivity: new Uint32Array(cube.indices),
        solverFaceRanges: faceRanges.map(function (range) { return Object.assign({}, range); }),
        triangleConnectivity: cube.indices, faceRanges: faceRanges }, geometryFaceMap: faceMap,
      statistics: { nodeCount: 8, elementCount: 1, boundaryTriangleCount: 12, boundaryElementCount: 12,
        minCharacteristicSizeM: 1, maxCharacteristicSizeM: 1 },
      quality: { metric: 'gamma', minimum: 0.5, minimumJacobian: 1, maximumEdgeRatio: 1,
        invertedElementCount: 0, nearZeroJacobianCount: 0 },
      memoryInputs: { nodeCount: 8, elementCount: 1, connectivityEntries: 4, boundaryConnectivityEntries: 36 }
    };
  }


 api.assignmentTestGeometry=cubeGeometry; api.assignmentTestMesh=cubeMesh;
}(globalThis));
