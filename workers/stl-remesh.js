/* Experimental source-surface parametrization. This does not fit smooth CAD. */
(function (root) {
  'use strict';
  function fail(code, message) {
    var error = new Error(message); error.code = code; throw error;
  }
  function triangleArea(positions, a, b, c) {
    a *= 3; b *= 3; c *= 3;
    var ax = positions[b] - positions[a], ay = positions[b + 1] - positions[a + 1], az = positions[b + 2] - positions[a + 2];
    var bx = positions[c] - positions[a], by = positions[c + 1] - positions[a + 1], bz = positions[c + 2] - positions[a + 2];
    return Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx) / 2;
  }
  function boundaryDiagnostics(sourceAreas, positions, boundary, arity) {
    // This mode uses straight Tri3/Tri6 geometry; corner area is its exact area.
    var meshAreas = boundary.solverFaceRanges.map(function (range) {
      var area = 0, ids = boundary.solverConnectivity;
      for (var i = range.start; i < range.start + range.count; i += arity) {
        area += triangleArea(positions, ids[i], ids[i + 1], ids[i + 2]);
      }
      return area;
    });
    if (meshAreas.some(function (area) { return !Number.isFinite(area) || area <= 0; })) {
      fail('STL_REMESH_FAILED', 'The remeshed boundary contains an invalid patch area. Refine the mesh or keep the original triangles.');
    }
    var worst = 0, maximumError = 0;
    meshAreas.forEach(function (area, index) {
      var relative = Math.abs(area / sourceAreas[index] - 1);
      if (relative > maximumError) { maximumError = relative; worst = index; }
    });
    // This 1% warning concerns load fidelity, not solver convergence, and is
    // not a geometric error certificate. Small area error can hide shape error.
    var warning = maximumError > .01 ? 'Experimental STL remesh: patch ' + (worst + 1) +
      ' boundary area differs by ' + (100 * maximumError).toPrecision(3) +
      '% from the source; pressure forces can change. Refine and compare results.' : null;
    return { areas: { version: 1, sourceM2: sourceAreas, meshM2: meshAreas }, warning: warning };
  }
  function build(gmsh, parsed) {
    if (parsed.patches.length > 512) {
      fail('STL_PATCH_LIMIT', 'Experimental remeshing supports at most 512 selection groups. Review a larger grouping angle.');
    }
    var mesh = gmsh.model.mesh;
    var tags = parsed.patches.map(function () { return gmsh.model.addDiscreteEntity(2); });
    var nodeTags = new Uint32Array(parsed.positions.length / 3);
    for (var i = 0; i < nodeTags.length; i++) { nodeTags[i] = i + 1; }
    mesh.addNodes(2, tags[0], nodeTags, parsed.positions);
    var blocks = parsed.patches.map(function (patch) {
      return { elements: new Uint32Array(patch.triangleCount), nodes: new Uint32Array(patch.triangleCount * 3), offset: 0 };
    });
    var sourceAreas = new Array(tags.length).fill(0);
    for (var triangle = 0; triangle < parsed.patchByTriangle.length; triangle++) {
      var block = blocks[parsed.patchByTriangle[triangle]], offset = block.offset++;
      // Explicit element tags retain source ownership through classification.
      block.elements[offset] = triangle + 1;
      for (var edge = 0; edge < 3; edge++) { block.nodes[offset * 3 + edge] = parsed.triangles[triangle * 3 + edge] + 1; }
      sourceAreas[parsed.patchByTriangle[triangle]] += triangleArea(parsed.positions,
        parsed.triangles[triangle * 3], parsed.triangles[triangle * 3 + 1], parsed.triangles[triangle * 3 + 2]);
    }
    tags.forEach(function (tag, index) { mesh.addElementsByType(tag, 2, blocks[index].elements, blocks[index].nodes); });
    // A selectable group may span several features. Subdivide it into charts
    // that admit a single parametrization without changing user assignments.
    // The default 5-degree feature angle retains a 64-sided cylinder's creases;
    // broader angles allow fewer constraints on complex curved input.
    var featureAngle = Math.min(parsed.options.remeshFeatureAngleDegrees, parsed.options.patchAngleDegrees);
    mesh.classifySurfaces(featureAngle * Math.PI / 180, true, true, Math.PI, true);
    var entities = gmsh.model.getEntities(2).dimTags, surfaces = [];
    for (i = 1; i < entities.length; i += 2) { surfaces.push(entities[i]); }
    if (!surfaces.length) { fail('STL_REMESH_FAILED', 'Surface parametrization produced no usable surfaces. Keep the original STL triangles.'); }
    if (surfaces.length > 512) {
      fail('STL_PATCH_LIMIT', 'Experimental remeshing requires more than 512 surface charts. Keep the original triangles or try a simpler source.');
    }
    var groups = tags.map(function () { return []; }), seen = new Uint8Array(parsed.patchByTriangle.length), matched = 0;
    surfaces.forEach(function (tag) {
      var elements = mesh.getElements(2, tag), owner;
      elements.elementTags.forEach(function (elementTags, blockIndex) {
        if (elements.elementTypes[blockIndex] !== 2) { fail('STL_PATCH_MAPPING_FAILED', 'Surface parametrization changed source element types.'); }
        for (var id of elementTags) {
          var source = id - 1;
          if (!Number.isInteger(source) || source < 0 || source >= seen.length || seen[source]) {
            fail('STL_PATCH_MAPPING_FAILED', 'Surface parametrization lost or duplicated source triangles.');
          }
          var candidate = parsed.patchByTriangle[source];
          if (owner !== undefined && owner !== candidate) {
            fail('STL_PATCH_MAPPING_FAILED', 'Surface parametrization crossed a selection boundary. Review different grouping.');
          }
          owner = candidate; seen[source] = 1; matched++;
        }
      });
      if (owner === undefined) { fail('STL_PATCH_MAPPING_FAILED', 'Surface parametrization created an empty chart.'); }
      groups[owner].push(tag);
    });
    if (matched !== seen.length || groups.some(function (group) { return !group.length; })) {
      fail('STL_PATCH_MAPPING_FAILED', 'Surface parametrization did not preserve every source selection group.');
    }
    mesh.createGeometry();
    var loop = gmsh.model.geo.addSurfaceLoop(surfaces), solid = gmsh.model.geo.addVolume([loop]);
    gmsh.model.geo.synchronize();
    gmsh.option.setNumber('Mesh.MeshOnlyEmpty', 0);
    return { solidTag: solid, surfaceTags: groups, internalSurfaceCount: surfaces.length, referenceAreasM2: sourceAreas, remeshing: {
      version: 1, method: 'stl-parametrization', featureAngleDegrees: featureAngle,
      surfaceCountsByPatch: groups.map(function (group) { return group.length; })
    } };
  }
  root.StlRemesh = { build: build, boundaryDiagnostics: boundaryDiagnostics };
}(globalThis));
