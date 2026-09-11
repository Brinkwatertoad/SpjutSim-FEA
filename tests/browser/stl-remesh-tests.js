(function () {
  'use strict';
  var status = document.getElementById('test-status');
  function assert(value, message) { if (!value) { throw new Error(message); } }
  document.getElementById('application-frame').addEventListener('load', async function () {
    var win = this.contentWindow, api = win.SpjutsimFEA, client, evidence = [];
    var options = { version: 2, lengthUnit: 'm', patchAngleDegrees: 40,
      normalization: 'none', surfaceMode: 'remesh', reconstructionToleranceM: null, remeshFeatureAngleDegrees: 5 };
    async function run(name, bytes, angle) {
      var source = new win.Uint8Array(new Uint8Array(bytes)).buffer;
      var settings = Object.assign({}, options, { patchAngleDegrees: angle || 40 });
      client = new api.MesherClient();
      var geometry = await client.importGeometry({ sourceName: name, sourceFormat: 'stl', sourceBytes: source, importOptions: settings });
      client.dispose();
      assert(api.validateGeometryModel(geometry).valid, 'Remeshed geometry contract rejected');
      assert(geometry.sourceMetadata.reconstruction === null && !geometry.originalPreview,
        'Parametrization was misreported as smooth CAD recovery');
      var report = geometry.sourceMetadata.remeshing;
      assert(report && report.version === 1 && report.surfaceCountsByPatch.length === geometry.faceIds.length,
        'Source ownership report is missing');
      client = new api.MesherClient();
      var mesh = await client.generateMesh({ geometry: geometry, sourceBytes: source, settings: { preset: 'coarse', elementType: 'tet10' } });
      client.dispose();
      assert(mesh.boundaryFaces.faceRanges.map(function (r) { return r.faceId; }).join() === geometry.faceIds.join(),
        'Fresh-worker remeshing changed selection ownership');
      assert(mesh.quality.invertedElementCount === 0 && mesh.quality.nearZeroJacobianCount === 0, 'Invalid remeshed elements accepted');
      evidence.push({ name: name, groups: geometry.faceIds.length, remeshing: report, statistics: mesh.statistics, quality: mesh.quality });
      return { geometry: geometry, mesh: mesh, source: source };
    }
    try {
      assert(api.validateStlOptions(options), 'Experimental remeshing options are unavailable');
      assert(!api.validateStlOptions(Object.assign({}, options, { reconstructionToleranceM: .01 })), 'Remeshing advertised a CAD deviation bound');
      assert(!api.sameStlOptions(options, Object.assign({}, options, { surfaceMode: 'original' })), 'Remeshing reused original-mode identity');
      assert(!api.sameStlOptions(options, Object.assign({}, options, { remeshFeatureAngleDegrees: 40 })), 'Feature angle did not invalidate identity');
      for (var angle of [0, 41, NaN, Infinity, undefined]) {
        assert(!api.validateStlOptions(Object.assign({}, options, { remeshFeatureAngleDegrees: angle })), 'Invalid remesh feature angle accepted');
      }
      var cube = await run('dense-cube.stl', StlTestShapes.subdividedCube(16));
      assert(cube.mesh.statistics.boundaryElementCount < cube.geometry.sourceMetadata.triangleCount / 2,
        'Remeshing retained the dense input triangulation');
      assert(Math.abs(cube.geometry.volumeM3 - 1) < 1e-10, 'Parametrization changed source geometry volume');
      var areas = cube.mesh.quality.stlBoundaryAreas;
      assert(areas && areas.version === 1 && areas.sourceM2.length === 6 && areas.meshM2.every(function (area) { return Math.abs(area - 1) < 1e-10; }),
        'Remeshing did not report source/mesh boundary area fidelity');
      // A right triangle shortened from unit base to 0.9 has 10% less area,
      // hence 10% less resultant under a fixed pressure. This is independent
      // of Gmsh's choice of triangulation on a particular curved fixture.
      var areaCheck = StlRemesh.boundaryDiagnostics([.5], new Float64Array([0,0,0, .9,0,0, 0,1,0]), {
        solverConnectivity: new Uint32Array([0,1,2]), solverFaceRanges: [{ start: 0, count: 3 }]
      }, 3);
      assert(Math.abs(areaCheck.areas.meshM2[0] - .45) < 1e-12 && areaCheck.warning.includes('boundary area') && areaCheck.warning.includes('10.0%'),
        'Distorted boundary areas did not warn about pressure/load fidelity');
      var invalidQuality = Object.assign({}, cube.mesh, { quality: Object.assign({}, cube.mesh.quality, {
        stlBoundaryAreas: { version: 1, sourceM2: [1], meshM2: [1] }
      }) });
      assert(!api.validateVolumeMeshResult(invalidQuality, cube.geometry.faceIds).valid, 'Invalid boundary area report passed mesh validation');
      for (var invalidArea of [0, NaN, Infinity]) {
        var invalidAreas = new Array(6).fill(1); invalidAreas[0] = invalidArea;
        invalidQuality.quality.stlBoundaryAreas = { version: 1, sourceM2: invalidAreas, meshM2: new Array(6).fill(1) };
        assert(!api.validateVolumeMeshResult(invalidQuality, cube.geometry.faceIds).valid, 'Nonpositive or nonfinite source area accepted');
      }
      invalidQuality.quality.stlBoundaryAreas.sourceM2 = new Array(6);
      assert(!api.validateVolumeMeshResult(invalidQuality, cube.geometry.faceIds).valid, 'Sparse boundary area array accepted');
      var sparseCounts = new Array(cube.geometry.faceIds.length); sparseCounts[0] = cube.geometry.sourceMetadata.internalSurfaceCount;
      assert(!api.validateGeometryModel(Object.assign({}, cube.geometry, { sourceMetadata: Object.assign({}, cube.geometry.sourceMetadata, {
        remeshing: Object.assign({}, cube.geometry.sourceMetadata.remeshing, { surfaceCountsByPatch: sparseCounts })
      }) })).valid, 'Sparse ownership report accepted');
      var grouped = await run('grouped-cube.stl', StlTestShapes.subdividedCube(4), 100);
      assert(grouped.geometry.faceIds.length === 1 && grouped.geometry.sourceMetadata.internalSurfaceCount >= 6,
        'A selection group could not own multiple geometric surfaces');
      client = new api.MesherClient();
      var changed = await client.importGeometry({ sourceName: 'grouped-cube.stl', sourceFormat: 'stl', sourceBytes: grouped.source,
        importOptions: Object.assign({}, grouped.geometry.importOptions, { remeshFeatureAngleDegrees: 40 }) });
      client.dispose();
      assert(changed.faceIds.join() !== grouped.geometry.faceIds.join(), 'Feature angle reused source assignment identities');
      var mismatch;
      client = new api.MesherClient();
      try { await client.generateMesh({ geometry: Object.assign({}, changed, { faceIds: grouped.geometry.faceIds, preview: grouped.geometry.preview }),
        sourceBytes: grouped.source, settings: { preset: 'coarse', elementType: 'tet10' } }); }
      catch (failure) { mismatch = failure.diagnostic; }
      finally { client.dispose(); }
      assert(mismatch && mismatch.code === 'STL_PATCH_MAPPING_FAILED', 'Fresh worker accepted assignments from a different feature angle');
      var tube = await run('square-tube.stl', StlTestShapes.squareTube());
      assert(Math.abs(tube.geometry.volumeM3 - 3) < 1e-10, 'Remeshing lost the through-hole');
      var bad = Object.assign({}, grouped.geometry, { sourceMetadata: Object.assign({}, grouped.geometry.sourceMetadata,
        { remeshing: Object.assign({}, grouped.geometry.sourceMetadata.remeshing, { surfaceCountsByPatch: [1] }) }) });
      assert(!api.validateGeometryModel(bad).valid, 'Inconsistent remeshing ownership passed validation');
      bad = Object.assign({}, grouped.geometry, { sourceMetadata: Object.assign({}, grouped.geometry.sourceMetadata, { remeshing: null }) });
      assert(!api.validateGeometryModel(bad).valid, 'Missing remeshing report passed validation');
      var cancelled = false, error;
      client = new api.MesherClient({ onProgress: function (item) {
        if (item.stage === 'stl-remesh') { cancelled = true; client.cancel(); }
      } });
      try { await client.importGeometry({ sourceName: 'dense-cube.stl', sourceFormat: 'stl', sourceBytes: cube.source, importOptions: options }); }
      catch (failure) { error = failure.diagnostic; }
      assert(cancelled && error && error.code === 'IMPORT_CANCELLED', 'Experimental remeshing could not be cancelled');
      window.__stlSurfaceEvidence = { cases: evidence, cancellationVerified: true };
      status.textContent = 'Passed'; status.dataset.result = 'passed';
    } catch (error) { status.textContent = error.message; status.dataset.result = 'failed'; }
    finally { if (client) { client.dispose(); } }
  });
}());
