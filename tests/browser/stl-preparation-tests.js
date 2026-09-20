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
    status.textContent = 'Passed'; status.dataset.result = 'passed';
  } catch (e) { status.textContent = 'Failed: ' + e.message; status.dataset.result = 'failed'; }
}());
