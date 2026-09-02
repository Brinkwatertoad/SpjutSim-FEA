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
    if (!geometry) { return row('model', 'model', 'Import CAD…', 'STEP, IGES, or BREP solid', 'No model'); }
    return row(
      'model',
      'model',
      geometry.sourceName,
      String(geometry.sourceFormat || '').toUpperCase(),
      faceCountText(geometry.faceIds) + ' · ' + (geometry.orientation.operations.length ? geometry.orientation.operations.join(' · ') : 'Original orientation')
    );
  }

  function summarizeMaterialRow(documentState) {
    var material = documentState.material;
    if (!material) { return row('material', 'material', 'Add material…', 'Required before solving', 'No material'); }
    return row('material', 'material', material.name || 'Unnamed material',
      formatNumber(material.youngsModulusPa / 1e9) + ' GPa · ν ' + formatNumber(material.poissonsRatio),
      material.densityKgM3 ? formatNumber(material.densityKgM3) + ' kg/m³' : 'Density not set');
  }

  function summarizeSupportRow(item) {
    var fixed = ['x', 'y', 'z'].every(function (axis) { return item.componentsM[axis] === 0; });
    var components = ['x', 'y', 'z'].filter(function (axis) {
      return item.componentsM[axis] !== undefined;
    }).map(function (axis) {
      var valueMm = root.SpjutsimFEA.siToDisplay('displacementM', item.componentsM[axis]);
      return axis.toUpperCase() + ' ' + formatNumber(valueMm) + ' mm';
    }).join(' · ');
    if (fixed) { components = 'Fixed · X, Y, Z'; }
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

  function summarizeMeshRow(documentState) {
    var settings = documentState.meshSettings || { preset: 'normal' };
    var preset = settings.preset.charAt(0).toUpperCase() + settings.preset.slice(1);
    var metadata = documentState.meshMetadata;
    if (!metadata) { return row('mesh', 'mesh', 'Mesh', 'Not generated', preset); }
    return row('mesh', 'mesh', 'Mesh', metadata.statistics.elementCount + ' Tet4 elements',
      metadata.statistics.nodeCount + ' nodes · ' + preset);
  }

  function buildSetupInspectorRows(documentState) {
    var rows = [summarizeModelRow(documentState), summarizeMaterialRow(documentState)];
    documentState.boundaryConditions.forEach(function (item) { rows.push(summarizeSupportRow(item)); });
    documentState.loads.forEach(function (item) { rows.push(summarizeLoadRow(item)); });
    if (documentState.gravity && documentState.gravity.enabled) { rows.push(summarizeGravityRow(documentState.gravity)); }
    rows.push(summarizeMeshRow(documentState));
    return Object.freeze(rows);
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.buildSetupInspectorRows = buildSetupInspectorRows;
}(globalThis));
