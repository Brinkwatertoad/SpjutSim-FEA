/* Worker-local BVH for measured surface distances and inward thickness rays. */
(function(root){
 'use strict';
 function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
 function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
 function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
 function distance2(p,a,b,c){
  var ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
  if(d1<=0&&d2<=0)return dot(ap,ap);
  var bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return dot(bp,bp);
  var vc=d1*d4-d3*d2,v,w,q;
  if(vc<=0&&d1>=0&&d3<=0){v=d1/(d1-d3);q=sub(ap,ab.map(function(x){return v*x;}));return dot(q,q);}
  var cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return dot(cp,cp);
  var vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){w=d2/(d2-d6);q=sub(ap,ac.map(function(x){return w*x;}));return dot(q,q);}
  var va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){w=(d4-d3)/((d4-d3)+(d5-d6));q=sub(bp,sub(c,b).map(function(x){return w*x;}));return dot(q,q);}
  var n=cross(ab,ac),height=dot(ap,n);return height*height/dot(n,n);
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
 Index.prototype.tick=function(){if(++this.work>20000000){var e=new Error('Surface fidelity checks exceeded their work limit. Use a simpler source or the advanced original-triangle method.');e.code='STL_ANALYSIS_LIMIT';throw e;}};
 Index.prototype.distance=function(point){
  var best=Infinity,self=this;
  function lower(node){var sum=0,b=node.bounds;for(var a=0;a<3;a++){var d=Math.max(b[a]-point[a],0,point[a]-b[a+3]);sum+=d*d;}return sum;}
  function visit(node){self.tick();if(lower(node)>best)return;
   if(node.left){var first=node.left,second=node.right;if(lower(first)>lower(second)){first=node.right;second=node.left;}visit(first);visit(second);}
   else for(var i=node.start;i<node.end;i++){self.tick();var f=self.face(self.order[i]);best=Math.min(best,distance2(point,f[0],f[1],f[2]));}
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
 root.StlSpatial={Index:Index};
}(globalThis));
