(function (root) {
  'use strict';

  function triangleData(positions, connectivity, offset) {
    var ia = connectivity[offset] * 3;
    var ib = connectivity[offset + 1] * 3;
    var ic = connectivity[offset + 2] * 3;
    var abx = positions[ib] - positions[ia];
    var aby = positions[ib + 1] - positions[ia + 1];
    var abz = positions[ib + 2] - positions[ia + 2];
    var acx = positions[ic] - positions[ia];
    var acy = positions[ic + 1] - positions[ia + 1];
    var acz = positions[ic + 2] - positions[ia + 2];
    var nx = aby * acz - abz * acy;
    var ny = abz * acx - abx * acz;
    var nz = abx * acy - aby * acx;
    var twiceArea = Math.hypot(nx, ny, nz);
    if (!Number.isFinite(twiceArea) || twiceArea <= 0) { throw new Error('Selected boundary contains a degenerate triangle.'); }
    return { areaM2: twiceArea / 2, normal: [nx / twiceArea, ny / twiceArea, nz / twiceArea] };
  }

  function selectedBoundary(mesh, faceIds) {
    var connectivity = mesh.boundaryFaces.triangleConnectivity;
    var solverConnectivity = mesh.boundaryFaces.solverConnectivity;
    var solverRanges = mesh.boundaryFaces.solverFaceRanges;
    var selectedConnectivity = [];
    var selectedSolverConnectivity = [];
    var areas = [];
    var normals = [];
    var nodes = new Set();
    faceIds.forEach(function (faceId) {
      var range = mesh.geometryFaceMap[faceId];
      var solverRange = solverRanges.find(function (candidate) { return candidate.faceId === faceId; });
      var offset;
      var triangle;
      if (!range || !solverRange) { throw new Error('Boundary mapping was lost for CAD face ' + faceId + '.'); }
      for (offset = solverRange.start; offset < solverRange.start + solverRange.count; offset += 1) {
        selectedSolverConnectivity.push(solverConnectivity[offset]);
        nodes.add(solverConnectivity[offset]);
      }
      for (offset = range.start; offset < range.start + range.count; offset += 3) {
        selectedConnectivity.push(connectivity[offset], connectivity[offset + 1], connectivity[offset + 2]);
        nodes.add(connectivity[offset]); nodes.add(connectivity[offset + 1]); nodes.add(connectivity[offset + 2]);
        triangle = triangleData(mesh.nodePositionsM, connectivity, offset);
        areas.push(triangle.areaM2);
        normals.push(triangle.normal[0], triangle.normal[1], triangle.normal[2]);
      }
    });
    return {
      surfaceElementType: mesh.boundaryFaces.solverElementType,
      surfaceConnectivity: new Uint32Array(selectedSolverConnectivity),
      triangleConnectivity: new Uint32Array(selectedConnectivity),
      triangleAreasM2: new Float64Array(areas),
      outwardNormals: new Float64Array(normals),
      nodeIndices: new Uint32Array(Array.from(nodes).sort(function (a, b) { return a - b; }))
    };
  }

  function equivalentPressureForces(surface, pressurePa) {
    var forces = new Float64Array(surface.triangleConnectivity.length * 3);
    var triangleIndex;
    var corner;
    for (triangleIndex = 0; triangleIndex < surface.triangleAreasM2.length; triangleIndex += 1) {
      for (corner = 0; corner < 3; corner += 1) {
        forces[(triangleIndex * 3 + corner) * 3] = -pressurePa * surface.outwardNormals[triangleIndex * 3] * surface.triangleAreasM2[triangleIndex] / 3;
        forces[(triangleIndex * 3 + corner) * 3 + 1] = -pressurePa * surface.outwardNormals[triangleIndex * 3 + 1] * surface.triangleAreasM2[triangleIndex] / 3;
        forces[(triangleIndex * 3 + corner) * 3 + 2] = -pressurePa * surface.outwardNormals[triangleIndex * 3 + 2] * surface.triangleAreasM2[triangleIndex] / 3;
      }
    }
    return forces;
  }

  function equivalentTotalForce(surface, forceN) {
    var totalArea = 0;
    var forces = new Float64Array(surface.triangleConnectivity.length * 3);
    var triangleIndex;
    var corner;
    surface.triangleAreasM2.forEach(function (area) { totalArea += area; });
    if (!(totalArea > 0)) { throw new Error('The selected faces have no usable surface area.'); }
    for (triangleIndex = 0; triangleIndex < surface.triangleAreasM2.length; triangleIndex += 1) {
      for (corner = 0; corner < 3; corner += 1) {
        forces[(triangleIndex * 3 + corner) * 3] = forceN[0] * surface.triangleAreasM2[triangleIndex] / totalArea / 3;
        forces[(triangleIndex * 3 + corner) * 3 + 1] = forceN[1] * surface.triangleAreasM2[triangleIndex] / totalArea / 3;
        forces[(triangleIndex * 3 + corner) * 3 + 2] = forceN[2] * surface.triangleAreasM2[triangleIndex] / totalArea / 3;
      }
    }
    return forces;
  }

  /**
   * Project the analysis document into a mesher-independent solver request.
   * Surface loads retain integration data and equivalent per-triangle-corner forces.
   */
  function prepareSolverInput(documentState) {
    var mesh = documentState && documentState.mesh;
    var knownFaceIds = documentState && documentState.geometry && documentState.geometry.faceIds;
    var materialValidation;
    var gravityValidation;
    var constraintStability;
    if (!mesh) { throw new Error('Generate a mesh before preparing solver input.'); }
    if (!Array.isArray(knownFaceIds)) { throw new Error('Imported geometry is required.'); }
    materialValidation = root.SpjutsimFEA.validateIsotropicMaterial(documentState.material, documentState.gravity);
    if (!materialValidation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(materialValidation)); }
    gravityValidation = root.SpjutsimFEA.validateGravity(documentState.gravity, materialValidation.value);
    if (!gravityValidation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(gravityValidation)); }
    constraintStability = root.SpjutsimFEA.analyzeDocumentConstraintStability(documentState);
    if (!constraintStability || constraintStability.basis !== 'mesh') {
      throw new Error('Mesh-exact rigid-body stability diagnostics are required before preflight.');
    }
    return {
      protocol: root.SpjutsimFEA.WORKER_PROTOCOL_VERSION,
      mesh: mesh,
      material: materialValidation.value,
      constraintStability: constraintStability,
      boundaryConditions: documentState.boundaryConditions.map(function (condition) {
        var validated = root.SpjutsimFEA.validateBoundaryCondition(condition, knownFaceIds);
        var surface;
        if (!validated.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validated)); }
        surface = selectedBoundary(mesh, condition.faceIds);
        return Object.assign({}, validated.value, {
          boundaryTriangleConnectivity: surface.triangleConnectivity,
          nodeIndices: surface.nodeIndices
        });
      }),
      loads: documentState.loads.map(function (load) {
        var validated = root.SpjutsimFEA.validateLoad(load, knownFaceIds);
        var surface;
        if (!validated.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validated)); }
        surface = selectedBoundary(mesh, load.faceIds);
        return Object.assign({}, validated.value, surface, {
          equivalentNodalForcesN: load.type === 'pressure'
            ? equivalentPressureForces(surface, load.pressurePa)
            : equivalentTotalForce(surface, load.forceN)
        });
      }),
      gravity: gravityValidation.value
    };
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.selectedBoundary = selectedBoundary;
  root.SpjutsimFEA.equivalentPressureForces = equivalentPressureForces;
  root.SpjutsimFEA.equivalentTotalForce = equivalentTotalForce;
  root.SpjutsimFEA.prepareSolverInput = prepareSolverInput;
}(globalThis));
