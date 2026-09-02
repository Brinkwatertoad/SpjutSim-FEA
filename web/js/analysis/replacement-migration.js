(function (root) {
  'use strict';

  function cloneValue(value) {
    var copy;
    if (Array.isArray(value)) { return value.map(cloneValue); }
    if (!value || typeof value !== 'object') { return value; }
    copy = {};
    Object.keys(value).forEach(function (key) { copy[key] = cloneValue(value[key]); });
    return copy;
  }

  function migrationError(code, message) {
    var error = new Error(message);
    error.diagnostic = { code: code, stage: 'replacement-migration', userMessage: message, recoverable: true };
    return error;
  }

  function validateNewFaces(draft, faceIds) {
    var known = new Set(draft.newGeometry.faceIds);
    var unique = [];
    if (!Array.isArray(faceIds) || !faceIds.length || faceIds.some(function (faceId) {
      if (typeof faceId !== 'string' || !known.has(faceId) || unique.indexOf(faceId) !== -1) { return true; }
      unique.push(faceId); return false;
    })) {
      throw migrationError('INVALID_REPLACEMENT_MAPPING', 'Select one or more unique faces that exist on the replacement model.');
    }
    return unique;
  }

  function createReplacementMigrationDraft(documentState, newGeometry, newSource) {
    var geometryValidation = root.SpjutsimFEA.validateGeometryModel(newGeometry);
    var orientedGeometry = newGeometry;
    var oldOrientation = documentState.geometry && documentState.geometry.orientation;
    var items = [];
    if (!geometryValidation.valid) { throw migrationError('INVALID_REPLACEMENT_GEOMETRY', 'The replacement model is invalid.'); }
    if (!newSource || typeof newSource.sourceName !== 'string' || newSource.sourceFormat !== newGeometry.sourceFormat ||
        root.SpjutsimFEA.sourceFormatForFilename(newSource.sourceName) !== newSource.sourceFormat ||
        !(newSource.sourceBytes instanceof ArrayBuffer) || !newSource.sourceBytes.byteLength) {
      throw migrationError('INVALID_REPLACEMENT_SOURCE', 'The replacement model needs a valid non-empty CAD source.');
    }
    if (oldOrientation && oldOrientation.operations.length) {
      orientedGeometry = root.SpjutsimFEA.applyRotationToGeometry(newGeometry, oldOrientation.rotation, null);
      orientedGeometry = Object.assign({}, orientedGeometry, {
        orientation: { rotation: oldOrientation.rotation.slice(), operations: oldOrientation.operations.slice() }
      });
    }
    (documentState.boundaryConditions || []).forEach(function (item) {
      items.push({ kind: 'support', id: item.id, name: item.name, original: cloneValue(item), oldFaceIds: item.faceIds.slice(), decision: 'pending', newFaceIds: [] });
    });
    (documentState.loads || []).forEach(function (item) {
      items.push({ kind: 'load', id: item.id, name: item.name, original: cloneValue(item), oldFaceIds: item.faceIds.slice(), decision: 'pending', newFaceIds: [] });
    });
    return {
      oldGeometry: documentState.geometry,
      newGeometry: orientedGeometry,
      newSource: newSource,
      items: items,
      material: cloneValue(documentState.material),
      gravity: cloneValue(documentState.gravity),
      meshSettings: cloneValue(documentState.meshSettings),
      solveSettings: cloneValue(documentState.solveSettings),
      viewportPreferences: {
        displayStyle: documentState.viewportPresentation && documentState.viewportPresentation.displayStyle || 'lines',
        userDeformationScale: documentState.viewportPresentation && documentState.viewportPresentation.userDeformationScale || 100
      }
    };
  }

  function migrationItem(draft, itemIndex) {
    if (!draft || !Array.isArray(draft.items) || !Number.isInteger(itemIndex) || !draft.items[itemIndex]) {
      throw migrationError('INVALID_REPLACEMENT_ITEM', 'Choose a valid support or load to map.');
    }
    return draft.items[itemIndex];
  }

  function mapReplacementMigrationItem(draft, itemIndex, faceIds) {
    var item = migrationItem(draft, itemIndex);
    item.newFaceIds = validateNewFaces(draft, faceIds);
    item.decision = 'mapped';
    return item;
  }

  function dropReplacementMigrationItem(draft, itemIndex) {
    var item = migrationItem(draft, itemIndex);
    item.newFaceIds = [];
    item.decision = 'dropped';
    return item;
  }

  function replacementMigrationSummary(draft) {
    var mapped = 0;
    var dropped = 0;
    var pending = 0;
    draft.items.forEach(function (item) {
      if (item.decision === 'mapped') { mapped += 1; }
      else if (item.decision === 'dropped') { dropped += 1; }
      else { pending += 1; }
    });
    return { total: draft.items.length, mapped: mapped, dropped: dropped, pending: pending, complete: pending === 0 };
  }

  function buildReplacementMigrationTransfer(draft) {
    var summary = replacementMigrationSummary(draft);
    var supports = [];
    var loads = [];
    var dropped = [];
    if (!summary.complete) { throw migrationError('INCOMPLETE_REPLACEMENT_MAPPING', 'Map or drop every support and load before applying the replacement.'); }
    draft.items.forEach(function (item) {
      var candidate;
      var validation;
      if (item.decision === 'dropped') { dropped.push({ kind: item.kind, id: item.id, name: item.name }); return; }
      candidate = Object.assign({}, cloneValue(item.original), { faceIds: item.newFaceIds.slice() });
      validation = item.kind === 'support'
        ? root.SpjutsimFEA.validateBoundaryCondition(candidate, draft.newGeometry.faceIds)
        : root.SpjutsimFEA.validateLoad(candidate, draft.newGeometry.faceIds);
      if (!validation.valid) { throw migrationError('INVALID_REPLACEMENT_MAPPING', root.SpjutsimFEA.firstValidationMessage(validation)); }
      (item.kind === 'support' ? supports : loads).push(validation.value);
    });
    return {
      material: cloneValue(draft.material), gravity: cloneValue(draft.gravity),
      meshSettings: cloneValue(draft.meshSettings), solveSettings: cloneValue(draft.solveSettings),
      viewportPreferences: cloneValue(draft.viewportPreferences), boundaryConditions: supports, loads: loads,
      droppedItems: dropped
    };
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.createReplacementMigrationDraft = createReplacementMigrationDraft;
  root.SpjutsimFEA.mapReplacementMigrationItem = mapReplacementMigrationItem;
  root.SpjutsimFEA.dropReplacementMigrationItem = dropReplacementMigrationItem;
  root.SpjutsimFEA.replacementMigrationSummary = replacementMigrationSummary;
  root.SpjutsimFEA.buildReplacementMigrationTransfer = buildReplacementMigrationTransfer;
}(globalThis));
