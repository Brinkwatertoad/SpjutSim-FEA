/* Replaceable intersection-repair backend. Only this adapter knows its native ABI. */
(function(root){
 'use strict';
 function fail(code,message){var e=new Error(message);e.code=code;throw e;}
 async function prepare(source,local,settings){
  var mesh=local.sourceBytes?root.StlImport.decode(local.sourceBytes):source,module=await root.createStlSolidRepair();
  if(module._repair_api_version()!==2)fail('STL_SOLID_REPAIR_VERSION','The solid-repair engine does not match this application.');
  if(!(mesh.diagonal>0&&Number.isFinite(mesh.diagonal)))fail('STL_SOLID_REPAIR_FAILED','This surface has no usable extent for intersection repair.');
  var origin=mesh.minimum.map(function(v,i){return v/2+mesh.maximum[i]/2;}),p=mesh.positions.map(function(v,i){return(v-origin[i%3])/mesh.diagonal;}),t=mesh.triangles;
  var pp=module._malloc(p.byteLength),tp=module._malloc(t.byteLength);
  try {
   if(!pp||!tp)fail('STL_SOLID_REPAIR_LIMIT','Intersection repair exceeded available memory. Try a simpler source.');
   module.HEAPF64.set(p,pp/8);module.HEAPU32.set(t,tp/4);
   var code=module._repair_solid(pp,p.length/3,tp,t.length/3,settings.maxHoleDiameterRatio);
   if(code)fail(code===2?'STL_SOLID_REPAIR_LIMIT':'STL_SOLID_REPAIR_FAILED',code===2?'Intersection repair exceeded its memory or work limit. Try a simpler source.':code===4?'Intersection repair could not produce one closed solid within the local filling limit. The original surface remains available.':'Automatic intersection repair could not produce a valid candidate.');
   var vertices=module._repair_vertex_count(),facets=module._repair_facet_count();
   if(!Number.isSafeInteger(vertices)||vertices<3||vertices>600000||!Number.isSafeInteger(facets)||facets<4||facets>200000)fail('STL_SOLID_REPAIR_FAILED','Intersection repair returned invalid geometry.');
   var positions=module.HEAPF64.slice(module._repair_positions()/8,module._repair_positions()/8+vertices*3),triangles=module.HEAPU32.slice(module._repair_triangles()/4,module._repair_triangles()/4+facets*3),vertexSources=module.HEAP32.subarray(module._repair_vertex_sources()/4,module._repair_vertex_sources()/4+vertices),parents=module.HEAP32.slice(module._repair_face_sources()/4,module._repair_face_sources()/4+facets),changed=module.HEAPU8.slice(module._repair_face_changed(),module._repair_face_changed()+facets);
   for(var i=0;i<vertices;i++){
    var original=vertexSources[i];if(original< -1||original>=mesh.positions.length/3)fail('STL_SOLID_REPAIR_FAILED','Intersection repair returned invalid vertex provenance.');
    for(var a=0;a<3;a++){var v=i*3+a;positions[v]=original>=0?mesh.positions[original*3+a]:positions[v]*mesh.diagonal+origin[a];if(!Number.isFinite(positions[v]))fail('STL_SOLID_REPAIR_FAILED','Intersection repair returned a nonfinite coordinate.');}
   }
   var lines=['solid repaired'],size=15,mapping=new Int32Array(facets),retained=new Uint8Array(source.triangles.length/3),unchanged=0,added=[];
   for(i=0;i<facets;i++){
    if(parents[i]<0||parents[i]>=t.length/3)fail('STL_SOLID_REPAIR_FAILED','Intersection repair returned invalid face provenance.');
    mapping[i]=local.sourceTriangleByCandidate?local.sourceTriangleByCandidate[parents[i]]:parents[i];
    if(!changed[i]&&mapping[i]>=0){retained[mapping[i]]=1;unchanged++;}
    if(mapping[i]<0)added.push(i);
    var face=['facet normal 0 0 0','outer loop'];
    for(var j=0;j<3;j++){var id=triangles[i*3+j];if(id>=vertices)fail('STL_SOLID_REPAIR_FAILED','Intersection repair returned invalid connectivity.');face.push('vertex '+positions.subarray(id*3,id*3+3).join(' '));}
    face.push('endloop','endfacet');var line=face.join('\n');size+=line.length+1;if(size>16*1024*1024-30)fail('STL_SOLID_REPAIR_LIMIT','The repaired STL exceeds the 16 MiB source limit.');lines.push(line);
   }
   lines.push('endsolid repaired');var bytes=new TextEncoder().encode(lines.join('\n')).buffer,candidate=root.StlImport.decode(bytes);
   var touched=[];for(i=0;i<retained.length;i++)if(!retained[i])touched.push(i);
   var automatic=local.changes.automatic,automaticRefs=automatic.reduce(function(n,i){return n+i.triangleIds.length+i.edgeVertexIds.length+i.vertexIds.length;},0);
   var locations=root.StlDiagnostics.collector(source,{maxRecords:1000-automatic.length,maxReferences:200000-automaticRefs},'source');locations.add('intersection-repair',touched,[],[],'proposed',touched.length);
   var proposed=locations.report.issues,refs=automaticRefs+locations.report.issues.reduce(function(n,i){return n+i.triangleIds.length;},0);
   if(added.length){var fills=root.StlDiagnostics.collector(candidate,{maxRecords:1000-automatic.length-proposed.length,maxReferences:200000-refs},'candidate');fills.add('filled-hole',added,[],[],'proposed',added.length);proposed=proposed.concat(fills.report.issues);}
   // The touched-source proposal also covers the preceding local cleanup. It
   // avoids attaching old candidate facet IDs to a newly subdivided surface.
   return {sourceBytes:bytes,sourceTriangleByCandidate:mapping,changes:{automatic:automatic,proposed:proposed},changesTruncated:local.changesTruncated||locations.report.locationsTruncated||(fills&&fills.report.locationsTruncated)||false,shapeChanged:true,error:null,report:{},
    solidRepair:{version:2,method:'intersection-refinement',sourceTriangleCount:source.triangles.length/3,candidateTriangleCount:facets,unchangedTriangleCount:unchanged,affectedSourceTriangleCount:touched.length,filledVoidCount:module._repair_filled_voids(),maximumFillDiameter:settings.maxHoleDiameterRatio*mesh.diagonal,wasmMemoryBytes:module.HEAPU8.length}};
  }finally{module._free(pp);module._free(tp);}
 }
 root.StlSolidRepair={prepare:prepare};
}(globalThis));
