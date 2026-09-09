(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  function canonical(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') { return value; }
    if (typeof value === 'number' && Number.isFinite(value)) { return value; }
    if (Array.isArray(value)) { return value.map(canonical); }
    if (!value || Object.prototype.toString.call(value) !== '[object Object]' || (Object.getPrototypeOf(value) !== null && Object.getPrototypeOf(Object.getPrototypeOf(value)) !== null)) { throw new Error('History accepts only small plain definitions, never buffers or runtime objects.'); }
    var result = Object.create(null);
    Object.keys(value).sort().forEach(function (key) {
      if (value[key] !== undefined) { result[key] = key === 'faceIds' && Array.isArray(value[key]) ? canonical(value[key]).sort() : canonical(value[key]); }
    });
    return result;
  }
  function sameDefinition(first, second) { return JSON.stringify(canonical(first)) === JSON.stringify(canonical(second)); }
  function EngineeringHistory() { this.entries=[]; this.cursor=0; this.byteLength=0; }
  EngineeringHistory.prototype.clear = function () { this.entries=[]; this.cursor=0; this.byteLength=0; };
  EngineeringHistory.prototype.record = function (entry) {
    var data=canonical(entry), serialized=JSON.stringify(data), bytes=new TextEncoder().encode(serialized).byteLength;
    if (sameDefinition(data.before,data.after)) { return false; }
    while (this.entries.length > this.cursor) { this.byteLength -= this.entries.pop().bytes; }
    if (bytes > 2 * 1024 * 1024) { this.clear(); return false; }
    while (this.entries.length >= 50 || this.byteLength + bytes > 2 * 1024 * 1024) { this.byteLength -= this.entries.shift().bytes; this.cursor--; }
    data.bytes=bytes; this.entries.push(data); this.cursor++; this.byteLength+=bytes; return true;
  };
  api.EngineeringHistory=EngineeringHistory;
  api.sameEngineeringDefinition=sameDefinition;

  var prototype=api.AppController.prototype;
  prototype.recordEngineeringEdit = function (kind,before,after,label,index) {
    if (this.historyReplaying) { return; }
    this.history.record({kind:kind,before:before,after:after,label:label,index:index === undefined ? null : index,geometryId:this.document.geometry && this.document.geometry.geometryId});
    this.historyNotice=label + '.';
  };
  prototype.clearEngineeringHistory = function () {
    this.history.clear(); this.historyNotice='History cleared for the imported model. Import, replacement, and removal start a new history.';
  };
  prototype.historyState = function () {
    var enabled=!api.engineeringBusy(this.document) && !this.document.assignmentDraft;
    var undo=this.history.entries[this.history.cursor-1], redo=this.history.entries[this.history.cursor];
    return {canUndo:Boolean(enabled && undo),canRedo:Boolean(enabled && redo),undoLabel:undo ? undo.label : '',redoLabel:redo ? redo.label : '',
      message:this.document.assignmentDraft ? 'Apply or Cancel the preview before Undo/Redo.' : api.engineeringBusy(this.document) ? 'Undo/Redo is unavailable during worker execution.' : ((this.document.results || api.solveReadiness(this.document).canSolve) ? this.historyNotice.split('. ')[0] + '.' : this.historyNotice)};
  };
  /** Restore a deleted item with its original identity/order; never rewind ID/name allocators. */
  prototype.restoreHistoryAssignment = function (kind,item,index) {
    var items=kind === 'support' ? this.document.boundaryConditions : this.document.loads;
    var validation=(kind === 'support' ? api.validateBoundaryCondition : api.validateLoad)(item,this.document.geometry && this.document.geometry.faceIds);
    if (!validation.valid) { throw new Error(api.firstValidationMessage(validation)); }
    if (items.some(function(existing){return existing.id===item.id;})) { throw new Error('The assignment identifier already exists.'); }
    items.splice(Math.min(index,items.length),0,validation.value);
    if (kind === 'support') { this.refreshConstraintStability(); }
    this.invalidateResults(kind === 'support' ? 'boundary-conditions' : 'loads'); this.notify();
  };
  prototype.applyHistoryDefinition = function (entry,value) {
    if (entry.geometryId !== (this.document.geometry && this.document.geometry.geometryId)) { throw new Error('This history belongs to a different imported model.'); }
    if (entry.kind === 'support' || entry.kind === 'load') {
      var items=entry.kind === 'support' ? this.document.boundaryConditions : this.document.loads;
      var id=(entry.before || entry.after).id;
      var exists=items.some(function(item){return item.id===id;});
      if (value === null) {
        if (entry.kind === 'support') { this.removeBoundaryCondition(id); } else { this.removeLoad(id); }
      } else if (!exists) { this.restoreHistoryAssignment(entry.kind,value,entry.index); }
      else if (entry.kind === 'support') { this.replaceBoundaryCondition(id,value); } else { this.replaceLoad(id,value); }
    } else if (entry.kind === 'material') {
      if (value === null) { this.clearMaterial(); } else { this.replaceMaterial(value); }
    } else if (entry.kind === 'gravity') { this.replaceGravity(value); }
    else if (entry.kind === 'meshSettings') { this.replaceMeshSettings(value); }
    else if (entry.kind === 'orientation') {
      this.replaceOrientedGeometry(api.restoreGeometryOrientation(this.document.geometry,value));
    } else { throw new Error('Unsupported engineering history command.'); }
  };
  prototype.moveEngineeringHistory = function (direction) {
    var state=this.historyState();
    if (!(direction < 0 ? state.canUndo : state.canRedo)) { throw new Error(state.message || 'No engineering edit is available.'); }
    var entry=this.history.entries[this.history.cursor + (direction < 0 ? -1 : 0)];
    var oldNotice=this.historyNotice, oldRevision=this.document.analysisRevision;
    this.history.cursor+=direction; this.historyReplaying=true;
    try {
      this.applyHistoryDefinition(entry,direction < 0 ? entry.before : entry.after);
      this.historyNotice=(direction < 0 ? 'Undid ' : 'Redid ') + entry.label +
        (this.document.analysisRevision === oldRevision ? '. Numerical results unchanged.' :
        (entry.kind === 'orientation' || entry.kind === 'meshSettings' ? '. Generate a mesh and check again.' : '. Results cleared; Check model again.'));
    } catch(error) { this.history.cursor-=direction; this.historyNotice=oldNotice; throw error; }
    finally { this.historyReplaying=false; }
    this.notify();
  };
  prototype.undoEngineeringEdit = function () { this.moveEngineeringHistory(-1); };
  prototype.redoEngineeringEdit = function () { this.moveEngineeringHistory(1); };
}(globalThis));
