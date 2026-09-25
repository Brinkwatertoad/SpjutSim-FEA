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
      app.replaceSelectedFaces([app.document.geometry.faceIds[0]]);click('#setup-add-load-button');
      assert(app.document.loads.length===0,'Opening created a load');
      fill('load-force-mode','components');
      assert(app.document.loads.length===1,'Choosing components did not create a load');
      var id=app.document.loads[0].id;
      var input=doc.getElementById('load-fx'), before=app.history.cursor;
      input.value='12';input.dispatchEvent(new win.Event('input',{bubbles:true}));
      near(app.document.loads[0].forceN[0],0);
      input.dispatchEvent(new win.Event('change',{bubbles:true}));near(app.document.loads[0].forceN[0],12);
      assert(app.history.cursor===before+1,'Value edit was not one undo step');
      fill('load-fx','');near(app.document.loads[0].forceN[0],12);
      assert(doc.getElementById('load-status').classList.contains('fea-error'),'Invalid input has no visible error');
      app.undoEngineeringEdit();near(app.document.loads[0].forceN[0],0);
      app.redoEngineeringEdit();near(app.document.loads[0].forceN[0],12);
      click('[data-setup-kind="load"][data-item-id="'+id+'"] [data-setup-delete]');
      assert(app.document.loads.length===0,'Compact row delete failed');app.undoEngineeringEdit();
      assert(app.document.loads[0].id===id,'Undo delete lost identity');
      click('[data-setup-kind="material"] [data-setup-row-trigger]');
      fill('material-catalog-select','factory.material.polymer.pla');
      assert(app.document.material.name==='PLA','Material selection did not apply');
      assert(!doc.querySelector('#material-form button[type="submit"]'),'Apply remains');
      assert(!doc.getElementById('material-catalog-details').textContent.includes('Printed properties'),'Material caveats clutter setup');
      win.localStorage.removeItem('spjutsim-fea.unit-preferences');
      document.getElementById('test-status').textContent='Passed';
    }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;}
  });
}());
