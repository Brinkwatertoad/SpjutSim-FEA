(async function () {
  function assert(value,message){if(!value)throw Error(message);}
  async function waitFor(test){var start=performance.now();while(!test()){if(performance.now()-start>90000)throw Error('Workflow timeout');await new Promise(r=>setTimeout(r,30));}}
  var frame=document.getElementById('application-frame');
  async function ready(){await waitFor(()=>frame.contentWindow && frame.contentDocument.getElementById('wasm-status') && frame.contentDocument.getElementById('wasm-status').textContent.startsWith('WebAssembly available'));return frame.contentWindow;}
  async function reload(){var loaded=new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));frame.contentWindow.location.reload();await loaded;return ready();}
  try{
    var win=await ready(),doc=win.document;
    assert(doc.querySelector('[data-project-new]'),'File New is missing');
    assert(!doc.getElementById('setup-next-step'),'Obtrusive setup banner remains');
    assert(doc.getElementById('load-example').closest('details')===null,'Cube example is hidden behind another control');
    var app,viewport,notify=win.SpjutsimFEA.AppController.prototype.notify,render=win.SpjutsimFEA.ViewportController.prototype.render;
    win.SpjutsimFEA.AppController.prototype.notify=function(){app=this;return notify.apply(this,arguments);};
    win.SpjutsimFEA.ViewportController.prototype.render=function(){viewport=this;return render.apply(this,arguments);};
    doc.getElementById('load-example').click();
    await waitFor(()=>doc.querySelector('[data-setup-kind="load"][data-item-id]:not([data-item-id="new"])'));
    await waitFor(()=>!doc.getElementById('setup-guide').hidden);
    assert(doc.getElementById('setup-guide-title').textContent.includes('Mesh'),'Prepared example did not start at Mesh and solve');
    assert(doc.querySelectorAll('[data-setup-kind="support"][data-item-id]:not([data-item-id="new"])').length===3,'Example lacks analytical supports');
    assert(doc.querySelector('#report-options-button svg'),'Report options still uses a text glyph');
    assert(!viewport.scene.getObjectByName('reference-solid'),'Placeholder cube remains in the scene');
    var meshOptions=doc.querySelector('[data-mesh-options]');assert(meshOptions,'Mesh options not directly accessible');var iconRect=meshOptions.getBoundingClientRect(),rowRect=meshOptions.parentElement.getBoundingClientRect();assert(iconRect.left>=rowRect.left && iconRect.right<=rowRect.right && iconRect.top>=rowRect.top,'Mesh options icon is outside its row');meshOptions.click();
    assert(doc.getElementById('mesh-options-dialog').open,'Mesh options did not open directly');doc.getElementById('mesh-options-dialog').close();
    doc.getElementById('solve-button').click();await waitFor(()=>app.document.results || app.document.solveExecution.status==='failed');
    assert(app.document.results && Math.abs(app.document.results.extrema.rawVonMisesMax.valuePa-1000)<0.2,'Prepared example missed analytical 1 kPa stress');
    assert(Math.abs(app.document.results.equilibrium.totalReactionN[0]+1000)<0.001,'Prepared example missed force balance');
    var saveKey=new win.KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true});win.dispatchEvent(saveKey);
    assert(saveKey.defaultPrevented && doc.getElementById('save-project-dialog').open,'Ctrl+S did not open Save');doc.getElementById('save-project-dialog').close('cancel');await new Promise(r=>setTimeout(r,0));
    var clicks=0;doc.getElementById('project-file-input').click=function(){clicks++;};
    win.dispatchEvent(new win.KeyboardEvent('keydown',{key:'o',metaKey:true,bubbles:true,cancelable:true}));assert(clicks===1,'Cmd+O did not open file picker');
    var unload=new win.Event('beforeunload',{cancelable:true});win.dispatchEvent(unload);assert(!unload.defaultPrevented,'Unload warning remains');
    doc.getElementById('setup-guide-dismiss').click();assert(doc.getElementById('setup-guide').hidden,'Guide does not dismiss');
    var store=new win.SpjutsimFEA.ProjectRecoveryStore();
    for(var n=0;n<100;n++){var rows=await store.list();if(rows.some(r=>r.manifest.setup.loads.length===1))break;await new Promise(r=>setTimeout(r,30));}
    assert(rows.some(r=>r.manifest.setup.loads.length===1),'Complete example was not recovered');store.close();
    win=await reload();doc=win.document;
    assert(doc.querySelector('[data-setup-kind="load"][data-item-id]:not([data-item-id="new"])'),'Reload did not automatically restore setup');
    assert(doc.getElementById('setup-guide').hidden,'Recovery unexpectedly opened guide');
    store=new win.SpjutsimFEA.ProjectRecoveryStore();assert((await store.list()).length===1,'Reload accumulated another recovery record');store.close();
    doc.querySelector('[data-ui-menu-action="walkthrough"]').click();assert(!doc.getElementById('setup-guide').hidden,'Help did not reenable guide');doc.getElementById('setup-guide-dismiss').click();
    var fileGroup=doc.querySelector('[data-project-new]').closest('[data-ui-menu-group]');fileGroup.querySelector('[data-ui-menu-button]').click();
    doc.querySelector('[data-project-new]').click();assert(fileGroup.dataset.open==='false','New left the File menu open');await waitFor(()=>!doc.getElementById('empty-workflow').hidden);
    assert(!doc.querySelector('[data-setup-kind="load"][data-item-id]:not([data-item-id="new"])'),'New retained loads');
    win=await reload();doc=win.document;
    assert(!doc.getElementById('empty-workflow').hidden,'New was undone by automatic recovery');
    assert(doc.getElementById('setup-guide').hidden,'New reset remembered dismissal');
    document.getElementById('test-status').textContent='Passed';
  }catch(error){document.getElementById('test-status').textContent='Failed: '+error.message;console.error(error);}
}());
