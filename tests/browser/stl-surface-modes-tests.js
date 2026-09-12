(function(){
 'use strict';var status=document.getElementById('test-status');
 function assert(value,message){if(!value)throw new Error(message);}
 document.getElementById('application-frame').addEventListener('load',async function(){
  var win=this.contentWindow,api=win.SpjutsimFEA,evidence=[];
  function options(mode,tolerance){return {version:2,lengthUnit:'m',patchAngleDegrees:40,normalization:'none',surfaceMode:mode,reconstructionToleranceM:tolerance};}
  async function run(name,mode,tolerance,supplied){
   var source=supplied?new win.Uint8Array(new Uint8Array(supplied)).buffer:await(await win.fetch('../tests/fixtures/stl/'+name)).arrayBuffer(),client=new api.MesherClient(),geometry,mesh;
   try{geometry=await client.importGeometry({sourceName:name,sourceFormat:'stl',sourceBytes:source,importOptions:options(mode,tolerance)});}catch(error){error.message=name+': '+error.message;throw error;}finally{client.dispose();}
   client=new api.MesherClient();try{mesh=await client.generateMesh({geometry:geometry,sourceBytes:source,settings:{preset:'coarse',elementType:'tet10'}});}finally{client.dispose();}
   evidence.push({name:name,mode:mode,sourceTriangles:geometry.sourceMetadata.triangleCount,surfaces:geometry.sourceMetadata.internalSurfaceCount,volumeM3:geometry.volumeM3,maximumDeviationM:geometry.sourceMetadata.reconstruction?geometry.sourceMetadata.reconstruction.maximumDeviationM:null,statistics:mesh.statistics,quality:mesh.quality});
   return {geometry:geometry,mesh:mesh,source:source};
  }
  try{
   assert(api.validateStlOptions(options('original',null)),'Original-surface options are unavailable');
   assert(api.validateStlOptions(options('reconstruct',.003)),'Reconstruction options are unavailable');
   assert(!api.validateStlOptions(options('reconstruct',0)),'Zero reconstruction tolerance accepted');
   assert(!api.sameStlOptions(options('reconstruct',.003),options('reconstruct',.004)),'Tolerance changes do not invalidate geometry');
   var cube=await run('cube-binary.stl','reconstruct',.00001);
   assert(cube.geometry.faceIds.length===6&&Math.abs(cube.geometry.volumeM3-1)<1e-8,'Reconstructed cube lost planes or volume');
   var denseCube=await run('subdivided-cube.stl','reconstruct',1e-5,StlTestShapes.subdividedCube(16));
   assert(denseCube.mesh.statistics.elementCount<cube.mesh.statistics.elementCount*2,'Redundant straight boundary vertices forced excess mesh refinement: '+denseCube.mesh.statistics.elementCount+' versus '+cube.mesh.statistics.elementCount);
   var cylinder=await run('cylinder-32.stl','reconstruct',.003);
   assert(Math.abs(cylinder.geometry.volumeM3-Math.PI/4)<1e-7,'Reconstructed cylinder retained polygonal volume: '+cylinder.geometry.volumeM3);
   assert(cylinder.geometry.sourceMetadata.reconstruction.surfaces.filter(function(s){return s.kind==='cylinder';}).length===1,'Recovered cylinder is not reported');
   assert(cylinder.geometry.sourceMetadata.reconstruction.maximumDeviationM<=.003,'Reconstruction exceeded the selected tolerance');
   assert(cylinder.geometry.originalPreview&&cylinder.geometry.originalPreview.indices.length===128*3,'Original STL comparison was not retained');
   var mesh=cylinder.mesh,range=mesh.boundaryFaces.faceRanges[cylinder.geometry.sourceMetadata.reconstruction.surfaces.findIndex(function(s){return s.kind==='cylinder';})];
   var ids=mesh.boundaryFaces.triangleConnectivity;
   for(var i=range.start;i<range.start+range.count;i++){var n=ids[i]*3;assert(Math.abs(Math.hypot(mesh.nodePositionsM[n],mesh.nodePositionsM[n+1])-.5)<1e-7,'Curved Tet10 boundary does not lie on the recovered cylinder');}
   var cone=await run('rotated-cone.stl','reconstruct',.006,StlTestShapes.round(32,.5,true));
   assert(Math.abs(cone.geometry.volumeM3-7*Math.PI/12)<1e-8,'Rotated cone reconstruction has incorrect volume');
   var tube=await run('square-tube.stl','reconstruct',1e-5,StlTestShapes.squareTube());
   assert(tube.geometry.faceIds.length===10&&Math.abs(tube.geometry.volumeM3-3)<1e-8,'Planar reconstruction filled or lost the through-hole');
   var large=await run('dense-cylinder.stl','reconstruct',1e-4,StlTestShapes.round(1024,0,false));
   assert(large.geometry.sourceMetadata.triangleCount===4096&&large.geometry.sourceMetadata.internalSurfaceCount===3,'Dense STL did not reduce to three surfaces');
   var original=await run('cylinder-32.stl','original',null);
   assert(original.mesh.statistics.boundaryElementCount===128,'Original-surface mode changed source triangulation');
   assert(original.geometry.volumeM3<cylinder.geometry.volumeM3,'Original and recovered surfaces were conflated');
   assert(!api.validateGeometryModel(Object.assign({},cylinder.geometry,{sourceMetadata:Object.assign({},cylinder.geometry.sourceMetadata,{reconstruction:Object.assign({},cylinder.geometry.sourceMetadata.reconstruction,{maximumDeviationM:.004})})})).valid,'An exceeded geometric deviation passed the data boundary');
   var cancelled=false,client=new api.MesherClient({onProgress:function(progress){if(!cancelled&&progress.stage==='stl-reconstruct'){cancelled=true;client.cancel();}}}),failed;
   try{await client.importGeometry({sourceName:'cylinder-32.stl',sourceFormat:'stl',sourceBytes:cylinder.source,importOptions:options('reconstruct',.003)});}catch(error){failed=error.diagnostic;}
   assert(cancelled&&failed&&failed.code==='IMPORT_CANCELLED','Reconstruction cancellation did not terminate the review');
   client=new api.MesherClient();
   try{var recovered=await client.importGeometry({sourceName:'cylinder-32.stl',sourceFormat:'stl',sourceBytes:cylinder.source,importOptions:options('reconstruct',.003)});assert(recovered.faceIds.join()===cylinder.geometry.faceIds.join(),'Fresh-worker reconstruction changed source identity after cancellation');}finally{client.dispose();}
   client=new api.MesherClient();failed=null;
   try{await client.generateMesh({geometry:Object.assign({},cylinder.geometry,{importOptions:options('reconstruct',.004),sourceMetadata:Object.assign({},cylinder.geometry.sourceMetadata,{reconstruction:Object.assign({},cylinder.geometry.sourceMetadata.reconstruction,{toleranceM:.004})})}),sourceBytes:cylinder.source,settings:{preset:'coarse',elementType:'tet10'}});}catch(error){failed=error.diagnostic;}finally{client.dispose();}
   assert(failed&&failed.code==='STL_PATCH_MAPPING_FAILED','Changed reconstruction tolerance reused old assignments');
   client=new api.MesherClient();failed=null;
   try{await client.importGeometry({sourceName:'cylinder-32.stl',sourceFormat:'stl',sourceBytes:cylinder.source,importOptions:options('reconstruct',1e-6)});}catch(error){failed=error.diagnostic;}finally{client.dispose();}
   assert(failed&&failed.code==='STL_RECONSTRUCTION_UNSUPPORTED','Unfittable reconstruction did not give an actionable error');
   window.__stlSurfaceEvidence={cases:evidence,cancellationVerified:cancelled,staleIdentityRejected:true};
   status.textContent='Passed';status.dataset.result='passed';
  }catch(error){status.textContent=error.message;status.dataset.result='failed';}
 });
}());
