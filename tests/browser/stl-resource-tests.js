(async function () {
  'use strict';
  var api = globalThis.SpjutsimFEA, status = document.getElementById('test-status');
  var options = { version: 1, lengthUnit: 'm', patchAngleDegrees: 40, normalization: 'none' };
  var evidence = [];
  function assert(value, message) { if (!value) { throw new Error(message); } }
  function binary(triangles) {
    var bytes = new ArrayBuffer(84 + triangles.length * 50), view = new DataView(bytes);
    view.setUint32(80, triangles.length, true);
    triangles.forEach(function (triangle, i) { triangle.forEach(function (point, j) {
      point.forEach(function (value, axis) { view.setFloat32(84 + i * 50 + 12 + j * 12 + axis * 4, value, true); });
    }); });
    return bytes;
  }
  function cylinder(sides) {
    var triangles = [];
    for (var i = 0; i < sides; i++) {
      var a = [Math.cos(2*Math.PI*i/sides), Math.sin(2*Math.PI*i/sides), 0];
      var b = [Math.cos(2*Math.PI*((i+1)%sides)/sides), Math.sin(2*Math.PI*((i+1)%sides)/sides), 0];
      var c = [a[0], a[1], 1], d = [b[0], b[1], 1];
      triangles.push([[0,0,0], b, a], [[0,0,1], c, d], [a,b,d], [a,d,c]);
    }
    return binary(triangles);
  }
  async function rejected(bytes, code) {
    var client = new api.MesherClient(), actual;
    try { await client.importGeometry({ sourceName:'limit.stl', sourceFormat:'stl', sourceBytes:bytes, importOptions:options }); }
    catch (error) { actual = error.diagnostic && error.diagnostic.code; }
    finally { client.dispose(); }
    assert(actual === code, 'Expected ' + code + ', received ' + actual);
    evidence.push({bytes:bytes.byteLength, rejection:actual});
  }
  try {
    await rejected(new ArrayBuffer(16*1024*1024+1), 'STL_INPUT_LIMIT');
    var tooMany = new ArrayBuffer(84+50001*50);new DataView(tooMany).setUint32(80,50001,true);
    await rejected(tooMany, 'STL_INPUT_LIMIT');
    await rejected(cylinder(512), 'STL_PATCH_LIMIT');
    await rejected(cylinder(2048), 'STL_VALIDATION_LIMIT');
    var boundaryClient = new api.MesherClient(), boundaryStart = performance.now();
    var boundary = await boundaryClient.importGeometry({sourceName:'surface-limit.stl',sourceFormat:'stl',sourceBytes:cylinder(507),importOptions:options});
    assert(boundary.sourceMetadata.internalSurfaceCount===512,'Internal surface boundary was not exercised: '+boundary.sourceMetadata.internalSurfaceCount);
    evidence.push({internalSurfaceCount:boundary.sourceMetadata.internalSurfaceCount,importMs:performance.now()-boundaryStart});boundaryClient.dispose();
    var ascii = await (await fetch('../fixtures/stl/cube-ascii.stl')).text();
    var padded = new TextEncoder().encode(ascii+' '.repeat(16*1024*1024-ascii.length)).buffer;
    boundaryClient=new api.MesherClient();
    boundary=await boundaryClient.importGeometry({sourceName:'byte-limit.stl',sourceFormat:'stl',sourceBytes:padded,importOptions:options});
    assert(boundary.faceIds.length===6,'Exact byte limit rejected a valid solid');
    evidence.push({sourceBytes:padded.byteLength,patches:boundary.faceIds.length});boundaryClient.dispose();padded=null;
    var source = await (await fetch('../fixtures/stl/cube-binary.stl')).arrayBuffer(), view = new DataView(source), triangles = [];
    for (var i=0;i<12;i++) {
      var triangle=[];
      for(var v=0;v<3;v++) triangle.push([0,1,2].map(function(axis){return view.getFloat32(84+i*50+12+v*12+axis*4,true);}));
      triangles.push(triangle);
    }
    function midpoint(a,b) { return a.map(function(value,axis){return (value+b[axis])/2;}); }
    for (var level=0;level<6;level++) {
      var refined=[];
      triangles.forEach(function(t){var ab=midpoint(t[0],t[1]),bc=midpoint(t[1],t[2]),ca=midpoint(t[2],t[0]);refined.push([t[0],ab,ca],[ab,t[1],bc],[ca,bc,t[2]],[ab,bc,ca]);});
      triangles=refined;
    }
    // Split 424 faces into three without splitting shared edges: exactly 50,000.
    var extra=[];
    for (i=0;i<424;i++) {
      var t=triangles[i], center=[0,1,2].map(function(axis){return (t[0][axis]+t[1][axis]+t[2][axis])/3;});
      triangles[i]=[t[0],t[1],center];extra.push([t[1],t[2],center],[t[2],t[0],center]);
    }
    var dense=binary(triangles.concat(extra));triangles=null;extra=null;
    var client=new api.MesherClient(), started=performance.now();
    status.textContent='Validating 50,000 triangles…';
    var geometry=await client.importGeometry({sourceName:'dense.stl',sourceFormat:'stl',sourceBytes:dense,importOptions:options});
    var importMs=performance.now()-started;
    assert(geometry.faceIds.length===6 && geometry.sourceMetadata.triangleCount===50000,'Dense source lost patches or triangles');
    assert(Math.abs(geometry.volumeM3-1)<1e-12,'Dense source changed volume');
    var memory=await new Promise(function(resolve,reject){client.worker.onmessage=function(event){if(event.data.type==='diagnostics-result')resolve(event.data.result);};client.worker.onerror=reject;client.worker.postMessage({protocol:api.WORKER_PROTOCOL_VERSION,type:'diagnostics',requestId:'stl-resource-memory'});});
    client.dispose();
    evidence.push({triangles:50000,sourceBytes:dense.byteLength,importMs:importMs,mesherWasmBytes:memory.wasmMemoryBytes,metadata:geometry.sourceMetadata,
      previewBytes:geometry.preview.positionsM.byteLength+geometry.preview.normals.byteLength+geometry.preview.indices.byteLength+geometry.preview.featureEdges.positionsM.byteLength+geometry.preview.featureEdges.indices.byteLength});
    client=new api.MesherClient();started=performance.now();
    var denseMesh=await client.generateMesh({geometry:geometry,sourceBytes:dense,settings:{preset:'coarse',elementType:'tet10'}});
    assert(denseMesh.quality.minimumJacobian>0 && Object.keys(denseMesh.geometryFaceMap).length===6,'Dense-source Tet10 reconstruction failed');
    evidence.push({denseMeshMs:performance.now()-started,nodes:denseMesh.statistics.nodeCount,elements:denseMesh.statistics.elementCount,
      minimumJacobian:denseMesh.quality.minimumJacobian,meshBytes:denseMesh.nodePositionsM.byteLength+denseMesh.elementConnectivity.byteLength+denseMesh.boundaryFaces.solverConnectivity.byteLength+denseMesh.boundaryFaces.triangleConnectivity.byteLength});
    client.dispose();denseMesh=null;
    var cancelStart, cancelled = new api.MesherClient({onProgress:function(progress){if(progress.stage==='stl-validate'){cancelStart=performance.now();cancelled.cancel();}}}), code;
    try {await cancelled.importGeometry({sourceName:'cancel.stl',sourceFormat:'stl',sourceBytes:dense,importOptions:options});}catch(error){code=error.diagnostic&&error.diagnostic.code;}
    assert(code==='IMPORT_CANCELLED' && cancelled.worker===null,'Validation cancellation failed');
    evidence.push({cancellationMs:performance.now()-cancelStart,code:code});
    var realTimeout=globalThis.setTimeout, timed=new api.MesherClient(), timedCode;
    // Exercise the deadline path without making the harness idle for two minutes.
    globalThis.setTimeout=function(callback,delay){return realTimeout(callback,delay===120000?100:delay);};
    try {await timed.importGeometry({sourceName:'timeout.stl',sourceFormat:'stl',sourceBytes:dense,importOptions:options});}
    catch(error){timedCode=error.diagnostic&&error.diagnostic.code;}
    finally {globalThis.setTimeout=realTimeout;timed.dispose();}
    assert(timedCode==='MESHER_TIMEOUT' && timed.worker===null,'Timed-out worker was not terminated');
    evidence.push({timeoutCode:timedCode,simulatedDeadlineMs:100,productionDeadlineMs:120000});
    client=new api.MesherClient();
    var recovered=await client.importGeometry({sourceName:'recovery.stl',sourceFormat:'stl',sourceBytes:source,importOptions:options});
    var mesh=await client.generateMesh({geometry:recovered,sourceBytes:source,settings:{preset:'coarse',elementType:'tet10'}});
    assert(mesh.quality.minimumJacobian>0,'Fresh worker did not recover after cancellation');client.dispose();
    globalThis.__stlResourceEvidence=evidence;
    status.textContent='Passed';status.dataset.result='passed';
  } catch(error) {globalThis.__stlResourceEvidence=evidence;status.textContent=error.message;status.dataset.result='failed';}
}());
