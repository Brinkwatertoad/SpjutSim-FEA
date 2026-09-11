/* Validated, bounded STL source adapter. Bulk work runs in the mesher worker. */
(function (root) {
  'use strict';
  function createStlImport() {
    var scales = { m: 1, mm: 0.001, cm: 0.01, in: 0.0254, ft: 0.3048 };
    function fail(code, message) { var error = new Error(message); error.code = code; throw error; }
    function parse(bytes, options) {
      if (!options || !(options.version === 1 || options.version === 2 &&
          (options.surfaceMode === 'original' && options.reconstructionToleranceM === null ||
           options.surfaceMode === 'reconstruct' && Number.isFinite(options.reconstructionToleranceM) && options.reconstructionToleranceM > 0)) || options.normalization !== 'none' || !Object.prototype.hasOwnProperty.call(scales, options.lengthUnit) ||
          !Number.isFinite(options.patchAngleDegrees) || options.patchAngleDegrees < 1 || options.patchAngleDegrees > 179) {
        fail('STL_INVALID_OPTIONS', 'Choose length units, a grouping angle from 1 through 179 degrees, and a positive deviation when reconstructing.');
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
        if (count > 50000) { fail('STL_INPUT_LIMIT', 'Import supports at most 50,000 triangles.'); }
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
          for (var normalAxis = 2; normalAxis < 5; normalAxis += 1) {
            if (!/^[+-]?(?:(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|inf(?:inity)?|nan)$/i.test(tokens[offset + normalAxis])) {
              fail('STL_MALFORMED', 'An ASCII facet normal must contain three numeric tokens.');
            }
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
      var scale = scales[options.lengthUnit];
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
      var volume = 0, volumeCorrection = 0;
      for (index = 0; index < count; index += 1) {
        var a = triangles[index * 3] * 3, b = triangles[index * 3 + 1] * 3, c = triangles[index * 3 + 2] * 3;
        var ux = positions[b]-positions[a], uy = positions[b+1]-positions[a+1], uz = positions[b+2]-positions[a+2];
        var vx = positions[c]-positions[a], vy = positions[c+1]-positions[a+1], vz = positions[c+2]-positions[a+2];
        var nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
        var length = Math.hypot(nx, ny, nz);
        if (!(length > diagonal * diagonal * 1e-14)) { fail('STL_DEGENERATE_TRIANGLE', 'Remove zero-area or numerically degenerate triangles in the source model.'); }
        normals.set([nx/length, ny/length, nz/length], index * 3);
        var term = ((positions[a]-minimum[0])*nx + (positions[a+1]-minimum[1])*ny + (positions[a+2]-minimum[2])*nz) / 6 - volumeCorrection;
        var accumulated = volume + term; volumeCorrection = (accumulated-volume)-term; volume = accumulated;
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
      validateVertexLinks(triangles, neighbors, vertices);
      if (tail !== count) { fail('STL_DISCONNECTED', 'The STL contains disconnected shells. Export one connected solid.'); }
      if (volume < 0) { fail('STL_INWARD_WINDING', 'The closed surface points inward. Reverse winding in the source and export again.'); }
      if (!(volume > diagonal*diagonal*diagonal*1e-14)) { fail('STL_ZERO_VOLUME', 'The surface does not enclose a numerically usable positive volume.'); }
      var validationReport = validateSolid(positions, triangles, neighbors, diagonal);
      var patchByTriangle = new Uint32Array(count); patchByTriangle.fill(0xffffffff);
      var patches = [], cosine = Math.cos(options.patchAngleDegrees * Math.PI / 180);
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
        neighbors: neighbors, patches: patches, minimum: minimum, maximum: maximum, diagonal: diagonal, volume: volume,
        validation: validationReport, unit: options.lengthUnit, angleDegrees: options.patchAngleDegrees, options: Object.assign({}, options) };
    }
    function validateVertexLinks(triangles, neighbors, vertexCount) {
      var heads = new Int32Array(vertexCount); heads.fill(-1);
      var counts = new Uint32Array(vertexCount);
      var stamps = new Uint32Array(triangles.length/3), queue = new Uint32Array(triangles.length/3);
      for (var i=0;i<triangles.length;i++) { var vertex=triangles[i]; heads[vertex]=i;counts[vertex]++; }
      for (vertex=0;vertex<vertexCount;vertex++) {
        var head=0,tail=1,first=Math.floor(heads[vertex]/3);queue[0]=first;stamps[first]=vertex+1;
        while(head<tail) {
          var face=queue[head++];
          for(var edge=0;edge<3;edge++) {
            if(triangles[face*3+edge]!==vertex && triangles[face*3+(edge+1)%3]!==vertex)continue;
            var adjacent=neighbors[face*3+edge];
            if(stamps[adjacent]!==vertex+1) {stamps[adjacent]=vertex+1;queue[tail++]=adjacent;}
          }
        }
        if(tail!==counts[vertex])fail('STL_NONMANIFOLD','A vertex joins separate surface fans. Export a manifold solid without pinched vertices.');
      }
    }

    // Filtered orientation predicates with exact binary64 integer fallback.
    // Exact zero remains coplanar; tiny nonzero determinants are not rounded
    // into an intersection or separated by a geometry-changing tolerance.
    var bits = new DataView(new ArrayBuffer(8));
    function exactCoordinates(points, axes) {
      var parts=[],exponent=Infinity;
      points.forEach(function(point) {axes.forEach(function(axis) {
        var value=point[axis];bits.setFloat64(0,value);
        var high=bits.getUint32(0),low=bits.getUint32(4),e=(high>>>20)&2047;
        var mantissa=(BigInt(high&0xfffff)<<32n)|BigInt(low);
        if(e)mantissa|=1n<<52n;
        if(high>>>31)mantissa=-mantissa;
        var power=e?e-1075:-1074;
        if(mantissa!==0n)exponent=Math.min(exponent,power);
        parts.push([mantissa,power]);
      });});
      if(exponent===Infinity)exponent=0;
      return parts.map(function(part){return part[0]===0n?0n:part[0]<<BigInt(part[1]-exponent);});
    }
    function signBig(value) {return value>0n?1:value<0n?-1:0;}
    function orient2(a,b,c,axes) {
      var x=axes[0],y=axes[1],u=(b[x]-a[x])*(c[y]-a[y]),v=(b[y]-a[y])*(c[x]-a[x]);
      if(Math.abs(u-v)>(Math.abs(u)+Math.abs(v))*Number.EPSILON*16)return Math.sign(u-v);
      var p=exactCoordinates([a,b,c],axes);
      return signBig((p[2]-p[0])*(p[5]-p[1])-(p[3]-p[1])*(p[4]-p[0]));
    }
    function orient3(a,b,c,d) {
      var x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2];
      var u=c[0]-a[0],v=c[1]-a[1],w=c[2]-a[2];
      var r=d[0]-a[0],s=d[1]-a[1],t=d[2]-a[2];
      var determinant=x*(v*t-w*s)-y*(u*t-w*r)+z*(u*s-v*r);
      var magnitude=Math.abs(x)*(Math.abs(v*t)+Math.abs(w*s))+Math.abs(y)*(Math.abs(u*t)+Math.abs(w*r))+Math.abs(z)*(Math.abs(u*s)+Math.abs(v*r));
      if(Math.abs(determinant)>magnitude*Number.EPSILON*32)return Math.sign(determinant);
      var p=exactCoordinates([a,b,c,d],[0,1,2]);
      var X=p[3]-p[0],Y=p[4]-p[1],Z=p[5]-p[2],U=p[6]-p[0],V=p[7]-p[1],W=p[8]-p[2],R=p[9]-p[0],S=p[10]-p[1],T=p[11]-p[2];
      return signBig(X*(V*T-W*S)-Y*(U*T-W*R)+Z*(U*S-V*R));
    }
    function projection(triangle) {
      var a=triangle[0],b=triangle[1],c=triangle[2];
      var normal=[Math.abs((b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1])),
        Math.abs((b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2])),
        Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))];
      var drop=normal.indexOf(Math.max.apply(null,normal));return [0,1,2].filter(function(axis){return axis!==drop;});
    }
    function inside(point,triangle,axes) {
      var a=orient2(triangle[0],triangle[1],point,axes),b=orient2(triangle[1],triangle[2],point,axes),c=orient2(triangle[2],triangle[0],point,axes);
      return (a>=0&&b>=0&&c>=0)||(a<=0&&b<=0&&c<=0);
    }
    function onSegment(point,a,b,axes) {
      return orient2(a,b,point,axes)===0 && axes.every(function(axis){return point[axis]>=Math.min(a[axis],b[axis])&&point[axis]<=Math.max(a[axis],b[axis]);});
    }
    function invalidIntersection(first,second,positions) {
      var a=first.map(function(id){return positions.subarray(id*3,id*3+3);});
      var b=second.map(function(id){return positions.subarray(id*3,id*3+3);});
      var shared=first.filter(function(id){return second.includes(id);});
      if(shared.length===2) {
        var other=second.find(function(id){return !shared.includes(id);});
        if(orient3(a[0],a[1],a[2],positions.subarray(other*3,other*3+3))!==0)return false;
        var axes=projection(a),p=positions.subarray(shared[0]*3,shared[0]*3+3),q=positions.subarray(shared[1]*3,shared[1]*3+3);
        var third=first.find(function(id){return !shared.includes(id);});
        return orient2(p,q,positions.subarray(third*3,third*3+3),axes)===orient2(p,q,positions.subarray(other*3,other*3+3),axes);
      }
      function edgeHits(ids,points,targetIds,target) {
        var axes=projection(target);
        for(var edge=0;edge<3;edge++) {
          var next=(edge+1)%3,p=points[edge],q=points[next];
          var s=orient3(target[0],target[1],target[2],p),t=orient3(target[0],target[1],target[2],q);
          if(s&&s===t)continue;
          if(!s&&!shared.includes(ids[edge])&&inside(p,target,axes))return true;
          if(!t&&!shared.includes(ids[next])&&inside(q,target,axes))return true;
          if(s*t<0) {
            var signs=[orient3(p,q,target[0],target[1]),orient3(p,q,target[1],target[2]),orient3(p,q,target[2],target[0])];
            if(signs.every(function(v){return v>=0;})||signs.every(function(v){return v<=0;}))return true;
          } else if(!s&&!t) {
            for(var k=0;k<3;k++) {
              var l=(k+1)%3,r=target[k],u=target[l];
              var s1=orient2(p,q,r,axes),s2=orient2(p,q,u,axes),t1=orient2(r,u,p,axes),t2=orient2(r,u,q,axes);
              if(s1*s2<0&&t1*t2<0)return true;
              if(!shared.includes(targetIds[k])&&onSegment(r,p,q,axes))return true;
              if(!shared.includes(targetIds[l])&&onSegment(u,p,q,axes))return true;
            }
          }
        }
        return false;
      }
      return edgeHits(first,a,second,b)||edgeHits(second,b,first,a);
    }
    function validateSolid(positions,triangles) {
      var count=triangles.length/3,boxes=new Float64Array(count*6),order=new Uint32Array(count);
      for(var i=0;i<count;i++) {
        order[i]=i;
        for(var axis=0;axis<3;axis++) {
          var a=positions[triangles[i*3]*3+axis],b=positions[triangles[i*3+1]*3+axis],c=positions[triangles[i*3+2]*3+axis];
          boxes[i*6+axis]=Math.min(a,b,c);boxes[i*6+axis+3]=Math.max(a,b,c);
        }
      }
      function center(id,axis){return boxes[id*6+axis]+boxes[id*6+axis+3];}
      function build(start,end) {
        var bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
        for(var j=start;j<end;j++)for(var axis=0;axis<3;axis++) {bounds[axis]=Math.min(bounds[axis],boxes[order[j]*6+axis]);bounds[axis+3]=Math.max(bounds[axis+3],boxes[order[j]*6+axis+3]);}
        var node={bounds:bounds,start:start,end:end};
        if(end-start<=8)return node;
        var extent=bounds.slice(3).map(function(v,a){return v-bounds[a];}),split=extent.indexOf(Math.max.apply(null,extent));
        var middle=(start+end)>>>1,left=start,right=end-1;
        // In-place selection keeps construction expected O(T log T).
        while(left<right) {
          var pivot=center(order[(left+right)>>>1],split),lo=left,hi=right;
          while(lo<=hi) {
            while(center(order[lo],split)<pivot)lo++;
            while(center(order[hi],split)>pivot)hi--;
            if(lo<=hi){var swap=order[lo];order[lo++]=order[hi];order[hi--]=swap;}
          }
          if(middle<=hi)right=hi;else if(middle>=lo)left=lo;else break;
        }
        node.left=build(start,middle);node.right=build(middle,end);return node;
      }
      var tree=build(0,count),candidates=0;
      function overlaps(id,bounds) {for(var axis=0;axis<3;axis++)if(boxes[id*6+axis]>bounds[axis+3]||boxes[id*6+axis+3]<bounds[axis])return false;return true;}
      for(i=0;i<count;i++) {
        var stack=[tree];
        while(stack.length) {
          var node=stack.pop();if(!overlaps(i,node.bounds))continue;
          if(node.left){stack.push(node.left,node.right);continue;}
          for(var j=node.start;j<node.end;j++) {
            var other=order[j];if(other<=i||!overlaps(i,boxes.subarray(other*6,other*6+6)))continue;
            if(++candidates>2000000)fail('STL_VALIDATION_LIMIT','Surface intersection checks exceed the supported work limit. Export a simpler tessellation.');
            if(invalidIntersection(Array.from(triangles.subarray(i*3,i*3+3)),Array.from(triangles.subarray(other*3,other*3+3)),positions)) {
              fail('STL_SELF_INTERSECTION','Triangles intersect or touch beyond their shared edges or vertices. Repair the solid in the source application and export again.');
            }
          }
        }
      }
      return {status:'valid',version:1,intersectionCandidates:candidates,triangleCount:count};
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
      if (parsed.options.version === 2) { prefix += 'surface-v2|' + parsed.options.surfaceMode + '|' + parsed.options.reconstructionToleranceM + '|'; }
      parsed.patchIds = await Promise.all(members.map(async function (triangles) {
        return 'stl:' + await digest(new TextEncoder().encode(prefix + triangles.sort().join('\n')));
      }));
      parsed.sourceHash = sourceHash;
      return parsed;
    }
    return { parse: parse, identify: identify };
  }
  root.createStlImport = createStlImport;
  root.StlImport = createStlImport();
}(globalThis));
