(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');
  var canvas = document.getElementById('viewport');
  var client = new api.MesherClient();
  var viewport = new api.ViewportController(canvas);

  function assert(condition, message) {
    if (!condition) { throw new Error(message); }
  }

  function readFixture(name) {
    return fetch('../fixtures/' + name).then(function (response) {
      if (!response.ok) { throw new Error('The ' + name + ' fixture could not be read.'); }
      return response.arrayBuffer();
    });
  }

  function faceTriangleCenter(preview, range) {
    var firstIndex = range.start;
    var indices = preview.indices;
    var positions = preview.positionsM;
    var a = new root.THREE.Vector3().fromArray(positions, indices[firstIndex] * 3);
    var b = new root.THREE.Vector3().fromArray(positions, indices[firstIndex + 1] * 3);
    var c = new root.THREE.Vector3().fromArray(positions, indices[firstIndex + 2] * 3);
    var normal = new root.THREE.Vector3().crossVectors(
      new root.THREE.Vector3().subVectors(b, a), new root.THREE.Vector3().subVectors(c, a)
    ).normalize();
    return { center: a.add(b).add(c).multiplyScalar(1 / 3), normal: normal };
  }

  function pickRange(geometry, range) {
    var triangle = faceTriangleCenter(geometry.preview, range);
    var rect = canvas.getBoundingClientRect();
    var projected;
    viewport.camera.position.copy(triangle.center).addScaledVector(triangle.normal, 3);
    viewport.camera.lookAt(triangle.center);
    viewport.camera.updateMatrixWorld();
    projected = triangle.center.clone().project(viewport.camera);
    return viewport.pickFaceAtPointer({
      clientX: rect.left + (projected.x + 1) * rect.width / 2,
      clientY: rect.top + (1 - projected.y) * rect.height / 2
    });
  }

  function testCoordinateConversion() {
    var fakeCanvas = {
      width: 800,
      height: 300,
      getBoundingClientRect: function () { return { left: 10, top: 20, width: 400, height: 150 }; }
    };
    var coordinates = api.pointerToCanvasCoordinates({ clientX: 210, clientY: 95 }, fakeCanvas);
    assert(coordinates.ndcX === 0 && coordinates.ndcY === 0, 'pointer normalization was incorrect');
    assert(coordinates.pixelX === 400 && coordinates.pixelY === 150, 'device-pixel-ratio conversion was incorrect');
  }

  function selectEveryFace(geometry) {
    geometry.preview.faceRanges.forEach(function (range) {
      assert(pickRange(geometry, range) === range.faceId, 'picked an unexpected opaque FaceId');
    });
  }

  function testReplacementMigrationUI(geometry) {
    var host = document.createElement('div');
    var state = api.createAnalysisDocument();
    var applied = null;
    var cancelled = false;
    var migration;
    host.innerHTML = '<div id="replacement-migration-backdrop" hidden><section id="replacement-migration-dialog" tabindex="-1">' +
      '<p id="replacement-migration-progress"></p><p id="replacement-migration-status"></p>' +
      '<canvas id="replacement-old-viewport" style="width:240px;height:160px"></canvas><canvas id="replacement-new-viewport" style="width:240px;height:160px"></canvas>' +
      '<h3 id="replacement-item-name"></h3><p id="replacement-item-description"></p>' +
      '<section id="replacement-migration-summary" hidden><ul id="replacement-migration-summary-list"></ul></section>' +
      '<button id="replacement-migration-back"></button><button id="replacement-migration-drop"></button>' +
      '<button id="replacement-migration-map"></button><button id="replacement-migration-apply" hidden></button><button id="replacement-migration-cancel"></button>' +
      '</section></div>';
    document.body.append(host);
    state.geometry = geometry;
    state.boundaryConditions = [{ id: 'support-transfer', name: 'Transfer support', type: 'support', faceIds: [geometry.faceIds[0]], componentsM: { x: 0 } }];
    migration = new api.ReplacementMigrationUI();
    migration.open(api.createReplacementMigrationDraft(state, geometry, {
      sourceName: geometry.sourceName, sourceFormat: geometry.sourceFormat, sourceBytes: new Uint8Array([8]).buffer
    }), function (newGeometry, source, transfer) { applied = { geometry: newGeometry, source: source, transfer: transfer }; });
    assert(migration.oldViewport && migration.newViewport && migration.oldViewport.selectedFaceIds.has(geometry.faceIds[0]),
      'replacement dialog did not retain side-by-side old/new model views with old faces highlighted');
    migration.newViewport.facePickHandler(geometry.faceIds[1], false);
    document.getElementById('replacement-migration-map').click();
    assert(!document.getElementById('replacement-migration-summary').hidden && !document.getElementById('replacement-migration-apply').hidden,
      'completed mappings did not advance to the transfer summary');
    document.getElementById('replacement-migration-apply').click();
    assert(applied && applied.transfer.boundaryConditions[0].faceIds[0] === geometry.faceIds[1] &&
      document.getElementById('replacement-migration-backdrop').hidden,
    'applying the migration did not return the mapped atomic transfer payload');
    migration.open(api.createReplacementMigrationDraft(state, geometry, {
      sourceName: geometry.sourceName, sourceFormat: geometry.sourceFormat, sourceBytes: new Uint8Array([9]).buffer
    }), function () {}, function () { cancelled = true; });
    document.getElementById('replacement-migration-cancel').click();
    assert(cancelled && document.getElementById('replacement-migration-backdrop').hidden && state.geometry === geometry &&
      state.boundaryConditions[0].faceIds[0] === geometry.faceIds[0],
    'cancelling replacement migration changed the active analysis');
    host.remove();
  }

  function testSelectionAndResize(geometry) {
    var controller = new api.AppController({ document: api.createAnalysisDocument() });
    var selectedFaceId = geometry.faceIds[0];
    var oldRenderGeometry;
    var oldRenderGeometryDisposed = false;
    controller.replaceGeometry(geometry, { sourceName: geometry.sourceName, sourceFormat: geometry.sourceFormat, sourceBytes: new Uint8Array([1]).buffer });
    assert(viewport.axisTriadScene && viewport.axisTriad && viewport.axisTriad.getObjectByName('axis-triad-label-x') &&
      viewport.axisTriad.getObjectByName('axis-triad-label-y') && viewport.axisTriad.getObjectByName('axis-triad-label-z'),
    'viewport did not create a separate labeled XYZ triad overlay');
    ['x', 'y', 'z'].forEach(function (axis) {
      var arrow = viewport.axisTriad.getObjectByName('axis-triad-' + axis);
      var label = viewport.axisTriad.getObjectByName('axis-triad-label-' + axis);
      assert(arrow.userData.tailPositionM.every(function (value) { return Math.abs(value) < 1e-12; }),
        'axis triad arrow tails did not meet at one origin');
      assert(arrow.getObjectByName('glyph-shaft').geometry.parameters.height +
        arrow.getObjectByName('glyph-head').geometry.parameters.height === 30,
      'axis triad did not use the requested 30-pixel axis size');
      assert(label.scale.x === 21 && label.scale.y === 21, 'axis label was not enlarged without stretching');
    });
    var triadPosition = viewport.axisTriad.position.clone();
    var triadQuaternion = viewport.axisTriad.quaternion.clone();
    viewport.setFacePickHandler(function (faceId, additive) {
      if (!faceId) { controller.clearSelectedFaces(); }
      else if (additive) { controller.toggleSelectedFace(faceId); }
      else { controller.replaceSelectedFaces([faceId]); }
    });
    viewport.setSelectedFaceIds([]);
    controller.replaceSelectedFaces([selectedFaceId]);
    viewport.setSelectedFaceIds(controller.document.selectedFaceIds);
    assert(viewport.selectedFaceIds.has(selectedFaceId), 'viewport did not render controller selection');
    assert(viewport.previewMesh.material[1].emissiveIntensity > 0, 'selected faces have no visible highlight material');
    var cameraBeforeOrbit = viewport.camera.position.clone();
    viewport.orbitByPixels(0, 24);
    assert(viewport.camera.position.distanceTo(cameraBeforeOrbit) > 0.01, 'orbit input did not move the camera');
    assert(viewport.camera.position.y > cameraBeforeOrbit.y, 'vertical orbit input used the unswapped pointer Y axis');
    assert(viewport.selectedFaceIds.has(selectedFaceId), 'orbit input changed the selected faces');
    assert(viewport.axisTriad.position.equals(triadPosition) && !viewport.axisTriad.quaternion.equals(triadQuaternion),
      'axis triad did not stay in its corner while rotating with the camera');
    var distanceBeforeZoom = viewport.camera.position.distanceTo(viewport.viewTarget);
    viewport.zoomByWheelDelta(-120);
    assert(viewport.camera.position.distanceTo(viewport.viewTarget) < distanceBeforeZoom, 'wheel input did not zoom the camera');
    assert(viewport.selectedFaceIds.has(selectedFaceId), 'zoom input changed the selected faces');
    canvas.style.width = '360px';
    canvas.style.height = '240px';
    viewport.resize();
    assert(viewport.axisTriad.position.x === -180 + 56 && viewport.axisTriad.position.y === -120 + 56,
      'axis triad did not retain a safe corner margin after resize');
    selectEveryFace(geometry);
    assert(viewport.selectedFaceIds.has(selectedFaceId), 'camera movement changed the selected faces');
    canvas.style.width = '720px';
    canvas.style.height = '360px';
    viewport.resize();
    assert(viewport.axisTriad.position.x === -360 + 56 && viewport.axisTriad.position.y === -180 + 56,
      'axis triad left the viewport after a second aspect-ratio change');
    [
      [0, 0, 0], [Math.PI / 2, 0, 0], [0, Math.PI / 2, 0],
      [Math.PI / 3, Math.PI / 4, Math.PI / 5], [-Math.PI / 3, Math.PI / 6, -Math.PI / 4]
    ].forEach(function (rotation) {
      viewport.axisTriad.quaternion.setFromEuler(new root.THREE.Euler(rotation[0], rotation[1], rotation[2]));
      viewport.axisTriad.updateMatrixWorld(true);
      ['x', 'y', 'z'].forEach(function (axis) {
        var projected = viewport.axisTriad.getObjectByName('axis-triad-label-' + axis).getWorldPosition(new root.THREE.Vector3())
          .project(viewport.axisTriadCamera);
        var pixelX = (projected.x + 1) * 360;
        var pixelY = (1 - projected.y) * 180;
        assert(pixelX >= 11 && pixelX <= 709 && pixelY >= 11 && pixelY <= 349,
          'rotated ' + axis.toUpperCase() + ' label crossed the viewport edge');
      });
    });
    viewport.render();
    selectEveryFace(geometry);
    assert(viewport.selectedFaceIds.has(selectedFaceId), 'resize changed the selected faces');
    assert(viewport.pickFaceAtPointer({ clientX: canvas.getBoundingClientRect().left, clientY: canvas.getBoundingClientRect().top }) === null,
      'empty-space click returned a FaceId');
    controller.replaceSelectedFaces([selectedFaceId]);
    var rect = canvas.getBoundingClientRect();
    viewport.pointerDownListener({ pointerId: 91, pointerType: 'mouse', button: 0, clientX: rect.left, clientY: rect.top });
    viewport.pointerMoveListener({ pointerId: 91, pointerType: 'mouse', button: 0, clientX: rect.left + 20, clientY: rect.top + 10 });
    viewport.pointerUpListener({ pointerId: 91, pointerType: 'mouse', button: 0, clientX: rect.left + 20, clientY: rect.top + 10 });
    canvas.dispatchEvent(new MouseEvent('click', { button: 0, clientX: rect.left, clientY: rect.top, bubbles: true }));
    assert(controller.document.selectedFaceIds.length === 1, 'camera drag cleared the selected faces');
    canvas.dispatchEvent(new MouseEvent('click', { button: 0, clientX: rect.left, clientY: rect.top, bubbles: true }));
    assert(controller.document.selectedFaceIds.length === 0, 'primary-button background click did not clear selected faces');
    controller.replaceSelectedFaces([selectedFaceId]);
    controller.toggleSelectedFace(selectedFaceId);
    viewport.setSelectedFaceIds(controller.document.selectedFaceIds);
    assert(!viewport.selectedFaceIds.has(selectedFaceId), 'toggle selection was not reflected in the viewport');
    controller.replaceSelectedFaces([selectedFaceId]);
    controller.replaceGeometry(geometry, { sourceName: geometry.sourceName, sourceFormat: geometry.sourceFormat, sourceBytes: new Uint8Array([2]).buffer });
    assert(controller.document.selectedFaceIds.length === 0, 'geometry replacement retained selection');
    oldRenderGeometry = viewport.previewMesh.geometry;
    oldRenderGeometry.addEventListener('dispose', function () { oldRenderGeometryDisposed = true; });
    viewport.setGeometryPreview(controller.document.geometry);
    viewport.setSelectedFaceIds(controller.document.selectedFaceIds);
    assert(oldRenderGeometryDisposed, 'geometry replacement did not dispose the previous GPU geometry');
  }

  function testMeshDisplay(geometry, sourceBytes) {
    return client.generateMesh({
      geometry: geometry, settings: { preset: 'coarse', elementType: 'tet4' }, sourceBytes: sourceBytes
    }).then(function (mesh) {
      var lineGeometry;
      var disposed = false;
      var overlayGeometryDisposed = false;
      var overlayState;
      var oldLoadGlyph;
      var newLoadGlyph;
      viewport.setGeometryPreview(geometry);
      viewport.setMeshDisplay(mesh);
      viewport.setPresentation({ mode: 'mesh', displayStyle: 'lines' });
      assert(viewport.meshSurface !== null, 'Mesh view did not create a boundary surface');
      assert(viewport.meshDisplay.userData.lines.geometry.index.count / 2 < mesh.boundaryFaces.triangleConnectivity.length,
        'mesh lines were not deduplicated from boundary triangles');
      assert(viewport.meshDisplay.userData.lines.visible, 'shaded-with-lines mesh style hid mesh lines');
      selectEveryFace(geometry);
      viewport.setPresentation({ mode: 'mesh', displayStyle: 'wireframe' });
      assert(!viewport.meshDisplay.userData.lines.visible && viewport.meshSurface.material[0].wireframe,
        'wireframe display style was not applied to Mesh view');
      lineGeometry = viewport.meshDisplay.userData.lines.geometry;
      lineGeometry.addEventListener('dispose', function () { disposed = true; });
      viewport.setMeshDisplay(mesh);
      assert(disposed, 'replacing a mesh display did not dispose its line buffer');
      viewport.setPresentation({ mode: 'model', displayStyle: 'wireframe' });
      assert(!viewport.previewMesh.visible && !viewport.previewMesh.material[0].wireframe &&
        viewport.importedGeometry.getObjectByName('imported-geometry-feature-edges').visible,
        'Model wireframe showed tessellation edges instead of CAD feature edges');
      viewport.setPresentation({ mode: 'model', displayStyle: 'lines' });
      assert(viewport.previewMesh.visible && !viewport.meshDisplay.visible, 'Model mode did not hide the mesh display');
      assert(!viewport.previewMesh.material[0].wireframe &&
        viewport.importedGeometry.getObjectByName('imported-geometry-feature-edges').visible,
        'shaded-with-edges display style was not restored in Model view');
      overlayState = {
        geometry: geometry, mesh: mesh,
        boundaryConditions: [{ id: 'support', name: 'Fixed', type: 'support', faceIds: [geometry.faceIds[0]], componentsM: { x: 0, y: 0, z: 0 } }],
        loads: [{ id: 'load', name: 'Force', type: 'total-force', faceIds: [geometry.faceIds[1]], forceN: [1, 0, 0] }],
        gravity: { enabled: true, accelerationMS2: [0, 0, -9.80665] }
      };
      viewport.setAnalysisOverlay(overlayState);
      assert(viewport.analysisOverlay.children.length > 3, 'analysis overlay did not distribute support and load glyphs');
      oldLoadGlyph = viewport.analysisOverlay.getObjectByName('analysis-glyph-total-force');
      assert(oldLoadGlyph.getObjectByName('glyph-shaft').geometry.type === 'CylinderGeometry' &&
        oldLoadGlyph.getObjectByName('glyph-head').geometry.type === 'ConeGeometry',
      'load arrow did not use thin cylinder-and-cone geometry');
      assert(oldLoadGlyph.userData.tipPositionM.every(function (value, axis) { return Math.abs(value - oldLoadGlyph.userData.descriptor.positionM[axis]) < 1e-12; }),
        'load arrow tip did not touch its sampled surface point');
      assert(viewport.analysisOverlay.getObjectByName('support-axis-x') && viewport.analysisOverlay.getObjectByName('support-axis-y') &&
        viewport.analysisOverlay.getObjectByName('support-axis-z'), 'support glyph omitted enabled global-axis cues');
      oldLoadGlyph.getObjectByName('glyph-shaft').geometry.addEventListener('dispose', function () { overlayGeometryDisposed = true; });
      document.documentElement.style.setProperty('--ui-color-load', '#123456');
      overlayState.loads[0].forceN = [1e9, 0, 0];
      viewport.setAnalysisOverlay(overlayState);
      newLoadGlyph = viewport.analysisOverlay.getObjectByName('analysis-glyph-total-force');
      assert(overlayGeometryDisposed, 'repeated item edits leaked the previous Three.js glyph geometry');
      assert(newLoadGlyph.getObjectByName('glyph-shaft').material.color.getHexString() === '123456', 'load glyph did not resolve its color from the active theme token');
      assert(newLoadGlyph.getObjectByName('glyph-shaft').geometry.parameters.height === oldLoadGlyph.getObjectByName('glyph-shaft').geometry.parameters.height,
        'glyph visual scale changed with numeric load magnitude');
      document.documentElement.style.removeProperty('--ui-color-load');
    });
  }

  function testCurvedFixtures() {
    return readFixture('generated-cylinder-r0_5-h1-m.step').then(function (sourceBytes) {
      return client.importGeometry({
        geometryId: 'preview-cylinder', sourceName: 'generated-cylinder-r0_5-h1-m.step', sourceFormat: 'step', sourceBytes: sourceBytes
      });
    }).then(function (cylinder) {
      var maximumRadialDeviation = 0;
      var index;
      assert(cylinder.faceIds.length === 3, 'analytic cylinder did not retain its three CAD faces');
      assert(Math.abs(cylinder.volumeM3 - Math.PI / 4) < 1e-9, 'analytic cylinder volume was incorrect');
      assert(Math.abs(cylinder.boundingBoxM.minM[0] + 0.5) < 2e-7 && Math.abs(cylinder.boundingBoxM.maxM[2] - 1) < 2e-7,
        'analytic cylinder bounds were incorrect');
      assert(cylinder.preview.featureEdges.indices.length > 0 && cylinder.preview.featureEdges.indices.length < cylinder.preview.indices.length,
        'Model view used triangulation facets instead of only CAD feature edges');
      for (index = 0; index < cylinder.preview.positionsM.length; index += 3) {
        if (Math.abs(cylinder.preview.normals[index + 2]) < 0.5) {
          maximumRadialDeviation = Math.max(maximumRadialDeviation, Math.abs(Math.hypot(cylinder.preview.positionsM[index], cylinder.preview.positionsM[index + 1]) - 0.5));
        }
      }
      assert(maximumRadialDeviation < 0.002, 'cylinder preview exceeded the chord-deviation target');
      return readFixture('generated-sphere-r0_5-m.step');
    }).then(function (sourceBytes) {
      return client.importGeometry({
        geometryId: 'preview-sphere', sourceName: 'generated-sphere-r0_5-m.step', sourceFormat: 'step', sourceBytes: sourceBytes
      });
    }).then(function (sphere) {
      assert(sphere.faceIds.length === 1, 'multiply-curved sphere did not retain one CAD face');
      assert(Math.abs(sphere.volumeM3 - Math.PI / 6) < 1e-9, 'multiply-curved sphere volume was incorrect');
      assert(Math.abs(sphere.boundingBoxM.minM[0] + 0.5) < 2e-7 && Math.abs(sphere.boundingBoxM.maxM[0] - 0.5) < 2e-7,
        'multiply-curved sphere bounds were incorrect');
    });
  }

  testCoordinateConversion();
  readFixture('generated-unit-cube-m.step').then(function (sourceBytes) {
    return client.importGeometry({
      geometryId: 'preview-selection-cube', sourceName: 'generated-unit-cube-m.step', sourceFormat: 'step', sourceBytes: sourceBytes
    }).then(function (geometry) { return { geometry: geometry, sourceBytes: sourceBytes }; });
  }).then(function (imported) {
    var geometry = imported.geometry;
    viewport.setGeometryPreview(geometry);
    selectEveryFace(geometry);
    testReplacementMigrationUI(geometry);
    testSelectionAndResize(geometry);
    return testMeshDisplay(geometry, imported.sourceBytes);
  }).then(function () {
    return testCurvedFixtures();
  }).then(function () {
    status.textContent = 'Passed';
    status.dataset.result = 'passed';
    document.title = 'Preview face-selection tests: Passed';
  }).catch(function (error) {
    status.textContent = error.message;
    status.dataset.result = 'failed';
    document.title = 'Preview face-selection tests: Failed';
    throw error;
  }).finally(function () {
    client.dispose();
    viewport.dispose();
  });
}(globalThis));
