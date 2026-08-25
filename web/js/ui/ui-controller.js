(function (root) {
  'use strict';
  function UIController(controller) { this.controller = controller; }
  UIController.prototype.start = function () {
    this.controller.subscribe(function () {});
  };
  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.UIController = UIController;
}(globalThis));
