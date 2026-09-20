/* Disposable surface preparation: its WASM is terminated before Gmsh starts. */
'use strict';
var WORKER_PROTOCOL_VERSION=4;
function surfaceFailure(code,message){var e=new Error(message);e.code=code;throw e;}
function surfaceBoundary(positions,triangles,owners,groupCount){
 var lists=Array.from({length:groupCount},function(){return [];});
 for(var i=0;i<owners.length;i++){if(owners[i]>=groupCount)surfaceFailure('STL_PATCH_MAPPING_FAILED','The rebuilt boundary lost its selection groups.');lists[owners[i]].push(triangles[3*i],triangles[3*i+1],triangles[3*i+2]);}
 var ids=new Uint32Array(triangles.length),ranges=[],offset=0;
 lists.forEach(function(list){if(!list.length)surfaceFailure('STL_PATCH_MAPPING_FAILED','A selection group disappeared during surface meshing.');ids.set(list,offset);ranges.push({start:offset,count:list.length});offset+=list.length;});
 return {solverConnectivity:ids,solverFaceRanges:ranges};
}
async function rebuildSurface(parsed,analysis,progress){
 var module=await createStlSolidRepair();
 if(module._surface_api_version()!==1)surfaceFailure('STL_SURFACE_VERSION','The surface engine does not match this application.');
 var origin=parsed.minimum.map(function(v,i){return(v+parsed.maximum[i])/2;}),p=parsed.positions.map(function(v,i){return(v-origin[i%3])/parsed.diagonal;}),t=parsed.triangles,g=parsed.patchByTriangle,targets=analysis.field.targets.slice();
 var pp=module._malloc(p.byteLength),tp=module._malloc(t.byteLength),gp=module._malloc(g.byteLength),hp=module._malloc(targets.byteLength);
 try{
  if(!pp||!tp||!gp||!hp)surfaceFailure('STL_ANALYSIS_LIMIT','The boundary mesh exceeded available memory.');
  module.HEAPF64.set(p,pp/8);module.HEAPU32.set(t,tp/4);module.HEAPU32.set(g,gp/4);
  for(var attempt=0;attempt<6;attempt++){
   progress(attempt?'Refining regions that exceed the surface tolerance…':'Meshing the STL surface without charts…');
   module.HEAPF64.set(targets.map(function(v){return v/parsed.diagonal;}),hp/8);
   var code=module._surface_remesh(pp,p.length/3,tp,t.length/3,gp,hp,Math.min(2,analysis.maxSizeM/parsed.diagonal));
   if(code)surfaceFailure(code===2?'STL_ANALYSIS_LIMIT':'STL_SURFACE_FAILED',code===2?'The surface mesh exceeded its work or facet limit. Use coarser settings or simplify very small features.':'The surface could not be remeshed while preserving its features.');
   var nv=module._surface_vertex_count(),nf=module._surface_facet_count();
   if(!Number.isSafeInteger(nv)||nv<4||nv>600000||!Number.isSafeInteger(nf)||nf<4||nf>200000)surfaceFailure('STL_SURFACE_FAILED','The surface engine returned invalid geometry.');
   var positions=module.HEAPF64.slice(module._surface_positions()/8,module._surface_positions()/8+nv*3),triangles=module.HEAPU32.slice(module._surface_triangles()/4,module._surface_triangles()/4+nf*3),owners=module.HEAPU32.slice(module._surface_groups()/4,module._surface_groups()/4+nf);
   positions.forEach(function(v,i){positions[i]=v*parsed.diagonal+origin[i%3];});
   progress('Checking boundary topology, selection areas and surface detail…');
   try{StlImport.validateMesh({positions:positions,triangles:triangles},parsed.options,false);}catch(error){
    if(error.code!=='STL_SELF_INTERSECTION')throw error;
    // Reject the candidate and refine only its offending source neighborhood.
    // No invalid remesh is repaired into a different accepted solid.
    var marked=new Uint8Array(targets.length);
    StlImport.validateIntersections(positions,triangles,function(first,second){
     [first,second].forEach(function(face){var q=[0,0,0];for(var j=0;j<3;j++)for(var axis=0;axis<3;axis++)q[axis]+=positions[triangles[face*3+j]*3+axis]/3;
      analysis.index.distance(q);var id=analysis.index.nearestFace;marked[id]=1;for(j=0;j<3;j++)marked[parsed.neighbors[id*3+j]]=1;});
    });
    marked.forEach(function(v,i){if(v)targets[i]*=.4;});continue;
   }
   var boundary=surfaceBoundary(positions,triangles,owners,parsed.patches.length),assessment=StlAnalysis.verify(analysis,positions,boundary,3,true);
   progress('Surface detail checked.',{attempt:attempt+1,facets:nf,wasmMemoryBytes:module.HEAPU8.buffer.byteLength,refinedSourceFacets:assessment.refine.reduce(function(n,v){return n+v;},0),areaError:assessment.areaError,volumeError:assessment.volumeError,maximumDeviationRatio:assessment.maximumDeviationRatio});
   if(assessment.acceptable)return {positions:positions,triangles:triangles,patchByTriangle:owners};
   var changed=false;
   assessment.refine.forEach(function(v,i){if(v){targets[i]*=.4;changed=true;}});
   if(!changed)break;
  }
  surfaceFailure('STL_FIDELITY_FAILED','The boundary could not meet the surface-detail tolerance within its refinement limit. Review small features or use a solid CAD source.');
 }finally{module._free(pp);module._free(tp);module._free(gp);module._free(hp);}
}
self.onmessage=async function(event){
 var m=event.data;
 function progress(message,detail){self.postMessage({protocol:WORKER_PROTOCOL_VERSION,type:'progress',requestId:m.requestId,progress:{stage:'stl-surface',userMessage:message,detail:detail||null}});}
 try{
  if(!m||m.protocol!==WORKER_PROTOCOL_VERSION||m.type!=='prepare-surface'||typeof m.requestId!=='string'||!(m.sourceBytes instanceof ArrayBuffer)||m.sourceBytes.byteLength>16*1024*1024||!m.settings||!Number.isFinite(m.settings.maxSizeM)||m.settings.maxSizeM<=0||!Number.isFinite(m.settings.minSizeM)||m.settings.minSizeM<=0||m.settings.minSizeM>m.settings.maxSizeM)surfaceFailure('STL_INVALID_SURFACE_REQUEST','The surface preparation request is invalid.');
  progress('Measuring local thickness and curvature…');
  var parsed=await StlImport.identify(StlImport.parse(m.sourceBytes,m.stlSource),m.sourceBytes);
  if(parsed.sourceHash!==m.sourceHash||!Array.isArray(m.faceIds)||parsed.patchIds.length!==m.faceIds.length||parsed.patchIds.some(function(id,i){return id!==m.faceIds[i];}))surfaceFailure('STL_PATCH_MAPPING_FAILED','The source no longer matches the assigned selection groups.');
  var analysis={parsed:parsed,index:new StlSpatial.Index(parsed.positions,parsed.triangles)};
  StlAnalysis.sizing(analysis,m.settings);
  var planar=StlAnalysis.planarPartition(parsed),boundary=planar?null:await rebuildSurface(parsed,analysis,progress);
  var result={version:1,sourceHash:parsed.sourceHash,faceIds:parsed.patchIds,method:planar?'planar-boundaries':'discrete-boundary',targets:analysis.field.targets,estimatedElementCount:analysis.estimatedElementCount,thicknessM:analysis.thicknessM,minSizeM:analysis.minSizeM,maxSizeM:analysis.maxSizeM,boundary:boundary};
  var transfers=[result.targets.buffer];if(boundary)transfers.push(boundary.positions.buffer,boundary.triangles.buffer,boundary.patchByTriangle.buffer);
  self.postMessage({protocol:WORKER_PROTOCOL_VERSION,type:'surface-result',requestId:m.requestId,result:result},transfers);
 }catch(e){self.postMessage({protocol:WORKER_PROTOCOL_VERSION,type:'error',requestId:m&&m.requestId,error:{code:e.code||'STL_SURFACE_FAILED',stage:'mesh',userMessage:e.message||'Surface preparation failed.',recoverable:true}});}
};
self.postMessage({protocol:WORKER_PROTOCOL_VERSION,type:'ready',worker:'stl-surface'});
