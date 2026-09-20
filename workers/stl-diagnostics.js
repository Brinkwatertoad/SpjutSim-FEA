/* Bounded locations for invalid STL surfaces. Acceptance still uses StlImport.parse. */
(function (root) {
  'use strict';
  function collector(mesh, limits, revision) {
    limits = limits || {};
    var maxRecords = Math.min(1000, limits.maxRecords === undefined ? 1000 : limits.maxRecords);
    var maxReferences = Math.min(200000, limits.maxReferences === undefined ? 200000 : limits.maxReferences);
    var references = 0, report = { issues: [], counts: {}, coverage: {}, locationsTruncated: false, countsExact: true };
    function add(kind, triangles, edges, vertices, status, count) {
      triangles = triangles || []; edges = edges || []; vertices = vertices || [];
      report.counts[kind] = (report.counts[kind] || 0) + (count === undefined ? 1 : count);
      var cost = triangles.length + edges.length + vertices.length;
      if (report.issues.length >= maxRecords || references + cost > maxReferences) {
        report.locationsTruncated = true; return;
      }
      var min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      function point(id) {
        for (var a = 0; a < 3; a++) {
          var v = mesh.positions[id * 3 + a]; min[a] = Math.min(min[a], v); max[a] = Math.max(max[a], v);
        }
      }
      triangles.forEach(function (id) { for (var j = 0; j < 3; j++) point(mesh.triangles[id * 3 + j]); });
      edges.forEach(point); vertices.forEach(point);
      if (min[0] === Infinity) { min = mesh.minimum.slice(); max = mesh.maximum.slice(); }
      report.issues.push({ kind: kind, status: status || 'unresolved', revision: revision || 'source',
        count: count === undefined ? 1 : count, bounds: { min: min, max: max },
        triangleIds: new Uint32Array(triangles), edgeVertexIds: new Uint32Array(edges), vertexIds: new Uint32Array(vertices) });
      references += cost;
    }
    return { report: report, add: add };
  }
  function inspect(mesh, limits, revision) {
    var output = collector(mesh, limits, revision), add = output.add, report = output.report;
    var t = mesh.triangles, p = mesh.positions, count = t.length / 3;
    var edges = new Map(), unique = new Set(), parent = new Uint32Array(count), unsafe = false;
    var incident = new Int32Array(p.length / 3); incident.fill(-1);
    var neighbors = new Int32Array(t.length); neighbors.fill(-1);
    var volume = 0, correction = 0;
    function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
    function join(a, b) { parent[find(b)] = find(a); }
    for (var i = 0; i < count; i++) parent[i] = i;
    for (i = 0; i < count; i++) {
      var a = t[i * 3], b = t[i * 3 + 1], c = t[i * 3 + 2];
      var key = [a, b, c].sort(function (x, y) { return x - y; }).join(':');
      if (unique.has(key)) { add('duplicate', [i]); unsafe = true; } else unique.add(key);
      var ux = p[b*3]-p[a*3], uy = p[b*3+1]-p[a*3+1], uz = p[b*3+2]-p[a*3+2];
      var vx = p[c*3]-p[a*3], vy = p[c*3+1]-p[a*3+1], vz = p[c*3+2]-p[a*3+2];
      var nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
      if (!(Math.hypot(nx, ny, nz) > mesh.diagonal * mesh.diagonal * 1e-14)) {
        add('degenerate', [i]); unsafe = true;
      }
      var term = ((p[a*3]-mesh.minimum[0])*nx + (p[a*3+1]-mesh.minimum[1])*ny + (p[a*3+2]-mesh.minimum[2])*nz)/6 - correction;
      var sum = volume + term; correction = (sum-volume)-term; volume = sum;
      for (var j = 0; j < 3; j++) {
        a = t[i*3+j]; b = t[i*3+(j+1)%3]; incident[a] = i;
        key = Math.min(a,b) + ':' + Math.max(a,b);
        var edge = edges.get(key);
        if (!edge) edges.set(key, { a:a, b:b, first:i, slot:j, count:1 });
        else {
          join(i, edge.first); edge.count++;
          if (edge.count === 2) { neighbors[i*3+j] = edge.first; neighbors[edge.first*3+edge.slot] = i; }
          if (edge.a === a) edge.inconsistent = true;
        }
      }
    }
    var manifold = true, closed = true, boundaries=[],byVertex=new Map();
    edges.forEach(function (edge) {
      if (edge.count === 1) { var id=boundaries.length;boundaries.push(edge);[edge.a,edge.b].forEach(function(v){if(!byVertex.has(v))byVertex.set(v,[]);byVertex.get(v).push(id);});closed = false; }
      else if (edge.count > 2) { add('nonmanifold-edge', [], [edge.a,edge.b]); manifold = false; }
      else if (edge.inconsistent) add('winding', [], [edge.a,edge.b]);
    });
    var visited=new Uint8Array(boundaries.length);
    boundaries.forEach(function(edge,index){
      if(visited[index])return;
      var queue=[index],locations=[],head=0;visited[index]=1;
      while(head<queue.length){var current=boundaries[queue[head++]];locations.push(current.a,current.b);
        [current.a,current.b].forEach(function(v){byVertex.get(v).forEach(function(next){if(!visited[next]){visited[next]=1;queue.push(next);}});});}
      add('open-boundary',[],locations,[],'unresolved',queue.length);
    });
    // Vertex fans are independent of winding, but require paired manifold edges.
    if (manifold && closed) {
      var counts = new Uint32Array(incident.length), stamps = new Uint32Array(count), queue = new Uint32Array(count);
      for (i = 0; i < t.length; i++) counts[t[i]]++;
      for (var v = 0; v < incident.length; v++) {
        if (incident[v] < 0) continue;
        var head = 0, tail = 1; queue[0] = incident[v]; stamps[queue[0]] = v+1;
        while (head < tail) {
          var face = queue[head++];
          for (j = 0; j < 3; j++) {
            if (t[face*3+j] !== v && t[face*3+(j+1)%3] !== v) continue;
            var next = neighbors[face*3+j];
            if (next >= 0 && stamps[next] !== v+1) { stamps[next] = v+1; queue[tail++] = next; }
          }
        }
        if (tail !== counts[v]) add('nonmanifold-vertex', [], [], [v]);
      }
      report.coverage.vertexFans = report.counts['nonmanifold-vertex'] ? 'failed' : 'passed';
    } else report.coverage.vertexFans = 'skipped';
    var components = new Map();
    for (i = 0; i < count; i++) { var id = find(i); if(!components.has(id))components.set(id,[]); components.get(id).push(i); }
    if (components.size > 1) components.forEach(function (ids) { add('component', ids); });
    report.componentCount = components.size;
    report.coverage.topology = closed && manifold && !report.counts['nonmanifold-vertex'] && components.size === 1 && !unsafe ? 'passed' : 'failed';
    report.coverage.orientation = report.counts.winding ? 'failed' : (closed && manifold ? 'passed' : 'skipped');
    if (closed && manifold && !report.counts.winding) {
      if (volume < 0) { add('inward-winding', [0]); report.coverage.orientation = 'failed'; }
      report.coverage.volume = Math.abs(volume) > mesh.diagonal**3*1e-14 ? 'passed' : 'failed';
      if (report.coverage.volume === 'failed') add('zero-volume');
    } else report.coverage.volume = 'skipped';
    report.coverage.intersections = 'skipped';
    if (!unsafe) {
      // Union triangle pairs as they arrive; retain O(facets) storage even when
      // millions of candidate pairs are checked. One record locates a connected
      // intersection region, with the exact pair count kept as detail.
      var regions = new Int32Array(count); regions.fill(-1);
      var pairs = new Uint32Array(count);
      function region(i) { while (regions[i] !== i) { regions[i] = regions[regions[i]]; i = regions[i]; } return i; }
      try {
        var checked = root.StlImport.validateIntersections(p, t, function (first, second) {
          if (regions[first] < 0) regions[first] = first;
          if (regions[second] < 0) regions[second] = second;
          var a = region(first), b = region(second);
          if (a !== b) { regions[b] = a; pairs[a] += pairs[b]; }
          pairs[a]++;
        });
        report.intersectionCandidates = checked.intersectionCandidates;
        report.coverage.intersections = 'passed';
      } catch (e) {
        if (e.code !== 'STL_VALIDATION_LIMIT') throw e;
        report.coverage.intersections = 'limit'; report.countsExact = false; add('work-limit');
      }
      var grouped = new Map();
      for (i = 0; i < count; i++) if (regions[i] >= 0) {
        var owner = region(i); if (!grouped.has(owner)) grouped.set(owner, []);
        grouped.get(owner).push(i);
      }
      grouped.forEach(function(ids, owner) { add('intersection', ids, [], [], 'unresolved', pairs[owner]); });
      report.intersectionRegionCount = grouped.size;
      if (grouped.size && report.coverage.intersections !== 'limit') report.coverage.intersections = 'failed';
    }
    return report;
  }
  root.StlDiagnostics = { inspect: inspect, collector: collector };
}(globalThis));
