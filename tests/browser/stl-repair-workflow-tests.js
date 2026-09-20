(function(){
 'use strict';var status=document.getElementById('test-status');
 function assert(v,m){if(!v)throw Error(m);}
 async function wait(fn){var t=performance.now();while(!fn()){if(performance.now()-t>90000)throw Error('Workflow timed out');await new Promise(function(r){setTimeout(r,20);});}}
 document.getElementById('application-frame').addEventListener('load',async function(){
  var win=this.contentWindow,doc=win.document,api=win.SpjutsimFEA,app;
  function click(id){doc.getElementById(id).click();}
  function fill(id,v){var e=doc.getElementById(id);e.value=v;e.dispatchEvent(new win.Event('change',{bubbles:true}));}
  try{
   await wait(function(){return doc.getElementById('app-status').textContent==='Local runtime ready';});
   var notify=api.AppController.prototype.notify;api.AppController.prototype.notify=function(){app=this;return notify.apply(this,arguments);};
   var cube=await(await win.fetch('../tests/fixtures/stl/cube-binary.stl')).arrayBuffer(),dv=new win.DataView(cube),triangles=[];
   for(var i=0;i<12;i++){var t=[];for(var j=0;j<3;j++)t.push([0,1,2].map(function(k){return dv.getFloat32(84+i*50+12+j*12+k*4,true);}));triangles.push(t);}
   t=triangles.shift();var center=t[0].map(function(v,k){return(v+t[1][k]+t[2][k])/3;}),ring=t.map(function(p){return p.map(function(v,k){return center[k]+.001*(v-center[k]);});});
   for(i=0;i<3;i++){j=(i+1)%3;triangles.push([t[i],t[j],ring[j]],[t[i],ring[j],ring[i]]);}
   var hole=new win.ArrayBuffer(84+triangles.length*50);dv=new win.DataView(hole);dv.setUint32(80,triangles.length,true);
   triangles.forEach(function(t,i){t.forEach(function(p,j){p.forEach(function(v,k){dv.setFloat32(84+i*50+12+j*12+k*4,v,true);});});});
   var transfer=new win.DataTransfer();transfer.items.add(new win.File([hole],'small-hole.stl'));var input=doc.getElementById('import-step-input');input.files=transfer.files;input.dispatchEvent(new win.Event('change',{bubbles:true}));
   await wait(function(){return app&&app.stlImportSession&&app.stlImportSession.result;});
   fill('stl-length-unit','m');await wait(function(){return app.stlImportSession.state==='needs-review';});
   var session=app.stlImportSession,result=session.result;
   [Object.assign({},result,{lengthUnit:'mm'}),Object.assign({},result,{preparedDigest:'0'.repeat(64)}),Object.assign({},result,{geometryCandidate:session.preview})].forEach(function(bad){
     var refused=false;try{app.applyStlPreparationEvent({type:'stl-prepared',sessionId:session.sessionId,generation:session.generation,result:bad});}catch(e){refused=true;}
     assert(refused&&session.result===result,'Mismatched worker result crossed the controller boundary');
   });
   assert(result.shapeChanged&&result.changes.proposed.some(function(i){return i.kind==='filled-hole';}),'Small hole was not proposed with a location');
   var rejected=false;try{app.acceptStlImport({acceptShapeChanges:false});}catch(e){rejected=true;}assert(rejected,'Shape change accepted without consent');
   assert(doc.getElementById('stl-accept-button').textContent==='Use repaired model','Explicit repair acceptance missing');
   fill('stl-repair-hole-limit','0');assert(!app.stlImportSession.result&&doc.getElementById('stl-accept-button').disabled,'Settings edit retained old consent');
   assert(!app.applyStlPreparationEvent({type:'stl-prepared',sessionId:session.sessionId,generation:session.generation-1,result:result}),'Stale completion accepted');
   await wait(function(){return app.stlImportSession.state==='blocked';});assert(app.stlImportSession.preview,'Failed repair lost source preview');
   fill('stl-repair-hole-limit','1');await wait(function(){return app.stlImportSession.state==='needs-review';});click('stl-accept-button');
   assert(app.document.geometry&&Math.abs(app.document.geometry.volumeM3-1)<1e-12,'Accepted fill failed complete solid checks');
   assert(new win.Uint8Array(app.geometrySource.originalSourceBytes).every(function(v,i){return v===new win.Uint8Array(hole)[i];}),'Original download bytes changed');
   var installed=app.document.geometry,revision=app.document.analysisRevision;
   fill('mesh-stl-method','reconstruct');fill('mesh-stl-tolerance','.001');click('mesh-stl-apply');
   await wait(function(){return !doc.getElementById('mesh-stl-confirm').disabled;});
   assert(app.document.geometry===installed&&app.document.analysisRevision===revision,'Surface preview edited installed analysis');
   click('mesh-stl-cancel');assert(app.document.analysisRevision===revision&&!app.stlSurfaceReview,'Cancelled surface candidate edited analysis');
   click('mesh-stl-apply');await wait(function(){return !doc.getElementById('mesh-stl-confirm').disabled;});click('mesh-stl-confirm');
   assert(app.document.meshSettings.stlSurface.method==='reconstruct'&&app.document.geometry===installed,'Surface settings changed source identity');
   app.undoEngineeringEdit();assert(app.document.meshSettings.stlSurface.method==='original','Surface setting undo failed');
   var meshClient=new api.MesherClient(),mesh=await meshClient.generateMesh({geometry:installed,sourceBytes:app.geometrySource.sourceBytes,settings:{preset:'coarse',elementType:'tet10',stlSurface:{version:1,method:'reconstruct',reconstructionToleranceM:.001,remeshFeatureAngleDegrees:null}}});meshClient.dispose();
   assert(mesh.quality.minimumJacobian>0,'Reviewed fill failed meshing');
   status.textContent='Passed';status.dataset.result='passed';
  }catch(e){status.textContent='Failed: '+e.message;status.dataset.result='failed';}
 });
}());
