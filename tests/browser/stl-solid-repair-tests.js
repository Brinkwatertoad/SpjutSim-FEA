(function(){
 'use strict';var status=document.getElementById('test-status');
 function assert(v,m){if(!v)throw new Error(m);}
 async function wait(fn){var start=performance.now();while(!fn()){if(performance.now()-start>125000)throw new Error('Solid repair workflow timed out');await new Promise(function(r){setTimeout(r,20);});}}
 document.getElementById('application-frame').addEventListener('load',async function(){
  var win=this.contentWindow,api=win.SpjutsimFEA,client;
  try {
   var query=new URLSearchParams(location.search),text=new TextDecoder().decode(StlTestShapes.subdividedCube(1));
   var shifted=text.replace(/vertex ([^\n]+)/g,function(line,xyz){var p=xyz.split(' ').map(Number);p[0]+=.4;p[1]+=.3;p[2]+=.2;return 'vertex '+p.join(' ');});
   text=text.replace('endsolid test',shifted.replace('solid test\n',''));
   var source=query.get('fixture')==='gargoyle'?await(await win.fetch('../tests/fixtures/stl/cathedral_gargoyle.stl')).arrayBuffer():new win.TextEncoder().encode(text).buffer;
   var name=query.get('fixture')==='gargoyle'?'cathedral_gargoyle.stl':'overlap.stl',events=[],workers=[],start=api.startLocalWorker;
   api.startLocalWorker=function(kind){workers.push(kind);return start.apply(this,arguments);};
   var request={sessionId:'repair-solid',generation:0,geometryId:'repair-solid',sourceName:name,sourceBytes:source,lengthUnit:'mm',patchAngleDegrees:40,maxHoleDiameterRatio:.01};
   client=new api.StlPreparationClient({onEvent:function(e){events.push(e);}});
   var result=await client.prepare(request);client.dispose();
   assert(result.state==='needs-review','Intersecting surfaces did not produce a reviewable solid: '+JSON.stringify(result.error));
   assert(workers.join(',')==='stl-preparation,stl-solid-repair','Solid reconstruction must run separately and only after lightweight cleanup');
   assert(result.geometryCandidate.sourceMetadata.validation.status==='valid'&&result.diagnostics.coverage.intersections==='passed','Rebuilt candidate bypassed strict validation');
   assert(result.shapeChanged&&result.solidRepair&&result.changes.proposed.some(function(i){return i.kind==='rebuilt-surface';}),'Material-changing repair lacks proposal/provenance');
   assert(result.sourceTriangleByCandidate.every(function(i){return i===-1;}),'Reconstructed faces falsely claim original facet identity');
   assert(events[0].type==='stl-preview'&&events.filter(function(e){return e.type==='stl-prepared';}).length===1,'Intermediate failed cleanup was presented as final');
   assert(source.byteLength===request.sourceBytes.byteLength,'Repair transferred away the retained original');
   // Fresh request: cancellation at the phase transition must prevent a result.
   client=new api.StlPreparationClient({onEvent:function(e){if(e.type==='stl-progress'&&e.message.includes('Rebuilding a solid'))client.cancel();}});
   var error;try{await client.prepare(request);}catch(e){error=e;}
   assert(error&&error.diagnostic.code==='STL_PREPARATION_CANCELLED'&&!client.worker,'Cancellation leaked the solid-repair worker');
   api.startLocalWorker=start;
   if(query.get('fixture')!=='gargoyle'){
    var doc=win.document,app,notify=api.AppController.prototype.notify;
    api.AppController.prototype.notify=function(){app=this;return notify.apply(this,arguments);};
    await wait(function(){return doc.getElementById('app-status').textContent==='Local runtime ready';});
    function importFile(bytes,filename){var transfer=new win.DataTransfer();transfer.items.add(new win.File([bytes],filename));var input=doc.getElementById('import-step-input');input.files=transfer.files;input.dispatchEvent(new win.Event('change',{bubbles:true}));}
    importFile(source,name);await wait(function(){return app&&app.stlImportSession&&app.stlImportSession.state==='needs-review';});
    assert(doc.getElementById('stl-accept-button').textContent==='Use repaired model','Solid reconstruction lacks explicit UI acceptance');
    assert(doc.getElementById('stl-show-all').hidden,'A valid repair proposal still offers to highlight unrepaired regions');
    assert(doc.getElementById('stl-repair-consent').textContent.includes('round small details'),'Solid reconstruction hides material-change explanation');
    var refused=false;try{app.acceptStlImport({acceptShapeChanges:false});}catch(e){refused=true;}assert(refused,'Rebuilt solid was installed without consent');
    doc.getElementById('stl-accept-button').click();
    assert(app.document.geometry&&app.geometrySource.preparation.solidRepair.method==='enclosing-surface','Accepted solid lost its repair provenance');
    assert(new win.Uint8Array(app.geometrySource.originalSourceBytes).every(function(v,i){return v===new win.Uint8Array(source)[i];}),'Solid reconstruction changed original download bytes');
    var installed=app.document.geometry,revision=app.document.analysisRevision;
    importFile(source,'replacement.stl');await wait(function(){return app.stlImportSession&&app.stlImportSession.state==='needs-review';});
    doc.getElementById('stl-cancel-button').click();
    assert(app.document.geometry===installed&&app.document.analysisRevision===revision&&!app.stlImportSession,'Rejected rebuilt solid replaced installed analysis');
   }
   window.__stlSurfaceEvidence={source:name,facets:result.geometryCandidate.sourceMetadata.triangleCount,groups:result.geometryCandidate.faceIds.length,solidRepair:result.solidRepair};
   status.textContent='Passed';status.dataset.result='passed';
  }catch(e){status.textContent='Failed: '+e.message;status.dataset.result='failed';}finally{if(client)client.dispose();}
 });
}());
