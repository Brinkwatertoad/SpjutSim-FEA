(function(){'use strict';var iframe=document.getElementById('application-frame');
 function check(ok,m){if(!ok)throw Error(m);}
 function waitFor(fn){return new Promise(function(resolve,reject){var start=performance.now();function poll(){if(fn())return resolve();if(performance.now()-start>60000)return reject(Error('Workflow timeout'));setTimeout(poll,20);}poll();});}
 iframe.addEventListener('load',async function(){var win=iframe.contentWindow,doc=win.document,api=win.SpjutsimFEA,app;
 function fill(id,value){var e=doc.getElementById(id);check(e,'Missing '+id);e.value=value;e.dispatchEvent(new win.Event('input',{bubbles:true}));e.dispatchEvent(new win.Event('change',{bubbles:true}));}
 try{
  await waitFor(function(){return doc.getElementById('app-status').textContent==='Local runtime ready';});
  check(Array.from(doc.getElementById('load-type').options).some(function(o){return o.value==='moment';}),'moment editor unavailable');
  var notify=api.AppController.prototype.notify;api.AppController.prototype.notify=function(){app=this;return notify.apply(this,arguments);};
  var bytes=await(await fetch('../fixtures/generated-unit-cube-m.step')).arrayBuffer(),transfer=new win.DataTransfer();transfer.items.add(new win.File([bytes],'cube.step'));doc.getElementById('import-step-input').files=transfer.files;doc.getElementById('import-step-input').dispatchEvent(new win.Event('change',{bubbles:true}));await waitFor(function(){return app&&app.document.geometryImport.status==='succeeded';});
  doc.getElementById('setup-add-load-button').click();fill('load-type','moment');app.toggleDraftFace(app.document.geometry.faceIds[0]);fill('load-mx','0');fill('load-my','0');fill('load-mz','10');
  doc.querySelector('[data-setup-done]').click();
  check(app.document.loads.length===1 && app.document.loads[0].momentNm[2]===10,'moment did not commit');
  check(doc.getElementById('force-fields').hidden && !doc.getElementById('moment-fields').hidden,'moment shows force fields');
  check(doc.getElementById('surface-load-help').textContent.includes('traction'),'load idealization absent');
  fill('settings-unit-system','uscs');check(Math.abs(Number(doc.getElementById('load-mz').value)-88.5074579)<1e-5,'moment unit conversion');check(app.document.loads[0].momentNm[2]===10,'units changed engineering moment');fill('settings-unit-system','si');
  doc.querySelector('[data-setup-kind="load"] [data-setup-row-trigger]').click();fill('load-type','offset-force');fill('load-fx','10');fill('load-fy','0');fill('load-fz','0');fill('load-application-y','2');
  doc.querySelector('[data-setup-done]').click();
  check(app.document.loads[0].type==='offset-force' && app.document.loads[0].applicationPointM[1]===2,'offset editing');
  doc.querySelector('[data-setup-kind="load"] [data-setup-row-trigger]').click();fill('load-application-y','');check(!app.document.assignmentDraft.validation.valid && app.document.loads[0].applicationPointM[1]===2,'invalid point overwrote load');doc.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  app.undoEngineeringEdit();check(app.document.loads[0].type==='moment' && app.document.loads[0].momentNm[2]===10,'offset Undo');
  document.getElementById('test-status').textContent='Passed surface load editors';
 }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;throw e;}
 });
}());
