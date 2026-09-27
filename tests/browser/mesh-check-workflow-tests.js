(function () {
  'use strict';
  var frame=document.getElementById('application-frame');
  function assert(value,message){if(!value)throw Error(message);}
  function wait(test){return new Promise(function(resolve,reject){var start=performance.now();function poll(){if(test())return resolve();if(performance.now()-start>180000)return reject(Error('Workflow timeout'));setTimeout(poll,40);}poll();});}
  frame.addEventListener('load',async function(){
    var win=frame.contentWindow,doc=win.document,app,solveCount=0;
    function change(id,value){var input=doc.getElementById(id);if(input.type==='checkbox')input.checked=value;else input.value=value;input.dispatchEvent(new win.Event('change',{bubbles:true}));}
    try{
      await wait(function(){return doc.getElementById('app-status').textContent==='Local runtime ready';});
      var api=win.SpjutsimFEA,notify=api.AppController.prototype.notify,solve=api.SolverClient.prototype.solve;
      api.AppController.prototype.notify=function(){app=this;return notify.apply(this,arguments);};
      api.SolverClient.prototype.solve=function(){solveCount++;return solve.apply(this,arguments);};
      doc.getElementById('report-options-button').click();
      assert(!doc.getElementById('settings-backdrop').hidden && doc.getElementById('settings-tab-report').getAttribute('aria-selected')==='true','Report options did not open their Settings tab');
      assert(!doc.querySelector('dialog[open]'),'A separate report dialog is still used');
      doc.getElementById('close-settings-button').click();
      assert(doc.activeElement.id==='report-options-button','Settings did not restore report shortcut focus');
      doc.getElementById('load-example').click();
      await wait(function(){return app && app.document.projectMetadata && app.document.projectMetadata.name==='Cube example';});
      app.replaceMeshSettings({preset:'coarse',elementType:'tet10'});
      app.replaceMaterial(Object.assign({},app.document.material,{tensileYieldPa:250e6,compressiveYieldPa:200e6}));
      doc.getElementById('setup-guide-dismiss').click();doc.getElementById('solve-button').click();
      await wait(function(){return app.document.results;});
      assert(solveCount===1 && !app.document.convergenceStudy,'Mesh check unexpectedly runs by default');
      assert(doc.getElementById('yield-guidance').textContent.includes('200 MPa') && doc.getElementById('yield-guidance').textContent.includes('compressive') && doc.getElementById('yield-guidance').textContent.includes('von Mises'),'FoS hides its criterion type or governing strength');
      var original=app.document.results,revision=app.document.analysisRevision;
      var cachedBaseline=api.currentConvergenceBaseline(Object.assign({},app.document,{solvePreflight:{status:'idle'}}));
      assert(cachedBaseline.memorySource==='wasm-allocated' && cachedBaseline.estimatedPeakBytes===original.solverStatistics.wasmMemoryBytes,'Reopened result misrepresented saved WASM memory as a peak estimate');
      assert(api.currentConvergenceBaseline(Object.assign({},app.document,{analysisRevision:revision+1}))===null,'Quick check accepted a stale baseline');
      doc.getElementById('report-options-button').click();change('report-title','My mesh check');change('report-notes','Case-specific notes');change('report-current-view',true);
      assert(app.document.projectMetadata.reportOptions.title==='My mesh check' && app.document.projectMetadata.reportOptions.currentView,'Report Settings did not commit project options');
      assert(app.document.results===original && app.document.analysisRevision===revision,'Report preferences invalidated results');
      doc.getElementById('settings-tab-analysis').click();
      assert(!doc.getElementById('always-check-mesh').checked,'Automatic check preference defaults on');
      doc.getElementById('settings-tab-analysis').dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
      assert(doc.getElementById('settings-tab-report').getAttribute('aria-selected')==='true','Settings keyboard navigation does not follow visible tab order');
      doc.getElementById('close-settings-button').click();
      doc.getElementById('quick-mesh-check-button').click();
      await wait(function(){return app.document.convergenceStudy && app.document.convergenceStudy.status!=='running';});
      var study=app.document.convergenceStudy;
      assert(study.levels.length===2 && solveCount===2,'Quick check did not perform exactly one additional solve');
      assert(study.settings.maxLevels===2 && Math.abs(study.levels[1].targetSizeM/study.levels[0].targetSizeM-0.7)<1e-12,'Quick check used the wrong refinement');
      assert(doc.getElementById('displacement-guidance').textContent.includes('2%') && doc.getElementById('stress-guidance').textContent.includes('5%'),'Measured changes and thresholds are not shown');
      assert(doc.getElementById('trust-headline').textContent.includes('Quick mesh check'),'Two meshes were presented as a full convergence study');
      var reportText=api.createReportText(app.document,'cube.step',1);
      assert(reportText.includes('Displacement changed') && reportText.includes('2% refinement threshold') && reportText.includes('200 MPa'),'Report omitted the mesh thresholds or FoS basis');
      var target=study.levels[1].targetSizeM;
      doc.getElementById('quick-mesh-check-button').click();await wait(function(){return app.document.convergenceStudy.status!=='running';});
      assert(solveCount===3 && Math.abs(app.document.convergenceStudy.levels[0].targetSizeM-target)<1e-12,'Repeated quick check did not refine from the displayed result');
      var saved=await api.createProjectSnapshot(app);
      assert(saved.manifest.setup.metadata.reportOptions.notes==='Case-specific notes','Report settings did not survive project serialization');
      doc.getElementById('report-options-button').click();doc.getElementById('settings-tab-analysis').click();change('always-check-mesh',true);
      assert(win.localStorage.getItem('spjutsim-fea.always-check-mesh')==='true','Automatic check preference was not persisted');
      doc.getElementById('close-settings-button').click();
      app.replaceLoad(app.document.loads[0].id,{type:'total-force',forceN:[2000,0,0]});
      doc.getElementById('solve-button').click();
      await wait(function(){return app.document.convergenceStudy && app.document.convergenceStudy.status!=='running';});
      assert(solveCount===5 && app.document.convergenceStudy.levels.length===2,'Automatic check failed or recursively triggered another solve');
      doc.getElementById('report-options-button').click();doc.getElementById('settings-tab-report').click();
      assert(doc.getElementById('report-title').value==='My mesh check','Reopening Settings lost project report options');
      doc.getElementById('report-restore-defaults').click();assert(api.validateReportOptions(app.document.projectMetadata.reportOptions).title==='SpjutSim FEA analysis report','Report reset did not apply');
      var reloaded=document.createElement('iframe');document.body.appendChild(reloaded);reloaded.src='../../web/index.html';
      await wait(function(){var label=reloaded.contentDocument.getElementById('app-status');return label && label.textContent==='Local runtime ready';});
      assert(reloaded.contentDocument.getElementById('always-check-mesh').checked,'New app instance did not restore the automatic check preference');
      reloaded.remove();
      var store=win.Storage.prototype.setItem;win.Storage.prototype.setItem=function(){throw Error('Storage unavailable');};
      change('always-check-mesh',false);win.Storage.prototype.setItem=store;
      assert(doc.getElementById('analysis-preferences-status').textContent.includes('this session'),'Unavailable preference storage was not explained');
      doc.getElementById('close-settings-button').click();
      doc.getElementById('quick-mesh-check-button').click();doc.getElementById('cancel-convergence-button').click();doc.getElementById('quick-mesh-check-button').click();
      await wait(function(){return app.document.convergenceStudy.status!=='running';});
      assert(app.document.convergenceStudy.levels.length===2 && app.document.convergenceStudy.status==='completed','A cancelled check overwrote the immediately restarted check');
      document.getElementById('test-status').textContent='Passed';
    }catch(error){document.getElementById('test-status').textContent='Failed: '+error.message;console.error(error);}
  });
  frame.src='../../web/index.html';
}());
