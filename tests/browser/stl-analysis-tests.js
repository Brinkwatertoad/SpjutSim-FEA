(function(){
 'use strict';
 var status=document.getElementById('test-status');
 function assert(v,m){if(!v)throw new Error(m);}
 document.getElementById('application-frame').addEventListener('load',async function(){
  var win=this.contentWindow,api=win.SpjutsimFEA,client,evidence=[];
  try {
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
    for(var bad of [null,Object.assign({},mesh.quality.stlAnalysis,{relativeVolumeError:.02}),Object.assign({},mesh.quality.stlAnalysis,{sampledDeviationM:1})])assert(!api.validateVolumeMeshResult(Object.assign({},mesh,{quality:Object.assign({},mesh.quality,{stlAnalysis:bad})}),geometry.faceIds).valid,'Invalid fidelity report crossed the mesh boundary');
    evidence.push({rotated:rotated,statistics:mesh.statistics,quality:mesh.quality});
   }
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
   assert(Math.abs(analysis.thicknessM-.1)<1e-10 && sizes.maxSizeM<.034,'Local thin appendage escaped thickness sizing');
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
