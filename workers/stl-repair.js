/* Opt-in local STL repair. Decoding is not validation; serialized candidates
 * must pass the unchanged solid validator before leaving this worker. */
(function(root){
  'use strict';
  function fail(message){var error=new Error(message);error.code='STL_REPAIR_UNSUPPORTED';throw error;}
  function key(a,b){return Math.min(a,b)+':'+Math.max(a,b);}
  function edgeMap(triangles){
    var edges=new Map();
    for(var i=0;i<triangles.length;i+=3)for(var j=0;j<3;j++){
      var a=triangles[i+j],b=triangles[i+(j+1)%3],id=key(a,b),edge=edges.get(id);
      if(!edge)edges.set(id,{a:a,b:b,first:i/3,second:-1,count:1,same:false});
      else{edge.count++;edge.second=i/3;edge.same=edge.a===a;}
    }
    return edges;
  }
  function edgeCounts(edges){var open=0,nonManifold=0;edges.forEach(function(e){if(e.count===1)open++;if(e.count>2)nonManifold++;});return{openEdges:open,nonManifoldEdges:nonManifold};}
  function areaVector(positions,a,b,c){
    var ux=positions[b*3]-positions[a*3],uy=positions[b*3+1]-positions[a*3+1],uz=positions[b*3+2]-positions[a*3+2];
    var vx=positions[c*3]-positions[a*3],vy=positions[c*3+1]-positions[a*3+1],vz=positions[c*3+2]-positions[a*3+2];
    return[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
  }
  function orient(triangles,edges,flipped){
    var count=triangles.length/3,signs=new Int8Array(count),queue=new Uint32Array(count),components=0;signs.fill(-1);
    for(var first=0;first<count;first++){
      if(signs[first]!==-1)continue;
      components++;var head=0,tail=1;queue[0]=first;signs[first]=0;
      while(head<tail){
        var face=queue[head++];
        for(var j=0;j<3;j++){
          var edge=edges.get(key(triangles[face*3+j],triangles[face*3+(j+1)%3]));
          if(edge.count>2)fail('Branching edges remain. Local repair cannot choose which surface belongs to the solid.');
          if(edge.count!==2)continue;
          var neighbor=edge.first===face?edge.second:edge.first,wanted=signs[face]^(edge.same?1:0);
          if(signs[neighbor]===-1){signs[neighbor]=wanted;queue[tail++]=neighbor;}
          else if(signs[neighbor]!==wanted)fail('The surface cannot be oriented consistently. Rebuild this region in the source application.');
        }
      }
    }
    if(components!==1)fail(components+' disconnected surface components remain. Local repair will not discard parts or join them with new material.');
    for(var i=0;i<count;i++)if(signs[i]){var b=triangles[i*3+1];triangles[i*3+1]=triangles[i*3+2];triangles[i*3+2]=b;flipped[i]^=1;}
  }
  function fillHoles(triangles,positions,edges,diagonal,ratio,report){
    var next=new Map(),incoming=new Set();
    edges.forEach(function(e){if(e.count===1){if(next.has(e.a)||incoming.has(e.b))fail('A hole boundary branches or meets itself. Local hole filling cannot repair it.');next.set(e.a,e.b);incoming.add(e.b);}});
    var additions=[];
    while(next.size){
      if(report.filledHoles>=128)fail('More than 128 holes need repair. Repair the surface in the source application.');
      var first=next.keys().next().value,current=first,loop=[];
      do{
        if(loop.length>=32||!next.has(current))fail('A hole has an unsupported boundary (maximum 32 vertices per simple loop).');
        loop.push(current);var following=next.get(current);next.delete(current);current=following;
      }while(current!==first);
      if(loop.length<3)fail('A hole has fewer than three distinct vertices.');
      var diameter=0;
      for(var i=0;i<loop.length;i++)for(var j=i+1;j<loop.length;j++){
        var a=loop[i]*3,b=loop[j]*3;
        diameter=Math.max(diameter,Math.hypot(positions[a]-positions[b],positions[a+1]-positions[b+1],positions[a+2]-positions[b+2]));
      }
      if(!(ratio>0&&diameter<=diagonal*ratio))fail('A hole is larger than the selected repair limit, or hole filling is disabled. Increase the limit only if closing it matches the intended part.');
      var normal=areaVector(positions,loop[0],loop[1],loop[2]),length=Math.hypot.apply(null,normal);
      if(!(length>diagonal*diagonal*1e-14))fail('A hole boundary is degenerate; local filling cannot resolve it.');
      normal=normal.map(function(v){return v/length;});var origin=loop[0]*3;
      for(i=0;i<loop.length;i++){
        a=loop[i]*3;
        var distance=(positions[a]-positions[origin])*normal[0]+(positions[a+1]-positions[origin+1])*normal[1]+(positions[a+2]-positions[origin+2])*normal[2];
        if(Math.abs(distance)>diagonal*1e-10)fail('A hole is not flat. Local repair only fills small flat convex holes.');
        // Strict convexity excludes ambiguous/collinear triangulations. The full
        // intersection validator additionally rejects crossing boundary loops.
        var turn=areaVector(positions,loop[i],loop[(i+1)%loop.length],loop[(i+2)%loop.length]);
        if(turn[0]*normal[0]+turn[1]*normal[1]+turn[2]*normal[2]<=diagonal*diagonal*1e-14)fail('A hole is not strictly convex. Local repair cannot fill it without guessing its shape.');
      }
      for(i=1;i<loop.length-1;i++)additions.push(loop[0],loop[i+1],loop[i]);
      report.filledHoles++;report.maximumFilledHoleDiameterM=Math.max(report.maximumFilledHoleDiameterM,diameter);
    }
    report.addedTriangles=additions.length/3;
    if(triangles.length/3+report.addedTriangles>200000)fail('The repaired surface would exceed 200,000 triangles.');
    var result=new Uint32Array(triangles.length+additions.length);result.set(triangles);result.set(additions,triangles.length);return result;
  }
  function serialize(triangles,coordinates,offsets){
    var binary=true,checked=new Uint8Array(offsets.length);
    for(var i=0;i<triangles.length&&binary;i++){
      var node=triangles[i];if(checked[node])continue;checked[node]=1;
      for(var axis=0;axis<3;axis++){var v=coordinates[offsets[node]+axis];if(Math.fround(v)!==v){binary=false;break;}}
    }
    if(binary){
      var bytes=new ArrayBuffer(84+triangles.length/3*50),view=new DataView(bytes);view.setUint32(80,triangles.length/3,true);
      for(i=0;i<triangles.length;i++)for(axis=0;axis<3;axis++)view.setFloat32(84+Math.floor(i/3)*50+12+(i%3)*12+axis*4,coordinates[offsets[triangles[i]]+axis],true);
      return bytes;
    }
    var lines=['solid repaired'],size=15;
    for(i=0;i<triangles.length;i+=3){
      var record='facet normal 0 0 0\nouter loop\n';
      for(var j=0;j<3;j++){var offset=offsets[triangles[i+j]];record+='vertex '+coordinates[offset]+' '+coordinates[offset+1]+' '+coordinates[offset+2]+'\n';}
      record+='endloop\nendfacet\n';size+=record.length+1;
      if(size+20>16*1024*1024)fail('Preserving the original coordinate precision would exceed the 16 MiB output limit.');
      lines.push(record);
    }
    lines.push('endsolid repaired');var result=new TextEncoder().encode(lines.join('\n')).buffer;
    if(result.byteLength>16*1024*1024)fail('The repaired STL exceeds the 16 MiB output limit.');return result;
  }
  async function digest(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),function(v){return v.toString(16).padStart(2,'0');}).join('');}
  async function repair(bytes,options,settings){
    if(!settings||settings.version!==1||!Number.isFinite(settings.maxHoleDiameterRatio)||settings.maxHoleDiameterRatio<0||settings.maxHoleDiameterRatio>.05){var error=new Error('Choose a maximum hole width from 0% through 5% of the part diagonal.');error.code='STL_INVALID_REPAIR_OPTIONS';throw error;}
    var mesh=root.StlImport.readUnvalidated(bytes,options),triangles=mesh.triangles,positions=mesh.positions,count=triangles.length/3;
    var report={version:1,method:'local-stl-repair',lengthUnit:options.lengthUnit,maxHoleDiameterRatio:settings.maxHoleDiameterRatio,
      originalBoundingBoxM:{minM:mesh.minimum.slice(),maxM:mesh.maximum.slice()},sourceDiagonalM:mesh.diagonal,originalTriangleCount:count,repairedTriangleCount:0,removedDuplicateTriangles:0,removedZeroAreaTriangles:0,removedLooseTriangles:0,
      flippedTriangles:0,filledHoles:0,addedTriangles:0,maximumFilledHoleDiameterM:0};
    var offsets=new Uint32Array(positions.length/3),active=new Uint8Array(count),unique=new Set();active.fill(1);
    for(var i=0;i<triangles.length;i++)offsets[triangles[i]]=i*3;
    for(i=0;i<count;i++){
      var a=triangles[i*3],b=triangles[i*3+1],c=triangles[i*3+2],normal=areaVector(positions,a,b,c);
      if(normal.every(function(v){return v===0;})&&root.StlImport.isZeroArea(positions,a,b,c)){active[i]=0;report.removedZeroAreaTriangles++;continue;}
      var id=[a,b,c].sort(function(x,y){return x-y;}).join(':');
      if(unique.has(id)){active[i]=0;report.removedDuplicateTriangles++;}else unique.add(id);
    }
    function compact(){var size=active.reduce(function(sum,v){return sum+v;},0),output=new Uint32Array(size*3),offset=0;for(var j=0;j<active.length;j++)if(active[j]){output.set(triangles.subarray(j*3,j*3+3),offset);offset+=3;}triangles=output;active=new Uint8Array(size);active.fill(1);}
    compact();if(!triangles.length)fail('Cleanup leaves no usable triangles.');
    var edges=edgeMap(triangles);report.before=edgeCounts(edges);
    // Only remove isolated flaps whose every edge is open or over-subscribed.
    // Never cut into an edge currently shared by exactly two retained faces.
    for(i=0;i<active.length;i++){
      var faceEdges=[0,1,2].map(function(j){return edges.get(key(triangles[i*3+j],triangles[i*3+(j+1)%3]));});
      if(faceEdges.some(function(e){return e.count===1;})&&faceEdges.some(function(e){return e.count>2;})&&faceEdges.every(function(e){return e.count!==2;})){
        active[i]=0;report.removedLooseTriangles++;faceEdges.forEach(function(e){e.count--;});
      }
    }
    compact();if(!triangles.length)fail('Cleanup leaves no usable surface.');
    var minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity];
    for(i=0;i<triangles.length;i++)for(var axis=0;axis<3;axis++){
      var value=positions[triangles[i]*3+axis];minimum[axis]=Math.min(minimum[axis],value);maximum[axis]=Math.max(maximum[axis],value);
    }
    var diagonal=Math.hypot(maximum[0]-minimum[0],maximum[1]-minimum[1],maximum[2]-minimum[2]);
    if(!(diagonal>=1e-9&&diagonal<=1e6))fail('Cleanup leaves a surface outside the supported size range.');
    report.holeLimitDiagonalM=diagonal;
    edges=edgeMap(triangles);var flipped=new Uint8Array(triangles.length/3);
    orient(triangles,edges,flipped);edges=edgeMap(triangles);
    triangles=fillHoles(triangles,positions,edges,diagonal,settings.maxHoleDiameterRatio,report);
    var volume=0,correction=0;
    for(i=0;i<triangles.length;i+=3){normal=areaVector(positions,triangles[i],triangles[i+1],triangles[i+2]);a=triangles[i]*3;
      var term=((positions[a]-minimum[0])*normal[0]+(positions[a+1]-minimum[1])*normal[1]+(positions[a+2]-minimum[2])*normal[2])/6-correction;
      var sum=volume+term;correction=(sum-volume)-term;volume=sum;
    }
    if(volume<0){for(i=0;i<triangles.length;i+=3){b=triangles[i+1];triangles[i+1]=triangles[i+2];triangles[i+2]=b;}for(i=0;i<flipped.length;i++)flipped[i]^=1;}
    report.flippedTriangles=flipped.reduce(function(sum,v){return sum+v;},0);
    var candidate=serialize(triangles,mesh.coordinates,offsets),parsed;
    try{parsed=root.StlImport.parse(candidate,options);}catch(error){if(error.code&&error.code.indexOf('STL_')===0)fail('Local repair did not produce a valid solid: '+error.message);throw error;}
    report.repairedTriangleCount=parsed.triangles.length/3;report.validation=parsed.validation;
    report.repairedBoundingBoxM={minM:parsed.minimum,maxM:parsed.maximum};
    report.originalSha256=await digest(bytes);report.repairedSha256=await digest(candidate);
    return{version:1,sourceBytes:candidate,report:report};
  }
  root.StlRepair={repair:repair};
}(globalThis));
