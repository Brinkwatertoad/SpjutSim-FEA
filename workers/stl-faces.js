/* Selection regions on the source surface, independent of analysis triangulation. */
(function(root){
 'use strict';
 function fail(code,message){var e=new Error(message);e.code=code;throw e;}
 function group(mesh,angle,edits){
  var p=mesh.positions,t=mesh.triangles,n=mesh.normals,adj=mesh.neighbors,count=t.length/3,queue=new Uint32Array(count),cosine=Math.cos(angle*Math.PI/180);
  function dot(a,b){return n[3*a]*n[3*b]+n[3*a+1]*n[3*b+1]+n[3*a+2]*n[3*b+2];}
  // Anchor each plane to its seed: adjacent near-parallel triangles alone can
  // otherwise drift all the way around a smooth surface. Tolerance only labels
  // faces; it never moves source coordinates.
  var planes=new Int32Array(count);planes.fill(-1);var areas=[],members=[];
  for(var seed=0;seed<count;seed++){
   if(planes[seed]>=0)continue;
   var id=areas.length,head=0,tail=1,area=0,origin=t[3*seed]*3,faces=[];queue[0]=seed;planes[seed]=id;
   while(head<tail){
    var face=queue[head++];faces.push(face);
    var a=t[3*face]*3,b=t[3*face+1]*3,c=t[3*face+2]*3,ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];
    area+=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)/2;
    for(var edge=0;edge<3;edge++){
     var other=adj[3*face+edge];if(planes[other]>=0||dot(seed,other)<1-1e-10)continue;
     var onPlane=true;for(var v=0;v<3;v++){var q=t[3*other+v]*3,d=0;for(var axis=0;axis<3;axis++)d+=(p[q+axis]-p[origin+axis])*n[3*seed+axis];if(Math.abs(d)>mesh.diagonal*1e-7){onPlane=false;break;}}
     if(onPlane){planes[other]=id;queue[tail++]=other;}
    }
   }
   areas.push(area);members.push(faces);
  }
  // Preserve planar cores adjoining much smaller curved tessellation strips.
  // Equal-size strips on a cylinder are not independent engineering faces.
  var neighborArea=new Float64Array(areas.length);
  for(face=0;face<count;face++)for(edge=0;edge<3;edge++){
   other=adj[3*face+edge];if(planes[face]!==planes[other]&&dot(face,other)>=cosine)neighborArea[planes[face]]=Math.max(neighborArea[planes[face]],areas[planes[other]]);
  }
  var core=areas.map(function(area,i){return members[i].length>=2&&area>=4*neighborArea[i];});
  var owners=new Int32Array(count);owners.fill(-1);var groups=[];
  // Keep the existing deterministic source ordering, including unchanged faces.
  for(seed=0;seed<count;seed++){
   if(owners[seed]>=0)continue;
   id=groups.length;head=0;tail=1;queue[0]=seed;owners[seed]=id;faces=[];
   while(head<tail){face=queue[head++];faces.push(face);for(edge=0;edge<3;edge++){
    other=adj[3*face+edge];if(owners[other]>=0||dot(face,other)<cosine)continue;
    if(planes[face]!==planes[other]&&(core[planes[face]]||core[planes[other]]))continue;
    owners[other]=id;queue[tail++]=other;
   }}
   groups.push(faces);
  }
  function assign(){owners.fill(-1);groups.forEach(function(list,index){list.forEach(function(f){owners[f]=index;});});}
  if(edits)for(var edit of edits.operations){
   var selected=edit.faceIndices;
   if(selected.some(function(i){return i>=groups.length;}))fail('STL_FACE_EDIT_INVALID','The selected faces no longer match this source. Reset face corrections and try again.');
   if(edit.type==='merge'){
    var wanted=new Set(selected),visited=new Set([selected[0]]),pending=[selected[0]];
    while(pending.length){var g=pending.pop();for(face of groups[g])for(edge=0;edge<3;edge++){var next=owners[adj[3*face+edge]];if(wanted.has(next)&&!visited.has(next)){visited.add(next);pending.push(next);}}}
    if(visited.size!==wanted.size)fail('STL_FACE_EDIT_DISCONNECTED','Select faces that touch each other before merging.');
    var combined=[];selected.forEach(function(i){for(var f of groups[i])combined.push(f);});
    var first=Math.min.apply(null,selected);groups=groups.filter(function(list,i){return !wanted.has(i)||i===first;}).map(function(list,i){return i===first?combined:list;});
   }else{
    var selectedId=selected[0],source=groups[selectedId];if(source.length<2)fail('STL_FACE_EDIT_TOO_SMALL','This face contains one source triangle and cannot be split further.');
    // Two graph-distance seeds partition only this face. Each resulting region
    // is connected; source triangles, area and volume remain exactly unchanged.
    function farthest(start){var seen=new Set([start]),head=0,tail=1;queue[0]=start;while(head<tail){var f=queue[head++];for(var e=0;e<3;e++){var o=adj[3*f+e];if(owners[o]===selectedId&&!seen.has(o)){seen.add(o);queue[tail++]=o;}}}return queue[tail-1];}
    var firstSeed=farthest(source[0]),secondSeed=farthest(firstSeed),labels=new Int8Array(count);labels.fill(-1);labels[firstSeed]=0;labels[secondSeed]=1;queue[0]=firstSeed;queue[1]=secondSeed;head=0;tail=2;
    while(head<tail){face=queue[head++];for(edge=0;edge<3;edge++){other=adj[3*face+edge];if(owners[other]===selectedId&&labels[other]<0){labels[other]=labels[face];queue[tail++]=other;}}}
    var parts=[[],[]];source.forEach(function(f){parts[labels[f]].push(f);});groups.splice(selectedId,1,parts[0],parts[1]);
   }
   assign();
   if(groups.length>512)fail('STL_PATCH_LIMIT','Splitting would exceed 512 selectable faces. Merge other regions first.');
  }
  return {patchByTriangle:new Uint32Array(owners),patches:groups.map(function(list,i){return{index:i,triangleCount:list.length};})};
 }
 root.StlFaces={group:group};
}(globalThis));
