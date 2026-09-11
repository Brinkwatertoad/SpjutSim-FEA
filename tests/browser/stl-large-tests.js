(async function () {
  'use strict';
  var api=globalThis.SpjutsimFEA, status=document.getElementById('test-status'), client;
  function assert(value,message){if(!value)throw new Error(message);}
  function denseCube(){
    // 128×128 quads per cube face: 196,608 triangles. Split 1,696 faces
    // around their centroids to reach exactly 200,000 without opening edges.
    var bytes=new ArrayBuffer(84+200000*50),view=new DataView(bytes),count=0,splits=1696;
    view.setUint32(80,200000,true);
    function write(points){points.forEach(function(p,j){p.forEach(function(v,k){view.setFloat32(84+count*50+12+j*12+k*4,v,true);});});count++;}
    function triangle(a,b,c){if(splits>0){splits--;var p=a.map(function(v,i){return(v+b[i]+c[i])/3;});write([a,b,p]);write([b,c,p]);write([c,a,p]);}else write([a,b,c]);}
    [function(u,v){return[0,u,v];},function(u,v){return[1,u,v];},function(u,v){return[u,0,v];},function(u,v){return[u,1,v];},function(u,v){return[u,v,0];},function(u,v){return[u,v,1];}].forEach(function(p,f){
      for(var i=0;i<128;i++)for(var j=0;j<128;j++){
        var a=p(i/128,j/128),b=p((i+1)/128,j/128),c=p((i+1)/128,(j+1)/128),d=p(i/128,(j+1)/128);
        if([0,3,4].includes(f)){triangle(c,b,a);triangle(d,c,a);}else{triangle(a,b,c);triangle(a,c,d);}
      }
    });return bytes;
  }
  try {
    if(new URLSearchParams(location.search).get('fixture')==='gargoyle'){
      var supplied=await(await fetch('../fixtures/stl/cathedral_gargoyle.stl')).arrayBuffer();
      assert(supplied.byteLength===3308784&&new DataView(supplied).getUint32(80,true)===66174,'The supplied gargoyle fixture changed');
      for(var mode of ['original','reconstruct','remesh']){
        client=new api.MesherClient();var code=null;
        try{await client.importGeometry({sourceName:'cathedral_gargoyle.stl',sourceFormat:'stl',sourceBytes:supplied,
          importOptions:{version:2,lengthUnit:'mm',patchAngleDegrees:40,normalization:'none',surfaceMode:mode,reconstructionToleranceM:mode==='reconstruct'?.01e-3:null,remeshFeatureAngleDegrees:40}});}
        catch(error){code=error.diagnostic&&error.diagnostic.code;assert(error.message.includes('Repair'),'Topology failure lacks an actionable next step');}
        finally{client.dispose();}
        assert(code==='STL_NONMANIFOLD','Gargoyle should reach topology validation in '+mode+', received '+code);
      }
      globalThis.__stlResourceEvidence={fixture:'cathedral_gargoyle.stl',triangles:66174,bytes:supplied.byteLength,rejection:'STL_NONMANIFOLD',modes:['original','reconstruct','remesh']};
      status.textContent='Passed';status.dataset.result='passed';return;
    }
    var source=denseCube(),options={version:2,lengthUnit:'m',patchAngleDegrees:40,normalization:'none',surfaceMode:'original',reconstructionToleranceM:null};
    var evidence=[];
    for(var mode of ['original','reconstruct']){
      options.surfaceMode=mode;options.reconstructionToleranceM=mode==='reconstruct'?.001:null;
      client=new api.MesherClient();var started=performance.now();
      var geometry=await client.importGeometry({sourceName:'dense.stl',sourceFormat:'stl',sourceBytes:source,importOptions:options});
      assert(geometry.sourceMetadata.triangleCount===200000&&geometry.faceIds.length===6,'Large source lost triangles or selection groups');
      assert(Math.abs(geometry.volumeM3-1)<1e-12,'Large source changed volume');
      var importMs=performance.now()-started;
      var memory=await new Promise(function(resolve,reject){client.worker.onmessage=function(event){if(event.data.type==='diagnostics-result')resolve(event.data.result);};client.worker.onerror=reject;client.worker.postMessage({protocol:api.WORKER_PROTOCOL_VERSION,type:'diagnostics',requestId:'large-source-memory'});});
      function previewBytes(preview){return preview?preview.positionsM.byteLength+preview.normals.byteLength+preview.indices.byteLength+preview.featureEdges.positionsM.byteLength+preview.featureEdges.indices.byteLength:0;}
      evidence.push({mode:mode,triangles:200000,importMs:importMs,previewBytes:previewBytes(geometry.preview)+previewBytes(geometry.originalPreview),mesherWasmBytes:memory.wasmMemoryBytes});
      client.dispose();
    }
    client=new api.MesherClient();started=performance.now();
    var mesh=await client.generateMesh({geometry:geometry,sourceBytes:source,settings:{preset:'coarse',elementType:'tet10'}});
    assert(mesh.quality.minimumJacobian>0&&Object.keys(mesh.geometryFaceMap).length===6,'Large-source reconstructed mesh lost valid boundaries');
    assert(mesh.statistics.nodeCount<10000,'Reconstruction retained the dense source tessellation');
    evidence.push({meshMs:performance.now()-started,nodes:mesh.statistics.nodeCount,elements:mesh.statistics.elementCount,minimumJacobian:mesh.quality.minimumJacobian});
    globalThis.__stlResourceEvidence=evidence;status.textContent='Passed';status.dataset.result='passed';
  }catch(error){status.textContent=(error.diagnostic?error.diagnostic.code+': ':'')+error.message;status.dataset.result='failed';}
  finally{if(client)client.dispose();}
}());
