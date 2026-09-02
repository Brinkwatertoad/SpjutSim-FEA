(function (root) {
  'use strict';

  function surfaceSource(documentState) {
    if (documentState.mesh) {
      return {
        positionsM: documentState.mesh.nodePositionsM,
        indices: documentState.mesh.boundaryFaces.triangleConnectivity,
        faceMap: documentState.mesh.geometryFaceMap
      };
    }
    if (documentState.geometry) {
      var map = {};
      documentState.geometry.preview.faceRanges.forEach(function (range) { map[range.faceId] = range; });
      return { positionsM: documentState.geometry.preview.positionsM, indices: documentState.geometry.preview.indices, faceMap: map };
    }
    return null;
  }

  function faceCentroidNormal(surface, faceId) {
    var range = surface.faceMap[faceId];
    var weightedCenter = [0, 0, 0];
    var weightedNormal = [0, 0, 0];
    var totalArea = 0;
    var representative = null;
    var offset;
    if (!range) { return null; }
    for (offset = range.start; offset < range.start + range.count; offset += 3) {
      var ia = surface.indices[offset] * 3;
      var ib = surface.indices[offset + 1] * 3;
      var ic = surface.indices[offset + 2] * 3;
      var ab = [surface.positionsM[ib] - surface.positionsM[ia], surface.positionsM[ib + 1] - surface.positionsM[ia + 1], surface.positionsM[ib + 2] - surface.positionsM[ia + 2]];
      var ac = [surface.positionsM[ic] - surface.positionsM[ia], surface.positionsM[ic + 1] - surface.positionsM[ia + 1], surface.positionsM[ic + 2] - surface.positionsM[ia + 2]];
      var cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
      var twiceArea = Math.hypot(cross[0], cross[1], cross[2]);
      var area = twiceArea / 2;
      var center;
      if (!(area > 0)) { continue; }
      center = [
        (surface.positionsM[ia] + surface.positionsM[ib] + surface.positionsM[ic]) / 3,
        (surface.positionsM[ia + 1] + surface.positionsM[ib + 1] + surface.positionsM[ic + 1]) / 3,
        (surface.positionsM[ia + 2] + surface.positionsM[ib + 2] + surface.positionsM[ic + 2]) / 3
      ];
      weightedCenter[0] += center[0] * area;
      weightedCenter[1] += center[1] * area;
      weightedCenter[2] += center[2] * area;
      weightedNormal[0] += cross[0] / 2; weightedNormal[1] += cross[1] / 2; weightedNormal[2] += cross[2] / 2;
      totalArea += area;
      if (!representative || area > representative.area * (1 + 1e-12) ||
          (Math.abs(area - representative.area) <= Math.max(area, representative.area) * 1e-12 &&
           (center[0] > representative.positionM[0] ||
            (center[0] === representative.positionM[0] && center[1] > representative.positionM[1]) ||
            (center[0] === representative.positionM[0] && center[1] === representative.positionM[1] && center[2] > representative.positionM[2])))) {
        representative = {
          area: area, positionM: center,
          outwardNormal: [cross[0] / twiceArea, cross[1] / twiceArea, cross[2] / twiceArea]
        };
      }
    }
    var normalLength = Math.hypot(weightedNormal[0], weightedNormal[1], weightedNormal[2]);
    if (!(totalArea > 0) || !representative) { return null; }
    if (!(normalLength / totalArea > 0.98)) {
      return { positionM: representative.positionM, outwardNormal: representative.outwardNormal };
    }
    return {
      positionM: [weightedCenter[0] / totalArea, weightedCenter[1] / totalArea, weightedCenter[2] / totalArea],
      outwardNormal: [weightedNormal[0] / normalLength, weightedNormal[1] / normalLength, weightedNormal[2] / normalLength]
    };
  }

  function normalized(vector) {
    var length = Math.hypot(vector[0], vector[1], vector[2]);
    return length > 0 ? [vector[0] / length, vector[1] / length, vector[2] / length] : [0, 0, 0];
  }

  function faceTriangles(surface, faceId) {
    var range = surface.faceMap[faceId];
    var triangles = [];
    var totalAreaM2 = 0;
    var offset;
    if (!range) { return { triangles: triangles, totalAreaM2: 0 }; }
    for (offset = range.start; offset < range.start + range.count; offset += 3) {
      var indices = [surface.indices[offset], surface.indices[offset + 1], surface.indices[offset + 2]];
      var points = indices.map(function (node) {
        return [surface.positionsM[node * 3], surface.positionsM[node * 3 + 1], surface.positionsM[node * 3 + 2]];
      });
      var ab = points[1].map(function (value, axis) { return value - points[0][axis]; });
      var ac = points[2].map(function (value, axis) { return value - points[0][axis]; });
      var cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
      var twiceArea = Math.hypot(cross[0], cross[1], cross[2]);
      if (!(twiceArea > 0) || !Number.isFinite(twiceArea)) { continue; }
      totalAreaM2 += twiceArea / 2;
      triangles.push({ points: points, areaM2: twiceArea / 2, cumulativeAreaM2: totalAreaM2,
        outwardNormal: [cross[0] / twiceArea, cross[1] / twiceArea, cross[2] / twiceArea] });
    }
    return { triangles: triangles, totalAreaM2: totalAreaM2 };
  }

  function sampleFaceGlyphPoints(surface, faceId, options) {
    var data = faceTriangles(surface, faceId);
    var spacingM = Number(options && options.spacingM);
    var minimum = Math.max(1, Number(options && options.minCount) || 1);
    var maximum = Math.max(minimum, Number(options && options.maxCount) || 12);
    var count;
    var samples = [];
    var index;
    if (!(data.totalAreaM2 > 0)) { return samples; }
    if (!(spacingM > 0)) { throw new Error('Surface glyph spacing must be greater than zero.'); }
    count = Math.max(minimum, Math.min(maximum, Math.ceil(data.totalAreaM2 / (spacingM * spacingM))));
    for (index = 0; index < count; index += 1) {
      var targetArea = (index + 0.5) * data.totalAreaM2 / count;
      var triangle = data.triangles.find(function (item) { return item.cumulativeAreaM2 >= targetArea; }) || data.triangles[data.triangles.length - 1];
      var u = ((index + 1) * 0.7548776662466927) % 1;
      var v = ((index + 1) * 0.5698402909980532) % 1;
      var rootU = Math.sqrt(u);
      var weights = [1 - rootU, rootU * (1 - v), rootU * v];
      samples.push({
        positionM: [0, 1, 2].map(function (axis) {
          return triangle.points[0][axis] * weights[0] + triangle.points[1][axis] * weights[1] + triangle.points[2][axis] * weights[2];
        }),
        outwardNormal: triangle.outwardNormal.slice()
      });
    }
    return samples;
  }

  function defaultGlyphSpacing(surface) {
    var minimum = [Infinity, Infinity, Infinity];
    var maximum = [-Infinity, -Infinity, -Infinity];
    for (var index = 0; index < surface.positionsM.length; index += 3) {
      for (var axis = 0; axis < 3; axis += 1) {
        minimum[axis] = Math.min(minimum[axis], surface.positionsM[index + axis]);
        maximum[axis] = Math.max(maximum[axis], surface.positionsM[index + axis]);
      }
    }
    return Math.max(maximum[0] - minimum[0], maximum[1] - minimum[1], maximum[2] - minimum[2], 1e-6) * 0.5;
  }

  function buildAnalysisGlyphDescriptors(documentState) {
    var surface = surfaceSource(documentState);
    var descriptors = [];
    if (!surface) { return descriptors; }
    var sampling = { spacingM: defaultGlyphSpacing(surface), minCount: 1, maxCount: 12 };
    documentState.boundaryConditions.forEach(function (condition) {
      condition.faceIds.forEach(function (faceId) {
        sampleFaceGlyphPoints(surface, faceId, sampling).forEach(function (sample) {
          descriptors.push({ type: condition.type, itemId: condition.id, faceId: faceId, positionM: sample.positionM,
            direction: sample.outwardNormal, components: ['x', 'y', 'z'].filter(function (axis) { return condition.componentsM[axis] !== undefined; }) });
        });
      });
    });
    documentState.loads.forEach(function (load) {
      load.faceIds.forEach(function (faceId) {
        sampleFaceGlyphPoints(surface, faceId, sampling).forEach(function (sample) {
          var direction = load.type === 'pressure'
            ? sample.outwardNormal.map(function (value) { return -value; })
            : normalized(load.forceN);
          descriptors.push({ type: load.type, itemId: load.id, faceId: faceId, positionM: sample.positionM, direction: direction });
        });
      });
    });
    if (documentState.gravity && documentState.gravity.enabled && documentState.geometry) {
      var bounds = documentState.geometry.boundingBoxM;
      descriptors.push({
        type: 'gravity', itemId: 'gravity', faceId: null,
        positionM: [(bounds.minM[0] + bounds.maxM[0]) / 2, (bounds.minM[1] + bounds.maxM[1]) / 2, bounds.maxM[2]],
        direction: normalized(documentState.gravity.accelerationMS2)
      });
    }
    return descriptors;
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.faceCentroidNormal = faceCentroidNormal;
  root.SpjutsimFEA.sampleFaceGlyphPoints = sampleFaceGlyphPoints;
  root.SpjutsimFEA.buildAnalysisGlyphDescriptors = buildAnalysisGlyphDescriptors;
}(globalThis));
