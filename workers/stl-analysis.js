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
 function build(gmsh,parsed,prepared,discreteBuilder){
  var result;
  if(prepared.method==='planar-boundaries'){
   var partition=planarPartition(parsed);
   if(!partition)fail('STL_SURFACE_FAILED','The prepared planar surface no longer matches the source.');
   result=root.StlReconstruction.build(gmsh,partition.parsed,parsed.diagonal*1e-8);
   var groups=parsed.patches.map(function(){return [];});result.surfaceTags.forEach(function(tags,i){groups[partition.sourceOwners[i]].push.apply(groups[partition.sourceOwners[i]],tags);});result.surfaceTags=groups;
  }else{
   var boundary=prepared.boundary,checked=root.StlImport.validateMesh(boundary,parsed.options),patches=parsed.patches.map(function(){return {triangleCount:0};});
   for(var i=0;i<boundary.patchByTriangle.length;i++){var owner=boundary.patchByTriangle[i];if(owner>=patches.length)fail('STL_PATCH_MAPPING_FAILED','The rebuilt surface lost a selection group.');patches[owner].triangleCount++;}
   if(patches.some(function(p){return !p.triangleCount;}))fail('STL_PATCH_MAPPING_FAILED','The rebuilt surface lost a selection group.');
   result=discreteBuilder(Object.assign({},checked,{patches:patches,patchByTriangle:boundary.patchByTriangle}));
  }
  var index=new root.StlSpatial.Index(parsed.positions,parsed.triangles),minimum=Infinity;
  for(i=0;i<prepared.targets.length;i++)minimum=Math.min(minimum,prepared.targets[i]);
  if(minimum!==prepared.minSizeM)fail('STL_SURFACE_FAILED','The local mesh sizing report is inconsistent.');
  result.analysis={parsed:parsed,index:index,method:prepared.method,estimatedElementCount:prepared.estimatedElementCount,thicknessM:prepared.thicknessM,minSizeM:minimum,maxSizeM:prepared.maxSizeM,field:new root.StlSpatial.Field(index,prepared.targets,prepared.maxSizeM,.35)};
  return result;
 }
 function sizing(analysis,settings){
  if(analysis.field)return {maxSizeM:analysis.maxSizeM,minSizeM:Math.min(settings.minSizeM,analysis.minSizeM/2)};
  var p=analysis.parsed,index=analysis.index,min=Infinity,targets=new Float64Array(p.triangles.length/3),minSize=Infinity;
  for(var i=0;i<targets.length;i++){
   var face=index.face(i),origin=[0,1,2].map(function(a){return(face[0][a]+face[1][a]+face[2][a])/3;}),direction=[-p.normals[i*3],-p.normals[i*3+1],-p.normals[i*3+2]];
   var thickness=index.ray(origin,direction,i,p.diagonal*1e-12);
   if(!Number.isFinite(thickness))fail('STL_THICKNESS_FAILED','A surface thickness could not be measured. Review the source geometry.');
   min=Math.min(min,thickness);
   var h=Math.min(settings.maxSizeM,thickness/3),tolerance=Math.min(p.diagonal*.001,thickness*.05);
   // Smooth curvature chord error ~ h²/(8R). Sharp ridges are constrained
   // explicitly by surface remeshing, rather than treated as infinite curvature.
   for(var edge=0;edge<3;edge++){
    var other=p.neighbors[i*3+edge];if(other<0)continue;
    var cosine=0;for(var a=0;a<3;a++)cosine+=p.normals[i*3+a]*p.normals[other*3+a];
    if(cosine<Math.cos(40*Math.PI/180)||cosine>1-1e-10)continue;
    var length=Math.hypot.apply(null,face[edge].map(function(v,a){return v-face[(edge+1)%3][a];}));
    var radius=length/(2*Math.sqrt((1-Math.min(1,cosine))/2));h=Math.min(h,Math.sqrt(8*tolerance*radius));
   }
   targets[i]=h;minSize=Math.min(minSize,h);
  }
  analysis.thicknessM=min;analysis.maxSizeM=settings.maxSizeM;analysis.minSizeM=minSize;
  analysis.field=new root.StlSpatial.Field(index,targets,settings.maxSizeM,.35);
  // Bounded midpoint integration of the graded field over the bounding box.
  // This is a workload estimate, not a guaranteed node count or memory bound.
  var inverse=0,extent=p.maximum.map(function(v,i){return v-p.minimum[i];});
  for(var x=0;x<8;x++)for(var y=0;y<8;y++)for(var z=0;z<8;z++){
   var h=analysis.field.at(p.minimum[0]+(x+.5)*extent[0]/8,p.minimum[1]+(y+.5)*extent[1]/8,p.minimum[2]+(z+.5)*extent[2]/8);inverse+=1/(h*h*h);
  }
  analysis.estimatedElementCount=Math.ceil(6*extent[0]*extent[1]*extent[2]*inverse/512);
  if(!Number.isSafeInteger(analysis.estimatedElementCount)||analysis.estimatedElementCount>1000000)fail('STL_ANALYSIS_LIMIT','The local size field would require a very large volume mesh. Use coarser settings or simplify thin features.');
  return {maxSizeM:settings.maxSizeM,minSizeM:Math.min(settings.minSizeM,minSize/2)};
 }
 function verify(analysis,positions,boundary,arity,collectRefinement){
  var p=analysis.parsed,ids=boundary.solverConnectivity,triangles=new Uint32Array(ids.length/arity*3),volume=0,compensation=0,sourceAreas=new Array(p.patches.length).fill(0);
  for(var i=0;i<triangles.length/3;i++)for(var j=0;j<3;j++)triangles[i*3+j]=ids[i*arity+j];
  var target=new root.StlSpatial.Index(positions,triangles),refine=new Uint8Array(p.triangles.length/3),badGroups=new Set();
  analysis.index.work=0;
  for(i=0;i<p.triangles.length/3;i++){var f=analysis.index.face(i),a=f[0],b=f[1],c=f[2];sourceAreas[p.patchByTriangle[i]]+=Math.hypot((b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;}
  for(i=0;i<triangles.length/3;i++){f=target.face(i).map(function(point){return point.map(function(v,k){return v-p.minimum[k];});});a=f[0];b=f[1];c=f[2];var term=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6-compensation,sum=volume+term;compensation=(sum-volume)-term;volume=sum;}
  var areaCheck=root.StlRemesh.boundaryDiagnostics(sourceAreas,positions,boundary,arity),volumeError=Math.abs(Math.abs(volume)/p.volume-1),areaError=0;
  areaCheck.areas.meshM2.forEach(function(area,k){var e=Math.abs(area/sourceAreas[k]-1);areaError=Math.max(areaError,e);if(e>.01)badGroups.add(k);});
  if(!collectRefinement&&(areaError>.01||volumeError>.01))fail('STL_FIDELITY_FAILED','The rebuilt boundary changed a selection-group area or solid volume by more than 1%. Refine the mesh and compare again.');
  var deviation=0,tolerance=p.diagonal*.001,ratio=0,samples=0;
  function sample(from,to,sourceDirection){
   var visited=new Uint8Array(from.positions.length/3),edges=new Set(),vertexCount=visited.length;
   function check(q,face){
    var d=to.distance(q),limit=Math.min(tolerance,analysis.field.at(q[0],q[1],q[2])*.15);
    deviation=Math.max(deviation,d);ratio=Math.max(ratio,d/limit);samples++;
    if(d>limit){
     var id=sourceDirection?face:to.nearestFace;refine[id]=1;
     // Shared samples affect both sides of their source neighborhood.
     for(var j=0;j<3;j++)refine[p.neighbors[id*3+j]]=1;
     if(!collectRefinement)fail('STL_FIDELITY_FAILED','The rebuilt boundary moved too far from the STL surface. Refine the mesh or review advanced surface settings.');
    }
   }
   for(var i=0;i<from.triangles.length/3;i++){
    var f=from.face(i);
    check([(f[0][0]+f[1][0]+f[2][0])/3,(f[0][1]+f[1][1]+f[2][1])/3,(f[0][2]+f[1][2]+f[2][2])/3],i);
    for(var j=0;j<3;j++){
     var id=from.triangles[i*3+j],next=from.triangles[i*3+(j+1)%3];
     if(!visited[id]){visited[id]=1;check(f[j],i);}
     var key=Math.min(id,next)*vertexCount+Math.max(id,next);
     if(!edges.has(key)){edges.add(key);check([(f[j][0]+f[(j+1)%3][0])/2,(f[j][1]+f[(j+1)%3][1])/2,(f[j][2]+f[(j+1)%3][2])/2],i);}
    }
   }
  }
  // Bidirectional vertex, edge-midpoint and facet-centroid sampling is evidence,
  // not a Hausdorff-distance certificate or proof of stress convergence.
  sample(analysis.index,target,true);sample(target,analysis.index,false);
  if(collectRefinement){var geometryGroups=new Set();for(i=0;i<refine.length;i++)if(refine[i])geometryGroups.add(p.patchByTriangle[i]);for(i=0;i<refine.length;i++)if(badGroups.has(p.patchByTriangle[i])&&!geometryGroups.has(p.patchByTriangle[i]))refine[i]=1;return {refine:refine,acceptable:ratio<=1&&areaError<=.01&&volumeError<=.01,areaError:areaError,volumeError:volumeError,maximumDeviationRatio:ratio};}
  return {areas:areaCheck.areas,report:{version:2,method:analysis.method,estimatedElementCount:analysis.estimatedElementCount,thicknessM:analysis.thicknessM,minSizeM:analysis.minSizeM,maxSizeM:analysis.maxSizeM,gradation:.35,maximumDeviationRatio:ratio,relativeVolumeError:volumeError,maximumRelativeAreaError:areaError,sampledDeviationM:deviation,deviationLimitM:tolerance,sampleCount:samples}};
 }
 root.StlAnalysis={build:build,sizing:sizing,verify:verify,planarPartition:planarPartition};
}(globalThis));
