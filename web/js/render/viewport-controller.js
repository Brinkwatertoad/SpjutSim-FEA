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
      material.dispose();
    }
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
    this.raycaster = new root.THREE.Raycaster();
    this.pointer = new root.THREE.Vector2();
    this.resizeObserver = null;
    this.resizeListener = null;
    this.pointerClickListener = null;
    this.importedGeometry = null;
    this.previewMesh = null;
    this.selectedFaceIds = new Set();
    this.facePickHandler = null;

    this.addReferenceObjects();
    this.addLights();
    this.observeResize();
    this.observePointerPicking();
    this.resize();
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
    var axes = new root.THREE.AxesHelper(0.85);
    var geometry = new root.THREE.BoxGeometry(0.72, 0.72, 0.72);
    var material = new root.THREE.MeshStandardMaterial({
      color: themeColor('--ui-color-geometry', '#f4f1ea'),
      roughness: 0.72,
      metalness: 0.04
    });
    var referenceObject = new root.THREE.Mesh(geometry, material);
    referenceObject.name = 'reference-solid';
    referenceObject.position.y = 0.36;
    this.scene.add(grid, axes, referenceObject);
  };

  ViewportController.prototype.observePointerPicking = function () {
    var self = this;
    this.pointerClickListener = function (event) {
      var faceId;
      if (event.button !== 0) { return; }
      faceId = self.pickFaceAtPointer(event);
      if (faceId && self.facePickHandler) {
        self.facePickHandler(faceId, Boolean(event.shiftKey));
      }
    };
    this.canvas.addEventListener('click', this.pointerClickListener);
  };

  ViewportController.prototype.setFacePickHandler = function (handler) {
    if (handler !== null && typeof handler !== 'function') {
      throw new Error('Face pick handler must be a function or null.');
    }
    this.facePickHandler = handler;
  };

  ViewportController.prototype.clearGeometryPreview = function () {
    if (!this.importedGeometry) { return; }
    this.scene.remove(this.importedGeometry);
    disposeObjectResources(this.importedGeometry);
    this.importedGeometry = null;
    this.previewMesh = null;
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
    var edges;
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
    geometry.computeVertexNormals();
    surfaceMaterials = [
      new root.THREE.MeshStandardMaterial({
        color: themeColor('--ui-color-geometry', '#f4f1ea'), roughness: 0.72, metalness: 0.04,
        flatShading: true, side: root.THREE.DoubleSide
      }),
      new root.THREE.MeshStandardMaterial({
        color: themeColor('--ui-color-selection', '#93c5fd'), roughness: 0.58, metalness: 0.02,
        emissive: themeColor('--ui-color-selection', '#93c5fd'), emissiveIntensity: 0.42,
        flatShading: true, side: root.THREE.DoubleSide
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
    edges = new root.THREE.LineSegments(new root.THREE.EdgesGeometry(geometry, 1), edgeMaterial);
    edges.name = 'imported-geometry-edges';
    importedGeometry = new root.THREE.Group();
    importedGeometry.name = 'imported-geometry';
    importedGeometry.add(surfaceMesh, edges);
    this.scene.add(importedGeometry);
    this.importedGeometry = importedGeometry;
    this.previewMesh = surfaceMesh;
    this.scene.getObjectByName('reference-solid').visible = false;
    centerX = (geometryModel.boundingBoxM.minM[0] + geometryModel.boundingBoxM.maxM[0]) / 2;
    centerY = (geometryModel.boundingBoxM.minM[1] + geometryModel.boundingBoxM.maxM[1]) / 2;
    centerZ = (geometryModel.boundingBoxM.minM[2] + geometryModel.boundingBoxM.maxM[2]) / 2;
    extent = Math.max(
      geometryModel.boundingBoxM.maxM[0] - geometryModel.boundingBoxM.minM[0],
      geometryModel.boundingBoxM.maxM[1] - geometryModel.boundingBoxM.minM[1],
      geometryModel.boundingBoxM.maxM[2] - geometryModel.boundingBoxM.minM[2]
    );
    this.camera.near = Math.max(extent * 0.001, 0.000001);
    this.camera.far = Math.max(extent * 100, 10);
    this.camera.position.set(centerX + extent * 2.8, centerY + extent * 2.1, centerZ + extent * 3.4);
    this.camera.lookAt(centerX, centerY, centerZ);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.render();
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
    for (rangeIndex = 0; rangeIndex < this.previewMesh.geometry.groups.length; rangeIndex += 1) {
      this.previewMesh.geometry.groups[rangeIndex].materialIndex =
        this.selectedFaceIds.has(this.previewMesh.userData.faceIdsByRange[rangeIndex]) ? 1 : 0;
    }
    this.render();
  };

  /** Return the opaque FaceId under a pointer, or null for empty space. */
  ViewportController.prototype.pickFaceAtPointer = function (event) {
    var coordinates;
    var intersections;
    var intersection;
    var rangeIndex;
    if (!this.previewMesh) { return null; }
    coordinates = pointerToCanvasCoordinates(event, this.canvas);
    if (!coordinates || coordinates.ndcX < -1 || coordinates.ndcX > 1 || coordinates.ndcY < -1 || coordinates.ndcY > 1) {
      return null;
    }
    this.pointer.set(coordinates.ndcX, coordinates.ndcY);
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.pointer, this.camera);
    intersections = this.raycaster.intersectObject(this.previewMesh, false);
    if (intersections.length === 0) { return null; }
    intersection = intersections[0];
    if (!Number.isInteger(intersection.faceIndex)) { return null; }
    rangeIndex = this.previewMesh.userData.triangleFaceIndices[intersection.faceIndex];
    return this.previewMesh.userData.faceIdsByRange[rangeIndex] || null;
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
    this.render();
  };

  ViewportController.prototype.render = function () {
    this.renderer.render(this.scene, this.camera);
  };

  ViewportController.prototype.dispose = function () {
    if (this.resizeObserver) { this.resizeObserver.disconnect(); }
    if (this.resizeListener) { root.removeEventListener('resize', this.resizeListener); }
    if (this.pointerClickListener) { this.canvas.removeEventListener('click', this.pointerClickListener); }
    this.scene.traverse(function (object) {
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
