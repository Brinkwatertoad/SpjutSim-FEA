(function (root) {
  'use strict';

  var sampleCache = new WeakMap();

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

  function sampleFaceGlyphPoints(surface, faceId, options, data) {
    data = data || faceTriangles(surface, faceId);
    var spacingM = Number(options && options.spacingM);
    var minimum = Math.max(1, Number(options && options.minCount) || 6);
    var maximum = Math.max(minimum, Number(options && options.maxCount) || 128);
    var count;
    var samples = [];
    var index;
    if (!(data.totalAreaM2 > 0)) { return samples; }
    if (!(spacingM > 0)) { throw new Error('Surface glyph spacing must be greater than zero.'); }
    var min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
    data.triangles.forEach(function(t){t.points.forEach(function(p){for(var k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}});});
    var span = Math.hypot(max[0]-min[0],max[1]-min[1],max[2]-min[2]);
    count = Math.max(minimum, Math.min(maximum, Math.max(Math.ceil(span / spacingM),Math.ceil(data.totalAreaM2 / (spacingM * spacingM)))));
    var first=data.triangles[0],normal=first.outwardNormal;
    var planar=data.triangles.every(function(t){return t.outwardNormal.reduce(function(sum,n,k){return sum+n*normal[k];},0)>0.9999;});
    if(planar) {
      var drop=normal.map(Math.abs).indexOf(Math.max.apply(Math,normal.map(Math.abs))),axes=[0,1,2].filter(function(a){return a!==drop;});
      var bounds=[Infinity,Infinity,-Infinity,-Infinity];
      data.triangles.forEach(function(t){t.points.forEach(function(p){axes.forEach(function(a,k){bounds[k]=Math.min(bounds[k],p[a]);bounds[k+2]=Math.max(bounds[k+2],p[a]);});});});
      var rows=Math.max(1,Math.min(count,Math.round(Math.sqrt(count*(bounds[3]-bounds[1])/(bounds[2]-bounds[0])))));
      rows=Math.max(rows,Math.ceil((bounds[3]-bounds[1])/spacingM));
      var columns=Math.max(Math.ceil(count/rows),Math.ceil((bounds[2]-bounds[0])/spacingM));
      if(rows*columns>maximum) {
        rows=Math.max(1,Math.min(maximum,Math.round(Math.sqrt(maximum*(bounds[3]-bounds[1])/(bounds[2]-bounds[0])))));
        columns=Math.max(1,Math.floor(maximum/rows));
      }
      for(var row=0;row<rows;row++) {
        for(var column=0;column<columns;column++) {
          var x=bounds[0]+(column+0.5)/columns*(bounds[2]-bounds[0]),y=bounds[1]+(row+0.5)/rows*(bounds[3]-bounds[1]);
          for(var ti=0;ti<data.triangles.length;ti++) {
            var t=data.triangles[ti],a=t.points[0],b=t.points[1],c=t.points[2],ax=axes[0],ay=axes[1];
            var denominator=(b[ay]-c[ay])*(a[ax]-c[ax])+(c[ax]-b[ax])*(a[ay]-c[ay]);
            var wa=((b[ay]-c[ay])*(x-c[ax])+(c[ax]-b[ax])*(y-c[ay]))/denominator;
            var wb=((c[ay]-a[ay])*(x-c[ax])+(a[ax]-c[ax])*(y-c[ay]))/denominator;
            if(wa>=-1e-9 && wb>=-1e-9 && wa+wb<=1+1e-9){samples.push({positionM:a.map(function(n,k){return n*wa+b[k]*wb+c[k]*(1-wa-wb);}),outwardNormal:t.outwardNormal.slice()});break;}
          }
        }
      }
      if(samples.length>=Math.max(minimum,rows*columns*0.7))return samples;
      samples=[];
    }
    // Curved/trimmed surfaces: bounded area-stratified candidates with farthest-point spacing.
    var candidates=[],candidateCount=Math.max(64,maximum*16);
    for(index=0;index<candidateCount;index++) {
      var targetArea=(index+0.5)*data.totalAreaM2/candidateCount,lo=0,hi=data.triangles.length-1;
      while(lo<hi){var mid=(lo+hi)>>1;if(data.triangles[mid].cumulativeAreaM2<targetArea)lo=mid+1;else hi=mid;}
      var triangle=data.triangles[lo],u=((index+1)*0.7548776662466927)%1,v=((index+1)*0.5698402909980532)%1,rootU=Math.sqrt(u),weights=[1-rootU,rootU*(1-v),rootU*v];
      candidates.push({positionM:[0,1,2].map(function(axis){return triangle.points.reduce(function(sum,p,k){return sum+p[axis]*weights[k];},0);}),outwardNormal:triangle.outwardNormal.slice(),distance:Infinity});
    }
    var next=0;
    for(index=0;index<maximum;index++) {
      var chosen=candidates[next];samples.push({positionM:chosen.positionM,outwardNormal:chosen.outwardNormal});chosen.distance=-1;
      var best=-1;
      candidates.forEach(function(candidate,k){if(candidate.distance<0)return;var distance=candidate.positionM.reduce(function(sum,v,axis){return sum+Math.pow(v-chosen.positionM[axis],2);},0);candidate.distance=Math.min(candidate.distance,distance);if(candidate.distance>best){best=candidate.distance;next=k;}});
      if(samples.length>=count && best<=spacingM*spacingM)break;
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
    return Math.max(maximum[0] - minimum[0], maximum[1] - minimum[1], maximum[2] - minimum[2], 1e-6) * 0.25;
  }

  function cachedFaceSamples(documentState, faceId) {
    var owner = documentState.mesh || documentState.geometry;
    if (!owner) { return {samples:[],areaM2:0}; }
    var cache = sampleCache.get(owner);
    if (!cache) {
      var surface = surfaceSource(documentState);
      cache = {surface:surface,spacingM:defaultGlyphSpacing(surface),faces:new Map()}; sampleCache.set(owner,cache);
    }
    if (!cache.faces.has(faceId)) {
      var data = faceTriangles(cache.surface,faceId);
      cache.faces.set(faceId,{areaM2:data.totalAreaM2,samples:sampleFaceGlyphPoints(cache.surface,faceId,{spacingM:cache.spacingM,minCount:6,maxCount:128},data)});
    }
    return cache.faces.get(faceId);
  }
  function describeAssignmentDraft(state) {
    var draft = state.assignmentDraft;
    if (!draft) { return ''; }
    if (draft.kind === 'gravity') { return 'Body acceleration applies throughout the model. Preview arrow shows direction.'; }
    var area = draft.faceIds.reduce(function (sum,id) { return sum + cachedFaceSamples(state,id).areaM2; },0);
    var text = 'Area ≈ ' + area.toPrecision(4) + ' m². ';
    if (draft.definition.type === 'total-force' && draft.definition.direction === 'surface-normal') {
      text += draft.definition.magnitudeN + ' N distributed by area, ' + draft.definition.sense + ' along each local normal. Opposing directions can cancel in the net force.';
    } else if (draft.definition.type === 'total-force' && draft.definition.forceN && draft.definition.forceN.every(Number.isFinite)) {
      text += Math.hypot.apply(Math,draft.definition.forceN).toPrecision(4) + ' N total across selection; global [ ' + draft.definition.forceN.join(', ') + ' ] N. Adding faces redistributes this total.';
    } else if (draft.definition.type === 'pressure' && Number.isFinite(draft.definition.pressurePa)) {
      text += draft.definition.pressurePa + ' Pa constant inward pressure on every selected face.';
    } else if (draft.kind === 'support') {
      text += 'Prescribed global displacement: ' + Object.keys(draft.definition.componentsM || {}).map(function(axis){return axis.toUpperCase() + ' = ' + draft.definition.componentsM[axis] + ' m';}).join(', ') + '.';
    }
    return text + ' Preview arrows show direction, not magnitude.';
  }

  function buildAnalysisGlyphDescriptors(documentState) {
    var surface = surfaceSource(documentState);
    var descriptors = [];
    if (!surface) { return descriptors; }
    var draft = documentState.assignmentDraft;
    var supports = documentState.boundaryConditions.filter(function (item) { return (!documentState.viewportPresentation || documentState.viewportPresentation.showSupports !== false) && (!draft || item.id !== draft.itemId); });
    var loads = documentState.loads.filter(function (item) { return (!documentState.viewportPresentation || documentState.viewportPresentation.showLoads !== false) && (!draft || item.id !== draft.itemId); });
    if (draft && draft.kind !== 'gravity' && draft.validation.valid) {
      var preview = Object.assign({},draft.validation.value,{id:'assignment-preview',preview:true});
      (draft.kind === 'support' ? supports : loads).push(preview);
    }
    supports.forEach(function (condition) {
      condition.faceIds.forEach(function (faceId) {
        cachedFaceSamples(documentState, faceId).samples.forEach(function (sample) {
          descriptors.push({ type: condition.type, itemId: condition.id, preview:condition.preview === true, faceId: faceId, positionM: sample.positionM,
            direction: sample.outwardNormal, components: ['x', 'y', 'z'].filter(function (axis) { return condition.componentsM[axis] !== undefined; }) });
        });
      });
    });
    loads.forEach(function (load) {
      load.faceIds.forEach(function (faceId) {
        cachedFaceSamples(documentState, faceId).samples.forEach(function (sample) {
          var direction = load.type === 'pressure' || load.direction === 'surface-normal'
            ? sample.outwardNormal.map(function (value) { return value * (load.type === 'pressure' ? -Math.sign(load.pressurePa) : load.sense === 'pull' ? 1 : -1); })
            : normalized(load.forceN);
          descriptors.push({ type: load.type, itemId: load.id, preview:load.preview === true, faceId: faceId, positionM: sample.positionM, direction: direction });
        });
      });
    });
    var gravityPreview = draft && draft.kind === 'gravity';
    var gravity = gravityPreview ? (draft.validation.valid ? draft.validation.value : null) : documentState.gravity;
    if (gravity && gravity.enabled && (gravityPreview || !documentState.viewportPresentation || documentState.viewportPresentation.showGravity !== false) && documentState.geometry) {
      var bounds = documentState.geometry.boundingBoxM;
      descriptors.push({
        type: 'gravity', itemId: 'gravity', preview:Boolean(gravityPreview), faceId: null,
        positionM: [(bounds.minM[0] + bounds.maxM[0]) / 2, (bounds.minM[1] + bounds.maxM[1]) / 2, bounds.maxM[2]],
        direction: normalized(gravity.accelerationMS2)
      });
    }
    return descriptors;
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.describeAssignmentDraft = describeAssignmentDraft;
  root.SpjutsimFEA.faceCentroidNormal = faceCentroidNormal;
  root.SpjutsimFEA.sampleFaceGlyphPoints = sampleFaceGlyphPoints;
  root.SpjutsimFEA.buildAnalysisGlyphDescriptors = buildAnalysisGlyphDescriptors;
}(globalThis));
