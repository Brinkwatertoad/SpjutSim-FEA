(function (root) {
  'use strict';

  function formatNumber(value) {
    var rounded = Number(Number(value).toPrecision(8));
    return String(rounded).replace('-', '−');
  }

  function quantity(value, key) { return formatNumber(root.SpjutsimFEA.preferredFromSI(key,value)) + ' ' + root.SpjutsimFEA.preferredUnit(key); }

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
    if (!geometry) { return row('model', 'model', 'Import model…', 'STEP, IGES, BREP, or STL solid', 'No model'); }
    return row(
      'model',
      'model',
      geometry.sourceName,
      String(geometry.sourceFormat || '').toUpperCase(),
      faceCountText(geometry.faceIds)
    );
  }

  function summarizeMaterialRow(documentState) {
    var material = documentState.material;
    if (!material) { return row('material', 'material', 'Add material…', '', 'No material'); }
    return row('material', 'material', material.name || 'Unnamed material',
      'E: ' + quantity(material.youngsModulusPa,'youngsModulusPa'),
      material.densityKgM3 ? quantity(material.densityKgM3,'densityKgM3') : 'Density not set');
  }

  function summarizeSupportRow(item) {
    var fixed = ['x', 'y', 'z'].every(function (axis) { return item.componentsM[axis] === 0; });
    var components = ['x', 'y', 'z'].filter(function (axis) {
      return item.componentsM[axis] !== undefined;
    }).map(function (axis) {
      return axis.toUpperCase() + ' ' + quantity(item.componentsM[axis],'displacementM');
    }).join(' · ');
    if (fixed) { components = 'Fixed · X, Y, Z'; }
    return row('support', item.id, item.name, components, faceCountText(item.faceIds));
  }

  function summarizeLoadRow(item) {
    var summary;
    if (item.type === 'pressure') {
      summary = 'Pressure · ' + quantity(item.pressurePa,'pressurePa');
    } else if (item.direction === 'surface-normal') {
      summary='Force · '+quantity(item.magnitudeN,'forceN')+' · '+item.sense+' normal';
    } else {
      summary = 'Force · [' + item.forceN.map(function(v){return formatNumber(root.SpjutsimFEA.preferredFromSI('forceN',v));}).join(', ') + '] ' + root.SpjutsimFEA.preferredUnit('forceN');
    }
    return row('load', item.id, item.name, summary, faceCountText(item.faceIds));
  }

  function summarizeGravityRow(gravity) {
    return row('gravity', 'gravity', 'Gravity', '[' + gravity.accelerationMS2.map(function(v){return formatNumber(root.SpjutsimFEA.preferredFromSI('accelerationMS2',v));}).join(', ') + '] ' + root.SpjutsimFEA.preferredUnit('accelerationMS2'), 'Body load');
  }

  function summarizeMeshRow(documentState) {
    var settings = documentState.meshSettings || { preset: 'normal', elementType: 'tet10' };
    var preset = settings.preset.charAt(0).toUpperCase() + settings.preset.slice(1);
    var elementLabel = settings.elementType === 'tet10' ? 'Tet10' : 'Tet4';
    var metadata = documentState.meshMetadata;
    if (documentState.meshGeneration && documentState.meshGeneration.status === 'generating') { return row('mesh','mesh','Mesh','Generating…',preset); }
    if (!metadata) { return row('mesh', 'mesh', 'Mesh', 'Not generated · ' + elementLabel, preset); }
    return row('mesh', 'mesh', 'Mesh', metadata.statistics.elementCount + ' ' + elementLabel + ' elements',
      metadata.statistics.nodeCount + ' nodes · ' + preset);
  }

  function buildSetupInspectorRows(documentState) {
    var rows = [summarizeModelRow(documentState), summarizeMaterialRow(documentState)];
    if (!documentState.boundaryConditions.length) { rows.push(row('support','new','Add support…','','')); }
    documentState.boundaryConditions.forEach(function (item) { rows.push(summarizeSupportRow(item)); });
    if (!documentState.loads.length) { rows.push(row('load','new','Add load…','','')); }
    documentState.loads.forEach(function (item) { rows.push(summarizeLoadRow(item)); });
    if (documentState.gravity && documentState.gravity.enabled) { rows.push(summarizeGravityRow(documentState.gravity)); }
    rows.push(summarizeMeshRow(documentState));
    return Object.freeze(rows);
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.buildSetupInspectorRows = buildSetupInspectorRows;
}(globalThis));
