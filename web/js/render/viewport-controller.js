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
    this.resizeObserver = null;
    this.resizeListener = null;

    this.addReferenceObjects();
    this.addLights();
    this.observeResize();
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
    referenceObject.position.y = 0.36;
    this.scene.add(grid, axes, referenceObject);
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
    this.scene.traverse(function (object) {
      if (object.geometry && typeof object.geometry.dispose === 'function') {
        object.geometry.dispose();
      }
      disposeMaterial(object.material);
    });
    this.renderer.dispose();
    if (this.renderer.renderLists) { this.renderer.renderLists.dispose(); }
  };

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.ViewportController = ViewportController;
}(globalThis));
