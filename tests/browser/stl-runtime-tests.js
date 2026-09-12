(function (root) {
  'use strict';
  var status = document.getElementById('test-status');
  var records = root.__stlRuntimeRecords = [];
  async function run() {
    for (var file of ['cube-ascii.stl', 'cube-binary.stl', 'cylinder-16.stl', 'cylinder-32.stl', 'cylinder-64.stl', 'thin-plate.stl']) {
      for (var order of [1, 2]) {
        var bytes = await (await fetch('../fixtures/stl/' + file)).arrayBuffer();
        var result = await root.StlMesherExperiment.start({ bytes: bytes, options: { unit: 'm', angleDegrees: 40 },
          order: order, preserveFacets: true, size: 0.15 }, function (stage) { status.textContent = file + ': ' + stage; }).promise;
        records.push(Object.assign({ file: file, order: order }, result));
        if (order === 2 && JSON.stringify(result.patchIds) !== JSON.stringify(records[records.length-2].patchIds)) {
          throw new Error(file + ': patch identity changed across fresh workers and mesh order');
        }
        if (new Set(result.internalSurfacePatchIds).size !== result.patches ||
            result.internalSurfacePatchIds.some(function (id) { return !result.patchIds.includes(id); })) {
          throw new Error(file + ': internal surfaces do not preserve all user patch owners');
        }
        if (!(result.quality.minimumJacobian > 0) || result.relativeVolumeError > 1e-7 ||
            (order === 2 && (result.boundaryType !== 'tri6' || result.displayTriangles !== result.boundaryElements*4))) {
          throw new Error(file + ': mesh quality, faceted volume, or boundary contract failed');
        }
      }
    }
    for (var encoding of ['ascii', 'binary']) {
      var imported = await root.StlMesherExperiment.start({ bytes: await (await fetch('../fixtures/stl/cube-' + encoding + '.stl')).arrayBuffer(),
        options: { unit:'m', angleDegrees:40 }, importMethod:'merge', order:2, preserveFacets:true, size:0.15 }).promise;
      if (imported.relativeVolumeError > 1e-7) { throw new Error('Pinned STL file reader failed for ' + encoding); }
      records.push(Object.assign({ file:'cube-' + encoding + '.stl', order:2, readerCharacterization:true }, imported));
    }
    var source = await (await fetch('../fixtures/stl/cylinder-64.stl')).arrayBuffer();
    var task = root.StlMesherExperiment.start({ bytes: source, options: { unit: 'm', angleDegrees: 40 },
      order: 2, preserveFacets: true, size: 0.005 }, function (stage) { if (stage === 'generate') { task.cancel(); } });
    var cancelled = false;
    try { await task.promise; } catch (error) { cancelled = error.code === 'CANCELLED'; }
    if (!cancelled) { throw new Error('Meshing cancellation did not reject with CANCELLED'); }
    records.push({ cancellation: 'passed', stage: 'generate', disposal: 'terminate worker and revoke Blob URL' });
    // A fresh worker must still work after cancellation.
    var recovery = await root.StlMesherExperiment.start({ bytes: await (await fetch('../fixtures/stl/cube-binary.stl')).arrayBuffer(),
      options: { unit: 'm', angleDegrees: 40 }, order: 2, preserveFacets: true, size: 0.15 }).promise;
    if (!(recovery.quality.minimumJacobian > 0)) { throw new Error('Fresh-worker recovery failed'); }
    records.push({ recovery: 'passed', elements: recovery.elements });
    status.textContent = 'Passed'; status.dataset.result = 'passed';
  }
  run().catch(function (error) { status.textContent = error.message; status.dataset.result = 'failed'; });
}(globalThis));
