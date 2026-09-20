/* Analysis surfaces rebuild triangulation while retaining source group ownership. */
(function(root){
 'use strict';
 function fail(code,message){var e=new Error(message);e.code=code;throw e;}
 function planarPartition(parsed){
  var count=parsed.triangles.length/3,owners=new Int32Array(count);owners.fill(-1);
  var patches=[],sourceOwners=[],queue=new Uint32Array(count),p=parsed.positions,t=parsed.triangles,n=parsed.normals,tolerance=parsed.diagonal*1e-10;
  for(var seed=0;seed<count;seed++)if(owners[seed]<0){
   if(patches.length===512)return null;
   var id=patches.length,head=0,tail=1,source=parsed.patchByTriangle[seed],origin=t[seed*3]*3;
   queue[0]=seed;owners[seed]=id;
   while(head<tail){var face=queue[head++];for(var e=0;e<3;e++){var next=parsed.neighbors[face*3+e];if(next<0||owners[next]>=0||parsed.patchByTriangle[next]!==source)continue;
    var cosine=n[seed*3]*n[next*3]+n[seed*3+1]*n[next*3+1]+n[seed*3+2]*n[next*3+2];if(cosine<1-1e-12)continue;
    var coplanar=true;for(var j=0;j<3;j++){var v=t[next*3+j]*3,distance=0;for(var a=0;a<3;a++)distance+=(p[v+a]-p[origin+a])*n[seed*3+a];if(Math.abs(distance)>tolerance)coplanar=false;}
    if(coplanar){owners[next]=id;queue[tail++]=next;}
   }}
   patches.push({triangleCount:tail});sourceOwners.push(source);
  }
  return {parsed:Object.assign({},parsed,{patchByTriangle:owners,patches:patches}),sourceOwners:sourceOwners};
 }
 function build(gmsh,parsed){
  var partition=planarPartition(parsed),result;
  if(partition){
   result=root.StlReconstruction.build(gmsh,partition.parsed,parsed.diagonal*1e-8);
   var groups=parsed.patches.map(function(){return [];});result.surfaceTags.forEach(function(tags,i){groups[partition.sourceOwners[i]].push.apply(groups[partition.sourceOwners[i]],tags);});result.surfaceTags=groups;
  }else result=root.StlRemesh.build(gmsh,parsed,{remeshFeatureAngleDegrees:5});
  result.analysis={parsed:parsed,index:new root.StlSpatial.Index(parsed.positions,parsed.triangles),method:partition?'planar-boundaries':'discrete-charts'};
  return result;
 }
 function sizing(analysis,settings){
  var p=analysis.parsed,index=analysis.index,min=Infinity;
  // Sample every source facet, including small thin appendages. The conservative
  // global cap avoids a coarse interior between constrained boundary samples.
  for(var i=0;i<p.triangles.length/3;i++){
   var face=index.face(i),origin=[0,1,2].map(function(a){return(face[0][a]+face[1][a]+face[2][a])/3;}),direction=[-p.normals[i*3],-p.normals[i*3+1],-p.normals[i*3+2]];
   var thickness=index.ray(origin,direction,i,p.diagonal*1e-12);
   if(!Number.isFinite(thickness))fail('STL_THICKNESS_FAILED','A surface thickness could not be measured. Review the source geometry.');
   min=Math.min(min,thickness);
  }
  var size=Math.min(settings.maxSizeM,min/3);
  // Volume/size cubed is a lower-order workload estimate, not a memory promise.
  if(p.volume/(size*size*size)>250000)fail('STL_ANALYSIS_LIMIT','Resolving the thinnest feature would require a very large mesh. Simplify small features or use a solid CAD source.');
  analysis.thicknessM=min;analysis.maxSizeM=size;
  return {maxSizeM:size,minSizeM:Math.min(settings.minSizeM,size/2)};
 }
 function verify(analysis,positions,boundary,arity){
  var p=analysis.parsed,ids=boundary.solverConnectivity,triangles=new Uint32Array(ids.length/arity*3),volume=0,compensation=0,sourceAreas=new Array(p.patches.length).fill(0);
  for(var i=0;i<triangles.length/3;i++)for(var j=0;j<3;j++)triangles[i*3+j]=ids[i*arity+j];
  var target=new root.StlSpatial.Index(positions,triangles);
  for(i=0;i<p.triangles.length/3;i++){var f=analysis.index.face(i),a=f[0],b=f[1],c=f[2];sourceAreas[p.patchByTriangle[i]]+=Math.hypot((b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;}
  for(i=0;i<triangles.length/3;i++){f=target.face(i).map(function(point){return point.map(function(v,k){return v-p.minimum[k];});});a=f[0];b=f[1];c=f[2];var term=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6-compensation,sum=volume+term;compensation=(sum-volume)-term;volume=sum;}
  var areaCheck=root.StlRemesh.boundaryDiagnostics(sourceAreas,positions,boundary,arity),volumeError=Math.abs(Math.abs(volume)/p.volume-1),areaError=0;
  areaCheck.areas.meshM2.forEach(function(area,k){areaError=Math.max(areaError,Math.abs(area/sourceAreas[k]-1));});
  if(areaError>.01||volumeError>.01)fail('STL_FIDELITY_FAILED','The rebuilt boundary changed a selection-group area or solid volume by more than 1%. Refine the mesh and compare again.');
  var deviation=0,tolerance=Math.min(p.diagonal*.001,analysis.thicknessM*.05),samples=0;
  function sample(from,to){for(var i=0;i<from.triangles.length/3;i++){var f=from.face(i);var points=f.concat([[0,1,2].map(function(a){return(f[0][a]+f[1][a]+f[2][a])/3;})]);for(var j=0;j<3;j++)points.push([0,1,2].map(function(a){return(f[j][a]+f[(j+1)%3][a])/2;}));for(var q of points){deviation=Math.max(deviation,to.distance(q));samples++;if(deviation>tolerance)fail('STL_FIDELITY_FAILED','The rebuilt boundary moved too far from the STL surface. Refine the mesh or review advanced surface settings.');}}}
  // Bidirectional vertex, edge-midpoint and facet-centroid sampling is evidence,
  // not a Hausdorff-distance certificate or proof of stress convergence.
  sample(analysis.index,target);sample(target,analysis.index);
  return {areas:areaCheck.areas,report:{version:1,method:analysis.method,thicknessM:analysis.thicknessM,maxSizeM:analysis.maxSizeM,relativeVolumeError:volumeError,maximumRelativeAreaError:areaError,sampledDeviationM:deviation,deviationLimitM:tolerance,sampleCount:samples}};
 }
 root.StlAnalysis={build:build,sizing:sizing,verify:verify};
}(globalThis));
