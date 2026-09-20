/* Worker-local BVH for measured surface distances and inward thickness rays. */
(function(root){
 'use strict';
 function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
 function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
 function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
 // Allocation-free Ericson point/triangle distance for the hot BVH leaves.
 function distance2(x,y,z,p,a,b,c){
  var abx=p[b]-p[a],aby=p[b+1]-p[a+1],abz=p[b+2]-p[a+2],acx=p[c]-p[a],acy=p[c+1]-p[a+1],acz=p[c+2]-p[a+2];
  var ax=x-p[a],ay=y-p[a+1],az=z-p[a+2],d1=abx*ax+aby*ay+abz*az,d2=acx*ax+acy*ay+acz*az;
  if(d1<=0&&d2<=0)return ax*ax+ay*ay+az*az;
  var bx=x-p[b],by=y-p[b+1],bz=z-p[b+2],d3=abx*bx+aby*by+abz*bz,d4=acx*bx+acy*by+acz*bz;
  if(d3>=0&&d4<=d3)return bx*bx+by*by+bz*bz;
  var vc=d1*d4-d3*d2,v,qx,qy,qz;
  if(vc<=0&&d1>=0&&d3<=0){v=d1/(d1-d3);qx=ax-v*abx;qy=ay-v*aby;qz=az-v*abz;return qx*qx+qy*qy+qz*qz;}
  var cx=x-p[c],cy=y-p[c+1],cz=z-p[c+2],d5=abx*cx+aby*cy+abz*cz,d6=acx*cx+acy*cy+acz*cz;
  if(d6>=0&&d5<=d6)return cx*cx+cy*cy+cz*cz;
  var vb=d5*d2-d1*d6;
  if(vb<=0&&d2>=0&&d6<=0){v=d2/(d2-d6);qx=ax-v*acx;qy=ay-v*acy;qz=az-v*acz;return qx*qx+qy*qy+qz*qz;}
  var va=d3*d6-d5*d4;
  if(va<=0&&d4-d3>=0&&d5-d6>=0){v=(d4-d3)/((d4-d3)+(d5-d6));qx=bx-v*(p[c]-p[b]);qy=by-v*(p[c+1]-p[b+1]);qz=bz-v*(p[c+2]-p[b+2]);return qx*qx+qy*qy+qz*qz;}
  var nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx,height=ax*nx+ay*ny+az*nz;
  return height*height/(nx*nx+ny*ny+nz*nz);
 }
 function Index(positions,triangles){
  this.positions=positions;this.triangles=triangles;this.work=0;
  var self=this,count=triangles.length/3,order=new Uint32Array(count),boxes=new Float64Array(count*6);
  for(var i=0;i<count;i++){order[i]=i;for(var a=0;a<3;a++){var x=positions[triangles[i*3]*3+a],y=positions[triangles[i*3+1]*3+a],z=positions[triangles[i*3+2]*3+a];boxes[i*6+a]=Math.min(x,y,z);boxes[i*6+a+3]=Math.max(x,y,z);}}
  function build(start,end){
   var bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
   for(var i=start;i<end;i++)for(var a=0;a<3;a++){bounds[a]=Math.min(bounds[a],boxes[order[i]*6+a]);bounds[a+3]=Math.max(bounds[a+3],boxes[order[i]*6+a+3]);}
   var node={bounds:bounds,start:start,end:end};
   if(end-start>12){var axis=0;for(a=1;a<3;a++)if(bounds[a+3]-bounds[a]>bounds[axis+3]-bounds[axis])axis=a;
    order.subarray(start,end).sort(function(x,y){return boxes[x*6+axis]+boxes[x*6+axis+3]-boxes[y*6+axis]-boxes[y*6+axis+3];});
    var mid=(start+end)>>1;node.left=build(start,mid);node.right=build(mid,end);
   }return node;
  }
  this.tree=build(0,count);this.order=order;
 }
 Index.prototype.face=function(i){var p=this.positions,t=this.triangles;return [0,1,2].map(function(k){var v=t[i*3+k]*3;return [p[v],p[v+1],p[v+2]];});};
 Index.prototype.tick=function(){if(++this.work>100000000){var e=new Error('Surface fidelity checks exceeded their work limit. Use a simpler source or the advanced original-triangle method.');e.code='STL_ANALYSIS_LIMIT';throw e;}};
 Index.prototype.distance=function(point){
  var best=Infinity,self=this;
  function lower(node){var sum=0,b=node.bounds;for(var a=0;a<3;a++){var d=Math.max(b[a]-point[a],0,point[a]-b[a+3]);sum+=d*d;}return sum;}
  function visit(node){self.tick();if(lower(node)>best)return;
   if(node.left){var first=node.left,second=node.right;if(lower(first)>lower(second)){first=node.right;second=node.left;}visit(first);visit(second);}
   else for(var i=node.start;i<node.end;i++){self.tick();var id=self.order[i],t=self.triangles;var d=distance2(point[0],point[1],point[2],self.positions,t[id*3]*3,t[id*3+1]*3,t[id*3+2]*3);if(d<best){best=d;self.nearestFace=id;}}
  }visit(this.tree);return Math.sqrt(best);
 };
 Index.prototype.ray=function(origin,direction,skip,epsilon){
  var best=Infinity,self=this;
  function visit(node){self.tick();var lo=0,hi=best,b=node.bounds;
   for(var a=0;a<3;a++){if(Math.abs(direction[a])<1e-15){if(origin[a]<b[a]-epsilon||origin[a]>b[a+3]+epsilon)return;}else{var x=(b[a]-origin[a])/direction[a],y=(b[a+3]-origin[a])/direction[a];lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));if(lo>hi+epsilon)return;}}
   if(node.left){visit(node.left);visit(node.right);return;}
   for(var i=node.start;i<node.end;i++){var id=self.order[i];if(id===skip)continue;self.tick();var f=self.face(id),ab=sub(f[1],f[0]),ac=sub(f[2],f[0]),h=cross(direction,ac),det=dot(ab,h);
    if(Math.abs(det)<=1e-14*Math.hypot.apply(null,ab)*Math.hypot.apply(null,ac))continue;
    var s=sub(origin,f[0]),u=dot(s,h)/det;if(u< -1e-12||u>1+1e-12)continue;
    var q=cross(s,ab),v=dot(direction,q)/det;if(v< -1e-12||u+v>1+1e-12)continue;
    var distance=dot(ac,q)/det;if(distance>epsilon&&distance<best)best=distance;
   }
  }visit(this.tree);return best;
 };
 // The lower envelope of triangle-local sizes plus distance is Lipschitz:
 // |h(x)-h(y)| <= gradation*|x-y|. Unlike centroid anchors, a target applies
 // across the whole source facet, including long sparsely tessellated walls.
 function Field(index,targets,maximum,gradation){
  this.index=index;this.targets=targets;this.maximum=maximum;this.gradation=gradation;this.work=0;
  if(!(targets instanceof Float64Array)||targets.length!==index.triangles.length/3||!(maximum>0)||!(gradation>0&&gradation<=1))throw new Error('Invalid local sizing field');
  targets.forEach(function(h){if(!(Number.isFinite(h)&&h>0&&h<=maximum))throw new Error('Invalid local surface target');});
  function annotate(node){node.minimumSize=node.left?Math.min(annotate(node.left),annotate(node.right)):Infinity;
   if(!node.left)for(var i=node.start;i<node.end;i++)node.minimumSize=Math.min(node.minimumSize,targets[index.order[i]]);return node.minimumSize;}
  annotate(index.tree);
 }
 Field.prototype.at=function(x,y,z){
  var self=this,index=this.index,best=this.maximum;
  function lower(node){var b=node.bounds,dx=Math.max(b[0]-x,0,x-b[3]),dy=Math.max(b[1]-y,0,y-b[4]),dz=Math.max(b[2]-z,0,z-b[5]);return node.minimumSize+self.gradation*Math.sqrt(dx*dx+dy*dy+dz*dz);}
  function visit(node){
   if(++self.work>200000000){var e=new Error('Local mesh sizing exceeded its work limit. Use coarser settings or simplify very small features.');e.code='STL_ANALYSIS_LIMIT';throw e;}
   if(lower(node)>=best)return;
   if(node.left){var first=node.left,second=node.right;if(lower(first)>lower(second)){first=node.right;second=node.left;}visit(first);visit(second);}
   else for(var i=node.start;i<node.end;i++){var id=index.order[i];if(self.targets[id]>=best)continue;var t=index.triangles;best=Math.min(best,self.targets[id]+self.gradation*Math.sqrt(distance2(x,y,z,index.positions,t[id*3]*3,t[id*3+1]*3,t[id*3+2]*3)));}
  }
  visit(index.tree);return best;
 };
 root.StlSpatial={Index:Index,Field:Field};
}(globalThis));
