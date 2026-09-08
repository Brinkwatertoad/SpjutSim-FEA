(function () {
  'use strict';
  var api=SpjutsimFEA;
  function assert(ok,message){if(!ok)throw new Error(message);}
  function rejects(action){var threw=false;try{action();}catch(e){threw=true;}assert(threw,'Invalid draft accepted');}
  try {
    var app=new api.AppController({document:api.createAnalysisDocument()});
    app.replaceGeometry(api.assignmentTestGeometry('draft-cube'),{sourceName:'cube.step',sourceFormat:'step',sourceBytes:new ArrayBuffer(1)});
    assert(typeof app.beginAssignmentDraft === 'function', 'Transactional assignment commands are missing');
    app.document.mesh=api.assignmentTestMesh();
    var result={sentinel:true}, check={status:'ready',analysisRevision:app.document.analysisRevision};
    app.document.results=result; app.document.solvePreflight=check;
    app.document.viewportPresentation.mode='stress';
    var revision=app.document.analysisRevision, mesh=app.document.mesh;
    app.beginAssignmentDraft('load',null,{type:'total-force',forceN:[100,0,0]});
    assert(app.document.viewportPresentation.mode === 'mesh','Draft did not enter selectable presentation');
    rejects(function(){app.commitAssignmentDraft();});
    app.toggleDraftFace('face-x+'); app.toggleDraftFace('face-y+'); app.toggleDraftFace('face-y+');
    assert(app.document.assignmentDraft.faceIds.join() === 'face-x+','Plain toggles do not maintain set');
    rejects(function(){app.beginAssignmentDraft('support');});
    assert(app.document.analysisRevision===revision && app.document.results===result && app.document.solvePreflight===check,'Preview invalidated committed state');
    app.cancelAssignmentDraft();
    assert(app.document.viewportPresentation.mode==='stress' && app.document.results===result && app.document.mesh===mesh,'Cancel did not preserve solved presentation');
    app.replaceSelectedFaces(['face-x+']); app.beginAssignmentDraft('load',null,{type:'total-force',forceN:[100,0,0]});
    var id=app.commitAssignmentDraft();
    assert(app.document.loads[0].forceN[0]===100 && app.document.loads[0].id===id && app.document.analysisRevision===revision+1 && !app.document.results && app.document.mesh===mesh,'Apply must commit once and retain mesh');
    revision=app.document.analysisRevision;
    app.beginAssignmentDraft('load',id);app.commitAssignmentDraft();
    assert(app.document.analysisRevision===revision,'Unchanged Save invalidated analysis');
    app.beginAssignmentDraft('load',id);app.updateAssignmentDraft({definition:{type:'pressure',pressurePa:Infinity}});rejects(function(){app.commitAssignmentDraft();});app.cancelAssignmentDraft();
    assert(app.document.loads[0].id===id && app.document.loads[0].forceN[0]===100,'Cancelled edit changed original');
    app.beginAssignmentDraft('load',id);
    app.updateAssignmentDraft({faceIds:['face-x+','face-x+']}); rejects(function(){app.commitAssignmentDraft();});
    app.updateAssignmentDraft({faceIds:['missing']});rejects(function(){app.commitAssignmentDraft();});app.cancelAssignmentDraft();
    app.beginAssignmentDraft('load',id);app.replaceMaterial({youngsModulusPa:200e9,poissonsRatio:0.3});rejects(function(){app.commitAssignmentDraft();});app.cancelAssignmentDraft();
    app.replaceSelectedFaces(['face-x-']);app.createBoundaryCondition({type:'support',componentsM:{x:0}});
    app.beginAssignmentDraft('support',null,{type:'support',componentsM:{x:0.001}});rejects(function(){app.commitAssignmentDraft();});app.cancelAssignmentDraft();
    document.getElementById('test-status').textContent='Passed';
  }catch(error){document.getElementById('test-status').textContent='Failed: '+error.message;}
}());
