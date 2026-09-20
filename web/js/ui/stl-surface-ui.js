/* A surface candidate is transient; applying records only mesh settings. */
(function(root){
  'use strict';
  var api=root.SpjutsimFEA;
  function element(id){return document.getElementById('mesh-stl-'+id);}
  function preview(geometry,revision){return {revision:revision,positions:geometry.preview.positionsM,triangles:geometry.preview.indices,bounds:{min:geometry.boundingBoxM.minM,max:geometry.boundingBoxM.maxM}};}
  function StlSurfaceUI(controller,viewport){
    this.controller=controller;this.viewport=viewport;var self=this;
    element('apply').onclick=function(){self.review();};
    element('cancel').onclick=function(){self.cancel();};
    element('confirm').onclick=function(){try{controller.applyStlSurfaceReview();self.close();element('status').textContent='Surface settings applied. Generate a new mesh to use them.';}catch(error){element('status').textContent=error.message;}};
    element('compare').onchange=function(){if(self.display)self.display.showRevision(this.value);};
    ['method','tolerance','feature-angle'].forEach(function(id){element(id).onchange=function(){self.cancel();self.renderOptions();};});
    controller.subscribe(function(){
      if(self.reviewState&&(controller.stlSurfaceReview!==self.reviewState||controller.document.geometry!==self.reviewState.geometry||controller.document.analysisRevision!==self.reviewState.revision))self.cancel();
      var settings=controller.document.meshSettings.stlSurface||api.defaultStlSurface();
      if(self.installedSettings!==JSON.stringify(settings)&&!self.reviewState){self.installedSettings=JSON.stringify(settings);element('method').value=settings.method;if(settings.reconstructionToleranceM)element('tolerance').value=settings.reconstructionToleranceM;if(settings.remeshFeatureAngleDegrees)element('feature-angle').value=settings.remeshFeatureAngleDegrees;}
      self.renderOptions();
    });
    this.renderOptions();
  }
  StlSurfaceUI.prototype.renderOptions=function(){var method=element('method').value;element('tolerance-label').hidden=method!=='reconstruct';element('feature-label').hidden=method!=='remesh';};
  StlSurfaceUI.prototype.review=async function(){
    this.cancel();var c=this.controller,method=element('method').value,settings={version:1,method:method,reconstructionToleranceM:method==='reconstruct'?Number(element('tolerance').value):null,remeshFeatureAngleDegrees:method==='remesh'?Number(element('feature-angle').value):null};
    var self=this,review,client;
    try{
      review=c.beginStlSurfaceReview(settings);this.reviewState=review;
      element('review').hidden=false;element('confirm').disabled=true;element('status').textContent='Preparing surface candidate…';
      this.display=new api.StlDiagnosticsDisplay(this.viewport);this.display.setPreview(preview(review.geometry,'source'));
      client=new api.MesherClient({onProgress:function(progress){if(self.reviewState===review)element('status').textContent=progress.userMessage;}});this.client=client;
      var candidate=await client.importGeometry(Object.assign({},c.geometrySource,{geometryId:review.geometry.geometryId,stlSurface:settings}));
      if(this.reviewState!==review||!c.completeStlSurfaceReview(review,candidate))return;
      this.display.setDiagnostics([],{source:preview(review.geometry,'source'),candidate:preview(review.candidate,'candidate')});
      this.display.showRevision('candidate');element('compare').value='candidate';element('confirm').disabled=false;
      element('status').textContent=method==='analysis'?'Surfaces will be rebuilt with thickness-aware sizing. Boundary fidelity is checked during meshing.':method==='reconstruct'?'Compare the fitted surface with the original before applying. Maximum checked deviation: '+candidate.sourceMetadata.reconstruction.maximumDeviationM.toPrecision(4)+' m.':method==='remesh'?'Group ownership verified. Remeshing can change boundary area; inspect fidelity warnings with the generated mesh.':'Original triangles will define the simulation boundary.';
    }catch(error){if(!review||this.reviewState===review){this.cancel();element('status').textContent=error.message;}}
    finally{if(client)client.dispose();if(this.client===client)this.client=null;}
  };
  StlSurfaceUI.prototype.close=function(){this.reviewState=null;if(this.client){this.client.cancel();this.client=null;}if(this.display){this.display.dispose();this.display=null;}element('review').hidden=true;element('confirm').disabled=true;};
  StlSurfaceUI.prototype.cancel=function(){var active=this.reviewState;this.close();if(active&&this.controller.stlSurfaceReview)this.controller.cancelStlSurfaceReview();};
  api.StlSurfaceUI=StlSurfaceUI;
}(globalThis));
