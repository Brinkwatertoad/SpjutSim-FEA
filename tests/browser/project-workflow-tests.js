(async function(){
  var api=SpjutsimFEA;function assert(v,m){if(!v)throw Error(m);}
  try{
    assert(typeof api.ProjectWorkflow==='function','Transactional project workflow is missing');
    var app=new api.AppController({document:api.createAnalysisDocument()});
    app.replaceGeometry(api.assignmentTestGeometry('saved'),{sourceName:'cube.step',sourceFormat:'step',sourceBytes:new Uint8Array([1,2,3]).buffer});
    var project=await api.createProjectSnapshot(app), blob=await api.writeProjectFile(project),pending=[];
    var flow=new api.ProjectWorkflow(app,{createMesher:function(){return {importGeometry:function(request){return new Promise(resolve=>pending.push(()=>resolve(api.assignmentTestGeometry(request.geometryId))))},dispose:function(){},cancel:function(){}};}});
    var before=app.document;var opening=flow.open(blob);while(!pending.length){await new Promise(r=>setTimeout(r,1));}flow.cancel();pending.shift()();await opening;
    assert(app.document===before,'Cancelled open replaced the live document');
    opening=flow.open(blob);while(!pending.length){await new Promise(r=>setTimeout(r,1));}app.replaceMaterial({youngsModulusPa:20e9,poissonsRatio:0.3});pending.shift()();var failed=false;try{await opening}catch(e){failed=true}
    assert(failed && app.document===before && app.document.material.youngsModulusPa===20e9,'Late open overwrote new edits');
    opening=flow.open(blob);while(!pending.length){await new Promise(r=>setTimeout(r,1));}pending.shift()();await opening;
    assert(app.document!==before && app.document.material===null && !app.projectDirty,'Valid open did not atomically install saved project');
    var disposed=false, loaded=false;
    var staged=new api.ProjectWorkflow(app,{createMesher:function(){return {importGeometry:async function(request){return api.assignmentTestGeometry(request.geometryId);},dispose:function(){disposed=true;},cancel:function(){}};}});
    var stagedProject=await api.readProjectFile(blob);stagedProject.loadDerived=async function(){assert(disposed,'Cache allocation overlapped the mesher worker');loaded=true;};
    await staged.open(stagedProject);assert(loaded,'Deferred cache was never loaded');
    document.getElementById('test-status').textContent='Passed';
  }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;console.error(e);}
}());
