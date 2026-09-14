(function (root) {
  'use strict';
  var api = root.SpjutsimFEA = root.SpjutsimFEA || {};
  var crcTable = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var bit = 0; bit < 8; bit++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
    crcTable[n] = c;
  }
  function crc32(bytes) {
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) { crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8); }
    return (crc ^ 0xffffffff) >>> 0;
  }
  // Stored ZIP entries: PNG already compresses the large payloads. No runtime dependency.
  async function createStoredZip(files) {
    if (!files.length || files.length > 65535) { throw Error('Invalid report file count.'); }
    var encoder = new TextEncoder(), parts = [], directory = [], offset = 0, directorySize = 0, names = new Set();
    for (var file of files) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(file.name) || names.has(file.name)) { throw Error('Invalid or duplicate report filename.'); }
      names.add(file.name);
      var name = encoder.encode(file.name);
      var bytes = typeof file.data === 'string' ? encoder.encode(file.data) : file.data instanceof Uint8Array ? file.data : new Uint8Array(await file.data.arrayBuffer());
      if (name.length > 65535 || bytes.length > 0xffffffff || offset + 30 + name.length + bytes.length > 0xffffffff) { throw Error('Report exceeds ZIP size limits.'); }
      var checksum = crc32(bytes), local = new Uint8Array(30 + name.length), header = new DataView(local.buffer);
      header.setUint32(0, 0x04034b50, true); header.setUint16(4, 20, true); header.setUint16(6, 0x0800, true);
      header.setUint16(12, 33, true); // 1980-01-01; deterministic archive metadata.
      header.setUint32(14, checksum, true); header.setUint32(18, bytes.length, true); header.setUint32(22, bytes.length, true);
      header.setUint16(26, name.length, true); local.set(name, 30);
      var central = new Uint8Array(46 + name.length), entry = new DataView(central.buffer);
      entry.setUint32(0, 0x02014b50, true); entry.setUint16(4, 20, true); entry.setUint16(6, 20, true); entry.setUint16(8, 0x0800, true);
      entry.setUint16(14, 33, true); entry.setUint32(16, checksum, true); entry.setUint32(20, bytes.length, true); entry.setUint32(24, bytes.length, true);
      entry.setUint16(28, name.length, true); entry.setUint32(42, offset, true); central.set(name, 46);
      parts.push(local, bytes); directory.push(central); directorySize += central.length; offset += local.length + bytes.length;
    }
    if (offset + directorySize + 22 > 0xffffffff) { throw Error('Report exceeds ZIP size limits.'); }
    var end = new Uint8Array(22), endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, files.length, true); endView.setUint16(10, files.length, true);
    endView.setUint32(12, directorySize, true); endView.setUint32(16, offset, true);
    return new Blob(parts.concat(directory, [end]), { type: 'application/zip' });
  }
  function canExportReport(state) {
    return Boolean(state && state.results && state.results.analysisRevision === state.analysisRevision && !state.assignmentDraft &&
      !['geometryImport','meshGeneration','solvePreflight','solveExecution','convergenceStudy'].some(function (key) {
        return state[key] && ['running','importing','generating'].indexOf(state[key].status) >= 0;
      }));
  }
  function reportViewPresets(state, autoScale) {
    var base = Object.assign({}, state.viewportPresentation, { displayStyle: 'shaded-edges', meshOverlay: false,
      deformationMode: 'undeformed', deformationScale: 0, showLoads: false, showSupports: false, showGravity: false });
    function preset(name, mode, field, extra) {
      return { name: name, presentation: Object.assign({}, base, { mode: mode, field: field,
        colorRange: { mode: 'automatic', field: field, locked: false } }, extra) };
    }
    var views = [preset('01-part-loads-supports.png', 'model', 'vonMises', {showLoads:true,showSupports:true,showGravity:true}),
      preset('02-part-mesh.png', 'mesh', 'vonMises'), preset('03-part-stress-von-mises.png', 'stress', 'vonMises')];
    if (state.results.factorOfSafety) { views.push(preset('04-part-factor-of-safety.png', 'stress', 'factorOfSafety')); }
    views.push(preset('05-part-deformation-auto.png', 'deformation', 'displacementMagnitude', { deformationMode: 'auto', deformationScale: autoScale }));
    return views;
  }
  function cell(value) { return String(value == null ? '—' : value).replace(/[\t\r\n]+/g, ' '); }
  function rowsText(rows) { return rows.map(function (row) { return row.map(cell).join('\t'); }).join('\n'); }
  function createReportText(state, sourceName, autoScale, now, projection) {
    var unit = api.preferredUnit;
    var number = api.formatResultNumber, magnitude = api.formatResultMagnitude, material = state.material;
    var summary = api.resultSummaryRows(state);
    var parameters = [['File', sourceName], ['Exported (UTC)', (now || new Date()).toISOString()], ['Analysis revision', state.analysisRevision],
      ['Model', state.geometry.sourceFormat], ['Material', material.name || 'Custom'],
      ["Young's modulus", magnitude(material.youngsModulusPa, unit('youngsModulusPa'))], ["Poisson's ratio", number(material.poissonsRatio)]];
    [['densityKgM3','Density','kg/m³'],['tensileYieldPa','Tensile yield','MPa'],['compressiveYieldPa','Compressive yield','MPa'],
      ['ultimateTensilePa','Ultimate tensile','MPa'],['ultimateCompressivePa','Ultimate compressive','MPa']].forEach(function (entry) {
      parameters.push([entry[1], material[entry[0]] == null ? 'Not supplied' : magnitude(material[entry[0]], unit(entry[2] === 'kg/m³' ? 'densityKgM3' : 'strengthPa'))]);
    });
    var catalog = api.FACTORY_MATERIALS.find(function (entry) { return JSON.stringify(entry.material) === JSON.stringify(material); });
    if (catalog) {
      parameters.push(['Material notes', catalog.metadata.notes]);
      Object.keys(catalog.metadata.fieldProvenance).forEach(function (key) {
        var provenance = catalog.metadata.fieldProvenance[key]; parameters.push(['Source: ' + key, provenance.label + ' — ' + provenance.url]);
      });
    }
    state.boundaryConditions.forEach(function (support) {
      parameters.push(['Support: ' + support.name, 'Faces: ' + support.faceIds.join(', ') + '; ' + Object.keys(support.componentsM).map(function (axis) { return axis + ' = ' + magnitude(support.componentsM[axis], unit('displacementM')); }).join(', ')]);
    });
    state.loads.forEach(function (load) {
      var value = load.type === 'pressure' ? magnitude(load.pressurePa, unit('pressurePa')) + ' (positive inward)' : load.direction === 'surface-normal'
        ? magnitude(load.magnitudeN, unit('forceN')) + ' normal, ' + load.sense : load.forceN.map(function (v) { return magnitude(v, unit('forceN')); }).join(', ') + ' (global X, Y, Z)';
      parameters.push(['Load: ' + load.name, value + '; Faces: ' + load.faceIds.join(', ')]);
    });
    parameters.push(['Gravity', state.gravity.enabled ? state.gravity.accelerationMS2.map(function(v){return magnitude(v,unit('accelerationMS2'));}).join(', ') + ' (global X, Y, Z)' : 'Disabled']);
    parameters.push(['Mesh settings', Object.keys(state.meshSettings).map(function(k){return k+': '+(/SizeM$/.test(k) ? magnitude(state.meshSettings[k],unit('lengthM')) : state.meshSettings[k]);}).join('; ')], ['Solver settings', JSON.stringify(state.solveSettings)],
      ['Model orientation', JSON.stringify(state.geometry.orientation)], ['Import settings', JSON.stringify(state.geometry.importOptions || {})],
      ['Import metadata', JSON.stringify(state.geometry.sourceMetadata || {})],
      ['Image camera', 'Reset View then Fit Model; ' + (projection || 'current projection')],
      ['Deformation image shape', 'Auto ×' + number(autoScale)], ['Image color limits', 'Automatic for each field']);
    var text = 'SpjutSim FEA analysis report\n\n' + rowsText(parameters) + '\n\n' +
      'Convergence: ' + api.convergenceStatusMessage(state.convergenceStudy) + '\n' +
      'Review support/load concentrations for possible singularities; one solve does not establish safety.\n' +
      'Part dimensions are undeformed bounding dimensions in the study global axes. Image contours show smoothed surface values.\n' +
      (state.results.factorOfSafety ? 'Yield FoS uses the lower available tensile/compressive yield divided by von Mises stress.\n' : 'Yield FoS unavailable: supply tensile or compressive yield strength.\n') +
      '\nResults\nParameter\tValue\n' + rowsText(summary.values) + '\n\nDiagnostics\nParameter\tValue\n' + rowsText(summary.diagnostics) + '\n';
    if (state.convergenceStudy && state.convergenceStudy.levels.length) {
      text += '\nConvergence study\nLevel\tTarget size ('+unit('lengthM')+')\tDOF\tMax displacement ('+unit('lengthM')+')\tStrain energy ('+unit('energyJ')+')\tPeak von Mises ('+unit('stressPa')+')\tEstimated memory (bytes)\n' + rowsText(state.convergenceStudy.levels.map(function (level) {
        return [level.level, number(api.preferredFromSI('lengthM',level.targetSizeM)), level.degreeOfFreedomCount, number(api.preferredFromSI('lengthM',level.maximumDisplacementM)), number(api.preferredFromSI('energyJ',level.strainEnergyJ)), number(api.preferredFromSI('stressPa',level.rawVonMisesMaxPa)), level.estimatedPeakBytes];
      })) + '\n';
    }
    return text;
  }
  async function buildAnalysisReport(controller, viewport, autoScale) {
    var state = controller.document, result = state.results, revision = state.analysisRevision;
    function assertCurrent() {
      if (!canExportReport(controller.document) || controller.document.results !== result || controller.document.analysisRevision !== revision) {
        throw Error('The analysis changed during export. Solve the current setup and export again.');
      }
    }
    assertCurrent();
    var sourceName = controller.geometrySource && controller.geometrySource.sourceName || state.geometry.sourceName || 'part';
    var files = [{ name: 'report.txt', data: createReportText(state, sourceName, autoScale, new Date(), viewport.getNavigationPreferences().projection) }];
    var views = reportViewPresets(state, autoScale);
    for (var view of views) {
      assertCurrent();
      var canvas = viewport.captureReportView(state, view.presentation);
      var blob = await new Promise(function (resolve, reject) { canvas.toBlob(function (value) { value ? resolve(value) : reject(Error('Could not encode a report image.')); }, 'image/png'); });
      files.push({ name: view.name, data: blob });
      canvas.width = 0; canvas.height = 0;
    }
    assertCurrent();
    var archive = await createStoredZip(files);
    assertCurrent();
    return { blob: archive, filename: sourceName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-') + '-fea-report.zip' };
  }
  function bindReportExport(controller, viewport, ui) {
    var button = document.getElementById('export-report-button'), status = document.getElementById('report-status'), busy = false;
    function render() { button.disabled = busy || !canExportReport(controller.document); }
    controller.subscribe(render); render();
    button.addEventListener('click', async function () {
      if (busy || !canExportReport(controller.document)) { return; }
      busy = true; render(); status.textContent = 'Preparing report…';
      try {
        var report = await buildAnalysisReport(controller, viewport, ui.resolveDeformationScale('auto'));
        var url = URL.createObjectURL(report.blob), anchor = document.createElement('a');
        anchor.href = url; anchor.download = report.filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        status.textContent = 'Report downloaded.';
      } catch (error) { status.textContent = 'Report export failed: ' + error.message; }
      finally { busy = false; render(); }
    });
  }
  api.createStoredZip = createStoredZip;
  api.canExportReport = canExportReport;
  api.reportViewPresets = reportViewPresets;
  api.createReportText = createReportText;
  api.buildAnalysisReport = buildAnalysisReport;
  api.bindReportExport = bindReportExport;
}(globalThis));
