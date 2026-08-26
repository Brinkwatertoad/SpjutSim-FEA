(function (root) {
  'use strict';

  function createAnalysisDocument() {
    return {
      schemaVersion: 1,
      geometry: null,
      selectedFaceIds: [],
      geometryImport: { status: 'idle', sourceName: null, error: null },
      material: null,
      boundaryConditions: [],
      loads: [],
      gravity: { enabled: false, accelerationMS2: [0, 0, -9.80665] },
      meshSettings: { preset: 'normal', elementType: 'tet4' },
      meshGeneration: { status: 'idle', error: null, progress: null },
      mesh: null,
      meshMetadata: null,
      viewportPresentation: {
        mode: 'model', displayStyle: 'lines', field: 'vonMises', meshOverlay: false,
        deformationMode: 'undeformed', deformationScale: 0, userDeformationScale: 1
      },
      solveSettings: { relativeTolerance: 1e-8, equilibriumTolerance: 1e-6, maxIterations: 0 },
      solvePreflight: { status: 'idle', result: null, error: null, progress: null, analysisRevision: null },
      solveExecution: { status: 'idle', error: null, progress: null, analysisRevision: null },
      results: null,
      convergenceStudy: null,
      analysisRevision: 0,
      resultInvalidation: null
    };
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.createAnalysisDocument = createAnalysisDocument;
}(globalThis));
