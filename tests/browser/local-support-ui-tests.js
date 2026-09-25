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
  var face=app.document.geometry.faceIds[0];click('setup-add-support-button');fill('support-type','sliding');
  app.toggleDraftFace(face);
  check(app.document.assignmentDraft.validation.valid,'sliding draft invalid');
  check(!doc.getElementById('support-planar-help').hidden,'missing free-direction/symmetry explanation');

   check(app.document.boundaryConditions.length===1&&app.document.boundaryConditions[0].preset==='sliding','sliding did not commit');
   app.replaceSelectedFaces([face]);click('setup-add-load-button');fill('load-type','total-force');fill('load-force-mode','components');fill('load-frame-kind','manual');
   fill('load-frame-rotation-axis','z');click('load-frame-plus-90');fill('load-fx','10');fill('load-fy','0');fill('load-fz','0');
   fill('load-frame-origin-x','0.0254');
   fill('settings-unit-system','uscs');
   check(Math.abs(Number(doc.getElementById('load-frame-origin-x').value)-1)<1e-10,'frame origin did not convert to inches');
   fill('settings-unit-system','si');
   check(app.document.assignmentDraft.validation.valid,'manual frame draft invalid');
   check(doc.getElementById('load-frame-preview').textContent.includes('[0, 10, 0]'),'global force preview missing');
   check(app.document.loads[0].frame.ownership==='global','manual frame not saved');
   check(Math.abs(app.document.loads[0].frame.originM[0]-.0254)<1e-12,'frame origin lost SI value');
   var force=api.assignmentGlobalForce(app.document.loads[0],app.document.geometry);check(force[1]===10,'manual global direction wrong');
   app.rotateGeometryAroundGlobalAxis('x',30);check(api.assignmentGlobalForce(app.document.loads[0],app.document.geometry)[1]===10,'manual frame followed CAD');
   click('setup-add-load-button');fill('load-force-mode','components');fill('load-frame-kind','manual');fill('load-frame-origin-x','');
   check(!app.document.assignmentDraft.validation.valid,'nonunit frame accepted');doc.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));check(app.document.loads.length===1,'cancel changed loads');
   var replacementFiles=new win.DataTransfer();replacementFiles.items.add(new win.File([bytes],'replacement.step'));
   doc.getElementById('import-step-input').files=replacementFiles.files;
   doc.getElementById('import-step-input').dispatchEvent(new win.Event('change',{bubbles:true}));
   await waitFor(function(){return !doc.getElementById('replacement-migration-backdrop').hidden;});
   check(doc.getElementById('replacement-item-description').textContent.includes('Local CAD frame'),'replacement hides CAD frame ownership');
   click('replacement-migration-cancel');check(app.document.loads.length===1&&app.document.boundaryConditions.length===1,'replacement cancel changed local assignments');
   document.getElementById('test-status').textContent='Passed local support and force editors';
 }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;throw e;}
 });
}());
