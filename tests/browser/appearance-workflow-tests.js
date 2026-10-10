(function () {
  'use strict';
  var frame = document.getElementById('application-frame');
  function check(ok,message){if(!ok)throw Error(message);}
  async function wait(test,label){var start=performance.now();while(!test()){
    if(performance.now()-start>60000)throw Error('Appearance workflow timed out: '+(label || 'startup'));
    await new Promise(function(resolve){setTimeout(resolve,25);});
  }}
  frame.addEventListener('load',async function(){
    var win=frame.contentWindow,doc=win.document,app;
    function click(selector){var node=doc.querySelector(selector);check(node,'Missing '+selector);node.click();}
    function fill(selector,value){var input=doc.querySelector(selector);check(input,'Missing '+selector);input.value=value;
      input.dispatchEvent(new win.Event('input',{bubbles:true}));input.dispatchEvent(new win.Event('change',{bubbles:true}));}
    function select(id){fill('#color-scheme-select',id);}
    function role(label){return '.ui-color-role-row input[aria-label="'+label+'"]';}
    function overflowAction(id){click('.ui-overflow-menu-toggle');click('[data-overflow-action="'+id+'"]');}
    function importText(text){var transfer=new win.DataTransfer();transfer.items.add(new win.File([text],'test.spjutsim-color-scheme.json'));
      doc.getElementById('color-scheme-import-input').files=transfer.files;
      doc.getElementById('color-scheme-import-input').dispatchEvent(new win.Event('change',{bubbles:true}));}
    try {
      await wait(function(){return doc.getElementById('app-status').textContent==='Local runtime ready';});
      var api=win.SpjutsimFEA,notify=api.AppController.prototype.notify;
      api.AppController.prototype.notify=function(){app=this;return notify.apply(this,arguments);};
      var example=doc.querySelector('[data-ui-menu-action="example-cube"]'),group=example.closest('[data-ui-menu-group]');
      group.querySelector('[data-ui-menu-button]').click();example.click();
      await wait(function(){return app && app.document.projectMetadata && app.document.projectMetadata.name==='Cube example';},'cube');
      check(group.dataset.open==='false' && win.getComputedStyle(group.querySelector('.ui-menu-list')).display==='none',
        'Examples dropdown remained visible after loading the cube');
      app.document.meshGeneration.status='generating';app.notify('mesh-progress');
      var solve=doc.getElementById('solve-button'),cancel=doc.getElementById('cancel-solve-button');
      check(!cancel.hidden && cancel.dataset.actionIntent==='danger','Running operation lacks its danger Cancel');
      var solveBounds=solve.getBoundingClientRect(),cancelBounds=cancel.getBoundingClientRect();
      check(Math.abs(solveBounds.top-cancelBounds.top)<1 && cancelBounds.left-solveBounds.right>=0 && cancelBounds.left-solveBounds.right<=8,
        'Cancel is separated from Solve');
      check(win.getComputedStyle(cancel).color==='rgb(218, 30, 40)','Cancel does not use the active danger color');
      app.document.meshGeneration.status='idle';app.notify();
      var revision=app.document.analysisRevision,history=app.history.cursor,geometry=app.document.geometry;
      ['tet10','tet4'].forEach(function(elementType){
        var state=Object.assign({},app.document,{meshSettings:{preset:'normal',elementType:elementType},meshMetadata:null,
          meshGeneration:{status:'idle'}});
        var ui={controller:app,meshStatus:doc.getElementById('mesh-status')};
        function checkMeshText(){
          api.UIController.prototype.renderMesh.call(ui,state);
          var row=api.buildSetupInspectorRows(state).find(function(item){return item.kind==='mesh';});
          check(!ui.meshStatus.textContent.includes('Tet10') && !row.ariaLabel.includes('Tet10'),'Setup repeats the default Tet10 formulation');
          check(ui.meshStatus.textContent.includes('Tet4')===(elementType==='tet4') && row.ariaLabel.includes('Tet4')===(elementType==='tet4'),
            'Setup does not distinguish the optional Tet4 formulation');
        }
        checkMeshText();state.meshGeneration.status='generating';checkMeshText();
        state.meshGeneration.status='succeeded';state.meshMetadata={statistics:{elementCount:42,nodeCount:18},quality:{}};checkMeshText();
      });
      app.notify();
      click('[data-ui-menu-action="settings"]');click('#settings-tab-appearance');
      check(doc.getElementById('settings-tab-appearance').textContent==='Color scheme','Settings category is not named Color scheme');
      check(doc.querySelector('.ui-color-scheme-picker .ui-color-scheme-name'),'Shared scheme picker/rename control missing');
      function checkLayout(columns){
        var toolbar=doc.querySelector('.ui-color-scheme-toolbar'),bounds=toolbar.getBoundingClientRect();
        var actions=Array.from(toolbar.querySelectorAll('[data-color-scheme-action],.ui-overflow-menu-toggle'));
        var first=actions[0].getBoundingClientRect();
        actions.forEach(function(action){var rect=action.getBoundingClientRect();
          check(Math.abs(rect.top-first.top)<2 && rect.right<=bounds.right+1,'Scheme actions wrap or overflow the toolbar');});
        Array.from(doc.querySelectorAll('.ui-color-role-grid')).forEach(function(grid){
          if(!grid.closest('details:not([open])') && grid.getClientRects().length){
            var actual=win.getComputedStyle(grid).gridTemplateColumns;
            check(actual.split(' ').length===(columns||2),'Color roles use the wrong column count: '+actual+' at '+win.innerWidth+'px');}});
        var panel=doc.getElementById('settings-panel-appearance');
        check(panel.scrollWidth<=panel.clientWidth+1,'Color editor overflows horizontally');
      }
      checkLayout();
      frame.style.width='720px';await wait(function(){return win.innerWidth===720;},'720px resize');checkLayout();
      frame.style.width='360px';await wait(function(){return win.innerWidth===360;},'360px resize');checkLayout(1);
      frame.style.width='1440px';await wait(function(){return win.innerWidth===1440;},'desktop resize');
      check(doc.querySelector('.fea-color-preview-interface strong').textContent==='Interface demo','Preview title depends on the active scheme');
      click('#color-demo-modal-button');
      var demo=doc.getElementById('color-demo-dialog');
      check(demo.open,'Interface demo did not open its modal picker');
      click('[data-custom-select-button="color-demo-picker"]');
      click('[data-custom-select-group="color-demo-picker"] [data-custom-select-option="second"]');
      check(doc.getElementById('color-demo-picker').value==='second','Demo picker did not select an option');
      click('#color-demo-close-button');
      await wait(function(){return !demo.open && doc.activeElement.id==='color-demo-modal-button';},'demo close and focus');
      check(!demo.open && doc.activeElement.id==='color-demo-modal-button' && !doc.getElementById('settings-backdrop').hidden,
        'Closing the demo lost focus or closed Settings');
      select('light');fill(role('Accent'),'#336699');fill(role('Load'),'#cc7733');
      fill('.ui-color-scheme-name','Personal gray');click('[data-color-scheme-action="duplicate"]');
      var copyId=doc.getElementById('color-scheme-select').value;
      check(copyId!=='light' && doc.documentElement.style.getPropertyValue('--ui-color-accent')==='#336699',
        'Duplicate did not preserve edited colors');
      click('.ui-color-role-advanced > summary');fill(role('Border'),'#112233');
      checkLayout();
      var clear=doc.querySelector('[aria-label="Use derived Border"]');
      check(!clear.hidden,'Derived-role reset is unavailable after an override');clear.click();
      check(doc.documentElement.style.getPropertyValue('--ui-color-border')!=='#112233','Derived-role reset kept the override');
      fill(role('Accent'),'not a color');
      check(doc.getElementById('color-scheme-status').textContent.includes('six-digit') &&
        doc.documentElement.style.getPropertyValue('--ui-color-accent')==='#336699','Invalid color replaced valid appearance or failed silently');
      fill(role('Danger'),'#881122');
      check(win.getComputedStyle(cancel).color==='rgb(136, 17, 34)','Cancel did not follow edited danger color');
      var exportedBlob,createURL=win.URL.createObjectURL;
      win.URL.createObjectURL=function(blob){exportedBlob=blob;return createURL.call(this,blob);};
      click('#color-scheme-export-button');var exported=await exportedBlob.text();win.URL.createObjectURL=createURL;
      var portable=win.PortableUIColorSchemes.parseSchemeDocument(exported);
      check(portable.version===3 && portable.schemes[0].extensions.fea.load==='#cc7733','Export omitted custom FEA colors');
      importText('{"format":"wrong","version":3,"schemes":[]}');
      await wait(function(){return doc.getElementById('color-scheme-status').textContent.startsWith('Import failed:');},'invalid import');
      check(doc.getElementById('color-scheme-select').value===copyId,'Failed import replaced the active scheme');
      importText(exported);
      await wait(function(){return doc.getElementById('color-scheme-select').value!==copyId;},'valid import');
      fill(role('Accent'),'#885522');overflowAction('restore');
      check(doc.documentElement.style.getPropertyValue('--ui-color-accent')==='#336699','Imported reset baseline was lost');
      click('[data-color-scheme-action="delete"]');select('light');overflowAction('restore');
      check(doc.documentElement.style.getPropertyValue('--ui-color-accent')==='#0f62fe','Factory reset did not restore the preset');
      overflowAction('reset');
      check(doc.getElementById('color-scheme-select').options.length===4 && doc.documentElement.dataset.colorScheme==='fea-classic',
        'Full reset did not restore the factory library');
      select('light');fill(role('Load'),'#cc7733');fill('.ui-color-scheme-name','Saved gray');
      check(app.document.analysisRevision===revision && app.history.cursor===history && app.document.geometry===geometry,
        'Appearance editing changed engineering state or history');
      var oldDoc=doc;win.location.reload();
      await wait(function(){return frame.contentDocument!==oldDoc && frame.contentDocument.getElementById('wasm-status') &&
        frame.contentDocument.getElementById('wasm-status').textContent.includes('WebAssembly available');},'reload');
      doc=frame.contentDocument;
      check(doc.documentElement.dataset.colorScheme==='light' && doc.documentElement.style.getPropertyValue('--ui-color-load')==='#cc7733' &&
        doc.querySelector('.ui-color-scheme-name').value==='Saved gray','Custom appearance did not survive app reload');
      document.getElementById('test-status').textContent='Passed appearance editing, persistence, action grouping and example dismissal';
    }catch(error){document.getElementById('test-status').textContent='Failed: '+error.message;}
  },{once:true});
}());
