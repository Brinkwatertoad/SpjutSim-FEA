(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var app = new api.AppController({ document: api.createAnalysisDocument() });
  var ui = new api.UIController(app);
  var viewport = new api.ViewportController(document.getElementById('viewport'));
  var wasmBytes = new Uint8Array([0,97,115,109,1,0,0,0]);

  function setText(id, value) { document.getElementById(id).textContent = value; }
  setText('launch-mode', location.protocol === 'file:' ? 'Direct local file' : (root.crossOriginIsolated ? 'HTTP, isolated' : 'HTTP, portable'));
  root.addEventListener('pagehide', function () { viewport.dispose(); }, { once: true });
  ui.start();

  var repeatedMesherCheck = api.exerciseMesherRuntime().then(function (firstResult) {
    return api.exerciseMesherRuntime().then(function () { return firstResult; });
  });
  Promise.all([
    repeatedMesherCheck,
    api.exerciseWorker('solver'),
    WebAssembly.instantiate(wasmBytes)
  ]).then(function (checks) {
    var mesher = checks[0];
    setText('worker-status', 'Gmsh ' + mesher.diagnostics.gmshVersion + '; box ' + mesher.smoke.volume + ' m³ / ' + mesher.smoke.surfaceCount + ' faces');
    setText('wasm-status', 'Embedded module ready');
    setText('app-status', 'Local runtime ready');
  }).catch(function (error) {
    setText('app-status', 'Compatibility check failed');
    setText('worker-status', error.diagnostic ? error.diagnostic.code : error.message);
  });
}(globalThis));
