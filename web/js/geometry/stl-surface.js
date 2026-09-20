(function(root){
 'use strict';
 // Cheap envelope validation on the UI thread; strict geometry checks remain
 // in workers. All sizes and positions are SI, before rigid model orientation.
 function valid(result,sourceHash,faceIds,sourceFacetCount,maxSize){
  if(!result||result.version!==1||result.sourceHash!==sourceHash||!Array.isArray(result.faceIds)||result.faceIds.length!==faceIds.length||result.faceIds.some(function(id,i){return id!==faceIds[i];})||!['planar-boundaries','discrete-boundary'].includes(result.method))return false;
  if(!Number.isSafeInteger(result.estimatedElementCount)||result.estimatedElementCount<1||result.estimatedElementCount>1000000)return false;
  if(!(result.targets instanceof Float64Array)||result.targets.length!==sourceFacetCount||!['thicknessM','minSizeM','maxSizeM'].every(function(k){return Number.isFinite(result[k])&&result[k]>0;})||result.maxSizeM!==maxSize||result.minSizeM>result.thicknessM/3||result.minSizeM>maxSize)return false;
  if(result.method==='planar-boundaries')return result.boundary===null;
  var b=result.boundary;
  return !!(b&&b.positions instanceof Float64Array&&b.positions.length>=12&&b.positions.length<=1800000&&b.positions.length%3===0&&b.triangles instanceof Uint32Array&&b.triangles.length>=12&&b.triangles.length<=600000&&b.triangles.length%3===0&&b.patchByTriangle instanceof Uint32Array&&b.patchByTriangle.length===b.triangles.length/3);
 }
 root.SpjutsimFEA=root.SpjutsimFEA||{};
 root.SpjutsimFEA.validateStlSurfaceResult=valid;
}(globalThis));
