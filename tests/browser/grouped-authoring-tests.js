(function () {
  'use strict';
  var frame=document.getElementById('application-frame');
  function assert(ok,message){if(!ok)throw new Error(message);}
  function waitFor(condition) {
    var start=performance.now();
    return new Promise(function(resolve,reject){
      function poll(){
        try { if(condition()){resolve();return;} }catch(error){reject(error);return;}
        if(performance.now()-start>90000){reject(new Error('Application workflow timed out'));return;}
        setTimeout(poll,30);
      }
      poll();
    });
  }
  frame.addEventListener('load',async function(){
    var win=frame.contentWindow,doc=win.document,api=win.SpjutsimFEA,app,viewport;
    function click(selector){var element=doc.querySelector(selector);assert(element && !element.disabled,'Unavailable action '+selector);element.click();}
    function fill(id,value){var input=doc.getElementById(id);input.value=value;input.dispatchEvent(new win.Event('input',{bubbles:true}));input.dispatchEvent(new win.Event('change',{bubbles:true}));}
    try {
      await waitFor(function(){return doc.getElementById('app-status').textContent==='Local runtime ready';});
      // Observe the real instances through their existing public lifecycle, without app test hooks.
      var notify=api.AppController.prototype.notify,render=api.ViewportController.prototype.render;
      api.AppController.prototype.notify=function(){app=this;return notify.apply(this,arguments);};
      api.ViewportController.prototype.render=function(){viewport=this;return render.apply(this,arguments);};
      var bytes=await (await fetch('../fixtures/generated-unit-cube-m.step')).arrayBuffer();
      var transfer=new win.DataTransfer();transfer.items.add(new win.File([bytes],'cube.step'));
      doc.getElementById('import-step-input').files=transfer.files;
      doc.getElementById('import-step-input').dispatchEvent(new win.Event('change',{bubbles:true}));
      await waitFor(function(){return app && app.document.geometryImport.status==='succeeded';});
      app.replaceMaterial({name:'Group test steel',youngsModulusPa:200e9,poissonsRatio:0.3,densityKgM3:7850,tensileYieldPa:250e6});
      var geometry=app.document.geometry;
      var negative=geometry.faceIds.find(function(id){return api.analyzeGeometryFaceNormal(geometry,id).normal[0]<-0.99;});
      var positive=geometry.faceIds.find(function(id){return api.analyzeGeometryFaceNormal(geometry,id).normal[0]>0.99;});
      app.replaceSelectedFaces([negative]);click('#setup-add-support-button');fill('support-name','Fixed end');click('#support-form button[type="submit"]');
      app.replaceSelectedFaces([positive]);click('#setup-add-load-button');fill('load-type','total-force');
      assert(doc.getElementById('load-force-mode').value==='normal' && doc.getElementById('load-magnitude').value==='1','Default normal force magnitude missing');
      fill('load-force-mode','components');fill('load-name','Axial force');
      fill('load-fx','1000');fill('load-fy','0');fill('load-fz','0');
      assert(app.document.assignmentDraft.validation.valid && !app.document.loads.length,'Live preview committed early or is invalid');
      click('#load-form button[type="submit"]');assert(!app.document.selectedFaceIds.length,'Apply left faces selected');
      app.replaceMeshSettings({preset:'coarse',elementType:'tet10'});click('[data-setup-kind="mesh"] [data-setup-row-trigger]');click('#generate-mesh-button');
      await waitFor(function(){return app.document.meshGeneration.status==='succeeded';});
      assert(!doc.getElementById('solve-button').disabled && app.document.solvePreflight.status==='idle','Mesh triggered a check or blocked Solve');
      click('#solve-button');
      assert(!doc.getElementById('checks-panel').hidden,'Solve did not open Checks first');await waitFor(function(){return Boolean(app.document.results);});
      var result=app.document.results, revision=app.document.analysisRevision, mesh=app.document.mesh;
      click('[data-setup-kind="load"] [data-setup-row-trigger]');fill('load-fx','1500');click('#cancel-load-edit');
      assert(app.document.results===result && app.document.analysisRevision===revision && app.document.viewportPresentation.mode==='stress','Cancel failed to preserve completed solve and view');
      click('[data-view-mode="deformation"]');assert(app.document.viewportPresentation.deformationMode==='auto','Deformation did not default to Auto');click('#deformation-animation-toggle');click('#deformation-animation-toggle');click('[data-view-mode="stress"]');
      assert(app.document.viewportPresentation.deformationScale===0,'Stress retained hidden deformation scaling');
      click('#display-popover summary');assert(!doc.getElementById('color-range-min').disabled,'Automatic limits cannot be edited');fill('color-range-min','0');fill('color-range-max','0.0005');
      assert(app.document.viewportPresentation.colorRange.mode==='manual','Editing limits did not select Manual');
      doc.getElementById('color-range-lock').checked=true;doc.getElementById('color-range-lock').dispatchEvent(new win.Event('change',{bubbles:true}));
      fill('stress-unit','Pa');
      assert(app.document.viewportPresentation.colorRange.maximum===500,'Unit change altered locked SI range');
      assert(app.document.results===result && app.document.analysisRevision===revision && !viewport.resultDisplay.userData.lines.visible,'Display invalidated result or forced mesh overlay');
      fill('legend-orientation','horizontal');assert(doc.querySelectorAll('#legend-ticks span').length===2,'Horizontal key contains intermediate labels');
      fill('result-field','maxPrincipal');assert(app.document.viewportPresentation.colorRange.mode==='automatic' && !app.document.viewportPresentation.colorRange.locked,'Field change reused incompatible limits');
      fill('result-field','vonMises');fill('legend-orientation','vertical');click('#display-popover summary');
      for(var size of [[500,400],[1440,500],[850,600],[1440,900]]){
        frame.style.width=size[0]+'px';frame.style.height=size[1]+'px';
        await new Promise(function(resolve){setTimeout(resolve,100);});
        var canvas=doc.getElementById('viewport').getBoundingClientRect(),legend=doc.getElementById('result-legend').getBoundingClientRect();
        assert(doc.documentElement.scrollWidth<=size[0] && doc.documentElement.scrollHeight<=size[1],'Application page overflow');
        assert(legend.left>=canvas.left && legend.right<=canvas.right+1 && legend.top>=canvas.top && legend.bottom<=canvas.bottom+1,'Legend escaped viewport bounds');
        assert(Array.from(doc.querySelectorAll('#legend-ticks span')).every(function(t){return t.getBoundingClientRect().right<=legend.right;}),'Legend tick labels are clipped: '+JSON.stringify(Array.from(doc.querySelectorAll('#legend-ticks span')).map(function(t){return [t.textContent,t.getBoundingClientRect().right,legend.right,getComputedStyle(t.parentElement.parentElement).display];})));
      }
      var legendElement=doc.getElementById('result-legend'),oldBox=legendElement.getBoundingClientRect();
      doc.getElementById('legend-title').dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
      assert(legendElement.getBoundingClientRect().left<oldBox.left,'Legend keyboard movement failed');
      var oldRamp=legendElement.querySelector('.fea-color-ramp').getBoundingClientRect();
      doc.getElementById('legend-resize').dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true}));
      doc.getElementById('legend-resize').dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowDown',shiftKey:true,bubbles:true}));
      var newRamp=legendElement.querySelector('.fea-color-ramp').getBoundingClientRect();
      assert(newRamp.width>oldRamp.width && newRamp.height>oldRamp.height,'Color bar does not grow in both dimensions');
      var point=new win.THREE.Vector3(1,0.63,0.38).project(viewport.camera),canvasRect=doc.getElementById('viewport').getBoundingClientRect();
      var probe=viewport.pickResultAtPointer({clientX:canvasRect.left+(point.x+1)*canvasRect.width/2,clientY:canvasRect.top+(1-point.y)*canvasRect.height/2});
      assert(probe && probe.weights.some(function(v){return Math.abs(v-1/3)>0.01;}),'Probe snapped to triangle center');
      viewport.selectResultPoint(probe);assert(viewport.peakMarker && !doc.getElementById('probe-output').hidden,'Clicked point has no visible marker/details');
      assert(doc.getElementById('probe-output').getBoundingClientRect().height<250,'Point detail label stretches across the viewport');
      click('#locate-peak-button');assert(viewport.selectedResultPoint.isInterior && doc.getElementById('probe-output').textContent.includes('interior'),'Peak uses different point details');
      doc.body.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(!viewport.selectedResultPoint && doc.getElementById('probe-output').hidden,'Escape did not clear peak');
      click('#locate-peak-button');click('#locate-peak-button');assert(!viewport.peakMarker,'Locate peak cannot toggle off');
      // Normal force and a component force on this planar face must solve identically.
      app.replaceLoad(app.document.loads[0].id,{type:'total-force',direction:'surface-normal',magnitudeN:1000,sense:'pull'});
      click('#solve-button');await waitFor(function(){return Boolean(app.document.results);});
      assert(Math.abs(app.document.results.extrema.rawVonMisesMax.valuePa-result.extrema.rawVonMisesMax.valuePa)<1e-6,'Normal-force solve differs from equivalent vector force');
      app.undoEngineeringEdit();click('#solve-button');await waitFor(function(){return Boolean(app.document.results);});result=app.document.results;
      app.replaceGravity({enabled:true,accelerationMS2:[0,9.81,0]});
      await new Promise(function(resolve){win.requestAnimationFrame(resolve);});
      assert(doc.querySelector('[data-setup-kind="gravity"]') && viewport.analysisOverlay.children.some(function(g){return g.userData.descriptor.type==='gravity' && g.userData.descriptor.direction[1]===1;}),'Enabled gravity not represented in setup and viewport');
      app.replaceViewportPresentation(Object.assign({},app.document.viewportPresentation,{showGravity:false}));
      await new Promise(function(resolve){win.requestAnimationFrame(resolve);});
      assert(!viewport.analysisOverlay.children.some(function(g){return g.userData.descriptor.type==='gravity';}),'Independent gravity arrow toggle failed');
      app.replaceGravity({enabled:false,accelerationMS2:[0,9.81,0]});
      click('#solve-button');await waitFor(function(){return Boolean(app.document.results);});result=app.document.results;
      var migration=api.createReplacementMigrationDraft(app.document,app.document.geometry,{sourceName:'cube.step',sourceFormat:'step',sourceBytes:app.geometrySource.sourceBytes});
      var migrationUI=new api.ReplacementMigrationUI();migrationUI.open(migration,function(){},function(){});
      assert(doc.getElementById('replacement-migration-dialog').getBoundingClientRect().width>win.innerWidth*0.9,'Transfer dialog wastes screen width');
      migrationUI.selectedNewFaceIds=new Set([negative]);migrationUI.renderOverlays();
      assert(migrationUI.oldViewport.analysisOverlay.children.length && migrationUI.newViewport.analysisOverlay.children.some(function(g){return g.userData.descriptor.preview;}),'Transfer preview missing on one of the models');
      migrationUI.recordMapping();assert(migrationUI.newViewport.analysisOverlay.children.some(function(g){return !g.userData.descriptor.preview;}),'Mapped transfer assignment disappeared');migrationUI.cancel();
      app.renameAssignment('load',app.document.loads[0].id,'Renamed force');click('#undo-button');
      assert(app.document.loads[0].name==='Axial force' && app.document.results===result,'Rename undo invalidated numerical state');click('#redo-button');
      app.replaceLoad(app.document.loads[0].id,{type:'total-force',forceN:[1500,0,0]});click('#undo-button');
      assert(app.document.loads[0].forceN[0]===1000 && app.document.mesh===mesh && !app.document.results,'Engineering undo restored stale result or lost mesh');
      click('#view-checks-button');assert(doc.getElementById('checks-revision').textContent.includes('Stale'),'Old check lost its stale label');
      window.__spjutsimGroupedEvidence={samplePeakPa:result.extrema.rawVonMisesMax.valuePa,maxDisplacementM:result.extrema.maxDisplacement.valueM,elementType:result.elementType};
      document.getElementById('test-status').textContent='Passed';
    }catch(error){document.getElementById('test-status').textContent='Failed: '+error.message;}
  },{once:true});
}());
