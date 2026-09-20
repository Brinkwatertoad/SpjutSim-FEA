(async function () {
  'use strict';
  var status = document.getElementById('test-status');
  function assert(value, message) { if (!value) throw new Error(message); }
  async function fixture(name) { return (await fetch('../fixtures/stl/' + name + '.stl')).arrayBuffer(); }
  try {
    assert(typeof StlImport.decode === 'function', 'Readable invalid STL needs a decoder independent of solid acceptance');
    var open = StlImport.decode(await fixture('open'));
    assert(open.triangles.length > 0 && open.positions instanceof Float64Array, 'Open surface was not displayable');
    var cube = StlImport.decode(await fixture('cube-binary'));
    assert(cube.maximum[0] === 1 && cube.minimum[0] === 0, 'Decoder changed source units');
    var report = StlDiagnostics.inspect(open);
    assert(report.issues.some(function (issue) { return issue.kind === 'open-boundary' && issue.edgeVertexIds.length; }), 'Open boundaries have no locations');
    assert(report.coverage.topology === 'failed', 'Open surface was marked valid');
    report = StlDiagnostics.inspect(StlImport.decode(await fixture('self-intersecting')));
    assert(report.issues.some(function (issue) { return issue.kind === 'intersection' && issue.triangleIds.length === 2; }), 'Intersections must locate both triangles');
    report = StlDiagnostics.inspect(open, { maxRecords: 1, maxReferences: 2 });
    assert(report.locationsTruncated && report.issues.length <= 1, 'Diagnostic collection ignored its memory limit');
    var bytes = await fixture('cube-binary'), view = new DataView(bytes); view.setFloat32(96, NaN, true);
    var rejected = false; try { StlImport.decode(bytes); } catch (e) { rejected = e.code === 'STL_NONFINITE'; }
    assert(rejected, 'Nonfinite vertices reached the preview');
    assert(typeof StlRepair.prepare === 'function', 'Cleanup and proposed shape changes need separate preparation results');
    var original = await fixture('inconsistent');
    var prepared = StlRepair.prepare(StlImport.decode(original), { maxHoleDiameterRatio: 0.01 });
    assert(prepared.changes.automatic.some(function (issue) { return issue.kind === 'winding'; }), 'Automatic winding fix was not recorded');
    assert(prepared.changes.proposed.length === 0, 'Winding correction required shape-change consent');
    assert(prepared.sourceBytes instanceof ArrayBuffer, 'Prepared source is missing');
    prepared = StlRepair.prepare(open, { maxHoleDiameterRatio: 0 });
    assert(prepared.error && prepared.sourceBytes instanceof ArrayBuffer, 'Unrepairable input lost its inspectable candidate');
    assert(globalThis.SpjutsimFEA && typeof SpjutsimFEA.StlPreparationClient === 'function', 'Preparation must run in a cancellable worker without Gmsh');
    var events = [], client = new SpjutsimFEA.StlPreparationClient({onEvent: function(event) { events.push(event); }});
    var result = await client.prepare({sessionId:'test',generation:1,sourceName:'cube.stl',geometryId:'test-cube',sourceBytes:await fixture('cube-binary'),lengthUnit:'m',patchAngleDegrees:40,maxHoleDiameterRatio:.01});
    assert(events[0].type === 'stl-preview', 'Solid checks delayed the first preview');
    assert(result.state === 'ready' && result.geometryCandidate.volumeM3 === 1, 'Valid cube did not become ready');
    assert(result.geometryCandidate.faceIds.length === 6, 'Prepared groups are not the six cube faces');
    client.dispose(); events=[];
    client = new SpjutsimFEA.StlPreparationClient({onEvent:function(event){events.push(event);}});
    result=await client.prepare({sessionId:'invalid',generation:1,sourceName:'open.stl',geometryId:'test-open',sourceBytes:await fixture('open'),lengthUnit:'m',patchAngleDegrees:40,maxHoleDiameterRatio:0});
    assert(result.state==='blocked' && result.geometryCandidate===null && events[0].type==='stl-preview','Invalid solid either lost preview or enabled analysis');
    client.dispose();
    client=new SpjutsimFEA.StlPreparationClient({onEvent:function(event){if(event.type==='stl-preview')client.cancel();}});
    var cancelled=false;
    try{await client.prepare({sessionId:'cancel',generation:1,sourceName:'cube.stl',geometryId:'cancel-cube',sourceBytes:await fixture('cube-binary'),lengthUnit:'m',patchAngleDegrees:40,maxHoleDiameterRatio:.01});}catch(e){cancelled=e.diagnostic.code==='STL_PREPARATION_CANCELLED';}
    assert(cancelled && !client.worker, 'Cancellation did not reject and terminate preparation');
    var malformed={revision:'source',positions:new Float64Array([0,0,0]),triangles:new Uint32Array([0,0,99]),bounds:{min:[0,0,0],max:[0,0,0]}};
    assert(!SpjutsimFEA.validateStlPreview(malformed),'Out-of-range diagnostic preview connectivity was accepted');
    status.textContent = 'Passed'; status.dataset.result = 'passed';
  } catch (e) { status.textContent = 'Failed: ' + e.message; status.dataset.result = 'failed'; }
}());
