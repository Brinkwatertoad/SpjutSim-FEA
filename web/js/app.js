(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var colorSchemes = new api.FEAColorSchemes((function () { try { return root.localStorage; } catch (error) { return null; } }()), document.documentElement);
  colorSchemes.bindControls();
  var app = new api.AppController({ document: api.createAnalysisDocument() });
  var ui = new api.UIController(app);
  var viewport = new api.ViewportController(document.getElementById('viewport'));
  var replacementMigrationUI = new api.ReplacementMigrationUI();
  ui.setViewportController(viewport);
  var wasmBytes = new Uint8Array([0,97,115,109,1,0,0,0]);
  var activeImport = null;
  var activeMesh = null;
  var activeSolver = null;
  var activeSolverRevision = null;
  var activeConvergence = null;
  var displayedGeometry = null;
  var displayedMesh = null;
  var displayedResults = null;

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

  function importCadFile(file) {
    var client;
    var geometryId;
    var replacing = Boolean(app.document.geometry);
    var sourceFormat = api.sourceFormatForFilename(file.name);
    cancelConvergence();
    if (replacementMigrationUI.draft) { replacementMigrationUI.cancel(); }
    if (activeImport) { activeImport.cancel(); }
    if (!replacing) {
      if (activeMesh) { activeMesh.cancel(); }
      disposeSolver();
      app.discardSolvePreflight();
    }
    if (!sourceFormat) {
      app.beginGeometryImport(file.name);
      app.failGeometryImport(importFailure('INVALID_CAD_EXTENSION', 'Choose a STEP, IGES, or OpenCASCADE BREP file.'));
      return;
    }
    app.beginGeometryImport(file.name);
    geometryId = api.createGeometryId();
    client = new api.MesherClient({
      onProgress: function (progress) { app.reportGeometryImportProgress(progress); },
      onError: function () {}
    });
    activeImport = client;
    file.arrayBuffer().then(function (sourceBytes) {
      return client.importGeometry({
        geometryId: geometryId,
        sourceName: file.name,
        sourceFormat: sourceFormat,
        sourceBytes: sourceBytes
      }).then(function (geometry) {
        var source = { sourceName: file.name, sourceFormat: sourceFormat, sourceBytes: sourceBytes };
        if (app.document.geometry) {
          var draft = api.createReplacementMigrationDraft(app.document, geometry, source);
          app.restoreGeometryImportStatus();
          replacementMigrationUI.open(draft, function (replacementGeometry, replacementSource, transfer) {
            if (activeMesh) { activeMesh.cancel(); activeMesh = null; }
            disposeSolver();
            app.replaceGeometryWithSetup(replacementGeometry, replacementSource, transfer);
          });
        } else {
          app.replaceGeometry(geometry, source);
        }
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
    if (!app.document.geometry || !app.geometrySource) { return; }
    cancelConvergence();
    if (activeMesh) { activeMesh.cancel(); }
    disposeSolver();
    app.discardSolvePreflight();
    app.beginMeshGeneration();
    client = new api.MesherClient({ onProgress: function (progress) { app.reportMeshProgress(progress); } });
    activeMesh = client;
    client.generateMesh({
      geometry: app.document.geometry, settings: app.document.meshSettings, sourceBytes: app.geometrySource.sourceBytes
    }).then(function (mesh) {
      if (activeMesh === client) { app.completeMeshGeneration(mesh); }
    }).catch(function (error) {
      if (activeMesh === client) { app.failMeshGeneration(error); }
    }).finally(function () {
      client.dispose();
      if (activeMesh === client) { activeMesh = null; }
    });
  }

  function disposeSolver() {
    if (activeSolver) { activeSolver.dispose(); }
    activeSolver = null;
    activeSolverRevision = null;
  }

  function prepareSolve() {
    var input;
    var revision;
    cancelConvergence();
    disposeSolver();
    try {
      input = api.prepareSolverInput(app.document);
      revision = app.beginSolvePreflight();
    } catch (error) {
      revision = app.document.analysisRevision;
      app.failSolvePreflight(revision, error);
      return;
    }
    if (activeMesh) { activeMesh.cancel(); activeMesh = null; }
    activeSolver = new api.SolverClient({ onProgress: function (progress) { app.reportSolveProgress(progress); } });
    activeSolverRevision = revision;
    activeSolver.preflight(input, revision, root.navigator && root.navigator.deviceMemory).then(function (result) {
      if (activeSolverRevision === revision && !app.completeSolvePreflight(revision, result)) { disposeSolver(); }
    }).catch(function (error) {
      if (activeSolverRevision === revision) { app.failSolvePreflight(revision, error); disposeSolver(); }
    });
  }

  function solve() {
    var preflight = app.document.solvePreflight;
    var confirmed = true;
    var revision;
    if (!activeSolver || preflight.status !== 'ready') { return; }
    if (preflight.result.requiresEightGiBConfirmation) {
      confirmed = root.confirm('This solve is estimated at or above 8 GiB. Browser, OS, or WebAssembly limits may terminate it even when the device has more memory. Continue?');
    }
    if (!confirmed) { return; }
    try { revision = app.beginSolve(); } catch (error) { return; }
    activeSolver.solve(revision, app.document.solveSettings, confirmed).then(function (result) {
      if (activeSolverRevision === revision) { app.completeSolve(revision, result); disposeSolver(); }
    }).catch(function (error) {
      if (activeSolverRevision === revision) { app.failSolve(revision, error); disposeSolver(); }
    });
  }

  function cancelSolve() {
    disposeSolver();
    app.cancelSolve();
  }

  function cancelConvergence() {
    if (activeConvergence) { activeConvergence.cancel(); activeConvergence = null; }
    app.cancelConvergenceStudy();
  }

  function startConvergence() {
    var revision;
    var resolved;
    var diagonal;
    if (activeImport || activeMesh) { return; }
    if (activeConvergence) { activeConvergence.cancel(); }
    disposeSolver();
    try {
      revision = app.beginConvergenceStudy();
      resolved = api.resolveMeshSettings(app.document.meshSettings, app.document.geometry.boundingBoxM);
      diagonal = Math.hypot(
        app.document.geometry.boundingBoxM.maxM[0] - app.document.geometry.boundingBoxM.minM[0],
        app.document.geometry.boundingBoxM.maxM[1] - app.document.geometry.boundingBoxM.minM[1],
        app.document.geometry.boundingBoxM.maxM[2] - app.document.geometry.boundingBoxM.minM[2]);
    } catch (error) { return; }
    var runner = new api.ConvergenceRunner({
      prepareLevel: async function (targetSizeM, index, control) {
        var mesher = new api.MesherClient({ onProgress: function (progress) {
          app.reportConvergenceProgress(revision, { level: index + 1, stage: progress.stage || 'meshing', targetSizeM: targetSizeM });
        } });
        var solver = null;
        control.cancelCurrent = function () { mesher.cancel(); if (solver) { solver.cancel(); } };
        try {
          var mesh = await mesher.generateMesh({ geometry: app.document.geometry,
            settings: { preset: 'custom', elementType: app.document.meshSettings.elementType,
              minSizeM: targetSizeM / 4, maxSizeM: targetSizeM },
            sourceBytes: app.geometrySource.sourceBytes });
          mesher.dispose();
          solver = new api.SolverClient({ onProgress: function (progress) {
            app.reportConvergenceProgress(revision, { level: index + 1, stage: progress.stage, targetSizeM: targetSizeM });
          } });
          control.cancelCurrent = function () { solver.cancel(); };
          var input = api.prepareSolverInput(Object.assign({}, app.document, { mesh: mesh,
            meshMetadata: { statistics: mesh.statistics, quality: mesh.quality, memoryInputs: mesh.memoryInputs } }));
          var preflight = await solver.preflight(input, revision, root.navigator && root.navigator.deviceMemory);
          return { mesh: mesh, preflight: preflight, material: app.document.material,
            solve: function () { return solver.solve(revision, app.document.solveSettings, true); },
            dispose: function () { solver.dispose(); } };
        } catch (error) {
          mesher.dispose(); if (solver) { solver.dispose(); } throw error;
        }
      },
      onProgress: function (progress) { app.reportConvergenceProgress(revision, progress); },
      onLevel: function (summary, result) {
        if (!app.completeConvergenceLevel(revision, summary, result)) { runner.cancel(); }
      },
      onComplete: function (classification, error) {
        app.completeConvergenceStudy(revision, classification, error);
        if (activeConvergence === runner) { activeConvergence = null; }
      },
      confirmHighMemory: function (preflight, level) {
        return root.confirm('Convergence level ' + level + ' is estimated at or above 8 GiB. Continue this level?');
      }
    });
    activeConvergence = runner;
    runner.start(resolved.maxSizeM, undefined, diagonal);
  }

  function setText(id, value) { document.getElementById(id).textContent = value; }
  setText('launch-mode', location.protocol === 'file:' ? 'Direct local file' : (root.crossOriginIsolated ? 'HTTP, isolated' : 'HTTP, portable'));
  root.addEventListener('pagehide', function () { if (activeMesh) { activeMesh.cancel(); } if (activeConvergence) { activeConvergence.cancel(); } disposeSolver(); replacementMigrationUI.dispose(); ui.dispose(); viewport.dispose(); }, { once: true });
  viewport.setFacePickHandler(function (faceId, additive) {
    if (!faceId) {
      app.clearSelectedFaces();
    } else if (additive) {
      app.toggleSelectedFace(faceId);
    } else {
      app.replaceSelectedFaces([faceId]);
    }
  });
  app.subscribe(function (documentState) {
    if (activeSolver && activeSolverRevision !== documentState.analysisRevision) { disposeSolver(); }
    if (activeConvergence && (!documentState.convergenceStudy ||
        documentState.convergenceStudy.analysisRevision !== documentState.analysisRevision)) {
      activeConvergence.cancel(); activeConvergence = null;
    }
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
    if (documentState.results !== displayedResults) {
      displayedResults = documentState.results;
      viewport.setResultModel(displayedResults);
    }
    viewport.setPresentation(documentState.viewportPresentation || { mode: 'model', displayStyle: 'lines' });
    viewport.setSelectedFaceIds(documentState.selectedFaceIds || []);
    viewport.setAnalysisOverlay(documentState);
  });
  ui.setImportHandler(importCadFile);
  ui.setMeshHandlers(generateMesh, function () { if (activeMesh) { activeMesh.cancel(); } }, function () {
    disposeSolver();
    app.clearMesh();
  });
  ui.setSolveHandlers(prepareSolve, solve, cancelSolve);
  ui.setConvergenceHandlers(startConvergence, cancelConvergence);
  viewport.setProbeHandler(function (probe) { ui.renderProbe(probe); });
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
    setText('wasm-status', 'FEM API ' + checks[1].result.apiVersion + '; ' + Math.round(checks[1].result.wasmMemoryBytes / 1048576) + ' MiB initial memory');
    setText('app-status', 'Local runtime ready');
  }).catch(function (error) {
    setText('app-status', 'Compatibility check failed');
    setText('worker-status', error.diagnostic ? error.diagnostic.code : error.message);
  });
}(globalThis));
