'use strict';
var WORKER_PROTOCOL_VERSION = 4;
var STL_PREPARATION_WORKER_KIND = 'stl-preparation';
function preview(mesh,revision){return{revision:revision,positions:mesh.positions.slice(),triangles:mesh.triangles.slice(),bounds:{min:mesh.minimum,max:mesh.maximum}};}
async function sourceDigest(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),function(v){return v.toString(16).padStart(2,'0');}).join('');}
function geometryFromParsed(parsed,message,options){
  if(parsed.patches.length>512){var error=new Error('The model has more than 512 selectable regions. Export a simpler surface.');error.code='STL_PATCH_LIMIT';throw error;}
  var positions=new Float64Array(parsed.triangles.length*3),normals=new Float32Array(positions.length),indices=new Uint32Array(parsed.triangles.length),offsets=new Uint32Array(parsed.patches.length),start=0,edges=[];
  var ranges=parsed.patches.map(function(p,i){var r={faceId:parsed.patchIds[i],start:start,count:p.triangleCount*3};offsets[i]=start;start+=r.count;return r;});
  for(var i=0;i<parsed.triangles.length;i+=3){var patch=parsed.patchByTriangle[i/3];
    for(var j=0;j<3;j++){var source=parsed.triangles[i+j],target=offsets[patch]++;positions.set(parsed.positions.subarray(source*3,source*3+3),target*3);normals.set(parsed.normals.subarray(i,i+3),target*3);indices[target]=target;
      var next=parsed.neighbors[i+j];if(next>i/3&&parsed.patchByTriangle[next]!==patch)edges.push(source,parsed.triangles[i+(j+1)%3]);}}
  return{geometryId:message.geometryId,sourceName:message.sourceName,sourceFormat:'stl',surfaceKind:'stl-patch',stlSource:options,stlSurface:SpjutsimFEA.defaultStlSurface(),
    sourceMetadata:{version:3,sha256:parsed.sourceHash,triangleCount:parsed.triangles.length/3,internalSurfaceCount:parsed.patches.length,validation:parsed.validation,surfaceMode:'analysis',reconstruction:null},
    orientation:{rotation:[1,0,0,0,1,0,0,0,1],operations:[]},faceIds:parsed.patchIds,boundingBoxM:{minM:parsed.minimum,maxM:parsed.maximum},volumeM3:parsed.volume,
    preview:{positionsM:positions,normals:normals,indices:indices,faceRanges:ranges,featureEdges:{positionsM:parsed.positions,indices:new Uint32Array(edges)}}};
}
function transfers(value){var buffers=new Set();function visit(v){if(v instanceof ArrayBuffer)buffers.add(v);else if(ArrayBuffer.isView(v))buffers.add(v.buffer);else if(v&&typeof v==='object')Object.keys(v).forEach(function(k){visit(v[k]);});}visit(value);return Array.from(buffers);}
self.onmessage=async function(event){
  var m=event.data;
  function send(type,data){var message=Object.assign({protocol:WORKER_PROTOCOL_VERSION,type:type,requestId:m.requestId,sessionId:m.sessionId,generation:m.generation},data);self.postMessage(message,transfers(data));}
  try{
    if(!m||m.protocol!==WORKER_PROTOCOL_VERSION||m.type!=='prepare-stl'||typeof m.requestId!=='string'||!SpjutsimFEA.validateStlPreparationRequest(m))throw new Error('Invalid STL preparation request.');
    var mesh=StlImport.decode(m.sourceBytes);
    send('stl-preview',{preview:preview(mesh,'source')});
    send('stl-progress',{message:'Checking surfaces and preparing repairs…'});
    var prepared=StlRepair.prepare(mesh,{maxHoleDiameterRatio:m.maxHoleDiameterRatio});
    var solidError=null;
    if(STL_PREPARATION_WORKER_KIND==='stl-solid-repair'){
      send('stl-progress',{message:'Resolving intersections while preserving surface detail…'});
      try{prepared=await StlSolidRepair.prepare(mesh,prepared,{maxHoleDiameterRatio:m.maxHoleDiameterRatio});}catch(e){solidError=e;}
    }
    var changed=!!prepared.solidRepair||prepared.report.removedDuplicateTriangles+prepared.report.removedZeroAreaTriangles+prepared.report.removedLooseTriangles+prepared.report.flippedTriangles+prepared.report.addedTriangles>0;
    var bytes=changed&&prepared.sourceBytes?prepared.sourceBytes:m.sourceBytes;
    var candidate=changed&&prepared.sourceBytes?StlImport.decode(bytes):null;
    var changes=prepared.changes.automatic.concat(prepared.changes.proposed);
    var usedReferences=changes.reduce(function(sum,issue){return sum+issue.triangleIds.length+issue.edgeVertexIds.length+issue.vertexIds.length;},0);
    var diagnostics=StlDiagnostics.inspect(candidate||mesh,{maxRecords:1000-changes.length,maxReferences:200000-usedReferences},candidate?'candidate':'source');
    var sourceHash=await sourceDigest(m.sourceBytes),preparedHash=changed?await sourceDigest(bytes):sourceHash;
    var options={version:3,lengthUnit:m.lengthUnit,patchAngleDegrees:m.patchAngleDegrees};
    var geometry=null,validation=null,error=prepared.error;
    send('stl-progress',{message:changed?'Checking the prepared model…':'Checking solid geometry…'});
    try{var parsed=await StlImport.identify(StlImport.parse(bytes,options),bytes);geometry=geometryFromParsed(parsed,m,options);validation=parsed.validation;error=null;}
    catch(e){error={code:solidError?solidError.code:e.code||'STL_PREPARATION_FAILED',message:solidError?solidError.message:prepared.error?prepared.error.message:e.message};}
    var result={state:geometry?(prepared.shapeChanged?'needs-review':'ready'):'blocked',sourceDigest:sourceHash,preparedDigest:preparedHash,
      sourceTriangleByCandidate:candidate?prepared.sourceTriangleByCandidate:null,preparedSourceBytes:changed?bytes:null,candidatePreview:candidate?preview(candidate,'candidate'):null,geometryCandidate:geometry,
      solidRepair:prepared.solidRepair||null,diagnostics:diagnostics,changes:prepared.changes,changesTruncated:prepared.changesTruncated,shapeChanged:prepared.shapeChanged,validation:validation,error:error,lengthUnit:m.lengthUnit};
    send('stl-prepared',{result:result});
  }catch(error){if(m)send('error',{error:{code:error.code||'STL_PREPARATION_FAILED',userMessage:error.message}});}
};
self.postMessage({protocol:WORKER_PROTOCOL_VERSION,type:'ready',worker:STL_PREPARATION_WORKER_KIND});
