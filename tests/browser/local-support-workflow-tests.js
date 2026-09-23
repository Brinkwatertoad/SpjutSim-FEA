(async function(){'use strict';
 var api=SpjutsimFEA,status=document.getElementById('test-status'),mesher=new api.MesherClient(),records=[];
 function check(ok,message){if(!ok)throw Error(message);}
 function near(a,b,t){return Math.abs(a-b)<=t;}
 async function solve(app){var solver=new api.SolverClient();try{
   var revision=app.beginSolvePreflight(),input=api.prepareSolverInput(app.document),pre=await solver.preflight(input,revision,8);
   app.completeSolvePreflight(revision,pre);app.beginSolve();
   var result=await solver.solve(revision,Object.assign({},app.document.solveSettings,{relativeTolerance:1e-11}),false);
   app.completeSolve(revision,result);return {result:result,preflight:pre};
 }finally{solver.dispose();}}
 try{
  var bytes=await (await fetch('../fixtures/generated-unit-cube-m.step')).arrayBuffer();
  var geometry=await mesher.importGeometry({geometryId:'local-cube',sourceName:'cube.step',sourceFormat:'step',sourceBytes:bytes});
  check(Object.keys(geometry.planarFaces).length===6,'CAD cube needs six validated plane descriptors');
  function face(axis,sign){return geometry.faceIds.find(function(id){return geometry.planarFaces[id].normal[axis]*sign>.999;});}
  for(var type of ['tet4','tet10']){
   var app=new api.AppController({document:api.createAnalysisDocument()});
   app.replaceGeometry(geometry,{sourceName:'cube.step',sourceFormat:'step',sourceBytes:bytes});
   app.replaceMaterial({youngsModulusPa:1e9,poissonsRatio:.25,densityKgM3:1000});
   app.replaceMeshSettings({preset:'coarse',elementType:type});
   for(var axis=0;axis<3;axis++){
    var id=face(axis,-1);app.replaceSelectedFaces([id]);
    app.createBoundaryCondition({type:'support',componentsM:{z:0},frame:api.planarFaceFrame(geometry,id),preset:'symmetry'});
   }
   app.replaceSelectedFaces([face(0,1)]);
   app.createLoad({type:'total-force',forceN:[0,0,1000],frame:api.planarFaceFrame(geometry,face(0,1))});
   var authored=JSON.stringify(app.document.boundaryConditions);
   app.beginAssignmentDraft('support',app.document.boundaryConditions[0].id);
   app.updateAssignmentDraft({definition:{type:'support',componentsM:{z:.002},frame:app.document.boundaryConditions[0].frame,preset:'sliding'}});
   app.cancelAssignmentDraft();check(JSON.stringify(app.document.boundaryConditions)===authored,'cancel changed committed frame');
   app.rotateGeometryAroundGlobalAxis('z',37);
   check(JSON.stringify(app.document.boundaryConditions)===authored,'orientation rewrote canonical frame');
   app.undoEngineeringEdit();app.redoEngineeringEdit();
   var rotated=app.document.geometry;
   app.beginMeshGeneration();app.completeMeshGeneration(await mesher.generateMesh({geometry:rotated,settings:app.document.meshSettings,sourceBytes:bytes}));
   check(app.document.constraintStability.rank===6,'local support rank');
   var solved=await solve(app),r=solved.result,ax=api.transformVector3(rotated.orientation.rotation,[1,0,0]),max=0;
   for(var n=0;n<r.displacementM.length;n+=3)max=Math.max(max,r.displacementM[n]*ax[0]+r.displacementM[n+1]*ax[1]+r.displacementM[n+2]*ax[2]);
   check(near(max,1e-6,1e-11),'rotated axial displacement');
   check(near(r.extrema.rawVonMisesMax.valuePa,1000,.01),'rotated axial stress');
   check(r.equilibrium.relativeResidual<1e-7,'global reaction balance');
   ax.forEach(function(v,a){check(near(r.equilibrium.totalReactionN[a],-1000*v,.001),'rotated reaction component');});
   var glyph=api.buildAnalysisGlyphDescriptors(app.document).find(function(g){return g.type==='total-force';});
   check(glyph.direction.every(function(v,a){return near(v,ax[a],1e-10);}), 'local force arrow');
   var saved=await api.readProjectFile(await api.writeProjectFile(await api.createProjectSnapshot(app,{includeDerived:true})));
   var reopened=api.prepareProjectCandidate(saved,geometry);
   check(JSON.stringify(reopened.document.boundaryConditions)===authored,'project lost frames');
   check(reopened.document.results && !reopened.cacheWarning,'reopen local results');
   records.push({case:type+'-rotated-axial',displacementM:max,referenceDisplacementM:1e-6,stressPa:r.extrema.rawVonMisesMax.valuePa,referenceStressPa:1000,reactionN:r.equilibrium.totalReactionN,relativeEquilibrium:r.equilibrium.relativeResidual,nnz:solved.preflight.exactNnz});
   var migration=api.createReplacementMigrationDraft(app.document,geometry,{sourceName:'cube.step',sourceFormat:'step',sourceBytes:bytes});
   migration.items.forEach(function(item,i){api.mapReplacementMigrationItem(migration,i,item.oldFaceIds);});
   var transfer=api.buildReplacementMigrationTransfer(migration);check(transfer.boundaryConditions[0].frame.faceId===face(0,-1),'replacement frame mapping');
   app.replaceBoundaryCondition(app.document.boundaryConditions[0].id,Object.assign({},app.document.boundaryConditions[0],{enabled:false}));
   check(app.document.constraintStability.rank<6,'suppression must release local freedom');
   app.undoEngineeringEdit();check(app.document.constraintStability.rank===6,'undo must restore frame stability');
  }
  var curvedBytes=await(await fetch('../fixtures/generated-cylinder-r0_5-h1-m.step')).arrayBuffer();
  var curved=await mesher.importGeometry({geometryId:'local-cylinder',sourceName:'cylinder.step',sourceFormat:'step',sourceBytes:curvedBytes});
  check(Object.keys(curved.planarFaces).length===2,'curved cylinder wall must not become a plane');
  var rejected=false;try{api.planarFaceFrame(curved,curved.faceIds.find(function(id){return !curved.planarFaces[id];}));}catch(e){rejected=true;}check(rejected,'curved support rejection');
  window.localSupportEvidence=records;status.textContent='Passed local supports (Tet4/Tet10, rotated reactions, reopen, undo, curved rejection)';
 }catch(error){status.textContent='Failed: '+error.message;throw error;}finally{mesher.dispose();}
}());
