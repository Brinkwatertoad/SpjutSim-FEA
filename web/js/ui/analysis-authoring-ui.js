(function (root) {
  'use strict';

  function byId(id) { return document.getElementById(id); }

  function AnalysisAuthoringUI(controller) {
    this.controller = controller;
    this.materialForm = byId('material-form');
    this.materialStatus = byId('material-status');
    this.removeMaterialButton = byId('remove-material-button');
    this.supportForm = byId('support-form');
    this.supportList = byId('support-list');
    this.supportStatus = byId('support-status');
    this.supportType = byId('support-type');
    this.prescribedFields = byId('prescribed-displacement-fields');
    this.cancelSupportEdit = byId('cancel-support-edit');
    this.loadForm = byId('load-form');
    this.loadList = byId('load-list');
    this.loadStatus = byId('load-status');
    this.loadType = byId('load-type');
    this.pressureFields = byId('pressure-fields');
    this.forceFields = byId('force-fields');
    this.cancelLoadEdit = byId('cancel-load-edit');
    this.gravityForm = byId('gravity-form');
    this.gravityStatus = byId('gravity-status');
    this.editingSupportId = null;
    this.editingLoadId = null;
    this.renderedMaterial = undefined;
    this.materialFeedback = null;
    this.supportFeedback = null;
    this.loadFeedback = null;
    this.gravityFeedback = null;
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

  AnalysisAuthoringUI.prototype.start = function () {
    var self = this;
    if (!this.materialForm) { return; }
    this.materialForm.addEventListener('submit', function (event) { event.preventDefault(); self.saveMaterial(); });
    this.removeMaterialButton.addEventListener('click', function () {
      try { self.controller.clearMaterial(); self.materialFeedback = null; self.render(self.controller.document); } catch (error) { self.materialFeedback = { error: true, message: error.message }; self.render(self.controller.document); }
    });
    this.supportForm.addEventListener('submit', function (event) { event.preventDefault(); self.saveSupport(); });
    this.supportType.addEventListener('change', function () { self.renderSupportType(); });
    this.cancelSupportEdit.addEventListener('click', function () { self.resetSupportForm(); });
    ['ux', 'uy', 'uz'].forEach(function (axis) {
      byId('support-' + axis + '-enabled').addEventListener('change', function () { self.renderSupportComponents(); });
    });
    this.loadForm.addEventListener('submit', function (event) { event.preventDefault(); self.saveLoad(); });
    this.loadType.addEventListener('change', function () { self.renderLoadType(); });
    this.cancelLoadEdit.addEventListener('click', function () { self.resetLoadForm(); });
    this.gravityForm.addEventListener('submit', function (event) { event.preventDefault(); self.saveGravity(); });
    this.renderSupportType();
    this.renderLoadType();
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
    try {
      var validation = this.controller.replaceMaterial(this.readMaterial());
      this.materialFeedback = validation.warnings.length
        ? { warning: true, message: validation.warnings[0].message }
        : { message: 'Material saved in SI units.' };
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
      byId('material-name').value = material && material.name || '';
      setOptionalDisplay('material-youngs', 'youngsModulusPa', material && material.youngsModulusPa);
      byId('material-poisson').value = material ? String(material.poissonsRatio) : '';
      setOptionalDisplay('material-density', 'densityKgM3', material && material.densityKgM3);
      setOptionalDisplay('material-tensile-yield', 'strengthPa', material && material.tensileYieldPa);
      setOptionalDisplay('material-compressive-yield', 'strengthPa', material && material.compressiveYieldPa);
      setOptionalDisplay('material-ultimate-tensile', 'strengthPa', material && material.ultimateTensilePa);
      setOptionalDisplay('material-ultimate-compressive', 'strengthPa', material && material.ultimateCompressivePa);
    }
    this.removeMaterialButton.disabled = !material;
    setFeedback(this.materialStatus, this.materialFeedback, material
      ? (material.name || 'Unnamed material') + ' · ' + root.SpjutsimFEA.siToDisplay('youngsModulusPa', material.youngsModulusPa) + ' GPa'
      : 'No material defined.');
  };

  AnalysisAuthoringUI.prototype.renderSupportType = function () {
    var prescribed = this.supportType.value === 'prescribed-displacement';
    this.prescribedFields.hidden = !prescribed;
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
      name: byId('support-name').value.trim(),
      type: this.supportType.value,
      faceIds: this.controller.document.selectedFaceIds.slice()
    };
    if (support.type === 'prescribed-displacement') {
      ['ux', 'uy', 'uz'].forEach(function (axis) {
        if (byId('support-' + axis + '-enabled').checked) {
          support[axis + 'M'] = root.SpjutsimFEA.displayToSI('displacementM', readNumber('support-' + axis, axis.toUpperCase() + ' displacement'));
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
      this.render(this.controller.document);
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
    byId('support-name').value = item.name;
    this.supportType.value = item.type;
    ['ux', 'uy', 'uz'].forEach(function (axis) {
      var value = item[axis + 'M'];
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
    this.supportType.value = 'fixed';
    this.supportForm.querySelector('button[type="submit"]').textContent = 'Add support';
    this.cancelSupportEdit.hidden = true;
    this.renderSupportType();
    if (renderNow !== false) { this.render(this.controller.document); }
  };

  AnalysisAuthoringUI.prototype.renderAnalysisList = function (list, items, select, remove) {
    list.replaceChildren();
    items.forEach(function (item) {
      var row = document.createElement('li');
      var choose = document.createElement('button');
      var deleteButton = document.createElement('button');
      choose.type = 'button'; choose.textContent = item.name + ' · ' + item.faceIds.length + (item.faceIds.length === 1 ? ' face' : ' faces');
      choose.setAttribute('aria-label', 'Select and edit ' + item.name);
      choose.addEventListener('click', function () { select(item.id); });
      deleteButton.type = 'button'; deleteButton.textContent = 'Remove'; deleteButton.dataset.actionIntent = 'danger';
      deleteButton.setAttribute('aria-label', 'Remove ' + item.name);
      deleteButton.addEventListener('click', function () { remove(item.id); });
      row.append(choose, deleteButton); list.append(row);
    });
  };

  AnalysisAuthoringUI.prototype.renderSupports = function (documentState) {
    var self = this;
    if (this.editingSupportId && !documentState.boundaryConditions.some(function (item) { return item.id === self.editingSupportId; })) {
      this.resetSupportForm(false);
    }
    this.renderAnalysisList(this.supportList, documentState.boundaryConditions,
      function (id) { self.beginSupportEdit(id); },
      function (id) { try { self.controller.removeBoundaryCondition(id); if (self.editingSupportId === id) { self.resetSupportForm(false); } self.supportFeedback = null; self.render(self.controller.document); } catch (error) { self.supportFeedback = { error: true, message: error.message }; self.render(self.controller.document); } });
    Array.from(this.supportForm.elements).forEach(function (control) { control.disabled = !documentState.geometry; });
    this.renderSupportComponents();
    setFeedback(this.supportStatus, this.supportFeedback, !documentState.geometry
      ? 'Import geometry and select faces to add a support.'
      : (documentState.boundaryConditions.length ? documentState.boundaryConditions.length + ' support item(s) defined.' : 'Select one or more faces, then add a support.'));
  };

  AnalysisAuthoringUI.prototype.renderLoadType = function () {
    var pressure = this.loadType.value === 'pressure';
    this.pressureFields.hidden = !pressure;
    this.forceFields.hidden = pressure;
  };

  AnalysisAuthoringUI.prototype.readLoad = function () {
    var load = { name: byId('load-name').value.trim(), type: this.loadType.value, faceIds: this.controller.document.selectedFaceIds.slice() };
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
      this.render(this.controller.document);
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
    byId('load-name').value = item.name;
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
    this.loadType.value = 'pressure';
    this.loadForm.querySelector('button[type="submit"]').textContent = 'Add load';
    this.cancelLoadEdit.hidden = true;
    this.renderLoadType();
    if (renderNow !== false) { this.render(this.controller.document); }
  };

  AnalysisAuthoringUI.prototype.renderLoads = function (documentState) {
    var self = this;
    if (this.editingLoadId && !documentState.loads.some(function (item) { return item.id === self.editingLoadId; })) {
      this.resetLoadForm(false);
    }
    this.renderAnalysisList(this.loadList, documentState.loads,
      function (id) { self.beginLoadEdit(id); },
      function (id) { try { self.controller.removeLoad(id); if (self.editingLoadId === id) { self.resetLoadForm(false); } self.loadFeedback = null; self.render(self.controller.document); } catch (error) { self.loadFeedback = { error: true, message: error.message }; self.render(self.controller.document); } });
    Array.from(this.loadForm.elements).forEach(function (control) { control.disabled = !documentState.geometry; });
    setFeedback(this.loadStatus, this.loadFeedback, !documentState.geometry
      ? 'Import geometry and select faces to add a load.'
      : (documentState.loads.length ? documentState.loads.length + ' load item(s) defined.' : 'Select one or more faces, then add a load.'));
  };

  AnalysisAuthoringUI.prototype.saveGravity = function () {
    try {
      this.controller.replaceGravity({
        enabled: byId('gravity-enabled').checked,
        accelerationMS2: ['x', 'y', 'z'].map(function (axis) { return readNumber('gravity-' + axis, 'gravity ' + axis.toUpperCase()); })
      });
      this.gravityFeedback = { message: byId('gravity-enabled').checked ? 'Gravity enabled.' : 'Gravity disabled.' };
      this.render(this.controller.document);
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

  AnalysisAuthoringUI.prototype.render = function (documentState) {
    if (!this.materialForm) { return; }
    this.renderMaterial(documentState);
    this.renderSupports(documentState);
    this.renderLoads(documentState);
    this.renderGravity(documentState);
  };

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.AnalysisAuthoringUI = AnalysisAuthoringUI;
}(globalThis));
