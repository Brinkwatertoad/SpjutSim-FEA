(function () {
  'use strict';
  var frame = document.getElementById('application-frame');
  function assert(value, message) { if (!value) { throw Error(message); } }
  function wait(test) {
    return new Promise(function (resolve, reject) {
      var start = performance.now();
      function poll() {
        if (test()) { resolve(); }
        else if (performance.now() - start > 180000) { reject(Error('Timed out waiting for application')); }
        else { setTimeout(poll, 40); }
      }
      poll();
    });
  }
  frame.addEventListener('load', async function () {
    var win = frame.contentWindow, doc = win.document, app;
    try {
      await wait(function () { return doc.getElementById('app-status').textContent === 'Local runtime ready'; });
      var api = win.SpjutsimFEA, notify = api.AppController.prototype.notify;
      api.AppController.prototype.notify = function () { app = this; return notify.apply(this, arguments); };
      assert(doc.getElementById('load-beam-example'), 'The practical cantilever example is missing');
      var beamMenu=doc.querySelector('[data-ui-menu-action="example-cantilever"]');
      assert(beamMenu && doc.querySelector('[data-ui-menu-action="example-cube"]'), 'Examples menu is missing its prepared models');
      beamMenu.closest('[data-ui-menu-group]').querySelector('[data-ui-menu-button]').click();beamMenu.click();
      await wait(function () { return app && app.document.projectMetadata && app.document.projectMetadata.name === 'Cantilever beam example'; });
      var state = app.document, box = state.geometry.boundingBoxM;
      [2, 0.1, 0.2].forEach(function (size, axis) {
        // OpenCASCADE expands the reported bounds by 0.1 µm on each side.
        assert(Math.abs(box.maxM[axis] - box.minM[axis] - size) < 3e-7, 'Beam dimensions or CAD units are incorrect');
      });
      assert(Math.abs(box.minM[1]) < 3e-7 && Math.abs(box.minM[2] + 0.2) < 3e-7, 'Beam rotation has the wrong sense or origin');
      assert(state.boundaryConditions.length === 1 && state.loads.length === 1, 'Example assignments are incomplete');
      assert(state.loads[0].forceN[1] === -2000 && state.loads[0].forceN[2] === 0, 'Example end load has the wrong magnitude or direction');
      assert(Math.abs(state.geometry.volumeM3 - 0.04) < 1e-12, 'Beam volume or CAD units are incorrect');
      assert(api.validateReportOptions(state.projectMetadata.reportOptions).notes.includes('1.6 mm'), 'The reference explanation is missing from report notes');
      assert(!state.resultInvalidation.stale && doc.getElementById('analysis-edit-feedback').hidden, 'Initial setup incorrectly says solved results were cleared');
      doc.getElementById('setup-guide-dismiss').click();
      doc.getElementById('solve-button').click();
      await wait(function () { return state.results || state.solveExecution.status === 'failed' || state.meshGeneration.status === 'failed' || state.solvePreflight.status === 'failed'; });
      assert(state.results, 'Beam solve failed: ' + JSON.stringify(state.solveExecution.error || state.meshGeneration.error || state.solvePreflight.error));
      var result = state.results, tipSum = 0, tipCount = 0;
      for (var node = 0; node < result.originalSurface.nodePositionsM.length / 3; node++) {
        // The 2 m tip coordinate is exactly representable in Float32.
        if (Math.abs(result.originalSurface.nodePositionsM[node * 3] - 2) < 1e-8) {
          tipSum += result.displacementM[node * 3 + 1]; tipCount++;
        }
      }
      // Euler–Bernoulli: F L^3 / (3 E I), I = b h^3 / 12 => 1.6 mm.
      // The 3% tolerance permits solid end effects/shear and this teaching mesh.
      assert(tipCount && Math.abs(tipSum / tipCount + 0.0016) < 0.0016 * 0.03, 'Tip displacement differs from beam theory by more than 3%: ' + tipSum / tipCount + ' m over ' + tipCount + ' tip nodes; max = ' + result.extrema.maxDisplacement.valueM);
      assert(Math.abs(result.equilibrium.totalReactionN[1] - 2000) < 2000e-6 && result.equilibrium.relativeResidual < 1e-6, 'Beam reaction is not in equilibrium');
      assert(doc.getElementById('displacement-headline').textContent.includes('mm'), 'Displacement headline missing');
      assert(!doc.getElementById('result-details').open, 'Secondary results obscure the primary summary');
      doc.getElementById('review-convergence-button').click();
      assert(doc.getElementById('convergence-tab').getAttribute('aria-selected') === 'true', 'Result action did not open convergence');
      doc.getElementById('results-tab').click();
      doc.getElementById('view-displacement-button').click();
      assert(state.viewportPresentation.mode === 'deformation' && state.viewportPresentation.field === 'displacementMagnitude', 'Displacement action did not display displacement');
      assert(state.results === result, 'Result navigation changed engineering data');
      doc.getElementById('result-material-button').click();
      assert(doc.activeElement.id === 'material-tensile-yield' && doc.activeElement.closest('details').open, 'Missing-strength action did not open the material field');
      doc.dispatchEvent(new win.KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
      assert(state.results === result, 'Opening material to review strength invalidated results');
      var id = state.loads[0].id;
      app.renameAssignment('load', id, 'Tip force');
      assert(state.results === result && doc.getElementById('analysis-edit-feedback').hidden, 'Renaming incorrectly cleared results');
      app.replaceLoad(id, {type:'total-force',forceN:[0,-4000,0]});
      var feedback = doc.getElementById('analysis-edit-feedback');
      assert(!state.results && !feedback.hidden && feedback.textContent.includes('Loads changed') && feedback.textContent.includes('Solve again'), 'Load edit lacks visible invalidation feedback');
      app.undoEngineeringEdit();
      assert(!state.results && !feedback.hidden && feedback.textContent.includes('Solve again'), 'Undo hid the requirement to solve again');
      doc.getElementById('solve-button').click();
      await wait(function () { return state.results || state.solveExecution.status === 'failed'; });
      assert(state.results && feedback.hidden && state.resultInvalidation === null, 'A successful new solve did not clear the edit reminder');
      app.replaceLoad(id, {type:'total-force',forceN:[0,-4000,0]});
      doc.getElementById('toggle-setup-pane').click();
      if (doc.getElementById('toggle-results-pane').getAttribute('aria-expanded') === 'true') { doc.getElementById('toggle-results-pane').click(); }
      assert(feedback.getClientRects().length > 0, 'Edit feedback disappears with both side panes closed');
      app.replaceMeshSettings({preset:'fine',elementType:'tet10'});
      assert(feedback.textContent.includes('Mesh and solve'), 'Mesh invalidation does not explain that remeshing is needed');
      window.__spjutsimUsabilityEvidence = {tipDisplacementM:tipSum/tipCount, beamTheoryM:-0.0016,
        reactionN:result.equilibrium.totalReactionN, equilibriumResidual:result.equilibrium.relativeResidual,
        nodes:result.meshStatistics.nodeCount, elements:result.meshStatistics.elementCount};
      doc.querySelector('[data-ui-menu-action="example-cube"]').click();
      await wait(function(){return state!==app.document && app.document.projectMetadata && app.document.projectMetadata.name==='Cube example';});
      assert(app.document.loads.length===1 && app.document.loads[0].forceN[0]===1000 && app.document.boundaryConditions.length===3,'Examples menu mixed old assignments with the new example');
      document.getElementById('test-status').textContent = 'Passed';
    } catch (error) {
      document.getElementById('test-status').textContent = 'Failed: ' + error.message;
      console.error(error);
    }
  });
  frame.src = '../../web/index.html';
}());
