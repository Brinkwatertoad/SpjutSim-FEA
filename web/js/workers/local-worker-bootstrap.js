(function (root) {
  'use strict';
  var source = "self.onmessage=function(event){var m=event.data;self.postMessage({protocol:1,type:'ready',requestId:m.requestId,worker:m.worker});};";
  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.startProbeWorker = function (kind) {
    var url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    var worker = new Worker(url);
    URL.revokeObjectURL(url);
    return new Promise(function (resolve, reject) {
      worker.onmessage = function (event) { worker.terminate(); resolve(event.data); };
      worker.onerror = function (event) { worker.terminate(); reject(new Error(event.message || 'Worker failed')); };
      worker.postMessage({ protocol: 1, type: 'probe', requestId: kind + '-probe', worker: kind });
    });
  };
}(globalThis));
