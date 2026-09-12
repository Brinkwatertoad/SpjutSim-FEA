(function (root) {
  'use strict';
  function stlMeshingAdvice(triangleCount, mode) {
    if (!(triangleCount >= 25000)) return '';
    return 'Detailed STL: meshing may take minutes. Start with Coarse, then refine and compare results. ' +
      (mode === 'original' ? 'Keeping source triangles can still produce a dense mesh; advanced remeshing can reduce it. ' : '') +
      'Each STL operation stops after 2 minutes; Cancel stops it sooner. Time also depends on shape, mesh settings and your computer.';
  }
  function StlImportUI(controller, handlers) {
    var self=this;
    this.controller=controller;this.handlers=handlers;this.dialog=document.getElementById('stl-import-dialog');
    this.unit=document.getElementById('stl-length-unit');this.angle=document.getElementById('stl-patch-angle');
    this.mode=document.getElementById('stl-surface-mode');this.tolerance=document.getElementById('stl-reconstruction-tolerance');
    this.featureAngle=document.getElementById('stl-remesh-angle');
    this.canvas=document.getElementById('stl-review-viewport');
    this.reviewButton=document.getElementById('stl-review-button');this.busy=false;this.sourceTriangleCount=0;
    this.comparison=document.getElementById('stl-preview-surface');
    this.comparison.onchange=function(){self.showSurface();};
    this.status=document.getElementById('stl-import-status');this.dimensions=document.getElementById('stl-dimensions');
    this.accept=document.getElementById('stl-accept-button');this.list=document.getElementById('stl-patch-list');
    this.selected=new Set();this.viewport=null;this.geometry=null;
    this.reviewButton.onclick=function(){self.review();};
    document.getElementById('stl-use-original-button').onclick=function(){handlers.change();self.mode.value='original';self.updateControls();self.review();};
    document.getElementById('stl-repair-button').onclick=function(){
      var value=document.getElementById('stl-repair-hole-limit').value,ratio=Number(value)/100;
      if(value===''||!root.SpjutsimFEA.validateStlRepairOptions({version:1,maxHoleDiameterRatio:ratio})){self.report('Choose a maximum hole width from 0% through 5%.');return;}
      self.clearError();self.busy=true;self.accept.disabled=true;self.updateControls();self.report('Trying local surface repair… You can cancel at any time.');
      handlers.repair(self.options(),ratio);
    };
    document.getElementById('stl-discard-repair-button').onclick=function(){handlers.discardRepair();};
    document.getElementById('stl-download-original-button').onclick=function(){
      var review=controller.geometryReview;if(!review||!review.source.repair)return;
      var url=URL.createObjectURL(new Blob([review.source.repair.originalSourceBytes],{type:'application/octet-stream'}));
      var link=document.createElement('a');link.href=url;link.download=review.source.sourceName;link.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
    };
    document.getElementById('stl-cancel-button').onclick=function(){handlers.cancel();};
    this.accept.onclick=function(){handlers.accept();};
    this.dialog.addEventListener('cancel',function(event){event.preventDefault();handlers.cancel();});
    [this.unit,this.angle,this.mode,this.tolerance,this.featureAngle].forEach(function(control){control.onchange=function(){handlers.change();self.busy=false;self.clearError();self.updateControls();self.accept.disabled=true;self.status.textContent='Settings changed. Update the preview before importing.';if(control===self.unit&&self.unit.value)self.review();};});
    controller.subscribe(function(){self.render();});
  }
  StlImportUI.prototype.clearError=function(){
    document.getElementById('stl-repair-panel').hidden=true;
    document.getElementById('stl-use-original-button').hidden=true;
    document.getElementById('stl-error-details').hidden=true;
    document.getElementById('stl-error-code').textContent='';
  };
  StlImportUI.prototype.updateControls=function(){
    this.tolerance.disabled=this.mode.value!=='reconstruct';this.featureAngle.disabled=this.mode.value!=='remesh';
    document.getElementById('stl-remesh-angle-label').hidden=this.featureAngle.disabled;
    document.getElementById('stl-reconstruction-tolerance-label').hidden=this.tolerance.disabled;
    this.reviewButton.disabled=this.busy||!this.unit.value;
    document.getElementById('stl-repair-button').disabled=this.busy||!this.unit.value;
    document.getElementById('stl-repair-hole-limit').disabled=this.busy;
    this.reviewButton.textContent=this.busy?'Preparing preview…':'Update preview';
    var advice=document.getElementById('stl-meshing-advice');
    advice.textContent=stlMeshingAdvice(this.sourceTriangleCount,this.mode.value);advice.hidden=!advice.textContent;
  };
  StlImportUI.prototype.review=function(){
    var options=this.options();this.clearError();
    if(!root.SpjutsimFEA.validateStlOptions(options)){
      this.reportFailure(new Error('Choose file units and valid angles. Reconstruction also needs a positive maximum deviation.'));return;
    }
    this.busy=true;this.accept.disabled=true;this.updateControls();this.report('Checking the STL and preparing its preview… You can cancel at any time.');
    this.handlers.review(options);
  };
  StlImportUI.prototype.options=function(){var scale={m:1,mm:.001,cm:.01,in:.0254,ft:.3048}[this.unit.value];var options={version:2,lengthUnit:this.unit.value,patchAngleDegrees:Number(this.angle.value),normalization:'none',surfaceMode:this.mode.value,reconstructionToleranceM:this.mode.value==='reconstruct'?Number(this.tolerance.value)*scale:null};if(this.mode.value==='remesh')options.remeshFeatureAngleDegrees=Number(this.featureAngle.value);return options;};
  StlImportUI.prototype.open=function(options){
    this.unit.value=options?options.lengthUnit:'';this.angle.value=options?options.patchAngleDegrees:40;
    this.mode.value=options?(options.surfaceMode||'original'):'original';
    this.busy=false;this.clearError();this.sourceTriangleCount=0;this.canvas.hidden=true;
    this.updateSourceSummary();
    document.getElementById('stl-repair-hole-limit').value=1;
    document.getElementById('stl-advanced-options').open=Boolean(options&&options.surfaceMode&&options.surfaceMode!=='original');
    document.getElementById('stl-selection-details').open=false;
    this.tolerance.value=options&&options.reconstructionToleranceM?options.reconstructionToleranceM/{m:1,mm:.001,cm:.01,in:.0254,ft:.3048}[options.lengthUnit]:.01;
    this.featureAngle.value=options&&options.remeshFeatureAngleDegrees!==undefined?options.remeshFeatureAngleDegrees:5;
    this.updateControls();this.comparison.value='simulation';
    document.getElementById('stl-preview-surface-label').hidden=true;
    this.accept.disabled=true;this.geometry=null;this.list.replaceChildren();this.dimensions.textContent='';
    this.status.textContent='Select file units to preview the model. STL files do not store units.';
    document.getElementById('stl-remap-consequence').hidden=!this.controller.document.geometry;
    this.renderRepair();
    this.dialog.showModal();
    this.viewport=new root.SpjutsimFEA.ViewportController(this.canvas);
    var self=this;this.viewport.setFacePickHandler(function(id){if(id)self.select(id);});
    if(options)this.review();else this.unit.focus();
  };
  StlImportUI.prototype.updateSourceSummary=function(){
    var review=this.controller.geometryReview;if(!review)return;
    var source=review.source,bytes=source.sourceBytes;this.reviewSource=source;this.sourceTriangleCount=0;
    if(bytes.byteLength>=84){var count=new DataView(bytes).getUint32(80,true);if(count>0&&84+50*count===bytes.byteLength)this.sourceTriangleCount=count;}
    document.getElementById('stl-source-summary').textContent=source.sourceName+' · '+(bytes.byteLength/1000000).toPrecision(3)+' MB'+(this.sourceTriangleCount?' · '+this.sourceTriangleCount.toLocaleString('en-US')+' triangles':'');
  };
  StlImportUI.prototype.renderRepair=function(){
    var review=this.controller.geometryReview,repair=review&&review.source.repair,summary=document.getElementById('stl-repair-summary');
    summary.hidden=!repair;document.getElementById('stl-discard-repair-button').hidden=!repair;document.getElementById('stl-download-original-button').hidden=!repair;
    this.comparison.querySelector('[value="original"]').textContent=repair?'Repaired STL surface':'Original STL surface';
    document.getElementById('stl-use-original-button').textContent=repair?'Use repaired STL triangles instead':'Use original triangles instead';
    if(!repair)return;
    var report=repair.report,changes=[];
    [['removedDuplicateTriangles','duplicate triangles removed'],['removedZeroAreaTriangles','zero-area triangles removed'],['removedLooseTriangles','stray triangles removed'],['flippedTriangles','triangle directions corrected'],['filledHoles','holes filled']].forEach(function(item){if(report[item[0]])changes.push(report[item[0]]+' '+item[1]);});
    var scale={m:1,mm:.001,cm:.01,in:.0254,ft:.3048}[report.lengthUnit],displayUnit=this.unit.value||report.lengthUnit;
    if(report.filledHoles){changes.push('largest filled hole '+(report.maximumFilledHoleDiameterM/scale).toPrecision(4)+' '+displayUnit);}
    var before=report.originalBoundingBoxM.maxM.map(function(v,i){return v-report.originalBoundingBoxM.minM[i];});
    var after=report.repairedBoundingBoxM.maxM.map(function(v,i){return v-report.repairedBoundingBoxM.minM[i];});
    if(before.some(function(v,i){return Math.abs(v-after[i])>report.sourceDiagonalM*1e-10;})){
      function dimensions(values){return values.map(function(v){return(v/scale).toPrecision(4);}).join(' × ')+' '+displayUnit;}
      changes.push('overall dimensions changed from '+dimensions(before)+' to '+dimensions(after));
    }
    summary.textContent='Repaired STL: '+(changes.length?changes.join('; '):'no surface changes needed')+'. The repaired source passes all solid checks. Review its shape before importing.'+
      (this.mode.value==='reconstruct'?' Reconstruction deviation is measured from this repaired STL.':'');
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
    if(review&&review.source!==this.reviewSource){this.updateSourceSummary();this.updateControls();}
    this.renderRepair();
    this.accept.disabled=!geometry;this.canvas.hidden=!geometry;
    if(!geometry) {
      document.getElementById('stl-preview-surface-label').hidden=true;
      if(this.geometry){this.viewport.clearGeometryPreview();this.geometry=null;this.selected.clear();this.list.replaceChildren();this.dimensions.textContent='';}
      return;
    }
    if(geometry===this.geometry)return;
    this.viewport.resize();
    this.busy=false;this.sourceTriangleCount=geometry.sourceMetadata.triangleCount;this.updateControls();this.clearError();
    this.geometry=geometry;this.selected.clear();this.comparison.value='simulation';this.showSurface();this.list.replaceChildren();
    document.getElementById('stl-preview-surface-label').hidden=!geometry.originalPreview;
    var self=this;
    geometry.faceIds.forEach(function(id,index){var button=document.createElement('button');button.type='button';var remeshing=geometry.sourceMetadata.remeshing,count=remeshing&&remeshing.surfaceCountsByPatch[index];button.textContent='Patch '+(index+1)+(geometry.sourceMetadata.reconstruction?' — '+geometry.sourceMetadata.reconstruction.surfaces[index].kind:remeshing?' — '+count+(count===1?' surface':' surfaces'):'');button.dataset.faceId=id;button.title=id;button.setAttribute('aria-pressed','false');button.onclick=function(){self.select(id);};self.list.appendChild(button);});
    var dimensions=geometry.boundingBoxM.maxM.map(function(value,axis){return value-geometry.boundingBoxM.minM[axis];});
    var scale={m:1,mm:0.001,cm:0.01,in:0.0254,ft:0.3048}[geometry.importOptions.lengthUnit];
    this.dimensions.textContent=dimensions.map(function(value){return (value/scale).toPrecision(6);}).join(' × ')+' '+geometry.importOptions.lengthUnit;
    this.status.textContent=geometry.sourceMetadata.triangleCount.toLocaleString('en-US')+' source triangles; '+geometry.faceIds.length+' selectable patches. '+
      (geometry.sourceMetadata.reconstruction?'Recovered '+geometry.sourceMetadata.internalSurfaceCount+' surfaces. Maximum deviation bound: '+(geometry.sourceMetadata.reconstruction.maximumDeviationM/scale).toPrecision(4)+' '+geometry.importOptions.lengthUnit+'. Compare the surfaces before applying.':(review.source.repair?'Repaired STL triangles retained. ':'Original triangles retained. ')+'Groups help select faces; they do not simplify the geometry. Check the dimensions, then import.');
    if(geometry.sourceMetadata.remeshing)this.status.textContent=geometry.sourceMetadata.triangleCount.toLocaleString('en-US')+' source triangles; '+geometry.faceIds.length+' selectable groups. Experimental remeshing will generate new triangles for simulation; it does not recover smooth CAD curves. Refine the mesh to check small details.';
  };
  StlImportUI.prototype.showSurface=function(){if(!this.geometry||!this.viewport)return;var geometry=this.geometry;if(this.comparison.value==='original'&&geometry.originalPreview)geometry=Object.assign({},geometry,{preview:geometry.originalPreview});this.viewport.setGeometryPreview(geometry);this.viewport.setSelectedFaceIds(Array.from(this.selected));};
  StlImportUI.prototype.report=function(message){this.status.textContent=message;};
  StlImportUI.prototype.reportFailure=function(error){
    this.busy=false;this.updateControls();this.clearError();
    var code=error.diagnostic&&error.diagnostic.code;
    var review=this.controller.geometryReview;
    document.getElementById('stl-repair-panel').hidden=!(review&&!review.source.repair&&['STL_NONMANIFOLD','STL_OPEN_SURFACE','STL_DEGENERATE_TRIANGLE','STL_INCONSISTENT_WINDING','STL_INWARD_WINDING','STL_REPAIR_UNSUPPORTED'].includes(code));
    this.report(error.message);
    document.getElementById('stl-error-details').hidden=!code;
    document.getElementById('stl-error-details').open=false;
    document.getElementById('stl-error-code').textContent=code||'';
    document.getElementById('stl-use-original-button').hidden=!(code&&
      (code.indexOf('STL_RECONSTRUCTION_')===0||code==='STL_REMESH_FAILED'||code==='STL_PATCH_LIMIT'||code==='MESHER_TIMEOUT')&&this.mode.value!=='original');
  };
  root.SpjutsimFEA.stlMeshingAdvice=stlMeshingAdvice;
  StlImportUI.prototype.close=function(){if(this.viewport){this.viewport.dispose();this.viewport=null;}this.geometry=null;this.selected.clear();this.dialog.close();};
  root.SpjutsimFEA.StlImportUI=StlImportUI;
}(globalThis));
