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
      click('[data-setup-kind="material"] [data-setup-row-trigger]');click('#open-material-library');
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
      click('#save-material-library-button');editor=doc.querySelector('[data-engineering-record-editor]');
      assert(editor.elements.name.value==='Project custom' && editor.elements.youngsModulusPa.value==='123','Add to library did not seed project properties');
      doc.getElementById('engineering-library-dialog').close();
      win.localStorage.removeItem(api.MATERIAL_CATALOG_STORAGE_KEY);
      win.localStorage.removeItem('spjutsim-fea.unit-preferences');
      document.getElementById('test-status').textContent='Passed';
    }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;}
  });
}());
