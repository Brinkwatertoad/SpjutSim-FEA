(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');
  var mode=new URLSearchParams(location.search).get('surfaceMode');
  var importOptions=mode?{version:2,lengthUnit:'m',patchAngleDegrees:40,normalization:'none',surfaceMode:mode,reconstructionToleranceM:mode==='reconstruct'?.02:null}:{version:1,lengthUnit:'m',patchAngleDegrees:40,normalization:'none'};
  var controller = new api.AppController({ document: api.createAnalysisDocument() });
  var mesher = new api.MesherClient();
  var solver;
  var sourceBytes;
  var solvedMesh;
  function assert(condition, message) { if (!condition) { throw new Error(message); } }
  function near(actual, expected, relative, absolute) {
    return Math.abs(actual - expected) <= Math.max(absolute || 0, relative * Math.max(Math.abs(actual), Math.abs(expected)));
  }
  function faceCenter(mesh, faceId) {
    var range = mesh.geometryFaceMap[faceId];
    var indices = mesh.boundaryFaces.triangleConnectivity;
    var sum = [0, 0, 0];
    var count = 0;
    var offset;
    var axis;
    for (offset = range.start; offset < range.start + range.count; offset += 1) {
      for (axis = 0; axis < 3; axis += 1) { sum[axis] += mesh.nodePositionsM[indices[offset] * 3 + axis]; }
      count += 1;
    }
    return sum.map(function (value) { return value / count; });
  }
  function axisFace(mesh, axis, maximum) {
    return mesh.boundaryFaces.faceRanges.map(function (range) {
      return { faceId: range.faceId, coordinate: faceCenter(mesh, range.faceId)[axis] };
    }).sort(function (a, b) { return maximum ? b.coordinate - a.coordinate : a.coordinate - b.coordinate; })[0].faceId;
  }
  function addPrescribed(faceId, component) {
    var definition = { name: component.toUpperCase() + ' symmetry', type: 'support', componentsM: {} };
    definition.componentsM[component.slice(1)] = 0;
    controller.replaceSelectedFaces([faceId]);
    controller.createBoundaryCondition(definition);
  }
  function tet10RecoveryLocation(mesh, elementIndex, sampleIndex) {
    var a = 0.5854101966249685;
    var b = 0.1381966011250105;
    var barycentric = [b, b, b, b];
    barycentric[sampleIndex % 4] = a;
    var edges = [[0, 1], [1, 2], [2, 0], [0, 3], [2, 3], [3, 1]];
    var shape = barycentric.map(function (value) { return value * (2 * value - 1); });
    edges.forEach(function (edge) { shape.push(4 * barycentric[edge[0]] * barycentric[edge[1]]); });
    var location = [0, 0, 0];
    for (var localNode = 0; localNode < 10; localNode += 1) {
      var node = mesh.elementConnectivity[elementIndex * 10 + localNode];
      for (var axis = 0; axis < 3; axis += 1) { location[axis] += shape[localNode] * mesh.nodePositionsM[node * 3 + axis]; }
    }
    return location;
  }

  fetch('../fixtures/stl/cube-binary.stl').then(function (response) { return response.arrayBuffer(); }).then(function (bytes) {
    sourceBytes = bytes;
    controller.beginGeometryImport('stl/cube-binary.stl');
    return mesher.importGeometry({ geometryId: 'cube-wasm-slice', sourceName: 'cube-binary.stl', sourceFormat: 'stl', importOptions:importOptions, sourceBytes: bytes });
  }).then(async function (geometry) {
    var altered=sourceBytes.slice(0);new Uint8Array(altered)[0]^=1;
    var mismatch=new api.MesherClient(), diagnostic;
    try {await mismatch.generateMesh({geometry:geometry,sourceBytes:altered,settings:{preset:'coarse',elementType:'tet10'}});}
    catch(error){diagnostic=error.diagnostic;}
    finally {mismatch.dispose();}
    assert(diagnostic && diagnostic.code==='STL_PATCH_MAPPING_FAILED' && diagnostic.stage==='mesh','Changed source bytes were silently remeshed under old patch IDs');
    assert(!api.validateGeometryModel(Object.assign({},geometry,{preview:null})).valid,'Missing STL preview escaped contract validation');
    assert(!api.validateGeometryModel(Object.assign({},geometry,{sourceMetadata:Object.assign({},geometry.sourceMetadata,{internalSurfaceCount:513})})).valid,'Out-of-bound STL metadata escaped validation');
    controller.replaceGeometry(geometry, { sourceName: geometry.sourceName, sourceFormat: geometry.sourceFormat, importOptions:geometry.importOptions, sourceBytes: sourceBytes });
    controller.replaceMaterial({ name: 'Patch material', youngsModulusPa: 1e9, poissonsRatio: 0.25, densityKgM3: 1000, tensileYieldPa: 250e6 });
    controller.beginMeshGeneration();
    return mesher.generateMesh({ geometry: geometry, settings: { preset: 'coarse', elementType: 'tet10' }, sourceBytes: sourceBytes });
  }).then(function (mesh) {
    solvedMesh = mesh;
    controller.completeMeshGeneration(mesh);
    mesher.dispose();
    addPrescribed(axisFace(mesh, 0, false), 'ux');
    addPrescribed(axisFace(mesh, 1, false), 'uy');
    addPrescribed(axisFace(mesh, 2, false), 'uz');
    controller.replaceSelectedFaces([axisFace(mesh, 0, true)]);
    controller.createLoad({ name: 'Axial force', type: 'total-force', forceN: [1000, 0, 0] });
    solver = new api.SolverClient();
    var revision = controller.beginSolvePreflight();
    return solver.preflight(api.prepareSolverInput(controller.document), revision, 8).then(function (preflight) {
      root.__spjutsimBenchmark = { preflight: preflight };
      assert(preflight.nodeCount === mesh.statistics.nodeCount && preflight.elementCount === mesh.statistics.elementCount,
        'cube preflight did not use the authored mesh');
      controller.completeSolvePreflight(revision, preflight);
      controller.beginSolve();
      return solver.solve(revision, controller.document.solveSettings, false).then(function (result) { return [revision, result]; });
    });
  }).then(async function (solved) {
    var revision = solved[0];
    var result = solved[1];
    root.__spjutsimBenchmark.result = result;
    var maximumLoadedUx = -Infinity;
    var node;
    for (node = 0; node < result.originalSurface.nodePositionsM.length / 3; node += 1) {
      if (result.originalSurface.nodePositionsM[node * 3] > 1 - 1e-7) {
        maximumLoadedUx = Math.max(maximumLoadedUx, result.displacementM[node * 3]);
      }
    }
    assert(near(maximumLoadedUx, 1e-6, 2e-5, 1e-11), 'cube axial displacement missed the analytical target');
    assert(near(result.extrema.rawVonMisesMax.valuePa, 1000, 2e-4, 1e-3), 'cube axial stress missed the analytical target');
    assert(result.elementType === 'tet10' && result.recoverySampleFields.vonMisesPa.length === result.meshStatistics.elementCount * 4,
      'Tet10 recovery samples were not returned end to end');
    var expectedPeakLocation = tet10RecoveryLocation(solvedMesh, result.extrema.rawVonMisesMax.elementIndex,
      result.extrema.rawVonMisesMax.sampleIndex);
    assert(result.extrema.rawVonMisesMax.locationM.every(function (value, axis) {
      return near(value, expectedPeakLocation[axis], 1e-10, 1e-12);
    }), 'Tet10 raw peak location did not identify its recovery quadrature point');
    assert(new Set(result.originalSurface.triangleElementIndices).size > 1,
      'subdivided Tri6 display faces lost their owning Tet10 elements');
    assert(near(result.equilibrium.totalReactionN[0], -1000, 1e-7, 1e-5) && result.equilibrium.relativeResidual < 1e-6,
      'cube reaction equilibrium failed');
    controller.completeSolve(revision, result);
    var trustedResult = controller.document.results;
    assert(trustedResult.factorOfSafety && near(trustedResult.factorOfSafety.rawMinimum.value, 250000, 2e-4, 1),
      'Tet10 factor of safety missed the analytical target');
    ['model', 'mesh', 'stress', 'deformation'].forEach(function (mode) {
      controller.replaceViewportPresentation(Object.assign({}, controller.document.viewportPresentation, {
        mode: mode, field: mode === 'deformation' ? 'displacementMagnitude' : 'vonMises'
      }));
      assert(controller.document.results === trustedResult, mode + ' view changed the solved result');
    });
    controller.beginAssignmentDraft('load', controller.document.loads[0].id);
    controller.updateAssignmentDraft({ definition: { forceN:[2000,0,0] } });
    controller.cancelAssignmentDraft();
    assert(controller.document.results===trustedResult, 'Cancelling an STL assignment preview discarded results');
    var originalGeometry=controller.document.geometry, originalSource=controller.geometrySource;
    var review=controller.beginGeometryReview(originalSource);
    var reviewedOptions={normalization:'none',patchAngleDegrees:40,lengthUnit:'m',version:importOptions.version};
    if(mode){reviewedOptions.surfaceMode=mode;reviewedOptions.reconstructionToleranceM=importOptions.reconstructionToleranceM;}
    var reviewGeneration=controller.setGeometryReviewOptions(reviewedOptions);
    assert(controller.completeGeometryReview(review,reviewGeneration,originalGeometry),'Equivalent options with a different property order were rejected');
    controller.invalidateGeometryReview();
    assert(!controller.completeGeometryReview(review,reviewGeneration,originalGeometry),'Stale preview was installed after options changed');
    controller.cancelGeometryReview();
    assert(controller.document.results===trustedResult && controller.document.geometry===originalGeometry,'Cancelled source review changed engineering state');
    controller.rotateGeometryAroundGlobalAxis('z',90);
    assert(!controller.document.mesh && !controller.document.results, 'STL rotation retained stale analysis');
    var rotated=controller.document.geometry, fresh=new api.MesherClient();
    var rotatedMesh=await fresh.generateMesh({geometry:rotated,settings:{preset:'coarse',elementType:'tet10'},sourceBytes:sourceBytes});fresh.dispose();
    assert(JSON.stringify(rotated.faceIds)===JSON.stringify(originalGeometry.faceIds), 'Rotation changed patch identity');
    assert(rotatedMesh.quality.minimumJacobian>0 && Math.min.apply(null,Array.from(rotatedMesh.nodePositionsM).filter(function(v,i){return i%3===0;})) < -0.99,'Fresh STL reconstruction lost rotation');
    controller.undoEngineeringEdit();
    assert(controller.document.geometry.orientation.operations.length===0 && !controller.document.mesh,'Orientation undo did not restore source orientation/invalidation');
    var cadBytes=await(await fetch('../fixtures/generated-unit-cube-m.step')).arrayBuffer(),cadClient=new api.MesherClient();
    var cad=await cadClient.importGeometry({sourceName:'cube.step',sourceFormat:'step',sourceBytes:cadBytes});cadClient.dispose();
    var cadSource={sourceName:'cube.step',sourceFormat:'step',sourceBytes:cadBytes};
    var draft=api.createReplacementMigrationDraft(controller.document,cad,cadSource);
    assert(controller.document.geometry.sourceFormat==='stl', 'Starting replacement changed the installed geometry');
    draft.items.forEach(function(item,index){if(item.kind==='load')api.dropReplacementMigrationItem(draft,index);else api.mapReplacementMigrationItem(draft,index,[cad.faceIds[index%cad.faceIds.length]]);});
    controller.replaceGeometryWithSetup(draft.newGeometry,draft.newSource,api.buildReplacementMigrationTransfer(draft));
    assert(controller.document.loads.length===0 && controller.document.boundaryConditions.length===3,'STL to CAD transfer lost explicit map/drop decisions');
    draft=api.createReplacementMigrationDraft(controller.document,originalGeometry,originalSource);
    draft.items.forEach(function(item,index){api.mapReplacementMigrationItem(draft,index,[originalGeometry.faceIds[index]]);});
    controller.replaceGeometryWithSetup(draft.newGeometry,draft.newSource,api.buildReplacementMigrationTransfer(draft));
    assert(controller.document.geometry.sourceFormat==='stl' && controller.geometrySource.importOptions.lengthUnit==='m','CAD to STL transfer lost source options');
    assert(!controller.historyState().canUndo,'Replacement retained engineering history');
    root.__stlSolveEvidence={cube:{displacementM:maximumLoadedUx,stressPa:result.extrema.rawVonMisesMax.valuePa,equilibrium:result.equilibrium.relativeResidual},curved:[]};
    var cases=[{segments:16,preset:'coarse'},{segments:32,preset:'coarse'},{segments:64,preset:'coarse'}];
    if(mode==='reconstruct')cases.push({segments:32,preset:'fine'});
    for(var caseDefinition of cases) {
      var segments=caseDefinition.segments;
      var name='cylinder-'+segments+'.stl',bytes=await(await fetch('../fixtures/stl/'+name)).arrayBuffer(),client=new api.MesherClient();
      var geometry=await client.importGeometry({sourceName:name,sourceFormat:'stl',sourceBytes:bytes,importOptions:originalGeometry.importOptions});client.dispose();
      client=new api.MesherClient();var curvedMesh=await client.generateMesh({geometry:geometry,sourceBytes:bytes,settings:{preset:caseDefinition.preset,elementType:'tet10'}});client.dispose();
      var analysis=new api.AppController({document:api.createAnalysisDocument()});
      analysis.replaceGeometry(geometry,{sourceName:name,sourceFormat:'stl',sourceBytes:bytes,importOptions:geometry.importOptions});
      analysis.replaceMaterial({name:'Axial nu=0',youngsModulusPa:1e9,poissonsRatio:0,densityKgM3:1000,tensileYieldPa:250e6});
      analysis.completeMeshGeneration(curvedMesh);
      analysis.replaceSelectedFaces([axisFace(curvedMesh,2,false)]);analysis.createBoundaryCondition({type:'support',componentsM:{x:0,y:0,z:0}});
      analysis.replaceSelectedFaces([axisFace(curvedMesh,2,true)]);analysis.createLoad(segments===32 ? {type:'total-force',direction:'surface-normal',magnitudeN:1000,sense:'pull'} : segments===64 ? {type:'pressure',pressurePa:-1000/geometry.volumeM3} : {type:'total-force',forceN:[0,0,1000]});
      var curvedSolver=new api.SolverClient(),rev=analysis.beginSolvePreflight();
      try {
        var check=await curvedSolver.preflight(api.prepareSolverInput(analysis.document),rev,8);analysis.completeSolvePreflight(rev,check);analysis.beginSolve();
        var solved=await curvedSolver.solve(rev,analysis.document.solveSettings,false),maximum=0;
        for(var node=0;node<solved.displacementM.length/3;node++)maximum=Math.max(maximum,solved.displacementM[node*3+2]);
        var area=geometry.volumeM3,expected=1000/(1e9*area);
        // Section 16.2: curved isoparametric geometry uses 1% axial accuracy.
        // Affine/faceted meshes retain their stronger constant-strain checks.
        assert(near(maximum,expected,mode==='reconstruct'?.01:2e-5,1e-11)&&near(solved.extrema.rawVonMisesMax.valuePa,1000/area,mode==='reconstruct'?.01:2e-4,1e-3),'Cylinder axial solution differs from its analytical geometry: '+JSON.stringify({segments:segments,displacement:maximum,expected:expected,stress:solved.extrema.rawVonMisesMax.valuePa,expectedStress:1000/area}));
        assert(solved.equilibrium.relativeResidual<1e-6 && near(solved.equilibrium.totalReactionN[2],-1000,mode==='reconstruct'?.001:1e-6,1e-5),'Curved STL force integration/equilibrium failed');
        root.__stlSolveEvidence.curved.push({segments:segments,preset:caseDefinition.preset,surfaceMode:mode||'legacy',elementCount:curvedMesh.statistics.elementCount,displacementRelativeError:Math.abs(maximum/expected-1),stressRelativeError:Math.abs(solved.extrema.rawVonMisesMax.valuePa/(1000/area)-1),facetedArea:area,displacementM:maximum,expectedM:expected,sourceAreaDeficit:1-area/(Math.PI/4),equilibrium:solved.equilibrium.relativeResidual});
      } finally {curvedSolver.dispose();}
    }
    if(mode==='reconstruct'){var coarse=root.__stlSolveEvidence.curved[1],fine=root.__stlSolveEvidence.curved[3];assert(fine.elementCount>coarse.elementCount&&fine.displacementRelativeError<coarse.displacementRelativeError&&fine.stressRelativeError<coarse.stressRelativeError,'Recovered cylinder refinement did not reduce analytical error');}
    status.textContent = 'Passed'; status.dataset.result = 'passed'; document.title = 'Cube WASM vertical slice: Passed';
  }).catch(function (error) {
    status.textContent = (error.diagnostic && error.diagnostic.userMessage) || error.message;
    status.dataset.result = 'failed'; document.title = 'Cube WASM vertical slice: Failed'; throw error;
  }).finally(function () { mesher.dispose(); if (solver) { solver.dispose(); } });
}(globalThis));
