/* Replaceable solid-repair backend. Only this adapter knows its native ABI. */
(function(root){
 'use strict';
 function fail(code,message){var e=new Error(message);e.code=code;throw e;}
 async function prepare(mesh){
  var module=await root.createStlSolidRepair();
  if(module._repair_api_version()!==1)fail('STL_SOLID_REPAIR_VERSION','The solid-repair engine does not match this application.');
  if(!(mesh.diagonal>0&&Number.isFinite(mesh.diagonal)))fail('STL_SOLID_REPAIR_FAILED','This surface has no usable extent for solid reconstruction.');
  var origin=mesh.minimum.map(function(v,i){return v/2+mesh.maximum[i]/2;}),p=mesh.positions.map(function(v,i){return(v-origin[i%3])/mesh.diagonal;}),t=mesh.triangles;
  var pp=module._malloc(p.byteLength),tp=module._malloc(t.byteLength);
  try {
   if(!pp||!tp)fail('STL_SOLID_REPAIR_LIMIT','Solid reconstruction exceeded available memory. Try a simpler source.');
   module.HEAPF64.set(p,pp/8);module.HEAPU32.set(t,tp/4);
   var code=module._repair_solid(pp,p.length/3,tp,t.length/3,1/80,1/1000);
   if(code)fail(code===2?'STL_SOLID_REPAIR_LIMIT':'STL_SOLID_REPAIR_FAILED',code===2?'Solid reconstruction exceeded its memory or work limit. Try a simpler source.':'Automatic solid reconstruction could not produce a candidate.');
   var vertices=module._repair_vertex_count(),facets=module._repair_facet_count();
   if(!Number.isSafeInteger(vertices)||vertices<3||vertices>600000||!Number.isSafeInteger(facets)||facets<4||facets>200000)fail('STL_SOLID_REPAIR_FAILED','Solid reconstruction returned invalid geometry.');
   var positions=module.HEAPF64.slice(module._repair_positions()/8,module._repair_positions()/8+vertices*3),triangles=module.HEAPU32.slice(module._repair_triangles()/4,module._repair_triangles()/4+facets*3);
   for(var i=0;i<positions.length;i++){positions[i]=positions[i]*mesh.diagonal+origin[i%3];if(!Number.isFinite(positions[i]))fail('STL_SOLID_REPAIR_FAILED','Solid reconstruction returned a nonfinite coordinate.');}
   var lines=['solid repaired'],size=15;
   for(i=0;i<triangles.length;i+=3){var face=['facet normal 0 0 0','outer loop'];for(var j=0;j<3;j++){var id=triangles[i+j];if(id>=vertices)fail('STL_SOLID_REPAIR_FAILED','Solid reconstruction returned invalid connectivity.');face.push('vertex '+positions.subarray(id*3,id*3+3).join(' '));}face.push('endloop','endfacet');var line=face.join('\n');size+=line.length+1;if(size>16*1024*1024-30)fail('STL_SOLID_REPAIR_LIMIT','The reconstructed STL exceeds the 16 MiB source limit.');lines.push(line);}
   lines.push('endsolid repaired');var bytes=new TextEncoder().encode(lines.join('\n')).buffer,candidate=root.StlImport.decode(bytes);
   var locations=root.StlDiagnostics.collector(candidate,null,'candidate');locations.add('rebuilt-surface',Array.from({length:facets},function(_,i){return i;}),[],[],'proposed',facets);
   var mapping=new Int32Array(facets);mapping.fill(-1);
   return {sourceBytes:bytes,sourceTriangleByCandidate:mapping,changes:{automatic:[],proposed:locations.report.issues},changesTruncated:locations.report.locationsTruncated,shapeChanged:true,error:null,report:{},
    solidRepair:{version:1,method:'enclosing-surface',alpha:mesh.diagonal/80,offset:mesh.diagonal/1000,sourceTriangleCount:mesh.triangles.length/3,candidateTriangleCount:facets,wasmMemoryBytes:module.HEAPU8.length}};
  }finally{module._free(pp);module._free(tp);}
 }
 root.StlSolidRepair={prepare:prepare};
}(globalThis));
