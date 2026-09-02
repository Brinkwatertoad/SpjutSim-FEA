(function (root) {
  'use strict';

  function byId(id) { return document.getElementById(id); }

  function itemDescription(item) {
    var value;
    if (item.kind === 'support') {
      value = Object.keys(item.original.componentsM).map(function (axis) {
        return axis.toUpperCase() + ' = ' + root.SpjutsimFEA.siToDisplay('displacementM', item.original.componentsM[axis]) + ' mm';
      }).join(', ');
      return 'Support · ' + value + ' · ' + item.oldFaceIds.length + (item.oldFaceIds.length === 1 ? ' current face' : ' current faces');
    }
    value = item.original.type === 'pressure'
      ? root.SpjutsimFEA.siToDisplay('pressurePa', item.original.pressurePa) + ' MPa surface-normal pressure'
      : '[' + item.original.forceN.join(', ') + '] N global total force';
    return 'Load · ' + value + ' · ' + item.oldFaceIds.length + (item.oldFaceIds.length === 1 ? ' current face' : ' current faces');
  }

  function ReplacementMigrationUI() {
    this.backdrop = byId('replacement-migration-backdrop');
    this.dialog = byId('replacement-migration-dialog');
    this.progress = byId('replacement-migration-progress');
    this.status = byId('replacement-migration-status');
    this.itemName = byId('replacement-item-name');
    this.itemDescription = byId('replacement-item-description');
    this.summary = byId('replacement-migration-summary');
    this.summaryList = byId('replacement-migration-summary-list');
    this.backButton = byId('replacement-migration-back');
    this.dropButton = byId('replacement-migration-drop');
    this.mapButton = byId('replacement-migration-map');
    this.applyButton = byId('replacement-migration-apply');
    this.cancelButton = byId('replacement-migration-cancel');
    this.draft = null;
    this.activeIndex = 0;
    this.selectedNewFaceIds = new Set();
    this.oldViewport = null;
    this.newViewport = null;
    this.applyHandler = null;
    this.cancelHandler = null;
    this.bind();
  }

  ReplacementMigrationUI.prototype.bind = function () {
    var self = this;
    if (!this.backdrop) { return; }
    this.backButton.addEventListener('click', function () { self.goBack(); });
    this.dropButton.addEventListener('click', function () { self.recordDrop(); });
    this.mapButton.addEventListener('click', function () { self.recordMapping(); });
    this.applyButton.addEventListener('click', function () { self.apply(); });
    this.cancelButton.addEventListener('click', function () { self.cancel(); });
    this.backdrop.addEventListener('mousedown', function (event) { if (event.target === self.backdrop) { self.cancel(); } });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && self.draft && !event.defaultPrevented) { self.cancel(); event.preventDefault(); }
    });
  };

  ReplacementMigrationUI.prototype.open = function (draft, applyHandler, cancelHandler) {
    var self = this;
    if (!this.backdrop || !draft) { throw new Error('Replacement migration UI is unavailable.'); }
    this.closeViewports();
    this.draft = draft;
    this.activeIndex = 0;
    this.applyHandler = applyHandler;
    this.cancelHandler = cancelHandler;
    this.selectedNewFaceIds.clear();
    this.backdrop.hidden = false;
    this.oldViewport = new root.SpjutsimFEA.ViewportController(byId('replacement-old-viewport'));
    this.newViewport = new root.SpjutsimFEA.ViewportController(byId('replacement-new-viewport'));
    this.oldViewport.setGeometryPreview(draft.oldGeometry);
    this.newViewport.setGeometryPreview(draft.newGeometry);
    this.newViewport.setFacePickHandler(function (faceId, additive) {
      if (!faceId) { self.selectedNewFaceIds.clear(); }
      else if (additive) {
        if (self.selectedNewFaceIds.has(faceId)) { self.selectedNewFaceIds.delete(faceId); } else { self.selectedNewFaceIds.add(faceId); }
      } else { self.selectedNewFaceIds = new Set([faceId]); }
      self.newViewport.setSelectedFaceIds(Array.from(self.selectedNewFaceIds));
      self.renderButtons();
    });
    this.render();
    this.dialog.focus();
  };

  ReplacementMigrationUI.prototype.renderButtons = function () {
    var reviewing = this.draft && this.activeIndex >= this.draft.items.length;
    this.backButton.disabled = !this.draft || this.activeIndex === 0;
    this.dropButton.hidden = Boolean(reviewing);
    this.mapButton.hidden = Boolean(reviewing);
    this.mapButton.disabled = !this.selectedNewFaceIds.size;
    this.applyButton.hidden = !reviewing;
    this.applyButton.disabled = !this.draft || !root.SpjutsimFEA.replacementMigrationSummary(this.draft).complete;
  };

  ReplacementMigrationUI.prototype.render = function () {
    var item;
    var summary;
    var self = this;
    if (!this.draft) { return; }
    summary = root.SpjutsimFEA.replacementMigrationSummary(this.draft);
    this.progress.textContent = summary.total
      ? Math.min(this.activeIndex + 1, summary.total) + ' of ' + summary.total + ' face-bound items'
      : 'No face-bound items';
    if (this.activeIndex >= this.draft.items.length) {
      this.itemName.textContent = 'Ready to replace';
      this.itemDescription.textContent = 'Review mapped and dropped items, then apply the replacement atomically.';
      this.summary.hidden = false;
      this.summaryList.replaceChildren();
      this.draft.items.forEach(function (entry) {
        var line = document.createElement('li');
        line.textContent = entry.name + ': ' + (entry.decision === 'mapped' ? entry.newFaceIds.length + ' replacement face(s)' : 'Dropped');
        self.summaryList.append(line);
      });
      var automatic = document.createElement('li');
      automatic.textContent = 'Material, gravity, mesh settings, solve settings, and view preferences transfer automatically.';
      this.summaryList.append(automatic);
      this.oldViewport.setSelectedFaceIds([]);
      this.newViewport.setSelectedFaceIds([]);
      this.status.textContent = summary.mapped + ' mapped · ' + summary.dropped + ' explicitly dropped';
      this.renderButtons();
      return;
    }
    item = this.draft.items[this.activeIndex];
    this.summary.hidden = true;
    this.itemName.textContent = item.name;
    this.itemDescription.textContent = itemDescription(item);
    this.oldViewport.setSelectedFaceIds(item.oldFaceIds);
    this.selectedNewFaceIds = new Set(item.decision === 'mapped' ? item.newFaceIds : []);
    this.newViewport.setSelectedFaceIds(Array.from(this.selectedNewFaceIds));
    this.status.textContent = 'Highlighted faces on the current model belong to this item. Select corresponding replacement faces, or explicitly drop it.';
    this.renderButtons();
  };

  ReplacementMigrationUI.prototype.recordMapping = function () {
    try {
      root.SpjutsimFEA.mapReplacementMigrationItem(this.draft, this.activeIndex, Array.from(this.selectedNewFaceIds));
      this.activeIndex += 1;
      this.render();
    } catch (error) { this.status.textContent = error.message; }
  };

  ReplacementMigrationUI.prototype.recordDrop = function () {
    root.SpjutsimFEA.dropReplacementMigrationItem(this.draft, this.activeIndex);
    this.activeIndex += 1;
    this.render();
  };

  ReplacementMigrationUI.prototype.goBack = function () {
    if (this.activeIndex > 0) { this.activeIndex -= 1; this.render(); }
  };

  ReplacementMigrationUI.prototype.apply = function () {
    try {
      var transfer = root.SpjutsimFEA.buildReplacementMigrationTransfer(this.draft);
      this.applyHandler(this.draft.newGeometry, this.draft.newSource, transfer);
      this.finish(false);
    } catch (error) { this.status.textContent = error.message; }
  };

  ReplacementMigrationUI.prototype.closeViewports = function () {
    if (this.oldViewport) { this.oldViewport.dispose(); }
    if (this.newViewport) { this.newViewport.dispose(); }
    this.oldViewport = null; this.newViewport = null;
  };

  ReplacementMigrationUI.prototype.finish = function (cancelled) {
    var cancelHandler = this.cancelHandler;
    this.closeViewports();
    this.backdrop.hidden = true;
    this.draft = null; this.applyHandler = null; this.cancelHandler = null;
    this.selectedNewFaceIds.clear();
    if (cancelled && cancelHandler) { cancelHandler(); }
  };

  ReplacementMigrationUI.prototype.cancel = function () { if (this.draft) { this.finish(true); } };
  ReplacementMigrationUI.prototype.dispose = function () { this.finish(false); };

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.ReplacementMigrationUI = ReplacementMigrationUI;
}(globalThis));
