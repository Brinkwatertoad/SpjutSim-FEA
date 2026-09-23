(function(root){
  'use strict';
  var api=root.SpjutsimFEA;
  function ProjectWorkflow(controller,options){
    this.controller=controller;this.options=options || {};this.generation=0;this.client=null;
  }
  ProjectWorkflow.prototype.cancel=function(){this.generation++;if(this.client){this.client.cancel();this.client.dispose();this.client=null;}if(this.controller.projectOpening){this.controller.projectOpening=false;this.controller.notify('project-status');}};
  ProjectWorkflow.prototype.open=async function(file,options){
    options=options || {};var app=this.controller;
    if(app.document.assignmentDraft){throw Error('Apply or Cancel the draft before opening a project.');}
    if(api.engineeringBusy(app.document)){throw Error('Finish or cancel the current import, mesh or solve before opening a project.');}
    this.cancel();if(this.options.beforeStage){this.options.beforeStage();}app.observeProject();var generation=this.generation, revision=app.projectRevision, client=null;
    app.projectOpening=true;app.notify('project-status');
    try{
      var project=file instanceof Blob ? await api.readProjectFile(file,{deferDerived:true}) : file;
      if(generation!==this.generation){return null;}
      client=this.options.createMesher ? this.options.createMesher() : new api.MesherClient({onProgress:this.options.onProgress || function(){}});this.client=client;
      var geometry=await client.importGeometry({geometryId:project.manifest.source.geometryId,sourceName:project.source.sourceName,sourceFormat:project.source.sourceFormat,sourceBytes:project.source.sourceBytes});
      if(generation!==this.generation){return null;}
      client.dispose();if(this.client===client){this.client=null;}client=null;
      if(project.loadDerived){await project.loadDerived();}
      if(generation!==this.generation){return null;}
      var candidate=api.prepareProjectCandidate(project,geometry);
      if(candidate.cacheWarning && this.options.acceptSetupOnly && !await this.options.acceptSetupOnly(candidate.cacheWarning)){return null;}
      if(generation!==this.generation){return null;}
      app.observeProject();if(revision!==app.projectRevision){throw Error('The setup changed while opening. Save your changes and open the project again.');}
      if(this.options.beforeInstall){this.options.beforeInstall();}
      app.installProject(candidate,options.recovered);return candidate;
    }finally{if(client){client.dispose();}if(this.client===client){this.client=null;}if(generation===this.generation){app.projectOpening=false;app.notify('project-status');}}
  };
  api.ProjectWorkflow=ProjectWorkflow;
}(globalThis));
