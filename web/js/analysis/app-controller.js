(function (root) {
  'use strict';

  function AppController(options) {
    this.document = options.document;
    this.listeners = [];
  }

  AppController.prototype.subscribe = function (listener) {
    this.listeners.push(listener);
    listener(this.document);
  };

  AppController.prototype.notify = function () {
    var documentState = this.document;
    this.listeners.forEach(function (listener) { listener(documentState); });
  };

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.AppController = AppController;
}(globalThis));
