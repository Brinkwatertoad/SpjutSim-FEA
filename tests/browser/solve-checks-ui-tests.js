(function(){
  'use strict';
  function assert(ok,message){if(!ok)throw new Error(message);}
  try {
    var api=SpjutsimFEA, state=api.createAnalysisDocument(), app=new api.AppController({document:state}), ui=new api.UIController(app);
    var solve=document.getElementById('solve-button'), check=document.getElementById('preflight-button');
    var timeLimit=document.getElementById('solve-time-limit');
    app.replaceSolveTimeLimit(120000); ui.renderSolve(state);
    assert(timeLimit.value==='2','Per-analysis time budget was not rendered in minutes');
    var savedRevision=state.analysisRevision,savedMesh=state.mesh;
    app.replaceSolveTimeLimit(1800000);
    assert(state.solveSettings.maxDurationMs===1800000 && state.analysisRevision===savedRevision && state.mesh===savedMesh,
      'Changing a runtime budget changed engineering inputs');
    [0,-1,NaN,Infinity,3600001].forEach(function(value){var rejected=false;try{app.replaceSolveTimeLimit(value);}catch(e){rejected=true;}assert(rejected,'Invalid solve budget was accepted');});
    ui.renderSolve(state); assert(!solve.disabled && !check.disabled,'Incomplete setup cannot be checked for actionable guidance');
    assert(document.querySelectorAll('#checks-findings button').length===4,'Missing setup findings lack editor links');
    state.geometry={};state.material={};state.mesh={};state.boundaryConditions=[{id:'fixed'}];
    state.solvePreflight={status:'ready',analysisRevision:0,result:{exceedsWasmCap:false,estimatedPeakBytes:123456,constraintStability:{status:'fully-constrained'}}};
    state.lastSolveCheck=state.solvePreflight;
    ui.renderSolve(state);assert(!solve.disabled && document.getElementById('solve-readiness').textContent==='Ready to solve','Current check does not enable Solve');
    state.solveExecution.status='cancelled';ui.renderSolve(state);assert(!solve.disabled && !check.disabled,'Cancelled solve offers a disposed worker as ready');state.solveExecution.status='idle';
    state.analysisRevision++;state.solvePreflight={status:'idle'};ui.renderSolve(state);
    assert(!solve.disabled && document.getElementById('checks-revision').textContent.includes('Stale report') && document.getElementById('checks-summary').textContent.includes('Estimated memory'),'Stale report is lost or offered as solve permission');
    state.solvePreflight={status:'failed',error:{userMessage:'Add supports to constrain rigid-body motion.'},analysisRevision:1};state.lastSolveCheck=state.solvePreflight;
    ui.renderSolve(state);assert(!solve.disabled && document.querySelector('#checks-findings button').textContent==='Edit supports','Check failure lacks setup recovery');
    state.solvePreflight={status:'ready',analysisRevision:1,result:{exceedsWasmCap:true}};ui.renderSolve(state);assert(solve.disabled,'Memory cap can be bypassed');
    state.solvePreflight={status:'running'};ui.renderSolve(state);assert(check.disabled && solve.disabled,'Worker check is reentrant');
    assert(timeLimit.disabled,'Running solve budget remains editable');
    var busyRejected=false;try{app.replaceSolveTimeLimit(120000);}catch(e){busyRejected=true;}assert(busyRejected,'Runtime budget changed during a worker operation');
    state.solvePreflight={status:'ready',analysisRevision:1,result:{exceedsWasmCap:false}};state.assignmentDraft={dirty:true};ui.renderSolve(state);
    assert(check.disabled && solve.disabled && document.getElementById('solve-status').textContent.includes('Apply or Cancel'),'Draft has no persistent explanation');
    var rejected=false;try{app.beginSolve();}catch(e){rejected=true;}assert(rejected,'Controller gates can be bypassed with a draft');
    state.assignmentDraft=null;state.solvePreflight.analysisRevision=0;rejected=false;try{app.beginSolve();}catch(e){rejected=true;}assert(rejected,'Controller accepted a stale check');
    document.getElementById('test-status').textContent='Passed';
  }catch(error){document.getElementById('test-status').textContent='Failed: '+error.message;}
}());
