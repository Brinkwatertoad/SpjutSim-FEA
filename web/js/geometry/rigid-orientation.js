(function (root) {
  'use strict';

  var IDENTITY_MATRIX = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  var ORTHONORMAL_TOLERANCE = 1e-10;

  function validation(valid, reason) { return { valid: valid, reason: reason || null }; }

  function determinant3(matrix) {
    return matrix[0] * (matrix[4] * matrix[8] - matrix[5] * matrix[7]) -
      matrix[1] * (matrix[3] * matrix[8] - matrix[5] * matrix[6]) +
      matrix[2] * (matrix[3] * matrix[7] - matrix[4] * matrix[6]);
  }

  function validateRigidOrientation(orientation) {
    var matrix;
    var row;
    var column;
    var dot;
    if (!orientation || typeof orientation !== 'object' || !Array.isArray(orientation.rotation) ||
        orientation.rotation.length !== 9 || !orientation.rotation.every(Number.isFinite) ||
        !Array.isArray(orientation.operations) || orientation.operations.some(function (item) { return typeof item !== 'string'; })) {
      return validation(false, 'invalid-rigid-orientation');
    }
    matrix = orientation.rotation;
    for (row = 0; row < 3; row += 1) {
      for (column = 0; column < 3; column += 1) {
        dot = matrix[row * 3] * matrix[column * 3] +
          matrix[row * 3 + 1] * matrix[column * 3 + 1] +
          matrix[row * 3 + 2] * matrix[column * 3 + 2];
        if (Math.abs(dot - (row === column ? 1 : 0)) > ORTHONORMAL_TOLERANCE) {
          return validation(false, 'non-orthonormal-orientation');
        }
      }
    }
    return Math.abs(determinant3(matrix) - 1) <= ORTHONORMAL_TOLERANCE
      ? validation(true) : validation(false, 'orientation-reflects-or-scales');
  }

  function rigidOrientation(rotation, operations) {
    var orientation = {
      rotation: Object.freeze(rotation.slice()),
      operations: Object.freeze((operations || []).slice())
    };
    var checked = validateRigidOrientation(orientation);
    if (!checked.valid) { throw new Error('Invalid rigid orientation: ' + checked.reason); }
    return Object.freeze(orientation);
  }

  function identityRigidOrientation() { return rigidOrientation(IDENTITY_MATRIX, []); }

  function cleanTrig(value) { return Math.abs(value) < 1e-15 ? 0 : value; }

  function axisRotationMatrix(axis, degrees) {
    var angle;
    var cosine;
    var sine;
    if (['x', 'y', 'z'].indexOf(axis) === -1 || !Number.isFinite(degrees)) {
      throw new Error('Choose a global X, Y, or Z axis and a finite rotation angle.');
    }
    angle = degrees * Math.PI / 180;
    cosine = cleanTrig(Math.cos(angle));
    sine = cleanTrig(Math.sin(angle));
    if (axis === 'x') { return [1, 0, 0, 0, cosine, -sine, 0, sine, cosine]; }
    if (axis === 'y') { return [cosine, 0, sine, 0, 1, 0, -sine, 0, cosine]; }
    return [cosine, -sine, 0, sine, cosine, 0, 0, 0, 1];
  }

  function transformVector3(matrix, vector) {
    return [
      matrix[0] * vector[0] + matrix[1] * vector[1] + matrix[2] * vector[2],
      matrix[3] * vector[0] + matrix[4] * vector[1] + matrix[5] * vector[2],
      matrix[6] * vector[0] + matrix[7] * vector[1] + matrix[8] * vector[2]
    ];
  }

  function multiplyRotation3(left, right) {
    var result = new Array(9);
    var row;
    var column;
    for (row = 0; row < 3; row += 1) {
      for (column = 0; column < 3; column += 1) {
        result[row * 3 + column] = left[row * 3] * right[column] +
          left[row * 3 + 1] * right[3 + column] + left[row * 3 + 2] * right[6 + column];
      }
    }
    return result;
  }

  function transformTriples(values, rotation, Constructor) {
    var transformed = new Constructor(values.length);
    var index;
    var vector;
    for (index = 0; index < values.length; index += 3) {
      vector = transformVector3(rotation, [values[index], values[index + 1], values[index + 2]]);
      transformed[index] = vector[0]; transformed[index + 1] = vector[1]; transformed[index + 2] = vector[2];
    }
    return transformed;
  }

  function boundsFromPositions(positions) {
    var minimum = [Infinity, Infinity, Infinity];
    var maximum = [-Infinity, -Infinity, -Infinity];
    var index;
    var axis;
    for (index = 0; index < positions.length; index += 3) {
      for (axis = 0; axis < 3; axis += 1) {
        minimum[axis] = Math.min(minimum[axis], positions[index + axis]);
        maximum[axis] = Math.max(maximum[axis], positions[index + axis]);
      }
    }
    return { minM: minimum, maxM: maximum };
  }

  function applyRotationToGeometry(geometry, rotation, operationLabel) {
    var delta = rigidOrientation(rotation, []);
    var currentValidation = validateRigidOrientation(geometry && geometry.orientation);
    var preview;
    var positions;
    if (!currentValidation.valid) { throw new Error('The model does not have a valid rigid orientation.'); }
    preview = geometry.preview;
    positions = transformTriples(preview.positionsM, delta.rotation, Float64Array);
    return Object.assign({}, geometry, {
      orientation: rigidOrientation(
        multiplyRotation3(delta.rotation, geometry.orientation.rotation),
        geometry.orientation.operations.concat(operationLabel ? [operationLabel] : [])
      ),
      boundingBoxM: boundsFromPositions(positions),
      preview: {
        positionsM: positions,
        normals: transformTriples(preview.normals, delta.rotation, Float32Array),
        indices: new Uint32Array(preview.indices),
        faceRanges: preview.faceRanges.map(function (range) { return Object.assign({}, range); }),
        featureEdges: {
          positionsM: transformTriples(preview.featureEdges.positionsM, delta.rotation, Float64Array),
          indices: new Uint32Array(preview.featureEdges.indices)
        }
      }
    });
  }

  function formatAngle(degrees) {
    var normalized = Number(Number(degrees).toPrecision(8));
    return (normalized >= 0 ? '+' : '−') + Math.abs(normalized) + '°';
  }

  function rotateGeometryAroundGlobalAxis(geometry, axis, degrees) {
    return applyRotationToGeometry(geometry, axisRotationMatrix(axis, degrees), axis.toUpperCase() + ' ' + formatAngle(degrees));
  }

  function resetGeometryOrientation(geometry) {
    var matrix;
    var inverse;
    var reset;
    if (!validateRigidOrientation(geometry && geometry.orientation).valid) {
      throw new Error('The model does not have a valid rigid orientation.');
    }
    matrix = geometry.orientation.rotation;
    inverse = [matrix[0], matrix[3], matrix[6], matrix[1], matrix[4], matrix[7], matrix[2], matrix[5], matrix[8]];
    reset = applyRotationToGeometry(geometry, inverse, null);
    return Object.assign({}, reset, { orientation: identityRigidOrientation() });
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.identityRigidOrientation = identityRigidOrientation;
  root.SpjutsimFEA.validateRigidOrientation = validateRigidOrientation;
  root.SpjutsimFEA.axisRotationMatrix = axisRotationMatrix;
  root.SpjutsimFEA.transformVector3 = transformVector3;
  root.SpjutsimFEA.multiplyRotation3 = multiplyRotation3;
  root.SpjutsimFEA.applyRotationToGeometry = applyRotationToGeometry;
  root.SpjutsimFEA.rotateGeometryAroundGlobalAxis = rotateGeometryAroundGlobalAxis;
  root.SpjutsimFEA.resetGeometryOrientation = resetGeometryOrientation;
}(globalThis));
