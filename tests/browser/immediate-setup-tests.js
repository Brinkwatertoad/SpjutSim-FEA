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
      input.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));near(app.document.loads[0].forceN[0],12);
      assert(app.history.cursor===before+1,'Value edit was not one undo step');
      input.dispatchEvent(new win.Event('change',{bubbles:true}));assert(app.history.cursor===before+1,'Blur after Enter duplicated history');
      assert(!api.hasPendingAssignment(app.document),'Clean editor blocks save/solve');
      fill('load-fx','');near(app.document.loads[0].forceN[0],12);
      assert(doc.getElementById('load-status').classList.contains('fea-error'),'Invalid input has no visible error');
      app.undoEngineeringEdit();near(app.document.loads[0].forceN[0],0);
      app.redoEngineeringEdit();near(app.document.loads[0].forceN[0],12);
      click('[data-setup-kind="load"][data-item-id="'+id+'"] [data-setup-delete]');
      assert(app.document.loads.length===0,'Compact row delete failed');app.undoEngineeringEdit();
      assert(app.document.loads[0].id===id,'Undo delete lost identity');
      var faces=app.document.geometry.faceIds;
      function row(kind,itemId){return '[data-setup-kind="'+kind+'"][data-item-id="'+itemId+'"]';}
      click(row('load',id)+' [data-setup-row-trigger]');
      click('#setup-add-support-button');
      assert(app.document.assignmentDraft.faceIds.length===0,'Switching editor reused load faces');
      app.toggleDraftFace(faces[1]);
      var supportId=app.document.boundaryConditions[0].id;
      click(row('support',supportId)+' [data-setup-row-trigger]');
      assert(app.document.selectedFaceIds.length===0,'Closing editor left selected faces');
      click(row('support',supportId)+' [data-setup-row-trigger]');
      click('#setup-add-load-button');
      fill('load-force-mode','components');
      assert(app.document.assignmentDraft.faceIds.length===0 && app.document.loads.length===1,'Support faces accidentally received a new load');
      doc.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      app.replaceSelectedFaces([faces[2]]);click('#setup-add-load-button');
      assert(app.document.assignmentDraft.faceIds[0]===faces[2],'Deliberate outside selection was lost');
      doc.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      click(row('load',id)+' [data-setup-include]');
      assert(app.document.loads[0].enabled===false,'Suppress did not change analysis state');
      assert(doc.querySelector(row('load',id)).classList.contains('is-suppressed'),'Collapsed row did not show suppression immediately');
      assert(doc.querySelector(row('load',id)+' [data-setup-include]').title.includes('Include'),'Suppression action did not update immediately');
      click(row('load',id)+' [data-setup-include]');
      assert(!doc.querySelector(row('load',id)).classList.contains('is-suppressed'),'Include left suppressed visual state');
      click(row('load',id)+' [data-setup-duplicate]');
      assert(app.document.assignmentDraft.faceIds.length===0 && app.document.loads.length===1,'Duplicate reused the source faces or committed early');
      assert(doc.getElementById('load-status').textContent.includes('Select new faces'),'Duplicate lacks a visible face-picking prompt');
      near(Number(doc.getElementById('load-fx').value),12);
      doc.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      assert(app.document.loads.length===1,'Cancelling an empty duplicate created a load');
      click(row('load',id)+' [data-setup-duplicate]');app.toggleDraftFace(faces[3]);
      assert(app.document.loads.length===2,'First duplicate face did not create one load');
      var duplicateId=app.document.loads[1].id;app.toggleDraftFace(faces[4]);
      assert(app.document.loads.length===2 && app.document.loads[1].id===duplicateId && app.document.loads[1].faceIds.length===2,'Additional duplicate faces made another load');
      assert(app.document.loads[0].faceIds.length===1 && app.document.loads[0].faceIds[0]===faces[0],'Duplication changed the original');
      near(app.document.loads[1].forceN[0],12);
      click('[data-setup-kind="material"] [data-setup-row-trigger]');
      fill('material-catalog-select','factory.material.polymer.pla');
      assert(app.document.material.name==='PLA','Material selection did not apply');
      assert(!doc.querySelector('#material-form button[type="submit"]'),'Apply remains');
      assert(!doc.getElementById('material-catalog-details').textContent.includes('Printed properties'),'Material caveats clutter setup');
      var info=doc.querySelector('[data-field-info="material-poisson-info"]');
      assert(info && info.parentElement.querySelector('label[for="material-poisson"]'),'Poisson info is not in the field heading');
      info.click();assert(info.getAttribute('aria-expanded')==='true' && !doc.getElementById('material-poisson-info').hidden,'Info did not disclose all field help');
      info.click();assert(doc.getElementById('material-poisson-info').hidden,'Info did not collapse');
      click(row('load',id)+' [data-setup-row-trigger]');
      assert(doc.getElementById('load-details').parentElement.id==='load-components-info','Component force information was not combined');
      fill('load-force-mode','normal');
      assert(doc.getElementById('load-details').parentElement.id==='load-normal-info','Normal force information was not combined');
      fill('load-type','pressure');
      assert(doc.getElementById('load-details').parentElement.id==='load-pressure-info','Pressure information was not combined');
      win.localStorage.removeItem('spjutsim-fea.unit-preferences');
      document.getElementById('test-status').textContent='Passed';
    }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;}
  });
}());
