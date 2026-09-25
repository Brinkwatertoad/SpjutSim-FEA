(async function () {
  'use strict';
  function assert(value, message) { if (!value) { throw new Error(message); } }
  function deferred() { var resolve, reject; var promise = new Promise(function (yes, no) { resolve=yes; reject=no; }); return {promise:promise,resolve:resolve,reject:reject}; }
  function noop() {}
  function inert() { return new Proxy({}, {get:function () { return noop; }}); }
  async function flush() { for (var i=0;i<10;i++) { await Promise.resolve(); } }
  try {
    var source = await (await fetch('../../web/js/app.js')).text();
    var api = window.SpjutsimFEA;
    ['step','stp','iges','igs','brep'].forEach(function (extension) {
      assert(api.sourceFormatForFilename('MODEL.'+extension.toUpperCase()), 'CAD extension rejected: '+extension);
    });
    ['stl','obj','ply'].forEach(function (extension) {
      assert(api.sourceFormatForFilename('model.'+extension)===null, 'Mesh format accepted: '+extension);
      assert(!api.validateImportRequest({sourceName:'model.'+extension,sourceFormat:extension,sourceBytes:new ArrayBuffer(1)}).valid, 'Mesh import request accepted');
    });
    function fixture() {
      var state={geometry:null,boundaryConditions:[],loads:[]}, clients=[], imported=[], failures=[], handler, meshHandler, meshes=[], workerStarts=0, migration=null;
      var controller={document:state,cancelAssignmentDraft:function(){state.assignmentDraft=null;},subscribe:noop,cancelConvergenceStudy:noop,discardSolvePreflight:noop,
        beginGeometryImport:function(name){state.geometryImport={status:'importing',sourceName:name};},
        failGeometryImport:function(error){failures.push(error);state.geometryImport.status='failed';},
        reportGeometryImportProgress:noop,restoreGeometryImportStatus:noop,
        beginMeshGeneration:noop,completeMeshGeneration:function(mesh){meshes.push(mesh);},failMeshGeneration:function(error){failures.push(error);},
        replaceGeometry:function(geometry,canonical){state.geometry=geometry;controller.geometrySource=canonical;imported.push({geometry:geometry,source:canonical});},
        replaceGeometryWithSetup:function(){throw new Error('Unreviewed assignment migration');}};
      var fakeRoot={requestAnimationFrame:requestAnimationFrame.bind(window),navigator:{},addEventListener:noop,SpjutsimFEA:{hasPendingAssignment:api.hasPendingAssignment,
        FEAColorSchemes:inert,AppController:function(){return controller;},createAnalysisDocument:noop,
        UIController:function(){return new Proxy({setImportHandler:function(fn){handler=fn;},setMeshHandlers:function(fn){meshHandler=fn;}},{get:function(target,key){return target[key]||noop;}});},
        ViewportController:inert,ReplacementMigrationUI:function(){return {open:function(draft){migration=draft;}};},
        createReplacementMigrationDraft:function(state,geometry,canonical){return {geometry:geometry,source:canonical};},
        sourceFormatForFilename:api.sourceFormatForFilename,createGeometryId:api.createGeometryId,
        MesherClient:function(){var client=this,work=deferred();client.work=work;client.requests=[];
          client.generateMesh=client.importGeometry=function(request){client.requests.push(request);return work.promise;};
          client.cancel=client.dispose=function(){client.disposed=true;};clients.push(client);},
        bindFaceAccess:noop,bindContextualWorkflow:noop,bindProjectUI:noop,bindUnitSettings:noop,bindReportExport:noop,startLocalWorker:function(){workerStarts++;throw new Error('Eager worker startup');}
      }};
      new Function('globalThis','document',source)(fakeRoot,{documentElement:{},getElementById:function(){return {addEventListener:noop};}});
      return {state:state,clients:clients,imported:imported,failures:failures,importFile:handler,generateMesh:meshHandler,meshes:meshes,
        workerStarts:function(){return workerStarts;},migration:function(){return migration;}};
    }
    function file(name,read){return {name:name,arrayBuffer:function(){return read.promise;}};}
    var test=fixture(),read=deferred();await flush();assert(test.workerStarts()===0,'Startup eagerly loaded an engine');
    test.importFile(file('first.step',read));read.resolve(new ArrayBuffer(2));await flush();
    assert(test.clients[0].requests.length===1,'CAD import did not start directly');
    var geometry={sourceName:'first.step'};test.clients[0].work.resolve(geometry);await flush();
    assert(test.imported.length===1&&test.state.geometry===geometry,'CAD import needed an extra acceptance step');
    assert(test.clients[0].disposed,'Completed import retained its worker');
    test.importFile({name:'unsupported.stl',arrayBuffer:function(){throw new Error('Unsupported input was read');}});
    assert(test.failures[0].diagnostic.code==='INVALID_CAD_EXTENSION'&&test.state.geometry===geometry,'Rejected input changed the installed model');
    test.generateMesh();var mesher=test.clients[1];read=deferred();
    test.importFile(file('replacement.step',read));read.resolve(new ArrayBuffer(1));await flush();
    test.clients[2].work.resolve({sourceName:'replacement.step'});await flush();
    assert(mesher.disposed,'Direct replacement left the previous mesh operation running');
    mesher.work.resolve({obsolete:true});await flush();
    assert(test.meshes.length===0,'Previous mesh replaced the new model mesh');
    // A slow file read must not start work or replace a newer import.
    test=fixture();var first=deferred(),second=deferred();
    test.importFile(file('first.step',first));test.importFile(file('second.iges',second));
    first.resolve(new ArrayBuffer(2));await flush();assert(test.clients[0].requests.length===0,'Superseded read started a worker');
    second.resolve(new ArrayBuffer(3));await flush();test.clients[1].work.resolve({sourceName:'second.iges'});await flush();
    assert(test.imported.length===1&&test.imported[0].source.sourceName==='second.iges','New import did not win');
    // Late completion or failure from an already-running request is ignored.
    for(var outcome of ['resolve','reject']) {
      test=fixture();first=deferred();second=deferred();test.importFile(file('first.step',first));first.resolve(new ArrayBuffer(1));await flush();
      test.importFile(file('second.brep',second));test.clients[0].work[outcome](outcome==='reject'?new Error('Old error'):{sourceName:'first.step'});await flush();
      assert(test.imported.length===0&&test.failures.length===0,'Superseded request affected current import');
      second.resolve(new ArrayBuffer(1));await flush();test.clients[1].work.resolve({sourceName:'second.brep'});await flush();
      assert(test.imported.length===1,'Current import failed after stale completion');
    }
    // Existing assignments still require deliberate face mapping before replacement.
    test=fixture();var old={sourceName:'installed.step'};test.state.geometry=old;test.state.loads=[{id:'load'}];read=deferred();
    test.importFile(file('replacement.step',read));read.resolve(new ArrayBuffer(1));await flush();test.clients[0].work.resolve({sourceName:'replacement.step'});await flush();
    assert(test.migration()&&test.state.geometry===old&&test.imported.length===0,'Replacement bypassed assignment review');
    document.getElementById('test-status').textContent='Passed';
  } catch(error) {document.getElementById('test-status').textContent='Failed: '+error.message;console.error(error);}
}());
