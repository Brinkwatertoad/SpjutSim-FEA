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
      fill('load-magnitude','1000');var revision=app.document.analysisRevision;
      fill('load-force-unit','kN');near(Number(doc.getElementById('load-magnitude').value),1);
      assert(doc.getElementById('load-vector-unit').value==='kN','Force dropdowns are not synchronized');
      assert(app.document.analysisRevision===revision,'Unit change invalidated engineering state');
      click('#load-form button[type="submit"]');near(app.document.loads[0].magnitudeN,1000);
      click('[data-setup-kind="load"][data-item-id="'+app.document.loads[0].id+'"] [data-setup-row-trigger]');near(Number(doc.getElementById('load-magnitude').value),1);
      fill('load-force-mode','components');fill('load-fx','-2');fill('load-fy','3');fill('load-fz','0.5');
      fill('load-vector-unit','lbf');near(Number(doc.getElementById('load-fx').value),-2000/4.4482216152605);
      click('#load-form button[type="submit"]');near(app.document.loads[0].forceN[0],-2000);near(app.document.loads[0].forceN[1],3000);near(app.document.loads[0].forceN[2],500);
      app.replaceSelectedFaces([app.document.geometry.faceIds[1]]);click('#setup-add-load-button');fill('load-type','pressure');fill('load-pressure','2');fill('load-pressure-unit','psi');near(Number(doc.getElementById('load-pressure').value),2e6/6894.757293168361);
      fill('load-pressure-unit','ksi');fill('load-pressure-unit','Pa');near(Number(doc.getElementById('load-pressure').value),2e6);
      fill('load-pressure','');fill('load-pressure-unit','MPa');assert(doc.getElementById('load-pressure').value==='','Blank became zero');
      fill('load-pressure','-3');fill('load-pressure-unit','psi');near(author.readLoad().pressurePa,-3e6);
      click('#load-form button[type="submit"]');near(app.document.loads[1].pressurePa,-3e6);
      click('[data-setup-kind="load"][data-item-id="'+app.document.loads[1].id+'"] [data-setup-row-trigger]');near(Number(doc.getElementById('load-pressure').value),-3e6/6894.757293168361);
      var saved=JSON.parse(win.localStorage.getItem('spjutsim-fea.unit-preferences')).units;assert(saved.forceN==='lbf'&&saved.pressurePa==='psi','Preferences not persisted');
      var fresh=new api.UnitPreferences(win.localStorage);assert(fresh.units.forceN==='lbf'&&fresh.units.pressurePa==='psi','Preferences not loaded');
      var previous=doc.getElementById('load-fx').value;author.changeLoadUnit('forceN','psi');assert(doc.getElementById('load-fx').value===previous&&author.loadUnits.forceN==='lbf','Rejected change partially converted');
      var reloaded=document.createElement('iframe');reloaded.src='../../web/index.html';document.body.append(reloaded);
      await wait(function(){return reloaded.contentDocument && reloaded.contentDocument.getElementById('app-status') && reloaded.contentDocument.getElementById('app-status').textContent==='Local runtime ready';});
      assert(reloaded.contentDocument.getElementById('load-force-unit').value==='lbf' && reloaded.contentDocument.getElementById('load-pressure-unit').value==='psi','App reload ignored preferences');
      near(Number(reloaded.contentDocument.getElementById('load-magnitude').value),1/4.4482216152605);
      reloaded.remove();
      win.localStorage.removeItem('spjutsim-fea.unit-preferences');
      document.getElementById('test-status').textContent='Passed';
    }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;}
  });
}());
