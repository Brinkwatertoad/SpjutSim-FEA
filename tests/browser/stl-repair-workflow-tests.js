(function(){
 'use strict';var status=document.getElementById('test-status');
 function assert(v,m){if(!v)throw new Error(m);}
 async function wait(test){var start=performance.now();while(!test()){if(performance.now()-start>90000)throw new Error('Repair workflow timed out');await new Promise(function(resolve){setTimeout(resolve,20);});}}
 document.getElementById('application-frame').addEventListener('load',async function(){
  var win=this.contentWindow,doc=win.document,api=win.SpjutsimFEA,app,client;
  function click(id){var e=doc.getElementById(id);assert(e&&!e.disabled&&!e.hidden,'Unavailable '+id);e.click();}
  function fill(id,value){var e=doc.getElementById(id);e.value=value;e.dispatchEvent(new win.Event('change',{bubbles:true}));}
  try{
   await wait(function(){return doc.getElementById('app-status').textContent==='Local runtime ready';});
   assert(typeof api.MesherClient.prototype.repairStl==='function','Worker repair API is missing');
   var raw=await(await fetch('../fixtures/stl/inconsistent.stl')).arrayBuffer(),bytes=new win.Uint8Array(new Uint8Array(raw)).buffer;
   var options={version:2,lengthUnit:'m',patchAngleDegrees:40,normalization:'none',surfaceMode:'original',reconstructionToleranceM:null};
   var request={sourceName:'inconsistent.stl',sourceFormat:'stl',sourceBytes:bytes,importOptions:options,repairOptions:{version:1,maxHoleDiameterRatio:.01}};
   client=new api.MesherClient();var fixed=await client.repairStl(request);client.dispose();
   assert(bytes.byteLength===raw.byteLength&&fixed.report.flippedTriangles===1,'Repair changed retained bytes or miscounted corrected faces');
   assert(api.validateStlRepairResult(fixed),'Repair result contract rejected a valid repair');
   assert(!api.validateStlRepairResult(Object.assign({},fixed,{report:Object.assign({},fixed.report,{originalBoundingBoxM:{minM:[0,0,0],maxM:new Array(3)}})})),'Sparse repair bounds passed validation');
   assert(!api.validateStlRepairResult(Object.assign({},fixed,{report:Object.assign({},fixed.report,{repairedTriangleCount:13})})),'Inconsistent repair counts passed validation');
   assert(!api.validateStlRepairResult(Object.assign({},fixed,{report:Object.assign({},fixed.report,{originalSha256:'invalid'})})),'Invalid source fingerprint passed validation');
   client=new api.MesherClient({onProgress:function(p){if(p.stage==='stl-repair')client.cancel();}});var code;
   try{await client.repairStl(request);}catch(e){code=e.diagnostic&&e.diagnostic.code;}
   assert(code==='STL_REPAIR_CANCELLED'&&client.worker===null,'Repair cancellation left a worker or accepted results');
   client=new api.MesherClient();await client.ensureWorker();var realTimeout=win.setTimeout,expire;
   win.setTimeout=function(callback,delay){if(delay===120000)expire=callback;return realTimeout(callback,delay);};
   client.onProgress=function(p){if(p.stage==='stl-repair')expire();};code=null;
   try{await client.repairStl(request);}catch(e){code=e.diagnostic&&e.diagnostic.code;}finally{win.setTimeout=realTimeout;client.dispose();}
   assert(code==='MESHER_TIMEOUT'&&client.worker===null,'Repair deadline did not terminate the worker');
   var isolated=new api.AppController({document:api.createAnalysisDocument()}),review=isolated.beginGeometryReview(request),generation=isolated.setGeometryReviewOptions(options);
   isolated.invalidateGeometryReview();assert(!isolated.completeGeometryRepair(review,generation,fixed)&&review.source.sourceBytes===bytes,'Stale repair replaced the source');
   var notify=api.AppController.prototype.notify;api.AppController.prototype.notify=function(){app=this;return notify.apply(this,arguments);};
   var transfer=new win.DataTransfer();transfer.items.add(new win.File([bytes],'inconsistent.stl'));var input=doc.getElementById('import-step-input');input.files=transfer.files;input.dispatchEvent(new win.Event('change',{bubbles:true}));
   await wait(function(){return doc.getElementById('stl-import-dialog').open;});fill('stl-length-unit','m');
   await wait(function(){return !doc.getElementById('stl-repair-panel').hidden;});
   assert(doc.getElementById('stl-review-viewport').hidden,'Invalid source displayed an unrelated placeholder solid');
   assert(!app.document.geometry&&doc.getElementById('stl-accept-button').disabled,'Invalid source was installed before repair');
   click('stl-repair-button');await wait(function(){return app.geometryReview&&app.geometryReview.geometry;});
   assert(!doc.getElementById('stl-review-viewport').hidden,'Validated repair preview is hidden');
   assert(app.geometryReview.source.repair&&app.geometryReview.geometry.volumeM3===1,'Repair did not produce a reviewed unit cube');
   assert(!doc.getElementById('stl-repair-summary').hidden&&!app.document.geometry,'Repaired candidate was not explicitly reviewed');
   var mismatched=Object.assign({},app.geometryReview.source,{importOptions:app.geometryReview.options,repair:Object.assign({},app.geometryReview.source.repair,{report:Object.assign({},app.geometryReview.source.repair.report,{repairedSha256:'0'.repeat(64)})})});
   var refused=false;try{isolated.replaceGeometry(app.geometryReview.geometry,mismatched);}catch(e){refused=e.message.includes('repair');}
   assert(refused&&!isolated.document.geometry,'Mismatched repaired-source provenance was installed');
   assert(!doc.getElementById('stl-download-original-button').hidden,'Original STL is not available after repair');
   fill('stl-length-unit','mm');await wait(function(){return app.geometryReview&&app.geometryReview.geometry;});
   assert(app.geometryReview.geometry.importOptions.lengthUnit==='mm'&&Math.abs(app.geometryReview.geometry.volumeM3-1e-9)<1e-20,'Repaired source lost its identity or scale after changing units');
   fill('stl-length-unit','m');await wait(function(){return app.geometryReview&&app.geometryReview.geometry;});
   click('stl-accept-button');await wait(function(){return app.document.geometry;});var installed=app.document.geometry,source=app.geometrySource;
   assert(source.repair.originalSourceBytes.byteLength===bytes.byteLength&&source.repair.report.flippedTriangles===1,'Installation lost the original or repair report');
   isolated.replaceGeometryWithSetup(installed,source,{boundaryConditions:[],loads:[],material:app.document.material,gravity:app.document.gravity,
     meshSettings:app.document.meshSettings,solveSettings:app.document.solveSettings,viewportPreferences:{}});
   assert(isolated.geometrySource.repair===source.repair,'Replacement setup transfer lost the original source or repair report');
   client=new api.MesherClient();var mesh=await client.generateMesh({geometry:installed,sourceBytes:source.sourceBytes,settings:{preset:'coarse',elementType:'tet10'}});client.dispose();
   assert(mesh.quality.minimumJacobian>0&&mesh.boundaryFaces.faceRanges.length===6,'Repaired source failed fresh-worker meshing');
   click('regroup-stl-button');await wait(function(){return app.geometryReview&&app.geometryReview.geometry;});
   assert(app.geometryReview.source.repair===source.repair,'Reopening lost repair provenance');
   click('stl-discard-repair-button');await wait(function(){return !doc.getElementById('stl-repair-panel').hidden;});
   assert(!app.geometryReview.source.repair&&app.document.geometry===installed,'Discarding a pending repair changed the installed analysis');
   click('stl-repair-button');click('stl-cancel-button');await new Promise(function(resolve){setTimeout(resolve,300);});
   assert(!app.geometryReview&&app.document.geometry===installed&&app.geometrySource===source,'Cancelled repair changed the installed source');
   if(new URLSearchParams(location.search).get('fixture')==='gargoyle'){
     var gargoyle=await(await fetch('../fixtures/stl/cathedral_gargoyle.stl')).arrayBuffer();
     transfer=new win.DataTransfer();transfer.items.add(new win.File([gargoyle],'cathedral_gargoyle.stl'));input.files=transfer.files;input.dispatchEvent(new win.Event('change',{bubbles:true}));
     await wait(function(){return doc.getElementById('stl-import-dialog').open;});fill('stl-length-unit','mm');
     await wait(function(){return !doc.getElementById('stl-repair-panel').hidden;});click('stl-repair-button');
     await wait(function(){return doc.getElementById('stl-error-code').textContent==='STL_REPAIR_UNSUPPORTED';});
     assert(doc.getElementById('stl-import-status').textContent.includes('3 disconnected')&&!app.geometryReview.source.repair,'Gargoyle repair discarded or silently joined components');
     assert(app.document.geometry===installed&&doc.getElementById('stl-accept-button').disabled,'Failed gargoyle repair replaced the installed model');click('stl-cancel-button');
   }
   globalThis.__stlSurfaceEvidence={repair:fixed.report,mesh:mesh.statistics,minimumJacobian:mesh.quality.minimumJacobian,cancellation:true,timeout:true,staleRepairRejected:true,gargoyleChecked:new URLSearchParams(location.search).get('fixture')==='gargoyle'};
   status.textContent='Passed';status.dataset.result='passed';
  }catch(e){status.textContent=e.message;status.dataset.result='failed';}finally{if(client)client.dispose();}
 });
}());
