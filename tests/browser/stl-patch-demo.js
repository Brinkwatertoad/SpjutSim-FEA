(function (root) {
  'use strict';
  var status = document.getElementById('test-status'), report = document.getElementById('report');
  var canvas = document.getElementById('viewport'), buttons = document.getElementById('patches');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 900/520, 0.01, 100);
  scene.background = new THREE.Color('#202936');
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  var light = new THREE.DirectionalLight(0xffffff, 0.8); light.position.set(2,3,4); scene.add(light);
  camera.position.set(2.8, 2.2, 3.6); camera.lookAt(0,0,0);
  var group = new THREE.Group(); scene.add(group);
  var ray = new THREE.Raycaster(), selection = new Set(), current, task, draftWorker, revision = 0;
  var drag, meshes = [];
  function draw() {
    var width = canvas.clientWidth, height = canvas.clientHeight;
    renderer.setSize(width, height, false); camera.aspect = width/height; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  function color(index, lightness) { return new THREE.Color().setHSL((index * 0.61803398875) % 1, 0.65, lightness); }
  function select(index) {
    if (selection.has(index)) { selection.delete(index); } else { selection.add(index); }
    meshes.forEach(function (mesh) { mesh.material.color.copy(color(mesh.userData.patch, selection.has(mesh.userData.patch) ? 0.8 : 0.5)); });
    Array.from(buttons.children).forEach(function (button, i) { button.setAttribute('aria-pressed', String(selection.has(i))); });
    status.textContent = selection.size + ' selected patch(es). ' + current.patches.length + ' available.';
    draw();
  }
  function install(parsed) {
    current = parsed; selection.clear();
    meshes.forEach(function (mesh) { group.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); });
    meshes = []; buttons.replaceChildren();
    var center = parsed.minimum.map(function (value, i) { return (value+parsed.maximum[i])/2; });
    var positionsByPatch = parsed.patches.map(function (patch) { return new Float32Array(patch.triangleCount*9); });
    var offsets = new Uint32Array(parsed.patches.length);
    for (var i = 0; i < parsed.triangles.length; i += 3) {
      var owner = parsed.patchByTriangle[i/3];
      for (var j = 0; j < 3; j += 1) {
        var node = parsed.triangles[i+j]*3;
        for (var axis = 0; axis < 3; axis += 1) {
          positionsByPatch[owner][offsets[owner]++] = (parsed.positions[node+axis]-center[axis])/parsed.diagonal*2;
        }
      }
    }
    parsed.patches.forEach(function (patch, index) {
      var geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positionsByPatch[index],3));
      geometry.computeVertexNormals();
      var mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: color(index, 0.5), side: THREE.DoubleSide, flatShading: true }));
      mesh.userData.patch = index; group.add(mesh); meshes.push(mesh);
      var button = document.createElement('button'); button.type = 'button'; button.textContent = 'Patch ' + (index+1) + ' (' + patch.triangleCount + ' triangles)';
      button.title = parsed.patchIds[index]; button.setAttribute('aria-pressed', 'false');
      button.onclick = function () { select(index); }; buttons.appendChild(button);
    });
    var dimensions = parsed.maximum.map(function (value, i) { return value-parsed.minimum[i]; });
    status.textContent = 'Dimensions: ' + dimensions.map(function (value) { return value.toPrecision(6); }).join(' × ') + ' m. ' + parsed.patches.length + ' patches.';
    document.getElementById('dimensions').textContent = status.textContent;
    report.textContent = 'Enclosed faceted volume: ' + parsed.volume.toPrecision(9) + ' m³\nPatch IDs:\n' + parsed.patchIds.join('\n');
    document.getElementById('mesh').disabled = false; draw();
  }
  async function preview() {
    var token = ++revision;
    if (task) { task.cancel(); task = null; }
    document.getElementById('cancel').disabled = true;
    if (draftWorker) { draftWorker.terminate(); draftWorker = null; }
    document.getElementById('mesh').disabled = true;
    var unit = document.getElementById('units').value;
    if (!unit) { status.textContent = 'Choose explicit length units first.'; return; }
    status.textContent = 'Reading and grouping fixture…';
    try {
      var bytes = await (await fetch('../fixtures/stl/' + document.getElementById('fixture').value)).arrayBuffer();
      if (token !== revision) { return; }
      var url = URL.createObjectURL(new Blob([root.createStlExperiment.toString(), '\nself.onmessage=async function(event){try{var api=createStlExperiment();var p=await api.identify(api.parse(event.data.bytes,event.data.options),event.data.bytes);postMessage({parsed:p},[p.positions.buffer,p.triangles.buffer,p.normals.buffer,p.patchByTriangle.buffer]);}catch(e){postMessage({error:e.message,code:e.code});}};'], { type:'text/javascript' }));
      var worker = draftWorker = new Worker(url); URL.revokeObjectURL(url);
      worker.onmessage = function (event) {
        worker.terminate(); if (draftWorker === worker) { draftWorker = null; }
        if (token !== revision) { return; }
        if (event.data.error) { status.textContent = event.data.code + ': ' + event.data.error + ' Previous preview retained.'; return; }
        install(event.data.parsed);
      };
      worker.onerror = function (event) { worker.terminate(); if (token === revision) { status.textContent = event.message; } };
      worker.postMessage({ bytes: bytes, options: { unit: unit, angleDegrees: Number(document.getElementById('angle').value) } }, [bytes]);
    } catch (error) { if (token === revision) { status.textContent = error.message; } }
  }
  document.getElementById('preview').onclick = preview;
  ['fixture', 'units', 'angle'].forEach(function (id) { document.getElementById(id).onchange = preview; });
  document.getElementById('mesh').onclick = async function () {
    var token = revision;
    document.getElementById('mesh').disabled = true; document.getElementById('cancel').disabled = false;
    try {
      var bytes = await (await fetch('../fixtures/stl/' + document.getElementById('fixture').value)).arrayBuffer();
      if (token !== revision) { return; }
      task = root.StlMesherExperiment.start({ bytes: bytes, options: { unit: current.unit, angleDegrees: current.angleDegrees }, order:2, preserveFacets:true, size:0.15 },
        function (stage) { if (token === revision) { status.textContent = 'Tet10 probe: ' + stage; } });
      var result = await task.promise;
      if (token === revision) { report.textContent = JSON.stringify(result,null,2); status.textContent = 'Tet10 probe finished. This does not install an analysis model.'; }
    } catch (error) { if (token === revision) { status.textContent = error.message; } }
    finally { if (token === revision) { task = null; document.getElementById('mesh').disabled = !current; document.getElementById('cancel').disabled = true; } }
  };
  document.getElementById('cancel').onclick = function () { if (task) { task.cancel(); } };
  canvas.onpointerdown = function (event) { drag = { x:event.clientX, y:event.clientY, moved:false }; canvas.setPointerCapture(event.pointerId); };
  canvas.onpointermove = function (event) {
    if (drag) {
      var dx = event.clientX-drag.x, dy = event.clientY-drag.y;
      if (Math.abs(dx)+Math.abs(dy)>2) { drag.moved = true; }
      if (drag.moved) { group.rotation.y += dx*0.01; group.rotation.x += dy*0.01; }
      drag.x = event.clientX; drag.y = event.clientY; draw();
    } else {
      var rect = canvas.getBoundingClientRect();
      ray.setFromCamera({ x:(event.clientX-rect.left)/rect.width*2-1, y:1-(event.clientY-rect.top)/rect.height*2 }, camera);
      var hits = ray.intersectObjects(meshes);
      canvas.title = hits.length ? 'Patch ' + (hits[0].object.userData.patch+1) : '';
      canvas.style.cursor = hits.length ? 'pointer' : 'grab';
    }
  };
  canvas.onpointerup = function (event) {
    if (drag && !drag.moved) {
      var rect = canvas.getBoundingClientRect();
      ray.setFromCamera({ x:(event.clientX-rect.left)/rect.width*2-1, y:1-(event.clientY-rect.top)/rect.height*2 }, camera);
      var hits = ray.intersectObjects(meshes); if (hits.length) { select(hits[0].object.userData.patch); }
    }
    drag = null;
  };
  canvas.onpointercancel = canvas.onlostpointercapture = function () { drag = null; };
  addEventListener('resize', draw); draw();
}(globalThis));
