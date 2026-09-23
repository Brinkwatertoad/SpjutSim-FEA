(function(){
  var api=SpjutsimFEA;function assert(v,m){if(!v)throw Error(m);}
  try{
    var app=new api.AppController({document:api.createAnalysisDocument()});app.replaceGeometry(api.assignmentTestGeometry('options'),{sourceName:'cube.step',sourceFormat:'step',sourceBytes:new ArrayBuffer(1)});
    app.replaceMaterial({youngsModulusPa:200e9,poissonsRatio:0.3});app.replaceSelectedFaces(['face-x-']);var support=app.createBoundaryCondition({type:'support',componentsM:{x:0,y:0,z:0}});
    app.replaceSelectedFaces(['face-x+']);var load=app.createLoad({type:'total-force',forceN:[100,0,0]});app.document.mesh=api.assignmentTestMesh();
    assert(typeof app.setAssignmentIncluded==='function','Assignment suppression is missing');
    app.setAssignmentIncluded('load',load,false);assert(api.prepareSolverInput(app.document).loads.length===0 && app.document.loads.length===1,'Suppressed load entered solver or was deleted');
    app.undoEngineeringEdit();assert(api.prepareSolverInput(app.document).loads.length===1,'Undo did not include suppressed load');
    app.setAssignmentIncluded('support',support,false);assert(api.prepareSolverInput(app.document).boundaryConditions.length===0 && app.document.constraintStability.rank===0,'Suppressed support restrained rigid motion');
    app.undoEngineeringEdit();var copied=app.duplicateAssignment('load',load);assert(copied!==load && app.document.loads.length===2 && app.document.loads[1].faceIds[0]==='face-x+','Duplicate lost references or identity');
    app.document.loads[1].forceN[0]=200;assert(app.document.loads[0].forceN[0]===100,'Duplicate shares mutable definition');
    app.undoEngineeringEdit();assert(app.document.loads.length===1,'Duplicate is not one undoable edit');
    assert(!api.validateLoad({id:'x',name:'X',type:'pressure',pressurePa:1,faceIds:['face-x+'],enabled:'no'},app.document.geometry.faceIds).valid,'Malformed enabled state accepted');
    app.setAssignmentIncluded('load',load,false);app.beginAssignmentDraft('load',load);
    app.updateAssignmentDraft({definition:{type:'total-force',forceN:[150,0,0]}});app.commitAssignmentDraft();
    assert(app.document.loads[0].enabled===false,'Editing a suppressed load silently included it');
    app.document.mesh=null;app.document.loads=[];app.document.boundaryConditions[0].componentsM.x=0.001;
    assert(api.solveReadiness(app.document).canRequestSolve,'Prescribed displacement cannot request Mesh and solve');
    document.getElementById('test-status').textContent='Passed';
  }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;console.error(e);}
}());
