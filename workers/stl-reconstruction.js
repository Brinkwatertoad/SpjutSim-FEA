/* Primitive recovery from validated STL patches. All distances are in meters. */
(function(root) {
  'use strict';
  function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
  function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
  function unit(a){var n=Math.hypot.apply(null,a);return a.map(function(v){return v/n;});}
  function eigen(matrix) {
    var a=matrix.slice(),v=[1,0,0,0,1,0,0,0,1];
    for(var iteration=0;iteration<40;iteration++) {
      var p=0,q=1;
      if(Math.abs(a[2])>Math.abs(a[1]))q=2;
      if(Math.abs(a[5])>Math.abs(a[p*3+q])){p=1;q=2;}
      if(Math.abs(a[p*3+q])<=Number.EPSILON*Math.max(1e-30,Math.abs(a[0])+Math.abs(a[4])+Math.abs(a[8])))break;
      var angle=.5*Math.atan2(2*a[p*3+q],a[q*3+q]-a[p*3+p]),c=Math.cos(angle),s=Math.sin(angle);
      for(var k=0;k<3;k++){var x=a[k*3+p],y=a[k*3+q];a[k*3+p]=c*x-s*y;a[k*3+q]=s*x+c*y;}
      for(k=0;k<3;k++){x=a[p*3+k];y=a[q*3+k];a[p*3+k]=c*x-s*y;a[q*3+k]=s*x+c*y;}
      for(k=0;k<3;k++){x=v[k*3+p];y=v[k*3+q];v[k*3+p]=c*x-s*y;v[k*3+q]=s*x+c*y;}
    }
    var indices=[0,1,2].sort(function(i,j){return a[i*3+i]-a[j*3+j];});
    return indices.map(function(i){return {value:a[i*3+i],vector:unit([v[i],v[3+i],v[6+i]])};});
  }
  function solve(a,b) {
    var n=b.length;a=a.map(function(row){return row.slice();});b=b.slice();
    var scale=Math.max.apply(null,a.map(function(row){return Math.max.apply(null,row.map(Math.abs));}));
    for(var k=0;k<n;k++) {
      var pivot=k;for(var i=k+1;i<n;i++)if(Math.abs(a[i][k])>Math.abs(a[pivot][k]))pivot=i;
      if(Math.abs(a[pivot][k])<1e-12*scale)return null;
      var row=a[k];a[k]=a[pivot];a[pivot]=row;var temp=b[k];b[k]=b[pivot];b[pivot]=temp;
      for(i=k+1;i<n;i++){var f=a[i][k]/a[k][k];for(var j=k;j<n;j++)a[i][j]-=f*a[k][j];b[i]-=f*b[k];}
    }
    var result=new Array(n);for(i=n-1;i>=0;i--){temp=b[i];for(j=i+1;j<n;j++)temp-=a[i][j]*result[j];result[i]=temp/a[i][i];}return result;
  }
  function basis(axis) {
    var seed=Math.abs(axis[0])<.8?[1,0,0]:[0,1,0],u=unit(cross(axis,seed));return [u,cross(axis,u)];
  }
  function coordinates(surface,point) {
    var d=point.map(function(v,i){return v-surface.originM[i];});
    return [dot(d,surface.u),dot(d,surface.v),dot(d,surface.axis)];
  }
  function deviation(surface,parsed,faces) {
    var maximum=0,normalization=Math.hypot(1,surface.slope||0);
    function value(p){return Math.hypot(p[0],p[1])-surface.radiusM-surface.slope*p[2];}
    for(var face of faces) {
      var points=[];
      for(var i=0;i<3;i++) {
        var id=parsed.triangles[face*3+i]*3,p=coordinates(surface,Array.from(parsed.positions.subarray(id,id+3)));points.push(p);
        maximum=Math.max(maximum,Math.abs(surface.kind==='plane'?p[2]:value(p)/normalization));
      }
      if(surface.kind==='plane')continue;
      // The radial distance minus a linear axial radius is convex. Its maximum
      // is at a vertex; minima lie on edges or the projected axis intersection.
      for(i=0;i<3;i++) {
        var a=points[i],b=points[(i+1)%3],d=b.map(function(v,j){return v-a[j];});
        function derivative(t){var x=a[0]+t*d[0],y=a[1]+t*d[1],r=Math.hypot(x,y);return r?(x*d[0]+y*d[1])/r-surface.slope*d[2]:0;}
        if(derivative(0)<0 && derivative(1)>0){var lo=0,hi=1;for(var step=0;step<40;step++){var mid=(lo+hi)/2;if(derivative(mid)<0)lo=mid;else hi=mid;}var t=(lo+hi)/2;maximum=Math.max(maximum,Math.abs(value(a.map(function(v,j){return v+t*d[j];}))/normalization));}
      }
      var a=points[0],b=points[1],c=points[2],det=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      if(Math.abs(det)>1e-30){var u=(-a[0]*(c[1]-a[1])+a[1]*(c[0]-a[0]))/det,v=(-(b[0]-a[0])*a[1]+(b[1]-a[1])*a[0])/det;if(u>=0&&v>=0&&u+v<=1)maximum=Math.max(maximum,Math.abs(surface.radiusM+surface.slope*(a[2]+u*(b[2]-a[2])+v*(c[2]-a[2])))/normalization);}
    }
    return maximum;
  }
  function fitPatch(parsed,faces,tolerance) {
    var weights=new Map(),normalSum=[0,0,0],normalMoment=new Array(9).fill(0),total=0;
    for(var face of faces) {
      var ids=Array.from(parsed.triangles.subarray(face*3,face*3+3)),p=ids.map(function(id){return Array.from(parsed.positions.subarray(id*3,id*3+3));});
      var a=p[1].map(function(v,i){return v-p[0][i];}),b=p[2].map(function(v,i){return v-p[0][i];}),weight=Math.hypot.apply(null,cross(a,b))/2,n=parsed.normals.subarray(face*3,face*3+3);
      total+=weight;ids.forEach(function(id){weights.set(id,(weights.get(id)||0)+weight/3);});
      for(var i=0;i<3;i++){normalSum[i]+=weight*n[i];for(var j=0;j<3;j++)normalMoment[i*3+j]+=weight*n[i]*n[j];}
    }
    var points=[],centroid=[0,0,0];
    weights.forEach(function(w,id){var p=Array.from(parsed.positions.subarray(id*3,id*3+3));points.push({p:p,w:w/total});for(var i=0;i<3;i++)centroid[i]+=w/total*p[i];});
    var covariance=new Array(9).fill(0),scale=parsed.diagonal;
    points.forEach(function(point){var d=point.p.map(function(v,i){return (v-centroid[i])/scale;});for(var i=0;i<3;i++)for(var j=0;j<3;j++)covariance[i*3+j]+=point.w*d[i]*d[j];});
    var axis=eigen(covariance)[0].vector,uv=basis(axis),plane={kind:'plane',originM:centroid,axis:axis,u:uv[0],v:uv[1]};
    plane.maximumDeviationM=deviation(plane,parsed,faces);
    if(plane.maximumDeviationM<=tolerance)return plane;
    for(i=0;i<3;i++)for(j=0;j<3;j++)normalMoment[i*3+j]=normalMoment[i*3+j]/total-normalSum[i]*normalSum[j]/(total*total);
    var eigenvalues=eigen(normalMoment);axis=eigenvalues[0].vector;uv=basis(axis);
    for(var kind of ['cylinder','cone']) {
      var dimension=3,matrix=Array.from({length:dimension},function(){return new Array(dimension).fill(0);}),rhs=new Array(dimension).fill(0);
      points.forEach(function(point){var d=point.p.map(function(v,i){return (v-centroid[i])/scale;}),x=dot(d,uv[0]),y=dot(d,uv[1]),z=dot(d,axis),row=[x,y,1],target=x*x+y*y;for(var i=0;i<dimension;i++){rhs[i]+=point.w*row[i]*target;for(var j=0;j<dimension;j++)matrix[i][j]+=point.w*row[i]*row[j];}});
      var solution=solve(matrix,rhs);if(!solution)continue;
      var cx=solution[0]/2,cy=solution[1]/2,radiusSquared=solution[dimension-1]+cx*cx+cy*cy;
      if(!(radiusSquared>0))continue;
      var radius=Math.sqrt(radiusSquared),slope=0;
      if(kind==='cone') {
        // Fit radial distance directly: two axial rings do not determine an
        // unconstrained quadratic in z, but do determine a conical radius.
        var valid=true;
        for(var iteration=0;iteration<20;iteration++) {
          matrix=Array.from({length:4},function(){return [0,0,0,0];});rhs=[0,0,0,0];
          points.forEach(function(point){
            var d=point.p.map(function(v,i){return (v-centroid[i])/scale;}),x=dot(d,uv[0])-cx,y=dot(d,uv[1])-cy,z=dot(d,axis),r=Math.hypot(x,y);
            if(r<1e-14){valid=false;return;}
            var row=[-x/r,-y/r,-1,-z],error=r-radius-slope*z;
            for(var i=0;i<4;i++){rhs[i]-=point.w*row[i]*error;for(var j=0;j<4;j++)matrix[i][j]+=point.w*row[i]*row[j];}
          });
          var delta=valid?solve(matrix,rhs):null;if(!delta){valid=false;break;}
          cx+=delta[0];cy+=delta[1];radius+=delta[2];slope+=delta[3];
          if(Math.max.apply(null,delta.map(Math.abs))<1e-12)break;
        }
        if(!valid||!(radius>0)||Math.abs(slope)<1e-6||Math.abs(slope)>1e3)continue;
      }
      var surface={kind:kind,originM:centroid.map(function(v,i){return v+scale*(cx*uv[0][i]+cy*uv[1][i]);}),axis:axis,u:uv[0],v:uv[1],radiusM:radius*scale,slope:slope};
      surface.minimumAxialM=Infinity;surface.maximumAxialM=-Infinity;
      points.forEach(function(point){var z=coordinates(surface,point.p)[2];surface.minimumAxialM=Math.min(surface.minimumAxialM,z);surface.maximumAxialM=Math.max(surface.maximumAxialM,z);});
      if(Math.min(surface.radiusM+slope*surface.minimumAxialM,surface.radiusM+slope*surface.maximumAxialM)<=0)continue;
      surface.maximumDeviationM=deviation(surface,parsed,faces);
      if(surface.maximumDeviationM<=tolerance)return surface;
    }
    return {kind:'discrete',reason:'No plane, cylinder, or cone fits within the selected deviation.'};
  }
  function fit(parsed,tolerance) {
    if(!Number.isFinite(tolerance)||tolerance<=0){var error=new Error('Choose a finite positive reconstruction deviation.');error.code='STL_INVALID_OPTIONS';throw error;}
    var faces=parsed.patches.map(function(){return [];});
    for(var i=0;i<parsed.triangles.length/3;i++)faces[parsed.patchByTriangle[i]].push(i);
    return faces.map(function(group,index){var surface=fitPatch(parsed,group,tolerance);surface.patchIndex=index;surface.triangleCount=group.length;return surface;});
  }
  function unsupported(message) {
    var error=new Error(message+' Choose “Use original STL surface” to retain the source, or adjust grouping/deviation and review again.');
    error.code='STL_RECONSTRUCTION_UNSUPPORTED';throw error;
  }
  function boundaryLoops(parsed) {
    var outgoing=parsed.patches.map(function(){return new Map();});
    for(var t=0;t<parsed.triangles.length/3;t++)for(var e=0;e<3;e++) {
      var patch=parsed.patchByTriangle[t];
      if(parsed.patchByTriangle[parsed.neighbors[t*3+e]]===patch)continue;
      var a=parsed.triangles[t*3+e],b=parsed.triangles[t*3+(e+1)%3];
      if(outgoing[patch].has(a))unsupported('A patch boundary branches at a vertex.');
      outgoing[patch].set(a,b);
    }
    return outgoing.map(function(edges){
      var loops=[];
      while(edges.size) {
        var first=edges.keys().next().value,current=first,loop=[];
        do {loop.push(current);var next=edges.get(current);edges.delete(current);if(next===undefined)unsupported('A patch boundary is not a closed loop.');current=next;}while(current!==first);
        if(loop.length<3)unsupported('A patch boundary has fewer than three vertices.');loops.push(loop);
      }
      if(!loops.length)unsupported('A patch has no trimmable boundary.');return loops;
    });
  }
  function pointAt(positions,id){return Array.from(positions.subarray(id*3,id*3+3));}
  function simplifyStraightBoundaries(parsed,loops,numerical) {
    var neighbors=new Map();
    loops.forEach(function(face){face.forEach(function(loop){loop.forEach(function(a,i){var b=loop[(i+1)%loop.length];if(!neighbors.has(a))neighbors.set(a,new Set());if(!neighbors.has(b))neighbors.set(b,new Set());neighbors.get(a).add(b);neighbors.get(b).add(a);});});});
    var redundant=new Set();
    neighbors.forEach(function(adjacent,id){
      if(adjacent.size!==2)return;
      var p=pointAt(parsed.positions,id),ends=Array.from(adjacent),a=pointAt(parsed.positions,ends[0]).map(function(v,i){return v-p[i];}),b=pointAt(parsed.positions,ends[1]).map(function(v,i){return v-p[i];});
      if(dot(a,b)<0&&Math.hypot.apply(null,cross(a,b))<=1e-12*Math.hypot.apply(null,a)*Math.hypot.apply(null,b))redundant.add(id);
    });
    return loops.map(function(face){return face.map(function(loop){
      var retained=loop.filter(function(id){return !redundant.has(id);});
      if(retained.length<3)unsupported('Boundary simplification would collapse a face.');
      // Check the final chord, not just successive local angles: accumulated
      // drift along a long chain must remain below the numerical bound.
      var first=loop.indexOf(retained[0]),start=retained[0],chain=[];
      for(var i=1;i<=loop.length;i++){
        var id=loop[(first+i)%loop.length];
        if(redundant.has(id)){chain.push(id);continue;}
        var a=pointAt(parsed.positions,start),d=pointAt(parsed.positions,id).map(function(v,j){return v-a[j];}),length=Math.hypot.apply(null,d);
        for(var removed of chain){var v=pointAt(parsed.positions,removed).map(function(value,j){return value-a[j];}),along=dot(v,d)/length;if(Math.hypot.apply(null,cross(v,d))/length>numerical||along<-numerical||along>length+numerical)unsupported('Simplifying a straight boundary would exceed its numerical deviation.');}
        start=id;chain=[];
      }
      return retained;
    });});
  }
  function planarSolid(gmsh,parsed,surfaces,loops,tolerance) {
    // This first polyhedral path merges coplanar triangles without moving the
    // source vertices. Nonplanar fits need a shared-vertex projection strategy.
    var numerical=parsed.diagonal*1e-10;
    if(surfaces.some(function(s){return s.maximumDeviationM>Math.min(tolerance/4,numerical);}))unsupported('Some planar fits require moving shared boundaries.');
    loops=simplifyStraightBoundaries(parsed,loops,numerical);
    var occ=gmsh.model.occ,points=new Map(),curves=new Map(),scale=parsed.diagonal;
    function point(id){if(!points.has(id)){var p=pointAt(parsed.positions,id);points.set(id,occ.addPoint(p[0]/scale,p[1]/scale,p[2]/scale));}return points.get(id);}
    function line(a,b){var key=Math.min(a,b)+':'+Math.max(a,b);if(!curves.has(key))curves.set(key,occ.addLine(point(Math.min(a,b)),point(Math.max(a,b))));return (a<b?1:-1)*curves.get(key);}
    var tags=loops.map(function(faceLoops,index){
      var s=surfaces[index];
      function area(loop){var sum=0;for(var i=0;i<loop.length;i++){var a=coordinates(s,pointAt(parsed.positions,loop[i])),b=coordinates(s,pointAt(parsed.positions,loop[(i+1)%loop.length]));sum+=a[0]*b[1]-a[1]*b[0];}return Math.abs(sum);}
      faceLoops.sort(function(a,b){return area(b)-area(a);});
      var wires=faceLoops.map(function(loop){return occ.addWire(loop.map(function(a,i){return line(a,loop[(i+1)%loop.length]);}),-1,true);});
      return occ.addPlaneSurface(wires);
    });
    var solid=occ.addVolume([occ.addSurfaceLoop(tags,-1,false)]);
    if(scale!==1)occ.dilate([3,solid],0,0,0,scale,scale,scale);occ.synchronize();
    // OCC can replace a trimmed face when orienting a shell. Match its
    // area centroid; ambiguous matches are rejected instead of guessing identity.
    var boundary=gmsh.model.getBoundary([3,solid],false,false,false).outDimTags;
    var mapped=surfaces.map(function(){return [];}),used=new Set();
    for(var i=0;i<boundary.length;i+=2) {
      var tag=boundary[i+1],center=occ.getCenterOfMass(2,tag),p=[center.x,center.y,center.z];
      var candidates=surfaces.filter(function(surface){return Math.hypot.apply(null,p.map(function(v,j){return v-surface.originM[j];}))<=numerical;});
      if(candidates.length!==1)unsupported('A recovered planar face could not be mapped uniquely to its source patch.');
      mapped[candidates[0].patchIndex].push(tag);used.add(tag);
    }
    if(mapped.some(function(group){return group.length!==1;}))unsupported('Planar solid construction lost a source patch.');
    var discarded=tags.filter(function(tag){return !used.has(tag);});
    if(discarded.length){occ.remove(discarded.flatMap(function(tag){return [2,tag];}),false);occ.synchronize();}
    return {solidTag:solid,surfaceTags:mapped,maximumDeviationM:Math.max.apply(null,surfaces.map(function(s){return s.maximumDeviationM;}))+numerical};
  }
  function roundSolid(gmsh,parsed,surfaces,loops,tolerance) {
    var curved=surfaces.filter(function(s){return s.kind!=='plane';}),caps=surfaces.filter(function(s){return s.kind==='plane';});
    if(curved.length!==1||caps.length!==2||loops[curved[0].patchIndex].length!==2||caps.some(function(s){return loops[s.patchIndex].length!==1;})) {
      unsupported('The fitted surfaces need boundary intersections that are not yet supported. Full cylinders and conical frusta with flat ends are supported.');
    }
    var side=curved[0],numerical=parsed.diagonal*1e-10,axis=side.axis;
    if(caps.some(function(s){return Math.hypot.apply(null,cross(s.axis,axis))>1e-8 || s.maximumDeviationM>numerical;}))unsupported('The curved surface does not meet perpendicular flat ends.');
    var ends=caps.map(function(s){return {patch:s.patchIndex,z:coordinates(side,s.originM)[2]};}).sort(function(a,b){return a.z-b.z;});
    var low=ends[0].z,high=ends[1].z,r0=side.radiusM+side.slope*low,r1=side.radiusM+side.slope*high;
    if(!(high-low>numerical&&Math.min(r0,r1)>numerical))unsupported('The fitted cylinder or cone has an unresolved end or apex.');
    // Fixed-axial-coordinate radial projection is a one-to-one map of the
    // annulus when facet radial normals stay positive and both boundary loops
    // wind monotonically once. This bounds both source and recovered surfaces.
    var maximum=side.maximumDeviationM*Math.hypot(1,side.slope)+2*numerical;
    for(var end of ends) {
      var loop=loops[end.patch][0],winding=0,direction=0;
      for(var i=0;i<loop.length;i++) {
        var a=coordinates(side,pointAt(parsed.positions,loop[i])),b=coordinates(side,pointAt(parsed.positions,loop[(i+1)%loop.length]));
        if(Math.abs(a[2]-end.z)>numerical)unsupported('An end boundary is not perpendicular to the recovered axis.');
        var angle=Math.atan2(a[0]*b[1]-a[1]*b[0],a[0]*b[0]+a[1]*b[1]);
        if(Math.abs(angle)<1e-14||Math.abs(angle)>=Math.PI||direction&&Math.sign(angle)!==direction)unsupported('A curved boundary folds or does not form one circular rim.');
        direction=Math.sign(angle);winding+=angle;
      }
      if(Math.abs(Math.abs(winding)-2*Math.PI)>1e-8)unsupported('A circular boundary does not wrap exactly once.');
    }
    for(var t=0;t<parsed.triangles.length/3;t++)if(parsed.patchByTriangle[t]===side.patchIndex) {
      var n=parsed.normals.subarray(t*3,t*3+3),nx=dot(n,side.u),ny=dot(n,side.v);
      for(i=0;i<3;i++){var p=coordinates(side,pointAt(parsed.positions,parsed.triangles[t*3+i]));if(p[2]<low-numerical||p[2]>high+numerical||nx*p[0]+ny*p[1]<=0)unsupported('Projection onto the curved surface would fold or extend beyond an end.');}
    }
    if(maximum>tolerance)unsupported('The complete reconstructed surface exceeds the selected deviation.');
    var occ=gmsh.model.occ,start=side.originM.map(function(v,i){return v+low*axis[i];}),delta=axis.map(function(v){return v*(high-low);});
    var solid=side.kind==='cylinder'?occ.addCylinder(start[0],start[1],start[2],delta[0],delta[1],delta[2],r0):occ.addCone(start[0],start[1],start[2],delta[0],delta[1],delta[2],r0,r1);
    occ.synchronize();
    var entities=gmsh.model.getBoundary([3,solid],false,false,false).outDimTags,tags=surfaces.map(function(){return [];});
    for(i=0;i<entities.length;i+=2) {
      var tag=entities[i+1],type=gmsh.model.getType(2,tag).entityType;
      if(type==='Plane') {
        var center=occ.getCenterOfMass(2,tag),z=coordinates(side,[center.x,center.y,center.z])[2];
        tags[Math.abs(z-low)<Math.abs(z-high)?ends[0].patch:ends[1].patch].push(tag);
      } else if(type===(side.kind==='cylinder'?'Cylinder':'Cone'))tags[side.patchIndex].push(tag);
      else unsupported('The geometry kernel returned an unexpected surface ('+type+').');
    }
    if(tags.some(function(group){return group.length!==1;}))unsupported('Recovered faces could not be mapped uniquely to source patches.');
    return {solidTag:solid,surfaceTags:tags,maximumDeviationM:maximum};
  }
  function build(gmsh,parsed,tolerance) {
    if(parsed.patches.length>512)unsupported('The reconstruction exceeds 512 surfaces.');
    var surfaces=fit(parsed,tolerance),unresolved=surfaces.filter(function(s){return s.kind==='discrete';});
    if(unresolved.length)unsupported(unresolved.length+' of '+surfaces.length+' patches cannot be recovered as planes, cylinders or cones within this deviation.');
    var loops=boundaryLoops(parsed),result=surfaces.every(function(s){return s.kind==='plane';})?planarSolid(gmsh,parsed,surfaces,loops,tolerance):roundSolid(gmsh,parsed,surfaces,loops,tolerance);
    var boundary=gmsh.model.getBoundary([3,result.solidTag],false,false,false).outDimTags;
    var expected=new Set(result.surfaceTags.flat()),curves=new Map();
    if(boundary.length!==expected.size*2)unsupported('Solid construction changed the source patch topology.');
    for(var i=0;i<boundary.length;i+=2){if(!expected.delete(boundary[i+1]))unsupported('Solid construction lost a source patch.');var edges=gmsh.model.getBoundary([2,boundary[i+1]],false,false,false).outDimTags;for(var j=0;j<edges.length;j+=2)curves.set(edges[j+1],(curves.get(edges[j+1])||0)+1);}
    if(Array.from(curves.values()).some(function(count){return count!==2;}))unsupported('The recovered surfaces do not form a closed shared boundary.');
    if(result.maximumDeviationM>tolerance)unsupported('The selected deviation is below the reconstruction numerical bound.');
    result.analytic=true;result.internalSurfaceCount=surfaces.length;
    result.reconstruction={version:1,toleranceM:tolerance,maximumDeviationM:result.maximumDeviationM,surfaces:surfaces};
    return result;
  }

  root.StlReconstruction={fit:fit,build:build};
}(globalThis));
