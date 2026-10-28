(function (root) {
  'use strict';
  var STORAGE_KEY = 'spjutsim-fea.workspace';
  var MIN_VIEWPORT = 320, SPLITTER = 8;
  function width(value, fallback, minimum) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(minimum, value) : fallback;
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
      var minimum = name === 'setup' ? 220 : 260;
      self.bindings = self.bindings || [];
      var binding = root.PortableUIPanes.bindResizeHandle({handle:self.splitters[name],direction:name==='setup'?1:-1,
        getSize:function(){return self.panes[name].hidden?self.preferences[name+'Width']:(self.panes[name].getBoundingClientRect().width||self.preferences[name+'Width']);},getBounds:function(){var other=name==='setup'?'results':'setup';return {min:minimum,max:Math.max(minimum,element.clientWidth-MIN_VIEWPORT-2*SPLITTER-(self.panes[other]&&!self.panes[other].hidden?self.panes[other].getBoundingClientRect().width:0))};},
        getDefaultSize:function(){return name==='setup'?280:340;},getSnapshot:function(){return {preferences:Object.assign({},self.preferences),activePane:self.activePane};},
        getOpen:function(){return !self.panes[name].hidden;},setOpen:function(open){self.setPaneOpen(name,open);},
        onResize:function(value){var other=name==='setup'?'results':'setup',maximum=Math.max(minimum,element.clientWidth-MIN_VIEWPORT-2*SPLITTER-(self.panes[other]&&!self.panes[other].hidden?self.panes[other].getBoundingClientRect().width:0));self.preferences[name+'Width']=Math.max(minimum,Math.min(maximum,value));self.preferences[name+'Open']=true;self.activePane=name;self.render();},
        onCancel:function(size,event,snapshot){self.preferences=snapshot.preferences;self.activePane=snapshot.activePane;self.render();},onCommit:function(){self.save();}
      });self.bindings.push(binding);
      self.bindings.push(root.PortableUIPanes.bindScrollPane(self.panes[name]));
      var focus=root.PortableUIPanes.bindPaneFocus({pane:self.panes[name],toggle:self.toggles[name]});self.bindings.push(focus);
      var drawer=root.PortableUIPanes.bindDrawer({pane:self.panes[name],toggle:self.toggles[name],side:name==='results'?'right':'left',isActive:function(){return element.dataset.drawer==='true'&&!self.panes[name].hidden;},contains:function(target){return self.panes[name].contains(target)||self.toggles[name].contains(target)||Boolean(target.closest('dialog,[role="dialog"],.custom-select-list'));},close:function(){self.setPaneOpen(name,false);}});self.bindings.push(drawer);
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
    SPLITTER = parseFloat(root.getComputedStyle(this.document.documentElement).getPropertyValue("--ui-pane-divider-size")) || 8;
    var arrangement=root.PortableUIPanes.resolveLayout({width:total,wideAt:1000,compactAt:680});
    var compact = arrangement!=='docked';
    // Keep one inspector alongside the viewport at intermediate widths.
    // Only phone widths need a temporary overlay.
    var drawer = arrangement === 'compact';
    if (drawer && !this.wasDrawer) { this.activePane = null; }
    this.wasDrawer = drawer;
    this.element.dataset.drawer = String(drawer);
    this.element.dataset.compact = String(compact);
    var p = this.preferences;
    var setupOpen = p.setupOpen && (!compact || this.activePane === 'setup');
    var resultsOpen = p.resultsOpen && (!compact || this.activePane === 'results');
    var available = Math.max(0, total - MIN_VIEWPORT - 2*SPLITTER);
    var setupWidth = setupOpen ? p.setupWidth : 0, resultsWidth = resultsOpen ? p.resultsWidth : 0;
    if (!drawer && setupWidth + resultsWidth > available) {
      var excess = setupWidth + resultsWidth - available;
      var reduction = Math.min(excess, Math.max(0, setupWidth - 220)); setupWidth -= reduction; excess -= reduction;
      resultsWidth -= Math.min(excess, Math.max(0, resultsWidth - 260));
    }
    this.element.style.gridTemplateColumns = drawer ? 'minmax(0, 1fr)' :
      setupWidth + 'px ' + SPLITTER + 'px minmax(0, 1fr) ' + SPLITTER + 'px ' + resultsWidth + 'px';
    var self = this;
    ['setup', 'results'].forEach(function (name) {
      var open = name === 'setup' ? setupOpen : resultsOpen;
      var pane = self.panes[name], toggle = self.toggles[name], splitter = self.splitters[name];
      if (!open && (pane.contains(self.document.activeElement) || splitter === self.document.activeElement)) { toggle.focus(); }
      pane.hidden = !open; splitter.hidden = drawer;
      toggle.setAttribute('aria-expanded', String(open));

    });
    (this.bindings || []).forEach(function(binding){if(binding.sync)binding.sync();});
  };
  WorkspaceLayout.prototype.dispose = function () {
    (this.bindings || []).forEach(function(binding){binding.destroy();});
    this.observer.disconnect();
    this.listeners.forEach(function (entry) { entry[0].removeEventListener(entry[1], entry[2]); });
    this.listeners = [];
  };
  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.normalizeWorkspacePreferences = normalizePreferences;
  root.SpjutsimFEA.WorkspaceLayout = WorkspaceLayout;
}(globalThis));
