(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  function drawLegend(canvas, sceneHeight, state, presentation) {
    var ctx = canvas.getContext('2d'), width = canvas.width, font = Math.max(12, Math.min(20, width / 48));
    var x = 20, rampY = sceneHeight + 42, rampWidth = width - 40;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, sceneHeight, width, canvas.height - sceneHeight);
    ctx.fillStyle = '#111827'; ctx.font = font + 'px sans-serif'; ctx.textBaseline = 'top';
    if (presentation.mode === 'model') {
      ctx.fillText('Part with loads and supports', x, sceneHeight + 14);
      var colors = root.getComputedStyle(document.documentElement);
      [['Loads / gravity', colors.getPropertyValue('--ui-color-load').trim() || '#ef4444'],
        ['Supports', colors.getPropertyValue('--ui-color-support').trim() || '#22c55e']].forEach(function (item, index) {
        var left = x + index * width / 2; ctx.fillStyle = item[1]; ctx.fillRect(left, rampY, 14, 14);
        ctx.fillStyle = '#111827'; ctx.fillText(item[0], left + 20, rampY);
      });
      ctx.fillText('Arrows indicate direction, not magnitude.', x, rampY + 32);
      return;
    }
    if (presentation.mode === 'mesh') { ctx.fillText('Part with ' + state.results.elementType.toUpperCase() + ' mesh', x, sceneHeight + 18); return; }
    var field = presentation.field, definition = api.resultFieldDefinition(field, presentation), range = api.resolveColorRange(state.results, presentation);
    ctx.fillText(definition[0] + (definition[1] ? ' (' + definition[1] + ')' : ''), x, sceneHeight + 12);
    var gradient = ctx.createLinearGradient(x, 0, x + rampWidth, 0), rgb = [0, 0, 0], color = new root.THREE.Color();
    for (var i = 0; i <= 3; i++) {
      api.resultColor(field === 'factorOfSafety' ? 1 - i / 3 : i / 3, rgb);
      gradient.addColorStop(i / 3, color.fromArray(rgb).convertLinearToSRGB().getStyle());
    }
    ctx.fillStyle = gradient; ctx.fillRect(x, rampY, rampWidth, 16); ctx.fillStyle = '#111827';
    ctx.fillText(api.formatResultNumber(range.minimum / definition[2]), x, rampY + 21);
    ctx.textAlign = 'right';
    ctx.fillText(field === 'factorOfSafety' && range.clipped ? api.formatResultNumber(range.maximum) + '+' : api.formatResultNumber(range.maximum / definition[2]), x + rampWidth, rampY + 21);
    ctx.textAlign = 'left';
    var note = presentation.mode === 'deformation' ? 'Auto shape ×' + api.formatResultNumber(presentation.deformationScale)
      : field === 'factorOfSafety' ? 'Unaveraged minimum FoS: ' + api.formatResultNumber(state.results.factorOfSafety.rawMinimum.value)
      : 'Smoothed surface; scale to unaveraged peak';
    ctx.fillText(note, x, rampY + 49);
  }
  // Capture one preset synchronously; asynchronous PNG encoding happens after restoration.
  api.ViewportController.prototype.captureReportView = function (state, presentation) {
    var saved = { view: this.captureViewState(), camera: this.camera.clone(), presentation: this.presentation,
      selected: Array.from(this.selectedFaceIds), probe: this.selectedResultPoint, overlay: this.analysisOverlayState,
      multiplier: this.deformationAnimationMultiplier };
    var grid = this.scene.getObjectByName('reference-grid'), gridVisible = grid && grid.visible;
    try {
      this.clearPeakMarker();
      this.setSelectedFaceIds([]);
      this.deformationAnimationMultiplier = 1;
      this.setPresentation(presentation);
      this.setAnalysisOverlay(Object.assign({}, state, { viewportPresentation: presentation, assignmentDraft: null }));
      this.resetView({ animate: false });
      this.fitCurrentModel({ animate: false });
      if (grid) { grid.visible = false; }
      var canvas = document.createElement('canvas');
      canvas.width = this.canvas.width; canvas.height = this.canvas.height + 128;
      // Render just the model scene. The second scene contains the gizmo and is omitted.
      this.renderer.clear(); this.renderer.render(this.scene, this.camera);
      canvas.getContext('2d').drawImage(this.canvas, 0, 0);
      drawLegend(canvas, this.canvas.height, state, presentation);
      return canvas;
    } finally {
      if (grid) { grid.visible = gridVisible; }
      this.deformationAnimationMultiplier = saved.multiplier;
      this.setPresentation(saved.presentation);
      this.setAnalysisOverlay(saved.overlay);
      this.setSelectedFaceIds(saved.selected);
      this.selectResultPoint(saved.probe);
      this.restoreViewState(saved.view);
      this.camera.position.copy(saved.camera.position); this.camera.up.copy(saved.camera.up); this.camera.quaternion.copy(saved.camera.quaternion);
      this.camera.updateMatrixWorld(); this.render();
    }
  };
}(globalThis));
