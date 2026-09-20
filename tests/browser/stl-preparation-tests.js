(async function () {
  'use strict';
  var status = document.getElementById('test-status');
  function assert(value, message) { if (!value) throw new Error(message); }
  async function fixture(name) { return (await fetch('../fixtures/stl/' + name + '.stl')).arrayBuffer(); }
  try {
    assert(typeof StlImport.decode === 'function', 'Readable invalid STL needs a decoder independent of solid acceptance');
    var open = StlImport.decode(await fixture('open'));
    assert(open.triangles.length > 0 && open.positions instanceof Float64Array, 'Open surface was not displayable');
    var cube = StlImport.decode(await fixture('cube-binary'));
    assert(cube.maximum[0] === 1 && cube.minimum[0] === 0, 'Decoder changed source units');
    var report = StlDiagnostics.inspect(open);
    assert(report.issues.some(function (issue) { return issue.kind === 'open-boundary' && issue.edgeVertexIds.length; }), 'Open boundaries have no locations');
    assert(report.coverage.topology === 'failed', 'Open surface was marked valid');
    report = StlDiagnostics.inspect(StlImport.decode(await fixture('self-intersecting')));
    assert(report.issues.some(function (issue) { return issue.kind === 'intersection' && issue.triangleIds.length >= 2; }), 'Intersections must locate both triangles');
    // A dense cluster is one inspectable region, not a triangle-pair task list.
    var check = StlImport.validateIntersections;
    try {
      StlImport.validateIntersections = function(p,t,visit) { visit(0,1); visit(1,2); visit(8,9); return {intersectionCandidates:3}; };
      var clustered = StlDiagnostics.inspect(cube);
      var regions = clustered.issues.filter(function(issue){return issue.kind==='intersection';});
      assert(clustered.counts.intersection===3 && regions.length===2, 'Intersecting pairs were not grouped into connected regions');
      assert(regions[0].count===2 && regions[0].triangleIds.length===3, 'Region lost pair counts or deduplicated locations');
    } finally { StlImport.validateIntersections = check; }
    var disconnected = StlDiagnostics.inspect(StlImport.decode(await fixture('disconnected')));
    assert(disconnected.counts.component===disconnected.componentCount, 'Component count reports facets instead of bodies');
    report = StlDiagnostics.inspect(open, { maxRecords: 1, maxReferences: 2 });
    assert(report.locationsTruncated && report.issues.length <= 1, 'Diagnostic collection ignored its memory limit');
    var bytes = await fixture('cube-binary'), view = new DataView(bytes); view.setFloat32(96, NaN, true);
    var rejected = false; try { StlImport.decode(bytes); } catch (e) { rejected = e.code === 'STL_NONFINITE'; }
    assert(rejected, 'Nonfinite vertices reached the preview');
    assert(typeof StlRepair.prepare === 'function', 'Cleanup and proposed shape changes need separate preparation results');
    var original = await fixture('inconsistent');
    var prepared = StlRepair.prepare(StlImport.decode(original), { maxHoleDiameterRatio: 0.01 });
    assert(prepared.changes.automatic.some(function (issue) { return issue.kind === 'winding'; }), 'Automatic winding fix was not recorded');
    assert(prepared.changes.proposed.length === 0, 'Winding correction required shape-change consent');
    assert(prepared.sourceBytes instanceof ArrayBuffer, 'Prepared source is missing');
    prepared = StlRepair.prepare(open, { maxHoleDiameterRatio: 0 });
    assert(prepared.error && prepared.sourceBytes instanceof ArrayBuffer, 'Unrepairable input lost its inspectable candidate');
    assert(globalThis.SpjutsimFEA && typeof SpjutsimFEA.StlPreparationClient === 'function', 'Preparation must run in a cancellable worker without Gmsh');
    var events = [], client = new SpjutsimFEA.StlPreparationClient({onEvent: function(event) { events.push(event); }});
    var result = await client.prepare({sessionId:'test',generation:1,sourceName:'cube.stl',geometryId:'test-cube',sourceBytes:await fixture('cube-binary'),lengthUnit:'m',patchAngleDegrees:40,maxHoleDiameterRatio:.01});
    assert(events[0].type === 'stl-preview', 'Solid checks delayed the first preview');
    assert(result.state === 'ready' && result.geometryCandidate.volumeM3 === 1, 'Valid cube did not become ready');
    assert(result.geometryCandidate.faceIds.length === 6, 'Prepared groups are not the six cube faces');
    var issue={kind:'winding',status:'fixed',revision:'source',count:1,bounds:events[0].preview.bounds,triangleIds:new Uint32Array(100001),edgeVertexIds:new Uint32Array(),vertexIds:new Uint32Array()};
    var excessive=Object.assign({},result,{diagnostics:Object.assign({},result.diagnostics,{issues:[issue]}),changes:{automatic:[issue],proposed:[]}});
    assert(!SpjutsimFEA.validateStlPreparationResult(excessive,events[0].preview),'Combined finding/change locations exceeded the per-result budget');
    client.dispose(); events=[];
    client = new SpjutsimFEA.StlPreparationClient({onEvent:function(event){events.push(event);}});
    result=await client.prepare({sessionId:'invalid',generation:1,sourceName:'open.stl',geometryId:'test-open',sourceBytes:await fixture('open'),lengthUnit:'m',patchAngleDegrees:40,maxHoleDiameterRatio:0});
    assert(result.state==='blocked' && result.geometryCandidate===null && events[0].type==='stl-preview','Invalid solid either lost preview or enabled analysis');
    client.dispose();
    client=new SpjutsimFEA.StlPreparationClient({onEvent:function(event){if(event.type==='stl-preview')client.cancel();}});
    var cancelled=false;
    try{await client.prepare({sessionId:'cancel',generation:1,sourceName:'cube.stl',geometryId:'cancel-cube',sourceBytes:await fixture('cube-binary'),lengthUnit:'m',patchAngleDegrees:40,maxHoleDiameterRatio:.01});}catch(e){cancelled=e.diagnostic.code==='STL_PREPARATION_CANCELLED';}
    assert(cancelled && !client.worker, 'Cancellation did not reject and terminate preparation');
    var malformed={revision:'source',positions:new Float64Array([0,0,0]),triangles:new Uint32Array([0,0,99]),bounds:{min:[0,0,0],max:[0,0,0]}};
    assert(!SpjutsimFEA.validateStlPreview(malformed),'Out-of-range diagnostic preview connectivity was accepted');
    function sphere(level){
      var vertices=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],faces=[[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]];
      for(var l=0;l<level;l++){var next=[],midpoints=new Map();function mid(a,b){var key=Math.min(a,b)+':'+Math.max(a,b);if(midpoints.has(key))return midpoints.get(key);var p=vertices[a].map(function(v,i){return(v+vertices[b][i])/2;}),n=Math.hypot.apply(Math,p),id=vertices.length;vertices.push(p.map(function(v){return v/n;}));midpoints.set(key,id);return id;}
        faces.forEach(function(f){var a=mid(f[0],f[1]),b=mid(f[1],f[2]),c=mid(f[2],f[0]);next.push([f[0],a,c],[a,f[1],b],[c,b,f[2]],[a,b,c]);});faces=next;
      }
      var bytes=new ArrayBuffer(84+faces.length*50),v=new DataView(bytes);v.setUint32(80,faces.length,true);faces.forEach(function(f,i){f.forEach(function(id,j){vertices[id].forEach(function(x,k){v.setFloat32(84+i*50+12+j*12+k*4,x,true);});});});return bytes;
    }
    for(var level of [3,4]){
      client=new SpjutsimFEA.StlPreparationClient();
      result=await client.prepare({sessionId:'groups-'+level,generation:0,geometryId:'groups',sourceName:'sphere.stl',sourceBytes:sphere(level),lengthUnit:'m',patchAngleDegrees:1,maxHoleDiameterRatio:0});
      assert(level===3?result.state==='ready'&&result.geometryCandidate.faceIds.length===488:result.state==='blocked'&&result.error.code==='STL_PATCH_LIMIT','Selection group limit changed: '+level+' '+result.state+' '+(result.geometryCandidate&&result.geometryCandidate.faceIds.length)+' '+JSON.stringify(result.error));
    }
    var request={sessionId:'boundary',generation:2,sourceName:'cube.stl',geometryId:'boundary',sourceBytes:await fixture('cube-binary'),lengthUnit:'m',patchAngleDegrees:40,maxHoleDiameterRatio:.01};
    var startWorker=SpjutsimFEA.startLocalWorker,realTimer=globalThis.setTimeout,terminated=false;
    try{
      SpjutsimFEA.startLocalWorker=function(){return Promise.resolve({terminate:function(){terminated=true;},postMessage:function(){}});};
      globalThis.setTimeout=function(fn,ms){return realTimer(fn,ms>100000?1:ms);};
      client=new SpjutsimFEA.StlPreparationClient();var code;
      try{await client.prepare(request);}catch(e){code=e.diagnostic.code;}
      assert(code==='STL_PREPARATION_TIMEOUT'&&terminated&&!client.worker,'Deadline did not terminate the preparation worker');
      globalThis.setTimeout=realTimer;terminated=false;
      SpjutsimFEA.startLocalWorker=function(){return Promise.resolve({terminate:function(){terminated=true;},postMessage:function(m){
        var envelope={protocol:4,requestId:m.requestId,sessionId:m.sessionId,generation:m.generation};
        this.onmessage({data:Object.assign({},envelope,{generation:1,type:'stl-preview',preview:malformed})});
        this.onmessage({data:Object.assign({},envelope,{type:'stl-preview',preview:malformed})});
      }});};
      var forwarded=0;client=new SpjutsimFEA.StlPreparationClient({onEvent:function(){forwarded++;}});code=null;
      try{await client.prepare(request);}catch(e){code=e.diagnostic.code;}
      assert(code==='INVALID_STL_PREPARATION'&&terminated&&forwarded===0,'Stale or malformed preview crossed the client boundary');
    }finally{SpjutsimFEA.startLocalWorker=startWorker;globalThis.setTimeout=realTimer;}
    status.textContent = 'Passed'; status.dataset.result = 'passed';
  } catch (e) { status.textContent = 'Failed: ' + e.message; status.dataset.result = 'failed'; }
}());
