/* Original procedural test geometry; no downloaded fixture data. */
(function(root){
 'use strict';
 function encode(triangles){
  var lines=['solid test'];
  triangles.forEach(function(triangle){lines.push('facet normal 0 0 0','outer loop');triangle.forEach(function(p){lines.push('vertex '+p.join(' '));});lines.push('endloop','endfacet');});
  lines.push('endsolid test');return new TextEncoder().encode(lines.join('\n')).buffer;
 }
 function round(segments,slope,rotated){
  var triangles=[],ring=[];
  for(var i=0;i<segments;i++)ring.push([.5*Math.cos(2*Math.PI*i/segments),.5*Math.sin(2*Math.PI*i/segments)]);
  for(i=0;i<segments;i++){
   var a=ring[i],b=ring[(i+1)%segments],lo=[a[0],a[1],0],hi=[a[0]*(1+2*slope),a[1]*(1+2*slope),1],nextLo=[b[0],b[1],0],nextHi=[b[0]*(1+2*slope),b[1]*(1+2*slope),1];
   triangles.push([[0,0,0],nextLo,lo],[[0,0,1],hi,nextHi],[lo,nextLo,nextHi],[lo,nextHi,hi]);
  }
  if(rotated){var axis=[1/3,2/3,2/3],u=[2/Math.sqrt(5),-1/Math.sqrt(5),0],v=[2/(3*Math.sqrt(5)),4/(3*Math.sqrt(5)),-5/(3*Math.sqrt(5))];triangles=triangles.map(function(t){return t.map(function(p){return [2,-3,4].map(function(origin,i){return origin+u[i]*p[0]+v[i]*p[1]+axis[i]*p[2];});});});}
  return encode(triangles);
 }
 function squareTube(){
  var outer=[[-1,-1],[1,-1],[1,1],[-1,1]],inner=outer.map(function(p){return p.map(function(v){return v/2;});}),triangles=[];
  function p(ring,i,z){return [ring[i%4][0],ring[i%4][1],z];}
  function quad(a,b,c,d){triangles.push([a,b,c],[a,c,d]);}
  for(var i=0;i<4;i++){
   quad(p(outer,i,0),p(outer,i+1,0),p(outer,i+1,1),p(outer,i,1));
   quad(p(inner,i,0),p(inner,i,1),p(inner,i+1,1),p(inner,i+1,0));
   quad(p(outer,i,1),p(outer,i+1,1),p(inner,i+1,1),p(inner,i,1));
   quad(p(outer,i,0),p(inner,i,0),p(inner,i+1,0),p(outer,i+1,0));
  }
  return encode(triangles);
 }
 function subdividedCube(n){
  var triangles=[],faces=[function(u,v){return [0,u,v];},function(u,v){return [1,u,v];},function(u,v){return [u,0,v];},function(u,v){return [u,1,v];},function(u,v){return [u,v,0];},function(u,v){return [u,v,1];}];
  faces.forEach(function(point,face){for(var i=0;i<n;i++)for(var j=0;j<n;j++){var a=point(i/n,j/n),b=point((i+1)/n,j/n),c=point((i+1)/n,(j+1)/n),d=point(i/n,(j+1)/n),pair=[[a,b,c],[a,c,d]];if([0,3,4].includes(face))pair=pair.map(function(t){return t.slice().reverse();});triangles.push.apply(triangles,pair);}});
  return encode(triangles);
 }
 root.StlTestShapes={round:round,squareTube:squareTube,subdividedCube:subdividedCube};
}(globalThis));
