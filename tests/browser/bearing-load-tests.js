(async function(){'use strict';
 var api=SpjutsimFEA,status=document.getElementById('test-status'),mesher=new api.MesherClient();
 function check(ok,message){if(!ok)throw Error(message);}
 try{
  var bytes=await(await fetch('../fixtures/cad-corpus/through-hole.step')).arrayBuffer();
  var geometry=await mesher.importGeometry({geometryId:'bearing-hole',sourceName:'hole.step',sourceFormat:'step',sourceBytes:bytes});
  check(geometry.cylindricalFaces && Object.keys(geometry.cylindricalFaces).length,'analytic cylindrical descriptors are required');
  var faces=Object.keys(geometry.cylindricalFaces),band=api.resolveBearingBand(geometry,faces);
  var candidate={id:'b',name:'Bearing',type:'bearing',faceIds:faces,forceN:[100,0,0],distribution:'compressive-cosine'};
  check(api.validateLoad(candidate,geometry.faceIds,geometry).valid,'valid transverse bearing rejected');
  check(!api.validateLoad(Object.assign({},candidate,{forceN:band.axis.map(function(v){return v*100;})}),geometry.faceIds,geometry).valid,'axial bearing accepted');
  check(!api.validateLoad(Object.assign({},candidate,{faceIds:[geometry.faceIds.find(function(id){return !faces.includes(id);})]}),geometry.faceIds,geometry).valid,'noncylindrical face accepted');
  // Split a full band into two compatible half descriptors without changing CAD.
  var descriptor=geometry.cylindricalFaces[faces[0]],synthetic=Object.assign({},geometry,{faceIds:['a','b'],cylindricalFaces:{a:Object.assign({},descriptor,{angularExtentRad:Math.PI}),b:Object.assign({},descriptor,{radialStart:descriptor.radialStart.map(function(v){return -v;}),angularExtentRad:Math.PI})}});
  check(api.resolveBearingBand(synthetic,['a','b']).radiusM===band.radiusM,'split-band coverage rejected');
  var partialRejected=false;try{api.resolveBearingBand(synthetic,['a']);}catch(e){partialRejected=true;}check(partialRejected,'partial band accepted');
  var compatible=synthetic.cylindricalFaces.b;
  synthetic.cylindricalFaces.b=Object.assign({},compatible,{axis:[0,1,0]});var axisRejected=false;try{api.resolveBearingBand(synthetic,['a','b']);}catch(e){axisRejected=true;}check(axisRejected,'noncoaxial band accepted');
  synthetic.cylindricalFaces.b=Object.assign({},compatible,{radiusM:band.radiusM*2});var mixedRejected=false;try{api.resolveBearingBand(synthetic,['a','b']);}catch(e){mixedRejected=true;}check(mixedRejected,'mixed-radius band accepted');
  var splitBytes=await(await fetch('../fixtures/bearing/split-cylinder.step')).arrayBuffer();
  var split=await mesher.importGeometry({geometryId:'bearing-split',sourceName:'split.step',sourceFormat:'step',sourceBytes:splitBytes}),splitFaces=Object.keys(split.cylindricalFaces);
  check(splitFaces.length===2 && Math.abs(api.resolveBearingBand(split,splitFaces).radiusM-.5)<1e-9,'split cylindrical CAD extraction');
  check(!api.validateLoad(Object.assign({},candidate,{faceIds:[splitFaces[0]]}),split.faceIds,split).valid,'partial cylindrical CAD selection accepted');
  var splitApp=new api.AppController({document:api.createAnalysisDocument()});splitApp.replaceGeometry(split,{sourceName:'split.step',sourceFormat:'step',sourceBytes:splitBytes});splitApp.replaceMaterial({youngsModulusPa:1e9,poissonsRatio:.25});
  splitApp.replaceSelectedFaces([Object.keys(split.planarFaces).find(function(id){return split.planarFaces[id].normal[2]<-.99;})]);splitApp.createBoundaryCondition({type:'support',componentsM:{x:0,y:0,z:0}});splitApp.replaceSelectedFaces(splitFaces);splitApp.createLoad(candidate);
  splitApp.replaceMeshSettings({preset:'custom',minSizeM:.05,maxSizeM:.2,elementType:'tet10'});splitApp.beginMeshGeneration();splitApp.completeMeshGeneration(await mesher.generateMesh({geometry:split,settings:splitApp.document.meshSettings,sourceBytes:splitBytes}));
  var seamSolver=new api.SolverClient();try{var seamRevision=splitApp.beginSolvePreflight(),seamPre=await seamSolver.preflight(api.prepareSolverInput(splitApp.document),seamRevision,8);splitApp.completeSolvePreflight(seamRevision,seamPre);splitApp.beginSolve();var seamResult=await seamSolver.solve(seamRevision,splitApp.document.solveSettings,false);splitApp.completeSolve(seamRevision,seamResult);check(seamResult.surfaceLoadResultants.length===1&&Math.abs(seamResult.equilibrium.totalAppliedForceN[0]-100)<.5,'split CAD seam load resultants');}finally{seamSolver.dispose();}
  var coneBytes=await(await fetch('../fixtures/cad-corpus/cone.step')).arrayBuffer(),cone=await mesher.importGeometry({geometryId:'bearing-cone',sourceName:'cone.step',sourceFormat:'step',sourceBytes:coneBytes});
  check(Object.keys(cone.cylindricalFaces).length===0,'cone must not become a bearing band');
  var app=new api.AppController({document:api.createAnalysisDocument()});app.replaceGeometry(geometry,{sourceName:'hole.step',sourceFormat:'step',sourceBytes:bytes});
  app.replaceMaterial({youngsModulusPa:1e9,poissonsRatio:.25});app.replaceSelectedFaces([Object.keys(geometry.planarFaces)[0]]);app.createBoundaryCondition({type:'support',componentsM:{x:0,y:0,z:0}});
  app.replaceSelectedFaces(faces);var id=app.createLoad(candidate);
  var levels=[];
  for(var target of [.2,.14,.098]){
  app.replaceMeshSettings({preset:'custom',minSizeM:target/4,maxSizeM:target,elementType:'tet10'});app.beginMeshGeneration();app.completeMeshGeneration(await mesher.generateMesh({geometry:geometry,settings:app.document.meshSettings,sourceBytes:bytes}));
  var solver=new api.SolverClient();try{var rev=app.beginSolvePreflight(),pre=await solver.preflight(api.prepareSolverInput(app.document),rev,8);app.completeSolvePreflight(rev,pre);app.beginSolve();var result=await solver.solve(rev,app.document.solveSettings,false);app.completeSolve(rev,result);
   check(Math.abs(result.equilibrium.totalAppliedForceN[0]-100)<.5,'bearing applied force');check(result.equilibrium.relativeResidual<1e-6 && result.equilibrium.momentRelativeResidual<1e-6,'bearing equilibrium');
  }finally{solver.dispose();}
  var probe={distance:Infinity},positions=app.document.mesh.nodePositionsM,connectivity=app.document.mesh.elementConnectivity;
  for(var element=0;element<connectivity.length/10;element++){
    var center=[0,0,0];for(var n=0;n<4;n++)for(var a=0;a<3;a++)center[a]+=positions[connectivity[element*10+n]*3+a]/4;
    var distance=Math.hypot(center[0]-.75,center[1]-.5,center[2]-.15);if(distance<probe.distance)probe={distance:distance,element:element,locationM:center};
  }
  var stress=Array.from(result.rawElementFields.stressPa.slice(probe.element*6,probe.element*6+6)),probeVonMises=Math.sqrt(((stress[0]-stress[1])**2+(stress[1]-stress[2])**2+(stress[2]-stress[0])**2)/2+3*(stress[3]**2+stress[4]**2+stress[5]**2));
  levels.push({probeLocationM:probe.locationM,probeVonMisesPa:probeVonMises,targetSizeM:target,nodeCount:app.document.mesh.statistics.nodeCount,maxDisplacementM:result.extrema.maxDisplacement.valueM,strainEnergyJ:result.solverStatistics.strainEnergyJ,rawPeakVonMisesPa:result.extrema.rawVonMisesMax.valuePa,equilibrium:result.equilibrium});
  }
  var last=levels[2],previous=levels[1];check(Math.abs(last.probeVonMisesPa/previous.probeVonMisesPa-1)<.05,'bearing nonsingular probe must stabilize within 5%');check(Math.abs(last.maxDisplacementM/previous.maxDisplacementM-1)<.02 && Math.abs(last.strainEnergyJ/previous.strainEnergyJ-1)<.02,'bearing global response must stabilize across refinement');
  window.__spjutsimSurfaceReference={positions:Array.from(app.document.mesh.nodePositionsM),connectivity:Array.from(app.document.mesh.elementConnectivity),elementType:'tet10',surfaceConnectivity:Array.from(api.prepareSolverInput(app.document).loads[0].surfaceConnectivity),load:api.prepareSolverInput(app.document).loads[0],supports:Array.from(api.prepareSolverInput(app.document).boundaryConditions[0].nodeIndices),displacement:Array.from(result.displacementM),stress:Array.from(result.rawElementFields.stressPa),strainEnergyJ:result.solverStatistics.strainEnergyJ,material:app.document.material};
  var saved=await api.readProjectFile(await api.writeProjectFile(await api.createProjectSnapshot(app,{includeDerived:true})));var reopened=api.prepareProjectCandidate(saved,geometry);
  check(reopened.document.loads[0].type==='bearing' && reopened.document.results && !reopened.cacheWarning,'bearing cache roundtrip');
  var report=api.createReportText(app.document,'hole.step',100,new Date());check(report.includes('cosine') && report.includes('Moment balance'),'bearing report assumptions and moment diagnostics');
  check(api.buildAnalysisGlyphDescriptors(app.document).some(function(g){return g.type==='bearing-region';}),'loaded half must have a surface highlight');
  var glyphs=api.buildAnalysisGlyphDescriptors(app.document).filter(function(g){return g.type==='bearing';});check(glyphs.length>0 && glyphs.every(function(g){return g.direction[0]>0;}),'loaded-half compression glyphs');
  app.setAssignmentIncluded('load',id,false);check(!app.document.results,'bearing suppression invalidation');app.undoEngineeringEdit();check(app.document.loads[0].enabled,'bearing undo');
  if(new URLSearchParams(location.search).has('review'))window.__spjutsimReviewApp=app;
  window.__spjutsimUsabilityEvidence={case:'bearing-hole',levels:levels,equilibrium:result.equilibrium,mesh:app.document.mesh.statistics};
  status.textContent='Passed bearing load workflow';
 }catch(e){status.textContent='Failed: '+e.message;throw e;}finally{mesher.dispose();}
}());
