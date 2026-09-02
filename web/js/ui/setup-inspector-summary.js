(function (root) {
  'use strict';

  function formatNumber(value) {
    var rounded = Number(Number(value).toPrecision(8));
    return String(rounded).replace('-', '−');
  }

  function faceCountText(faceIds) {
    var count = Array.isArray(faceIds) ? faceIds.length : 0;
    return count + (count === 1 ? ' face' : ' faces');
  }

  function row(kind, itemId, primaryText, secondaryText, metaText) {
    return Object.freeze({
      kind: kind,
      itemId: itemId,
      primaryText: primaryText,
      secondaryText: secondaryText,
      metaText: metaText,
      ariaLabel: [primaryText, secondaryText, metaText].filter(Boolean).join('. ')
    });
  }

  function summarizeModelRow(documentState) {
    var geometry = documentState.geometry;
    var material = documentState.material;
    if (!geometry) { return row('model', 'model', 'No model', material ? (material.name || 'Unnamed material') : 'No material', 'Import a CAD solid'); }
    return row(
      'model',
      'model',
      geometry.sourceName,
      (material ? (material.name || 'Unnamed material') : 'No material') + ' · ' + String(geometry.sourceFormat || '').toUpperCase(),
      faceCountText(geometry.faceIds)
    );
  }

  function summarizeSupportRow(item) {
    var components;
    if (item.type === 'fixed') {
      components = 'Fixed · X, Y, Z';
    } else {
      components = ['x', 'y', 'z'].filter(function (axis) {
        return item['u' + axis + 'M'] !== undefined;
      }).map(function (axis) {
        var valueMm = root.SpjutsimFEA.siToDisplay('displacementM', item['u' + axis + 'M']);
        return axis.toUpperCase() + ' ' + formatNumber(valueMm) + ' mm';
      }).join(' · ');
    }
    return row('support', item.id, item.name, components, faceCountText(item.faceIds));
  }

  function summarizeLoadRow(item) {
    var summary;
    if (item.type === 'pressure') {
      summary = 'Pressure · ' + formatNumber(root.SpjutsimFEA.siToDisplay('pressurePa', item.pressurePa)) + ' MPa';
    } else {
      summary = 'Force · [' + item.forceN.map(formatNumber).join(', ') + '] N';
    }
    return row('load', item.id, item.name, summary, faceCountText(item.faceIds));
  }

  function summarizeGravityRow(gravity) {
    return row('gravity', 'gravity', 'Gravity', '[' + gravity.accelerationMS2.map(formatNumber).join(', ') + '] m/s²', 'Body load');
  }

  function buildSetupInspectorRows(documentState) {
    var rows = [summarizeModelRow(documentState)];
    documentState.boundaryConditions.forEach(function (item) { rows.push(summarizeSupportRow(item)); });
    documentState.loads.forEach(function (item) { rows.push(summarizeLoadRow(item)); });
    if (documentState.gravity && documentState.gravity.enabled) { rows.push(summarizeGravityRow(documentState.gravity)); }
    return Object.freeze(rows);
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.buildSetupInspectorRows = buildSetupInspectorRows;
}(globalThis));
