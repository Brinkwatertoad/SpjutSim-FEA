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

  Promise.all([
    api.exerciseWorker('mesher'),
    api.exerciseWorker('solver'),
    WebAssembly.instantiate(wasmBytes)
  ]).then(function () {
    setText('worker-status', 'Mesher and solver worker shells responded');
    setText('wasm-status', 'Embedded module ready');
    setText('app-status', 'Framework ready');
  }).catch(function (error) {
    setText('app-status', 'Compatibility check failed');
    setText('worker-status', error.diagnostic ? error.diagnostic.code : error.message);
  });
}(globalThis));
