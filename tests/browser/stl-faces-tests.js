(async function(){
 'use strict';
 var status=document.getElementById('test-status'),options={version:3,lengthUnit:'m',patchAngleDegrees:40};
 function assert(v,m){if(!v)throw new Error(m);}
 try{
  for(var segments of [4,16])for(var rotated of [false,true]){
   var bytes=StlTestShapes.roundedBlock(segments,rotated),parsed=await StlImport.identify(StlImport.parse(bytes,options),bytes);
   assert(parsed.patches.length===10,'Rounded block needs four flat sides, four fillets and two caps; got '+parsed.patches.length);
   var counts=parsed.patches.map(function(p){return p.triangleCount;}).sort(function(a,b){return a-b;});
   assert(counts.filter(function(n){return n===2;}).length===4,'Flat support areas include fillet triangles');
  }
  bytes=StlTestShapes.round(128,0,true);parsed=StlImport.parse(bytes,options);
  assert(parsed.patches.length===3,'Cylinder wall fragmented into tessellation strips');
  bytes=StlTestShapes.roundedBlock(16,false);parsed=await StlImport.identify(StlImport.parse(bytes,options),bytes);
  var reangled=await StlImport.identify(StlImport.parse(bytes,Object.assign({},options,{patchAngleDegrees:45})),bytes);assert(reangled.patchIds.join()===parsed.patchIds.join(),'Unchanged membership depends on an unused angle setting');
  var original=parsed,small=parsed.patches.findIndex(function(p){return p.triangleCount===2;}),splitOptions=Object.assign({},options,{faceEdits:{sourceHash:parsed.sourceHash,operations:[{type:'split',faceIndices:[small]}]}});
  var split=await StlImport.identify(StlImport.parse(bytes,splitOptions),bytes);
  assert(split.patches.length===11,'Split did not create two selectable regions');
  assert(original.patchIds.filter(function(id){return split.patchIds.includes(id);}).length===9,'Unchanged face identities were invalidated by a local split');
  var parts=[];for(var f=0;f<parsed.patchByTriangle.length;f++)if(parsed.patchByTriangle[f]===small&&!parts.includes(split.patchByTriangle[f]))parts.push(split.patchByTriangle[f]);
  var mergedOptions=Object.assign({},options,{faceEdits:{sourceHash:parsed.sourceHash,operations:splitOptions.faceEdits.operations.concat([{type:'merge',faceIndices:parts.sort(function(a,b){return a-b;})}])}});
  var merged=await StlImport.identify(StlImport.parse(bytes,mergedOptions),bytes);
  assert(merged.patchIds.slice().sort().join()===original.patchIds.slice().sort().join(),'Split/merge changed the original face ownership');
  var error;try{await StlImport.identify(StlImport.parse(bytes,Object.assign({},splitOptions,{faceEdits:{sourceHash:'0'.repeat(64),operations:splitOptions.faceEdits.operations}})),bytes);}catch(e){error=e;}
  assert(error&&error.code==='STL_FACE_EDIT_SOURCE','Face corrections silently applied to a different source');
  error=null;try{StlImport.parse(bytes,Object.assign({},options,{faceEdits:{sourceHash:original.sourceHash,operations:[{type:'merge',faceIndices:[0,1]}]}}));}catch(e){error=e;}
  // Caps are the first two groups for this deterministic fixture and do not touch.
  assert(error&&error.code==='STL_FACE_EDIT_DISCONNECTED','Disconnected selections merged into one face');
  for(var operation of [{type:'merge',faceIndices:[0,0]},{type:'merge',faceIndices:[1,0]},{type:'split',faceIndices:[512]},{type:'unknown',faceIndices:[0]}])assert(!SpjutsimFEA.validateStlSourceOptions(Object.assign({},options,{faceEdits:{sourceHash:original.sourceHash,operations:[operation]}})),'Invalid face correction crossed the shared contract');
  status.textContent='Passed';status.dataset.result='passed';
 }catch(e){status.textContent='Failed: '+e.message;status.dataset.result='failed';}
}());
