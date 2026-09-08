(function (root) {
  'use strict';
  function engineeringBusy(state) {
    return Boolean((state.geometryImport && state.geometryImport.status === 'importing') ||
      (state.meshGeneration && state.meshGeneration.status === 'generating') ||
      (state.solvePreflight && state.solvePreflight.status === 'running') ||
      (state.solveExecution && state.solveExecution.status === 'running') ||
      (state.convergenceStudy && state.convergenceStudy.status === 'running'));
  }
  function solveReadiness(state) {
    var check = state.solvePreflight || {}, execution = state.solveExecution || {};
    var busy = engineeringBusy(state), draft = Boolean(state.assignmentDraft);
    var current = check.status === 'ready' && check.result && check.analysisRevision === state.analysisRevision;
    var ready = Boolean(state.mesh && current && !check.result.exceedsWasmCap && !busy && !draft && ['succeeded','failed','cancelled'].indexOf(execution.status) < 0);
    var label = execution.status === 'running' ? 'Solving' : (check.status === 'running' ? 'Checking' : (ready ? 'Ready to solve' : 'Check required'));
    var message = draft ? 'Apply or Cancel the assignment preview before checking or solving.' :
      (busy ? 'Wait for the current operation or cancel it.' :
      (!state.mesh ? 'Finish Setup and generate a mesh, then Check model.' :
      (current && check.result.exceedsWasmCap ? 'Generate a coarser mesh to fit the WebAssembly memory cap.' :
      (ready ? 'Review Checks, then select Solve.' : 'Run Check model for the current setup before solving.'))));
    return {canCheck:!busy && !draft,canSolve:ready,label:label,message:message};
  }
  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.engineeringBusy = engineeringBusy;
  root.SpjutsimFEA.solveReadiness = solveReadiness;
}(globalThis));
