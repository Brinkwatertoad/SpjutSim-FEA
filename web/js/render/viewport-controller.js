(function (root) {
  'use strict';
  var AXIS_TRIAD_LENGTH_PX = 30;
  var AXIS_TRIAD_LABEL_OFFSET_PX = 42;
  var AXIS_TRIAD_LABEL_SIZE_PX = 21;
  var AXIS_TRIAD_SAFE_INSET_PX = 56;

  function themeColor(name, fallback) {
    var value = root.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function disposeMaterial(material) {
    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
    } else if (material && typeof material.dispose === 'function') {
      if (material.map && typeof material.map.dispose === 'function') { material.map.dispose(); }
      material.dispose();
    }
  }

  function cylinderConeArrow(direction, tip, length, color, name) {
    var unit = direction.clone().normalize();
    var headLength = length * 0.28;
    var shaftLength = length - headLength;
    var material = new root.THREE.MeshBasicMaterial({ color: color, depthTest: false });
    var shaft = new root.THREE.Mesh(new root.THREE.CylinderGeometry(length * 0.022, length * 0.022, shaftLength, 8), material);
    var head = new root.THREE.Mesh(new root.THREE.ConeGeometry(length * 0.075, headLength, 10), material);
    var group = new root.THREE.Group();
    shaft.name = 'glyph-shaft'; head.name = 'glyph-head';
    shaft.quaternion.setFromUnitVectors(new root.THREE.Vector3(0, 1, 0), unit);
    head.quaternion.copy(shaft.quaternion);
    shaft.position.copy(tip).addScaledVector(unit, -(headLength + shaftLength / 2));
    head.position.copy(tip).addScaledVector(unit, -headLength / 2);
    group.name = name || 'vector-glyph';
    group.userData.tipPositionM = tip.toArray();
    group.userData.tailPositionM = tip.clone().addScaledVector(unit, -length).toArray();
    group.add(shaft, head);
    return group;
  }

  function axisLabel(letter, color) {
    var canvas = document.createElement('canvas');
    var context;
    var texture;
    var sprite;
    canvas.width = 64; canvas.height = 64;
    context = canvas.getContext('2d');
    context.font = 'bold ' + (letter.length > 1 ? '36' : '44') + 'px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillStyle = color; context.fillText(letter, 32, 34);
    texture = new root.THREE.CanvasTexture(canvas);
    sprite = new root.THREE.Sprite(new root.THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.1, depthTest: true, depthWrite: true }));
    sprite.name = 'axis-triad-label-' + letter.toLowerCase();
    sprite.scale.set(AXIS_TRIAD_LABEL_SIZE_PX, AXIS_TRIAD_LABEL_SIZE_PX, 1);
    return sprite;
  }

  function disposeObjectResources(object) {
    object.traverse(function (child) {
      if (child.geometry && typeof child.geometry.dispose === 'function') {
        child.geometry.dispose();
      }
      disposeMaterial(child.material);
    });
  }

  function setMaterialTheme(material, color, emissive) {
    if (!material) { return; }
    if (Array.isArray(material)) {
      material.forEach(function (item, index) {
        setMaterialTheme(item, index === 0 ? color : emissive || color, index === 0 ? null : emissive);
      });
      return;
    }
    if (material.color && typeof material.color.set === 'function') { material.color.set(color); }
    if (emissive && material.emissive && typeof material.emissive.set === 'function') { material.emissive.set(emissive); }
  }

  function refreshViewportTheme(viewport) {
    var geometryColor = themeColor('--ui-color-geometry', '#f4f1ea');
    var selectionColor = themeColor('--ui-color-selection', '#93c5fd');
    var lineColor = themeColor('--ui-color-grid-major', '#334155');
    var featureEdges;
    if (viewport.scene && viewport.scene.background && typeof viewport.scene.background.set === 'function') {
      viewport.scene.background.set(themeColor('--ui-color-canvas', '#111827'));
    }
    if (viewport.previewMesh && Array.isArray(viewport.previewMesh.material)) {
      setMaterialTheme(viewport.previewMesh.material[0], geometryColor);
      setMaterialTheme(viewport.previewMesh.material[1], selectionColor, selectionColor);
    }
    if (viewport.importedGeometry && typeof viewport.importedGeometry.getObjectByName === 'function') {
      featureEdges = viewport.importedGeometry.getObjectByName('imported-geometry-feature-edges');
      if (featureEdges) { setMaterialTheme(featureEdges.material, lineColor); }
    }
    if (viewport.meshSurface && Array.isArray(viewport.meshSurface.material)) {
      setMaterialTheme(viewport.meshSurface.material[0], geometryColor);
      setMaterialTheme(viewport.meshSurface.material[1], selectionColor, selectionColor);
    }
    if (viewport.meshDisplay && viewport.meshDisplay.userData.lines) {
      setMaterialTheme(viewport.meshDisplay.userData.lines.material, lineColor);
    }
    if (viewport.resultDisplay && viewport.resultDisplay.userData.lines) {
      setMaterialTheme(viewport.resultDisplay.userData.lines.material, lineColor);
    }
    if (typeof viewport.rebuildReferenceGrid === 'function') { viewport.rebuildReferenceGrid(); }
    if (typeof viewport.rebuildAnalysisOverlay === 'function') { viewport.rebuildAnalysisOverlay(); }
    if (typeof viewport.rebuildAxisTriad === 'function') { viewport.rebuildAxisTriad(); }
  }

  /** Convert a pointer event from CSS pixels to canvas and Three.js coordinates. */
  function pointerToCanvasCoordinates(event, canvas) {
    var rect = canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    var normalizedX;
    var normalizedY;
    if (rect.width <= 0 || rect.height <= 0) { return null; }
    normalizedX = x / rect.width;
    normalizedY = y / rect.height;
    return {
      x: x,
      y: y,
      pixelX: x * canvas.width / rect.width,
      pixelY: y * canvas.height / rect.height,
      pixelRatioX: canvas.width / rect.width,
      pixelRatioY: canvas.height / rect.height,
      ndcX: normalizedX * 2 - 1,
      ndcY: 1 - normalizedY * 2
    };
  }

  function ViewportController(canvas) {
    if (!canvas) { throw new Error('Viewport canvas is required.'); }
    if (!root.THREE) { throw new Error('Repository-local Three.js did not load.'); }

    this.canvas = canvas;
    this.renderer = new root.THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    this.renderer.autoClear = false;
    this.renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    if ('outputColorSpace' in this.renderer) {
      this.renderer.outputColorSpace = root.THREE.SRGBColorSpace;
    } else {
      this.renderer.outputEncoding = root.THREE.sRGBEncoding;
    }
    this.scene = new root.THREE.Scene();
    this.scene.background = new root.THREE.Color(themeColor('--ui-color-canvas', '#111827'));
    this.camera = new root.THREE.OrthographicCamera(-2, 2, 2, -2, 0.01, 1000);
    this.camera.aspect = 1;
    this.camera.fov = 40;
    this.camera.position.set(3, 3, 3);
    this.viewAnimationFrame = null;
    this.peakMarker = null;
    this.camera.lookAt(0, 0, 0);
    this.axisTriadScene = new root.THREE.Scene();
    this.axisTriadCamera = new root.THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 200);
    this.axisTriadCamera.position.set(0, 0, 100);
    this.axisTriad = null;
    this.raycaster = new root.THREE.Raycaster();
    this.pointer = new root.THREE.Vector2();
    this.resizeObserver = null;
    this.resizeListener = null;
    this.pointerClickListener = null;
    this.pointerDownListener = null;
    this.pointerMoveListener = null;
    this.pointerUpListener = null;
    this.pointerCancelListener = null;
    this.pointerLostCaptureListener = null;
    this.wheelListener = null;
    this.contextMenuListener = null;
    this.keyDownListener = null;
    this.importedGeometry = null;
    this.previewMesh = null;
    this.meshDisplay = null;
    this.meshSurface = null;
    this.resultDisplay = null;
    this.resultSurface = null;
    this.resultModel = null;
    this.updatedResultModel = null;
    this.analysisOverlay = null;
    this.analysisOverlayState = null;
    this.themeObserver = null;
    this.presentation = { mode: 'model', displayStyle: 'lines' };
    this.deformationAnimationMultiplier = 1;
    this.selectedFaceIds = new Set();
    this.facePickHandler = null;
    this.probeHandler = null;
    this.viewTarget = new root.THREE.Vector3(0, 0, 0);
    this.modelCenter = new root.THREE.Vector3(0, 0, 0);
    this.orbitAzimuth = 0;
    this.orbitPolar = Math.PI / 2;
    this.orbitDistance = 1;
    this.minimumOrbitDistance = 0.01;
    this.maximumOrbitDistance = 1000;
    this.modelExtent = 1;
    this.pointerInteraction = null;
    this.activePointers = new Map();
    this.pinchDistance = null;
    this.suppressContextMenu = false;
    this.suppressNextClick = false;
    this.navigationPreferences = root.SpjutsimFEA.normalizeViewportNavigationPreferences();
    this.resetViewState = null;

    if (this.canvas.tabIndex < 0) { this.canvas.tabIndex = 0; }
    this.canvas.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown');
    this.addReferenceObjects();
    this.addLights();
    this.rebuildAxisTriad();
    this.observeTheme();
    this.observeResize();
    this.synchronizeOrbitFromCamera();
    this.observeCameraInteraction();
    this.observePointerPicking();
    this.observeGizmoInteraction();
    this.resize();
    this.resetViewState = this.captureViewState();
  }

  ViewportController.prototype.addLights = function () {
    var ambient = new root.THREE.HemisphereLight('#dbeafe', '#111827', 1.6);
    var key = new root.THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(4, 6, 5);
    this.scene.add(ambient, key);
  };

  ViewportController.prototype.addReferenceObjects = function () {
    var grid = new root.THREE.GridHelper(
      4,
      8,
      themeColor('--ui-color-grid-major', '#334155'),
      themeColor('--ui-color-grid-minor', '#1f2937')
    );
    var geometry = new root.THREE.BoxGeometry(0.72, 0.72, 0.72);
    var material = new root.THREE.MeshStandardMaterial({
      color: themeColor('--ui-color-geometry', '#f4f1ea'),
      roughness: 0.72,
      metalness: 0.04
    });
    var referenceObject = new root.THREE.Mesh(geometry, material);
    grid.name = 'reference-grid';
    referenceObject.name = 'reference-solid';
    referenceObject.position.y = 0.36;
    this.scene.add(grid, referenceObject);
  };

  ViewportController.prototype.rebuildReferenceGrid = function () {
    var current = this.scene.getObjectByName('reference-grid');
    var grid = new root.THREE.GridHelper(4, 8,
      themeColor('--ui-color-grid-major', '#334155'),
      themeColor('--ui-color-grid-minor', '#1f2937'));
    grid.name = 'reference-grid';
    if (current) { this.scene.remove(current); disposeObjectResources(current); }
    this.scene.add(grid);
    var referenceObject = this.scene.getObjectByName('reference-solid');
    if (referenceObject) { setMaterialTheme(referenceObject.material, themeColor('--ui-color-geometry', '#f4f1ea')); }
  };

  ViewportController.prototype.rebuildAxisTriad = function () {
    var group = new root.THREE.Group();
    var definitions = [
      ['x', new root.THREE.Vector3(1, 0, 0), themeColor('--ui-color-axis-x', '#ef4444')],
      ['y', new root.THREE.Vector3(0, 1, 0), themeColor('--ui-color-axis-y', '#22c55e')],
      ['z', new root.THREE.Vector3(0, 0, 1), themeColor('--ui-color-axis-z', '#3b82f6')]
    ];
    if (this.axisTriad) { this.axisTriadScene.remove(this.axisTriad); disposeObjectResources(this.axisTriad); }
    var active = Boolean(this.gizmoActive);
    definitions.forEach(function (definition) {
      var endpoint = definition[1].clone().multiplyScalar(AXIS_TRIAD_LENGTH_PX);
      var arrow = cylinderConeArrow(definition[1], endpoint, AXIS_TRIAD_LENGTH_PX, definition[2], 'axis-triad-' + definition[0]);
      var label = axisLabel(definition[0].toUpperCase(), definition[2]);
      label.position.copy(definition[1]).multiplyScalar(AXIS_TRIAD_LABEL_OFFSET_PX);
      arrow.traverse(function (part) { if (part.material) { part.material.depthTest = true; part.material.depthWrite = true; } });
      var negative = axisLabel('-' + definition[0].toUpperCase(), definition[2]);
      negative.position.copy(definition[1]).multiplyScalar(-AXIS_TRIAD_LABEL_OFFSET_PX);
      negative.visible = active;
      group.add(arrow, label, negative);
    });
    group.name = 'axis-triad';
    this.axisTriadScene.add(group);
    this.axisTriad = group;
    this.layoutAxisTriad(Math.max(1, this.canvas.clientWidth), Math.max(1, this.canvas.clientHeight));
  };

  ViewportController.prototype.layoutAxisTriad = function (width, height) {
    this.axisTriadCamera.left = -width / 2;
    this.axisTriadCamera.right = width / 2;
    this.axisTriadCamera.top = height / 2;
    this.axisTriadCamera.bottom = -height / 2;
    this.axisTriadCamera.updateProjectionMatrix();
    if (this.axisTriad) {
      var bounds = this.canvas.parentElement && this.canvas.parentElement.querySelector('.fea-gizmo-bounds');
      this.gizmoQuaternion = null;
      this.gizmoButtons = bounds ? Array.from(bounds.querySelectorAll('[data-view-orientation]')) : [];
      var rect = bounds && bounds.getBoundingClientRect();
      this.gizmoSize = rect ? { width: rect.width, height: rect.height } : null;
      var canvasRect = this.canvas.getBoundingClientRect();
      this.axisTriad.position.set(
        -width / 2 + (rect && rect.width ? rect.left - canvasRect.left + rect.width / 2 : AXIS_TRIAD_SAFE_INSET_PX),
        height / 2 - (rect && rect.height ? rect.top - canvasRect.top + rect.height / 2 : height - AXIS_TRIAD_SAFE_INSET_PX), 0);
    }
  };

  ViewportController.prototype.updateGizmoTargets = function () {
    if (!this.gizmoSize || !this.gizmoButtons || !this.gizmoButtons.length) { return; }
    if (this.gizmoQuaternion && this.gizmoQuaternion.equals(this.axisTriad.quaternion)) { return; }
    if (!this.gizmoQuaternion) { this.gizmoQuaternion = new root.THREE.Quaternion(); }
    this.gizmoQuaternion.copy(this.axisTriad.quaternion);
    var self = this;
    var direction = new root.THREE.Vector3();
    this.gizmoButtons.forEach(function (button) {
      var name = button.dataset.viewOrientation;
      if (!/^[+-][xyz]$/.test(name)) { return; }
      direction.set(0, 0, 0); direction[name[1]] = name[0] === '+' ? 1 : -1;
      direction.applyQuaternion(self.axisTriad.quaternion);
      button.style.left = (self.gizmoSize.width / 2 + direction.x * AXIS_TRIAD_LABEL_OFFSET_PX) + 'px';
      button.style.top = (self.gizmoSize.height / 2 - direction.y * AXIS_TRIAD_LABEL_OFFSET_PX) + 'px';
      button.style.zIndex = String(10 + Math.round(direction.z * 5));
      button.dataset.depth = direction.z < 0 ? 'back' : 'front';
    });
  };

  ViewportController.prototype.observeTheme = function () {
    var self = this;
    if (typeof root.MutationObserver !== 'function') { return; }
    this.themeObserver = new root.MutationObserver(function () {
      refreshViewportTheme(self);
      self.render();
    });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-color-scheme', 'data-theme'] });
  };

  ViewportController.prototype.observePointerPicking = function () {
    var self = this;
    this.pointerClickListener = function (event) {
      var faceId;
      if (event.button !== 0) { return; }
      if (self.suppressNextClick) {
        self.suppressNextClick = false;
        return;
      }
      if ((self.presentation.mode === 'stress' || self.presentation.mode === 'deformation') && self.resultModel) {
        self.selectResultPoint(self.pickResultAtPointer(event));
        return;
      }
      faceId = self.pickFaceAtPointer(event);
      if (self.facePickHandler) {
        self.facePickHandler(faceId, Boolean(event.shiftKey));
      }
    };
    this.canvas.addEventListener('click', this.pointerClickListener);
    this.draftHoverListener = function (event) {
      if (!self.assignmentDraftActive || self.activePointers.size) { return; }
      self.draftHoverPointer = {clientX:event.clientX,clientY:event.clientY};
      if (self.draftHoverFrame) { return; }
      self.draftHoverFrame = root.requestAnimationFrame(function () {
        self.draftHoverFrame = null;
        self.showDraftHover(self.assignmentDraftActive ? self.pickFaceAtPointer(self.draftHoverPointer) : null);
      });
    };
    this.draftHoverLeave = function () { self.showDraftHover(null); };
    this.canvas.addEventListener('pointermove',this.draftHoverListener);
    this.canvas.addEventListener('pointerleave',this.draftHoverLeave);
  };

  ViewportController.prototype.observeGizmoInteraction = function () {
    if (this.disposeGizmoInteraction) { this.disposeGizmoInteraction(); }
    var bounds = this.canvas.parentElement && this.canvas.parentElement.querySelector('.fea-gizmo-bounds');
    if (!bounds) { return; }
    var self = this; var gesture = null; var suppressClick = false;
    function target(event) {
      var button = event.target.closest && event.target.closest('[data-view-orientation]');
      return button && bounds.contains(button) ? button : null;
    }
    var hovered = false;
    var touchMedia = root.matchMedia && root.matchMedia('(hover: none)');
    function refresh(focused) {
      var hasFocus = typeof focused === 'boolean' ? focused : Boolean(bounds.querySelector(':focus-visible'));
      self.gizmoActive = hovered || hasFocus || Boolean(touchMedia && touchMedia.matches);
      bounds.dataset.active = String(self.gizmoActive);
      ['x', 'y', 'z'].forEach(function (axis) {
        self.axisTriad.getObjectByName('axis-triad-label--' + axis).visible = self.gizmoActive;
      });
      self.render();
    }
    var listeners = {
      pointerenter: function () { hovered = true; refresh(); },
      pointerleave: function () { hovered = false; refresh(); },
      focusin: refresh,
      focusout: function (event) {
        // activeElement still points at the old target during focusout.
        refresh(Boolean(event.relatedTarget && bounds.contains(event.relatedTarget) && event.relatedTarget.matches(':focus-visible')));
      },
      pointerdown: function (event) {
        var button = target(event);
        if (!button || event.button !== 0) { return; }
        self.cancelViewAnimation(); suppressClick = false;
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, button: button, moved: false };
        try { button.setPointerCapture(event.pointerId); } catch (error) { /* Synthetic or cancelled pointer. */ }
      },
      pointermove: function (event) {
        if (gesture && gesture.id === event.pointerId && root.SpjutsimFEA.didExceedViewportDragThreshold(
          gesture.x, gesture.y, event.clientX, event.clientY, 3)) { gesture.moved = true; }
      },
      pointerup: function (event) {
        if (!gesture || gesture.id !== event.pointerId) { return; }
        suppressClick = gesture.moved;
        var button = gesture.button; gesture = null;
        if (button.hasPointerCapture(event.pointerId)) { button.releasePointerCapture(event.pointerId); }
      },
      pointercancel: function (event) {
        if (!gesture || gesture.id !== event.pointerId) { return; }
        suppressClick = true; gesture = null;
      },
      lostpointercapture: function (event) {
        if (gesture && gesture.id === event.pointerId) { suppressClick = true; gesture = null; }
      },
      click: function (event) {
        var button = target(event);
        if (!button || event.button !== 0) { return; }
        event.stopPropagation();
        if (event.detail > 0 && suppressClick) { suppressClick = false; return; }
        self.setViewOrientation(button.dataset.viewOrientation);
      }
    };
    Object.keys(listeners).forEach(function (type) { bounds.addEventListener(type, listeners[type]); });
    if (touchMedia && touchMedia.addEventListener) { touchMedia.addEventListener('change', refresh); }
    refresh();
    this.cancelGizmoGesture = function () { if (gesture) { suppressClick = true; gesture = null; } };
    this.disposeGizmoInteraction = function () {
      Object.keys(listeners).forEach(function (type) { bounds.removeEventListener(type, listeners[type]); });
      if (touchMedia && touchMedia.removeEventListener) { touchMedia.removeEventListener('change', refresh); }
      gesture = null;
    };
  };

  ViewportController.prototype.synchronizeOrbitFromCamera = function (preserveScale) {
    var offset = new root.THREE.Vector3().subVectors(this.camera.position, this.viewTarget);
    var distance = Math.max(offset.length(), this.minimumOrbitDistance);
    if (!preserveScale) { this.orbitDistance = distance; }
    this.orbitPolar = Math.acos(Math.max(-1, Math.min(1, offset.y / distance)));
    this.orbitAzimuth = Math.atan2(offset.x, offset.z);
  };

  ViewportController.prototype.applyOrbitCamera = function () {
    var sinPolar = Math.sin(this.orbitPolar);
    var distance = this.camera.isOrthographicCamera ? Math.max(this.orbitDistance, this.modelExtent * 2) : this.orbitDistance;
    this.camera.position.set(
      this.viewTarget.x + distance * sinPolar * Math.sin(this.orbitAzimuth),
      this.viewTarget.y + distance * Math.cos(this.orbitPolar),
      this.viewTarget.z + distance * sinPolar * Math.cos(this.orbitAzimuth)
    );
    this.camera.lookAt(this.viewTarget);
    this.updateCameraProjection();
    this.camera.updateMatrixWorld();
    this.render();
  };

  ViewportController.prototype.updateCameraProjection = function () {
    // Orbit distance represents equivalent perspective scale for both projections.
    // This keeps wheel, pinch and pan sensitivity continuous across camera changes.
    // Orthographic eye distance stays outside the solid even at high magnification.
    if (this.camera.isOrthographicCamera) {
      var halfHeight = this.orbitDistance * Math.tan(this.camera.fov * Math.PI / 360);
      this.camera.top = halfHeight; this.camera.bottom = -halfHeight;
      this.camera.right = halfHeight * this.camera.aspect; this.camera.left = -this.camera.right;
      this.camera.zoom = 1;
    }
    this.camera.near = Math.max(this.modelExtent * 0.0001, 1e-9);
    this.camera.far = Math.max(this.camera.position.distanceTo(this.viewTarget) + this.modelExtent * 4, this.camera.near * 100);
    this.camera.updateProjectionMatrix();
  };

  ViewportController.prototype.getProjection = function () {
    return this.camera.isOrthographicCamera ? 'orthographic' : 'perspective';
  };

  ViewportController.prototype.cancelViewAnimation = function () {
    if (this.viewAnimationFrame !== null) { root.cancelAnimationFrame(this.viewAnimationFrame); }
    this.viewAnimationFrame = null;
  };

  ViewportController.prototype.setProjection = function (projection) {
    if (projection !== 'orthographic' && projection !== 'perspective') { throw new Error('Unknown camera projection.'); }
    this.cancelViewAnimation();
    if (this.activePointers.size) { this.suppressNextClick = true; }
    this.activePointers.clear(); this.pointerInteraction = null; this.pinchDistance = null;
    if (this.cancelGizmoGesture) { this.cancelGizmoGesture(); }
    this.navigationPreferences.projection = projection;
    if (projection === this.getProjection()) { return projection; }
    var previous = this.camera;
    if (previous.isOrthographicCamera) {
      this.orbitDistance = (previous.top - previous.bottom) / previous.zoom / (2 * Math.tan(previous.fov * Math.PI / 360));
    }
    this.camera = projection === 'orthographic' ? new root.THREE.OrthographicCamera() : new root.THREE.PerspectiveCamera();
    this.camera.fov = previous.fov; this.camera.aspect = previous.aspect;
    this.camera.up.copy(previous.up); this.camera.quaternion.copy(previous.quaternion);
    this.applyOrbitCamera();
    return projection;
  };

  ViewportController.prototype.setViewOrientation = function (orientation, options) {
    var directions = { isometric: [1, 1, 1], '+x': [1, 0, 0], '-x': [-1, 0, 0],
      '+y': [0, 1, 0], '-y': [0, -1, 0], '+z': [0, 0, 1], '-z': [0, 0, -1] };
    if (!Object.prototype.hasOwnProperty.call(directions, orientation)) { throw new Error('Unknown camera orientation.'); }
    this.cancelViewAnimation();
    var direction = new root.THREE.Vector3().fromArray(directions[orientation]).normalize();
    var up = new root.THREE.Vector3(0, 1, 0);
    if (orientation === '+y') { up.set(0, 0, -1); }
    if (orientation === '-y') { up.set(0, 0, 1); }
    var finalCamera = this.camera.clone();
    var eyeDistance = this.camera.position.distanceTo(this.viewTarget);
    finalCamera.position.copy(this.viewTarget).addScaledVector(direction, eyeDistance);
    finalCamera.up.copy(up); finalCamera.lookAt(this.viewTarget);
    this.animateViewTo(finalCamera, this.viewTarget.clone(), this.orbitDistance, options);
    return orientation;
  };

  ViewportController.prototype.animateViewTo = function (finalCamera, finalTarget, finalDistance, options) {
    this.cancelViewAnimation();
    var self = this;
    function finish() {
      self.viewTarget.copy(finalTarget); self.orbitDistance = finalDistance;
      self.camera.position.copy(finalCamera.position); self.camera.up.copy(finalCamera.up);
      self.camera.quaternion.copy(finalCamera.quaternion); self.updateCameraProjection(); self.camera.updateMatrixWorld();
      self.synchronizeOrbitFromCamera(true); self.viewAnimationFrame = null; self.render();
    }
    if ((options && options.animate === false) || (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      finish(); return;
    }
    var start = this.camera.quaternion.clone(); var pose = start.clone();
    var startTarget = this.viewTarget.clone();
    var startDistance = this.orbitDistance;
    var startEyeDistance = this.camera.position.distanceTo(startTarget);
    var finalEyeDistance = finalCamera.position.distanceTo(finalTarget);
    var startTime = null;
    function frame(time) {
      if (startTime === null) { startTime = time; }
      var fraction = Math.min((time - startTime) / 180, 1);
      if (fraction === 1) { finish(); return; }
      var eased = fraction * fraction * (3 - 2 * fraction);
      pose.copy(start).slerp(finalCamera.quaternion, eased);
      self.viewTarget.copy(startTarget).lerp(finalTarget, eased);
      self.orbitDistance = startDistance + (finalDistance - startDistance) * eased;
      self.camera.position.set(0, 0, startEyeDistance + (finalEyeDistance - startEyeDistance) * eased).applyQuaternion(pose).add(self.viewTarget);
      self.camera.up.set(0, 1, 0).applyQuaternion(pose);
      self.camera.quaternion.copy(pose); self.updateCameraProjection(); self.camera.updateMatrixWorld();
      self.synchronizeOrbitFromCamera(true); self.render();
      self.viewAnimationFrame = root.requestAnimationFrame(frame);
    }
    this.viewAnimationFrame = root.requestAnimationFrame(frame);
  };

  ViewportController.prototype.captureViewState = function () {
    return {
      target: [this.viewTarget.x, this.viewTarget.y, this.viewTarget.z],
      azimuth: this.orbitAzimuth,
      polar: this.orbitPolar,
      distance: this.orbitDistance,
      up: this.camera.up.toArray()
    };
  };

  ViewportController.prototype.restoreViewState = function (state) {
    if (!state || !Array.isArray(state.target) || state.target.length !== 3) { return; }
    this.viewTarget.set(Number(state.target[0]), Number(state.target[1]), Number(state.target[2]));
    this.orbitAzimuth = Number(state.azimuth) || 0;
    this.cancelViewAnimation();
    this.orbitPolar = Math.max(0, Math.min(Math.PI, Number(state.polar)));
    this.camera.up.fromArray(state.up || [0, 1, 0]);
    this.orbitDistance = root.SpjutsimFEA.clampViewportOrbitDistance(state.distance, this.minimumOrbitDistance, this.maximumOrbitDistance);
    this.applyOrbitCamera();
  };

  ViewportController.prototype.resetView = function (options) {
    var state = this.resetViewState;
    if (!state) { return; }
    var target = new root.THREE.Vector3().fromArray(state.target);
    var distance = root.SpjutsimFEA.clampViewportOrbitDistance(state.distance, this.minimumOrbitDistance, this.maximumOrbitDistance);
    var eyeDistance = this.camera.isOrthographicCamera ? Math.max(distance, this.modelExtent * 2) : distance;
    var finalCamera = this.camera.clone();
    finalCamera.position.set(Math.sin(state.polar) * Math.sin(state.azimuth), Math.cos(state.polar),
      Math.sin(state.polar) * Math.cos(state.azimuth)).multiplyScalar(eyeDistance).add(target);
    finalCamera.up.fromArray(state.up || [0, 1, 0]); finalCamera.lookAt(target);
    this.animateViewTo(finalCamera, target, distance, options);
  };

  ViewportController.prototype.setNavigationPreferences = function (preferences) {
    this.navigationPreferences = root.SpjutsimFEA.normalizeViewportNavigationPreferences(preferences);
    this.setProjection(this.navigationPreferences.projection);
    return this.navigationPreferences;
  };

  ViewportController.prototype.getNavigationPreferences = function () {
    return Object.assign({}, this.navigationPreferences);
  };

  ViewportController.prototype.orbitByPixels = function (deltaX, deltaY) {
    this.cancelViewAnimation();
    this.camera.up.set(0, 1, 0);
    this.orbitAzimuth -= deltaX * this.navigationPreferences.rotateSensitivity;
    this.orbitPolar = root.SpjutsimFEA.clampViewportOrbitPolar(
      this.orbitPolar - deltaY * this.navigationPreferences.rotateSensitivity
    );
    this.applyOrbitCamera();
  };

  ViewportController.prototype.orbitByRadians = function (azimuth, polar) {
    this.cancelViewAnimation();
    this.camera.up.set(0, 1, 0);
    this.orbitAzimuth += Number(azimuth) || 0;
    this.orbitPolar = root.SpjutsimFEA.clampViewportOrbitPolar(this.orbitPolar + (Number(polar) || 0));
    this.applyOrbitCamera();
  };

  ViewportController.prototype.panByPixels = function (deltaX, deltaY) {
    this.cancelViewAnimation();
    var cameraDirection = new root.THREE.Vector3();
    var right = new root.THREE.Vector3();
    var up = new root.THREE.Vector3();
    var movement;
    var dimensions = root.SpjutsimFEA.viewportPanPixelsToWorld(
      deltaX, deltaY, this.orbitDistance, this.camera.fov * Math.PI / 180, this.camera.aspect,
      this.canvas.clientHeight, this.navigationPreferences.panSensitivity
    );
    this.camera.getWorldDirection(cameraDirection);
    right.crossVectors(cameraDirection, this.camera.up).normalize();
    up.crossVectors(right, cameraDirection).normalize();
    movement = right.multiplyScalar(dimensions.x).add(up.multiplyScalar(dimensions.y));
    this.viewTarget.add(movement);
    this.camera.position.add(movement);
    this.camera.lookAt(this.viewTarget);
    this.camera.updateMatrixWorld();
    this.render();
  };

  ViewportController.prototype.zoomByWheelDelta = function (deltaY) {
    this.cancelViewAnimation();
    this.orbitDistance = root.SpjutsimFEA.zoomViewportDistance(
      this.orbitDistance, deltaY, this.navigationPreferences, this.minimumOrbitDistance, this.maximumOrbitDistance
    );
    this.applyOrbitCamera();
  };

  function fitOrbitDistance(camera, extent, minimum, maximum) {
    var verticalFov = camera.fov * Math.PI / 180;
    var horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(camera.aspect,0.01));
    return root.SpjutsimFEA.clampViewportOrbitDistance(extent * 0.95 / Math.sin(Math.min(verticalFov,horizontalFov) / 2),minimum,maximum);
  }

  ViewportController.prototype.fitModel = function (center, extent, makeResetView) {
    this.cancelViewAnimation();
    var safeExtent = Math.max(Number(extent) || 0, 0.000001);
    this.modelCenter.copy(center || new root.THREE.Vector3());
    this.viewTarget.copy(this.modelCenter);
    this.modelExtent = safeExtent;
    this.minimumOrbitDistance = Math.max(safeExtent * 0.02, 0.000001);
    this.maximumOrbitDistance = Math.max(safeExtent * 100, 10);
    this.orbitDistance = fitOrbitDistance(this.camera,safeExtent,this.minimumOrbitDistance,this.maximumOrbitDistance);
    if (makeResetView !== false) {
      this.orbitAzimuth = Math.PI / 4;
      this.orbitPolar = Math.acos(1 / Math.sqrt(3));
      this.camera.up.set(0, 1, 0);
    }
    if (makeResetView !== false) { this.resetViewState = this.captureViewState(); }
    this.applyOrbitCamera();
  };

  ViewportController.prototype.fitCurrentModel = function (options) {
    var target = this.modelCenter.clone();
    var distance = fitOrbitDistance(this.camera,this.modelExtent,this.minimumOrbitDistance,this.maximumOrbitDistance);
    var eyeDistance = this.camera.isOrthographicCamera ? Math.max(distance,this.modelExtent*2) : distance;
    var finalCamera = this.camera.clone();
    finalCamera.position.set(0,0,eyeDistance).applyQuaternion(this.camera.quaternion).add(target);
    this.animateViewTo(finalCamera,target,distance,options);
  };

  ViewportController.prototype.observeCameraInteraction = function () {
    var self = this;
    this.canvas.style.touchAction = 'none';
    this.pointerDownListener = function (event) {
      var isTouch = event.pointerType === 'touch';
      var isNavigationButton = isTouch || event.button === self.navigationPreferences.rotateButton || event.button === self.navigationPreferences.panButton;
      if (!isNavigationButton) { return; }
      if (event.button === 1) { event.preventDefault(); }
      self.cancelViewAnimation();
      self.suppressNextClick = false;
      self.canvas.focus({ preventScroll: true });
      self.activePointers.set(event.pointerId, {
        pointerId: event.pointerId, pointerType: event.pointerType, button: event.button,
        startX: event.clientX, startY: event.clientY, previousX: event.clientX, previousY: event.clientY,
        clientX: event.clientX, clientY: event.clientY, moved: false
      });
      if (event.button === 2) { self.suppressContextMenu = true; }
      if (isTouch && self.activePointers.size >= 2) {
        var touches = Array.from(self.activePointers.values()).filter(function (point) { return point.pointerType === 'touch'; });
        if (touches.length < 2) { return; }
        self.pointerInteraction = null;
        self.pinchDistance = root.SpjutsimFEA.viewportPinchDistance(touches[0], touches[1]);
      } else {
      self.pointerInteraction = {
        pointerId: event.pointerId,
        button: event.button,
        mode: isTouch || event.button === self.navigationPreferences.rotateButton ? 'rotate' : 'pan'
      };
      }
      if (typeof self.canvas.setPointerCapture === 'function') {
        try { self.canvas.setPointerCapture(event.pointerId); } catch (error) { /* Synthetic or already-cancelled pointers have no capture. */ }
      }
    };
    this.pointerMoveListener = function (event) {
      var point = self.activePointers.get(event.pointerId);
      var interaction;
      var deltaX;
      var deltaY;
      if (!point) { return; }
      deltaX = event.clientX - point.previousX;
      deltaY = event.clientY - point.previousY;
      point.previousX = event.clientX;
      point.previousY = event.clientY;
      point.clientX = event.clientX;
      point.clientY = event.clientY;
      var activeTouches = Array.from(self.activePointers.values()).filter(function (entry) { return entry.pointerType === 'touch'; });
      if (activeTouches.length >= 2) {
        var touches = activeTouches;
        var nextPinchDistance = root.SpjutsimFEA.viewportPinchDistance(touches[0], touches[1]);
        if (self.pinchDistance && nextPinchDistance > 0) {
          self.orbitDistance = root.SpjutsimFEA.clampViewportOrbitDistance(
            self.orbitDistance * (self.navigationPreferences.reverseZoom
              ? nextPinchDistance / self.pinchDistance
              : self.pinchDistance / nextPinchDistance),
            self.minimumOrbitDistance, self.maximumOrbitDistance
          );
          self.applyOrbitCamera();
          self.suppressNextClick = true;
        }
        self.pinchDistance = nextPinchDistance;
        return;
      }
      interaction = self.pointerInteraction;
      if (!interaction || interaction.pointerId !== event.pointerId) { return; }
      if (root.SpjutsimFEA.didExceedViewportDragThreshold(point.startX, point.startY, event.clientX, event.clientY, 3)) {
        point.moved = true;
        if (interaction.button === 0 || point.pointerType === 'touch') { self.suppressNextClick = true; }
        if (interaction.mode === 'rotate') { self.orbitByPixels(deltaX, deltaY); }
        else { self.panByPixels(deltaX, deltaY); }
      }
    };
    this.pointerUpListener = function (event) {
      var remaining;
      self.activePointers.delete(event.pointerId);
      if (self.pointerInteraction && self.pointerInteraction.pointerId === event.pointerId) { self.pointerInteraction = null; }
      self.pinchDistance = null;
      remaining = Array.from(self.activePointers.values());
      if (remaining.length === 1 && remaining[0].pointerType === 'touch') {
        remaining[0].startX = remaining[0].previousX;
        remaining[0].startY = remaining[0].previousY;
        self.pointerInteraction = { pointerId: remaining[0].pointerId, button: 0, mode: 'rotate' };
      }
      if (typeof self.canvas.releasePointerCapture === 'function' && self.canvas.hasPointerCapture(event.pointerId)) {
        try { self.canvas.releasePointerCapture(event.pointerId); } catch (error) { /* Capture can disappear before cancellation is delivered. */ }
      }
    };
    this.pointerCancelListener = function (event) {
      self.pointerUpListener(event);
      if (self.activePointers.size === 0) {
        self.suppressNextClick = false;
        self.suppressContextMenu = false;
      }
    };
    this.pointerLostCaptureListener = function (event) {
      var interrupted = self.activePointers.has(event.pointerId);
      self.pointerUpListener(event);
      if (interrupted && self.activePointers.size === 0) {
        self.suppressNextClick = false;
        self.suppressContextMenu = false;
      }
    };
    this.wheelListener = function (event) {
      event.preventDefault();
      self.zoomByWheelDelta(event.deltaY);
    };
    this.contextMenuListener = function (event) {
      if (!self.suppressContextMenu) { return; }
      event.preventDefault();
      self.suppressContextMenu = false;
    };
    this.keyDownListener = function (event) {
      var step;
      if (!root.SpjutsimFEA.shouldHandleViewportArrowKey(event, self.canvas, document)) { return; }
      step = self.navigationPreferences.arrowStep;
      event.preventDefault();
      if (event.key === 'ArrowLeft') { self.orbitByRadians(step, 0); }
      if (event.key === 'ArrowRight') { self.orbitByRadians(-step, 0); }
      if (event.key === 'ArrowUp') { self.orbitByRadians(0, -step); }
      if (event.key === 'ArrowDown') { self.orbitByRadians(0, step); }
    };
    this.canvas.addEventListener('pointerdown', this.pointerDownListener);
    this.canvas.addEventListener('pointermove', this.pointerMoveListener);
    this.canvas.addEventListener('pointerup', this.pointerUpListener);
    this.canvas.addEventListener('pointercancel', this.pointerCancelListener);
    this.canvas.addEventListener('lostpointercapture', this.pointerLostCaptureListener);
    this.canvas.addEventListener('wheel', this.wheelListener, { passive: false });
    this.canvas.addEventListener('contextmenu', this.contextMenuListener);
    document.addEventListener('keydown', this.keyDownListener);
  };

  ViewportController.prototype.setFacePickHandler = function (handler) {
    if (handler !== null && typeof handler !== 'function') {
      throw new Error('Face pick handler must be a function or null.');
    }
    this.facePickHandler = handler;
  };

  ViewportController.prototype.setProbeHandler = function (handler) {
    if (handler !== null && typeof handler !== 'function') { throw new Error('Probe handler must be a function or null.'); }
    this.probeHandler = handler;
  };

  ViewportController.prototype.clearGeometryPreview = function () {
    this.clearDraftHover();
    this.selectionPreview = null; this.selectionMesh = null; this.selectionKey = null;
    if (this.importedGeometry) {
      this.scene.remove(this.importedGeometry);
      disposeObjectResources(this.importedGeometry);
    }
    this.importedGeometry = null;
    this.previewMesh = null;
    this.clearMeshDisplay();
    this.clearResultDisplay();
    this.clearAnalysisOverlay();
    this.selectedFaceIds.clear();
    this.scene.getObjectByName('reference-solid').visible = true;
    this.render();
  };

  ViewportController.prototype.setGeometryPreview = function (geometryModel) {
    var validation = root.SpjutsimFEA.validateGeometryModel(geometryModel);
    var preview;
    var geometry;
    var surfaceMaterials;
    var surfaceMesh;
    var featureEdges;
    var edgeMaterial;
    var importedGeometry;
    var triangleFaceIndices;
    var faceIdsByRange;
    var centerX;
    var centerY;
    var centerZ;
    var extent;
    var rangeIndex;
    var triangleIndex;
    if (!validation.valid) { throw new Error('Invalid geometry preview: ' + validation.reason); }
    this.clearGeometryPreview();
    preview = geometryModel.preview;
    geometry = new root.THREE.BufferGeometry();
    geometry.setAttribute('position', new root.THREE.BufferAttribute(new Float32Array(preview.positionsM), 3));
    geometry.setIndex(new root.THREE.BufferAttribute(new Uint32Array(preview.indices), 1));
    geometry.setAttribute('normal', new root.THREE.BufferAttribute(new Float32Array(preview.normals), 3));
    geometry.clearGroups();
    triangleFaceIndices = new Uint32Array(preview.indices.length / 3);
    faceIdsByRange = new Array(preview.faceRanges.length);
    for (rangeIndex = 0; rangeIndex < preview.faceRanges.length; rangeIndex += 1) {
      geometry.addGroup(preview.faceRanges[rangeIndex].start, preview.faceRanges[rangeIndex].count, 0);
      faceIdsByRange[rangeIndex] = preview.faceRanges[rangeIndex].faceId;
      for (triangleIndex = preview.faceRanges[rangeIndex].start / 3;
           triangleIndex < (preview.faceRanges[rangeIndex].start + preview.faceRanges[rangeIndex].count) / 3;
           triangleIndex += 1) {
        triangleFaceIndices[triangleIndex] = rangeIndex;
      }
    }
    surfaceMaterials = [
      new root.THREE.MeshStandardMaterial({
        color: themeColor('--ui-color-geometry', '#f4f1ea'), roughness: 0.72, metalness: 0.04,
        flatShading: false, side: root.THREE.DoubleSide
      }),
      new root.THREE.MeshStandardMaterial({
        color: themeColor('--ui-color-selection', '#93c5fd'), roughness: 0.58, metalness: 0.02,
        emissive: themeColor('--ui-color-selection', '#93c5fd'), emissiveIntensity: 0.42,
        flatShading: false, side: root.THREE.DoubleSide
      })
    ];
    surfaceMesh = new root.THREE.Mesh(geometry, surfaceMaterials);
    surfaceMesh.name = 'imported-geometry-surface';
    surfaceMesh.userData.triangleFaceIndices = triangleFaceIndices;
    surfaceMesh.userData.faceIdsByRange = faceIdsByRange;
    surfaceMesh.userData.geometryId = geometryModel.geometryId;
    edgeMaterial = new root.THREE.LineBasicMaterial({
      color: themeColor('--ui-color-grid-major', '#334155'), transparent: true, opacity: 0.9
    });
    featureEdges = new root.THREE.BufferGeometry();
    featureEdges.setAttribute('position', new root.THREE.BufferAttribute(new Float32Array(preview.featureEdges.positionsM), 3));
    featureEdges.setIndex(new root.THREE.BufferAttribute(new Uint32Array(preview.featureEdges.indices), 1));
    featureEdges = new root.THREE.LineSegments(featureEdges, edgeMaterial);
    featureEdges.name = 'imported-geometry-feature-edges';
    importedGeometry = new root.THREE.Group();
    importedGeometry.name = 'imported-geometry';
    importedGeometry.add(surfaceMesh, featureEdges);
    this.scene.add(importedGeometry);
    this.importedGeometry = importedGeometry;
    this.previewMesh = surfaceMesh;
    this.applyPresentation();
    this.scene.getObjectByName('reference-solid').visible = false;
    centerX = (geometryModel.boundingBoxM.minM[0] + geometryModel.boundingBoxM.maxM[0]) / 2;
    centerY = (geometryModel.boundingBoxM.minM[1] + geometryModel.boundingBoxM.maxM[1]) / 2;
    centerZ = (geometryModel.boundingBoxM.minM[2] + geometryModel.boundingBoxM.maxM[2]) / 2;
    extent = Math.max(
      geometryModel.boundingBoxM.maxM[0] - geometryModel.boundingBoxM.minM[0],
      geometryModel.boundingBoxM.maxM[1] - geometryModel.boundingBoxM.minM[1],
      geometryModel.boundingBoxM.maxM[2] - geometryModel.boundingBoxM.minM[2]
    );
    this.fitModel(new root.THREE.Vector3(centerX, centerY, centerZ), extent, true);
    this.suppressNextClick = false;
  };

  ViewportController.prototype.clearMeshDisplay = function () {
    this.selectionMesh = null;
    if (this.meshSurface && this.draftHoverSource === this.meshSurface.geometry) { this.clearDraftHover(); }
    if (!this.meshDisplay) { return; }
    this.scene.remove(this.meshDisplay);
    disposeObjectResources(this.meshDisplay);
    this.meshDisplay = null;
    this.meshSurface = null;
  };

  ViewportController.prototype.setMeshDisplay = function (mesh) {
    var display;
    var geometry;
    var surface;
    var lines;
    var materials;
    var lineMaterial;
    var group;
    var rangeIndex;
    if (!mesh) { this.clearMeshDisplay(); this.applyPresentation(); this.render(); return; }
    display = root.SpjutsimFEA.buildBoundaryMeshDisplay(mesh);
    this.clearMeshDisplay();
    geometry = new root.THREE.BufferGeometry();
    geometry.setAttribute('position', new root.THREE.BufferAttribute(new Float32Array(display.positionsM), 3));
    geometry.setIndex(new root.THREE.BufferAttribute(new Uint32Array(display.triangleIndices), 1));
    geometry.computeVertexNormals();
    geometry.clearGroups();
    for (rangeIndex = 0; rangeIndex < display.faceRanges.length; rangeIndex += 1) {
      geometry.addGroup(display.faceRanges[rangeIndex].start, display.faceRanges[rangeIndex].count, 0);
    }
    materials = [
      new root.THREE.MeshStandardMaterial({ color: themeColor('--ui-color-geometry', '#f4f1ea'), roughness: 0.72, metalness: 0.04, side: root.THREE.DoubleSide }),
      new root.THREE.MeshStandardMaterial({ color: themeColor('--ui-color-selection', '#93c5fd'), roughness: 0.58, metalness: 0.02, emissive: themeColor('--ui-color-selection', '#93c5fd'), emissiveIntensity: 0.42, side: root.THREE.DoubleSide })
    ];
    surface = new root.THREE.Mesh(geometry, materials);
    surface.name = 'mesh-boundary-surface';
    surface.userData.faceIdsByRange = display.faceRanges.map(function (range) { return range.faceId; });
    surface.userData.triangleFaceIndices = new Uint32Array(display.triangleIndices.length / 3);
    for (rangeIndex = 0; rangeIndex < display.faceRanges.length; rangeIndex += 1) {
      for (var triangleIndex = display.faceRanges[rangeIndex].start / 3;
           triangleIndex < (display.faceRanges[rangeIndex].start + display.faceRanges[rangeIndex].count) / 3;
           triangleIndex += 1) {
        surface.userData.triangleFaceIndices[triangleIndex] = rangeIndex;
      }
    }
    lines = new root.THREE.BufferGeometry();
    lines.setAttribute('position', new root.THREE.BufferAttribute(new Float32Array(display.positionsM), 3));
    lines.setIndex(new root.THREE.BufferAttribute(display.lineIndices, 1));
    lineMaterial = new root.THREE.LineBasicMaterial({ color: themeColor('--ui-color-grid-major', '#334155'), transparent: true, opacity: 0.9 });
    lines = new root.THREE.LineSegments(lines, lineMaterial);
    lines.name = 'mesh-boundary-lines';
    group = new root.THREE.Group();
    group.name = 'mesh-display';
    group.add(surface, lines);
    group.userData.lines = lines;
    this.scene.add(group);
    this.meshDisplay = group;
    this.meshSurface = surface;
    this.setSelectedFaceIds(Array.from(this.selectedFaceIds));
    this.applyPresentation();
    this.render();
  };

  function resultColor(normalized, target) {
    var stops = [[0.12, 0.29, 0.65], [0.18, 0.72, 0.64], [0.94, 0.83, 0.23], [0.84, 0.19, 0.15]];
    var scaled = Math.max(0, Math.min(1, normalized)) * (stops.length - 1);
    var low = Math.min(stops.length - 2, Math.floor(scaled));
    var fraction = scaled - low;
    target[0] = stops[low][0] + (stops[low + 1][0] - stops[low][0]) * fraction;
    target[1] = stops[low][1] + (stops[low + 1][1] - stops[low][1]) * fraction;
    target[2] = stops[low][2] + (stops[low + 1][2] - stops[low][2]) * fraction;
    for (var channel = 0; channel < 3; channel += 1) {
      var value = target[channel];
      target[channel] = value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    }
  }

  ViewportController.prototype.clearResultDisplay = function () {
    this.clearPeakMarker();
    if (this.resultDisplay) {
      this.scene.remove(this.resultDisplay);
      disposeObjectResources(this.resultDisplay);
    }
    this.resultDisplay = null;
    this.resultSurface = null;
    this.resultModel = null;
    this.updatedResultModel = null;
    if (this.probeHandler) { this.probeHandler(null); }
  };

  ViewportController.prototype.clearPeakMarker = function () {
    if (this.peakMarker) { this.scene.remove(this.peakMarker); disposeObjectResources(this.peakMarker); }
    this.peakMarker=null; this.selectedResultPoint=null;
    if(this.probeHandler)this.probeHandler(null);
  };

  ViewportController.prototype.selectResultPoint = function (probe) {
    this.clearPeakMarker();
    if(!probe){this.render();return;}
    this.selectedResultPoint=probe;
    var group=new root.THREE.Group();group.name=probe.isInterior?'raw-peak-marker':'selected-result-point';
    group.position.fromArray(probe.coordinatesM);group.userData.locationOwner=probe.isInterior?'solver-sample':'surface';group.userData.isInterior=Boolean(probe.isInterior);
    var dot=new root.THREE.Mesh(new root.THREE.SphereGeometry(5,12,8),new root.THREE.MeshBasicMaterial({color:'#ffdb40',depthTest:false,depthWrite:false}));
    dot.renderOrder=1000;group.add(dot);this.peakMarker=group;this.scene.add(group);
    this.refreshSelectedResultPoint();this.render();
  };
  ViewportController.prototype.refreshSelectedResultPoint = function () {
    var probe=this.selectedResultPoint;if(!probe)return;
    var field=probe.isInterior?'vonMises':this.presentation.field,definition=root.SpjutsimFEA.resultFieldDefinition(field,this.presentation);
    if(!probe.isInterior){var values=this.activeResultField();probe.fieldValue=probe.nodes.reduce(function(sum,node,i){return sum+values[node]*probe.weights[i];},0);}
    probe.fieldLabel=probe.isInterior?'Peak von Mises · interior solver sample':definition[0]+' · approximate surface value';probe.unit=definition[1];probe.unitScale=definition[2];
    if(this.probeHandler)this.probeHandler(probe);
  };
  ViewportController.prototype.locatePeak = function () {
    if(this.selectedResultPoint && this.selectedResultPoint.isInterior){this.selectResultPoint(null);return null;}
    var peak=this.resultModel && this.resultModel.extrema && this.resultModel.extrema.rawVonMisesMax;
    if(!peak || !Array.isArray(peak.locationM) || !peak.locationM.every(Number.isFinite))return null;
    this.cancelViewAnimation();
    this.selectResultPoint({isInterior:true,coordinatesM:peak.locationM.slice(),elementIndex:peak.elementIndex,fieldValue:peak.valuePa});
    this.render();return peak;
  };

  ViewportController.prototype.setResultModel = function (result) {
    var geometry;
    var material;
    var surface;
    var lineGeometry;
    var lineIndices;
    var triangles;
    var triangle;
    var lines;
    var group;
    this.clearResultDisplay();
    if (!result) { this.applyPresentation(); this.render(); return; }
    if (!root.SpjutsimFEA.validateResultModel(result, result.analysisRevision).valid) { throw new Error('Invalid renderer result model.'); }
    geometry = new root.THREE.BufferGeometry();
    geometry.setAttribute('position', new root.THREE.BufferAttribute(new Float32Array(result.originalSurface.nodePositionsM), 3));
    geometry.setAttribute('color', new root.THREE.BufferAttribute(new Float32Array(result.originalSurface.nodePositionsM.length), 3));
    geometry.setIndex(new root.THREE.BufferAttribute(result.originalSurface.triangleConnectivity, 1));
    geometry.computeVertexNormals();
    material = new root.THREE.MeshBasicMaterial({ vertexColors: true, side: root.THREE.DoubleSide, toneMapped: false });
    surface = new root.THREE.Mesh(geometry, material);
    surface.name = 'result-surface';
    triangles = result.originalSurface.triangleConnectivity;
    lineIndices = new Uint32Array(triangles.length * 2);
    for (triangle = 0; triangle < triangles.length / 3; triangle += 1) {
      lineIndices[triangle * 6] = triangles[triangle * 3]; lineIndices[triangle * 6 + 1] = triangles[triangle * 3 + 1];
      lineIndices[triangle * 6 + 2] = triangles[triangle * 3 + 1]; lineIndices[triangle * 6 + 3] = triangles[triangle * 3 + 2];
      lineIndices[triangle * 6 + 4] = triangles[triangle * 3 + 2]; lineIndices[triangle * 6 + 5] = triangles[triangle * 3];
    }
    lineGeometry = new root.THREE.BufferGeometry();
    lineGeometry.setAttribute('position', geometry.getAttribute('position'));
    lineGeometry.setIndex(new root.THREE.BufferAttribute(lineIndices, 1));
    lines = new root.THREE.LineSegments(lineGeometry, new root.THREE.LineBasicMaterial({ color: themeColor('--ui-color-grid-major', '#334155'), transparent: true, opacity: 0.8 }));
    lines.name = 'result-mesh-overlay';
    group = new root.THREE.Group();
    group.name = 'result-display';
    var partGeometry = new root.THREE.BufferGeometry();
    partGeometry.setAttribute('position', geometry.getAttribute('position'));
    partGeometry.setIndex(new root.THREE.BufferAttribute(root.SpjutsimFEA.buildPartEdgeIndices(triangles, (function () {
      var faceIndices = result.originalSurface.triangleFaceIndices, ranges = [], start = 0;
      for (var i = 1; i <= faceIndices.length; i += 1) {
        if (i === faceIndices.length || faceIndices[i] !== faceIndices[start]) {
          ranges.push({start:start * 3,count:(i - start) * 3}); start = i;
        }
      }
      return ranges;
    }())), 1));
    var partEdges = new root.THREE.LineSegments(partGeometry, new root.THREE.LineBasicMaterial({color: '#263445', transparent:true, opacity:0.45}));
    partEdges.name = 'result-part-edges';
    group.userData.partEdges = partEdges;
    group.add(surface, lines, partEdges);
    group.userData.lines = lines;
    this.scene.add(group);
    this.resultDisplay = group;
    this.resultSurface = surface;
    this.resultModel = result;
    this.updateResultPresentation();
    this.refreshSelectedResultPoint();
    this.applyPresentation();
    this.render();
  };

  ViewportController.prototype.activeResultField = function () {
    if (!this.resultModel) { return null; }
    var fields = {
      vonMises: this.resultModel.surfaceFields.vonMisesPa,
      factorOfSafety: this.resultModel.surfaceFields.factorOfSafety,
      maxPrincipal: this.resultModel.surfaceFields.maxPrincipalPa,
      minPrincipal: this.resultModel.surfaceFields.minPrincipalPa,
      displacementMagnitude: this.resultModel.surfaceFields.displacementMagnitudeM,
      ux: this.resultModel.surfaceFields.uxM, uy: this.resultModel.surfaceFields.uyM, uz: this.resultModel.surfaceFields.uzM
    };
    return fields[this.presentation.field] || fields.vonMises;
  };

  ViewportController.prototype.updateResultPresentation = function () {
    var result = this.resultModel;
    var field;
    var fieldRange;
    var position;
    var colors;
    var original;
    var displacement;
    var scale;
    var node;
    var rgb = [0, 0, 0];
    if (!result || !this.resultSurface) { return; }
    field = this.activeResultField();
    fieldRange = root.SpjutsimFEA.resolveColorRange(result, this.presentation) || root.SpjutsimFEA.getResultDisplayRange(result, 'vonMises');
    position = this.resultSurface.geometry.getAttribute('position');
    colors = this.resultSurface.geometry.getAttribute('color');
    original = result.originalSurface.nodePositionsM;
    displacement = result.displacementM;
    scale = (Number(this.presentation.deformationScale) || 0) * this.deformationAnimationMultiplier;
    var positionChanged = this.updatedResultModel !== result || this.updatedResultScale !== scale;
    var colorKey = [this.presentation.field,fieldRange.minimum,fieldRange.maximum].join('|');
    var reverseColors = this.presentation.field === 'factorOfSafety';
    var colorChanged = this.updatedResultModel !== result || this.updatedResultColorKey !== colorKey;
    if (!positionChanged && !colorChanged) { return; }
    this.updatedResultModel = result; this.updatedResultScale = scale; this.updatedResultColorKey = colorKey;
    for (node = 0; node < field.length; node += 1) {
      if (positionChanged) {
        position.array[node * 3] = original[node * 3] + displacement[node * 3] * scale;
        position.array[node * 3 + 1] = original[node * 3 + 1] + displacement[node * 3 + 1] * scale;
        position.array[node * 3 + 2] = original[node * 3 + 2] + displacement[node * 3 + 2] * scale;
      }
      if (colorChanged) {
        var normalized = fieldRange.maximum === fieldRange.minimum ? 0.5 :
          (Number.isFinite(fieldRange.maximum - fieldRange.minimum) ? (field[node] - fieldRange.minimum) / (fieldRange.maximum - fieldRange.minimum) : (field[node] / 2 - fieldRange.minimum / 2) / (fieldRange.maximum / 2 - fieldRange.minimum / 2));
        resultColor(reverseColors ? 1 - normalized : normalized, rgb);
        colors.array[node * 3] = rgb[0]; colors.array[node * 3 + 1] = rgb[1]; colors.array[node * 3 + 2] = rgb[2];
      }
    }
    if (positionChanged) { position.needsUpdate = true; this.resultSurface.geometry.computeBoundingSphere(); }
    if (colorChanged) { colors.needsUpdate = true; }
  };

  ViewportController.prototype.clearAnalysisOverlay = function () {
    if (!this.analysisOverlay) { return; }
    this.scene.remove(this.analysisOverlay);
    disposeObjectResources(this.analysisOverlay);
    this.analysisOverlay = null;
  };

  ViewportController.prototype.rebuildAnalysisOverlay = function () {
    var descriptors;
    var group;
    var glyphLength = Math.max(this.modelExtent * 0.14, 0.000001);
    var loadColor = themeColor('--ui-color-load', '#ef4444');
    var supportColor = themeColor('--ui-color-support', '#22c55e');
    if (!this.analysisOverlayState) { this.clearAnalysisOverlay(); return; }
    var previous = this.analysisOverlay;
    var reusable = new Map();
    if (previous) { previous.children.forEach(function (object) { reusable.set(object.userData.glyphKey,object); }); }
    descriptors = root.SpjutsimFEA.buildAnalysisGlyphDescriptors(this.analysisOverlayState);
    group = new root.THREE.Group();
    group.name = 'analysis-overlay';
    descriptors.forEach(function (descriptor) {
      var key = JSON.stringify([descriptor,loadColor,supportColor,glyphLength]);
      var reused = reusable.get(key);
      if (reused) { group.add(reused); reusable.delete(key); return; }
      var direction = new root.THREE.Vector3().fromArray(descriptor.direction).normalize();
      var position = new root.THREE.Vector3().fromArray(descriptor.positionM);
      var object;
      if (descriptor.type === 'support') {
        object = new root.THREE.Group();
        object.name = 'analysis-glyph-support';
        descriptor.components.forEach(function (axis) {
          var axisDirection = axis === 'x' ? new root.THREE.Vector3(1, 0, 0) :
            (axis === 'y' ? new root.THREE.Vector3(0, 1, 0) : new root.THREE.Vector3(0, 0, 1));
          object.add(cylinderConeArrow(axisDirection, position, glyphLength * 0.52, supportColor, 'support-axis-' + axis));
        });
      } else {
        object = cylinderConeArrow(direction, position, glyphLength, loadColor, 'analysis-glyph-' + descriptor.type);
      }
      if (descriptor.preview) {
        object.traverse(function (child) { if (child.material) { child.material.transparent = true; child.material.opacity = 0.55; child.material.depthTest = false; } });
      }
      object.userData.glyphKey = key;
      object.userData.descriptor = descriptor;
      object.userData.tipPositionM = descriptor.positionM.slice();
      object.renderOrder = 10;
      group.add(object);
    });
    if (previous) { this.scene.remove(previous); disposeObjectResources(previous); }
    this.scene.add(group);
    this.analysisOverlay = group;
  };

  /** Replace load/support glyphs without altering geometry, mesh, or numeric analysis data. */
  ViewportController.prototype.setAnalysisOverlay = function (documentState) {
    this.analysisOverlayState = documentState || null;
    if (!documentState || !documentState.assignmentDraft) { this.showDraftHover(null); }
    this.rebuildAnalysisOverlay();
    this.render();
  };

  ViewportController.prototype.setPresentation = function (presentation) {
    if (!presentation || ['model', 'mesh', 'stress', 'deformation'].indexOf(presentation.mode) < 0 ||
        (['lines', 'shaded', 'shaded-edges', 'wireframe'].indexOf(presentation.displayStyle) < 0)) {
      throw new Error('Invalid viewport presentation.');
    }
    var presentationKey = JSON.stringify(presentation);
    if (this.presentationKey === presentationKey) { return; }
    this.presentationKey = presentationKey;
    this.presentation = Object.assign({ field: 'vonMises', meshOverlay: false, deformationScale: 0,
      deformationMode: 'undeformed', userDeformationScale: 1 }, presentation);
    this.updateResultPresentation();
    this.refreshSelectedResultPoint();
    this.applyPresentation();
    this.render();
  };

  ViewportController.prototype.setDeformationAnimationMultiplier = function (multiplier) {
    if (!Number.isFinite(multiplier) || multiplier < 0 || multiplier > 1) {
      throw new Error('Deformation animation multiplier must be between zero and one.');
    }
    this.deformationAnimationMultiplier = multiplier;
    this.updateResultPresentation();
    this.render();
  };

  ViewportController.prototype.applyPresentation = function () {
    var modelVisible;
    var featureEdges;
    var meshMaterials;
    if (this.previewMesh) {
      modelVisible = this.presentation.mode === 'model' || (!this.meshSurface && !this.resultSurface);
      this.previewMesh.visible = modelVisible && this.presentation.displayStyle !== 'wireframe';
      featureEdges = this.importedGeometry.getObjectByName('imported-geometry-feature-edges');
      this.previewMesh.material.forEach(function (material) { material.wireframe = false; });
      if (featureEdges) { featureEdges.visible = modelVisible && this.presentation.displayStyle !== 'shaded'; }
    }
    if (this.meshDisplay) {
      this.meshDisplay.visible = this.presentation.mode === 'mesh';
      meshMaterials = this.meshSurface.material;
      meshMaterials.forEach(function (material) { material.wireframe = this.presentation.displayStyle === 'wireframe'; }, this);
      this.meshDisplay.userData.lines.visible = this.presentation.displayStyle !== 'wireframe';
    }
    if (this.resultDisplay) {
      this.resultDisplay.visible = this.presentation.mode === 'stress' || this.presentation.mode === 'deformation';
      this.resultSurface.material.wireframe = this.presentation.displayStyle === 'wireframe';
      this.resultDisplay.userData.lines.visible = this.presentation.meshOverlay === true;
      if (this.resultDisplay.userData.partEdges) { this.resultDisplay.userData.partEdges.visible = this.presentation.displayStyle === 'shaded-edges' || this.presentation.displayStyle === 'lines'; }
    }
  };

  ViewportController.prototype.clearDraftHover = function () {
    if (this.draftHoverFrame) { root.cancelAnimationFrame(this.draftHoverFrame); this.draftHoverFrame = null; }
    if (this.draftHoverMesh) { this.scene.remove(this.draftHoverMesh); disposeObjectResources(this.draftHoverMesh); }
    this.draftHoverMesh = null; this.draftHoverSource = null;
  };

  ViewportController.prototype.showDraftHover = function (faceId) {
    var surface = this.presentation.mode === 'mesh' ? this.meshSurface : this.previewMesh;
    if (!faceId || !surface) { if (this.draftHoverMesh) { this.draftHoverMesh.visible = false; this.render(); } return; }
    if (this.draftHoverSource !== surface.geometry) {
      if (this.draftHoverMesh) { this.scene.remove(this.draftHoverMesh); disposeObjectResources(this.draftHoverMesh); }
      var geometry = new root.THREE.BufferGeometry();
      geometry.setAttribute('position',surface.geometry.getAttribute('position'));
      geometry.setIndex(surface.geometry.index);
      this.draftHoverMesh = new root.THREE.Mesh(geometry,new root.THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.22,side:root.THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
      this.draftHoverSource = surface.geometry; this.scene.add(this.draftHoverMesh);
    }
    var index = surface.userData.faceIdsByRange.indexOf(faceId), range = surface.geometry.groups[index];
    if (!range) { return; }
    this.draftHoverMesh.geometry.setDrawRange(range.start,range.count); this.draftHoverMesh.visible = true; this.render();
  };

  ViewportController.prototype.setSelectedFaceIds = function (faceIds) {
    var knownFaceIds;
    var rangeIndex;
    if (!Array.isArray(faceIds)) { throw new Error('Selected faces must be an array of FaceId values.'); }
    if (!this.previewMesh) {
      if (faceIds.length !== 0) { throw new Error('Cannot render selected faces before geometry is available.'); }
      return;
    }
    knownFaceIds = new Set(this.previewMesh.userData.faceIdsByRange);
    faceIds.forEach(function (faceId) {
      if (typeof faceId !== 'string' || !knownFaceIds.has(faceId)) {
        throw new Error('Unknown CAD face identifier.');
      }
    });
    var selectionKey = JSON.stringify(faceIds);
    if (this.selectionKey === selectionKey && this.selectionPreview === this.previewMesh && this.selectionMesh === this.meshSurface) { return; }
    this.selectionKey = selectionKey; this.selectionPreview = this.previewMesh; this.selectionMesh = this.meshSurface;
    this.selectedFaceIds = new Set(faceIds);
    [this.previewMesh, this.meshSurface].forEach(function (surface) {
      if (!surface) { return; }
      for (rangeIndex = 0; rangeIndex < surface.geometry.groups.length; rangeIndex += 1) {
        surface.geometry.groups[rangeIndex].materialIndex = this.selectedFaceIds.has(surface.userData.faceIdsByRange[rangeIndex]) ? 1 : 0;
      }
    }, this);
    this.render();
  };

  /** Return the opaque FaceId under a pointer, or null for empty space. */
  ViewportController.prototype.pickFaceAtPointer = function (event) {
    var coordinates;
    var intersections;
    var intersection;
    var rangeIndex;
    var pickMesh = this.presentation.mode === 'mesh' && this.meshSurface ? this.meshSurface : this.previewMesh;
    if (!pickMesh) { return null; }
    coordinates = pointerToCanvasCoordinates(event, this.canvas);
    if (!coordinates || coordinates.ndcX < -1 || coordinates.ndcX > 1 || coordinates.ndcY < -1 || coordinates.ndcY > 1) {
      return null;
    }
    this.pointer.set(coordinates.ndcX, coordinates.ndcY);
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.pointer, this.camera);
    intersections = this.raycaster.intersectObject(pickMesh, false);
    if (intersections.length === 0) { return null; }
    intersection = intersections[0];
    if (!Number.isInteger(intersection.faceIndex)) { return null; }
    rangeIndex = pickMesh.userData.triangleFaceIndices[intersection.faceIndex];
    return pickMesh.userData.faceIdsByRange[rangeIndex] || null;
  };

  ViewportController.prototype.pickResultAtPointer = function (event) {
    var coordinates;
    var intersections;
    var triangle;
    var indices;
    var nodes;
    var field;
    var displacement;
    var point = [0, 0, 0];
    var vector = [0, 0, 0];
    var axis;
    var fieldDefinitions = {
      vonMises: ['approximate smoothed von Mises stress', 'MPa', 1e6], maxPrincipal: ['approximate smoothed maximum principal stress', 'MPa', 1e6],
      factorOfSafety: ['approximate smoothed factor of safety', '', 1], minPrincipal: ['approximate smoothed minimum principal stress', 'MPa', 1e6], displacementMagnitude: ['displacement magnitude', 'mm', 1e-3],
      ux: ['Ux', 'mm', 1e-3], uy: ['Uy', 'mm', 1e-3], uz: ['Uz', 'mm', 1e-3]
    };
    var definition = fieldDefinitions[this.presentation.field] || fieldDefinitions.vonMises;
    if (!this.resultSurface || !this.resultModel) { return null; }
    coordinates = pointerToCanvasCoordinates(event, this.canvas);
    if (!coordinates) { return null; }
    this.pointer.set(coordinates.ndcX, coordinates.ndcY);
    this.camera.updateMatrixWorld(); this.raycaster.setFromCamera(this.pointer, this.camera);
    intersections = this.raycaster.intersectObject(this.resultSurface, false);
    if (!intersections.length || !Number.isInteger(intersections[0].faceIndex)) { return null; }
    triangle = intersections[0].faceIndex;
    indices = this.resultModel.originalSurface.triangleConnectivity;
    nodes = [indices[triangle * 3], indices[triangle * 3 + 1], indices[triangle * 3 + 2]];
    field = this.activeResultField(); displacement = this.resultModel.displacementM;
    var positions=this.resultSurface.geometry.getAttribute('position');
    var vertices=nodes.map(function(node){return new root.THREE.Vector3().fromBufferAttribute(positions,node);});
    var barycentric=new root.THREE.Vector3();root.THREE.Triangle.getBarycoord(intersections[0].point,vertices[0],vertices[1],vertices[2],barycentric);
    var weights=barycentric.toArray();
    nodes.forEach(function (node,index) {
      for (axis = 0; axis < 3; axis += 1) {
        point[axis] += this.resultModel.originalSurface.nodePositionsM[node * 3 + axis] * weights[index];
        vector[axis] += displacement[node * 3 + axis] * weights[index];
      }
    }, this);
    return { faceId: this.resultModel.originalSurface.faceIds[this.resultModel.originalSurface.triangleFaceIndices[triangle]],
      elementIndex: this.resultModel.originalSurface.triangleElementIndices[triangle], coordinatesM: point, nodes:nodes, weights:weights,
      displacementM: vector, fieldLabel: definition[0] + (this.presentation.field === 'factorOfSafety' && this.resultModel.ranges.factorOfSafety.clipped ? ' (contour capped at 10)' : ''), unit: definition[1], unitScale: definition[2],
      fieldValue: nodes.reduce(function(sum,node,i){return sum+field[node]*weights[i];},0) };
  };

  ViewportController.prototype.observeResize = function () {
    var self = this;
    if (typeof root.ResizeObserver === 'function') {
      this.resizeObserver = new root.ResizeObserver(function () { self.resize(); });
      this.resizeObserver.observe(this.canvas);
    }
    this.resizeListener = function () { self.resize(); };
    root.addEventListener('resize', this.resizeListener);
  };

  ViewportController.prototype.resize = function () {
    var pixelRatio = Math.min(root.devicePixelRatio || 1, 2);
    if (this.renderer.getPixelRatio() !== pixelRatio) { this.renderer.setPixelRatio(pixelRatio); }
    var width = Math.max(1, this.canvas.clientWidth);
    var height = Math.max(1, this.canvas.clientHeight);
    this.camera.aspect = width / height;
    this.updateCameraProjection();
    this.renderer.setSize(width, height, false);
    this.layoutAxisTriad(width, height);
    this.render();
  };

  ViewportController.prototype.render = function () {
    this.axisTriad.quaternion.copy(this.camera.quaternion).invert();
    this.updateGizmoTargets();
    if (this.peakMarker) {
      var probe=this.selectedResultPoint,scale=(this.presentation.deformationScale || 0)*this.deformationAnimationMultiplier;
      this.peakMarker.position.fromArray(probe.coordinatesM);
      if(probe.displacementM)this.peakMarker.position.addScaledVector(new root.THREE.Vector3().fromArray(probe.displacementM),scale);
      var pixelScale=this.camera.isOrthographicCamera ? (this.camera.top-this.camera.bottom)/this.camera.zoom/Math.max(this.canvas.clientHeight,1) : 2*this.camera.position.distanceTo(this.peakMarker.position)*Math.tan(this.camera.fov*Math.PI/360)/Math.max(this.canvas.clientHeight,1);
      this.peakMarker.scale.setScalar(pixelScale);
      this.peakMarker.visible=this.presentation.mode==='stress' || this.presentation.mode==='deformation';
      if(this.probePositionHandler){var point=this.peakMarker.position.clone().project(this.camera);this.probePositionHandler({x:(point.x+1)*this.canvas.clientWidth/2,y:(1-point.y)*this.canvas.clientHeight/2,visible:this.peakMarker.visible && point.z>=-1 && point.z<=1});}
    }
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.axisTriadScene, this.axisTriadCamera);
  };

  ViewportController.prototype.dispose = function () {
    this.cancelViewAnimation();
    if (this.disposeGizmoInteraction) { this.disposeGizmoInteraction(); }
    if (this.resizeObserver) { this.resizeObserver.disconnect(); }
    if (this.resizeListener) { root.removeEventListener('resize', this.resizeListener); }
    if (this.pointerClickListener) { this.canvas.removeEventListener('click', this.pointerClickListener); }
    this.clearDraftHover();
    this.canvas.removeEventListener('pointermove',this.draftHoverListener); this.canvas.removeEventListener('pointerleave',this.draftHoverLeave);
    if (this.pointerDownListener) { this.canvas.removeEventListener('pointerdown', this.pointerDownListener); }
    if (this.pointerMoveListener) { this.canvas.removeEventListener('pointermove', this.pointerMoveListener); }
    if (this.pointerUpListener) {
      this.canvas.removeEventListener('pointerup', this.pointerUpListener);
    }
    if (this.pointerCancelListener) { this.canvas.removeEventListener('pointercancel', this.pointerCancelListener); }
    if (this.pointerLostCaptureListener) { this.canvas.removeEventListener('lostpointercapture', this.pointerLostCaptureListener); }
    if (this.wheelListener) { this.canvas.removeEventListener('wheel', this.wheelListener); }
    if (this.contextMenuListener) { this.canvas.removeEventListener('contextmenu', this.contextMenuListener); }
    if (this.keyDownListener) { document.removeEventListener('keydown', this.keyDownListener); }
    if (this.themeObserver) { this.themeObserver.disconnect(); }
    this.activePointers.clear();
    this.scene.traverse(function (object) {
      if (object.geometry && typeof object.geometry.dispose === 'function') { object.geometry.dispose(); }
      disposeMaterial(object.material);
    });
    this.axisTriadScene.traverse(function (object) {
      if (object.geometry && typeof object.geometry.dispose === 'function') { object.geometry.dispose(); }
      disposeMaterial(object.material);
    });
    this.renderer.dispose();
    if (this.renderer.renderLists) { this.renderer.renderLists.dispose(); }
  };

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.pointerToCanvasCoordinates = pointerToCanvasCoordinates;
  root.SpjutsimFEA.refreshViewportTheme = refreshViewportTheme;
  root.SpjutsimFEA.ViewportController = ViewportController;
}(globalThis));
