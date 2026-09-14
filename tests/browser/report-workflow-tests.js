(function () {
  'use strict';
  var frame=document.getElementById('application-frame');
  function assert(ok,message){if(!ok)throw Error(message);}
  function waitFor(test){return new Promise(function(resolve,reject){var start=performance.now();function poll(){if(test())return resolve();if(performance.now()-start>90000)return reject(Error('Workflow timeout'));setTimeout(poll,30);}poll();});}
  frame.addEventListener('load',async function(){
    var win=frame.contentWindow,doc=win.document,api=win.SpjutsimFEA,app,viewport;
    function click(selector){var e=doc.querySelector(selector);assert(e&&!e.disabled,'Disabled '+selector);e.click();}
    function fill(id,value){var e=doc.getElementById(id);e.value=value;e.dispatchEvent(new win.Event('change',{bubbles:true}));}
    try {
      await waitFor(function(){return doc.getElementById('app-status').textContent==='Local runtime ready';});
      assert(doc.getElementById('export-report-button').disabled,'Empty export enabled');
      // Observe the real instances through their existing public lifecycle, without app test hooks.
      var notify=api.AppController.prototype.notify,render=api.ViewportController.prototype.render;
      api.AppController.prototype.notify=function(){app=this;return notify.apply(this,arguments);};
      api.ViewportController.prototype.render=function(){viewport=this;return render.apply(this,arguments);};
      var bytes=await (await fetch('../fixtures/generated-unit-cube-m.step')).arrayBuffer();
      var transfer=new win.DataTransfer();transfer.items.add(new win.File([bytes],'cube.step'));
      doc.getElementById('import-step-input').files=transfer.files;
      doc.getElementById('import-step-input').dispatchEvent(new win.Event('change',{bubbles:true}));
      await waitFor(function(){return app && app.document.geometryImport.status==='succeeded';});
      app.replaceMaterial(new api.MaterialCatalog().materialSnapshot('factory.material.polymer.pla'));
      var geometry=app.document.geometry;
      var negative=geometry.faceIds.find(function(id){return api.analyzeGeometryFaceNormal(geometry,id).normal[0]<-0.99;});
      var positive=geometry.faceIds.find(function(id){return api.analyzeGeometryFaceNormal(geometry,id).normal[0]>0.99;});
      assert(doc.querySelector('[data-setup-kind="support"] strong').textContent==='Add support…' && doc.querySelector('[data-setup-kind="load"] strong').textContent==='Add load…','Empty assignment rows are missing');
      app.replaceSelectedFaces([negative]);click('[data-setup-kind="support"][data-item-id="new"] [data-setup-row-trigger]');fill('support-name','Fixed end');click('#support-form button[type="submit"]');
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
      assert(!doc.getElementById('export-report-button').disabled,'Solved export disabled');
      var autoScale=api.UIController.prototype.resolveDeformationScale.call({controller:app},'auto');
      fill('stress-unit','psi');fill('length-unit','in');
      viewport.orbitByPixels(80,30);viewport.panByPixels(15,-10);
      viewport.setSelectedFaceIds([positive]);viewport.locatePeak();
      viewport.setDeformationAnimationMultiplier(0.4);
      var view=JSON.stringify(viewport.captureViewState()),presentation=JSON.stringify(viewport.presentation),quaternion=viewport.camera.quaternion.toArray().join(),probe=viewport.selectedResultPoint;
      function restored(){
        assert(JSON.stringify(viewport.captureViewState())===view,'Camera view not restored');
        assert(viewport.camera.quaternion.toArray().join()===quaternion,'Camera roll not restored');
        assert(JSON.stringify(viewport.presentation)===presentation,'Presentation not restored');
        assert(viewport.selectedFaceIds.has(positive)&&viewport.selectedResultPoint===probe,'Selection/probe not restored');
        assert(viewport.deformationAnimationMultiplier===0.4,'Animation phase not restored');
        assert(app.document.results===result&&app.document.analysisRevision===revision,'Export invalidated analysis');
      }
      var presets=api.reportViewPresets(app.document,autoScale),captured=[];
      for(var preset of presets){
        var canvas=viewport.captureReportView(app.document,preset.presentation);
        restored();
        var context=canvas.getContext('2d'),image=context.getImageData(0,0,canvas.width,canvas.height-128),changed=0;
        for(var i=0;i<image.data.length;i+=400){if(image.data[i]!==image.data[0]||image.data[i+1]!==image.data[1])changed++;}
        assert(changed>50,'Blank model capture '+preset.name);
        if(preset.presentation.field==='vonMises' && preset.presentation.mode==='stress'){
          var rampPixel=context.getImageData(20,viewport.canvas.height+45,1,1).data;
          assert(Math.abs(rampPixel[0]-31)<3&&Math.abs(rampPixel[1]-74)<3&&Math.abs(rampPixel[2]-166)<3,'Report legend does not match viewport sRGB colors');
        }
        captured.push(canvas.toDataURL('image/png'));
        if(preset.presentation.mode==='deformation'){
          assert(canvas.height===viewport.canvas.height+128,'Legend missing');
        }
      }
      assert(new Set(captured).size===5,'Report views are duplicated');
      window.reportCaptureImages=captured;
      var fieldDefinition=api.resultFieldDefinition;
      api.resultFieldDefinition=function(){api.resultFieldDefinition=fieldDefinition;throw Error('Injected capture failure');};
      var failed=false;try{viewport.captureReportView(app.document,presets[2].presentation);}catch(e){failed=e.message==='Injected capture failure';}
      assert(failed,'Failure path not reached');restored();
      var text=api.createReportText(app.document,'cube.step',autoScale,new Date('2026-09-13T12:00:00Z'));
      api.resultSummaryRows(app.document).values.concat(api.resultSummaryRows(app.document).diagnostics).forEach(function(row){assert(text.includes(row.join('\t')),'Missing Results row '+row[0]);});
      assert(text.includes('Source: tensileYieldPa')&&text.includes('62 MPa')&&text.includes('1000 N'),'Material/load report missing');
      assert(text.includes('39.37 in × 39.37 in × 39.37 in'),'Part size report unit incorrect');
      window.analysisReport=await api.buildAnalysisReport(app,viewport,autoScale);restored();
      var noFosController={document:Object.assign({},app.document,{results:Object.assign({},result,{factorOfSafety:null})}),geometrySource:app.geometrySource};
      window.noFosReport=await api.buildAnalysisReport(noFosController,viewport,autoScale);restored();
      // Invalidate between PNG encodes; stale snapshots must never download.
      var capture=viewport.captureReportView;
      viewport.captureReportView=function(){var image=capture.apply(this,arguments);noFosController.document.analysisRevision++;return image;};
      failed=false;try{await api.buildAnalysisReport(noFosController,viewport,autoScale);}catch(e){failed=e.message.includes('analysis changed');}finally{viewport.captureReportView=capture;}
      assert(failed,'Stale export was accepted');restored();
      click('#export-report-button');await waitFor(function(){return doc.getElementById('report-status').textContent==='Report downloaded.';});restored();
      document.getElementById('test-status').textContent='Passed';
    }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;}
  });
}());
