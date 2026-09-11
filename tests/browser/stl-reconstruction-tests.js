(async function(){
 'use strict';var status=document.getElementById('test-status');
 function assert(value,message){if(!value)throw new Error(message);}
 try {
  assert(typeof StlReconstruction!=='undefined','Surface reconstruction adapter is unavailable');
  var options={version:1,lengthUnit:'m',patchAngleDegrees:40,normalization:'none'};
  var cube=StlImport.parse(await(await fetch('../fixtures/stl/cube-binary.stl')).arrayBuffer(),options);
  var surfaces=StlReconstruction.fit(cube,1e-6);
  assert(surfaces.length===6 && surfaces.every(function(s){return s.kind==='plane' && s.maximumDeviationM<1e-12;}),'Cube did not recover six exact planes');
  var cylinder=StlImport.parse(await(await fetch('../fixtures/stl/cylinder-32.stl')).arrayBuffer(),options);
  surfaces=StlReconstruction.fit(cylinder,.003);
  assert(surfaces.filter(function(s){return s.kind==='cylinder';}).length===1,'Cylinder side was not recovered');
  assert(surfaces.filter(function(s){return s.kind==='plane';}).length===2,'Cylinder caps were not recovered');
  var side=surfaces.find(function(s){return s.kind==='cylinder';});
  assert(Math.abs(side.radiusM-.5)<1e-7 && side.maximumDeviationM>.002 && side.maximumDeviationM<.003,'Cylinder fit did not bound facet sagitta');
  assert(StlReconstruction.fit(cylinder,1e-5).some(function(s){return s.kind==='discrete';}),'Too-tight reconstruction tolerance silently changed the cylinder');
  // A rigidly transformed frustum exercises cone fitting independently of global axes.
  var p=cylinder.positions.slice(),axis=[1/3,2/3,2/3],u=[2/Math.sqrt(5),-1/Math.sqrt(5),0],v=[2/(3*Math.sqrt(5)),4/(3*Math.sqrt(5)),-5/(3*Math.sqrt(5))];
  for(var i=0;i<p.length;i+=3){var x=p[i]*(1+p[i+2]),y=p[i+1]*(1+p[i+2]),z=p[i+2];for(var a=0;a<3;a++)p[i+a]=[2,-3,4][a]+u[a]*x+v[a]*y+axis[a]*z;}
  var lines=['solid cone'];for(i=0;i<cylinder.triangles.length;i+=3){lines.push('facet normal 0 0 0','outer loop');for(var j=0;j<3;j++)lines.push('vertex '+Array.from(p.subarray(3*cylinder.triangles[i+j],3*cylinder.triangles[i+j]+3)).join(' '));lines.push('endloop','endfacet');}lines.push('endsolid cone');var cone=StlImport.parse(new TextEncoder().encode(lines.join('\n')).buffer,options);
  surfaces=StlReconstruction.fit(cone,.006);
  assert(surfaces.filter(function(s){return s.kind==='cone';}).length===1,'Rotated cone side was not recovered');
  side=surfaces.find(function(s){return s.kind==='cone';});
  assert(Math.abs(Math.abs(side.slope)-.5)<1e-6,'Cone slope is incorrect');
  for(var tolerance of [0,-1,Infinity,NaN]){var failed=false;try{StlReconstruction.fit(cube,tolerance);}catch(e){failed=e.code==='STL_INVALID_OPTIONS';}assert(failed,'Invalid deviation tolerance accepted');}
  status.textContent='Passed';status.dataset.result='passed';
 } catch(error){status.textContent=error.message;status.dataset.result='failed';}
}());
