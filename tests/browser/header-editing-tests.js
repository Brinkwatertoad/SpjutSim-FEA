(function () {
  'use strict';
  var frame = document.getElementById('application-frame');
  function check(ok, message) { if (!ok) { throw Error(message); } }
  function wait(test) { return new Promise(function(resolve,reject) {
    var start=performance.now(); function poll() {
      if(test())return resolve(); if(performance.now()-start>60000)return reject(Error('Workflow timeout'));
      setTimeout(poll,25);
    } poll();
  }); }
  frame.addEventListener('load', async function () {
    var win=frame.contentWindow, doc=win.document, api=win.SpjutsimFEA, app;
    function click(selector) { var node=doc.querySelector(selector);check(node,'Missing '+selector);node.click(); }
    function fill(id,value) { var input=doc.getElementById(id);input.value=value;
      input.dispatchEvent(new win.Event('input',{bubbles:true}));input.dispatchEvent(new win.Event('change',{bubbles:true})); }
    function key(keyName,target) { (target||doc).dispatchEvent(new win.KeyboardEvent('keydown',{key:keyName,bubbles:true,cancelable:true})); }
    function loadRow(id) { return '[data-setup-kind="load"][data-item-id="'+id+'"]'; }
    try {
      await wait(function(){return doc.getElementById('app-status').textContent==='Local runtime ready';});
      var notify=api.AppController.prototype.notify;
      api.AppController.prototype.notify=function(){app=this;return notify.apply(this,arguments);};
      click('[data-setup-kind="material"] [data-setup-row-trigger]');fill('material-catalog-select','factory.material.polymer.pla');
      check(!app.document.geometry && !app.document.material,'Material preview before import committed early');
      check(doc.getElementById('import-step-button').disabled,'CAD import allowed during unapplied material edit');
      click('[data-setup-kind="model"] [data-setup-row-trigger]');check(app.document.assignmentDraft.kind==='material' && doc.activeElement===doc.querySelector('[data-setup-done]'),'Empty Model bypassed the pending-edit guidance');
      click('[data-setup-cancel]');
      var bytes=await(await fetch('../fixtures/generated-unit-cube-m.step')).arrayBuffer(),transfer=new win.DataTransfer();
      transfer.items.add(new win.File([bytes],'cube.step'));doc.getElementById('import-step-input').files=transfer.files;
      doc.getElementById('import-step-input').dispatchEvent(new win.Event('change',{bubbles:true}));
      await wait(function(){return app && app.document.geometryImport.status==='succeeded';});
      var faces=app.document.geometry.faceIds, revision=app.document.analysisRevision, history=app.history.cursor;
      app.replaceSelectedFaces([faces[0]]);click('#setup-add-load-button');fill('load-force-mode','components');fill('load-fx','12');fill('load-fy','4');
      check(app.document.loads.length===0,'Field changes committed before Done');
      check(app.document.analysisRevision===revision && app.history.cursor===history,'Preview changed revision/history');
      check(app.document.assignmentDraft.definition.forceN[0]===12,'Live force preview missing');
      check(api.buildAnalysisGlyphDescriptors(app.document).some(function(g){return g.preview;}),'Draft glyphs missing');
      check(doc.querySelectorAll('[data-setup-done]').length===1,'There must be one confirmation location');
      var minimumActionSize=win.matchMedia('(pointer:coarse)').matches ? 44 : 30;
      ['[data-setup-done]','[data-setup-cancel]'].forEach(function(selector){
        var bounds=doc.querySelector(selector).getBoundingClientRect();
        check(bounds.width>=minimumActionSize && bounds.height>=minimumActionSize,'Editor action lost the shared pointer/touch target size');
      });
      check(doc.getElementById('solve-button').disabled,'Pending draft did not block solve');
      click('#setup-add-support-button');check(app.document.assignmentDraft.kind==='load','Switching silently discarded the draft');
      app.toggleDraftFace(faces[1]);check(app.document.loads.length===0,'Face picking committed before Done');
      click('[data-setup-done]');
      check(app.document.loads.length===1 && app.document.loads[0].forceN[0]===12 && app.document.loads[0].forceN[1]===4,'Done did not commit all values');
      check(app.document.loads[0].faceIds.length===2,'Done lost draft faces');
      check(app.history.cursor===history+1 && app.document.analysisRevision===revision+1,'Done was not one engineering edit');
      check(!app.document.assignmentDraft && !doc.querySelector('[data-setup-done]'),'Done did not collapse editor');
      var id=app.document.loads[0].id;check(doc.activeElement===doc.querySelector(loadRow(id)+' [data-setup-row-trigger]'),'Done lost logical keyboard focus');revision=app.document.analysisRevision;history=app.history.cursor;
      click(loadRow(id)+' [data-setup-row-trigger]');fill('load-fx','');click('[data-setup-done]');
      check(app.document.assignmentDraft && doc.getElementById('load-status').classList.contains('fea-error'),'Invalid Done closed editor or hid error');
      var headerError=doc.querySelector('[data-setup-edit-error]');check(headerError && !headerError.hidden && headerError.textContent.includes('FX force'),'Pinned actions have no actionable validation error');
      click('[data-setup-cancel]');check(app.document.loads[0].forceN[0]===12 && app.history.cursor===history,'Cancel changed committed data');
      check(app.document.analysisRevision===revision,'Cancel invalidated analysis');
      check(doc.activeElement===doc.querySelector(loadRow(id)+' [data-setup-row-trigger]'),'Cancel lost logical keyboard focus');
      check(app.document.selectedFaceIds.length===0,'Cancel left assignment faces to seed another edit');
      click(loadRow(id)+' [data-setup-row-trigger]');check(doc.getElementById('load-fx').getAttribute('aria-invalid')!=='true','Reopened valid field retained invalid accessibility state');key('Enter',doc.getElementById('load-fx'));
      check(!app.document.assignmentDraft && app.history.cursor===history && app.document.analysisRevision===revision,'Unchanged Done changed history/revision');
      click(loadRow(id)+' [data-setup-row-trigger]');fill('load-fx','24');key('Escape');
      check(app.document.loads[0].forceN[0]===12 && !app.document.assignmentDraft,'Escape did not discard preview');
      click(loadRow(id)+' [data-setup-duplicate]');app.toggleDraftFace(faces[2]);app.toggleDraftFace(faces[3]);
      check(app.document.loads.length===1,'Duplicate face picks committed early');click('[data-setup-done]');
      check(app.document.loads.length===2 && app.document.loads[1].faceIds.length===2,'Duplicate Done failed');
      app.undoEngineeringEdit();check(app.document.loads.length===1,'Undo did not reverse the whole duplicate');
      click('[data-setup-kind="material"] [data-setup-row-trigger]');fill('material-catalog-select','factory.material.polymer.pla');
      check(app.document.material===null,'Catalog choice committed before Done');click('[data-setup-cancel]');check(app.document.material===null,'Cancel applied material');
      click('[data-setup-kind="material"] [data-setup-row-trigger]');fill('material-catalog-select','factory.material.polymer.pla');click('[data-setup-done]');
      check(app.document.material.name==='PLA' && !app.document.assignmentDraft,'Material Done failed');
      click('#setup-gravity-button');fill('gravity-z','-5');check(!app.document.gravity.enabled,'Gravity committed before Done');click('[data-setup-cancel]');
      check(!app.document.gravity.enabled,'Cancel enabled gravity');
      click('#setup-gravity-button');fill('gravity-z','-5');click('[data-setup-done]');check(app.document.gravity.enabled && app.document.gravity.accelerationMS2[2]===-5,'Gravity Done failed');
      click('#setup-gravity-button');
      doc.getElementById('gravity-visible').checked=false;doc.getElementById('gravity-visible').dispatchEvent(new win.Event('change',{bubbles:true}));
      click('[data-setup-cancel]');check(app.document.viewportPresentation.showGravity===false,'Cancel reversed an immediate display preference');
      click('[data-setup-kind="material"] [data-setup-row-trigger]');fill('material-catalog-select','custom');fill('material-poisson','-0.2');
      check(doc.getElementById('material-status').classList.contains('fea-warning'),'Valid unusual material lost its warning');click('[data-setup-cancel]');
      // A long load editor must retain its sole actions while its fields scroll.
      click(loadRow(id)+' [data-setup-row-trigger]');fill('load-type','offset-force');
      var pane=doc.querySelector('.fea-tools'), bar=doc.querySelector('[data-setup-edit-actions]');
      pane.scrollTop=0;var target=bar.getBoundingClientRect().top-pane.getBoundingClientRect().top+160;
      pane.scrollTop=target;await new Promise(function(resolve){win.requestAnimationFrame(resolve);});
      check(bar.getBoundingClientRect().top>=pane.getBoundingClientRect().top-1,'Action bar scrolled out of view');
      check(bar.getBoundingClientRect().bottom<pane.getBoundingClientRect().bottom,'Action bar is below scroll viewport');
      click('[data-setup-cancel]');
      document.getElementById('test-status').textContent='Passed pinned transaction editors';
    } catch(error) { document.getElementById('test-status').textContent='Failed: '+error.message; }
  });
}());
