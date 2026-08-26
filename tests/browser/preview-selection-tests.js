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

  function testSelectionAndResize(geometry) {
    var controller = new api.AppController({ document: api.createAnalysisDocument() });
    var selectedFaceId = geometry.faceIds[0];
    var oldRenderGeometry;
    var oldRenderGeometryDisposed = false;
    controller.replaceGeometry(geometry, { sourceName: geometry.sourceName, stepBytes: new Uint8Array([1]).buffer });
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
    var distanceBeforeZoom = viewport.camera.position.distanceTo(viewport.viewTarget);
    viewport.zoomByWheelDelta(-120);
    assert(viewport.camera.position.distanceTo(viewport.viewTarget) < distanceBeforeZoom, 'wheel input did not zoom the camera');
    assert(viewport.selectedFaceIds.has(selectedFaceId), 'zoom input changed the selected faces');
    canvas.style.width = '360px';
    canvas.style.height = '240px';
    viewport.resize();
    selectEveryFace(geometry);
    assert(viewport.selectedFaceIds.has(selectedFaceId), 'camera movement changed the selected faces');
    canvas.style.width = '720px';
    canvas.style.height = '360px';
    viewport.resize();
    selectEveryFace(geometry);
    assert(viewport.selectedFaceIds.has(selectedFaceId), 'resize changed the selected faces');
    assert(viewport.pickFaceAtPointer({ clientX: canvas.getBoundingClientRect().left, clientY: canvas.getBoundingClientRect().top }) === null,
      'empty-space click returned a FaceId');
    controller.toggleSelectedFace(selectedFaceId);
    viewport.setSelectedFaceIds(controller.document.selectedFaceIds);
    assert(!viewport.selectedFaceIds.has(selectedFaceId), 'toggle selection was not reflected in the viewport');
    controller.replaceSelectedFaces([selectedFaceId]);
    controller.replaceGeometry(geometry, { sourceName: geometry.sourceName, stepBytes: new Uint8Array([2]).buffer });
    assert(controller.document.selectedFaceIds.length === 0, 'geometry replacement retained selection');
    oldRenderGeometry = viewport.previewMesh.geometry;
    oldRenderGeometry.addEventListener('dispose', function () { oldRenderGeometryDisposed = true; });
    viewport.setGeometryPreview(controller.document.geometry);
    viewport.setSelectedFaceIds(controller.document.selectedFaceIds);
    assert(oldRenderGeometryDisposed, 'geometry replacement did not dispose the previous GPU geometry');
  }

  function testMeshDisplay(geometry, stepBytes) {
    return client.generateMesh({
      geometry: geometry, settings: { preset: 'coarse', elementType: 'tet4' }, stepBytes: stepBytes
    }).then(function (mesh) {
      var lineGeometry;
      var disposed = false;
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
    });
  }

  function testCurvedFixtures() {
    return readFixture('generated-cylinder-r0_5-h1-m.step').then(function (stepBytes) {
      return client.importGeometry({
        geometryId: 'preview-cylinder', sourceName: 'generated-cylinder-r0_5-h1-m.step', stepBytes: stepBytes
      });
    }).then(function (cylinder) {
      var maximumRadialDeviation = 0;
      var index;
      assert(cylinder.faceIds.length === 3, 'analytic cylinder did not retain its three CAD faces');
      assert(Math.abs(cylinder.volumeM3 - Math.PI / 4) < 1e-9, 'analytic cylinder volume was incorrect');
      assert(Math.abs(cylinder.boundingBoxM.minM[0] + 0.5) < 1e-9 && Math.abs(cylinder.boundingBoxM.maxM[2] - 1) < 1e-9,
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
    }).then(function (stepBytes) {
      return client.importGeometry({
        geometryId: 'preview-sphere', sourceName: 'generated-sphere-r0_5-m.step', stepBytes: stepBytes
      });
    }).then(function (sphere) {
      assert(sphere.faceIds.length === 1, 'multiply-curved sphere did not retain one CAD face');
      assert(Math.abs(sphere.volumeM3 - Math.PI / 6) < 1e-9, 'multiply-curved sphere volume was incorrect');
      assert(Math.abs(sphere.boundingBoxM.minM[0] + 0.5) < 1e-9 && Math.abs(sphere.boundingBoxM.maxM[0] - 0.5) < 1e-9,
        'multiply-curved sphere bounds were incorrect');
    });
  }

  testCoordinateConversion();
  readFixture('generated-unit-cube-m.step').then(function (stepBytes) {
    return client.importGeometry({
      geometryId: 'preview-selection-cube', sourceName: 'generated-unit-cube-m.step', stepBytes: stepBytes
    }).then(function (geometry) { return { geometry: geometry, stepBytes: stepBytes }; });
  }).then(function (imported) {
    var geometry = imported.geometry;
    viewport.setGeometryPreview(geometry);
    selectEveryFace(geometry);
    testSelectionAndResize(geometry);
    return testMeshDisplay(geometry, imported.stepBytes);
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
