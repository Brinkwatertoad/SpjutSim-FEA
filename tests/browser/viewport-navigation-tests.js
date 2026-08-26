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
    viewport.keyDownListener({ key: 'ArrowRight', target: document.getElementById('opener'), preventDefault: function () {}, ctrlKey: false, metaKey: false, altKey: false });
    assert(viewport.camera.position.distanceTo(beforeArrow) > 0.01, 'arrow key did not rotate without viewport focus');
    var beforeFit = viewport.orbitDistance;
    viewport.fitCurrentModel();
    assert(viewport.orbitDistance !== beforeFit, 'fit view did not reframe the model');
    viewport.resetView();
    assert(viewport.viewTarget.distanceTo(initialTarget) < 0.000001, 'reset view did not restore the initial target');
    viewport.setNavigationPreferences({ rotateButton: 2, panButton: 0 });
    var beforeSwappedPan = viewport.viewTarget.clone();
    viewport.pointerDownListener(eventFor(5, 'mouse', 0, 100, 100));
    viewport.pointerMoveListener(eventFor(5, 'mouse', 0, 130, 100));
    viewport.pointerUpListener(eventFor(5, 'mouse', 0, 130, 100));
    assert(viewport.viewTarget.distanceTo(beforeSwappedPan) > 0.001, 'changed mouse bindings were not applied');
    viewport.pointerDownListener(eventFor(6, 'mouse', 2, 100, 100));
    viewport.pointerLostCaptureListener(eventFor(6, 'mouse', 2, 100, 100));
    assert(viewport.activePointers.size === 0, 'pointer cancellation left active navigation state');
  }

  function testSettingsFocus() {
    var opener = document.getElementById('opener');
    assert(ui.isSettingsShortcut({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, key: ',', code: 'Comma' }), 'Command+, settings shortcut was not recognized');
    opener.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ',', code: 'Comma', ctrlKey: true, bubbles: true, cancelable: true }));
    assert(document.getElementById('settings-backdrop').hidden === false, 'Control+, settings dialog did not open');
    assert(document.activeElement === document.getElementById('navigation-rotate-button'), 'settings did not move focus to controls');
    ui.trapSettingsFocus({ key: 'Escape', preventDefault: function () {} });
    assert(document.getElementById('settings-backdrop').hidden === true, 'Escape did not close settings');
    assert(document.activeElement === opener, 'settings did not restore opener focus');
  }

  try {
    testPreferenceValidation();
    testCameraInput();
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
