(function(){
 'use strict';
 var frame=document.getElementById('application-frame'),status=document.getElementById('test-status');
 function assert(v,m){if(!v)throw new Error(m);}
 async function wait(fn){var start=performance.now();while(!fn()){if(performance.now()-start>90000)throw new Error('STL workflow timed out');await new Promise(function(r){setTimeout(r,20);});}}
 frame.addEventListener('load',async function(){
  var win=frame.contentWindow,doc=win.document,api=win.SpjutsimFEA,app;
  function click(id){var el=doc.getElementById(id);assert(el&&!el.disabled,'Unavailable '+id);el.click();}
  function fill(id,value){var el=doc.getElementById(id);el.value=value;el.dispatchEvent(new win.Event('change',{bubbles:true}));}
  async function open(name){var bytes=await(await fetch('../fixtures/stl/'+name+'.stl')).arrayBuffer(),transfer=new win.DataTransfer();transfer.items.add(new win.File([bytes],name+'.stl'));var input=doc.getElementById('import-step-input');input.files=transfer.files;input.dispatchEvent(new win.Event('change',{bubbles:true}));await wait(function(){return app&&app.stlImportSession;});}
  try{
   await wait(function(){return doc.getElementById('app-status').textContent==='Local runtime ready';});
   assert(doc.getElementById('stl-import-panel'),'STL needs an inline preparation panel and the main viewport');
   var startedWorkers=[],startWorker=api.startLocalWorker;api.startLocalWorker=function(kind){startedWorkers.push(kind);return startWorker.apply(this,arguments);};
   var notify=api.AppController.prototype.notify;api.AppController.prototype.notify=function(){app=this;return notify.apply(this,arguments);};
   await open('cube-binary');await wait(function(){return app.stlImportSession.preview;});
   assert(!app.document.geometry,'A source preview was installed as analysis geometry');
   assert(startedWorkers.every(function(kind){return kind==='stl-preparation';}),'STL preparation started a WASM worker');
   fill('stl-length-unit','m');await wait(function(){return app.stlImportSession.state==='ready';});
   assert(doc.getElementById('stl-show-all').hidden, 'Clean import displays issue controls');
   assert(doc.getElementById('stl-source-summary').textContent.includes('cube-binary.stl'), 'New filename missing');
   assert(doc.getElementById('stl-comparison-label').hidden, 'Unchanged import displays comparison');
   assert(doc.getElementById('stl-dimensions').textContent.includes('1'),'Physical dimensions missing');
   assert(!doc.querySelector('#stl-import-panel [data-surface-method]'),'Meshing choices still block import');
   click('stl-accept-button');await wait(function(){return app.document.geometry;});
   assert(app.document.geometry.volumeM3===1 && app.document.geometry.faceIds.length===6,'Cube scale or selection groups changed');
   var old=app.document.geometry,revision=app.document.analysisRevision;
   var read=win.File.prototype.arrayBuffer,release;
   try {
    win.File.prototype.arrayBuffer=function(){return new Promise(function(resolve){release=resolve;});};
    await open('cube-binary');
    assert(app.stlImportSession.state==='reading' && doc.getElementById('stl-source-summary').textContent.includes('cube-binary.stl'), 'Selected filename waits for file reading');
    assert(!doc.getElementById('stl-replacement-note').hidden, 'Replacement does not explain retained analysis');
    click('stl-cancel-button');release(new win.ArrayBuffer(1));
    await new Promise(function(resolve){setTimeout(resolve,30);});
    assert(!app.stlImportSession && app.document.geometry===old, 'Late file read reopened cancelled import');
   } finally { win.File.prototype.arrayBuffer=read; }

   await open('open');await wait(function(){return app.stlImportSession.state==='blocked';});
   assert(app.stlImportSession.preview && !doc.getElementById('stl-import-panel').hidden,'Invalid input lost its preview');
   assert(doc.getElementById('generate-mesh-button').disabled && doc.getElementById('stl-accept-button').disabled,'Pending invalid model enabled engineering actions');
   assert(!doc.getElementById('stl-show-all').hidden && !doc.getElementById('stl-show-all').textContent.includes('fit'), 'Issue highlight must be separate from viewport fit');
   assert(doc.getElementById('stl-import-status').textContent.includes('Automatic repair'), 'Blocked state does not explain the repair outcome');
   var issue=doc.querySelector('#stl-issues button');assert(issue,'No clickable error location');issue.click();assert(issue.getAttribute('aria-pressed')==='true','Issue did not select/highlight');
   fill('stl-length-unit','cm');
   click('stl-cancel-button');assert(app.document.geometry===old&&app.document.analysisRevision===revision,'Cancellation changed installed analysis');
   assert(win.localStorage.getItem('spjutsim-fea-stl-source-unit')==='m','Cancelled units became the remembered assumption');
   await open('inconsistent');await wait(function(){return app.stlImportSession.state==='ready';});
   assert(app.stlImportSession.result.changes.automatic.length && !app.stlImportSession.result.shapeChanged,'Routine cleanup asks for shape consent');
   click('stl-accept-button');await wait(function(){return !app.stlImportSession;});
   assert(app.geometrySource.originalSourceBytes instanceof win.ArrayBuffer,'Original bytes were lost after cleanup');
   assert(!doc.getElementById('mesh-stl-surface-settings').hidden,'Surface settings missing from Mesh');
   assert(doc.getElementById('stl-group-angle'),'Grouping must be available beside model selection');
   app.rotateGeometryAroundGlobalAxis('z',30);
   var before=app.document.geometry,ids=before.faceIds.slice(),rotation=JSON.stringify(before.orientation);
   assert(doc.getElementById('stl-split-face').disabled&&doc.getElementById('stl-merge-faces').disabled,'Face corrections enabled without a selection');
   app.replaceSelectedFaces([ids[0]]);assert(!doc.getElementById('stl-split-face').disabled,'Selected face cannot be split');
   click('stl-split-face');await wait(function(){return app.stlImportSession.state==='ready';});
   assert(app.stlImportSession.result.geometryCandidate.faceIds.length===7,'Split control did not prepare corrected faces');
   assert(doc.getElementById('stl-import-status').textContent.includes('7 selectable faces'),'Review does not explain the recognized faces');
   click('stl-cancel-button');assert(app.document.geometry===before,'Cancelled face correction changed the model');
   click('stl-split-face');await wait(function(){return app.stlImportSession.state==='ready';});click('stl-accept-button');
   await wait(function(){return !app.stlImportSession;});
   var split=app.document.geometry,changed=split.faceIds.filter(function(id){return !ids.includes(id);});
   assert(JSON.stringify(split.orientation)===rotation,'Face correction reset the installed model orientation');
   assert(split.faceIds.length===7&&split.stlSource.faceEdits.operations.length===1&&changed.length===2,'Accepted split lost source ownership');
   app.replaceSelectedFaces(changed);click('stl-merge-faces');await wait(function(){return app.stlImportSession.state==='ready';});click('stl-accept-button');
   assert(app.document.geometry.faceIds.slice().sort().join()===ids.slice().sort().join(),'Merge did not restore the selected source face');
   var preview=app.document.geometry.preview,firstNormal=preview.faceRanges[0].start*3;
   var opposite=preview.faceRanges.find(function(r){var j=r.start*3;return preview.normals[j]*preview.normals[firstNormal]+preview.normals[j+1]*preview.normals[firstNormal+1]+preview.normals[j+2]*preview.normals[firstNormal+2]<-.99;});
   app.replaceSelectedFaces([ids[0],opposite.faceId]);click('stl-merge-faces');await wait(function(){return app.stlImportSession.state==='blocked';});
   assert(doc.getElementById('stl-import-status').textContent.includes('Face correction could not be applied'),'Invalid merge is incorrectly described as a damaged solid');
   click('stl-cancel-button');
   app.replaceSelectedFaces([ids[0]]);app.createBoundaryCondition({name:'Base support',type:'support',componentsM:{x:0,y:0,z:0}});
   var assigned=app.document.geometry,condition=app.document.boundaryConditions[0];
   click('stl-split-face');await wait(function(){return app.stlImportSession.state==='ready';});click('stl-accept-button');
   assert(!doc.getElementById('replacement-migration-backdrop').hidden,'Assigned face correction skipped setup transfer review');
   assert(app.document.geometry===assigned&&app.document.boundaryConditions[0]===condition,'Face correction silently reassigned a support');
   click('replacement-migration-cancel');assert(app.document.geometry===assigned,'Cancelled transfer installed the corrected geometry');
   status.textContent='Passed';status.dataset.result='passed';
  }catch(e){status.textContent='Failed: '+e.message;status.dataset.result='failed';}
 });
}());
