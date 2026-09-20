(function(){
 'use strict';
 var status=document.getElementById('test-status');
 function assert(v,m){if(!v)throw Error(m);}
 document.getElementById('application-frame').addEventListener('load',async function(){
  var win=this.contentWindow,api=win.SpjutsimFEA,start=api.startLocalWorker,client;
  function tick(){return new Promise(function(r){setTimeout(r,0);});}
  function fake(){return {terminated:0,postMessage:function(m,transfers){this.request=m;this.transfers=transfers;},terminate:function(){this.terminated++;}};}
  async function rejected(p){try{await p;throw Error('Request unexpectedly succeeded');}catch(e){return e;}}
  try{
   var bytes=new win.Uint8Array(new Uint8Array(StlTestShapes.subdividedCube(1))).buffer;
   client=new api.StlPreparationClient();var prepared=await client.prepare({sessionId:'lifecycle',generation:0,geometryId:'lifecycle',sourceName:'cube.stl',sourceBytes:bytes,lengthUnit:'m',patchAngleDegrees:40,maxHoleDiameterRatio:0});client.dispose();
   assert(prepared.state==='ready','Lifecycle fixture failed preparation');
   var request={geometry:prepared.geometryCandidate,sourceBytes:bytes,settings:{preset:'coarse',elementType:'tet4',stlSurface:api.defaultStlSurface()}},late,worker=fake();
   api.startLocalWorker=function(kind){assert(kind==='stl-surface','Analysis did not start with surface preparation');return new Promise(function(r){late=r;});};
   client=new api.MesherClient();var pending=rejected(client.generateMesh(request));client.dispose();
   assert((await pending).diagnostic.code==='MESH_CANCELLED','Cancellation during startup did not settle promptly');late(worker);await tick();assert(worker.terminated===1,'Late surface startup leaked a worker');

   worker=fake();api.startLocalWorker=function(){return Promise.resolve(worker);};
   client=new api.MesherClient();pending=rejected(client.generateMesh(request));await tick();
   worker.onmessage({data:{protocol:4,type:'surface-result',requestId:worker.request.requestId,result:{version:0}}});
   assert((await pending).diagnostic.code==='INVALID_MESHER_RESPONSE'&&worker.terminated===1,'Malformed surface reply crossed the boundary');client.dispose();

   var surface=fake(),mesher=fake(),phases=[];
   api.startLocalWorker=function(kind){phases.push(kind);if(kind==='mesher')assert(surface.terminated===1,'Gmsh started before surface WASM terminated');return Promise.resolve(kind==='stl-surface'?surface:mesher);};
   client=new api.MesherClient();pending=rejected(client.generateMesh(request));await tick();
   var sizes=api.resolveMeshSettings(request.settings,request.geometry.boundingBoxM),h=Math.min(sizes.maxSizeM,1/3);
   var result={version:1,sourceHash:request.geometry.sourceMetadata.sha256,faceIds:request.geometry.faceIds.slice(),method:'planar-boundaries',targets:new win.Float64Array(12).fill(h),thicknessM:1,minSizeM:h,maxSizeM:sizes.maxSizeM,estimatedElementCount:100,boundary:null};
   var receive=surface.onmessage,reply={protocol:4,type:'surface-result',requestId:surface.request.requestId,result:result};
   receive({data:reply});await tick();assert(phases.join(',')==='stl-surface,mesher','Surface-to-volume handoff failed');
   receive({data:reply});await tick();assert(phases.length===2,'A late surface reply restarted volume meshing');
   assert(mesher.request.stlPreparedSurface===result&&mesher.transfers.includes(result.targets.buffer),'The checked local field was not transferred to the mesher');
   client.dispose();assert((await pending).diagnostic.code==='MESH_CANCELLED'&&mesher.terminated===1,'Cancellation after handoff leaked Gmsh');
   assert(bytes.byteLength>0,'Meshing transferred away the original source');
   // A timeout uses one budget, including the surface worker startup.
   var set=win.setTimeout,clear=win.clearTimeout,expire;
   win.setTimeout=function(fn,delay){assert(delay<=120000,'Surface stage reset its deadline');expire=fn;return 123;};win.clearTimeout=function(){};
   try{api.startLocalWorker=function(){return new Promise(function(r){late=r;});};worker=fake();client=new api.MesherClient();pending=rejected(client.generateMesh(request));expire();assert((await pending).diagnostic.code==='MESHER_TIMEOUT','Surface deadline did not settle');late(worker);await tick();assert(worker.terminated===1,'Timed-out startup leaked its late worker');
    surface=fake();mesher=fake();api.startLocalWorker=function(kind){return kind==='stl-surface'?Promise.resolve(surface):new Promise(function(r){late=r;});};
    client=new api.MesherClient();pending=rejected(client.generateMesh(request));await tick();
    surface.onmessage({data:{protocol:4,type:'surface-result',requestId:surface.request.requestId,result:result}});await tick();
    expire();assert((await pending).diagnostic.code==='MESHER_TIMEOUT','The shared deadline stopped during Gmsh startup');late(mesher);await tick();assert(mesher.terminated===1,'Timed-out Gmsh startup leaked a worker');
   }finally{win.setTimeout=set;win.clearTimeout=clear;}
   status.textContent='Passed';status.dataset.result='passed';
  }catch(e){status.textContent='Failed: '+e.message;status.dataset.result='failed';}finally{api.startLocalWorker=start;if(client)client.dispose();}
 });
}());
