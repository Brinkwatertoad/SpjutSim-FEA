(function (root) {
  'use strict';
  var STORAGE_KEY = 'spjutsim-fea.workspace';
  var MIN_VIEWPORT = 320, SPLITTER = 6;
  function width(value, fallback, minimum) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(minimum, Math.min(520, value)) : fallback;
  }
  function normalizePreferences(value) {
    var source = value && typeof value === 'object' ? value : {};
    return { setupWidth: width(source.setupWidth, 280, 220), resultsWidth: width(source.resultsWidth, 340, 260),
      setupOpen: typeof source.setupOpen === 'boolean' ? source.setupOpen : true,
      resultsOpen: typeof source.resultsOpen === 'boolean' ? source.resultsOpen : false };
  }
  function WorkspaceLayout(element, options) {
    this.element = element;
    this.document = element.ownerDocument;
    this.storage = null;
    this.listeners = [];
    this.drag = null;
    this.activePane = 'setup';
    try { this.storage = options && Object.prototype.hasOwnProperty.call(options, 'storage') ? options.storage : root.localStorage; } catch (error) { /* Session-only preferences. */ }
    var record;
    try { record = JSON.parse(this.storage && this.storage.getItem(STORAGE_KEY)); } catch (error) { record = null; }
    this.preferences = normalizePreferences(record && record.version === 1 ? record.preferences : null);
    // A fresh session has no output; explicit output commands reveal Results.
    this.preferences.resultsOpen = false;
    this.panes = {}; this.toggles = {}; this.splitters = {};
    var self = this;
    ['setup', 'results'].forEach(function (name) {
      self.panes[name] = self.document.getElementById(name + '-pane');
      self.toggles[name] = self.document.getElementById('toggle-' + name + '-pane');
      self.splitters[name] = self.document.getElementById(name + '-splitter');
      self.listen(self.toggles[name], 'click', function () { self.setPaneOpen(name, self.panes[name].hidden); });
      self.listen(self.splitters[name], 'keydown', function (event) {
        var direction = name === 'setup' ? 1 : -1;
        var value = self.preferences[name + 'Width'];
        if (event.key === 'ArrowLeft') { value -= 16 * direction; }
        else if (event.key === 'ArrowRight') { value += 16 * direction; }
        else if (event.key === 'Home') { value = name === 'setup' ? 220 : 260; }
        else if (event.key === 'End') { value = 520; }
        else { return; }
        event.preventDefault(); self.setPaneWidth(name, value);
      });
      self.listen(self.splitters[name], 'pointerdown', function (event) {
        if (event.button !== 0) { return; }
        self.drag = {name:name, pointerId:event.pointerId, x:event.clientX, width:self.panes[name].getBoundingClientRect().width};
        self.splitters[name].setPointerCapture(event.pointerId); event.preventDefault();
      });
      self.listen(self.splitters[name], 'pointermove', function (event) {
        if (!self.drag || self.drag.pointerId !== event.pointerId) { return; }
        self.setPaneWidth(name, self.drag.width + (event.clientX - self.drag.x) * (name === 'setup' ? 1 : -1));
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (type) {
        self.listen(self.splitters[name], type, function (event) {
          if (!self.drag || self.drag.pointerId !== event.pointerId) { return; }
          self.drag = null;
          if (self.splitters[name].hasPointerCapture(event.pointerId)) { self.splitters[name].releasePointerCapture(event.pointerId); }
        });
      });
    });
    this.observer = new root.ResizeObserver(function () { self.render(); });
    this.observer.observe(element);
    this.render();
  }
  WorkspaceLayout.prototype.listen = function (element, type, handler) {
    if (!element) { return; }
    element.addEventListener(type, handler); this.listeners.push([element, type, handler]);
  };
  WorkspaceLayout.prototype.save = function () {
    try { if (this.storage) { this.storage.setItem(STORAGE_KEY, JSON.stringify({version:1,preferences:this.preferences})); } } catch (error) { /* Keep live controls usable without storage. */ }
  };
  WorkspaceLayout.prototype.setPaneOpen = function (name, open) {
    if (!this.panes[name]) { return; }
    this.preferences[name + 'Open'] = Boolean(open);
    if (open) { this.activePane = name; }
    this.render(); this.save();
  };
  WorkspaceLayout.prototype.setPaneWidth = function (name, value) {
    var other = name === 'setup' ? 'results' : 'setup';
    var available = this.element.clientWidth - MIN_VIEWPORT - SPLITTER -
      (!this.panes[other].hidden ? this.panes[other].getBoundingClientRect().width + SPLITTER : 0);
    this.preferences[name + 'Width'] = width(Math.min(value, available), name === 'setup' ? 280 : 340, name === 'setup' ? 220 : 260);
    this.render(); this.save();
  };
  WorkspaceLayout.prototype.render = function () {
    var total = this.element.clientWidth;
    var compact = total < 1000;
    var drawer = total < 680;
    if (drawer && !this.wasDrawer) { this.activePane = null; }
    this.wasDrawer = drawer;
    this.element.dataset.drawer = String(drawer);
    this.element.dataset.compact = String(compact);
    var p = this.preferences;
    var setupOpen = p.setupOpen && (!compact || this.activePane === 'setup');
    var resultsOpen = p.resultsOpen && (!compact || this.activePane === 'results');
    var available = Math.max(0, total - MIN_VIEWPORT - (setupOpen ? SPLITTER : 0) - (resultsOpen ? SPLITTER : 0));
    var setupWidth = setupOpen ? p.setupWidth : 0, resultsWidth = resultsOpen ? p.resultsWidth : 0;
    if (!drawer && setupWidth + resultsWidth > available) {
      var excess = setupWidth + resultsWidth - available;
      var reduction = Math.min(excess, Math.max(0, setupWidth - 220)); setupWidth -= reduction; excess -= reduction;
      resultsWidth -= Math.min(excess, Math.max(0, resultsWidth - 260));
    }
    this.element.style.gridTemplateColumns = drawer ? 'minmax(0, 1fr)' :
      setupWidth + 'px ' + (setupOpen ? SPLITTER : 0) + 'px minmax(0, 1fr) ' + (resultsOpen ? SPLITTER : 0) + 'px ' + resultsWidth + 'px';
    var self = this;
    ['setup', 'results'].forEach(function (name) {
      var open = name === 'setup' ? setupOpen : resultsOpen;
      var pane = self.panes[name], toggle = self.toggles[name], splitter = self.splitters[name];
      if (!open && (pane.contains(self.document.activeElement) || splitter === self.document.activeElement)) { toggle.focus(); }
      pane.hidden = !open; splitter.hidden = compact || !open;
      toggle.setAttribute('aria-expanded', String(open));
      splitter.setAttribute('aria-valuenow', String(Math.round(name === 'setup' ? setupWidth : resultsWidth)));
      splitter.setAttribute('aria-valuemax', String(Math.min(520, Math.max(name === 'setup' ? 220 : 260, available - (name === 'setup' ? resultsWidth : setupWidth)))));
    });
  };
  WorkspaceLayout.prototype.dispose = function () {
    if (this.drag) {
      var splitter = this.splitters[this.drag.name];
      if (splitter.hasPointerCapture(this.drag.pointerId)) { splitter.releasePointerCapture(this.drag.pointerId); }
      this.drag = null;
    }
    this.observer.disconnect();
    this.listeners.forEach(function (entry) { entry[0].removeEventListener(entry[1], entry[2]); });
    this.listeners = [];
  };
  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.normalizeWorkspacePreferences = normalizePreferences;
  root.SpjutsimFEA.WorkspaceLayout = WorkspaceLayout;
}(globalThis));
