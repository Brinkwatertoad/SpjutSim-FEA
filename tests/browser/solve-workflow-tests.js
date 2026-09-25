(async function () {
  'use strict';
  function assert(value, message) { if (!value) { throw new Error(message); } }
  function deferred() { var resolve, reject; var promise = new Promise(function (yes, no) { resolve = yes; reject = no; }); return {promise:promise,resolve:resolve,reject:reject}; }
  function noop() {}
  function inert() { return new Proxy({}, {get:function () { return noop; }}); }
  try {
    // Run the shipped application orchestration with controlled worker completion.
    // Numerical contracts and worker implementations have their own harnesses.
    var source = await (await fetch('../../web/js/app.js')).text();
    function fixture(withMesh) {
      var state = {geometry:{},meshSettings:{},meshGeneration:{status:'idle'},analysisRevision:1,mesh:withMesh === false ? null : {},solveSettings:{},solvePreflight:{status:'idle'},solveExecution:{status:'idle'}};
      var handlers, subscriber = noop, clients = [], meshers = [], solves = 0, confirmations = 0, confirmResult = true;
      var app = {
        document:state, geometrySource:{sourceBytes:new ArrayBuffer(1)}, discardSolvePreflight:noop,cancelAssignmentDraft:function(){state.assignmentDraft=null;},
        beginMeshGeneration:function(){state.meshGeneration.status='generating';},reportMeshProgress:noop,
        completeMeshGeneration:function(mesh){state.mesh=mesh;state.analysisRevision++;state.meshGeneration.status='succeeded';},
        failMeshGeneration:function(error){state.meshGeneration={status:'failed',error:error};}, subscribe:function (fn) { subscriber = fn; }, cancelConvergenceStudy:noop,
        beginSolvePreflight:function () { state.solvePreflight = {status:'running'}; state.solveExecution = {status:'idle'}; return state.analysisRevision; },
        completeSolvePreflight:function (revision,result) {
          if (revision !== state.analysisRevision || state.solvePreflight.status !== 'running') { return false; }
          state.solvePreflight = {status:'ready',result:result,analysisRevision:revision}; return true;
        },
        failSolvePreflight:function (revision,error) { state.solvePreflight = {status:'failed',error:error}; },
        beginSolve:function () {
          assert(state.solvePreflight.status === 'ready' && !state.solvePreflight.result.exceedsWasmCap, 'Invalid preflight reached solve');
          state.solveExecution = {status:'running'}; return state.analysisRevision;
        },
        completeSolve:function () { state.solveExecution = {status:'succeeded'}; },
        failSolve:function (revision,error) { state.solveExecution = {status:'failed',error:error}; },
        cancelSolve:function () { state.solvePreflight = {status:'cancelled'}; state.solveExecution = {status:'cancelled'}; }
      };
      var fakeRoot = {requestAnimationFrame:requestAnimationFrame.bind(window),navigator:{},addEventListener:noop,confirm:function () { confirmations++; return confirmResult; },SpjutsimFEA:{
        hasPendingAssignment:SpjutsimFEA.hasPendingAssignment,bindFaceAccess:noop,bindContextualWorkflow:noop,bindProjectUI:noop,bindUnitSettings:noop,bindReportExport:noop,FEAColorSchemes:inert,createAnalysisDocument:noop,AppController:function () { return app; },
        UIController:function () { return new Proxy({setSolveHandlers:function (preflight,solve,cancel) { handlers = {preflight:preflight,solve:solve,cancel:cancel}; }}, {get:function (target,key) { return target[key] || noop; }}); },
        ViewportController:inert,ReplacementMigrationUI:inert,prepareSolverInput:function () { return {}; },
        MesherClient:function(){var work=deferred(), client=this;this.generateMesh=function(){return work.promise;};this.cancel=function(){client.cancelled=true;};this.dispose=function(){client.disposed=true;};meshers.push({client:client,work:work});},
        SolverClient:function () {
          var work = deferred(); var done = deferred(); var client = this;
          this.preflight = function () { return work.promise; };
          this.solve = function () { solves++; return done.promise; };
          this.dispose = function () { client.disposed = true; };
          clients.push({client:client,preflight:work,result:done});
        },
        startLocalWorker:function(){return Promise.resolve({terminate:noop});},
        exerciseMesherRuntime:function () { return Promise.resolve({diagnostics:{},smoke:{}}); },
        exerciseWorker:function () { return Promise.resolve({result:{}}); }
      }};
      new Function('globalThis','document',source)(fakeRoot,{documentElement:{},getElementById:function () { return {addEventListener:noop}; }});
      return {handlers:handlers,state:state,clients:clients,meshers:meshers,solves:function () { return solves; },confirmations:function () { return confirmations; },
        deny:function () { confirmResult = false; }, edit:function () { state.analysisRevision++; state.solvePreflight = {status:'idle'}; subscriber(state); }};
    }
    async function flush() { await Promise.resolve(); await Promise.resolve(); }
    var ready = {exceedsWasmCap:false,requiresEightGiBConfirmation:false};
    var test = fixture();
    assert(test.clients.length === 0, 'Startup automatically checked the model');
    test.state.assignmentDraft={immediate:true,dirty:false};
    test.handlers.solve();
    assert(!test.state.assignmentDraft,'Solve retained clean editor');
    assert(test.clients.length === 1 && test.solves() === 0, 'Solve did not check first');
    test.handlers.solve();assert(test.clients.length===1,'Repeated Solve replaced checking worker');
    test.clients[0].preflight.resolve(ready);await flush();assert(test.solves()===1,'Successful check did not continue to solve');
    test.clients[0].result.resolve({});await flush();test.handlers.solve();assert(test.clients.length===2,'New Solve did not recheck after disposal');
    for (var outcome of ['failure','cap','cancel','edit','confirmation']) {
      test = fixture(); if (outcome === 'confirmation') { test.deny(); } test.handlers.solve();
      if (outcome === 'cancel') { test.handlers.cancel(); }
      if (outcome === 'edit') { test.edit(); }
      if (outcome === 'failure') { test.clients[0].preflight.reject(new Error('Underconstrained')); }
      else { test.clients[0].preflight.resolve({exceedsWasmCap:outcome === 'cap',requiresEightGiBConfirmation:outcome === 'confirmation'}); }
      await flush();
      assert(test.solves() === 0, outcome + ' check permitted solve');
      if (outcome === 'confirmation') { assert(test.confirmations() === 1, 'High-memory confirmation was bypassed'); }
    }
    test = fixture(); test.state.assignmentDraft = {dirty:true}; test.handlers.preflight(); test.handlers.solve();
    assert(test.clients.length === 0, 'Dirty draft reached worker preflight');
    test = fixture(); test.handlers.solve(); test.handlers.cancel(); test.handlers.solve();
    test.clients[0].preflight.resolve(ready); await flush();
    assert(test.solves() === 0 && !test.clients[1].client.disposed, 'Old worker completion took over new request');
    test.clients[1].preflight.resolve(ready); await flush();
    assert(test.solves() === 1, 'Replacement check could not continue to solve');
    for(var action of ['success','cancel','edit','failure']){
      test=fixture(false);var requested=test.handlers.solve();assert(test.meshers.length===1 && test.clients.length===0,'Mesh and solve did not start with meshing');
      if(action==='cancel')test.handlers.cancel();if(action==='edit')test.edit();
      if(action==='failure')test.meshers[0].work.reject(Error('Meshing failed'));else test.meshers[0].work.resolve({generated:true});
      await requested;await flush();assert(test.meshers[0].client.disposed,'Mesher retained after combined operation');
      assert(test.clients.length===(action==='success'?1:0),action+' meshing continued incorrectly');
      if(action==='success'){test.clients[0].preflight.resolve(ready);await flush();assert(test.solves()===1,'Combined action did not solve after checks');}
    }
    document.getElementById('test-status').textContent = 'Passed';
  } catch (error) { document.getElementById('test-status').textContent = 'Failed: ' + error.message; console.error(error); }
}());
