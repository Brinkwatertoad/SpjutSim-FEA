(function(){
  'use strict';
  var api=SpjutsimFEA;
  function assert(ok,message){if(!ok)throw new Error(message);}
  function rejects(action){var failed=false;try{action();}catch(error){failed=true;}assert(failed,'Invalid history action accepted');}
  try {
    var app=new api.AppController({document:api.createAnalysisDocument()}), state=app.document;
    app.replaceGeometry(api.assignmentTestGeometry('history-cube'),{sourceName:'cube.step',sourceFormat:'step',sourceBytes:new ArrayBuffer(1)});
    assert(typeof app.undoEngineeringEdit==='function','Engineering history commands are missing');
    app.replaceSelectedFaces(['face-x+']);
    app.beginAssignmentDraft('load',null,{type:'total-force',forceN:[100,0,0]});var id=app.commitAssignmentDraft();
    assert(app.history.entries.length===1,'Apply must record one command');
    app.replaceLoad(id,{type:'total-force',forceN:[200,0,0]});
    state.mesh=api.assignmentTestMesh();var mesh=state.mesh;state.results={old:true};var revision=state.analysisRevision;
    app.undoEngineeringEdit();assert(state.loads[0].forceN[0]===100 && state.mesh===mesh && !state.results && state.analysisRevision===revision+1,'Undo restored stale result or lost usable mesh');
    app.redoEngineeringEdit();assert(state.loads[0].forceN[0]===200,'Redo did not reapply engineering definition');
    app.removeLoad(id);app.undoEngineeringEdit();assert(state.loads[0].id===id,'Undo delete did not restore original ID');
    var result={current:true};state.results=result;revision=state.analysisRevision;
    app.renameAssignment('load',id,'End load');app.undoEngineeringEdit();
    assert(state.loads[0].name==='Load 1' && state.results===result && state.analysisRevision===revision,'Metadata undo invalidated solve');
    app.redoEngineeringEdit();assert(state.loads[0].name==='End load','Metadata redo failed');
    var count=app.history.entries.length;
    app.beginAssignmentDraft('load',id);app.commitAssignmentDraft();assert(app.history.entries.length===count && state.results===result,'No-op draft save recorded history');
    app.undoEngineeringEdit();app.replaceLoad(id,{type:'pressure',pressurePa:5});assert(!app.historyState().canRedo,'New edit retained redo branch');
    app.beginAssignmentDraft('load',id);assert(!app.historyState().canUndo,'History enabled during draft');rejects(function(){app.undoEngineeringEdit();});app.cancelAssignmentDraft();
    state.solveExecution.status='running';assert(!app.historyState().canUndo,'History enabled during worker execution');rejects(function(){app.undoEngineeringEdit();});state.solveExecution.status='idle';
    app.replaceMaterial({youngsModulusPa:200e9,poissonsRatio:0.3});app.replaceMaterial({youngsModulusPa:100e9,poissonsRatio:0.3});app.undoEngineeringEdit();assert(state.material.youngsModulusPa===200e9,'Material undo failed');
    app.replaceMaterial({youngsModulusPa:200e9,poissonsRatio:0.3,densityKgM3:7800});
    app.replaceGravity({enabled:true,accelerationMS2:[0,0,-9]});app.undoEngineeringEdit();assert(!state.gravity.enabled,'Gravity undo failed');app.redoEngineeringEdit();assert(state.gravity.accelerationMS2[2]===-9,'Gravity redo failed');
    var oldPreset=state.meshSettings.preset;app.replaceMeshSettings({preset:'fine',elementType:'tet10'});app.undoEngineeringEdit();assert(state.meshSettings.preset===oldPreset && !state.mesh,'Mesh-setting undo restored mesh buffers or lost settings');
    app.rotateGeometryAroundGlobalAxis('z',90);app.undoEngineeringEdit();assert(!state.mesh && Math.abs(state.geometry.preview.positionsM[3]-1)<1e-12,'Orientation undo failed to restore coordinates or invalidate mesh');
    app.redoEngineeringEdit();assert(Math.abs(state.geometry.preview.positionsM[4]-1)<1e-12,'Orientation redo failed');
    var ui=new api.UIController(app), mac=/Mac|iPhone|iPad/.test(navigator.platform);
    function shortcut(target,shift) { return {key:'z',ctrlKey:!mac,metaKey:mac,shiftKey:Boolean(shift),target:target,preventDefault:function(){this.defaultPrevented=true;}}; }
    var key=shortcut(document.getElementById('native-undo-field'));
    assert(!ui.handleHistoryShortcut(key) && !key.defaultPrevented,'History captured native input undo');
    key=shortcut(document.body);ui.settingsOpen=true;assert(!ui.handleHistoryShortcut(key),'Settings did not retain its shortcut ownership');ui.settingsOpen=false;
    assert(ui.handleHistoryShortcut(key) && key.defaultPrevented,'Available model undo shortcut was not handled');
    assert(ui.handleHistoryShortcut(shortcut(document.body,true)),'Redo shortcut did not reapply command');
    var serialized=JSON.stringify(app.history.entries);assert(!serialized.includes('nodePositionsM') && !serialized.includes('sourceBytes') && !serialized.includes('preview'),'History retains geometry/mesh/result buffers');
    var history=new api.EngineeringHistory();
    for(var i=0;i<60;i++)history.record({kind:'load',before:null,after:{name:String(i)}});
    assert(history.entries.length===50 && history.entries[0].after.name==='10','Entry cap eviction is not deterministic');
    history.clear();for(i=0;i<8;i++)history.record({kind:'load',before:null,after:{name:'x'.repeat(400000)}});
    assert(history.byteLength<=2*1024*1024 && history.entries.length===5,'Serialized byte limit is not enforced');
    rejects(function(){history.record({kind:'load',before:null,after:{buffer:new Float64Array(1)}});});
    app.replaceSelectedFaces(['face-x+']);var nextId=app.createLoad({type:'pressure',pressurePa:2});app.undoEngineeringEdit();
    var undoCursor=app.history.cursor, originalGeometry=state.geometry;
    state.geometry=Object.assign({},state.geometry,{faceIds:['face-x-']});rejects(function(){app.redoEngineeringEdit();});
    assert(app.history.cursor===undoCursor,'Rejected stale FaceId replay changed the history cursor');state.geometry=originalGeometry;
    var newestId=app.createLoad({type:'pressure',pressurePa:3});
    assert(newestId!==nextId && state.loads[state.loads.length-1].name==='Load 3','Undo rewound ID/name allocation');
    app.replaceGeometry(api.assignmentTestGeometry('replacement'),{sourceName:'cube.step',sourceFormat:'step',sourceBytes:new ArrayBuffer(1)});
    assert(!app.historyState().canUndo && !app.historyState().canRedo && app.history.byteLength===0,'Geometry replacement retained incompatible history');
    key=shortcut(document.body);assert(!ui.handleHistoryShortcut(key) && !key.defaultPrevented,'Empty history swallowed browser command');
    document.getElementById('test-status').textContent='Passed';
  }catch(error){document.getElementById('test-status').textContent='Failed: '+error.message;}
}());
