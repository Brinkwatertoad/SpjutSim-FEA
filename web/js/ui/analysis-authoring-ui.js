(function (root) {
  'use strict';

  function byId(id) { return document.getElementById(id); }

  function AnalysisAuthoringUI(controller) {
    var storage = null;
    this.controller = controller;
    this.materialForm = byId('material-form');
    this.materialStatus = byId('material-status');
    this.materialCatalogSelect = byId('material-catalog-select');
    this.materialCatalogDetails = byId('material-catalog-details');
    this.replaceSavedMaterialButton = byId('replace-saved-material-button');
    this.removeSavedMaterialButton = byId('remove-saved-material-button');
    this.removeMaterialButton = byId('remove-material-button');
    this.supportForm = byId('support-form');
    this.supportStatus = byId('support-status');
    this.supportType = byId('support-type');
    this.componentFields = byId('support-component-fields');
    this.cancelSupportEdit = byId('cancel-support-edit');
    this.removeSupportItemButton = byId('remove-support-item-button');
    this.loadForm = byId('load-form');
    this.loadStatus = byId('load-status');
    this.loadType = byId('load-type');
    this.pressureFields = byId('pressure-fields');
    this.forceFields = byId('force-fields');
    this.cancelLoadEdit = byId('cancel-load-edit');
    this.removeLoadItemButton = byId('remove-load-item-button');
    this.gravityForm = byId('gravity-form');
    this.gravityStatus = byId('gravity-status');
    this.modelRotationAxis = byId('model-rotation-axis');
    this.modelRotationAngle = byId('model-rotation-angle');
    this.rotateModelPositiveButton = byId('rotate-model-positive');
    this.rotateModelNegativeButton = byId('rotate-model-negative');
    this.resetModelOrientationButton = byId('reset-model-orientation');
    this.modelFaceDirection = byId('model-face-direction');
    this.orientSelectedFaceButton = byId('orient-selected-face');
    this.modelOrientationStatus = byId('model-orientation-status');
    this.setupInspectorStatus = byId('setup-inspector-status');
    this.setupModelList = byId('setup-inspector-model-list');
    this.setupSupportList = byId('setup-inspector-support-list');
    this.constraintStabilitySummary = byId('constraint-stability-summary');
    this.setupLoadList = byId('setup-inspector-load-list');
    this.setupFormStash = byId('setup-inspector-form-stash');
    this.addSupportButton = byId('setup-add-support-button');
    this.addLoadButton = byId('setup-add-load-button');
    this.activeInspectorKind = null;
    this.activeInspectorItemId = null;
    this.activeInspectorFocusReturn = null;
    this.editingSupportId = null;
    this.editingLoadId = null;
    this.lastSupportType = this.supportType ? this.supportType.value : 'fixed';
    this.lastLoadType = this.loadType ? this.loadType.value : 'pressure';
    try { storage = root.localStorage; } catch (error) { storage = null; }
    this.materialCatalog = root.SpjutsimFEA.MaterialCatalog ? new root.SpjutsimFEA.MaterialCatalog(storage) : null;
    this.renderedMaterial = undefined;
    this.materialFeedback = null;
    this.supportFeedback = null;
    this.loadFeedback = null;
    this.gravityFeedback = null;
    this.orientationFeedback = null;
  }

  function readNumber(id, label, optional) {
    var input = byId(id);
    var text = input ? input.value.trim() : '';
    var value;
    if (text === '' && optional) { return undefined; }
    value = Number(text);
    if (!Number.isFinite(value)) { throw new Error('Enter a finite value for ' + label + '.'); }
    return value;
  }

  function setOptionalDisplay(id, quantity, value) {
    byId(id).value = value == null ? '' : String(root.SpjutsimFEA.siToDisplay(quantity, value));
  }

  function setFeedback(element, feedback, fallback) {
    if (!element) { return; }
    element.textContent = feedback ? feedback.message : fallback;
    element.classList.toggle('fea-error', Boolean(feedback && feedback.error));
    element.classList.toggle('fea-warning', Boolean(feedback && feedback.warning));
  }

  AnalysisAuthoringUI.prototype.announceSetup = function (message) {
    if (this.setupInspectorStatus) { this.setupInspectorStatus.textContent = message || ''; }
  };

  var MATERIAL_FIELD_LABELS = {
    youngsModulusPa: "Young's modulus", poissonsRatio: "Poisson's ratio", densityKgM3: 'density',
    tensileYieldPa: 'tensile yield', compressiveYieldPa: 'compressive yield',
    ultimateTensilePa: 'ultimate tensile', ultimateCompressivePa: 'ultimate compressive'
  };

  AnalysisAuthoringUI.prototype.start = function () {
    var self = this;
    if (!this.materialForm) { return; }
    this.materialForm.addEventListener('submit', function (event) { event.preventDefault(); self.saveMaterial(); });
    if (this.materialCatalogSelect) {
      this.materialCatalogSelect.addEventListener('change', function () { self.selectMaterialCatalogEntry(); });
    }
    if (this.replaceSavedMaterialButton) {
      this.replaceSavedMaterialButton.addEventListener('click', function () { self.replaceSavedMaterial(); });
    }
    if (this.removeSavedMaterialButton) {
      this.removeSavedMaterialButton.addEventListener('click', function () { self.removeSavedMaterial(); });
    }
    this.removeMaterialButton.addEventListener('click', function () {
      try { self.controller.clearMaterial(); self.materialFeedback = null; self.render(self.controller.document); } catch (error) { self.materialFeedback = { error: true, message: error.message }; self.render(self.controller.document); }
    });
    this.supportForm.addEventListener('submit', function (event) { event.preventDefault(); self.saveSupport(); });
    this.supportType.addEventListener('change', function () {
      if (!self.editingSupportId) { self.lastSupportType = self.supportType.value; }
      self.renderSupportType();
    });
    this.cancelSupportEdit.addEventListener('click', function () { self.closeInspectorRow({ restoreFocus: true, cancelEdit: true }); });
    this.removeSupportItemButton.addEventListener('click', function () { self.removeActiveSupport(); });
    ['ux', 'uy', 'uz'].forEach(function (axis) {
      byId('support-' + axis + '-enabled').addEventListener('change', function () { self.renderSupportComponents(); });
    });
    this.loadForm.addEventListener('submit', function (event) { event.preventDefault(); self.saveLoad(); });
    this.loadType.addEventListener('change', function () {
      if (!self.editingLoadId) { self.lastLoadType = self.loadType.value; }
      self.renderLoadType();
    });
    this.cancelLoadEdit.addEventListener('click', function () { self.closeInspectorRow({ restoreFocus: true, cancelEdit: true }); });
    this.removeLoadItemButton.addEventListener('click', function () { self.removeActiveLoad(); });
    this.gravityForm.addEventListener('submit', function (event) { event.preventDefault(); self.saveGravity(); });
    if (this.rotateModelPositiveButton) { this.rotateModelPositiveButton.addEventListener('click', function () { self.rotateModel(1); }); }
    if (this.rotateModelNegativeButton) { this.rotateModelNegativeButton.addEventListener('click', function () { self.rotateModel(-1); }); }
    if (this.resetModelOrientationButton) { this.resetModelOrientationButton.addEventListener('click', function () { self.resetModelOrientation(); }); }
    if (this.orientSelectedFaceButton) { this.orientSelectedFaceButton.addEventListener('click', function () { self.orientSelectedFace(); }); }
    if (this.addSupportButton) {
      this.addSupportButton.addEventListener('click', function () { self.openInspectorRow('support', 'new', self.addSupportButton); });
    }
    if (this.addLoadButton) {
      this.addLoadButton.addEventListener('click', function () { self.openInspectorRow('load', 'new', self.addLoadButton); });
    }
    this.renderSupportType();
    this.renderLoadType();
    this.renderMaterialCatalogOptions();
    if (this.materialCatalog && this.materialCatalog.loadWarning) {
      this.materialFeedback = { warning: true, message: this.materialCatalog.loadWarning };
    }
  };

  AnalysisAuthoringUI.prototype.renderMaterialCatalogOptions = function () {
    var selected;
    var self = this;
    if (!this.materialCatalogSelect || !this.materialCatalog) { return; }
    selected = this.materialCatalogSelect.value || 'custom';
    this.materialCatalogSelect.replaceChildren();
    var custom = document.createElement('option');
    custom.value = 'custom'; custom.textContent = 'Custom';
    this.materialCatalogSelect.append(custom);
    this.materialCatalog.list().forEach(function (entry) {
      var option = document.createElement('option');
      option.value = entry.id;
      option.textContent = entry.material.name + (entry.layer === 'user' ? ' (User)' : '');
      self.materialCatalogSelect.append(option);
    });
    this.materialCatalogSelect.value = Array.from(this.materialCatalogSelect.options).some(function (option) { return option.value === selected; }) ? selected : 'custom';
    this.renderMaterialCatalogSelection();
  };

  AnalysisAuthoringUI.prototype.writeMaterialFields = function (material) {
    byId('material-name').value = material && material.name || '';
    setOptionalDisplay('material-youngs', 'youngsModulusPa', material && material.youngsModulusPa);
    byId('material-poisson').value = material ? String(material.poissonsRatio) : '';
    setOptionalDisplay('material-density', 'densityKgM3', material && material.densityKgM3);
    setOptionalDisplay('material-tensile-yield', 'strengthPa', material && material.tensileYieldPa);
    setOptionalDisplay('material-compressive-yield', 'strengthPa', material && material.compressiveYieldPa);
    setOptionalDisplay('material-ultimate-tensile', 'strengthPa', material && material.ultimateTensilePa);
    setOptionalDisplay('material-ultimate-compressive', 'strengthPa', material && material.ultimateCompressivePa);
  };

  AnalysisAuthoringUI.prototype.selectMaterialCatalogEntry = function () {
    var entry = this.materialCatalog && this.materialCatalog.get(this.materialCatalogSelect.value);
    if (entry) { this.writeMaterialFields(entry.material); }
    else { this.writeMaterialFields(this.controller.document.material); }
    this.materialFeedback = null;
    this.renderMaterialCatalogSelection();
    this.renderMaterial(this.controller.document);
  };

  AnalysisAuthoringUI.prototype.renderMaterialCatalogSelection = function () {
    var selectedId = this.materialCatalogSelect ? this.materialCatalogSelect.value : 'custom';
    var entry = selectedId !== 'custom' && this.materialCatalog ? this.materialCatalog.get(selectedId) : null;
    var factory = entry && entry.layer === 'factory';
    var submit = this.materialForm && this.materialForm.querySelector('button[type="submit"]');
    var details = this.materialCatalogDetails;
    Array.from(this.materialForm ? this.materialForm.querySelectorAll('input') : []).forEach(function (input) { input.readOnly = Boolean(factory); });
    if (submit) { submit.textContent = factory ? 'Apply material' : (entry ? 'Apply saved material' : 'Save custom material'); }
    if (this.replaceSavedMaterialButton) { this.replaceSavedMaterialButton.hidden = !entry || entry.layer !== 'user'; }
    if (this.removeSavedMaterialButton) { this.removeSavedMaterialButton.hidden = !entry || entry.layer !== 'user'; }
    if (!details) { return; }
    details.replaceChildren();
    if (!entry) {
      var customNote = document.createElement('p');
      customNote.textContent = 'Custom materials are validated in base SI units and saved only in this browser.';
      details.append(customNote);
      return;
    }
    if (entry.metadata.notes) {
      var notes = document.createElement('p'); notes.textContent = entry.metadata.notes; details.append(notes);
    }
    if (entry.metadata.warning) {
      var warning = document.createElement('p'); warning.className = 'fea-warning'; warning.textContent = entry.metadata.warning; details.append(warning);
    }
    if (entry.metadata.source) {
      var userSource = document.createElement('p'); userSource.textContent = 'Source: ' + entry.metadata.source; details.append(userSource);
    }
    var sources = [];
    Object.keys(entry.metadata.fieldProvenance || {}).forEach(function (field) {
      var source = entry.metadata.fieldProvenance[field];
      var known = sources.find(function (candidate) { return candidate.source.url === source.url; });
      if (known) { known.fields.push(field); }
      else { sources.push({ source: source, fields: [field] }); }
    });
    sources.forEach(function (group) {
      var row = document.createElement('p');
      var link = document.createElement('a'); link.href = group.source.url; link.textContent = group.source.label; link.target = '_blank'; link.rel = 'noreferrer';
      row.append('Source for ' + group.fields.map(function (field) { return MATERIAL_FIELD_LABELS[field] || field; }).join(', ') + ': ', link);
      details.append(row);
    });
  };

  AnalysisAuthoringUI.prototype.readMaterial = function () {
    var material = {
      youngsModulusPa: root.SpjutsimFEA.displayToSI('youngsModulusPa', readNumber('material-youngs', "Young's modulus")),
      poissonsRatio: readNumber('material-poisson', "Poisson's ratio")
    };
    var name = byId('material-name').value.trim();
    var density = readNumber('material-density', 'density', true);
    if (name) { material.name = name; }
    if (density !== undefined) { material.densityKgM3 = root.SpjutsimFEA.displayToSI('densityKgM3', density); }
    [
      ['material-tensile-yield', 'tensileYieldPa'], ['material-compressive-yield', 'compressiveYieldPa'],
      ['material-ultimate-tensile', 'ultimateTensilePa'], ['material-ultimate-compressive', 'ultimateCompressivePa']
    ].forEach(function (entry) {
      var value = readNumber(entry[0], entry[1], true);
      if (value !== undefined) { material[entry[1]] = root.SpjutsimFEA.displayToSI('strengthPa', value); }
    });
    return material;
  };

  AnalysisAuthoringUI.prototype.saveMaterial = function () {
    var selectedId = this.materialCatalogSelect ? this.materialCatalogSelect.value : 'custom';
    var entry = selectedId !== 'custom' && this.materialCatalog ? this.materialCatalog.get(selectedId) : null;
    try {
      var material = entry ? this.materialCatalog.materialSnapshot(selectedId) : this.readMaterial();
      var validation;
      var saved;
      if (!entry && this.materialCatalog) { this.materialCatalog.assertUniqueName(material.name); }
      validation = this.controller.replaceMaterial(material);
      if (!entry && this.materialCatalog) {
        saved = this.materialCatalog.saveUser(validation.value);
        this.renderMaterialCatalogOptions();
        this.materialCatalogSelect.value = saved.entry.id;
        this.renderMaterialCatalogSelection();
      }
      this.materialFeedback = validation.warnings.length
        ? { warning: true, message: validation.warnings[0].message }
        : (saved && saved.storageWarning ? { warning: true, message: saved.storageWarning } : { message: entry ? 'Material applied as an analysis snapshot.' : 'Custom material saved and applied in SI units.' });
      this.closeInspectorRow({ restoreFocus: true, cancelEdit: false, message: 'Material saved.' });
    } catch (error) {
      this.materialFeedback = { error: true, message: error.message };
      this.render(this.controller.document);
    }
  };

  AnalysisAuthoringUI.prototype.replaceSavedMaterial = function () {
    try {
      var id = this.materialCatalogSelect.value;
      var material = this.readMaterial();
      this.materialCatalog.assertUniqueName(material.name, id);
      var validation = this.controller.replaceMaterial(material);
      var result = this.materialCatalog.replaceUser(id, validation.value);
      this.materialFeedback = result.storageWarning ? { warning: true, message: result.storageWarning } : { message: 'Saved material explicitly replaced and applied.' };
      if (validation.warnings.length) { this.materialFeedback = { warning: true, message: validation.warnings[0].message }; }
      this.renderMaterialCatalogOptions();
      this.render(this.controller.document);
    } catch (error) {
      this.materialFeedback = { error: true, message: error.message };
      this.render(this.controller.document);
    }
  };

  AnalysisAuthoringUI.prototype.removeSavedMaterial = function () {
    try {
      var result = this.materialCatalog.removeUser(this.materialCatalogSelect.value);
      this.materialCatalogSelect.value = 'custom';
      this.materialFeedback = result.storageWarning ? { warning: true, message: result.storageWarning } : { message: 'Saved material removed. The active analysis snapshot is unchanged.' };
      this.renderMaterialCatalogOptions();
      this.writeMaterialFields(this.controller.document.material);
      this.render(this.controller.document);
    } catch (error) {
      this.materialFeedback = { error: true, message: error.message };
      this.render(this.controller.document);
    }
  };

  AnalysisAuthoringUI.prototype.renderMaterial = function (documentState) {
    var material = documentState.material;
    if (this.renderedMaterial !== material) {
      this.renderedMaterial = material;
      if (!this.materialCatalogSelect || this.materialCatalogSelect.value === 'custom') { this.writeMaterialFields(material); }
    }
    this.removeMaterialButton.disabled = !material;
    setFeedback(this.materialStatus, this.materialFeedback, material
      ? (material.name || 'Unnamed material') + ' · ' + root.SpjutsimFEA.siToDisplay('youngsModulusPa', material.youngsModulusPa) + ' GPa'
      : 'No material defined.');
    this.renderMaterialCatalogSelection();
  };

  AnalysisAuthoringUI.prototype.renderSupportType = function () {
    var custom = this.supportType.value === 'custom';
    this.componentFields.hidden = !custom;
    this.renderSupportComponents();
  };

  AnalysisAuthoringUI.prototype.renderSupportComponents = function () {
    ['ux', 'uy', 'uz'].forEach(function (axis) {
      var enabled = byId('support-' + axis + '-enabled');
      byId('support-' + axis).disabled = !this.controller.document.geometry || !enabled.checked;
    }, this);
  };

  AnalysisAuthoringUI.prototype.readSupport = function () {
    var support = {
      type: 'support',
      componentsM: {},
      faceIds: this.controller.document.selectedFaceIds.slice()
    };
    if (this.supportType.value === 'fixed') {
      support.componentsM = { x: 0, y: 0, z: 0 };
    } else {
      ['ux', 'uy', 'uz'].forEach(function (axis) {
        if (byId('support-' + axis + '-enabled').checked) {
          support.componentsM[axis.slice(1)] = root.SpjutsimFEA.displayToSI('displacementM', readNumber('support-' + axis, axis.toUpperCase() + ' displacement'));
        }
      });
    }
    return support;
  };

  AnalysisAuthoringUI.prototype.saveSupport = function () {
    try {
      var support = this.readSupport();
      if (this.editingSupportId) { this.controller.replaceBoundaryCondition(this.editingSupportId, support); }
      else { this.controller.createBoundaryCondition(support); }
      this.supportFeedback = { message: this.editingSupportId ? 'Support updated.' : 'Support added.' };
      this.resetSupportForm(false);
      this.closeInspectorRow({ restoreFocus: true, cancelEdit: false, message: 'Support saved.' });
    } catch (error) {
      this.supportFeedback = { error: true, message: error.message };
      this.render(this.controller.document);
    }
  };

  AnalysisAuthoringUI.prototype.removeActiveSupport = function () {
    if (!this.editingSupportId) { return; }
    try {
      this.controller.removeBoundaryCondition(this.editingSupportId);
      this.supportFeedback = { message: 'Support removed.' };
      this.resetSupportForm(false);
      this.closeInspectorRow({ restoreFocus: true, cancelEdit: false, message: 'Support removed.' });
    } catch (error) {
      this.supportFeedback = { error: true, message: error.message };
      this.render(this.controller.document);
    }
  };

  AnalysisAuthoringUI.prototype.beginSupportEdit = function (id) {
    var item = this.controller.document.boundaryConditions.find(function (entry) { return entry.id === id; });
    if (!item) { return; }
    this.editingSupportId = id;
    this.controller.selectBoundaryCondition(id);
    this.supportType.value = ['x', 'y', 'z'].every(function (axis) { return item.componentsM[axis] === 0; }) ? 'fixed' : 'custom';
    ['ux', 'uy', 'uz'].forEach(function (axis) {
      var value = item.componentsM[axis.slice(1)];
      byId('support-' + axis + '-enabled').checked = value !== undefined;
      byId('support-' + axis).value = value === undefined ? '' : String(root.SpjutsimFEA.siToDisplay('displacementM', value));
    });
    this.supportForm.querySelector('button[type="submit"]').textContent = 'Update support';
    this.cancelSupportEdit.hidden = false;
    this.renderSupportType();
  };

  AnalysisAuthoringUI.prototype.resetSupportForm = function (renderNow) {
    this.editingSupportId = null;
    this.supportForm.reset();
    this.supportType.value = this.lastSupportType;
    this.supportForm.querySelector('button[type="submit"]').textContent = 'Add support';
    this.cancelSupportEdit.hidden = true;
    this.removeSupportItemButton.hidden = true;
    this.renderSupportType();
    if (renderNow !== false) { this.render(this.controller.document); }
  };

  AnalysisAuthoringUI.prototype.renderSupports = function (documentState) {
    var self = this;
    if (this.editingSupportId && !documentState.boundaryConditions.some(function (item) { return item.id === self.editingSupportId; })) {
      this.resetSupportForm(false);
    }
    Array.from(this.supportForm.elements).forEach(function (control) { control.disabled = !documentState.geometry; });
    this.removeSupportItemButton.hidden = !this.editingSupportId;
    this.renderSupportComponents();
    setFeedback(this.supportStatus, this.supportFeedback, !documentState.geometry
      ? 'Import geometry and select faces to add a support.'
      : (documentState.boundaryConditions.length ? documentState.boundaryConditions.length + ' support item(s) defined.' : 'Select one or more faces, then add a support.'));
    this.renderConstraintStability(documentState);
  };

  AnalysisAuthoringUI.prototype.renderConstraintStability = function (documentState) {
    var stability = documentState.constraintStability;
    var constrained;
    var free;
    var coupled;
    var parts;
    if (!this.constraintStabilitySummary) { return; }
    if (!stability) {
      this.constraintStabilitySummary.textContent = 'Import a model to check rigid-body stability.';
      this.constraintStabilitySummary.classList.remove('fea-warning');
      return;
    }
    constrained = stability.modes.filter(function (mode) { return mode.status === 'constrained'; }).map(function (mode) { return mode.id; });
    free = stability.modes.filter(function (mode) { return mode.status === 'free'; }).map(function (mode) { return mode.id; });
    coupled = stability.modes.filter(function (mode) { return mode.status === 'coupled'; }).map(function (mode) { return mode.id; });
    parts = [stability.status === 'fully-constrained' ? 'Fully constrained' : 'Underconstrained', stability.provisional ? 'Preview' : 'Mesh'];
    if (constrained.length) { parts.push('Constrained: ' + constrained.join(', ')); }
    if (free.length) { parts.push('Free: ' + free.join(', ')); }
    if (coupled.length) { parts.push('Coupled: ' + coupled.join(', ') + ' (' + stability.coupledFreedomCount + ' mode' + (stability.coupledFreedomCount === 1 ? '' : 's') + ')'); }
    this.constraintStabilitySummary.textContent = parts.join(' · ');
    this.constraintStabilitySummary.classList.toggle('fea-warning', stability.status !== 'fully-constrained');
  };

  AnalysisAuthoringUI.prototype.renderLoadType = function () {
    var pressure = this.loadType.value === 'pressure';
    this.pressureFields.hidden = !pressure;
    this.forceFields.hidden = pressure;
  };

  AnalysisAuthoringUI.prototype.readLoad = function () {
    var load = { type: this.loadType.value, faceIds: this.controller.document.selectedFaceIds.slice() };
    if (load.type === 'pressure') {
      load.pressurePa = root.SpjutsimFEA.displayToSI('pressurePa', readNumber('load-pressure', 'pressure'));
    } else {
      load.forceN = ['fx', 'fy', 'fz'].map(function (axis) { return root.SpjutsimFEA.displayToSI('forceN', readNumber('load-' + axis, axis.toUpperCase() + ' force')); });
    }
    return load;
  };

  AnalysisAuthoringUI.prototype.saveLoad = function () {
    try {
      var load = this.readLoad();
      if (this.editingLoadId) { this.controller.replaceLoad(this.editingLoadId, load); }
      else { this.controller.createLoad(load); }
      this.loadFeedback = { message: this.editingLoadId ? 'Load updated.' : 'Load added.' };
      this.resetLoadForm(false);
      this.closeInspectorRow({ restoreFocus: true, cancelEdit: false, message: 'Load saved.' });
    } catch (error) {
      this.loadFeedback = { error: true, message: error.message };
      this.render(this.controller.document);
    }
  };

  AnalysisAuthoringUI.prototype.removeActiveLoad = function () {
    if (!this.editingLoadId) { return; }
    try {
      this.controller.removeLoad(this.editingLoadId);
      this.loadFeedback = { message: 'Load removed.' };
      this.resetLoadForm(false);
      this.closeInspectorRow({ restoreFocus: true, cancelEdit: false, message: 'Load removed.' });
    } catch (error) {
      this.loadFeedback = { error: true, message: error.message };
      this.render(this.controller.document);
    }
  };

  AnalysisAuthoringUI.prototype.beginLoadEdit = function (id) {
    var item = this.controller.document.loads.find(function (entry) { return entry.id === id; });
    if (!item) { return; }
    this.editingLoadId = id;
    this.controller.selectLoad(id);
    this.loadType.value = item.type;
    byId('load-pressure').value = item.pressurePa === undefined ? '' : String(root.SpjutsimFEA.siToDisplay('pressurePa', item.pressurePa));
    ['x', 'y', 'z'].forEach(function (axis, index) { byId('load-f' + axis).value = item.forceN ? String(item.forceN[index]) : ''; });
    this.loadForm.querySelector('button[type="submit"]').textContent = 'Update load';
    this.cancelLoadEdit.hidden = false;
    this.renderLoadType();
  };

  AnalysisAuthoringUI.prototype.resetLoadForm = function (renderNow) {
    this.editingLoadId = null;
    this.loadForm.reset();
    this.loadType.value = this.lastLoadType;
    this.loadForm.querySelector('button[type="submit"]').textContent = 'Add load';
    this.cancelLoadEdit.hidden = true;
    this.removeLoadItemButton.hidden = true;
    this.renderLoadType();
    if (renderNow !== false) { this.render(this.controller.document); }
  };

  AnalysisAuthoringUI.prototype.renderLoads = function (documentState) {
    var self = this;
    if (this.editingLoadId && !documentState.loads.some(function (item) { return item.id === self.editingLoadId; })) {
      this.resetLoadForm(false);
    }
    Array.from(this.loadForm.elements).forEach(function (control) { control.disabled = !documentState.geometry; });
    this.removeLoadItemButton.hidden = !this.editingLoadId;
    setFeedback(this.loadStatus, this.loadFeedback, !documentState.geometry
      ? 'Import geometry and select faces to add a load.'
      : (documentState.loads.length ? documentState.loads.length + ' load item(s) defined.' : 'Select one or more faces, then add a load.'));
  };

  AnalysisAuthoringUI.prototype.saveGravity = function () {
    try {
      var enabled = byId('gravity-enabled').checked;
      this.controller.replaceGravity({
        enabled: enabled,
        accelerationMS2: ['x', 'y', 'z'].map(function (axis) { return readNumber('gravity-' + axis, 'gravity ' + axis.toUpperCase()); })
      });
      this.gravityFeedback = { message: enabled ? 'Gravity enabled.' : 'Gravity disabled.' };
      this.closeInspectorRow({ restoreFocus: true, cancelEdit: false, message: this.gravityFeedback.message });
    } catch (error) {
      this.gravityFeedback = { error: true, message: error.message };
      this.render(this.controller.document);
    }
  };

  AnalysisAuthoringUI.prototype.renderGravity = function (documentState) {
    var gravity = documentState.gravity;
    if (document.activeElement !== byId('gravity-enabled') && !this.gravityForm.contains(document.activeElement)) {
      byId('gravity-enabled').checked = gravity.enabled;
      byId('gravity-x').value = String(gravity.accelerationMS2[0]);
      byId('gravity-y').value = String(gravity.accelerationMS2[1]);
      byId('gravity-z').value = String(gravity.accelerationMS2[2]);
    }
    setFeedback(this.gravityStatus, this.gravityFeedback, gravity.enabled ? 'Gravity is active.' : 'Gravity is off.');
  };

  AnalysisAuthoringUI.prototype.rotateModel = function (direction) {
    try {
      var angle = Math.abs(readNumber('model-rotation-angle', 'rotation angle'));
      if (!(angle > 0)) { throw new Error('Enter a rotation angle greater than zero.'); }
      this.controller.rotateGeometryAroundGlobalAxis(this.modelRotationAxis.value, direction * angle);
      this.orientationFeedback = { message: 'Rotated around global ' + this.modelRotationAxis.value.toUpperCase() + ' by ' + (direction > 0 ? '+' : '−') + angle + '°.' };
      this.announceSetup(this.orientationFeedback.message);
      this.render(this.controller.document);
    } catch (error) {
      this.orientationFeedback = { error: true, message: error.message };
      this.render(this.controller.document);
    }
  };

  AnalysisAuthoringUI.prototype.resetModelOrientation = function () {
    try {
      this.controller.resetGeometryOrientation();
      this.orientationFeedback = { message: 'Model orientation reset.' };
      this.announceSetup(this.orientationFeedback.message);
      this.render(this.controller.document);
    } catch (error) {
      this.orientationFeedback = { error: true, message: error.message };
      this.render(this.controller.document);
    }
  };

  AnalysisAuthoringUI.prototype.orientSelectedFace = function () {
    try {
      var result = this.controller.orientSelectedFaceToDirection(this.modelFaceDirection.value);
      this.orientationFeedback = result.warning
        ? { warning: true, message: result.warning }
        : { message: 'Selected face aligned to global ' + this.modelFaceDirection.options[this.modelFaceDirection.selectedIndex].text + '.' };
      this.announceSetup(this.orientationFeedback.message);
      this.render(this.controller.document);
    } catch (error) {
      this.orientationFeedback = { error: true, message: error.message };
      this.render(this.controller.document);
    }
  };

  AnalysisAuthoringUI.prototype.renderModelOrientation = function (documentState) {
    var disabled = !documentState.geometry;
    [this.modelRotationAxis, this.modelRotationAngle, this.rotateModelPositiveButton,
      this.rotateModelNegativeButton, this.resetModelOrientationButton, this.modelFaceDirection].forEach(function (control) {
      if (control) { control.disabled = disabled; }
    });
    if (this.orientSelectedFaceButton) {
      this.orientSelectedFaceButton.disabled = disabled || documentState.selectedFaceIds.length !== 1;
    }
    if (this.resetModelOrientationButton && documentState.geometry) {
      this.resetModelOrientationButton.disabled = documentState.geometry.orientation.operations.length === 0;
    }
    setFeedback(this.modelOrientationStatus, this.orientationFeedback, disabled
      ? 'Import geometry to adjust orientation.'
      : (documentState.geometry.orientation.operations.length ? documentState.geometry.orientation.operations.join(' · ') : 'Original orientation.'));
  };

  AnalysisAuthoringUI.prototype.openInspectorRow = function (kind, itemId, opener) {
    var selectedItem;
    if (this.activeInspectorKind === kind && this.activeInspectorItemId === itemId) {
      this.closeInspectorRow({ restoreFocus: true, cancelEdit: true });
      return;
    }
    if (this.activeInspectorKind === 'support') { this.resetSupportForm(false); }
    if (this.activeInspectorKind === 'load') { this.resetLoadForm(false); }
    this.returnEditorsToStash();
    if (kind === 'support' && itemId === 'new') { this.resetSupportForm(false); }
    if (kind === 'load' && itemId === 'new') { this.resetLoadForm(false); }
    this.activeInspectorKind = kind;
    this.activeInspectorItemId = itemId;
    this.activeInspectorFocusReturn = opener || null;
    if (kind === 'support') { selectedItem = this.controller.document.boundaryConditions.find(function (item) { return item.id === itemId; }); }
    if (kind === 'load') { selectedItem = this.controller.document.loads.find(function (item) { return item.id === itemId; }); }
    this.announceSetup('Editing ' + (selectedItem ? selectedItem.name : (itemId === 'new' ? 'new ' + kind : (kind === 'model' ? 'model and material' : kind))) + '.');
    if (kind === 'support' && itemId !== 'new') { this.beginSupportEdit(itemId); }
    else if (kind === 'load' && itemId !== 'new') { this.beginLoadEdit(itemId); }
    else { this.render(this.controller.document); }
  };

  AnalysisAuthoringUI.prototype.returnEditorsToStash = function () {
    var stash = this.setupFormStash;
    if (!stash) { return; }
    ['material-editor', 'support-editor', 'load-editor', 'gravity-editor'].forEach(function (id) {
      var editor = byId(id);
      if (editor && editor.parentElement !== stash) { stash.append(editor); }
    });
  };

  AnalysisAuthoringUI.prototype.closeInspectorRow = function (options) {
    var kind = this.activeInspectorKind;
    var itemId = this.activeInspectorItemId;
    var restoreFocus = options && options.restoreFocus;
    if (options && options.cancelEdit) {
      if (kind === 'support') { this.resetSupportForm(false); }
      if (kind === 'load') { this.resetLoadForm(false); }
    }
    this.returnEditorsToStash();
    this.activeInspectorKind = null;
    this.activeInspectorItemId = null;
    this.activeInspectorFocusReturn = null;
    this.render(this.controller.document);
    if (options && options.message) { this.announceSetup(options.message); }
    else if (options && options.cancelEdit) { this.announceSetup('Editing cancelled.'); }
    if (restoreFocus) {
      var selector = '[data-setup-kind="' + kind + '"][data-item-id="' + itemId + '"] [data-setup-row-trigger]';
      var target = document.querySelector(selector);
      if (!target) { target = kind === 'support' ? this.addSupportButton : (kind === 'load' || kind === 'gravity' ? this.addLoadButton : null); }
      if (target) { target.focus(); }
    }
  };

  AnalysisAuthoringUI.prototype.handleDocumentKeyDown = function (event) {
    if (!event || event.key !== 'Escape' || event.defaultPrevented || !this.activeInspectorKind) { return false; }
    this.closeInspectorRow({ restoreFocus: true, cancelEdit: true });
    event.preventDefault();
    return true;
  };

  AnalysisAuthoringUI.prototype.mountInlineEditor = function (kind, itemId) {
    var host = document.querySelector('[data-setup-kind="' + kind + '"][data-item-id="' + itemId + '"] [data-setup-editor-host]');
    var editor = byId(kind === 'model' ? 'material-editor' : (kind + '-editor'));
    if (!host || !editor) { return; }
    host.append(editor);
    if (kind === 'load' && itemId === 'new') { host.append(byId('gravity-editor')); }
  };

  AnalysisAuthoringUI.prototype.renderSetupInspector = function (documentState) {
    var self = this;
    var groups;
    if (!this.setupModelList || !root.SpjutsimFEA.buildSetupInspectorRows) { return; }
    this.returnEditorsToStash();
    groups = { model: this.setupModelList, support: this.setupSupportList, load: this.setupLoadList, gravity: this.setupLoadList };
    this.setupModelList.replaceChildren();
    this.setupSupportList.replaceChildren();
    this.setupLoadList.replaceChildren();
    var definitions = root.SpjutsimFEA.buildSetupInspectorRows(documentState).slice();
    if (this.activeInspectorItemId === 'new') {
      definitions.push({
        kind: this.activeInspectorKind, itemId: 'new',
        primaryText: this.activeInspectorKind === 'support' ? 'New support' : 'New load',
        secondaryText: this.activeInspectorKind === 'support' ? 'Selected CAD faces' : 'Pressure or total force',
        metaText: 'Not saved', ariaLabel: this.activeInspectorKind === 'support' ? 'New support' : 'New load'
      });
    }
    definitions.forEach(function (definition) {
      var list = groups[definition.kind];
      var item = document.createElement('li');
      var trigger = document.createElement('button');
      var primary = document.createElement('strong');
      var summary = document.createElement('span');
      var meta = document.createElement('span');
      var editorHost = document.createElement('div');
      var active = self.activeInspectorKind === definition.kind && self.activeInspectorItemId === definition.itemId;
      var editorId = 'setup-editor-' + definition.kind + '-' + definition.itemId;
      item.className = 'fea-setup-row';
      item.dataset.setupRow = '';
      item.dataset.setupKind = definition.kind;
      item.dataset.itemId = definition.itemId;
      trigger.type = 'button';
      trigger.className = 'fea-setup-row-button';
      trigger.dataset.setupRowTrigger = '';
      trigger.setAttribute('aria-label', definition.ariaLabel);
      trigger.setAttribute('aria-expanded', String(active));
      trigger.setAttribute('aria-controls', editorId);
      primary.textContent = definition.primaryText;
      summary.className = 'fea-setup-row-summary'; summary.textContent = definition.secondaryText;
      meta.className = 'fea-setup-row-meta'; meta.textContent = definition.metaText;
      trigger.append(primary, summary, meta);
      trigger.addEventListener('click', function () { self.openInspectorRow(definition.kind, definition.itemId, trigger); });
      editorHost.id = editorId;
      editorHost.className = 'fea-setup-editor';
      editorHost.dataset.setupEditorHost = '';
      editorHost.hidden = !active;
      item.append(trigger, editorHost);
      list.append(item);
    });
    [
      { list: this.setupSupportList, kind: 'support', text: 'No supports.' },
      { list: this.setupLoadList, kind: 'load', text: 'No loads.' }
    ].forEach(function (emptyState) {
      if (emptyState.list && !emptyState.list.children.length) {
        var empty = document.createElement('li');
        empty.className = 'fea-empty-list'; empty.textContent = emptyState.text; emptyState.list.append(empty);
      }
    });
    if (this.activeInspectorKind) { this.mountInlineEditor(this.activeInspectorKind, this.activeInspectorItemId); }
  };

  AnalysisAuthoringUI.prototype.render = function (documentState) {
    if (!this.materialForm) { return; }
    this.renderMaterial(documentState);
    this.renderSupports(documentState);
    this.renderLoads(documentState);
    this.renderGravity(documentState);
    this.renderModelOrientation(documentState);
    this.renderSetupInspector(documentState);
  };

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.AnalysisAuthoringUI = AnalysisAuthoringUI;
}(globalThis));
