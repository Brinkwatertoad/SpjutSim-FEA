(function(){
 'use strict';
 var frame=document.getElementById('application-frame'),status=document.getElementById('test-status');
 function check(ok,message){if(!ok)throw Error(message);}
 function waitFor(test){return new Promise(function(resolve,reject){var start=performance.now();function poll(){if(test())return resolve();if(performance.now()-start>180000)return reject(Error('Integrated workflow timeout'));setTimeout(poll,30);}poll();});}
 frame.addEventListener('load',async function(){
  var win=frame.contentWindow,doc=win.document,api=win.SpjutsimFEA,app,viewport,store,records=[];
  function click(id){var button=doc.getElementById(id);check(button&&!button.disabled,'Unavailable '+id);button.click();}
  function select(id,value){var node=doc.getElementById(id);node.value=value;node.dispatchEvent(new win.Event('change',{bubbles:true}));}
  try{
   await waitFor(function(){return doc.getElementById('app-status').textContent==='Local runtime ready';});
   var notify=api.AppController.prototype.notify,render=api.ViewportController.prototype.render;
   api.AppController.prototype.notify=function(){if(!app)app=this;return notify.apply(this,arguments);};
   api.ViewportController.prototype.render=function(){viewport=this;return render.apply(this,arguments);};
   var source=await(await fetch('../../docs/reviews/fixtures/36-38/asymmetric-bracket.spjutsim-fea')).arrayBuffer();
   store=new api.ProjectRecoveryStore('integrated-review-'+Date.now());
   for(var cycle=0;cycle<3;cycle++){
    var transfer=new win.DataTransfer();transfer.items.add(new win.File([source],'bracket.spjutsim-fea'));
    var input=doc.getElementById('project-file-input');input.files=transfer.files;input.dispatchEvent(new win.Event('change',{bubbles:true}));
    await waitFor(function(){return app&&app.document.geometry&&app.document.geometry.geometryId==='review-bracket'&&!app.projectOpening&&!doc.getElementById('save-project-button').disabled&&!app.document.mesh;});
    check(app.document.loads[0].frame.ownership==='cad'&&app.document.loads[0].type==='offset-force','Open lost local offset load');
    var physical=JSON.stringify(app.document.loads);select('settings-unit-system','uscs');select('settings-unit-system','si');check(JSON.stringify(app.document.loads)===physical,'Units changed physical load');
    doc.querySelector('[data-setup-kind="mesh"] [data-setup-row-trigger]').click();click('generate-mesh-button');await waitFor(function(){return app.document.meshGeneration.status==='succeeded';});
    click('solve-button');await waitFor(function(){return app.document.results||app.document.solveExecution.status==='failed';});check(app.document.results,'Bracket solve failed');
    var result=app.document.results,summary=api.resultSummaryRows(app.document);check(summary.diagnostics.some(function(row){return row[0]==='Moment balance';}),'Moment diagnostics missing');
    check(result.equilibrium.relativeResidual<1e-6&&result.equilibrium.momentRelativeResidual<1e-6,'Bracket force/moment balance');
    var view=JSON.stringify(viewport.captureViewState()),revision=app.document.analysisRevision;
    var docx=await api.buildAnalysisReport(app,viewport,0,'docx');check(docx.blob.size>1000,'Default report empty');check(JSON.stringify(viewport.captureViewState())===view&&app.document.analysisRevision===revision,'Report changed analysis or camera');
    var mesher=new api.MesherClient(),canonical;
    try{canonical=await mesher.importGeometry({geometryId:app.document.geometry.geometryId,sourceName:app.geometrySource.sourceName,sourceFormat:'step',sourceBytes:app.geometrySource.sourceBytes});}finally{mesher.dispose();}
    var cached=await api.readProjectFile(await api.writeProjectFile(await api.createProjectSnapshot(app,{includeDerived:true}))),restored=api.prepareProjectCandidate(cached,canonical);check(restored.document.results&&!restored.cacheWarning,'New-load cache did not reopen');
    var diagnostics=cached.derived.results.surfaceLoadResultants;delete cached.derived.results.surfaceLoadResultants;var incompatible=api.prepareProjectCandidate(cached,canonical);check(!incompatible.document.results&&incompatible.cacheWarning,'Incompatible load diagnostics silently reused');cached.derived.results.surfaceLoadResultants=diagnostics;
    var snapshot=await api.createProjectSnapshot(app),row=await store.write('project','owner',cycle,snapshot),recover=await store.read('project'),stats=await store.inspect();
    check(stats.records.length===1&&stats.sources.length===1&&!row.manifest.cache,'Recovery accumulated sources or numerical cache');
    var recovered=api.prepareProjectCandidate(recover,canonical);check(JSON.stringify(recovered.document.loads)===physical&&!recovered.document.results,'Recovery changed the committed load');
    records.push({cycle:cycle+1,nodeCount:app.document.mesh.statistics.nodeCount,maxDisplacementM:result.extrema.maxDisplacement.valueM,equilibrium:result.equilibrium,rendererGeometries:viewport.renderer.info.memory.geometries,reportBytes:docx.blob.size,recoveryRecords:stats.records.length,recoverySources:stats.sources.length});
   }
   check(records[2].rendererGeometries<=records[0].rendererGeometries+1,'Repeated cycles retained viewport geometry');
   var originalTheme=doc.getElementById('color-scheme-select').value;
   Array.from(doc.getElementById('color-scheme-select').options).forEach(function(option){select('color-scheme-select',option.value);check(viewport.renderer.info.memory.geometries<=records[0].rendererGeometries+1,'Theme switch leaked geometry');});select('color-scheme-select',originalTheme);
   for(var size of [[1152,720],[720,450],[500,400],[1440,900]]){frame.style.width=size[0]+'px';frame.style.height=size[1]+'px';await new Promise(function(resolve){setTimeout(resolve,100);});check(doc.documentElement.scrollWidth<=size[0]+1&&doc.documentElement.scrollHeight<=size[1]+1,'Workspace overflow at '+size);}
   var toggle=doc.getElementById('toggle-setup-pane');if(toggle.getAttribute('aria-expanded')!=='true')toggle.click();var splitter=doc.getElementById('setup-splitter');splitter.focus();splitter.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));check(doc.activeElement===splitter,'Keyboard resize lost focus');
   await store.discard('project','owner',3);check(!(await store.inspect()).sources.length,'Discard retained recovery CAD');
   window.__spjutsimUsabilityEvidence={cycles:records,themes:Array.from(doc.getElementById('color-scheme-select').options).map(function(o){return o.textContent;}),layout:'125%/200% equivalent available viewport sizes; physical browser zoom remains owner walkthrough'};
   status.textContent='Passed integrated open/units/mesh/solve/report/cache/recovery cycles';
  }catch(error){status.textContent='Failed: '+error.message;throw error;}finally{if(store){store.close();win.indexedDB.deleteDatabase(store.name);}}
 });
}());
