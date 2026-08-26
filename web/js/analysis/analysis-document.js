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
      viewportPresentation: { mode: 'model', displayStyle: 'lines' },
      solveSettings: { relativeTolerance: 1e-8 },
      results: null,
      convergenceStudy: null
    };
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.createAnalysisDocument = createAnalysisDocument;
}(globalThis));
