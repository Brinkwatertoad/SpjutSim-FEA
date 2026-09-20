(function(){
 'use strict';
 var status=document.getElementById('test-status');
 function assert(v,m){if(!v)throw new Error(m);}
 document.getElementById('application-frame').addEventListener('load',async function(){
  var win=this.contentWindow,api=win.SpjutsimFEA,client,evidence=[];window.__stlSurfaceEvidence={cases:evidence};
  try {
   var distanceIndex=new StlSpatial.Index(new Float64Array([0,0,0,1,0,0,0,1,0]),new Uint32Array([0,1,2]));
   [[[.2,.3,2],2],[[.5,-1,0],1],[[-1,-1,0],Math.sqrt(2)],[[1,1,0],Math.SQRT1_2]].forEach(function(test){assert(Math.abs(distanceIndex.distance(test[0])-test[1])<1e-12,'Surface distance lost a face, edge or vertex closest point');});
   if(new URLSearchParams(location.search).get('fixture')==='gargoyle'){
    var raw=await(await win.fetch('../tests/fixtures/stl/cathedral_gargoyle.stl')).arrayBuffer();
    client=new api.StlPreparationClient();var repaired=await client.prepare({sessionId:'gargoyle-mesh',generation:0,geometryId:'gargoyle-mesh',sourceName:'cathedral_gargoyle.stl',sourceBytes:raw,lengthUnit:'mm',patchAngleDegrees:40,maxHoleDiameterRatio:.01});client.dispose();
    assert(repaired.state==='needs-review'&&repaired.solidRepair.unchangedTriangleCount>50000,'Detailed gargoyle repair failed');
    var started=performance.now(),progress=[];window.__stlSurfaceEvidence={progress:progress};
    client=new api.MesherClient({onProgress:function(p){progress.push({ms:performance.now()-started,stage:p.stage,message:p.userMessage,detail:p.detail});console.log(p.userMessage);}});
    var gargoyle=await client.generateMesh({geometry:repaired.geometryCandidate,sourceBytes:repaired.preparedSourceBytes,settings:{preset:'coarse',elementType:'tet4',stlSurface:api.defaultStlSurface()}});client.dispose();
    assert(gargoyle.quality.stlAnalysis.method==='discrete-boundary','Complex surface still depends on parametrization charts');
    assert(!gargoyle.quality.invertedElementCount&&!gargoyle.quality.nearZeroJacobianCount,'Gargoyle tetrahedra failed Jacobian checks');
    window.__stlSurfaceEvidence={cases:[{fixture:'cathedral_gargoyle',repair:repaired.solidRepair,statistics:gargoyle.statistics,quality:gargoyle.quality,ms:performance.now()-started,progress:progress}]};status.textContent='Passed';status.dataset.result='passed';return;
   }
   assert(api.defaultStlSurface().method==='analysis','STL defaults to freezing source triangles');
   // Twelve deliberately elongated source triangles, both aligned and rotated.
   for(var rotated of [false,true]) {
    var text=new TextDecoder().decode(StlTestShapes.subdividedCube(1)).replace(/vertex ([^\n]+)/g,function(line,xyz){
     var p=xyz.split(' ').map(Number);p[0]*=20;p[1]*=.5;p[2]*=.5;
     if(rotated){var axis=[1/3,2/3,2/3],u=[2/Math.sqrt(5),-1/Math.sqrt(5),0],v=[2/(3*Math.sqrt(5)),4/(3*Math.sqrt(5)),-5/(3*Math.sqrt(5))];p=[3,-2,1].map(function(o,i){return o+axis[i]*p[0]+u[i]*p[1]+v[i]*p[2];});}
     return 'vertex '+p.join(' ');
    });
    var source=new win.TextEncoder().encode(text).buffer;
    client=new api.StlPreparationClient();
    var prepared=await client.prepare({sessionId:'thin',generation:0,geometryId:'thin',sourceName:'thin.stl',sourceBytes:source,lengthUnit:'m',patchAngleDegrees:100,maxHoleDiameterRatio:0});client.dispose();
    assert(prepared.state==='ready','Thin source failed strict solid validation');
    var geometry=prepared.geometryCandidate;
    client=new api.MesherClient();
    var mesh=await client.generateMesh({geometry:geometry,sourceBytes:source,settings:{preset:'coarse',elementType:rotated?'tet10':'tet4',stlSurface:api.defaultStlSurface()}});client.dispose();
    assert(mesh.quality.maximumEdgeRatio<5 && mesh.quality.p05>.2,'Long source facets survived in the analysis mesh');
    assert(mesh.quality.stlAnalysis && mesh.quality.stlAnalysis.thicknessM>.49 && mesh.quality.stlAnalysis.thicknessM<.51,'Sizing missed rotated thickness');
    assert(mesh.quality.stlAnalysis.relativeVolumeError<1e-8,'Thin-part volume changed');
    assert(mesh.boundaryFaces.faceRanges.length===geometry.faceIds.length && geometry.faceIds.length===1,'Internal planes changed engineering groups');
    assert(mesh.quality.stlBoundaryAreas.meshM2.every(function(a,i){return Math.abs(a/mesh.quality.stlBoundaryAreas.sourceM2[i]-1)<1e-8;}),'Pressure boundary area changed');
    for(var bad of [null,Object.assign({},mesh.quality.stlAnalysis,{relativeVolumeError:.02}),Object.assign({},mesh.quality.stlAnalysis,{sampledDeviationM:1}),Object.assign({},mesh.quality.stlAnalysis,{maximumDeviationRatio:1.01}),Object.assign({},mesh.quality.stlAnalysis,{estimatedElementCount:Infinity}),Object.assign({},mesh.quality.stlAnalysis,{gradation:0})])assert(!api.validateVolumeMeshResult(Object.assign({},mesh,{quality:Object.assign({},mesh.quality,{stlAnalysis:bad})}),geometry.faceIds).valid,'Invalid fidelity report crossed the mesh boundary');
    evidence.push({rotated:rotated,statistics:mesh.statistics,quality:mesh.quality});
   }
   // Public regression for the chart-free branch, independent of private STLs.
   var roundSource=new win.Uint8Array(new Uint8Array(StlTestShapes.round(600,0,false))).buffer;
   client=new api.StlPreparationClient();var roundPrepared=await client.prepare({sessionId:'round',generation:0,geometryId:'round',sourceName:'round.stl',sourceBytes:roundSource,lengthUnit:'m',patchAngleDegrees:40,maxHoleDiameterRatio:0});client.dispose();
   assert(roundPrepared.state==='ready'&&roundPrepared.geometryCandidate.faceIds.length===3,'Detailed cylinder did not retain its wall and caps');
   var roundRequest={sessionId:'round-split',generation:0,geometryId:'round-split',sourceName:'round.stl',sourceBytes:roundSource,lengthUnit:'m',patchAngleDegrees:40,maxHoleDiameterRatio:0,
    faceEdits:{sourceHash:roundPrepared.geometryCandidate.sourceMetadata.sha256,operations:[{type:'split',faceIndices:[0]}]}};
   client=new api.StlPreparationClient();roundPrepared=await client.prepare(roundRequest);client.dispose();assert(roundPrepared.state==='ready','Dense cylinder cap could not be split');
   var roundProgress=[];evidence.push({fixture:'round-progress',progress:roundProgress});client=new api.MesherClient({onProgress:function(p){roundProgress.push(p);}});var roundMesh=await client.generateMesh({geometry:roundPrepared.geometryCandidate,sourceBytes:roundSource,settings:{preset:'coarse',elementType:'tet4',stlSurface:api.defaultStlSurface()}});client.dispose();
   assert(roundMesh.quality.stlAnalysis.method==='discrete-boundary','More than 512 surface planes still required charts');
   assert(roundMesh.boundaryFaces.faceRanges.length===4,'Curved remeshing lost the corrected cap faces');
   evidence.push({fixture:'round-600',statistics:roundMesh.statistics,quality:roundMesh.quality});
   // Face recognition is an engineering boundary: split one flat loading area,
   // mesh it, and verify the actual pressure resultant and supported nodes.
   var blockSource=new win.Uint8Array(new Uint8Array(StlTestShapes.roundedBlock(8,false))).buffer;
   client=new api.StlPreparationClient();var blockRequest={sessionId:'block',generation:0,geometryId:'block',sourceName:'block.stl',sourceBytes:blockSource,lengthUnit:'m',patchAngleDegrees:40,maxHoleDiameterRatio:0};
   var block=await client.prepare(blockRequest);client.dispose();assert(block.geometryCandidate.faceIds.length===10,'Rounded mechanical faces were not recognized');
   var bg=block.geometryCandidate,top=bg.preview.faceRanges.findIndex(function(r){return r.count===6&&bg.preview.normals[r.start*3+1]>.99;});
   blockRequest.faceEdits={sourceHash:bg.sourceMetadata.sha256,operations:[{type:'split',faceIndices:[top]}]};
   client=new api.StlPreparationClient();block=await client.prepare(blockRequest);client.dispose();bg=block.geometryCandidate;
   assert(bg&&bg.faceIds.length===11,'Prepared manual face correction was lost');
   client=new api.MesherClient();var blockMesh=await client.generateMesh({geometry:bg,sourceBytes:blockSource,settings:{preset:'coarse',elementType:'tet4',stlSurface:api.defaultStlSurface()}});client.dispose();
   assert(blockMesh.boundaryFaces.faceRanges.length===11,'Mesh lost corrected selectable faces');
   var loadFace=bg.preview.faceRanges.find(function(r){return r.count===3&&bg.preview.normals[r.start*3+1]>.99;}).faceId;
   var supportFace=bg.preview.faceRanges.find(function(r){return r.count===6&&bg.preview.normals[r.start*3+1]<-.99;}).faceId;
   var controller=new api.AppController({document:api.createAnalysisDocument()});controller.replaceGeometry(bg,{sourceName:'block.stl',sourceFormat:'stl',stlSource:bg.stlSource,sourceBytes:blockSource});
   controller.replaceMaterial({name:'Test',youngsModulusPa:1e9,poissonsRatio:.25,densityKgM3:1000});controller.completeMeshGeneration(blockMesh);
   controller.replaceSelectedFaces([supportFace]);controller.createBoundaryCondition({type:'support',componentsM:{x:0,y:0,z:0}});
   controller.replaceSelectedFaces([loadFace]);controller.createLoad({type:'pressure',pressurePa:100});
   var projected=api.prepareSolverInput(controller.document),force=[0,0,0];projected.loads[0].equivalentNodalForcesN.forEach(function(v,i){force[i%3]+=v;});
   assert(Math.abs(force[0])+Math.abs(force[2])<1e-8&&Math.abs(force[1]+80)<1e-8,'Pressure included the fillet or the other half of the loading face');
   projected.boundaryConditions[0].nodeIndices.forEach(function(i){assert(Math.abs(blockMesh.nodePositionsM[3*i+1]+1)<1e-12,'Support escaped its recognized flat face');});
   evidence.push({fixture:'rounded-block-split-pressure',faceCount:bg.faceIds.length,pressurePa:100,expectedAreaM2:.8,resultantN:force,supportedNodes:projected.boundaryConditions[0].nodeIndices.length,statistics:blockMesh.statistics,quality:blockMesh.quality});
   // A thin appendage can be much smaller than every whole-part extent.
   var axes=[[0,2,4],[0,.1,1],[0,.1,1]],facets=[];
   function occupied(x,y,z){return x>=0&&x<2&&y>=0&&y<2&&z>=0&&z<2&&(x===0||y===0&&z===0);}
   for(var x=0;x<2;x++)for(var y=0;y<2;y++)for(var z=0;z<2;z++)if(occupied(x,y,z)) {
    var cell=[x,y,z];
    for(var axis=0;axis<3;axis++)for(var side=0;side<2;side++) {
     var neighbor=cell.slice();neighbor[axis]+=side?1:-1;if(occupied.apply(null,neighbor))continue;
     var u=(axis+1)%3,v=(axis+2)%3;
     var corners=[[0,0],[1,0],[1,1],[0,1]].map(function(uv){var q=cell.slice();q[axis]+=side;q[u]+=uv[0];q[v]+=uv[1];return q.map(function(i,a){return axes[a][i];});});
     if(!side)corners.reverse();facets.push([corners[0],corners[1],corners[2]],[corners[0],corners[2],corners[3]]);
    }
   }
   var ascii='solid appendage\n'+facets.map(function(f){return 'facet normal 0 0 0\nouter loop\n'+f.map(function(p){return 'vertex '+p.join(' ');}).join('\n')+'\nendloop\nendfacet';}).join('\n')+'\nendsolid appendage';
   var parsed=StlImport.parse(new TextEncoder().encode(ascii).buffer,{version:3,lengthUnit:'m',patchAngleDegrees:40});
   var analysis={parsed:parsed,index:new StlSpatial.Index(parsed.positions,parsed.triangles)},sizes=StlAnalysis.sizing(analysis,{minSizeM:.1,maxSizeM:1});
   assert(Math.abs(analysis.thicknessM-.1)<1e-10 && analysis.field.at(3,.05,.05)<.052,'Local thin appendage escaped thickness sizing');
   assert(analysis.field.at(.5,.5,.5)>.12&&sizes.maxSizeM===1,'Tiny appendage forced global refinement');
   assert(Math.abs(analysis.field.at(3,.05,.05)-analysis.field.at(3.1,.05,.05))<=.035+1e-12,'Local field exceeds its grading bound');
   var invalid=p=>{var caught;try{StlImport.validateMesh(p,{version:3,lengthUnit:'m',patchAngleDegrees:40});}catch(e){caught=e;}return caught;};
   var badIndices=parsed.triangles.slice();badIndices[0]=parsed.positions.length/3;
   assert(invalid({positions:parsed.positions,triangles:badIndices}).code==='STL_INVALID_INDEX','Native connectivity bypassed indexed validation');
   var badPositions=parsed.positions.slice();badPositions[0]=NaN;
   assert(invalid({positions:badPositions,triangles:parsed.triangles}).code==='STL_INVALID_COORDINATE','Native coordinates bypassed indexed validation');
   // Equal area and volume do not imply geometric fidelity: translate a cube.
   parsed=StlImport.parse(StlTestShapes.subdividedCube(1),{version:3,lengthUnit:'m',patchAngleDegrees:100});
   analysis={parsed:parsed,index:new StlSpatial.Index(parsed.positions,parsed.triangles),method:'planar-boundaries'};StlAnalysis.sizing(analysis,{minSizeM:.1,maxSizeM:1});
   var moved=parsed.positions.map(function(v,i){return v+(i%3===0?.01:0);}),failed;
   try { StlAnalysis.verify(analysis,moved,{solverConnectivity:parsed.triangles,solverFaceRanges:[{start:0,count:parsed.triangles.length}]},3); }catch(e){failed=e;}
   assert(failed&&failed.code==='STL_FIDELITY_FAILED'&&failed.message.includes('moved too far'),'Area-preserving boundary displacement escaped fidelity checks');
   window.__stlSurfaceEvidence={cases:evidence};status.textContent='Passed';status.dataset.result='passed';
  }catch(e){status.textContent='Failed: '+e.message;status.dataset.result='failed';}finally{if(client)client.dispose();}
 });
}());
