(function (root) {
  'use strict';

  /** Build compact boundary-only display buffers from the public volume-mesh contract. */
  function buildBoundaryMeshDisplay(mesh) {
    var validation = root.SpjutsimFEA.validateVolumeMeshResult(mesh, mesh.boundaryFaces.faceRanges.map(function (range) { return range.faceId; }));
    var triangles;
    var pairs;
    var uniqueCount;
    var lines;
    var triangleIndex;
    var pairIndex;
    if (!validation.valid) { throw new Error('Invalid mesh display source: ' + validation.reason); }
    if (typeof BigUint64Array !== 'function') { throw new Error('This browser cannot build a mesh-line display buffer.'); }
    triangles = mesh.boundaryFaces.triangleConnectivity;
    pairs = new BigUint64Array(triangles.length);
    pairIndex = 0;
    for (triangleIndex = 0; triangleIndex < triangles.length; triangleIndex += 3) {
      addPair(triangles[triangleIndex], triangles[triangleIndex + 1]);
      addPair(triangles[triangleIndex + 1], triangles[triangleIndex + 2]);
      addPair(triangles[triangleIndex + 2], triangles[triangleIndex]);
    }
    pairs.sort();
    uniqueCount = pairs.length ? 1 : 0;
    for (pairIndex = 1; pairIndex < pairs.length; pairIndex += 1) {
      if (pairs[pairIndex] !== pairs[pairIndex - 1]) { uniqueCount += 1; }
    }
    lines = new Uint32Array(uniqueCount * 2);
    uniqueCount = 0;
    for (pairIndex = 0; pairIndex < pairs.length; pairIndex += 1) {
      if (pairIndex && pairs[pairIndex] === pairs[pairIndex - 1]) { continue; }
      lines[uniqueCount * 2] = Number(pairs[pairIndex] >> 32n);
      lines[uniqueCount * 2 + 1] = Number(pairs[pairIndex] & 0xffffffffn);
      uniqueCount += 1;
    }
    return {
      positionsM: mesh.nodePositionsM,
      triangleIndices: triangles,
      lineIndices: lines,
      faceRanges: mesh.boundaryFaces.faceRanges,
      geometryFaceMap: mesh.geometryFaceMap
    };

    function addPair(first, second) {
      var low = Math.min(first, second);
      var high = Math.max(first, second);
      pairs[pairIndex] = (BigInt(low) << 32n) | BigInt(high);
      pairIndex += 1;
    }
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.buildBoundaryMeshDisplay = buildBoundaryMeshDisplay;
}(globalThis));
