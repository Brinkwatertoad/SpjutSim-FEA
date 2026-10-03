(async function(){'use strict';var api=SpjutsimFEA,status=document.getElementById('test-status'),mesher=new api.MesherClient();
 function check(ok,m){if(!ok)throw Error(m);}
 try{
  var candidate={id:'m',name:'Torque',type:'moment',faceIds:['face'],momentNm:[0,0,100],referencePointM:[0,0,1],distribution:'minimum-squared-traction'};
  check(api.validateLoad(candidate,['face']).valid,'moment definition must validate');
  check(!api.validateLoad(Object.assign({},candidate,{momentNm:[0,NaN,1]}),['face']).valid,'nonfinite moment accepted');
  var bytes=await(await fetch('../fixtures/generated-cylinder-r0_5-h1-m.step')).arrayBuffer(),g=await mesher.importGeometry({geometryId:'moment-shaft',sourceName:'shaft.step',sourceFormat:'step',sourceBytes:bytes});
  var bottom=Object.keys(g.planarFaces).find(function(id){return g.planarFaces[id].normal[2]<-.99;}),top=Object.keys(g.planarFaces).find(function(id){return g.planarFaces[id].normal[2]>.99;});
  var app=new api.AppController({document:api.createAnalysisDocument()});app.replaceGeometry(g,{sourceName:'shaft.step',sourceFormat:'step',sourceBytes:bytes});app.replaceMaterial({youngsModulusPa:1e9,poissonsRatio:.25});app.replaceSelectedFaces([bottom]);app.createBoundaryCondition({type:'support',componentsM:{x:0,y:0,z:0}});app.replaceSelectedFaces([top]);app.createLoad(candidate);
  var records=[];
  for(var meshCase of [{type:'tet4',min:.02,max:.05},{type:'tet10',min:.035,max:.14},{type:'tet10',min:.05,max:.2}]){
   var type=meshCase.type;
   app.replaceMeshSettings({preset:'custom',minSizeM:meshCase.min,maxSizeM:meshCase.max,elementType:type});app.beginMeshGeneration();app.completeMeshGeneration(await mesher.generateMesh({geometry:g,settings:app.document.meshSettings,sourceBytes:bytes}));
   var solver=new api.SolverClient();try{var rev=app.beginSolvePreflight(),pre=await solver.preflight(api.prepareSolverInput(app.document),rev,8);app.completeSolvePreflight(rev,pre);app.beginSolve();var result=await solver.solve(rev,Object.assign({},app.document.solveSettings,{relativeTolerance:1e-10}),false);app.completeSolve(rev,result);
    var expected=100*.5/(4e8*Math.PI*.5**4/2),error=Math.abs(result.extrema.maxDisplacement.valueM/expected-1);
    check(error<.03,'shaft torsion displacement exceeds 3%: '+error);check(Math.abs(result.equilibrium.totalAppliedMomentNm[2]-100)<1e-6,'shaft torque');check(result.equilibrium.momentRelativeResidual<1e-6,'shaft moment equilibrium');
    var nearest={distance:Infinity},positions=app.document.mesh.nodePositionsM,connectivity=app.document.mesh.elementConnectivity,count=type==='tet10'?10:4;
    for(var element=0;element<connectivity.length/count;element++){
      var center=[0,0,0];for(var n=0;n<4;n++)for(var a=0;a<3;a++)center[a]+=positions[connectivity[element*count+n]*3+a]/4;
      var distance=Math.hypot(center[0]-.25,center[1],center[2]-.5);if(distance<nearest.distance)nearest={distance:distance,element:element,locationM:center};
    }
    var stress=Array.from(result.rawElementFields.stressPa.slice(nearest.element*6,nearest.element*6+6));
    var vm=Math.sqrt(((stress[0]-stress[1])**2+(stress[1]-stress[2])**2+(stress[2]-stress[0])**2)/2+3*(stress[3]**2+stress[4]**2+stress[5]**2));
    var referenceStress=Math.sqrt(3)*100*Math.hypot(nearest.locationM[0],nearest.locationM[1])/(Math.PI*.5**4/2),stressError=Math.abs(vm/referenceStress-1);
    check(stressError<.05,'shaft nonsingular shear stress exceeds 5%: '+stressError);
    check(result.surfaceLoadResultants && result.surfaceLoadResultants.length===1 && Math.abs(result.surfaceLoadResultants[0].realizedMomentNm[2]-100)<1e-6,'per-load realized torque diagnostics missing');
    records.push({targetSizeM:meshCase.max,nodeCount:app.document.mesh.statistics.nodeCount,probeLocationM:nearest.locationM,probeVonMisesPa:vm,referenceProbeVonMisesPa:referenceStress,stressRelativeError:stressError,elementType:type,displacementM:result.extrema.maxDisplacement.valueM,referenceDisplacementM:expected,relativeError:error,equilibrium:result.equilibrium});
   }finally{solver.dispose();}
  }
  var fine=records[1],coarse=records[2];
  check(Math.abs(fine.displacementM/coarse.displacementM-1)<.02,'shaft Tet10 displacement refinement exceeds 2%');
  check(Math.abs((fine.probeVonMisesPa/fine.referenceProbeVonMisesPa)/(coarse.probeVonMisesPa/coarse.referenceProbeVonMisesPa)-1)<.05,'shaft normalized nonsingular stress refinement exceeds 5%');
  for(var malformedKind of ['null','nonzero-force']){
    var malformed=api.prepareSolverInput(app.document);if(malformedKind==='null')malformed.loads[0]=null;else malformed.loads[0].forceN=[1,0,0];
    var invalidSolver=new api.SolverClient(),invalidRejected=false;
    try{await invalidSolver.preflight(malformed,app.document.analysisRevision,8);}catch(error){invalidRejected=error.diagnostic&&error.diagnostic.code==='INVALID_LOAD';}finally{invalidSolver.dispose();}
    check(invalidRejected,'worker did not reject malformed moment load: '+malformedKind);
  }
  var report=api.createReportText(app.document,'shaft.step',100,new Date());check(report.includes('squared traction') && report.includes('Moment balance'),'moment report context');
  var saved=await api.readProjectFile(await api.writeProjectFile(await api.createProjectSnapshot(app,{includeDerived:true}))),opened=api.prepareProjectCandidate(saved,g);check(opened.document.loads[0].momentNm[2]===100 && opened.document.results,'torque project reopen');
  var arrows=api.buildAnalysisGlyphDescriptors(app.document);check(arrows.some(function(g){return g.type==='moment' && g.momentDirection[2]>0;}),'torque glyph');
  var offset=Object.assign({},candidate,{type:'offset-force',faceIds:[top],forceN:[10,0,0],applicationPointM:[0,2,1]});delete offset.momentNm;check(api.validateLoad(offset,g.faceIds).valid,'offset force definition');
  if(new URLSearchParams(location.search).has('review'))window.__spjutsimReviewApp=app;
  var beamBytes=await(await fetch('../../benchmarks/validation/geometry/cantilever-prism.step')).arrayBuffer(),beam=await mesher.importGeometry({geometryId:'offset-beam',sourceName:'cantilever.step',sourceFormat:'step',sourceBytes:beamBytes});
  var fixed=beam.faceIds.find(function(id){return beam.planarFaces[id].normal[0]<-.99;}),tip=beam.faceIds.find(function(id){return beam.planarFaces[id].normal[0]>.99;});
  var beamApp=new api.AppController({document:api.createAnalysisDocument()});beamApp.replaceGeometry(beam,{sourceName:'cantilever.step',sourceFormat:'step',sourceBytes:beamBytes});beamApp.replaceMaterial({youngsModulusPa:1e9,poissonsRatio:.25});
  beamApp.replaceSelectedFaces([fixed]);beamApp.createBoundaryCondition({type:'support',componentsM:{x:0,y:0,z:0}});beamApp.replaceSelectedFaces([tip]);
  var offsetId=beamApp.createLoad({type:'offset-force',forceN:[0,0,-1000],referencePointM:[4,.125,.25],applicationPointM:[5,.125,.25]});
  beamApp.replaceMeshSettings({preset:'custom',minSizeM:.05,maxSizeM:.25,elementType:'tet10'});beamApp.beginMeshGeneration();beamApp.completeMeshGeneration(await mesher.generateMesh({geometry:beam,settings:beamApp.document.meshSettings,sourceBytes:beamBytes}));
  async function solveBeam(){var solver=new api.SolverClient();try{var rev=beamApp.beginSolvePreflight(),pre=await solver.preflight(api.prepareSolverInput(beamApp.document),rev,8);beamApp.completeSolvePreflight(rev,pre);beamApp.beginSolve();var result=await solver.solve(rev,Object.assign({},beamApp.document.solveSettings,{relativeTolerance:1e-10}),false);beamApp.completeSolve(rev,result);return result;}finally{solver.dispose();}}
  var offsetResult=await solveBeam(),referenceTip=1000*4**3/(3*1e9*(.25*.5**3/12))+1000*4**2/(2*1e9*(.25*.5**3/12));
  check(Math.abs(offsetResult.extrema.maxDisplacement.valueM/referenceTip-1)<.03,'offset cantilever analytical deflection exceeds 3%');
  check(Math.abs(offsetResult.surfaceLoadResultants[0].realizedMomentNm[1]-1000)<1e-6,'offset moment about declared reference');
  if(new URLSearchParams(location.search).has('review'))window.__spjutsimOffsetReviewApp=beamApp;
  var originalOffset=beamApp.document.loads[0];beamApp.replaceLoad(offsetId,Object.assign({},originalOffset,{referencePointM:[0,.125,.25]}));var shiftedResult=await solveBeam();
  var difference=0;for(var n=0;n<offsetResult.displacementM.length;n++)difference=Math.max(difference,Math.abs(offsetResult.displacementM[n]-shiftedResult.displacementM[n]));
  check(difference<1e-8*offsetResult.extrema.maxDisplacement.valueM,'reference-point edit changed the offset physical wrench');
  beamApp.replaceLoad(offsetId,{type:'total-force',forceN:[0,0,-1000],faceIds:[tip]});beamApp.replaceSelectedFaces([tip]);beamApp.createLoad({type:'moment',momentNm:[0,1000,0],referencePointM:[4,.125,.25]});var equivalent=await solveBeam();
  difference=0;for(var n=0;n<offsetResult.displacementM.length;n++)difference=Math.max(difference,Math.abs(offsetResult.displacementM[n]-equivalent.displacementM[n]));
  check(difference<1e-8*offsetResult.extrema.maxDisplacement.valueM,'offset load differs from equivalent force/couple');
  records.push({case:'offset-cantilever',elementType:'tet10',nodeCount:beamApp.document.mesh.statistics.nodeCount,displacementM:offsetResult.extrema.maxDisplacement.valueM,referenceDisplacementM:referenceTip,relativeError:Math.abs(offsetResult.extrema.maxDisplacement.valueM/referenceTip-1),equivalentMaximumDifferenceM:difference,equilibrium:offsetResult.equilibrium});
  // Restore the actual offset case for the review packet.
  if(new URLSearchParams(location.search).has('review')){beamApp.removeLoad(beamApp.document.loads[1].id);beamApp.replaceLoad(offsetId,originalOffset);}
  window.__spjutsimUsabilityEvidence={cases:records};status.textContent='Passed moment load workflow';
 }catch(e){status.textContent='Failed: '+e.message;throw e;}finally{mesher.dispose();}
}());
