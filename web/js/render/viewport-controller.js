(function (root) {
  'use strict';

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
    context.font = 'bold 44px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillStyle = color; context.fillText(letter, 32, 34);
    texture = new root.THREE.CanvasTexture(canvas);
    sprite = new root.THREE.Sprite(new root.THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.name = 'axis-triad-label-' + letter.toLowerCase();
    sprite.scale.set(14, 14, 1);
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
    this.camera = new root.THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    this.camera.position.set(2.8, 2.1, 3.4);
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
    referenceObject.name = 'reference-solid';
    referenceObject.position.y = 0.36;
    this.scene.add(grid, referenceObject);
  };

  ViewportController.prototype.rebuildAxisTriad = function () {
    var group = new root.THREE.Group();
    var definitions = [
      ['x', new root.THREE.Vector3(1, 0, 0), themeColor('--ui-color-axis-x', '#ef4444')],
      ['y', new root.THREE.Vector3(0, 1, 0), themeColor('--ui-color-axis-y', '#22c55e')],
      ['z', new root.THREE.Vector3(0, 0, 1), themeColor('--ui-color-axis-z', '#3b82f6')]
    ];
    if (this.axisTriad) { this.axisTriadScene.remove(this.axisTriad); disposeObjectResources(this.axisTriad); }
    definitions.forEach(function (definition) {
      var endpoint = definition[1].clone().multiplyScalar(20);
      var arrow = cylinderConeArrow(definition[1], endpoint, 20, definition[2], 'axis-triad-' + definition[0]);
      var label = axisLabel(definition[0].toUpperCase(), definition[2]);
      label.position.copy(definition[1]).multiplyScalar(28);
      group.add(arrow, label);
    });
    group.name = 'axis-triad';
    this.axisTriadScene.add(group);
    this.axisTriad = group;
    this.layoutAxisTriad(Math.max(1, this.canvas.clientWidth), Math.max(1, this.canvas.clientHeight));
  };

  ViewportController.prototype.layoutAxisTriad = function (width, height) {
    var safeInset = 36;
    this.axisTriadCamera.left = -width / 2;
    this.axisTriadCamera.right = width / 2;
    this.axisTriadCamera.top = height / 2;
    this.axisTriadCamera.bottom = -height / 2;
    this.axisTriadCamera.updateProjectionMatrix();
    if (this.axisTriad) {
      this.axisTriad.position.set(-width / 2 + safeInset, -height / 2 + safeInset, 0);
    }
  };

  ViewportController.prototype.observeTheme = function () {
    var self = this;
    if (typeof root.MutationObserver !== 'function') { return; }
    this.themeObserver = new root.MutationObserver(function () {
      self.scene.background.set(themeColor('--ui-color-canvas', '#111827'));
      self.rebuildAnalysisOverlay();
      self.rebuildAxisTriad();
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
        if (self.probeHandler) { self.probeHandler(self.pickResultAtPointer(event)); }
        return;
      }
      faceId = self.pickFaceAtPointer(event);
      if (self.facePickHandler) {
        self.facePickHandler(faceId, Boolean(event.shiftKey));
      }
    };
    this.canvas.addEventListener('click', this.pointerClickListener);
  };

  ViewportController.prototype.synchronizeOrbitFromCamera = function () {
    var offset = new root.THREE.Vector3().subVectors(this.camera.position, this.viewTarget);
    this.orbitDistance = Math.max(offset.length(), this.minimumOrbitDistance);
    this.orbitPolar = Math.acos(Math.max(-1, Math.min(1, offset.y / this.orbitDistance)));
    this.orbitAzimuth = Math.atan2(offset.x, offset.z);
  };

  ViewportController.prototype.applyOrbitCamera = function () {
    var sinPolar = Math.sin(this.orbitPolar);
    this.camera.position.set(
      this.viewTarget.x + this.orbitDistance * sinPolar * Math.sin(this.orbitAzimuth),
      this.viewTarget.y + this.orbitDistance * Math.cos(this.orbitPolar),
      this.viewTarget.z + this.orbitDistance * sinPolar * Math.cos(this.orbitAzimuth)
    );
    this.camera.lookAt(this.viewTarget);
    this.camera.updateMatrixWorld();
    this.render();
  };

  ViewportController.prototype.captureViewState = function () {
    return {
      target: [this.viewTarget.x, this.viewTarget.y, this.viewTarget.z],
      azimuth: this.orbitAzimuth,
      polar: this.orbitPolar,
      distance: this.orbitDistance
    };
  };

  ViewportController.prototype.restoreViewState = function (state) {
    if (!state || !Array.isArray(state.target) || state.target.length !== 3) { return; }
    this.viewTarget.set(Number(state.target[0]), Number(state.target[1]), Number(state.target[2]));
    this.orbitAzimuth = Number(state.azimuth) || 0;
    this.orbitPolar = root.SpjutsimFEA.clampViewportOrbitPolar(state.polar);
    this.orbitDistance = root.SpjutsimFEA.clampViewportOrbitDistance(state.distance, this.minimumOrbitDistance, this.maximumOrbitDistance);
    this.applyOrbitCamera();
  };

  ViewportController.prototype.resetView = function () {
    this.restoreViewState(this.resetViewState);
  };

  ViewportController.prototype.setNavigationPreferences = function (preferences) {
    this.navigationPreferences = root.SpjutsimFEA.normalizeViewportNavigationPreferences(preferences);
    return this.navigationPreferences;
  };

  ViewportController.prototype.getNavigationPreferences = function () {
    return Object.assign({}, this.navigationPreferences);
  };

  ViewportController.prototype.orbitByPixels = function (deltaX, deltaY) {
    this.orbitAzimuth -= deltaX * this.navigationPreferences.rotateSensitivity;
    this.orbitPolar = root.SpjutsimFEA.clampViewportOrbitPolar(
      this.orbitPolar - deltaY * this.navigationPreferences.rotateSensitivity
    );
    this.applyOrbitCamera();
  };

  ViewportController.prototype.orbitByRadians = function (azimuth, polar) {
    this.orbitAzimuth += Number(azimuth) || 0;
    this.orbitPolar = root.SpjutsimFEA.clampViewportOrbitPolar(this.orbitPolar + (Number(polar) || 0));
    this.applyOrbitCamera();
  };

  ViewportController.prototype.panByPixels = function (deltaX, deltaY) {
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
    this.orbitDistance = root.SpjutsimFEA.zoomViewportDistance(
      this.orbitDistance, deltaY, this.navigationPreferences, this.minimumOrbitDistance, this.maximumOrbitDistance
    );
    this.applyOrbitCamera();
  };

  ViewportController.prototype.fitModel = function (center, extent, makeResetView) {
    var safeExtent = Math.max(Number(extent) || 0, 0.000001);
    var verticalFov = this.camera.fov * Math.PI / 180;
    var horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(this.camera.aspect, 0.01));
    var limitingFov = Math.min(verticalFov, horizontalFov);
    this.modelCenter.copy(center || new root.THREE.Vector3());
    this.viewTarget.copy(this.modelCenter);
    this.modelExtent = safeExtent;
    this.minimumOrbitDistance = Math.max(safeExtent * 0.02, 0.000001);
    this.maximumOrbitDistance = Math.max(safeExtent * 100, 10);
    this.orbitDistance = root.SpjutsimFEA.clampViewportOrbitDistance(
      safeExtent * 0.95 / Math.sin(limitingFov / 2), this.minimumOrbitDistance, this.maximumOrbitDistance
    );
    this.orbitAzimuth = Math.atan2(2.8, 3.4);
    this.orbitPolar = Math.acos(2.1 / Math.sqrt(2.8 * 2.8 + 2.1 * 2.1 + 3.4 * 3.4));
    this.camera.near = Math.max(safeExtent * 0.001, 0.000001);
    this.camera.far = Math.max(safeExtent * 100, 10);
    this.camera.updateProjectionMatrix();
    if (makeResetView !== false) { this.resetViewState = this.captureViewState(); }
    this.applyOrbitCamera();
  };

  ViewportController.prototype.fitCurrentModel = function () {
    this.fitModel(this.modelCenter, this.modelExtent, false);
  };

  ViewportController.prototype.observeCameraInteraction = function () {
    var self = this;
    this.canvas.style.touchAction = 'none';
    this.pointerDownListener = function (event) {
      var isTouch = event.pointerType === 'touch';
      var isNavigationButton = isTouch || event.button === self.navigationPreferences.rotateButton || event.button === self.navigationPreferences.panButton;
      if (!isNavigationButton) { return; }
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
  }

  ViewportController.prototype.clearResultDisplay = function () {
    if (this.resultDisplay) {
      this.scene.remove(this.resultDisplay);
      disposeObjectResources(this.resultDisplay);
    }
    this.resultDisplay = null;
    this.resultSurface = null;
    this.resultModel = null;
    if (this.probeHandler) { this.probeHandler(null); }
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
    material = new root.THREE.MeshStandardMaterial({ vertexColors: true, side: root.THREE.DoubleSide, roughness: 0.72, metalness: 0.02 });
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
    lineGeometry.setAttribute('position', new root.THREE.BufferAttribute(new Float32Array(result.originalSurface.nodePositionsM), 3));
    lineGeometry.setIndex(new root.THREE.BufferAttribute(lineIndices, 1));
    lines = new root.THREE.LineSegments(lineGeometry, new root.THREE.LineBasicMaterial({ color: themeColor('--ui-color-grid-major', '#334155'), transparent: true, opacity: 0.8 }));
    lines.name = 'result-mesh-overlay';
    group = new root.THREE.Group();
    group.name = 'result-display';
    group.add(surface, lines);
    group.userData.lines = lines;
    this.scene.add(group);
    this.resultDisplay = group;
    this.resultSurface = surface;
    this.resultModel = result;
    this.updateResultPresentation();
    this.applyPresentation();
    this.render();
  };

  ViewportController.prototype.activeResultField = function () {
    if (!this.resultModel) { return null; }
    var fields = {
      vonMises: this.resultModel.surfaceFields.vonMisesPa,
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
    var linePosition;
    var colors;
    var original;
    var displacement;
    var scale;
    var node;
    var rgb = [0, 0, 0];
    if (!result || !this.resultSurface) { return; }
    field = this.activeResultField();
    fieldRange = result.ranges[this.presentation.field] || result.ranges.vonMises;
    position = this.resultSurface.geometry.getAttribute('position');
    linePosition = this.resultDisplay.userData.lines.geometry.getAttribute('position');
    colors = this.resultSurface.geometry.getAttribute('color');
    original = result.originalSurface.nodePositionsM;
    displacement = result.displacementM;
    scale = (Number(this.presentation.deformationScale) || 0) * this.deformationAnimationMultiplier;
    for (node = 0; node < field.length; node += 1) {
      position.array[node * 3] = original[node * 3] + displacement[node * 3] * scale;
      position.array[node * 3 + 1] = original[node * 3 + 1] + displacement[node * 3 + 1] * scale;
      position.array[node * 3 + 2] = original[node * 3 + 2] + displacement[node * 3 + 2] * scale;
      linePosition.array[node * 3] = position.array[node * 3];
      linePosition.array[node * 3 + 1] = position.array[node * 3 + 1];
      linePosition.array[node * 3 + 2] = position.array[node * 3 + 2];
      resultColor(fieldRange.maximum === fieldRange.minimum ? 0.5 :
        (field[node] - fieldRange.minimum) / (fieldRange.maximum - fieldRange.minimum), rgb);
      colors.array[node * 3] = rgb[0]; colors.array[node * 3 + 1] = rgb[1]; colors.array[node * 3 + 2] = rgb[2];
    }
    position.needsUpdate = true; linePosition.needsUpdate = true; colors.needsUpdate = true;
    this.resultSurface.geometry.computeVertexNormals();
    this.resultSurface.geometry.computeBoundingSphere();
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
    this.clearAnalysisOverlay();
    if (!this.analysisOverlayState) { return; }
    descriptors = root.SpjutsimFEA.buildAnalysisGlyphDescriptors(this.analysisOverlayState);
    group = new root.THREE.Group();
    group.name = 'analysis-overlay';
    descriptors.forEach(function (descriptor) {
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
      object.userData.descriptor = descriptor;
      object.userData.tipPositionM = descriptor.positionM.slice();
      object.renderOrder = 10;
      group.add(object);
    });
    this.scene.add(group);
    this.analysisOverlay = group;
  };

  /** Replace load/support glyphs without altering geometry, mesh, or numeric analysis data. */
  ViewportController.prototype.setAnalysisOverlay = function (documentState) {
    this.analysisOverlayState = documentState || null;
    this.rebuildAnalysisOverlay();
    this.render();
  };

  ViewportController.prototype.setPresentation = function (presentation) {
    if (!presentation || ['model', 'mesh', 'stress', 'deformation'].indexOf(presentation.mode) < 0 ||
        (presentation.displayStyle !== 'lines' && presentation.displayStyle !== 'wireframe')) {
      throw new Error('Invalid viewport presentation.');
    }
    this.presentation = Object.assign({ field: 'vonMises', meshOverlay: false, deformationScale: 0,
      deformationMode: 'undeformed', userDeformationScale: 1 }, presentation);
    this.updateResultPresentation();
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
      this.previewMesh.visible = modelVisible && this.presentation.displayStyle === 'lines';
      featureEdges = this.importedGeometry.getObjectByName('imported-geometry-feature-edges');
      if (featureEdges) { featureEdges.visible = modelVisible; }
    }
    if (this.meshDisplay) {
      this.meshDisplay.visible = this.presentation.mode === 'mesh';
      meshMaterials = this.meshSurface.material;
      meshMaterials.forEach(function (material) { material.wireframe = this.presentation.displayStyle === 'wireframe'; }, this);
      this.meshDisplay.userData.lines.visible = this.presentation.displayStyle === 'lines';
    }
    if (this.resultDisplay) {
      this.resultDisplay.visible = this.presentation.mode === 'stress' || this.presentation.mode === 'deformation';
      this.resultSurface.material.wireframe = this.presentation.displayStyle === 'wireframe';
      this.resultDisplay.userData.lines.visible = this.presentation.meshOverlay === true || this.presentation.displayStyle === 'lines';
    }
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
      vonMises: ['von Mises stress', 'MPa', 1e6], maxPrincipal: ['maximum principal stress', 'MPa', 1e6],
      minPrincipal: ['minimum principal stress', 'MPa', 1e6], displacementMagnitude: ['displacement magnitude', 'mm', 1e-3],
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
    nodes.forEach(function (node) {
      for (axis = 0; axis < 3; axis += 1) {
        point[axis] += this.resultModel.originalSurface.nodePositionsM[node * 3 + axis] / 3;
        vector[axis] += displacement[node * 3 + axis] / 3;
      }
    }, this);
    return { faceId: this.resultModel.originalSurface.faceIds[this.resultModel.originalSurface.triangleFaceIndices[triangle]],
      elementIndex: this.resultModel.originalSurface.triangleElementIndices[triangle], coordinatesM: point,
      displacementM: vector, fieldLabel: definition[0], unit: definition[1], unitScale: definition[2],
      fieldValue: (field[nodes[0]] + field[nodes[1]] + field[nodes[2]]) / 3 };
  };

  ViewportController.prototype.observeResize = function () {
    var self = this;
    if (typeof root.ResizeObserver === 'function') {
      this.resizeObserver = new root.ResizeObserver(function () { self.resize(); });
      this.resizeObserver.observe(this.canvas);
      return;
    }
    this.resizeListener = function () { self.resize(); };
    root.addEventListener('resize', this.resizeListener);
  };

  ViewportController.prototype.resize = function () {
    var width = Math.max(1, this.canvas.clientWidth);
    var height = Math.max(1, this.canvas.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.layoutAxisTriad(width, height);
    this.render();
  };

  ViewportController.prototype.render = function () {
    this.axisTriad.quaternion.copy(this.camera.quaternion).invert();
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.axisTriadScene, this.axisTriadCamera);
  };

  ViewportController.prototype.dispose = function () {
    if (this.resizeObserver) { this.resizeObserver.disconnect(); }
    if (this.resizeListener) { root.removeEventListener('resize', this.resizeListener); }
    if (this.pointerClickListener) { this.canvas.removeEventListener('click', this.pointerClickListener); }
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
  root.SpjutsimFEA.ViewportController = ViewportController;
}(globalThis));
