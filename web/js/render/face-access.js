(function(root){
  'use strict';
  var api=root.SpjutsimFEA, prototype=api.ViewportController.prototype;
  prototype.pickFacesAtPointer=function(event){
    var mesh=this.presentation.mode==='mesh' && this.meshSurface ? this.meshSurface : this.previewMesh;
    if(!mesh){return [];}
    var rect=this.canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;
    if(!Number.isFinite(x) || !Number.isFinite(y) || x<0 || x>1 || y<0 || y>1){return [];}
    this.pointer.set(x*2-1,1-y*2);this.camera.updateMatrixWorld();this.raycaster.setFromCamera(this.pointer,this.camera);
    var intersections=this.raycaster.intersectObject(mesh,false),seen=new Set(),faces=[];
    for(var hit of intersections){
      var id=mesh.userData.faceIdsByRange[mesh.userData.triangleFaceIndices[hit.faceIndex]];
      if(id && !seen.has(id) && !(this.hiddenFaceIds && this.hiddenFaceIds.has(id))){seen.add(id);faces.push(id);}
    }
    return faces;
  };
  prototype.applyFaceVisibility=function(){
    var hidden=this.hiddenFaceIds || new Set();
    [this.previewMesh,this.meshSurface].forEach(function(mesh){
      if(!mesh){return;}if(!mesh.material[2]){mesh.material.push(new root.THREE.MeshBasicMaterial({visible:false,side:root.THREE.DoubleSide}));}
      mesh.geometry.groups.forEach(function(group,index){var id=mesh.userData.faceIdsByRange[index];group.materialIndex=hidden.has(id)?2:this.selectedFaceIds.has(id)?1:0;},this);
    },this);
    if(hidden.size){
      // Edge polylines have no per-face ownership. Omit them during isolation instead of showing hidden boundaries.
      if(this.importedGeometry){var edges=this.importedGeometry.getObjectByName('imported-geometry-feature-edges');if(edges){edges.visible=false;}}
      if(this.meshDisplay){this.meshDisplay.userData.lines.visible=false;}
    }
  };
  prototype.setHiddenFaceIds=function(ids){
    var known=new Set(this.previewMesh ? this.previewMesh.userData.faceIdsByRange : []);
    if(!Array.isArray(ids) || ids.some(function(id){return !known.has(id);})){throw Error('Choose faces in the current CAD model.');}
    this.hiddenFaceIds=new Set(ids);this.showDraftHover(null);this.applyPresentation();this.render();
  };
  prototype.revealFaces=function(ids){if(!this.hiddenFaceIds || !ids.some(function(id){return this.hiddenFaceIds.has(id);},this)){return;}var next=new Set(this.hiddenFaceIds);ids.forEach(function(id){next.delete(id);});this.setHiddenFaceIds(Array.from(next));};
  prototype.isolateSelectedFaces=function(){
    if(!this.previewMesh || !this.selectedFaceIds.size){return;}
    this.setHiddenFaceIds(this.previewMesh.userData.faceIdsByRange.filter(function(id){return !this.selectedFaceIds.has(id);},this));
  };
  function bindFaceAccess(app,viewport){
    var panel=document.getElementById('pick-through-panel'),message=document.getElementById('pick-through-status'),faces=[],index=0,additive=false;
    function end(){viewport.pickThroughActive=false;faces=[];panel.hidden=true;viewport.showDraftHover(null);if(viewport.draftHoverMesh){viewport.draftHoverMesh.material.depthTest=true;}}
    function show(){
      panel.hidden=false;message.textContent=faces.length?'Candidate '+(index+1)+' of '+faces.length+' · '+faces[index]:'Click a face in the viewport to inspect faces behind it.';
      document.getElementById('pick-through-confirm').disabled=!faces.length;document.getElementById('pick-through-next').disabled=faces.length<2;
      if(faces.length){viewport.showDraftHover(faces[index]);if(viewport.draftHoverMesh){viewport.draftHoverMesh.material.depthTest=false;viewport.render();}}
    }
    document.getElementById('pick-through-start').addEventListener('click',function(){viewport.pickThroughActive=true;faces=[];show();});
    viewport.pickThroughHandler=function(event){faces=viewport.pickFacesAtPointer(event);index=0;additive=Boolean(event.shiftKey);show();document.getElementById('pick-through-next').focus();};
    viewport.cancelPickThrough=end;
    document.getElementById('pick-through-next').addEventListener('click',function(){if(faces.length){index=(index+1)%faces.length;show();}});
    document.getElementById('pick-through-confirm').addEventListener('click',function(){var face=faces[index];end();if(face){viewport.facePickHandler(face,additive);}viewport.canvas.focus();});
    document.getElementById('pick-through-cancel').addEventListener('click',end);
    document.getElementById('hide-selected-faces').addEventListener('click',function(){viewport.setHiddenFaceIds(Array.from(new Set([...(viewport.hiddenFaceIds || []),...viewport.selectedFaceIds])));end();});
    document.getElementById('isolate-selected-faces').addEventListener('click',function(){viewport.isolateSelectedFaces();end();});
    document.getElementById('show-all-faces').addEventListener('click',function(){viewport.setHiddenFaceIds([]);end();});
    var escape=function(event){if(event.key==='Escape' && viewport.pickThroughActive){event.preventDefault();event.stopImmediatePropagation();end();viewport.canvas.focus();}};
    document.addEventListener('keydown',escape,true);
    var previous=app.document.geometry;
    app.subscribe(function(state,change){
      if(change==='solve-progress' || change==='convergence-progress'){return;}
      if(state.geometry!==previous){previous=state.geometry;end();}
      if(change==='locate-assignment'){viewport.revealFaces(state.assignmentDraft ? state.assignmentDraft.faceIds : state.selectedFaceIds);}
      var unavailable=!state.geometry || state.viewportPresentation.mode==='stress' || state.viewportPresentation.mode==='deformation';
      document.getElementById('pick-through-start').disabled=unavailable;
      document.getElementById('hide-selected-faces').disabled=unavailable || !viewport.selectedFaceIds.size;
      document.getElementById('isolate-selected-faces').disabled=unavailable || !viewport.selectedFaceIds.size;
      if(unavailable){end();}
    });
    root.addEventListener('pagehide',function(){document.removeEventListener('keydown',escape,true);},{once:true});
  }
  api.bindFaceAccess=bindFaceAccess;
}(globalThis));
