(function (root) {
  'use strict';
  var api = root.SpjutsimFEA = root.SpjutsimFEA || {};
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
    if (state.materialProvenance) { catalog = {metadata:state.materialProvenance}; }
    if (catalog) {
      parameters.push(['Material notes', catalog.metadata.notes]);
      Object.keys(catalog.metadata.fieldProvenance).forEach(function (key) {
        var provenance = catalog.metadata.fieldProvenance[key]; parameters.push(['Source: ' + key, provenance.label + ' — ' + provenance.url]);
      });
    }
    state.boundaryConditions.forEach(function (support) {
      parameters.push(['Support: ' + support.name + (support.enabled === false ? ' (suppressed)' : ''), 'Faces: ' + support.faceIds.join(', ') + '; ' + Object.keys(support.componentsM).map(function (axis) { return axis + ' = ' + magnitude(support.componentsM[axis], unit('displacementM')); }).join(', ')]);
    });
    state.loads.forEach(function (load) {
      var value = load.type === 'pressure' ? magnitude(load.pressurePa, unit('pressurePa')) + ' (positive inward)' : load.direction === 'surface-normal'
        ? magnitude(load.magnitudeN, unit('forceN')) + ' normal, ' + load.sense : load.forceN.map(function (v) { return magnitude(v, unit('forceN')); }).join(', ') + ' (global X, Y, Z)';
      parameters.push(['Load: ' + load.name + (load.enabled === false ? ' (suppressed)' : ''), value + '; Faces: ' + load.faceIds.join(', ')]);
    });
    parameters.push(['Gravity', state.gravity.enabled ? state.gravity.accelerationMS2.map(function(v){return magnitude(v,unit('accelerationMS2'));}).join(', ') + ' (global X, Y, Z)' : 'Disabled']);
    parameters.push(['Mesh settings', Object.keys(state.meshSettings).map(function(k){return k+': '+(/SizeM$/.test(k) ? magnitude(state.meshSettings[k],unit('lengthM')) : state.meshSettings[k]);}).join('; ')], ['Solver settings', JSON.stringify(state.solveSettings)],
      ['Model orientation', JSON.stringify(state.geometry.orientation)],
      ['Image camera', 'Reset View then Fit Model; ' + (projection || 'current projection')],
      ['Deformation image shape', 'Auto ×' + number(autoScale)], ['Image color limits', 'Automatic for each field']);
    var text = 'SpjutSim FEA analysis report\n\n' + rowsText(parameters) + '\n\n' +
      'Convergence: ' + api.convergenceStatusMessage(state.convergenceStudy) + '\n' +
      'Assumptions: homogeneous isotropic solid, small-strain linear static response; SI engineering state with displayed units.\n' +
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
  async function buildAnalysisReport(controller, viewport, autoScale, format, options, signal) {
    var state = controller.document, result = state.results, revision = state.analysisRevision;
    options = api.validateReportOptions(options || state.projectMetadata && state.projectMetadata.reportOptions);
    function assertCurrent() {
      if (signal && signal.aborted) { throw new DOMException('Report export cancelled.', 'AbortError'); }
      if (!canExportReport(controller.document) || controller.document.results !== result || controller.document.analysisRevision !== revision) {
        throw Error('The analysis changed during export. Solve the current setup and export again.');
      }
    }
    assertCurrent();
    var sourceName = controller.geometrySource && controller.geometrySource.sourceName || state.geometry.sourceName || 'part';
    var files = [{ name: 'report.txt', data: createReportText(state, sourceName, autoScale, new Date(), viewport.getNavigationPreferences().projection) }];
    files[0].data = files[0].data.replace('SpjutSim FEA analysis report', cell(options.title));
    if (options.notes) { files[0].data += '\nUser notes\n' + options.notes.replace(/\r/g,'') + '\n'; }
    var keys = {'01-part-loads-supports.png':'assignments','02-part-mesh.png':'mesh','03-part-stress-von-mises.png':'stress','04-part-factor-of-safety.png':'factorOfSafety','05-part-deformation-auto.png':'deformation'};
    var views = reportViewPresets(state, autoScale).filter(function(view){return options.views === null || options.views.includes(keys[view.name]);});
    if (options.currentView) {
      var presentation = Object.assign({}, state.viewportPresentation);
      presentation.deformationScale = (presentation.deformationScale || 0) * viewport.deformationAnimationMultiplier;
      // Capture before the first PNG encode yields to navigation/visibility edits.
      views.unshift({name:'06-current-view.png',presentation:presentation,current:true});
      files[0].data += '\nCurrent view\nCamera\t' + JSON.stringify(viewport.captureViewState()) + '\nDisplay, field, units, scale and limits\t' + JSON.stringify(presentation) + '\nHidden authoring faces\t' + Array.from(viewport.hiddenFaceIds || []).join(', ') + '\nClipping\tNo user section plane; camera near/far ' + viewport.camera.near + ' / ' + viewport.camera.far + '\n';
    }
    var currentImage = null;
    for (var view of views) {
      assertCurrent();
      var canvas = viewport.captureReportView(state, view.presentation, {current:view.current === true});
      var blob = await new Promise(function (resolve, reject) { canvas.toBlob(function (value) { value ? resolve(value) : reject(Error('Could not encode a report image.')); }, 'image/png'); });
      var image = { name: view.name, data: blob };
      if (view.current) { currentImage = image; } else { files.push(image); }
      canvas.width = 0; canvas.height = 0;
    }
    if (currentImage) { files.push(currentImage); }
    assertCurrent();
    var archive = format === 'docx' ? await api.createReportDocx(files[0].data, files.slice(1)) : await api.createStoredZip(files);
    assertCurrent();
    return { blob: archive, filename: sourceName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-') + '-fea-report.' + (format === 'docx' ? 'docx' : 'zip') };
  }
  function bindReportExport(controller, viewport, ui) {
    var button = document.getElementById('export-report-button'), status = document.getElementById('report-status'), busy = false, abort = null;
    var icon = button.querySelector('svg'), originalIcon = icon.innerHTML;
    function render() {
      button.disabled = !busy && !canExportReport(controller.document);
      button.title = busy ? 'Cancel report export' : 'Download analysis report'; button.setAttribute('aria-label',button.title);
      if (button.dataset.exporting !== String(busy)) { icon.innerHTML = busy ? '<path d="M6 6l12 12M18 6 6 18"/>' : originalIcon; button.dataset.exporting = String(busy); }
    }
    controller.subscribe(render); render();
    api.bindReportOptions(controller);
    button.addEventListener('click', async function () {
      if (busy) { abort.abort(); status.textContent = 'Cancelling report…'; return; }
      if (!canExportReport(controller.document)) { return; }
      busy = true; abort = new AbortController(); render(); status.textContent = 'Preparing report… Select Cancel report export to stop.';
      try {
        var report = await buildAnalysisReport(controller, viewport, ui.resolveDeformationScale('auto'), document.getElementById('report-format').value, null, abort.signal);
        var url = URL.createObjectURL(report.blob), anchor = document.createElement('a');
        anchor.href = url; anchor.download = report.filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        status.textContent = 'Report downloaded.';
      } catch (error) { status.textContent = error.name === 'AbortError' ? 'Report export cancelled.' : 'Report export failed: ' + error.message; }
      finally { busy = false; render(); }
    });
  }
  api.canExportReport = canExportReport;
  api.reportViewPresets = reportViewPresets;
  api.createReportText = createReportText;
  api.buildAnalysisReport = buildAnalysisReport;
  api.bindReportExport = bindReportExport;
}(globalThis));
