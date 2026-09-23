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
  function bindReportOptions(app){
    var button=document.getElementById('report-options-button'),dialog=document.getElementById('report-options-dialog');
    function fill(options){
      document.getElementById('report-title').value=options.title;document.getElementById('report-notes').value=options.notes;
      dialog.querySelectorAll('[data-report-view]').forEach(function(input){input.checked=options.views===null || options.views.includes(input.dataset.reportView);});
      document.getElementById('report-current-view').checked=options.currentView;
      var hasFoS=Boolean(app.document.results && app.document.results.factorOfSafety);
      dialog.querySelector('[data-report-view="factorOfSafety"]').disabled=!hasFoS;
      document.getElementById('report-fos-availability').textContent=hasFoS?'':'FoS image unavailable until a solved material has yield strength.';
    }
    button.addEventListener('click',function(){fill(validateReportOptions(app.document.projectMetadata && app.document.projectMetadata.reportOptions));dialog.returnValue='';dialog.showModal();});
    document.getElementById('report-restore-defaults').addEventListener('click',function(){fill(defaults());});
    dialog.addEventListener('close',function(){
      if(dialog.returnValue==='apply'){
        var selected=Array.from(dialog.querySelectorAll('[data-report-view]:checked')).map(function(input){return input.dataset.reportView;});
        app.replaceProjectMetadata(Object.assign({name:''},app.document.projectMetadata,{reportOptions:validateReportOptions({title:document.getElementById('report-title').value,notes:document.getElementById('report-notes').value,views:selected.length===5?null:selected,currentView:document.getElementById('report-current-view').checked})}));
      }button.focus();
    });
  }
  api.validateReportOptions=validateReportOptions;api.bindReportOptions=bindReportOptions;
}(globalThis));
