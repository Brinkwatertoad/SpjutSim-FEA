(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var app = new api.AppController({ document: api.createAnalysisDocument() });
  var ui = new api.UIController(app);
  var viewport = new api.ViewportController(document.getElementById('viewport'));
  ui.setViewportController(viewport);
  var wasmBytes = new Uint8Array([0,97,115,109,1,0,0,0]);
  var activeImport = null;
  var activeMesh = null;
  var displayedGeometry = null;
  var displayedMesh = null;

  function importFailure(code, userMessage, developerMessage) {
    var error = new Error(userMessage);
    error.diagnostic = {
      code: code,
      stage: 'import',
      userMessage: userMessage,
      developerMessage: developerMessage || null,
      recoverable: true
    };
    return error;
  }

  function importStepFile(file) {
    var client;
    var geometryId;
    if (activeImport) { activeImport.cancel(); }
    if (activeMesh) { activeMesh.cancel(); }
    if (!api.isStepFilename(file.name)) {
      app.beginGeometryImport(file.name);
      app.failGeometryImport(importFailure('INVALID_STEP_EXTENSION', 'Choose a file with a .step or .stp extension.'));
      return;
    }
    app.beginGeometryImport(file.name);
    geometryId = api.createGeometryId();
    client = new api.MesherClient({
      onProgress: function (progress) { app.reportGeometryImportProgress(progress); },
      onError: function () {}
    });
    activeImport = client;
    file.arrayBuffer().then(function (stepBytes) {
      return client.importGeometry({
        geometryId: geometryId,
        sourceName: file.name,
        stepBytes: stepBytes
      }).then(function (geometry) {
        app.replaceGeometry(geometry, { sourceName: file.name, stepBytes: stepBytes });
      });
    }).catch(function (error) {
      if (activeImport === client) { app.failGeometryImport(error); }
    }).finally(function () {
      client.dispose();
      if (activeImport === client) { activeImport = null; }
    });
  }

  function generateMesh() {
    var client;
    if (!app.document.geometry || !app.stepSource) { return; }
    if (activeMesh) { activeMesh.cancel(); }
    app.beginMeshGeneration();
    client = new api.MesherClient({ onProgress: function (progress) { app.reportMeshProgress(progress); } });
    activeMesh = client;
    client.generateMesh({
      geometry: app.document.geometry, settings: app.document.meshSettings, stepBytes: app.stepSource.stepBytes
    }).then(function (mesh) {
      if (activeMesh === client) { app.completeMeshGeneration(mesh); }
    }).catch(function (error) {
      if (activeMesh === client) { app.failMeshGeneration(error); }
    }).finally(function () {
      client.dispose();
      if (activeMesh === client) { activeMesh = null; }
    });
  }

  function setText(id, value) { document.getElementById(id).textContent = value; }
  setText('launch-mode', location.protocol === 'file:' ? 'Direct local file' : (root.crossOriginIsolated ? 'HTTP, isolated' : 'HTTP, portable'));
  root.addEventListener('pagehide', function () { if (activeMesh) { activeMesh.cancel(); } viewport.dispose(); }, { once: true });
  viewport.setFacePickHandler(function (faceId, additive) {
    if (additive) {
      app.toggleSelectedFace(faceId);
    } else {
      app.replaceSelectedFaces([faceId]);
    }
  });
  app.subscribe(function (documentState) {
    if (documentState.geometry !== displayedGeometry) {
      displayedGeometry = documentState.geometry;
      if (displayedGeometry) {
        viewport.setGeometryPreview(displayedGeometry);
      } else {
        viewport.clearGeometryPreview();
      }
    }
    if (documentState.mesh !== displayedMesh) {
      displayedMesh = documentState.mesh;
      viewport.setMeshDisplay(displayedMesh);
    }
    viewport.setPresentation(documentState.viewportPresentation || { mode: 'model', displayStyle: 'lines' });
    viewport.setSelectedFaceIds(documentState.selectedFaceIds || []);
    viewport.setAnalysisOverlay(documentState);
  });
  ui.setImportHandler(importStepFile);
  ui.setMeshHandlers(generateMesh, function () { if (activeMesh) { activeMesh.cancel(); } });
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
