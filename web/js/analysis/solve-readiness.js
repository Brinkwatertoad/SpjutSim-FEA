(function (root) {
  'use strict';
  function engineeringBusy(state) {
    return Boolean((state.geometryImport && state.geometryImport.status === 'importing') ||
      (state.meshGeneration && state.meshGeneration.status === 'generating') ||
      (state.solvePreflight && state.solvePreflight.status === 'running') ||
      (state.solveExecution && state.solveExecution.status === 'running') ||
      (state.convergenceStudy && state.convergenceStudy.status === 'running'));
  }
  function hasPrescribedDisplacement(state) {
    return state.boundaryConditions.some(function (item) {
      return item.enabled !== false && item.componentsM && ['x','y','z'].some(function (axis) {
        return Number.isFinite(item.componentsM[axis]) && item.componentsM[axis] !== 0;
      });
    });
  }
  function solveReadiness(state) {
    var check = state.solvePreflight || {}, execution = state.solveExecution || {};
    var setupReady = Boolean(state.geometry && state.material && state.boundaryConditions.some(function(item){return item.enabled !== false;}) && (hasPrescribedDisplacement(state) || state.gravity.enabled || state.loads.some(function(item){return item.enabled !== false;})));
    var busy = engineeringBusy(state), draft = root.SpjutsimFEA.hasPendingAssignment(state);
    var current = check.status === 'ready' && check.result && check.analysisRevision === state.analysisRevision;
    var ready = Boolean(state.mesh && current && !check.result.exceedsWasmCap && !busy && !draft && ['succeeded','failed','cancelled'].indexOf(execution.status) < 0);
    var label = execution.status === 'running' ? 'Solving' : (check.status === 'running' ? 'Checking' : (ready ? 'Ready to solve' : 'Ready'));
    var message = draft ? 'Finish the invalid or incomplete edit, or close its editor before solving.' :
      (busy ? 'Wait for the current operation or cancel it.' :
      (!state.mesh ? 'Finish Setup, then choose Mesh and solve. Checks run before solving.' :
      (current && check.result.exceedsWasmCap ? 'Generate a coarser mesh to fit the WebAssembly memory cap.' :
      (ready ? 'Select Solve to continue.' : 'Solve checks the current setup before starting.'))));
    return {canCheck:!busy && !draft,canRequestSolve:!busy && !draft && (Boolean(state.mesh) || setupReady) && !(current && check.result.exceedsWasmCap),canSolve:ready,label:label,message:message};
  }
  function resultInvalidationMessage(state) {
    if (state.results || !state.resultInvalidation || !state.resultInvalidation.stale) { return ''; }
    var labels = {material:'Material changed',loads:'Loads changed','boundary-conditions':'Supports changed',gravity:'Gravity changed',
      'mesh-settings':'Mesh settings changed',mesh:'Mesh changed',geometry:'Model changed',orientation:'Model orientation changed'};
    return (labels[state.resultInvalidation.reason] || 'Setup changed') + '. Previous results cleared. ' +
      (engineeringBusy(state) ? 'Analysis is running.' : state.mesh ? 'Solve again to update results.' : 'Choose Mesh and solve to update results.');
  }
  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.resultInvalidationMessage = resultInvalidationMessage;
  root.SpjutsimFEA.engineeringBusy = engineeringBusy;
  root.SpjutsimFEA.solveReadiness = solveReadiness;
  root.SpjutsimFEA.hasPrescribedDisplacement = hasPrescribedDisplacement;
}(globalThis));
