(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');
  var table = document.getElementById('results');
  var reportNode = document.getElementById('report');

  function assert(value, message) { if (!value) { throw new Error(message); } }
  function inRange(value, range) { return Number.isFinite(value) && value >= range[0] && value <= range[1]; }
  function readBytes(path) {
    if (root.location.protocol !== 'file:') {
      return fetch(path).then(function (response) { if (!response.ok) { throw new Error('Could not read ' + path); } return response.arrayBuffer(); });
    }
    return new Promise(function (resolve, reject) {
      var request = new XMLHttpRequest(); request.open('GET', path); request.responseType = 'arraybuffer';
      request.onload = function () { if (request.response !== null) { resolve(request.response); } else { reject(new Error('Could not read ' + path)); } };
      request.onerror = function () { reject(new Error('Could not read ' + path)); }; request.send();
    });
  }
  function readJson(path) { return readBytes(path).then(function (bytes) { return JSON.parse(new TextDecoder().decode(bytes)); }); }
  function diagonal(bounds) { return Math.hypot(bounds.maxM[0] - bounds.minM[0], bounds.maxM[1] - bounds.minM[1], bounds.maxM[2] - bounds.minM[2]); }
  function faceIds(mesh) { return Object.keys(mesh.geometryFaceMap).sort(); }
  function sameValues(left, right) { return JSON.stringify(left.slice().sort()) === JSON.stringify(right.slice().sort()); }
  function addRow(row) {
    var tr = document.createElement('tr');
    [row.id, row.outcome, row.detail, row.durationMs.toFixed(1)].forEach(function (value) { var cell = document.createElement('td'); cell.textContent = value; tr.appendChild(cell); });
    table.appendChild(tr);
  }
  function diagnostics() {
    return api.startLocalWorker('mesher').then(function (worker) {
      return new Promise(function (resolve, reject) {
        var requestId = 'corpus-diagnostics';
        worker.onmessage = function (event) {
          if (event.data && event.data.requestId === requestId) { worker.terminate(); event.data.type === 'diagnostics-result' ? resolve(event.data.result) : reject(new Error('Mesher diagnostics failed')); }
        };
        worker.onerror = function (event) { worker.terminate(); reject(new Error(event.message)); };
        worker.postMessage({ protocol: api.WORKER_PROTOCOL_VERSION, type: 'diagnostics', requestId: requestId });
      });
    });
  }
  function clientDiagnostics(client) {
    return new Promise(function (resolve, reject) {
      var worker = client.worker; var requestId = 'corpus-memory-' + Date.now();
      worker.onmessage = function (event) {
        if (event.data && event.data.requestId === requestId) { event.data.type === 'diagnostics-result' ? resolve(event.data.result) : reject(new Error('Mesher diagnostics failed')); }
      };
      worker.onerror = function (event) { reject(new Error(event.message)); };
      worker.postMessage({ protocol: api.WORKER_PROTOCOL_VERSION, type: 'diagnostics', requestId: requestId });
    });
  }
  async function runEntry(entry) {
    var started = performance.now(); var sourceBytes = await readBytes('../../' + entry.path); var client = new api.MesherClient();
    try {
      var geometry = await client.importGeometry({ geometryId: 'corpus-' + entry.id, sourceName: entry.path.split('/').pop(), sourceFormat: entry.format, sourceBytes: sourceBytes });
      if (entry.expected.classification === 'rejected') { throw new Error(entry.id + ' was accepted unexpectedly'); }
      assert(inRange(1, entry.expected.solidCount), entry.id + ' solid count outside range');
      assert(inRange(geometry.faceIds.length, entry.expected.faceCount), entry.id + ' face count outside range');
      assert(inRange(geometry.volumeM3, entry.expected.volumeM3), entry.id + ' volume outside range');
      assert(inRange(diagonal(geometry.boundingBoxM), entry.expected.boundsDiagonalM), entry.id + ' bounds outside range');
      var settings = { preset: entry.mesh.preset, elementType: entry.mesh.elementType, minSizeM: entry.mesh.minSizeM, maxSizeM: entry.mesh.maxSizeM };
      var first = await client.generateMesh({ geometry: geometry, settings: settings, sourceBytes: sourceBytes });
      assert(inRange(first.statistics.nodeCount, entry.mesh.nodeCount), entry.id + ' node count outside range');
      assert(inRange(first.statistics.elementCount, entry.mesh.elementCount), entry.id + ' element count outside range');
      assert(inRange(first.quality.minimum, entry.mesh.gammaMinimum) && inRange(first.quality.p05, entry.mesh.gammaP05), entry.id + ' gamma quality outside range');
      assert(inRange(first.quality.maximumEdgeRatio, entry.mesh.maximumEdgeRatio), entry.id + ' edge ratio outside range');
      assert(first.quality.minimumJacobian > 0 && first.quality.invertedElementCount === 0 && first.quality.nearZeroJacobianCount === 0, entry.id + ' has invalid Jacobians');
      var second = await client.generateMesh({ geometry: geometry, settings: settings, sourceBytes: sourceBytes });
      assert(sameValues(faceIds(first), geometry.faceIds) && sameValues(faceIds(second), geometry.faceIds), entry.id + ' FaceIds changed on remesh');
      var memory = await clientDiagnostics(client);
      return { id: entry.id, outcome: 'accepted', detail: entry.mesh.elementType + ' ' + first.statistics.elementCount + ' elements', durationMs: performance.now() - started,
        geometry: { faceCount: geometry.faceIds.length, volumeM3: geometry.volumeM3, boundsDiagonalM: diagonal(geometry.boundingBoxM) },
        mesherWasmBytes: memory.wasmMemoryBytes,
        mesh: { elementType: first.elementType, nodeCount: first.statistics.nodeCount, elementCount: first.statistics.elementCount,
          gammaMinimum: first.quality.minimum, gammaP05: first.quality.p05, gammaMedian: first.quality.median,
          maximumEdgeRatio: first.quality.maximumEdgeRatio, minimumJacobian: first.quality.minimumJacobian,
          poorElementCount: first.quality.poorElementCount, warning: first.quality.warning } };
    } catch (error) {
      if (entry.expected.classification !== 'rejected') { throw error; }
      var diagnostic = error.diagnostic;
      assert(diagnostic && diagnostic.code === entry.expected.code && diagnostic.stage === entry.expected.stage,
        entry.id + ' expected ' + entry.expected.code + ' but received ' + (diagnostic && diagnostic.code));
      assert(diagnostic.userMessage && !/(gmsh|emscripten)/i.test(diagnostic.userMessage), entry.id + ' exposed raw runtime text');
      return { id: entry.id, outcome: 'rejected', detail: diagnostic.code, durationMs: performance.now() - started,
        diagnostic: { code: diagnostic.code, stage: diagnostic.stage, userMessage: diagnostic.userMessage, recoverable: diagnostic.recoverable } };
    } finally { client.dispose(); sourceBytes = null; }
  }
  async function runAll() {
    var manifest = await readJson('../fixtures/corpus-v1.json'); var runtime = await diagnostics(); var rows = []; var index;
    for (index = 0; index < manifest.entries.length; index += 1) {
      status.textContent = 'Running ' + (index + 1) + '/' + manifest.entries.length + ': ' + manifest.entries[index].id;
      var row = await runEntry(manifest.entries[index]); rows.push(row); addRow(row);
    }
    var peakMesherWasmBytes = Math.max.apply(null, rows.map(function (row) { return row.mesherWasmBytes || 0; }));
    var report = { schemaVersion: 1, corpusId: manifest.corpusId, browser: navigator.userAgent, runtime: runtime,
      peakMesherWasmBytes: peakMesherWasmBytes,
      qualityWarningThresholdGamma: 0.1, entryCount: rows.length, agreementCount: rows.length, entries: rows };
    root.__spjutsimCadCorpusReport = report; reportNode.textContent = JSON.stringify(report, null, 2);
    status.textContent = 'Passed: ' + rows.length + '/' + rows.length; status.dataset.result = 'passed'; document.title = 'CAD corpus tests: Passed';
  }
  runAll().catch(function (error) { status.textContent = error.message; status.dataset.result = 'failed'; document.title = 'CAD corpus tests: Failed'; throw error; });
}(globalThis));
