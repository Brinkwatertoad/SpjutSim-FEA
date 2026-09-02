(function (root) {
  'use strict';

  var MODE_IDS = Object.freeze(['Tx', 'Ty', 'Tz', 'Rx', 'Ry', 'Rz']);
  var RANK_TOLERANCE = 1e-10;

  function geometryCenterAndScale(positions) {
    var minimum = [Infinity, Infinity, Infinity];
    var maximum = [-Infinity, -Infinity, -Infinity];
    var index;
    var axis;
    if (!(positions instanceof Float64Array) || !positions.length || positions.length % 3) {
      throw new Error('Rigid-body stability requires finite 3D point coordinates.');
    }
    for (index = 0; index < positions.length; index += 3) {
      for (axis = 0; axis < 3; axis += 1) {
        if (!Number.isFinite(positions[index + axis])) {
          throw new Error('Rigid-body stability requires finite 3D point coordinates.');
        }
        minimum[axis] = Math.min(minimum[axis], positions[index + axis]);
        maximum[axis] = Math.max(maximum[axis], positions[index + axis]);
      }
    }
    var center = minimum.map(function (value, component) { return (value + maximum[component]) / 2; });
    var scale = Math.max(maximum[0] - minimum[0], maximum[1] - minimum[1], maximum[2] - minimum[2]);
    return { center: center, scale: Math.max(scale, Number.MIN_VALUE) };
  }

  function observationRow(position, axis) {
    if (axis === 'x') { return [1, 0, 0, 0, position[2], -position[1]]; }
    if (axis === 'y') { return [0, 1, 0, -position[2], 0, position[0]]; }
    if (axis === 'z') { return [0, 0, 1, position[1], -position[0], 0]; }
    throw new Error('Rigid-body stability observations must use global X, Y, or Z.');
  }

  function reducedRows(sourceRows) {
    var rows = sourceRows.map(function (row) { return row.slice(); });
    var pivotColumns = [];
    var rank = 0;
    var column;
    var candidate;
    var pivot;
    var divisor;
    var row;
    var factor;
    for (column = 0; column < 6 && rank < rows.length; column += 1) {
      pivot = rank;
      for (candidate = rank + 1; candidate < rows.length; candidate += 1) {
        if (Math.abs(rows[candidate][column]) > Math.abs(rows[pivot][column])) { pivot = candidate; }
      }
      if (Math.abs(rows[pivot][column]) <= RANK_TOLERANCE) { continue; }
      if (pivot !== rank) { row = rows[rank]; rows[rank] = rows[pivot]; rows[pivot] = row; }
      divisor = rows[rank][column];
      for (candidate = column; candidate < 6; candidate += 1) { rows[rank][candidate] /= divisor; }
      for (row = 0; row < rows.length; row += 1) {
        if (row === rank) { continue; }
        factor = rows[row][column];
        if (Math.abs(factor) <= RANK_TOLERANCE) { continue; }
        for (candidate = column; candidate < 6; candidate += 1) {
          rows[row][candidate] -= factor * rows[rank][candidate];
        }
      }
      pivotColumns.push(column);
      rank += 1;
    }
    return { rows: rows.slice(0, rank), pivotColumns: pivotColumns, rank: rank };
  }

  function nullspaceBasis(reduced) {
    var freeColumns = [];
    var basis = [];
    var column;
    var row;
    for (column = 0; column < 6; column += 1) {
      if (reduced.pivotColumns.indexOf(column) === -1) { freeColumns.push(column); }
    }
    freeColumns.forEach(function (freeColumn) {
      var vector = [0, 0, 0, 0, 0, 0];
      vector[freeColumn] = 1;
      for (row = 0; row < reduced.rank; row += 1) {
        vector[reduced.pivotColumns[row]] = -reduced.rows[row][freeColumn];
      }
      basis.push(vector);
    });
    return basis;
  }

  function analyzeRigidModeObservations(positions, observations) {
    var frame = geometryCenterAndScale(positions);
    var rows;
    var reduced;
    var basis;
    var modes;
    var canonicalFreeCount;
    if (!Array.isArray(observations)) { throw new Error('Rigid-body stability observations must be an array.'); }
    rows = observations.map(function (observation) {
      var offset;
      if (!observation || !Number.isInteger(observation.pointIndex) || observation.pointIndex < 0 ||
          observation.pointIndex * 3 + 2 >= positions.length) {
        throw new Error('A rigid-body stability observation references a missing point.');
      }
      offset = observation.pointIndex * 3;
      return observationRow([
        (positions[offset] - frame.center[0]) / frame.scale,
        (positions[offset + 1] - frame.center[1]) / frame.scale,
        (positions[offset + 2] - frame.center[2]) / frame.scale
      ], observation.axis);
    });
    reduced = reducedRows(rows);
    basis = nullspaceBasis(reduced);
    modes = MODE_IDS.map(function (id, column) {
      var canonicalFree = rows.every(function (row) { return Math.abs(row[column]) <= RANK_TOLERANCE; });
      var absentFromNullspace = basis.every(function (vector) { return Math.abs(vector[column]) <= RANK_TOLERANCE; });
      return Object.freeze({ id: id, status: canonicalFree ? 'free' : (absentFromNullspace ? 'constrained' : 'coupled') });
    });
    canonicalFreeCount = modes.filter(function (mode) { return mode.status === 'free'; }).length;
    return Object.freeze({
      status: reduced.rank === 6 ? 'fully-constrained' : 'underconstrained',
      rank: reduced.rank,
      constrainedModeCount: reduced.rank,
      freeModeCount: 6 - reduced.rank,
      coupledFreedomCount: Math.max(0, 6 - reduced.rank - canonicalFreeCount),
      modes: Object.freeze(modes),
      tolerance: RANK_TOLERANCE
    });
  }

  function rangeForFace(ranges, faceMap, faceId) {
    if (faceMap && faceMap[faceId]) { return faceMap[faceId]; }
    return ranges.find(function (range) { return range.faceId === faceId; }) || null;
  }

  function sampledFacePoints(connectivity, range, sampleLimit) {
    var unique = new Set();
    var points;
    var sampled = [];
    var index;
    for (index = range.start; index < range.start + range.count; index += 1) { unique.add(connectivity[index]); }
    points = Array.from(unique).sort(function (left, right) { return left - right; });
    if (!sampleLimit || points.length <= sampleLimit) { return points; }
    for (index = 0; index < sampleLimit; index += 1) {
      sampled.push(points[Math.floor(index * (points.length - 1) / (sampleLimit - 1))]);
    }
    return sampled;
  }

  function documentSupportObservations(documentState) {
    var mesh = documentState.mesh;
    var geometry = documentState.geometry;
    var positions = mesh ? mesh.nodePositionsM : geometry.preview.positionsM;
    var connectivity = mesh ? mesh.boundaryFaces.triangleConnectivity : geometry.preview.indices;
    var ranges = mesh ? mesh.boundaryFaces.faceRanges : geometry.preview.faceRanges;
    var faceMap = mesh ? mesh.geometryFaceMap : null;
    var sampleLimit = mesh ? 0 : 64;
    var observations = [];
    var observationKeys = new Set();
    var constrainedPoints = new Set();
    documentState.boundaryConditions.forEach(function (support) {
      support.faceIds.forEach(function (faceId) {
        var range = rangeForFace(ranges, faceMap, faceId);
        if (!range) { throw new Error('Support stability could not find CAD face ' + faceId + '.'); }
        sampledFacePoints(connectivity, range, sampleLimit).forEach(function (pointIndex) {
          constrainedPoints.add(pointIndex);
          ['x', 'y', 'z'].forEach(function (axis) {
            var key;
            if (support.componentsM[axis] === undefined) { return; }
            key = pointIndex + ':' + axis;
            if (!observationKeys.has(key)) {
              observationKeys.add(key);
              observations.push({ pointIndex: pointIndex, axis: axis });
            }
          });
        });
      });
    });
    return { positions: positions, observations: observations, constrainedPointCount: constrainedPoints.size };
  }

  function analyzeDocumentConstraintStability(documentState) {
    var data;
    var analysis;
    if (!documentState || !documentState.geometry) { return null; }
    data = documentSupportObservations(documentState);
    analysis = analyzeRigidModeObservations(data.positions, data.observations);
    return Object.freeze(Object.assign({}, analysis, {
      basis: documentState.mesh ? 'mesh' : 'preview',
      provisional: !documentState.mesh,
      observationCount: data.observations.length,
      constrainedPointCount: data.constrainedPointCount
    }));
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.analyzeRigidModeObservations = analyzeRigidModeObservations;
  root.SpjutsimFEA.analyzeDocumentConstraintStability = analyzeDocumentConstraintStability;
}(globalThis));
