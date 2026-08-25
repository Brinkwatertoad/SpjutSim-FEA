(function (root) {
  'use strict';
  function ViewportController(canvas) { this.canvas = canvas; }
  ViewportController.prototype.resize = function () {
    var ratio = root.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.floor(this.canvas.clientWidth * ratio));
    this.canvas.height = Math.max(1, Math.floor(this.canvas.clientHeight * ratio));
  };
  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.ViewportController = ViewportController;
}(globalThis));
