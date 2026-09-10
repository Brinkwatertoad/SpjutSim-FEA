(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');
  var canvas = document.getElementById('viewport');
  var viewport = new api.ViewportController(canvas);
  var ui = new api.UIController({
    document: { selectedFaceIds: [] },
    subscribe: function () {}, clearSelectedFaces: function () {}
  });
  ui.setViewportController(viewport);
  ui.start();

  function assert(condition, message) {
    if (!condition) { throw new Error(message); }
  }

  function eventFor(pointerId, pointerType, button, x, y) {
    return {
      pointerId: pointerId, pointerType: pointerType, button: button, clientX: x, clientY: y,
      preventDefault: function () {}, shiftKey: false
    };
  }

  function arrowEvent(target, overrides) {
    return Object.assign({
      key: 'ArrowRight', target: target, preventDefault: function () {},
      defaultPrevented: false, ctrlKey: false, metaKey: false, altKey: false
    }, overrides || {});
  }

  function testPreferenceValidation() {
    var fallback = api.normalizeViewportNavigationPreferences({ rotateButton: 0, panButton: 0, zoomSensitivity: 99 });
    var storage = { value: '{not json', getItem: function () { return this.value; }, setItem: function (key, value) { this.value = value; } };
    assert(fallback.rotateButton === 0 && fallback.panButton === 2, 'conflicting mouse bindings were not repaired');
    assert(fallback.zoomSensitivity === 0.01, 'zoom sensitivity was not clamped');
    assert(api.loadViewportNavigationPreferences(storage).rotateButton === 0, 'corrupt preferences did not fall back safely');
    api.saveViewportNavigationPreferences({ rotateButton: 2, panButton: 0, reverseZoom: true }, storage);
    assert(api.loadViewportNavigationPreferences(storage).rotateButton === 2, 'versioned preferences were not persisted');
    assert(api.didExceedViewportDragThreshold(1, 1, 3, 2, 3) === false, 'drag threshold treated a click as a drag');
    assert(api.didExceedViewportDragThreshold(1, 1, 5, 1, 3) === true, 'drag threshold missed a drag');
    assert(api.viewportPinchDistance({ clientX: 0, clientY: 0 }, { clientX: 3, clientY: 4 }) === 5, 'pinch distance was incorrect');
    assert(api.zoomViewportDistance(1, 9999, {}, 0.2, 4) === 4, 'zoom maximum was not enforced');
    assert(api.zoomViewportDistance(1, -9999, {}, 0.2, 4) === 0.2, 'zoom minimum was not enforced');
    assert(api.zoomViewportDistance(1, -120, { reverseZoom: true }, 0.2, 4) > 1, 'reverse zoom direction was not applied');
    assert(api.viewportPanPixelsToWorld(10, 0, 2, Math.PI / 3, 1, 200, 1).x < 0, 'pan direction was not camera-plane correct');
  }

  function testCameraInput() {
    var initialPosition = viewport.camera.position.clone();
    var initialTarget = viewport.viewTarget.clone();
    var beforePinch;
    viewport.pointerDownListener(eventFor(1, 'mouse', 0, 100, 100));
    viewport.pointerMoveListener(eventFor(1, 'mouse', 0, 128, 118));
    viewport.pointerUpListener(eventFor(1, 'mouse', 0, 128, 118));
    assert(viewport.camera.position.distanceTo(initialPosition) > 0.01, 'left drag did not orbit');
    viewport.pointerDownListener(eventFor(2, 'mouse', 2, 100, 100));
    viewport.pointerMoveListener(eventFor(2, 'mouse', 2, 130, 100));
    viewport.pointerUpListener(eventFor(2, 'mouse', 2, 130, 100));
    assert(viewport.viewTarget.distanceTo(initialTarget) > 0.001, 'right drag did not pan');
    var beforeWheel = viewport.orbitDistance;
    viewport.wheelListener({ deltaY: -120, preventDefault: function () {} });
    assert(viewport.orbitDistance < beforeWheel, 'wheel did not zoom');
    viewport.pointerDownListener(eventFor(3, 'touch', 0, 100, 100));
    viewport.pointerDownListener(eventFor(4, 'touch', 0, 130, 100));
    beforePinch = viewport.orbitDistance;
    viewport.pointerMoveListener(eventFor(4, 'touch', 0, 180, 100));
    assert(viewport.orbitDistance < beforePinch, 'pinch-out did not zoom in (' + viewport.orbitDistance + ' >= ' + beforePinch + ')');
    viewport.pointerUpListener(eventFor(4, 'touch', 0, 180, 100));
    viewport.pointerUpListener(eventFor(3, 'touch', 0, 100, 100));
    document.getElementById('opener').focus();
    var beforeArrow = viewport.camera.position.clone();
    viewport.keyDownListener(arrowEvent(document.getElementById('opener')));
    assert(viewport.camera.position.distanceTo(beforeArrow) > 0.01, 'ordinary button focus disabled application-wide arrow rotation');
    var beforeOwnedArrow = viewport.camera.position.clone();
    viewport.keyDownListener(arrowEvent(document.getElementById('settings-tab-controls')));
    assert(viewport.camera.position.distanceTo(beforeOwnedArrow) < 0.000001, 'viewport consumed an arrow owned by a tab widget');
    viewport.keyDownListener(arrowEvent(document.getElementById('opener'), { defaultPrevented: true }));
    assert(viewport.camera.position.distanceTo(beforeOwnedArrow) < 0.000001, 'viewport ignored defaultPrevented on an arrow event');
    document.getElementById('opener').setAttribute('aria-haspopup', 'menu');
    document.getElementById('opener').setAttribute('aria-expanded', 'true');
    assert(!api.shouldHandleViewportArrowKey(arrowEvent(document.body), canvas, document), 'open menu did not retain arrow-key ownership');
    document.getElementById('opener').setAttribute('aria-expanded', 'false');
    var beforeFit = viewport.orbitDistance;
    viewport.fitCurrentModel();
    assert(viewport.orbitDistance !== beforeFit, 'fit view did not reframe the model');
    viewport.resetView({animate:false});
    assert(viewport.viewTarget.distanceTo(initialTarget) < 0.000001, 'reset view did not restore the initial target');
    viewport.setNavigationPreferences({ rotateButton: 2, panButton: 0 });
    var beforeSwappedPan = viewport.viewTarget.clone();
    viewport.pointerDownListener(eventFor(5, 'mouse', 0, 100, 100));
    viewport.pointerMoveListener(eventFor(5, 'mouse', 0, 130, 100));
    viewport.pointerUpListener(eventFor(5, 'mouse', 0, 130, 100));
    assert(viewport.viewTarget.distanceTo(beforeSwappedPan) > 0.001, 'changed mouse bindings were not applied');
    viewport.setNavigationPreferences({rotateButton:2,panButton:1});
    var beforeMiddlePan=viewport.viewTarget.clone();
    viewport.pointerDownListener(eventFor(8,'mouse',1,100,100));
    viewport.pointerMoveListener(eventFor(8,'mouse',1,140,100));
    viewport.pointerUpListener(eventFor(8,'mouse',1,140,100));
    assert(viewport.viewTarget.distanceTo(beforeMiddlePan)>0.001,'Middle button cannot pan');
    viewport.setNavigationPreferences({rotateButton:1,panButton:0});
    var beforeMiddleRotate=viewport.orbitAzimuth;
    viewport.pointerDownListener(eventFor(9,'mouse',1,100,100));
    viewport.pointerMoveListener(eventFor(9,'mouse',1,140,100));
    viewport.pointerUpListener(eventFor(9,'mouse',1,140,100));
    assert(viewport.orbitAzimuth!==beforeMiddleRotate,'Middle button cannot rotate');
    viewport.setNavigationPreferences({rotateButton:2,panButton:0});
    viewport.suppressNextClick = false;
    viewport.pointerDownListener(eventFor(6, 'mouse', 0, 100, 100));
    viewport.pointerMoveListener(eventFor(6, 'mouse', 0, 130, 100));
    viewport.pointerCancelListener(eventFor(6, 'mouse', 0, 130, 100));
    assert(viewport.activePointers.size === 0, 'pointer cancellation left active navigation state');
    assert(viewport.suppressNextClick === false, 'pointer cancellation consumed the next legitimate face click');
    viewport.pointerDownListener(eventFor(7, 'mouse', 2, 100, 100));
    viewport.pointerLostCaptureListener(eventFor(7, 'mouse', 2, 100, 100));
    assert(viewport.suppressContextMenu === false, 'capture loss suppressed a later unrelated context menu');
  }

  function testProjectionAndOrientations() {
    viewport.setNavigationPreferences({ projection: 'orthographic' });
    assert(viewport.camera.isOrthographicCamera, 'default parallel projection was not orthographic');
    viewport.setViewOrientation('isometric', { animate: false });
    var offset = viewport.camera.position.clone().sub(viewport.viewTarget).normalize();
    assert(Math.abs(offset.x - offset.y) < 1e-12 && Math.abs(offset.y - offset.z) < 1e-12,
      'isometric camera did not use equal angles');
    var forward = viewport.camera.getWorldDirection(new root.THREE.Vector3());
    var a = viewport.viewTarget.clone().add(new root.THREE.Vector3(0.1, 0, 0));
    var b = a.clone().add(forward);
    a.project(viewport.camera); b.project(viewport.camera);
    assert(Math.abs(a.x - b.x) < 1e-12 && Math.abs(a.y - b.y) < 1e-12, 'parallel rays converged in orthographic projection');
    viewport.camera.zoom = 2; viewport.camera.updateProjectionMatrix();
    var height = (viewport.camera.top - viewport.camera.bottom) / viewport.camera.zoom;
    viewport.setProjection('perspective');
    assert(Math.abs(2 * viewport.orbitDistance * Math.tan(viewport.camera.fov * Math.PI / 360) / height - 1) < 1e-12,
      'perspective switch changed apparent scale');
    viewport.setProjection('orthographic');
    assert(Math.abs((viewport.camera.top - viewport.camera.bottom) / height - 1) < 1e-12,
      'orthographic switch changed apparent scale');
    ['+x', '-x', '+y', '-y', '+z', '-z'].forEach(function (name) {
      viewport.setViewOrientation(name, { animate: false });
      var direction = viewport.camera.position.clone().sub(viewport.viewTarget).normalize();
      var component = name[1];
      assert(Math.abs(direction[component] - (name[0] === '+' ? 1 : -1)) < 1e-12, 'signed view was not exact: ' + name);
      assert(Math.abs(direction.dot(viewport.camera.up)) < 1e-12, 'principal view up was singular: ' + name);
      var before = viewport.camera.quaternion.clone();
      viewport.zoomByWheelDelta(-10);
      assert(before.angleTo(viewport.camera.quaternion) < 1e-7, 'zoom changed exact principal orientation');
      viewport.orbitByPixels(3, 4);
      assert(viewport.camera.matrixWorld.elements.every(Number.isFinite), 'orbit from a principal view became nonfinite');
    });
    ['orthographic', 'perspective'].forEach(function (projection) {
      viewport.setProjection(projection);
      [1e-6, 1e6].forEach(function (extent) {
        [[100, 700], [700, 100]].forEach(function (size) {
          canvas.style.width = size[0] + 'px'; canvas.style.height = size[1] + 'px'; viewport.resize();
          viewport.fitModel(new root.THREE.Vector3(), extent, true);
          for (var x = -1; x <= 1; x += 2) { for (var y = -1; y <= 1; y += 2) { for (var z = -1; z <= 1; z += 2) {
            var point = new root.THREE.Vector3(x * extent / 2, y * extent / 2, z * extent / 2).project(viewport.camera);
            assert(Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && Math.abs(point.z) <= 1,
              'fit clipped model at ' + projection + ' extent ' + extent + ' aspect ' + size);
          } } }
        });
      });
    });
    canvas.style.width = '480px'; canvas.style.height = '320px'; viewport.resize();
    viewport.setProjection('orthographic'); viewport.fitModel(new root.THREE.Vector3(), 1, true);
    viewport.zoomByWheelDelta(-100000);
    var front = viewport.viewTarget.clone().add(viewport.camera.position.clone().sub(viewport.viewTarget).normalize().multiplyScalar(0.8));
    assert(Math.abs(front.project(viewport.camera).z) <= 1, 'orthographic zoom moved the clipping plane inside the model');
    viewport.fitModel(new root.THREE.Vector3(), 1, true);
    var storage = { getItem: function () { return JSON.stringify({ version: 1, preferences: { rotateButton: 2, panButton: 0, panSensitivity: 2 } }); } };
    var migrated = api.loadViewportNavigationPreferences(storage);
    assert(migrated.rotateButton === 2 && migrated.panSensitivity === 2 && migrated.projection === 'orthographic',
      'projection preference migration discarded existing controls');
  }

  function testPeakAndGizmoBounds() {
    var picks = 0; var probes = 0;
    viewport.setFacePickHandler(function () { picks += 1; });
    viewport.setProbeHandler(function () { probes += 1; });
    var box = document.createElement('div');
    box.className = 'fea-gizmo-bounds';
    box.style.cssText = 'position:absolute;left:80px;top:180px;width:112px;height:112px';
    ['+x', '-x', '+y', '-y', '+z', '-z'].forEach(function (orientation) {
      var button = document.createElement('button'); button.dataset.viewOrientation = orientation; box.append(button);
    });
    canvas.parentElement.append(box); viewport.resize(); viewport.observeGizmoInteraction();
    var negative = viewport.axisTriad.getObjectByName('axis-triad-label--x');
    assert(negative && !negative.visible, 'Negative label visible without gizmo interaction');
    box.dispatchEvent(new PointerEvent('pointerenter'));
    assert(negative.visible && box.dataset.active === 'true', 'General gizmo hover did not reveal negative axes');
    box.dispatchEvent(new PointerEvent('pointerleave'));
    assert(!negative.visible, 'Negative axes remained after hover');
    box.children[0].focus();
    assert(negative.visible, 'Keyboard focus did not reveal negative axes');
    box.children[0].blur();
    assert(!negative.visible, 'Negative axes remained after focus');
    viewport.axisTriad.traverse(function (object) {
      if (object.material) { assert(object.material.depthTest && object.material.depthWrite, 'Gizmo label/arrow bypasses depth ordering'); }
    });
    var rect = box.getBoundingClientRect(); var canvasRect = canvas.getBoundingClientRect();
    assert(Math.abs(viewport.axisTriad.position.x - (-canvas.clientWidth / 2 + rect.left - canvasRect.left + 56)) < 1e-9,
      'triad ignored its reserved DOM bounds');
    Array.from(box.children).forEach(function (button) {
      assert(parseFloat(button.style.left) >= 12 && parseFloat(button.style.left) <= 100 &&
        parseFloat(button.style.top) >= 12 && parseFloat(button.style.top) <= 100, 'gizmo endpoint escaped reserved bounds');
    });
    var button = box.children[0]; var before = viewport.camera.position.clone();
    button.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 111, button: 0, clientX: 10, clientY: 10, bubbles: true }));
    button.dispatchEvent(new PointerEvent('pointermove', { pointerId: 111, clientX: 20, clientY: 10, bubbles: true }));
    button.dispatchEvent(new PointerEvent('pointerup', { pointerId: 111, button: 0, bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { detail: 1, button: 0, bubbles: true }));
    assert(viewport.viewAnimationFrame === null && viewport.camera.position.equals(before), 'gizmo drag triggered a view command');
    button.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 112, button: 0, clientX: 10, clientY: 10, bubbles: true }));
    button.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 112, bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { detail: 1, button: 0, bubbles: true }));
    assert(viewport.viewAnimationFrame === null, 'cancelled gizmo gesture triggered a view command');
    button.click();
    assert(viewport.viewAnimationFrame !== null || viewport.camera.position.x > viewport.viewTarget.x,
      'keyboard gizmo activation failed');
    viewport.cancelViewAnimation();
    button.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 113, button: 0, clientX: 10, clientY: 10, bubbles: true }));
    viewport.setProjection('perspective');
    button.dispatchEvent(new MouseEvent('click', { detail: 1, button: 0, bubbles: true }));
    assert(viewport.viewAnimationFrame === null, 'projection switch failed to cancel pending gizmo gesture');
    assert(picks === 0 && probes === 0, 'gizmo interaction dispatched a geometry pick or probe');
    var peak = { locationM: [0.125, 0.25, 0.375], locationOwner: 'solver-sample', isInterior: true, valuePa: 100 };
    viewport.resultModel = { extrema: { rawVonMisesMax: peak } };
    var orientation = viewport.camera.quaternion.clone();
    assert(viewport.locatePeak() === peak && viewport.peakMarker.position.toArray().every(function (value, i) { return value === peak.locationM[i]; }),
      'Locate Peak did not mark exact solver coordinates');
    assert(viewport.camera.quaternion.angleTo(orientation) < 1e-7, 'Locate Peak changed camera orientation');
    assert(viewport.peakMarker.userData.locationOwner === 'solver-sample' && viewport.peakMarker.children[0].material.depthTest === false,
      'interior sample marker was mislabeled or occluded');
    viewport.clearResultDisplay();
    assert(viewport.peakMarker === null, 'stale results retained their peak marker');
    viewport.setProbeHandler(null);
    viewport.pointerDownListener(eventFor(92, 'mouse', 0, 100, 100));
    viewport.setProjection('orthographic');
    viewport.pointerClickListener({ button: 0 });
    assert(picks === 0 && viewport.activePointers.size === 0, 'projection switch during a gesture caused a geometry pick');
    viewport.setFacePickHandler(null); box.remove(); viewport.resize();
  }

  function testViewAnimation() {
    var originalRequest = root.requestAnimationFrame; var originalCancel = root.cancelAnimationFrame; var originalMatch = root.matchMedia;
    var callback = null; var cancelled = false;
    root.requestAnimationFrame = function (handler) { callback = handler; return 97; };
    root.cancelAnimationFrame = function () { callback = null; cancelled = true; };
    root.matchMedia = function () { return { matches: false }; };
    try {
      viewport.setViewOrientation('+x');
      assert(viewport.viewAnimationFrame === 97, 'view transition was not animated');
      callback(0); callback(90);
      viewport.panByPixels(1, 1);
      assert(cancelled && viewport.viewAnimationFrame === null && callback === null, 'user pan failed to cancel view animation');
      viewport.setViewOrientation('-z'); callback(0); callback(180);
      assert(viewport.viewAnimationFrame === null && viewport.camera.position.z < viewport.viewTarget.z &&
        Math.abs(viewport.camera.position.x - viewport.viewTarget.x) < 1e-12, 'animation did not end at an exact principal view');
      var startPosition = viewport.camera.position.clone();
      viewport.resetView();
      assert(viewport.viewAnimationFrame === 97 && viewport.camera.position.equals(startPosition), 'Reset view jumped instead of animating');
      callback(0); callback(90);
      assert(!viewport.camera.position.equals(startPosition), 'Reset animation did not advance');
      callback(180);
      assert(viewport.viewTarget.distanceTo(new root.THREE.Vector3().fromArray(viewport.resetViewState.target)) < 1e-10 &&
        Math.abs(viewport.orbitDistance - viewport.resetViewState.distance) < 1e-10, 'Reset animation did not restore target and zoom');
      viewport.setViewOrientation('-x', {animate:false}); viewport.resetView(); callback(0);
      viewport.orbitByPixels(1,1);
      assert(viewport.viewAnimationFrame === null, 'Navigation did not cancel reset animation');
      root.matchMedia = function () { return { matches: true }; };
      viewport.resetView();
      assert(viewport.viewAnimationFrame === null, 'Reduced-motion reset was animated');
      viewport.setViewOrientation('+y');
      assert(viewport.viewAnimationFrame === null && viewport.camera.position.y > viewport.viewTarget.y &&
        Math.abs(viewport.camera.position.z - viewport.viewTarget.z) < 1e-12, 'reduced motion did not apply the view immediately');
    } finally {
      viewport.cancelViewAnimation(); root.requestAnimationFrame = originalRequest; root.cancelAnimationFrame = originalCancel; root.matchMedia = originalMatch;
    }
  }

  function testSettingsFocus() {
    var opener = document.getElementById('opener');
    var usesMeta = ui.settingsShortcut.modifier === 'meta';
    assert(ui.resolveSettingsShortcut('MacIntel', 'Version/18.0 Safari/605.1.15').label === 'Ctrl+,', 'Safari did not receive its Control+, fallback');
    assert(ui.resolveSettingsShortcut('MacIntel', 'Mozilla/5.0 Chrome/145.0.0.0 Safari/537.36').label === '⌘,', 'macOS did not receive its Command-glyph shortcut label');
    assert(ui.isSettingsShortcut({ metaKey: usesMeta, ctrlKey: !usesMeta, altKey: false, shiftKey: false, key: ',', code: 'Comma' }), 'platform settings shortcut was not recognized');
    opener.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ',', code: 'Comma', ctrlKey: !usesMeta, metaKey: usesMeta, bubbles: true, cancelable: true }));
    assert(document.getElementById('settings-backdrop').hidden === false, 'settings dialog did not open from its platform shortcut');
    assert(document.activeElement === document.getElementById('navigation-rotate-button'), 'settings did not move focus to controls');
    ui.trapSettingsFocus({ key: 'Escape', preventDefault: function () {} });
    assert(document.getElementById('settings-backdrop').hidden === true, 'Escape did not close settings');
    assert(document.activeElement === opener, 'settings did not restore opener focus');
  }

  function testPixelRatioResize() {
    var descriptor = Object.getOwnPropertyDescriptor(root, 'devicePixelRatio');
    try {
      [1, 2, 1.25].forEach(function (ratio) {
        Object.defineProperty(root, 'devicePixelRatio', {configurable:true,value:ratio});
        root.dispatchEvent(new Event('resize'));
        assert(viewport.renderer.getPixelRatio() === ratio && Math.abs(canvas.width - canvas.clientWidth * ratio) <= 1,
          'Changing display pixel ratio left a stale canvas drawing buffer');
      });
    } finally {
      if (descriptor) { Object.defineProperty(root, 'devicePixelRatio', descriptor); } else { delete root.devicePixelRatio; }
      viewport.resize();
    }
  }

  function testCameraMenu() {
    var perspective = document.querySelector('[data-ui-menu-action="projection-perspective"]');
    perspective.click();
    assert(viewport.camera.isPerspectiveCamera && perspective.getAttribute('aria-checked') === 'true', 'View menu did not change projection and selection state');
    var toggle = document.getElementById('perspective-toggle');
    assert(toggle.checked, 'Perspective checkbox did not follow menu');
    var pose = viewport.camera.quaternion.clone();
    toggle.checked = false; toggle.dispatchEvent(new Event('change'));
    assert(viewport.camera.isOrthographicCamera && viewport.camera.quaternion.angleTo(pose) < 1e-7, 'Perspective toggle changed view angle');
    toggle.checked = true; toggle.dispatchEvent(new Event('change'));
    assert(viewport.camera.isPerspectiveCamera && perspective.getAttribute('aria-checked') === 'true', 'Perspective checkbox did not synchronize projection');
    ui.readNavigationPreferences('rotateButton');
    assert(viewport.camera.isPerspectiveCamera && api.loadViewportNavigationPreferences(root.localStorage).projection === 'perspective', 'Navigation settings erased or failed to persist selected projection');
    var previousMatchMedia = root.matchMedia;
    root.matchMedia = function () { return { matches: true }; };
    try { document.querySelector('[data-ui-menu-action="camera-+y"]').click(); } finally { root.matchMedia = previousMatchMedia; }
    var direction = viewport.camera.position.clone().sub(viewport.viewTarget).normalize();
    assert(direction.distanceTo(new root.THREE.Vector3(0, 1, 0)) < 1e-12, 'Signed View menu command did not reach exact principal view');
    document.querySelector('[data-ui-menu-action="projection-orthographic"]').click();
    assert(viewport.camera.isOrthographicCamera && perspective.getAttribute('aria-checked') === 'false', 'Projection menu state was not synchronized');
  }

  try {
    testPixelRatioResize();
    testCameraMenu();
    testProjectionAndOrientations();
    testPreferenceValidation();
    testCameraInput();
    testPeakAndGizmoBounds();
    testViewAnimation();
    testSettingsFocus();
    status.textContent = 'Passed';
    status.dataset.result = 'passed';
    document.title = 'Viewport navigation tests: Passed';
  } catch (error) {
    status.textContent = error.message;
    status.dataset.result = 'failed';
    document.title = 'Viewport navigation tests: Failed';
    throw error;
  } finally {
    viewport.dispose();
  }
}(globalThis));
