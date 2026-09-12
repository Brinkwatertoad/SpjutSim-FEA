/* Experimental M28 adapter. Not loaded by the application. */
(function (root) {
  'use strict';
  function createStlExperiment() {
    var scales = { m: 1, mm: 0.001, cm: 0.01, in: 0.0254, ft: 0.3048 };
    function fail(code, message) { var error = new Error(message); error.code = code; throw error; }
    function parse(bytes, options) {
      if (!options || !Object.prototype.hasOwnProperty.call(scales, options.unit) ||
          !Number.isFinite(options.angleDegrees) || options.angleDegrees < 1 || options.angleDegrees > 179) {
        fail('STL_INVALID_OPTIONS', 'Choose length units and a grouping angle from 1 through 179 degrees.');
      }
      if (!(bytes instanceof ArrayBuffer) || !bytes.byteLength || bytes.byteLength > 16 * 1024 * 1024) {
        fail('STL_INPUT_LIMIT', 'Choose a nonempty STL file no larger than 16 MiB.');
      }
      var view = new DataView(bytes);
      var count = bytes.byteLength >= 84 ? view.getUint32(80, true) : 0;
      var binary = count > 0 && 84 + 50 * count === bytes.byteLength;
      var coordinates;
      var index;
      if (binary) {
        if (count > 50000) { fail('STL_INPUT_LIMIT', 'This experiment supports at most 50,000 triangles.'); }
        coordinates = new Float64Array(count * 9);
        for (index = 0; index < count; index += 1) {
          for (var component = 0; component < 9; component += 1) {
            coordinates[index * 9 + component] = view.getFloat32(84 + index * 50 + 12 + component * 4, true);
          }
        }
      } else {
        var text = new TextDecoder('ascii', { fatal: true }).decode(bytes);
        // Strict structure, finite numeric values checked below; binary headers
        // beginning with "solid" are recognized by their exact record length.
        if (!/^\s*solid[^\r\n]*[\r\n]/.test(text) || !/\bendsolid[^\r\n]*\s*$/.test(text)) {
          fail('STL_MALFORMED', 'The STL record count, length, or ASCII structure is invalid.');
        }
        var body = text.replace(/^\s*solid[^\r\n]*[\r\n]+/, '').replace(/\bendsolid[^\r\n]*\s*$/, '');
        var tokens = body.trim().split(/\s+/);
        if (tokens.length % 21 !== 0) { fail('STL_MALFORMED', 'Each ASCII facet must contain exactly three vertices.'); }
        count = tokens.length / 21;
        if (!count || count > 50000) { fail('STL_INPUT_LIMIT', 'Choose between 1 and 50,000 triangles.'); }
        coordinates = new Float64Array(count * 9);
        for (index = 0; index < count; index += 1) {
          var offset = index * 21;
          if (tokens[offset] !== 'facet' || tokens[offset + 1] !== 'normal' || tokens[offset + 5] !== 'outer' ||
              tokens[offset + 6] !== 'loop' || tokens[offset + 7] !== 'vertex' || tokens[offset + 11] !== 'vertex' ||
              tokens[offset + 15] !== 'vertex' || tokens[offset + 19] !== 'endloop' || tokens[offset + 20] !== 'endfacet') {
            fail('STL_MALFORMED', 'The ASCII facet structure is invalid.');
          }
          for (var vertex = 0; vertex < 3; vertex += 1) {
            for (var axis = 0; axis < 3; axis += 1) {
              var token = tokens[offset + 8 + vertex * 4 + axis];
              if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(token)) {
                fail('STL_NONFINITE', 'STL vertices must contain finite decimal coordinates.');
              }
              coordinates[index * 9 + vertex * 3 + axis] = Number(token);
            }
          }
        }
      }
      var scale = scales[options.unit];
      var minimum = [Infinity, Infinity, Infinity];
      var maximum = [-Infinity, -Infinity, -Infinity];
      var vertexMap = new Map();
      var unique = new Float64Array(coordinates.length);
      var triangles = new Uint32Array(count * 3);
      var vertices = 0;
      for (index = 0; index < coordinates.length; index += 3) {
        var xyz = [coordinates[index], coordinates[index + 1], coordinates[index + 2]];
        if (xyz.some(function (value) { return !Number.isFinite(value); })) {
          fail('STL_NONFINITE', 'STL vertices must contain finite coordinates.');
        }
        // Exact shared-coordinate indexing is not tolerance welding.
        var key = xyz.join(',');
        var id = vertexMap.get(key);
        if (id === undefined) {
          id = vertices++; vertexMap.set(key, id);
          for (axis = 0; axis < 3; axis += 1) {
            var value = xyz[axis] * scale;
            unique[id * 3 + axis] = value;
            minimum[axis] = Math.min(minimum[axis], value); maximum[axis] = Math.max(maximum[axis], value);
          }
        }
        triangles[index / 3] = id;
      }
      var positions = unique.slice(0, vertices * 3);
      var diagonal = Math.hypot(maximum[0]-minimum[0], maximum[1]-minimum[1], maximum[2]-minimum[2]);
      if (!(diagonal >= 1e-9 && diagonal <= 1e6)) { fail('STL_SCALE_LIMIT', 'Choose units giving a model diagonal between 1 nm and 1,000 km.'); }
      var normals = new Float64Array(count * 3);
      var edges = new Map();
      var neighbors = new Int32Array(count * 3); neighbors.fill(-1);
      var volume = 0;
      for (index = 0; index < count; index += 1) {
        var a = triangles[index * 3] * 3, b = triangles[index * 3 + 1] * 3, c = triangles[index * 3 + 2] * 3;
        var ux = positions[b]-positions[a], uy = positions[b+1]-positions[a+1], uz = positions[b+2]-positions[a+2];
        var vx = positions[c]-positions[a], vy = positions[c+1]-positions[a+1], vz = positions[c+2]-positions[a+2];
        var nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
        var length = Math.hypot(nx, ny, nz);
        if (!(length > diagonal * diagonal * 1e-14)) { fail('STL_DEGENERATE_TRIANGLE', 'Remove zero-area or numerically degenerate triangles in the source model.'); }
        normals.set([nx/length, ny/length, nz/length], index * 3);
        volume += ((positions[a]-minimum[0])*nx + (positions[a+1]-minimum[1])*ny + (positions[a+2]-minimum[2])*nz) / 6;
        for (var edge = 0; edge < 3; edge += 1) {
          var first = triangles[index*3+edge], second = triangles[index*3+(edge+1)%3];
          key = Math.min(first, second) + ':' + Math.max(first, second);
          var previous = edges.get(key);
          if (!previous) { edges.set(key, { triangle: index, edge: edge, first: first, count: 1 }); }
          else {
            previous.count += 1;
            if (previous.count > 2) { fail('STL_NONMANIFOLD', 'An edge belongs to more than two triangles. Export a manifold solid.'); }
            neighbors[index*3+edge] = previous.triangle;
            neighbors[previous.triangle*3+previous.edge] = index;
            previous.inconsistent = first === previous.first;
          }
        }
      }
      for (var entry of edges.values()) {
        if (entry.count !== 2) { fail('STL_OPEN_SURFACE', 'The surface has an open edge. Export a closed solid; holes are not filled automatically.'); }
      }
      for (entry of edges.values()) {
        if (entry.inconsistent) { fail('STL_INCONSISTENT_WINDING', 'Adjacent triangle winding disagrees. Correct the source orientation and export again.'); }
      }
      var seen = new Uint8Array(count), queue = new Uint32Array(count);
      queue[0] = 0; seen[0] = 1; var head = 0, tail = 1;
      while (head < tail) {
        var current = queue[head++];
        for (edge = 0; edge < 3; edge += 1) {
          var adjacent = neighbors[current*3+edge];
          if (!seen[adjacent]) { seen[adjacent] = 1; queue[tail++] = adjacent; }
        }
      }
      if (tail !== count) { fail('STL_DISCONNECTED', 'The STL contains disconnected shells. Export one connected solid.'); }
      if (volume < 0) { fail('STL_INWARD_WINDING', 'The closed surface points inward. Reverse winding in the source and export again.'); }
      if (!(volume > diagonal*diagonal*diagonal*1e-14)) { fail('STL_ZERO_VOLUME', 'The surface does not enclose a numerically usable positive volume.'); }
      // Experimental topology screen only. Robust self-intersection and
      // vertex-link manifold checks are explicitly required before production.
      var patchByTriangle = new Uint32Array(count); patchByTriangle.fill(0xffffffff);
      var patches = [], cosine = Math.cos(options.angleDegrees * Math.PI / 180);
      for (index = 0; index < count; index += 1) {
        if (patchByTriangle[index] !== 0xffffffff) { continue; }
        var patch = patches.length; head = 0; tail = 1; queue[0] = index; patchByTriangle[index] = patch;
        while (head < tail) {
          current = queue[head++];
          for (edge = 0; edge < 3; edge += 1) {
            adjacent = neighbors[current*3+edge];
            var dot = normals[current*3]*normals[adjacent*3] + normals[current*3+1]*normals[adjacent*3+1] + normals[current*3+2]*normals[adjacent*3+2];
            if (patchByTriangle[adjacent] === 0xffffffff && dot >= cosine) {
              patchByTriangle[adjacent] = patch; queue[tail++] = adjacent;
            }
          }
        }
        patches.push({ index: patch, triangleCount: tail });
      }
      return { positions: positions, triangles: triangles, normals: normals, patchByTriangle: patchByTriangle,
        patches: patches, minimum: minimum, maximum: maximum, diagonal: diagonal, volume: volume,
        validation: 'experimental-topology-screen', unit: options.unit, angleDegrees: options.angleDegrees };
    }
    async function identify(parsed, bytes) {
      async function digest(value) {
        var buffer = await crypto.subtle.digest('SHA-256', value);
        return Array.from(new Uint8Array(buffer), function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
      }
      var sourceHash = await digest(bytes);
      var members = parsed.patches.map(function () { return []; });
      for (var i = 0; i < parsed.triangles.length; i += 3) {
        var vertices = [];
        for (var j = 0; j < 3; j += 1) {
          var node = parsed.triangles[i+j]*3;
          vertices.push(parsed.positions.slice(node, node+3).join(','));
        }
        members[parsed.patchByTriangle[i/3]].push(vertices.sort().join(';'));
      }
      var prefix = 'stl-patch-v1|' + sourceHash + '|' + parsed.unit + '|' + parsed.angleDegrees + '|';
      parsed.patchIds = await Promise.all(members.map(async function (triangles) {
        return 'stl:' + await digest(new TextEncoder().encode(prefix + triangles.sort().join('\n')));
      }));
      parsed.sourceHash = sourceHash;
      return parsed;
    }
    return { parse: parse, identify: identify };
  }
  root.createStlExperiment = createStlExperiment;
  root.StlExperiment = createStlExperiment();
}(globalThis));
