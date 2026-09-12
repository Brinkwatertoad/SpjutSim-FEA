(function (root) {
  'use strict';
  var api = root.SpjutsimFEA, prototype = api.AppController.prototype;
  function copy(value) { return root.structuredClone(value); }
  function collection(state, kind) { return kind === 'support' ? state.boundaryConditions : state.loads; }
  function signature(draft) { return JSON.stringify({faceIds:draft.faceIds.slice().sort(),definition:draft.definition}); }
  function requireDraft(controller) {
    if (!controller.document.assignmentDraft) { throw new Error('Open a support or load preview first.'); }
    return controller.document.assignmentDraft;
  }
  function validateDraft(controller) {
    var state = controller.document, draft = requireDraft(controller);
    if (draft.baseAnalysisRevision !== state.analysisRevision || draft.geometryId !== (state.geometry && state.geometry.geometryId)) {
      return {valid:false,message:'The model changed during this preview. Cancel and reopen the editor.'};
    }
    if (draft.kind === 'gravity') {
      var gravity = api.validateGravity(draft.definition,state.material);
      return gravity.valid ? {valid:true,value:gravity.value} : {valid:false,message:api.firstValidationMessage(gravity)};
    }
    var candidate = Object.assign({}, draft.definition, {id:draft.itemId || 'preview',name:draft.definition.name === undefined ? 'Preview' : draft.definition.name,faceIds:draft.faceIds});
    var validation = (draft.kind === 'support' ? api.validateBoundaryCondition : api.validateLoad)(candidate,state.geometry && state.geometry.faceIds);
    if (!validation.valid) { return {valid:false,message:api.firstValidationMessage(validation)}; }
    if (draft.kind === 'support') {
      var conflict = state.boundaryConditions.some(function (item) {
        return item.id !== draft.itemId && item.faceIds.some(function (id) { return draft.faceIds.indexOf(id) >= 0; }) &&
          ['x','y','z'].some(function (axis) { return item.componentsM[axis] !== undefined && candidate.componentsM[axis] !== undefined && item.componentsM[axis] !== candidate.componentsM[axis]; });
      });
      if (conflict) { return {valid:false,message:'Conflicting prescribed components share a face. Edit the existing support or choose other faces.'}; }
    }
    return {valid:true,value:validation.value};
  }
  prototype.refreshAssignmentDraft = function () {
    var draft = requireDraft(this);
    draft.dirty = signature(draft) !== this.assignmentDraftInitialSignature || (!draft.itemId && draft.faceIds.length > 0);
    var validation = validateDraft(this);
    draft.validation = validation;
    return draft;
  };
  /** Begin one transient transaction. kind is support/load/gravity; itemId null adds; definition is SI data. */
  prototype.beginAssignmentDraft = function (kind, itemId, definition) {
    if (['support','load','gravity'].indexOf(kind) < 0) { throw new Error('Choose a support or load editor.'); }
    if (api.engineeringBusy(this.document)) { throw new Error('Wait for the current operation or cancel it before editing.'); }
    if (!this.document.geometry) { throw new Error('Import geometry before adding assignments.'); }
    if (this.document.assignmentDraft) {
      if (this.document.assignmentDraft.dirty) { throw new Error('Apply or Cancel the current preview before opening another editor.'); }
      this.cancelAssignmentDraft();
    }
    var item = kind === 'gravity' ? (itemId && this.document.gravity.enabled ? this.document.gravity : null) : itemId ? collection(this.document,kind).find(function (value) { return value.id === itemId; }) : null;
    if (itemId && !item) { throw new Error('This assignment no longer exists.'); }
    this.assignmentDraftReturn = {presentation:copy(this.document.viewportPresentation),selectedFaceIds:this.document.selectedFaceIds.slice()};
    var initial = copy(item || definition || (kind === 'gravity' ? Object.assign({},this.document.gravity,{enabled:true}) : kind === 'support' ? {type:'support',componentsM:{x:0,y:0,z:0}} : {type:'pressure',pressurePa:1e6}));
    delete initial.faceIds; delete initial.id;
    this.document.assignmentDraft = {kind:kind,itemId:itemId || null,faceIds:kind === 'gravity' ? [] : item ? item.faceIds.slice() : this.document.selectedFaceIds.slice(),definition:initial,
      baseAnalysisRevision:this.document.analysisRevision,geometryId:this.document.geometry.geometryId};
    this.assignmentDraftInitialSignature = signature(this.document.assignmentDraft);
    if (['stress','deformation'].indexOf(this.document.viewportPresentation.mode) >= 0) {
      this.document.viewportPresentation = Object.assign({},this.document.viewportPresentation,{mode:this.document.mesh ? 'mesh' : 'model'});
    }
    this.refreshAssignmentDraft(); this.notify();
    return this.document.assignmentDraft;
  };
  /** Replace supplied definition/faceIds without committing. Incomplete values remain in the draft. */
  prototype.updateAssignmentDraft = function (patch) {
    var draft = requireDraft(this);
    if (patch.faceIds !== undefined) {
      if (!Array.isArray(patch.faceIds)) { throw new Error('Selected faces must be an array.'); }
      draft.faceIds = patch.faceIds.slice();
    }
    if (patch.definition !== undefined) {
      var definition = copy(patch.definition);
      if (definition.name === undefined && draft.definition.name !== undefined) { definition.name = draft.definition.name; }
      delete definition.id; delete definition.faceIds;
      draft.definition = definition;
    }
    this.refreshAssignmentDraft(); this.notify();
  };
  /** Toggle one known FaceId. Background clicks deliberately do not call this command. */
  prototype.toggleDraftFace = function (faceId) {
    var draft = requireDraft(this);
    if (!this.document.geometry || this.document.geometry.faceIds.indexOf(faceId) < 0) { throw new Error('Unknown CAD face identifier.'); }
    if (draft.kind === 'gravity') { return; }
    var faces = draft.faceIds.slice(), index = faces.indexOf(faceId);
    if (index < 0) { faces.push(faceId); } else { faces.splice(index,1); }
    this.updateAssignmentDraft({faceIds:faces});
  };
  /** Validate and commit once through existing assignment commands; unchanged edits are no-ops. */
  prototype.commitAssignmentDraft = function () {
    var draft = this.refreshAssignmentDraft(), validation = draft.validation;
    if (!validation.valid) { this.notify(); throw new Error(validation.message); }
    var existing = draft.kind === 'gravity' ? this.document.gravity : draft.itemId && collection(this.document,draft.kind).find(function (item) { return item.id === draft.itemId; });
    if (existing && api.sameEngineeringDefinition(existing,validation.value)) {
      var unchangedId = draft.itemId; this.cancelAssignmentDraft(); this.clearSelectedFaces(); return unchangedId;
    }
    var selected = this.document.selectedFaceIds, revision = this.document.analysisRevision;
    this.document.selectedFaceIds = draft.faceIds.slice();
    // Clear transient state before notifying subscribers of the committed edit.
    this.document.assignmentDraft = null;
    try {
      var id = draft.itemId;
      if (!id && draft.definition.name === undefined) { delete validation.value.name; }
      if (draft.kind === 'gravity') {
        this.replaceGravity(validation.value); id = 'gravity';
      } else if (draft.kind === 'support') {
        if (id) { this.replaceBoundaryCondition(id, validation.value); } else { id = this.createBoundaryCondition(validation.value); }
      } else {
        if (id) { this.replaceLoad(id, validation.value); } else { id = this.createLoad(validation.value); }
      }
      if (this.document.analysisRevision === revision) {
        this.document.assignmentDraft = draft; this.cancelAssignmentDraft();
      } else { this.assignmentDraftReturn = null; }
      this.clearSelectedFaces();
      return id;
    } catch (error) {
      this.document.assignmentDraft = draft; this.document.selectedFaceIds = selected; throw error;
    }
  };
  /** Cancel never changes an analysis revision, assignment, mesh, preflight, or result. */
  prototype.cancelAssignmentDraft = function () {
    if (!this.document.assignmentDraft) { return; }
    var previous = this.assignmentDraftReturn;
    this.document.assignmentDraft = null; this.assignmentDraftReturn = null;
    if (previous) {
      this.document.selectedFaceIds = previous.selectedFaceIds.filter(function (id) { return this.document.geometry && this.document.geometry.faceIds.indexOf(id) >= 0; },this);
      var presentation = previous.presentation;
      if (['stress','deformation'].indexOf(presentation.mode) >= 0 && !this.document.results) { presentation.mode = this.document.mesh ? 'mesh' : 'model'; }
      if (presentation.mode === 'mesh' && !this.document.mesh) { presentation.mode = 'model'; }
      this.document.viewportPresentation = presentation;
    }
    this.notify();
  };
}(globalThis));
