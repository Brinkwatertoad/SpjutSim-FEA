(function(root){
  'use strict';
  var api=root.SpjutsimFEA=root.SpjutsimFEA||{};
  var IDENTITY=[[1,0,0],[0,1,0],[0,0,1]], TOLERANCE=1e-10;
  function vector(v){return Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);}
  function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
  function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
  function validateLocalFrame(frame,knownFaceIds){
    if(!frame || frame.version!==1 || !['global','cad'].includes(frame.ownership) || !vector(frame.originM) || !Array.isArray(frame.axes) || frame.axes.length!==3 || !frame.axes.every(vector))throw Error('Enter a version 1 rectangular frame with finite SI origin and three unit axes.');
    var a=frame.axes;
    if(a.some(function(v){return Math.abs(dot(v,v)-1)>TOLERANCE;}) || Math.abs(dot(a[0],a[1]))>TOLERANCE || Math.abs(dot(a[0],a[2]))>TOLERANCE || Math.abs(dot(a[1],a[2]))>TOLERANCE || dot(cross(a[0],a[1]),a[2])<1-TOLERANCE)throw Error('Frame axes must be orthonormal and right handed.');
    if(frame.ownership==='cad' && (typeof frame.faceId!=='string' || !frame.faceId || (knownFaceIds && !knownFaceIds.includes(frame.faceId))))throw Error('The frame CAD face is missing. Remap or remove the assignment.');
    var value={version:1,ownership:frame.ownership,originM:frame.originM.slice(),axes:a.map(function(v){return v.slice();})};
    if(frame.ownership==='cad')value.faceId=frame.faceId;
    return value;
  }
  function localToGlobal(frame,components){return [0,1,2].map(function(i){return frame.axes[0][i]*components[0]+frame.axes[1][i]*components[1]+frame.axes[2][i]*components[2];});}
  function planarFaceFrame(geometry,faceId){
    var plane=geometry && geometry.planarFaces && geometry.planarFaces[faceId];
    if(!plane)throw Error('Choose one reliably identified planar CAD face. Curved faces cannot use sliding or symmetry supports.');
    var z=plane.normal, seed=Math.abs(z[0])<.8?[1,0,0]:[0,1,0], x=cross(seed,z), length=Math.hypot.apply(null,x);
    x=x.map(function(v){return v/length;});
    return validateLocalFrame({version:1,ownership:'cad',faceId:faceId,originM:plane.originM,axes:[x,cross(z,x),z]},geometry.faceIds);
  }
  function resolveLocalFrame(frame,geometry){
    if(!frame)return {version:1,ownership:'global',originM:[0,0,0],axes:IDENTITY};
    var value=validateLocalFrame(frame,geometry&&geometry.faceIds);
    if(value.ownership==='cad'){
      if(!geometry || !geometry.planarFaces || !geometry.planarFaces[value.faceId])throw Error('The frame requires a validated planar CAD face.');
      var plane=geometry.planarFaces[value.faceId];
      if(dot(value.axes[2],plane.normal)<1-TOLERANCE)throw Error('The saved frame normal does not match its CAD face. Review the assignment.');
      value.axes=value.axes.map(function(axis){return api.transformVector3(geometry.orientation.rotation,axis);});
      value.originM=api.transformVector3(geometry.orientation.rotation,value.originM);
    }
    return value;
  }
  function assignmentDirections(item,geometry){return resolveLocalFrame(item.frame,geometry).axes;}
  function assignmentGlobalForce(item,geometry){return item.frame?localToGlobal(resolveLocalFrame(item.frame,geometry),item.forceN):item.forceN;}
  api.validateLocalFrame=validateLocalFrame;api.localToGlobal=localToGlobal;
  api.planarFaceFrame=planarFaceFrame;api.resolveLocalFrame=resolveLocalFrame;
  api.assignmentDirections=assignmentDirections;api.assignmentGlobalForce=assignmentGlobalForce;
}(globalThis));
