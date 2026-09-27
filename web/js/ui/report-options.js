(function(root){
  'use strict';
  var api=root.SpjutsimFEA;
  var views=['assignments','mesh','stress','factorOfSafety','deformation'];
  function defaults(){return {title:'SpjutSim FEA analysis report',notes:'',views:null,currentView:false};}
  function validateReportOptions(value){
    if(!value){return defaults();}
    if(typeof value.title!=='string' || value.title.length>160 || typeof value.notes!=='string' || value.notes.length>10000 || typeof value.currentView!=='boolean' || value.views!==null && (!Array.isArray(value.views) || value.views.length>5 || new Set(value.views).size!==value.views.length || value.views.some(function(v){return views.indexOf(v)<0;}))){return defaults();}
    return {title:value.title.trim() || defaults().title,notes:value.notes,views:value.views && value.views.slice(),currentView:value.currentView};
  }
  function bindReportOptions(app, ui){
    var button=document.getElementById('report-options-button'),panel=document.getElementById('settings-panel-report');
    var title=document.getElementById('report-title'),notes=document.getElementById('report-notes');
    var renderedMetadata;
    function fill(options){
      title.value=options.title;notes.value=options.notes;
      panel.querySelectorAll('[data-report-view]').forEach(function(input){input.checked=options.views===null || options.views.includes(input.dataset.reportView);});
      document.getElementById('report-current-view').checked=options.currentView;
    }
    function render(){
      var metadata=app.document.projectMetadata;
      if(metadata!==renderedMetadata){renderedMetadata=metadata;fill(validateReportOptions(metadata && metadata.reportOptions));}
      var hasFoS=Boolean(app.document.results && app.document.results.factorOfSafety);
      panel.querySelector('[data-report-view="factorOfSafety"]').disabled=!hasFoS;
      document.getElementById('report-fos-availability').textContent=hasFoS?'':'FoS image unavailable until a solved material has yield strength.';
    }
    function commit(){
      if(!title.reportValidity() || !notes.reportValidity()){return;}
      var selected=Array.from(panel.querySelectorAll('[data-report-view]:checked')).map(function(input){return input.dataset.reportView;});
      app.replaceProjectMetadata(Object.assign({name:''},app.document.projectMetadata,{reportOptions:validateReportOptions({title:title.value,notes:notes.value,views:selected.length===5?null:selected,currentView:document.getElementById('report-current-view').checked})}));
    }
    button.addEventListener('click',function(){render();ui.openSettings(button,'report');});
    panel.addEventListener('change',commit);
    title.addEventListener('keydown',function(event){if(event.key==='Enter'){event.preventDefault();title.blur();}});
    document.getElementById('report-restore-defaults').addEventListener('click',function(){
      app.replaceProjectMetadata(Object.assign({name:''},app.document.projectMetadata,{reportOptions:defaults()}));
    });
    fill(defaults());app.subscribe(render);
  }
  api.validateReportOptions=validateReportOptions;api.bindReportOptions=bindReportOptions;
}(globalThis));
