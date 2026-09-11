(function (root) {
  'use strict';
  var status = document.getElementById('test-status');
  function assert(value, message) { if (!value) { throw new Error(message); } }
  async function run() {
    assert(root.StlExperiment, 'Experimental STL adapter is unavailable');
    var manifest = await (await fetch('../fixtures/stl/manifest.json')).json();
    var records = [];
    // M28 deliberately excludes the full-validation cases added by M29.
    // Those cases run against the production adapter in stl-import-tests.
    for (var fixture of manifest.filter(function (entry) { return !['self-intersecting.stl','pinched-vertex.stl'].includes(entry.file); })) {
      var bytes = await (await fetch('../fixtures/stl/' + fixture.file)).arrayBuffer();
      var result;
      try { result = root.StlExperiment.parse(bytes, { unit: 'm', angleDegrees: 40 }); }
      catch (error) {
        assert(error.code === fixture.expected, fixture.file + ': unexpected rejection ' + error.code);
        records.push({ file: fixture.file, rejection: error.code }); continue;
      }
      assert(fixture.expected === 'valid', fixture.file + ': invalid input accepted');
      assert(Math.abs(result.volume - fixture.volume) < 1e-7, fixture.file + ': incorrect enclosed volume');
      var scaled = root.StlExperiment.parse(bytes, { unit: 'mm', angleDegrees: 40 });
      assert(Math.abs(scaled.volume / result.volume - 1e-9) < 1e-20, 'Unit scale must cube for volume');
      await root.StlExperiment.identify(result, bytes);
      var repeat = await root.StlExperiment.identify(root.StlExperiment.parse(bytes, { unit:'m', angleDegrees:40 }), bytes);
      assert(JSON.stringify(result.patchIds) === JSON.stringify(repeat.patchIds), 'Reconstruction must preserve patch IDs');
      await root.StlExperiment.identify(scaled, bytes);
      assert(result.patchIds.every(function (id) { return !scaled.patchIds.includes(id); }), 'Unit changes must invalidate assignment identity');
      if (fixture.file.startsWith('cube')) {
        assert(result.patches.length === 6, 'Cube must expose six user patches independent of Gmsh subdivisions');
        assert(root.StlExperiment.parse(bytes, { unit: 'm', angleDegrees: 100 }).patches.length === 1,
          'Grouping threshold must change connected patch membership');
      }
      if (fixture.file.startsWith('cylinder')) {
        assert(result.patches.length === 3, 'Cylinder must expose two caps and a selectable curved side');
        assert(root.StlExperiment.parse(bytes, { unit: 'm', angleDegrees: 1 }).patches.length > 3,
          'Smaller grouping angle must expose individual cylinder facets');
      }
      for (var options of [{ unit: 'auto', angleDegrees: 40 }, { unit: 'm', angleDegrees: NaN }, { unit:'m', angleDegrees:0.5 }]) {
        var code = null;
        try { root.StlExperiment.parse(bytes, options); } catch (error) { code = error.code; }
        assert(code === 'STL_INVALID_OPTIONS', 'Invalid units/grouping must be rejected');
      }
      records.push({ file: fixture.file, volume: result.volume, patches: result.patches.length,
        previewBytes: result.positions.byteLength + result.triangles.byteLength + result.patchByTriangle.byteLength });
    }
    root.__stlFeasibilityRecords = records;
    status.textContent = 'Passed'; status.dataset.result = 'passed';
  }
  run().catch(function (error) { status.textContent = error.message; status.dataset.result = 'failed'; });
}(globalThis));
