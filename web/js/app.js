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
  viewport.probePositionHandler=function(point){ui.positionProbe(point);};
  var wasmBytes = new Uint8Array([0,97,115,109,1,0,0,0]);
  var activeImport = null;
  var importGeneration = 0;
  var activeMesh = null;
  var meshSolveGeneration = 0;
  var activeSolver = null;
  var activeSolverRevision = null;
  var activeConvergence = null;
  var displayedGeometry = null;
  var displayedMesh = null;
  var displayedResults = null;
  var overlayFrame = null;

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

  function importCadFile(file, options) {
    if (app.projectOpening) { return; }
    var client;
    var geometryId;
    var replacing = Boolean(app.document.geometry);
    var sourceFormat = api.sourceFormatForFilename(file.name);
    var generation = ++importGeneration;
    cancelConvergence();
    if (replacementMigrationUI.draft) { replacementMigrationUI.cancel(); }
    if (activeImport) { activeImport.cancel(); activeImport = null; }
    if (!replacing) {
      if (activeMesh) { activeMesh.cancel(); }
      disposeSolver();
      app.discardSolvePreflight();
    }
    if (!sourceFormat) {
      app.beginGeometryImport(file.name);
      app.failGeometryImport(importFailure('INVALID_CAD_EXTENSION', 'Choose a STEP, IGES, or BREP file.'));
      return;
    }
    app.beginGeometryImport(file.name);
    geometryId = api.createGeometryId();
    client = new api.MesherClient({
      onProgress: function (progress) { if (activeImport === client) { app.reportGeometryImportProgress(progress); } },
      onError: function () {}
    });
    activeImport = client;
    return file.arrayBuffer().then(function (sourceBytes) {
      if (activeImport !== client || generation !== importGeneration) { return; }
      return client.importGeometry({
        geometryId: geometryId,
        sourceName: file.name,
        sourceFormat: sourceFormat,
        sourceBytes: sourceBytes
      }).then(function (geometry) {
        if (activeImport !== client || generation !== importGeneration) { return; }
        var source = { sourceName: file.name, sourceFormat: sourceFormat, sourceBytes: sourceBytes };
        installImportedGeometry(geometry, source);
        if (options && options.example && app.document.geometry === geometry) {
          if (options.example === 'cantilever') { api.applyCantileverExample(app); }
          else { api.applyCubeExample(app); }
        }
      });
    }).catch(function (error) {
      if (activeImport === client) { app.failGeometryImport(error); }
    }).finally(function () {
      client.dispose();
      if (activeImport === client) { activeImport = null; }
    });
  }

  function installImportedGeometry(geometry, source) {
    if (api.projectFaceEvidence) { source.faceEvidence = api.projectFaceEvidence(geometry); }
    if (app.document.geometry && (app.document.boundaryConditions.length || app.document.loads.length)) {
      var draft = api.createReplacementMigrationDraft(app.document, geometry, source);
      app.restoreGeometryImportStatus();
      replacementMigrationUI.open(draft, function (replacementGeometry, replacementSource, transfer) {
        if (activeMesh) { activeMesh.cancel(); activeMesh = null; }
        disposeSolver();
        app.replaceGeometryWithSetup(replacementGeometry, replacementSource, transfer);
      });
    } else {
      if (activeMesh) { activeMesh.cancel(); activeMesh = null; }
      disposeSolver();
      app.replaceGeometry(geometry, source);
    }
  }
  function generateMesh() {
    if (app.projectOpening || api.hasPendingAssignment(app.document)) { return; }
    app.cancelAssignmentDraft();
    var client;
    var revision = app.document.analysisRevision;
    if (!app.document.geometry || !app.geometrySource) { return; }
    cancelConvergence();
    if (activeMesh) { activeMesh.cancel(); }
    disposeSolver();
    app.discardSolvePreflight();
    app.beginMeshGeneration();
    client = new api.MesherClient({ onProgress: function (progress) { if (activeMesh === client) { app.reportMeshProgress(progress); } } });
    activeMesh = client;
    return client.generateMesh({
      geometry: app.document.geometry, settings: app.document.meshSettings, sourceBytes: app.geometrySource.sourceBytes
    }).then(function (mesh) {
      if (activeMesh === client) {
        if (app.document.analysisRevision !== revision) { app.failMeshGeneration({message:'Setup changed during meshing. Generate the mesh again.'}); return null; }
        app.completeMeshGeneration(mesh); return mesh;
      }
    }).catch(function (error) {
      if (activeMesh === client) { app.failMeshGeneration(error); }
    }).finally(function () {
      client.dispose();
      if (activeMesh === client) { activeMesh = null; }
    });
  }

  async function meshAndSolve() {
    if (app.document.mesh) { solve(); return; }
    if (activeMesh || activeImport || activeConvergence || api.hasPendingAssignment(app.document)) { return; }
    var generation = ++meshSolveGeneration;
    var mesh = await generateMesh();
    if (generation === meshSolveGeneration && mesh && app.document.mesh === mesh) { prepareSolve(true); }
  }

  function disposeSolver() {
    if (activeSolver) { activeSolver.dispose(); }
    activeSolver = null;
    activeSolverRevision = null;
  }

  function prepareSolve(continueToSolve) {
    if (app.projectOpening) { return; }
    if (api.hasPendingAssignment(app.document) || app.document.solvePreflight.status === 'running' || app.document.solveExecution.status === 'running' ||
        activeImport || activeMesh || activeConvergence) { return; }
    app.cancelAssignmentDraft();
    ui.showOutputPanel("checks");
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
    var client = activeSolver;
    client.preflight(input, revision, root.navigator && root.navigator.deviceMemory).then(function (result) {
      if (activeSolver !== client) { return; }
      if (!app.completeSolvePreflight(revision, result)) { disposeSolver(); return; }
      if(continueToSolve === true && !result.exceedsWasmCap)solve();
    }).catch(function (error) {
      if (activeSolver === client) { app.failSolvePreflight(revision, error); disposeSolver(); }
    });
  }

  function solve() {
    if (app.projectOpening) { return; }
    var preflight = app.document.solvePreflight;
    var confirmed = true;
    var revision;
    if (activeImport || activeMesh || preflight.status === 'running' || app.document.solveExecution.status === 'running' ||
        (app.document.convergenceStudy && app.document.convergenceStudy.status === 'running')) { return; }
    if (preflight.status === 'ready' && preflight.result.exceedsWasmCap) { return; }
    if (api.hasPendingAssignment(app.document)) { return; }
    app.cancelAssignmentDraft();
    if (!activeSolver || preflight.status !== 'ready' || preflight.analysisRevision !== app.document.analysisRevision) { prepareSolve(true); return; }
    if (preflight.result.requiresEightGiBConfirmation) {
      confirmed = root.confirm('This solve is estimated at or above 8 GiB. Browser, OS, or WebAssembly limits may terminate it even when the device has more memory. Continue?');
    }
    if (!confirmed) { return; }
    try { revision = app.beginSolve(); } catch (error) { return; }
    ui.showOutputPanel("results");
    var client = activeSolver;
    client.solve(revision, app.document.solveSettings, confirmed).then(function (result) {
      if (activeSolver === client) {
        var completed = app.completeSolve(revision, result);
        disposeSolver();
        if (completed && ui.autoMeshCheck && app.document.results && app.document.analysisRevision === revision) { startConvergence('quick'); }
      }
    }).catch(function (error) {
      if (activeSolver === client) { app.failSolve(revision, error); disposeSolver(); }
    });
  }

  function cancelSolve() {
    meshSolveGeneration++;
    if (activeMesh) { activeMesh.cancel(); activeMesh=null; app.failMeshGeneration({message:'Meshing cancelled.'}); }
    disposeSolver();
    app.cancelSolve();
  }

  function cancelConvergence() {
    if (activeConvergence) { activeConvergence.cancel(); activeConvergence = null; }
    app.cancelConvergenceStudy();
  }

  function startConvergence(mode) {
    if (app.projectOpening) { return; }
    var revision;
    var resolved;
    var diagonal;
    if (activeImport || activeMesh || activeConvergence || api.engineeringBusy(app.document) || api.hasPendingAssignment(app.document)) { return; }
    var baseline = mode === 'quick' ? api.currentConvergenceBaseline(app.document) : null;
    if (mode === 'quick' && !baseline) { return; }
    var settings = api.createConvergenceSettings(mode === 'quick' ? {maxLevels:2} : undefined);
    app.cancelAssignmentDraft();
    disposeSolver();
    try {
      revision = app.beginConvergenceStudy(settings);
      if (baseline) { app.completeConvergenceLevel(revision, baseline, app.document.results); }
      resolved = api.resolveMeshSettings(app.document.meshSettings, app.document.geometry.boundingBoxM);
      diagonal = Math.hypot(
        app.document.geometry.boundingBoxM.maxM[0] - app.document.geometry.boundingBoxM.minM[0],
        app.document.geometry.boundingBoxM.maxM[1] - app.document.geometry.boundingBoxM.minM[1],
        app.document.geometry.boundingBoxM.maxM[2] - app.document.geometry.boundingBoxM.minM[2]);
    } catch (error) { return; }
    function reportProgress(progress) {
      if (activeConvergence === runner) { app.reportConvergenceProgress(revision, progress); }
    }
    var runner = new api.ConvergenceRunner({
      prepareLevel: async function (targetSizeM, index, control) {
        var mesher = new api.MesherClient({ onProgress: function (progress) {
          reportProgress({ level: index + 1, stage: progress.stage || 'meshing', targetSizeM: targetSizeM });
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
            reportProgress({ level: index + 1, stage: progress.stage, userMessage: progress.userMessage, targetSizeM: targetSizeM });
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
      onProgress: reportProgress,
      onLevel: function (summary, result) {
        if (activeConvergence !== runner || !app.completeConvergenceLevel(revision, summary, result)) { runner.cancel(); }
      },
      onComplete: function (classification, error) {
        if (activeConvergence !== runner) { return; }
        app.completeConvergenceStudy(revision, classification, error);
        activeConvergence = null;
      },
      confirmHighMemory: function (preflight, level) {
        return root.confirm('Convergence level ' + level + ' is estimated at or above 8 GiB. Continue this level?');
      }
    });
    activeConvergence = runner;
    runner.start(baseline ? baseline.targetSizeM : resolved.maxSizeM, settings, diagonal, baseline);
  }

  function setText(id, value) { document.getElementById(id).textContent = value; }
  setText('launch-mode', location.protocol === 'file:' ? 'Direct local file' : (root.crossOriginIsolated ? 'HTTP, isolated' : 'HTTP, portable'));
  root.addEventListener('pagehide', function () { if (activeImport) { activeImport.cancel(); } if (activeMesh) { activeMesh.cancel(); } if (activeConvergence) { activeConvergence.cancel(); } disposeSolver(); replacementMigrationUI.dispose(); ui.dispose(); viewport.dispose(); }, { once: true });
  viewport.setFacePickHandler(function (faceId, additive) {
    if (api.engineeringBusy(app.document)) { return; }
    if (app.document.assignmentDraft) {
      if (faceId) { app.toggleDraftFace(faceId); }
    } else if (!faceId) {
      app.clearSelectedFaces();
    } else if (additive) {
      app.toggleSelectedFace(faceId);
    } else {
      app.replaceSelectedFaces([faceId]);
    }
  });
  app.subscribe(function (documentState, change) {
    if (change === 'solve-progress' || change === 'convergence-progress') { return; }
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
    viewport.setSelectedFaceIds(documentState.assignmentDraft && documentState.assignmentDraft.baseAnalysisRevision === documentState.analysisRevision ? documentState.assignmentDraft.faceIds.filter(function (id) { return documentState.geometry.faceIds.indexOf(id) >= 0; }) : documentState.selectedFaceIds || []);
    if (overlayFrame === null) { overlayFrame = root.requestAnimationFrame(function () { overlayFrame = null; viewport.setAnalysisOverlay(app.document); }); }
    var indicator = document.getElementById('assignment-preview-indicator');
    indicator.hidden = !documentState.assignmentDraft;
    viewport.assignmentDraftActive = Boolean(documentState.assignmentDraft && documentState.assignmentDraft.kind !== 'gravity');
    if (indicator && documentState.assignmentDraft) { indicator.textContent = documentState.assignmentDraft.kind === 'gravity' ? 'Editing gravity' : 'Click faces to toggle assignment'; }
  });
  ui.setImportHandler(importCadFile);
  ui.setMeshHandlers(generateMesh, function () { meshSolveGeneration++; if (activeMesh) { activeMesh.cancel(); activeMesh=null; app.failMeshGeneration({message:'Meshing cancelled.'}); } }, function () {
    disposeSolver();
    app.clearMesh();
  });
  ui.setSolveHandlers(prepareSolve, meshAndSolve, cancelSolve);
  ui.setConvergenceHandlers(startConvergence, cancelConvergence, function () { startConvergence('quick'); });
  viewport.setProbeHandler(function (probe) { ui.renderProbe(probe); });
  ui.start();
  api.bindUnitSettings(app, ui);
  api.bindContextualWorkflow(app, ui, function(file, options){
    return options && options.example ? projectUI.openExample(file, options) : importCadFile(file, options);
  });
  api.bindFaceAccess(app, viewport);
  api.bindReportExport(app, viewport, ui);
  var projectUI = api.bindProjectUI(app, { importCad: importCadFile, beforeStage: function () { disposeSolver(); app.discardSolvePreflight(); }, beforeInstall: function () {
    importGeneration++; if (activeImport) { activeImport.cancel(); activeImport=null; }
    if (activeMesh) { activeMesh.cancel(); activeMesh=null; }
    cancelConvergence(); disposeSolver(); if (replacementMigrationUI.draft) { replacementMigrationUI.cancel(); }
  } });

  // Startup verifies WebAssembly support. Gmsh/FEM start only for an
  // operation that needs them; their full smoke checks live in runtime tests.
  Promise.all([WebAssembly.instantiate(wasmBytes), projectUI && projectUI.ready]).then(function () {
    setText('worker-status', 'Analysis workers start when needed');
    setText('wasm-status', 'WebAssembly available; analysis engines load when needed');
    ui.runtimeStatus='Local runtime ready';ui.renderActivity(app.document);
  }).catch(function (error) {
    ui.runtimeStatus='Compatibility check failed';ui.renderActivity(app.document);
    setText('worker-status', error.diagnostic ? error.diagnostic.code : error.message);
  });
}(globalThis));
