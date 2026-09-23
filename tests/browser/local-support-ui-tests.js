(function(){'use strict';var iframe=document.getElementById('application-frame');
 function check(ok,msg){if(!ok)throw Error(msg);}
 function waitFor(fn){return new Promise(function(resolve,reject){var start=performance.now();function poll(){if(fn())return resolve();if(performance.now()-start>60000)return reject(Error('Workflow timeout'));setTimeout(poll,20);}poll();});}
 iframe.addEventListener('load',async function(){var win=iframe.contentWindow,doc=win.document,api=win.SpjutsimFEA,app;
 function fill(id,value){var e=doc.getElementById(id);e.value=value;e.dispatchEvent(new win.Event('input',{bubbles:true}));e.dispatchEvent(new win.Event('change',{bubbles:true}));}
 function click(id){var e=doc.getElementById(id);check(e&&!e.disabled,'Unavailable '+id);e.click();}
 try{
  await waitFor(function(){return doc.getElementById('app-status').textContent==='Local runtime ready';});
  var notify=api.AppController.prototype.notify;api.AppController.prototype.notify=function(){app=this;return notify.apply(this,arguments);};
  var bytes=await(await fetch('../fixtures/generated-unit-cube-m.step')).arrayBuffer(),transfer=new win.DataTransfer();transfer.items.add(new win.File([bytes],'cube.step'));
  doc.getElementById('import-step-input').files=transfer.files;doc.getElementById('import-step-input').dispatchEvent(new win.Event('change',{bubbles:true}));
  await waitFor(function(){return app&&app.document.geometryImport.status==='succeeded';});
  app.rotateGeometryAroundGlobalAxis('z',37);
  var face=app.document.geometry.faceIds[0];app.replaceSelectedFaces([face]);click('setup-add-support-button');fill('support-type','sliding');
  check(app.document.assignmentDraft.validation.valid,'sliding draft invalid');
  check(!doc.getElementById('support-planar-help').hidden,'missing free-direction/symmetry explanation');
   doc.querySelector('#support-form button[type="submit"]').click();
   check(app.document.boundaryConditions.length===1&&app.document.boundaryConditions[0].preset==='sliding','sliding did not commit');
   app.replaceSelectedFaces([face]);click('setup-add-load-button');fill('load-type','total-force');fill('load-force-mode','components');fill('load-frame-kind','manual');
   fill('load-frame-axis-x','0, 1, 0');fill('load-frame-axis-y','-1, 0, 0');fill('load-fx','10');fill('load-fy','0');fill('load-fz','0');
   check(app.document.assignmentDraft.validation.valid,'manual frame draft invalid');
   check(doc.getElementById('load-frame-preview').textContent.includes('[0, 10, 0]'),'global force preview missing');
   doc.querySelector('#load-form button[type="submit"]').click();check(app.document.loads[0].frame.ownership==='global','manual frame not saved');
   var force=api.assignmentGlobalForce(app.document.loads[0],app.document.geometry);check(force[1]===10,'manual global direction wrong');
   app.rotateGeometryAroundGlobalAxis('x',30);check(api.assignmentGlobalForce(app.document.loads[0],app.document.geometry)[1]===10,'manual frame followed CAD');
   click('setup-add-load-button');fill('load-force-mode','components');fill('load-frame-kind','manual');fill('load-frame-axis-x','1, 1, 0');
   check(!app.document.assignmentDraft.validation.valid,'nonunit frame accepted');click('cancel-load-edit');check(app.document.loads.length===1,'cancel changed loads');
   document.getElementById('test-status').textContent='Passed local support and force editors';
 }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;throw e;}
 });
}());
