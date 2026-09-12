(async function(){
 'use strict';
 var status=document.getElementById('test-status'),options={version:2,lengthUnit:'m',patchAngleDegrees:40,normalization:'none',surfaceMode:'original',reconstructionToleranceM:null};
 function assert(v,m){if(!v)throw new Error(m);}
 function binary(ts){var b=new ArrayBuffer(84+ts.length*50),d=new DataView(b);d.setUint32(80,ts.length,true);ts.forEach(function(t,i){t.forEach(function(p,j){p.forEach(function(v,k){d.setFloat32(84+i*50+12+j*12+k*4,v,true);});});});return b;}
 function facets(b){var d=new DataView(b),ts=[];for(var i=0;i<d.getUint32(80,true);i++){var t=[];for(var j=0;j<3;j++)t.push([0,1,2].map(function(k){return d.getFloat32(84+i*50+12+j*12+k*4,true);}));ts.push(t);}return ts;}
 async function repair(b,ratio){return StlRepair.repair(b,options,{version:1,maxHoleDiameterRatio:ratio===undefined?.01:ratio});}
 async function reject(b,fragment,ratio){var error;try{await repair(b,ratio);}catch(e){error=e;}assert(error&&error.code==='STL_REPAIR_UNSUPPORTED'&&error.message.includes(fragment),'Expected refusal: '+fragment+', received '+(error&&error.message));}
 try{
  assert(typeof StlRepair!=='undefined','Production repair module is unavailable');
  var cube=await(await fetch('../fixtures/stl/cube-binary.stl')).arrayBuffer(),ts=facets(cube),copy=new Uint8Array(cube).slice();
  var corrupt=ts.map(function(t,i){return i%2?t.slice().reverse():t;});corrupt.push(ts[0],[[0,0,0],[0,0,0],[1,0,0]]);
  var corruptedBytes=binary(corrupt),before=new Uint8Array(corruptedBytes).slice(),fixed=await repair(corruptedBytes);
  assert(before.every(function(v,i){return v===new Uint8Array(corruptedBytes)[i];}),'Repair mutated the supplied corrupt source');
  assert(fixed.report.removedDuplicateTriangles===1&&fixed.report.removedZeroAreaTriangles===1,'Cleanup counts are incorrect');
  assert(fixed.report.flippedTriangles===6,'Winding changes were not counted against the source');
  assert(StlImport.parse(fixed.sourceBytes,options).volume===1,'Cleanup changed cube volume');
  assert(copy.every(function(v,i){return v===new Uint8Array(cube)[i];}),'Repair mutated source bytes');
  var inward=await repair(binary(ts.map(function(t){return t.slice().reverse();})));
  assert(inward.report.flippedTriangles===12&&StlImport.parse(inward.sourceBytes,options).volume===1,'Inward shell was not corrected');
  var t=ts[0];
  // Split around an interior point instead, preserving all original boundary edges.
  var center=t[0].map(function(v,k){return(v+t[1][k]+t[2][k])/3;}),ring=t.map(function(p){return p.map(function(v,k){return center[k]+.001*(v-center[k]);});});
  var hole=ts.slice(1);
  for(var i=0;i<3;i++){var j=(i+1)%3;hole.push([t[i],t[j],ring[j]],[t[i],ring[j],ring[i]]);}
  fixed=await repair(binary(hole));
  assert(fixed.report.filledHoles===1&&fixed.report.addedTriangles===1&&fixed.report.maximumFilledHoleDiameterM<.002,'Small hole was not bounded and filled');
  assert(Math.abs(StlImport.parse(fixed.sourceBytes,options).volume-1)<1e-12,'Hole repair changed a planar cube boundary');
  await reject(binary(hole),'hole',0);
  await reject(binary(ts.slice(1)),'hole');
  await reject(binary(ts.slice(1).concat([[[1000,0,0],[1000,0,0],[1000,0,0]]])),'hole');
  var openBox=ts.filter(function(t){return !t.every(function(p){return p[2]===1;});}).map(function(t){return t.map(function(p){return[p[0],p[1],p[2]*100];});});
  fixed=await repair(binary(openBox),.02);
  assert(fixed.report.filledHoles===1&&fixed.report.addedTriangles===2&&Math.abs(StlImport.parse(fixed.sourceBytes,options).volume-100)<1e-10,'Convex four-sided hole did not preserve the box volume');
  var bent=openBox.map(function(t){return t.map(function(p){return p[0]===1&&p[1]===1&&p[2]===100?[1,1,100.01]:p;});});
  await reject(binary(bent),'not flat',.02);
  await reject(await(await fetch('../fixtures/stl/self-intersecting.stl')).arrayBuffer(),'valid solid');
  for(var ratio of [-.01,.051,NaN,Infinity]){var code;try{await repair(cube,ratio);}catch(e){code=e.code;}assert(code==='STL_INVALID_REPAIR_OPTIONS','Invalid hole limit was accepted');}

  var flap=ts.concat([[[0,0,0],[1,0,0],[.5,-.001,0]]]);
  fixed=await repair(binary(flap));assert(fixed.report.removedLooseTriangles===1&&fixed.report.repairedTriangleCount===12,'Isolated stray face was not removed');
  await reject(binary(ts.concat(ts.map(function(t){return t.map(function(p){return p.map(function(v){return v+2;});});}))),'components');
  var ascii=await(await fetch('../fixtures/stl/cube-ascii.stl')).text();
  // The cross products round to the same double, but their exact difference
  // is nonzero. Do not silently remove this real (numerically unusable) face.
  var skinny='facet normal 0 0 0\nouter loop\nvertex 0 0 0\nvertex '+(134217729/512)+' '+(134217728/512)+' 0\nvertex '+(134217728/512)+' '+(134217727/512)+' 0\nendloop\nendfacet\n';
  await reject(new TextEncoder().encode(ascii.replace(/endsolid[^\r\n]*/,skinny+'endsolid cube')).buffer,'components');
  var precise=ascii.replaceAll('vertex 1 ', 'vertex 1.000000000000001 ');
  // All vertices must retain their exact decoded coordinates, including ASCII precision beyond float32.
  fixed=await repair(new TextEncoder().encode(precise).buffer);
  assert(new TextDecoder().decode(fixed.sourceBytes).startsWith('solid'),'Repair rounded high-precision ASCII vertices to binary32');
  assert(StlImport.parse(fixed.sourceBytes,options).maximum[0]===1.000000000000001,'ASCII coordinate precision was lost');
  if(new URLSearchParams(location.search).get('fixture')==='gargoyle')await reject(await(await fetch('../fixtures/stl/cathedral_gargoyle.stl')).arrayBuffer(),'3 disconnected');
  status.textContent='Passed';status.dataset.result='passed';
 }catch(e){status.textContent=e.message;status.dataset.result='failed';}
}());
