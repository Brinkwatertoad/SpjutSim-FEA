(function () {
  'use strict';
  var frame=document.getElementById('application-frame'),status=document.getElementById('test-status');
  function assert(value,message){if(!value)throw new Error(message);}
  async function wait(condition){var start=performance.now();while(!condition()){if(performance.now()-start>90000)throw new Error('STL workflow timed out');await new Promise(function(resolve){setTimeout(resolve,25);});}}
  frame.addEventListener('load',async function(){
    var win=frame.contentWindow,doc=win.document,api=win.SpjutsimFEA,app;
    function click(id){var el=doc.getElementById(id);assert(el&&!el.disabled,'Unavailable '+id);el.click();}
    function fill(id,value){var el=doc.getElementById(id);el.value=value;el.dispatchEvent(new win.Event('change',{bubbles:true}));}
    async function importFile(name){var bytes=await(await fetch('../fixtures/stl/'+name)).arrayBuffer(),transfer=new win.DataTransfer();transfer.items.add(new win.File([bytes],name));var input=doc.getElementById('import-step-input');input.files=transfer.files;input.dispatchEvent(new win.Event('change',{bubbles:true}));await wait(function(){return doc.getElementById('stl-import-dialog').open;});}
    try {
      await wait(function(){return doc.getElementById('app-status').textContent==='Local runtime ready';});
      assert(doc.getElementById('stl-import-dialog'),'STL review dialog is missing');
      assert(doc.getElementById('stl-surface-mode')&&doc.getElementById('stl-reconstruction-tolerance'),'STL simulation surface controls are missing');
      var notify=api.AppController.prototype.notify;api.AppController.prototype.notify=function(){app=this;return notify.apply(this,arguments);};
      await importFile('cube-binary.stl');
      assert(!app.document.geometry && doc.getElementById('stl-length-unit').value==='','Import inferred units or installed before review');
      fill('stl-length-unit','m');click('stl-review-button');
      await wait(function(){return app.geometryReview&&app.geometryReview.geometry;});
      assert(app.geometryReview.geometry.faceIds.length===6,'Cube patch grouping incorrect');
      assert(app.geometryReview.geometry.originalPreview,'Reconstruction did not retain a comparison surface');
      fill('stl-preview-surface','original');assert(!doc.getElementById('stl-accept-button').disabled,'Comparing the original invalidated the reviewed candidate');
      fill('stl-preview-surface','simulation');
      fill('stl-reconstruction-tolerance','0.02');assert(doc.getElementById('stl-accept-button').disabled,'Tolerance edit retained stale acceptance');click('stl-review-button');
      await wait(function(){return app.geometryReview&&app.geometryReview.geometry;});
      assert(doc.getElementById('stl-dimensions').textContent.includes('1.00000'),'Dimensions missing');
      doc.querySelector('#stl-patch-list button').click();assert(doc.querySelector('#stl-patch-list [aria-pressed=true]'),'Patch button did not select');
      click('stl-accept-button');await wait(function(){return app.document.geometry;});
      var original=app.document.geometry,revision=app.document.analysisRevision;
      await importFile('open.stl');fill('stl-length-unit','m');click('stl-review-button');
      await wait(function(){return doc.getElementById('stl-import-status').textContent.includes('STL_OPEN_SURFACE');});
      assert(app.document.geometry===original&&app.document.analysisRevision===revision,'Rejected import changed the model');
      click('stl-cancel-button');assert(app.document.geometry===original&&!doc.getElementById('stl-import-dialog').open,'Cancel did not preserve the prior model');
      click('regroup-stl-button');await wait(function(){return app.geometryReview&&app.geometryReview.geometry;});
      fill('stl-surface-mode','original');fill('stl-patch-angle','100');assert(doc.getElementById('stl-accept-button').disabled,'Changed grouping retained stale acceptance');click('stl-review-button');
      await wait(function(){return app.geometryReview&&app.geometryReview.geometry&&app.geometryReview.geometry.faceIds.length===1;});
      click('stl-cancel-button');assert(app.document.geometry===original,'Cancelled regroup changed assignment identity');
      status.textContent='Passed';status.dataset.result='passed';
    }catch(error){status.textContent=error.message;status.dataset.result='failed';}
  });
}());
