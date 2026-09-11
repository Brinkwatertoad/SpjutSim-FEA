(function (root) {
  'use strict';
  function StlImportUI(controller, handlers) {
    var self=this;
    this.controller=controller;this.handlers=handlers;this.dialog=document.getElementById('stl-import-dialog');
    this.unit=document.getElementById('stl-length-unit');this.angle=document.getElementById('stl-patch-angle');
    this.status=document.getElementById('stl-import-status');this.dimensions=document.getElementById('stl-dimensions');
    this.accept=document.getElementById('stl-accept-button');this.list=document.getElementById('stl-patch-list');
    this.selected=new Set();this.viewport=null;this.geometry=null;
    document.getElementById('stl-review-button').onclick=function(){handlers.review(self.options());};
    document.getElementById('stl-cancel-button').onclick=function(){handlers.cancel();};
    this.accept.onclick=function(){handlers.accept();};
    this.dialog.addEventListener('cancel',function(event){event.preventDefault();handlers.cancel();});
    [this.unit,this.angle].forEach(function(control){control.onchange=function(){handlers.change();self.accept.disabled=true;self.status.textContent='Options changed. Review the dimensions and new patches before continuing.';};});
    controller.subscribe(function(){self.render();});
  }
  StlImportUI.prototype.options=function(){return {version:1,lengthUnit:this.unit.value,patchAngleDegrees:Number(this.angle.value),normalization:'none'};};
  StlImportUI.prototype.open=function(options){
    this.unit.value=options?options.lengthUnit:'';this.angle.value=options?options.patchAngleDegrees:40;
    this.accept.disabled=true;this.geometry=null;this.list.replaceChildren();this.dimensions.textContent='';
    this.status.textContent='Choose the file’s length units, then review its dimensions and selectable patches.';
    document.getElementById('stl-remap-consequence').hidden=!this.controller.document.geometry;
    this.dialog.showModal();
    this.viewport=new root.SpjutsimFEA.ViewportController(document.getElementById('stl-review-viewport'));
    var self=this;this.viewport.setFacePickHandler(function(id){if(id)self.select(id);});
    if(options)this.handlers.review(this.options());else this.unit.focus();
  };
  StlImportUI.prototype.select=function(id){
    if(this.selected.has(id))this.selected.delete(id);else this.selected.add(id);
    this.viewport.setSelectedFaceIds(Array.from(this.selected));
    Array.from(this.list.children).forEach(function(button){button.setAttribute('aria-pressed',String(this.selected.has(button.dataset.faceId)));},this);
  };
  StlImportUI.prototype.render=function(){
    var documentState=this.controller.document,regroup=document.getElementById('regroup-stl-button');
    regroup.hidden=!documentState.geometry||documentState.geometry.sourceFormat!=='stl';
    regroup.disabled=Boolean(documentState.assignmentDraft)||root.SpjutsimFEA.engineeringBusy(documentState);
    if(!this.dialog.open)return;
    var review=this.controller.geometryReview,geometry=review&&review.geometry;
    this.accept.disabled=!geometry;
    if(!geometry) {
      if(this.geometry){this.viewport.clearGeometryPreview();this.geometry=null;this.selected.clear();this.list.replaceChildren();this.dimensions.textContent='';}
      return;
    }
    if(geometry===this.geometry)return;
    this.geometry=geometry;this.selected.clear();this.viewport.setGeometryPreview(geometry);this.list.replaceChildren();
    var self=this;
    geometry.faceIds.forEach(function(id,index){var button=document.createElement('button');button.type='button';button.textContent='Patch '+(index+1);button.dataset.faceId=id;button.title=id;button.setAttribute('aria-pressed','false');button.onclick=function(){self.select(id);};self.list.appendChild(button);});
    var dimensions=geometry.boundingBoxM.maxM.map(function(value,axis){return value-geometry.boundingBoxM.minM[axis];});
    var scale={m:1,mm:0.001,cm:0.01,in:0.0254,ft:0.3048}[geometry.importOptions.lengthUnit];
    this.dimensions.textContent=dimensions.map(function(value){return (value/scale).toPrecision(6);}).join(' × ')+' '+geometry.importOptions.lengthUnit+
      ' ('+dimensions.map(function(value){return value.toPrecision(6);}).join(' × ')+' m)';
    this.status.textContent=geometry.sourceMetadata.triangleCount+' triangles; '+geometry.faceIds.length+' selectable patches. Select patches to check grouping.';
  };
  StlImportUI.prototype.report=function(message){this.status.textContent=message;};
  StlImportUI.prototype.close=function(){if(this.viewport){this.viewport.dispose();this.viewport=null;}this.geometry=null;this.selected.clear();this.dialog.close();};
  root.SpjutsimFEA.StlImportUI=StlImportUI;
}(globalThis));
