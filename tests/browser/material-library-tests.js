(function () {
  'use strict';
  var frame=document.getElementById('application-frame');
  function assert(ok,msg){if(!ok)throw Error(msg);}
  function near(a,b){assert(Math.abs(a-b)<1e-11*Math.max(1,Math.abs(b)),a+' != '+b);}
  frame.addEventListener('load',async function () {
    var win=frame.contentWindow,doc=win.document,api=win.SpjutsimFEA,app,author;
    function fill(id,value){var e=doc.getElementById(id);e.value=value;e.dispatchEvent(new win.Event('change',{bubbles:true}));}
    function click(selector){doc.querySelector(selector).click();}
    function wait(test){return new Promise(function(resolve,reject){var start=performance.now();function poll(){if(test())return resolve();if(performance.now()-start>60000)return reject(Error('Timed out'));setTimeout(poll,30);}poll();});}
    try {
      await wait(function(){return doc.getElementById('app-status').textContent==='Local runtime ready';});
      assert(doc.getElementById('load-type').value==='total-force','Force is not the default');
      var notify=api.AppController.prototype.notify,change=api.AnalysisAuthoringUI.prototype.changeLoadUnit;
      api.AppController.prototype.notify=function(){app=this;return notify.apply(this,arguments);};
      api.AnalysisAuthoringUI.prototype.changeLoadUnit=function(){author=this;return change.apply(this,arguments);};
      var bytes=await(await fetch('../fixtures/generated-unit-cube-m.step')).arrayBuffer();
      var transfer=new win.DataTransfer();transfer.items.add(new win.File([bytes],'cube.step'));
      doc.getElementById('import-step-input').files=transfer.files;doc.getElementById('import-step-input').dispatchEvent(new win.Event('change',{bubbles:true}));
      await wait(function(){return app&&app.document.geometry;});
      fill('settings-unit-system','uscs');
      click('[data-setup-kind="material"] [data-setup-row-trigger]');click('#edit-material-library-button');
      assert(doc.getElementById('engineering-library-dialog').open,'Library did not open');
      click('[data-engineering-library-row="factory.material.polymer.pla"]');click('#engineering-library-edit');
      var editor=doc.querySelector('[data-engineering-record-editor]');
      assert(editor.elements.notes.value.includes('Printed properties'),'Factory notes missing from full editor');
      assert(editor.elements.ultimateCompressivePa && editor.elements.sourceUrl,'Optional/source fields missing');
      click('#engineering-library-copy');editor=doc.querySelector('[data-engineering-record-editor]');
      editor.elements.name.value='My PLA';editor.elements.notes.value+=' Custom coupon.';
      editor.elements.source.value='Coupon log';editor.elements.sourceUrl.value='https://example.com/coupon';
      click('[data-engineering-record-save]');
      var catalog=new api.MaterialCatalog(win.localStorage),saved=catalog.list().find(function(e){return e.material.name==='My PLA';});
      assert(saved && saved.metadata.notes.includes('Custom coupon.') && saved.metadata.source==='Coupon log','Metadata not persisted');
      assert(saved.metadata.fieldProvenance.tensileYieldPa && saved.metadata.fieldProvenance.youngsModulusPa,'Copy discarded field provenance');
      assert(saved.material.youngsModulusPa===3.425e9,'Display-unit round trip changed copied modulus');
      click('[data-engineering-library-row="factory.material.polymer.nylon"]');click('#engineering-library-copy');click('[data-engineering-record-save]');
      var nylon=new api.MaterialCatalog(win.localStorage).list().find(function(e){return e.material.name==='Nylon copy';});
      assert(nylon.material.youngsModulusPa===493e6 && nylon.metadata.fieldProvenance.youngsModulusPa,'Untouched Nylon modulus/source changed through display units');
      click('[data-engineering-library-row="'+saved.id+'"]');click('#engineering-library-edit');
      editor=doc.querySelector('[data-engineering-record-editor]');editor.elements.youngsModulusPa.value=api.preferredFromSI('youngsModulusPa',4e9);click('[data-engineering-record-save]');
      saved=new api.MaterialCatalog(win.localStorage).get(saved.id);
      assert(saved.material.youngsModulusPa===4e9 && !saved.metadata.fieldProvenance.youngsModulusPa && saved.metadata.fieldProvenance.tensileYieldPa,'Edited value retained a misleading source or lost unrelated provenance');
      click('[data-engineering-library-row="'+saved.id+'"]');click('#engineering-library-use');
      assert(app.document.material.name==='My PLA','Use did not immediately assign');
      app.undoEngineeringEdit();assert(app.document.material===null,'Material choice not undoable');
      assert(new api.MaterialCatalog(win.localStorage).get(saved.id),'Project undo changed library');
      fill('material-catalog-select','custom');fill('material-name','Project custom');fill('material-youngs','123');fill('material-poisson','0.27');
      click('#save-material-library-button');
      catalog=new api.MaterialCatalog(win.localStorage);
      var custom=catalog.list().find(function(e){return e.material.name==='Project custom';});
      assert(custom && custom.material.youngsModulusPa===app.document.material.youngsModulusPa,'Save icon did not save current project properties');
      assert(!doc.getElementById('engineering-library-dialog').open,'Direct save unnecessarily opened library');
      fill('material-youngs','234');click('#save-material-library-button');
      catalog=new api.MaterialCatalog(win.localStorage);
      assert(catalog.get(custom.id).material.youngsModulusPa===app.document.material.youngsModulusPa,'Save did not update same custom library entry after editing');
      assert(catalog.list().filter(function(e){return e.material.name==='Project custom';}).length===1,'Save duplicated the entry');
      click('#edit-material-library-button');editor=doc.querySelector('[data-engineering-record-editor]');
      assert(editor && editor.elements.name.value==='Project custom' && !editor.elements.name.readOnly,'Edit icon did not open the entry to edit');
      var actions=editor.querySelector('.engineering-record-editor-actions');
      assert(actions.firstElementChild.textContent==='Cancel' && actions.lastElementChild.textContent==='Save & Use','Library footer differs from Truss');
      assert(actions.lastElementChild.classList.contains('ui-button-primary'),'Save & Use lacks accent style');
      assert(doc.getElementById('engineering-library-use').classList.contains('ui-button-primary') && doc.getElementById('engineering-library-delete').dataset.actionIntent==='danger','Library action styles differ from setup');
      doc.getElementById('engineering-library-dialog').close();
      fill('material-catalog-select','factory.material.polymer.nylon');click('#save-material-library-button');
      catalog=new api.MaterialCatalog(win.localStorage);
      var copied=catalog.get(doc.getElementById('material-catalog-select').value);
      assert(copied.layer==='user' && copied.material.youngsModulusPa===493e6 && copied.metadata.fieldProvenance.youngsModulusPa,'Built-in save did not make an exact custom copy with sources');
      assert(catalog.get('factory.material.polymer.nylon').material.name==='Nylon','Saving changed built-in record');
      fill('settings-unit-system','si');
      fill('material-poisson','0.31');click('#save-material-library-button');
      copied=new api.MaterialCatalog(win.localStorage).get(copied.id);
      assert(copied.material.youngsModulusPa===493e6 && copied.metadata.fieldProvenance.youngsModulusPa && !copied.metadata.fieldProvenance.poissonsRatio,'Inline save changed untouched values/sources or retained an edited source');
      var select=doc.getElementById('material-catalog-select'),save=doc.getElementById('save-material-library-button'),edit=doc.getElementById('edit-material-library-button');
      assert(select.parentElement===save.parentElement && save.nextElementSibling===edit,'Material actions are not beside the dropdown');
      assert(!doc.getElementById('open-material-library') && !doc.getElementById('replace-saved-material-button'),'Old library buttons remain');
      doc.getElementById('material-youngs').value='0.6';
      fill('settings-unit-system','uscs');fill('material-youngs','0.493');
      near(app.document.material.youngsModulusPa,api.preferredToSI('youngsModulusPa',0.493));
      win.localStorage.removeItem(api.MATERIAL_CATALOG_STORAGE_KEY);
      win.localStorage.removeItem('spjutsim-fea.unit-preferences');
      document.getElementById('test-status').textContent='Passed';
    }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;}
  });
}());
