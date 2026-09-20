(function(root){
  'use strict';
  var T=root.THREE;
  function release(group){while(group.children.length){var child=group.children[0];group.remove(child);if(child.geometry)child.geometry.dispose();if(child.material)child.material.dispose();}}
  function StlDiagnosticsDisplay(viewport){
    this.viewport=viewport;this.issues=[];this.previews={};this.group=new T.Group();this.surface=new T.Group();this.highlights=new T.Group();this.group.add(this.surface,this.highlights);
    this.saved={view:viewport.captureViewState(),center:viewport.modelCenter.clone(),extent:viewport.modelExtent,min:viewport.minimumOrbitDistance,max:viewport.maximumOrbitDistance,reset:viewport.resetViewState};
    this.visibility=viewport.scene.children.map(function(object){return[object,object.visible];});
    viewport.scene.add(this.group);viewport.stlDiagnosticsDisplay=this;this.hideInstalled();
  }
  StlDiagnosticsDisplay.prototype.hideInstalled=function(){this.visibility.forEach(function(entry){if(!entry[0].isLight)entry[0].visible=false;});};
  StlDiagnosticsDisplay.prototype.setPreview=function(preview){
    if(!preview||preview===this.preview)return;
    var first=!this.preview;this.preview=preview;release(this.surface);release(this.highlights);
    if(first){this.origin=preview.bounds.min.map(function(v,i){return v/2+preview.bounds.max[i]/2;});this.divisor=Math.max.apply(null,preview.bounds.max.map(function(v,i){return Math.abs(v-preview.bounds.min[i]);}));if(!Number.isFinite(this.divisor))this.divisor=Math.max.apply(null,preview.bounds.max.concat(preview.bounds.min).map(Math.abs));if(!(this.divisor>0))this.divisor=1;}
    var points=new Float32Array(preview.positions.length);
    for(var i=0;i<points.length;i++)points[i]=preview.positions[i]/this.divisor-this.origin[i%3]/this.divisor;
    var geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(points,3));geometry.setIndex(new T.BufferAttribute(preview.triangles,1));geometry.computeVertexNormals();
    var mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color:0xbcc8d3,side:T.DoubleSide,roughness:.8,metalness:0}));this.surface.add(mesh);
    if(first)this.viewport.fitModel(new T.Vector3(),1,true);
    this.viewport.render();
  };
  StlDiagnosticsDisplay.prototype.setDiagnostics=function(issues,previews){this.issues=issues;this.previews=previews;};
  StlDiagnosticsDisplay.prototype.focusIssue=function(index){
    var issue=this.issues[index];if(!issue)return;this.showIssues([issue]);
    var center=issue.bounds.min.map(function(v,i){return(v/2+issue.bounds.max[i]/2)/this.divisor-this.origin[i]/this.divisor;},this);
    var extent=Math.max.apply(null,issue.bounds.max.map(function(v,i){return v/this.divisor-issue.bounds.min[i]/this.divisor;},this));
    this.viewport.fitModel(new T.Vector3().fromArray(center),Math.max(extent,.05),false);
  };
  StlDiagnosticsDisplay.prototype.showIssues=function(issues){
    release(this.highlights);var self=this;
    issues.forEach(function(issue){
      var source=self.previews[issue.revision];if(!source)return;
      var color=issue.status==='fixed'?0x41c7a5:issue.status==='proposed'?0xffbe45:0xff5674;
      function points(ids){var out=new Float32Array(ids.length*3);ids.forEach(function(id,i){for(var a=0;a<3;a++)out[i*3+a]=source.positions[id*3+a]/self.divisor-self.origin[a]/self.divisor;});return out;}
      function add(ids,kind){if(!ids.length)return;var g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(points(ids),3));var object;
        if(kind==='faces')object=new T.Mesh(g,new T.MeshBasicMaterial({color:color,side:T.DoubleSide,transparent:true,opacity:.8,depthTest:false,depthWrite:false}));
        else if(kind==='edges')object=new T.LineSegments(g,new T.LineBasicMaterial({color:color,depthTest:false,depthWrite:false}));
        else object=new T.Points(g,new T.PointsMaterial({color:color,size:9,sizeAttenuation:false,depthTest:false,depthWrite:false}));
        object.renderOrder=10;self.highlights.add(object);
      }
      var faces=new Uint32Array(issue.triangleIds.length*3);issue.triangleIds.forEach(function(id,i){faces.set(source.triangles.subarray(id*3,id*3+3),i*3);});
      add(faces,'faces');add(issue.edgeVertexIds,'edges');add(issue.vertexIds,'vertices');
    });this.viewport.render();
  };
  StlDiagnosticsDisplay.prototype.showRevision=function(revision){if(this.previews[revision])this.setPreview(this.previews[revision]);};
  StlDiagnosticsDisplay.prototype.showAll=function(){this.showIssues(this.issues);this.viewport.fitModel(new T.Vector3(),1,false);};
  StlDiagnosticsDisplay.prototype.dispose=function(){
    release(this.surface);release(this.highlights);var v=this.viewport;v.scene.remove(this.group);v.stlDiagnosticsDisplay=null;
    this.visibility.forEach(function(entry){entry[0].visible=entry[1];});v.modelCenter.copy(this.saved.center);v.modelExtent=this.saved.extent;v.minimumOrbitDistance=this.saved.min;v.maximumOrbitDistance=this.saved.max;v.resetViewState=this.saved.reset;v.restoreViewState(this.saved.view);v.render();
  };
  root.SpjutsimFEA.StlDiagnosticsDisplay=StlDiagnosticsDisplay;
}(globalThis));
