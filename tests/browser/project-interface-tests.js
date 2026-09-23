(function(){
  function assert(v,m){if(!v)throw Error(m);}
  async function waitFor(fn){var start=performance.now();while(!fn()){if(performance.now()-start>90000)throw Error('Workflow timed out');await new Promise(r=>setTimeout(r,30));}}
  document.getElementById('application-frame').addEventListener('load',async function(){
    var win=this.contentWindow,doc=win.document,api=win.SpjutsimFEA,app,viewport;
    try{
      await waitFor(()=>doc.getElementById('app-status').textContent==='Local runtime ready');
      assert(doc.getElementById('mesh-options-dialog'),'Mesh options dialog missing');
      assert(!doc.getElementById('mesh-options-dialog').open,'Mesh options opened on startup');
      assert(!Array.from(doc.querySelectorAll('[data-ui-menu-button]')).some(e=>e.textContent==='View'),'Redundant View menu remains');
      assert(doc.querySelectorAll('[data-view-orientation]').length===6,'Signed view controls lost');
      var notify=api.AppController.prototype.notify,render=api.ViewportController.prototype.render;
      api.AppController.prototype.notify=function(){app=this;return notify.apply(this,arguments);};api.ViewportController.prototype.render=function(){viewport=this;return render.apply(this,arguments);};
      var source=await (await fetch('../fixtures/generated-unit-cube-m.step')).arrayBuffer(),transfer=new win.DataTransfer();transfer.items.add(new win.File([source],'cube.step'));
      doc.getElementById('import-step-input').files=transfer.files;doc.getElementById('import-step-input').dispatchEvent(new win.Event('change',{bubbles:true}));
      await waitFor(()=>app && app.document.geometryImport.status==='succeeded');
      var revision=app.document.analysisRevision;doc.querySelector('[data-mesh-options]').click();assert(doc.getElementById('mesh-options-dialog').open && app.document.analysisRevision===revision,'Options changed physics');doc.getElementById('mesh-options-dialog').close();
      assert(Math.abs(api.modelInformation(app.document).volumeM3-1)<1e-10,'Actual CAD volume differs from analytical cube');
      app.replaceMaterial({name:'Steel',youngsModulusPa:200e9,poissonsRatio:0.3,densityKgM3:7800});
      var faces=app.document.geometry.faceIds;app.replaceSelectedFaces([faces[0]]);app.createBoundaryCondition({type:'support',componentsM:{x:0,y:0,z:0}});app.replaceSelectedFaces([faces[1]]);app.createLoad({type:'total-force',forceN:[1,0,0]});
      var snapshot=await api.createProjectSnapshot(app);var blob=await api.writeProjectFile(snapshot);var old=app.document;var workflow=new api.ProjectWorkflow(app);await workflow.open(blob);
      assert(app.document!==old && app.document.boundaryConditions.length===1 && app.document.loads.length===1 && !app.projectDirty,'Actual CAD portable reopen failed');
      doc.getElementById('save-project-button').click();assert(doc.getElementById('save-project-dialog').open && !doc.getElementById('project-include-cache').checked,'Save defaults changed');doc.getElementById('save-project-dialog').close('cancel');
      assert(doc.getElementById('solve-button').textContent==='Mesh and solve','Combined action not discoverable');
      assert(doc.getElementById('report-options-button'),'Report options missing');
      doc.querySelector('[data-setup-kind="load"] [data-setup-row-trigger]').click();
      var name=doc.getElementById('load-name');name.value='';name.dispatchEvent(new win.Event('input',{bubbles:true}));doc.getElementById('load-form').dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));
      assert(doc.activeElement===name && name.getAttribute('aria-invalid')==='true','Failed Apply did not focus and explain invalid field');
      doc.getElementById('cancel-load-edit').click();
      doc.querySelector('[data-setup-kind="material"] [data-setup-row-trigger]').click();
      var catalog=doc.getElementById('material-catalog-select');catalog.value='custom';catalog.dispatchEvent(new win.Event('change',{bubbles:true}));
      doc.getElementById('material-name').value='Library only';doc.getElementById('material-youngs').value='100';doc.getElementById('material-poisson').value='0.3';
      assert(doc.getElementById('save-material-library-button'),'Separate material-library save is missing');
      revision=app.document.analysisRevision;doc.getElementById('save-material-library-button').click();
      assert(app.document.analysisRevision===revision && app.document.material.youngsModulusPa===200e9,'Saving to the library changed the active material');
      doc.getElementById('material-form').dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));assert(app.document.material.youngsModulusPa===100e9,'Apply did not use the saved material');
      doc.querySelector('[data-setup-kind="material"] [data-setup-row-trigger]').click();
      doc.getElementById('material-youngs').value='150';doc.getElementById('cancel-material-edit').click();
      doc.querySelector('[data-setup-kind="material"] [data-setup-row-trigger]').click();
      assert(Number(doc.getElementById('material-youngs').value)===100 && app.document.material.youngsModulusPa===100e9,'Material Cancel retained unapplied properties');
      document.getElementById('test-status').textContent='Passed';
    }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;console.error(e);}
  });
}());
