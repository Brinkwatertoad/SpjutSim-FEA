(function (root) {
  'use strict';

  var PREFERENCE_SCHEMA_VERSION = 1;
  var PREFERENCE_STORAGE_KEY = 'spjutsim-fea.viewport-navigation';
  var ARROW_NAVIGATION_ROLES = new Set([
    'application', 'combobox', 'grid', 'gridcell', 'listbox', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox',
    'menuitemradio', 'option', 'radio', 'radiogroup', 'scrollbar', 'slider', 'spinbutton', 'tab',
    'tablist', 'textbox', 'searchbox', 'toolbar', 'tree', 'treegrid', 'treeitem'
  ]);
  var DEFAULT_PREFERENCES = Object.freeze({
    rotateButton: 0,
    panButton: 2,
    reverseZoom: false,
    rotateSensitivity: 0.008,
    panSensitivity: 1,
    zoomSensitivity: 0.001,
    arrowStep: 0.15
  });

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function numericPreference(value, fallback, minimum, maximum) {
    var number = Number(value);
    return Number.isFinite(number) ? clamp(number, minimum, maximum) : fallback;
  }

  function normalizeNavigationPreferences(value) {
    var source = value && typeof value === 'object' ? value : {};
    var rotateButton = Number(source.rotateButton);
    var panButton = Number(source.panButton);
    if (!((rotateButton === 0 || rotateButton === 2) && (panButton === 0 || panButton === 2) && rotateButton !== panButton)) {
      rotateButton = DEFAULT_PREFERENCES.rotateButton;
      panButton = DEFAULT_PREFERENCES.panButton;
    }
    return {
      rotateButton: rotateButton,
      panButton: panButton,
      reverseZoom: typeof source.reverseZoom === 'boolean' ? source.reverseZoom : DEFAULT_PREFERENCES.reverseZoom,
      rotateSensitivity: numericPreference(source.rotateSensitivity, DEFAULT_PREFERENCES.rotateSensitivity, 0.001, 0.03),
      panSensitivity: numericPreference(source.panSensitivity, DEFAULT_PREFERENCES.panSensitivity, 0.1, 4),
      zoomSensitivity: numericPreference(source.zoomSensitivity, DEFAULT_PREFERENCES.zoomSensitivity, 0.0001, 0.01),
      arrowStep: numericPreference(source.arrowStep, DEFAULT_PREFERENCES.arrowStep, 0.02, 1)
    };
  }

  function migrateNavigationPreferences(record) {
    if (!record || typeof record !== 'object') { return normalizeNavigationPreferences(); }
    if (record.version === PREFERENCE_SCHEMA_VERSION && record.preferences && typeof record.preferences === 'object') {
      return normalizeNavigationPreferences(record.preferences);
    }
    return normalizeNavigationPreferences();
  }

  function loadNavigationPreferences(storage) {
    var value;
    try {
      value = storage && typeof storage.getItem === 'function' ? storage.getItem(PREFERENCE_STORAGE_KEY) : null;
      return value ? migrateNavigationPreferences(JSON.parse(value)) : normalizeNavigationPreferences();
    } catch (error) {
      return normalizeNavigationPreferences();
    }
  }

  function saveNavigationPreferences(preferences, storage) {
    var normalized = normalizeNavigationPreferences(preferences);
    try {
      if (storage && typeof storage.setItem === 'function') {
        storage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify({ version: PREFERENCE_SCHEMA_VERSION, preferences: normalized }));
      }
    } catch (error) {
      /* Storage can be disabled for local files; the active session still works. */
    }
    return normalized;
  }

  function didExceedDragThreshold(startX, startY, currentX, currentY, threshold) {
    var minimum = Number.isFinite(Number(threshold)) ? Number(threshold) : 3;
    return Math.hypot(Number(currentX) - Number(startX), Number(currentY) - Number(startY)) >= minimum;
  }

  function clampOrbitPolar(value) {
    return clamp(Number(value), 0.05, Math.PI - 0.05);
  }

  function clampOrbitDistance(value, minimum, maximum) {
    return clamp(Number(value), Math.max(Number(minimum) || 0.000001, 0.000001), Math.max(Number(maximum) || 1, Number(minimum) || 0.000001));
  }

  function zoomDistance(distance, delta, preferences, minimum, maximum) {
    var settings = normalizeNavigationPreferences(preferences);
    var signedDelta = settings.reverseZoom ? -Number(delta) : Number(delta);
    return clampOrbitDistance(Number(distance) * Math.exp(signedDelta * settings.zoomSensitivity), minimum, maximum);
  }

  function pinchDistance(first, second) {
    return Math.hypot(Number(second.clientX) - Number(first.clientX), Number(second.clientY) - Number(first.clientY));
  }

  function panPixelsToWorld(deltaX, deltaY, distance, verticalFovRadians, aspect, canvasHeight, sensitivity) {
    var height = Math.max(Number(canvasHeight) || 1, 1);
    var scaleY = 2 * Math.max(Number(distance) || 0, 0.000001) * Math.tan(Number(verticalFovRadians) / 2) / height;
    var scale = Number.isFinite(Number(sensitivity)) ? Number(sensitivity) : 1;
    return { x: -Number(deltaX) * scaleY * Number(aspect) * scale, y: Number(deltaY) * scaleY * scale };
  }

  function isEditableOrModalTarget(target, documentRef) {
    var node = target;
    var exclusiveInteraction = documentRef && documentRef.querySelectorAll
      ? Array.from(documentRef.querySelectorAll(
        '[role="dialog"][aria-modal="true"], [aria-haspopup][aria-expanded="true"], [data-ui-menu-group][data-open="true"]'
      )).find(function (candidate) {
        return !candidate.closest || !candidate.closest('[hidden]');
      })
      : null;
    if (exclusiveInteraction) { return true; }
    while (node) {
      var tag = String(node.tagName || '').toUpperCase();
      var role = node.getAttribute && String(node.getAttribute('role') || '').toLowerCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable === true ||
          (node.getAttribute && String(node.getAttribute('contenteditable')).toLowerCase() === 'true') ||
          tag === 'AUDIO' || tag === 'VIDEO' || role === 'dialog' || ARROW_NAVIGATION_ROLES.has(role)) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  function shouldHandleViewportArrowKey(event, canvas, documentRef) {
    var key = String(event && event.key || '');
    var documentObject = documentRef || root.document;
    if (!event || event.defaultPrevented || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(key) < 0 ||
        event.ctrlKey || event.metaKey || event.altKey) { return false; }
    if (!canvas || !documentObject) { return false; }
    return !isEditableOrModalTarget(event.target, documentObject);
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.DEFAULT_VIEWPORT_NAVIGATION_PREFERENCES = DEFAULT_PREFERENCES;
  root.SpjutsimFEA.VIEWPORT_NAVIGATION_PREFERENCE_SCHEMA_VERSION = PREFERENCE_SCHEMA_VERSION;
  root.SpjutsimFEA.normalizeViewportNavigationPreferences = normalizeNavigationPreferences;
  root.SpjutsimFEA.loadViewportNavigationPreferences = loadNavigationPreferences;
  root.SpjutsimFEA.saveViewportNavigationPreferences = saveNavigationPreferences;
  root.SpjutsimFEA.didExceedViewportDragThreshold = didExceedDragThreshold;
  root.SpjutsimFEA.clampViewportOrbitPolar = clampOrbitPolar;
  root.SpjutsimFEA.clampViewportOrbitDistance = clampOrbitDistance;
  root.SpjutsimFEA.zoomViewportDistance = zoomDistance;
  root.SpjutsimFEA.viewportPinchDistance = pinchDistance;
  root.SpjutsimFEA.viewportPanPixelsToWorld = panPixelsToWorld;
  root.SpjutsimFEA.isViewportEditableOrModalTarget = isEditableOrModalTarget;
  root.SpjutsimFEA.shouldHandleViewportArrowKey = shouldHandleViewportArrowKey;
}(globalThis));
