/* M28 only: production worker functions reused without changing its protocol. */
(function (root) {
  'use strict';
  function installExperimentWorker() {
    self.onmessage = async function (event) {
      var request = event.data, stage = 'parse', start = performance.now(), gmsh;
      var memorySamples = [];
      function checkpoint(name) {
        stage = name;
        if (gmsh) { memorySamples.push({ stage: name, bytes: gmsh.module.wasmMemory.buffer.byteLength }); }
        self.postMessage({ type: 'stage', stage: name });
      }
      try {
        var adapter = createStlExperiment();
        var parsed = await adapter.identify(adapter.parse(request.bytes, request.options), request.bytes);
        checkpoint('initialize'); gmsh = await initializeGmsh();
        gmsh.clear(); gmsh.option.restoreDefaults(); gmsh.model.add('stl-experiment');
        var i, encodedBytes = 0;
        if (request.importMethod === 'merge') {
          // Characterize the actual reader separately. It is not recommended
          // for production because it performs tolerance-based vertex merging.
          gmsh.FS.writeFile('/experiment.stl', new Uint8Array(request.bytes));
          encodedBytes = request.bytes.byteLength;
          checkpoint('merge'); gmsh.merge('/experiment.stl');
        } else {
          checkpoint('indexed-import');
          var discrete = gmsh.model.addDiscreteEntity(2);
          var nodeTags = new Uint32Array(parsed.positions.length/3);
          for (i = 0; i < nodeTags.length; i += 1) { nodeTags[i] = i+1; }
          var connectivity = new Uint32Array(parsed.triangles.length);
          for (i = 0; i < connectivity.length; i += 1) { connectivity[i] = parsed.triangles[i]+1; }
          gmsh.model.mesh.addNodes(2, discrete, nodeTags, parsed.positions);
          gmsh.model.mesh.addElementsByType(discrete, 2, [], connectivity);
        }
        checkpoint('classify');
        gmsh.model.mesh.classifySurfaces(request.preserveFacets ? 1e-8 : request.options.angleDegrees*Math.PI/180, true, true, Math.PI);
        checkpoint('geometry'); gmsh.model.mesh.createGeometry();
        var surfaces = entityTags(gmsh.model.getEntities(2));
        // Verify ownership while the classified surfaces still contain source
        // triangles. Internal entity numbers are discarded after extraction.
        function triangleKey(positions, ids) {
          return ids.map(function (id) { return Array.from(positions.slice(id*3,id*3+3)).join(','); }).sort().join(';');
        }
        var sourcePatch = new Map();
        for (i = 0; i < parsed.triangles.length; i += 3) {
          sourcePatch.set(triangleKey(parsed.positions, Array.from(parsed.triangles.slice(i,i+3))), parsed.patchIds[parsed.patchByTriangle[i/3]]);
        }
        var classifiedNodes = denseNodeMap(gmsh);
        var internalSurfacePatchIds = surfaces.map(function (tag) {
          var triangles = extractElementConnectivity(gmsh.model.mesh.getElements(2,tag),2,3,classifiedNodes.indexByNodeTag,'PATCH_MAPPING_FAILED').connectivity;
          var owner;
          for (var offset = 0; offset < triangles.length; offset += 3) {
            var candidate = sourcePatch.get(triangleKey(classifiedNodes.positions,triangles.slice(offset,offset+3)));
            if (!candidate || (owner && owner !== candidate)) { throw new Error('Internal surface crosses or loses a source patch.'); }
            owner = candidate;
          }
          return owner;
        });
        var loop = gmsh.model.geo.addSurfaceLoop(surfaces);
        var solid = gmsh.model.geo.addVolume([loop]); gmsh.model.geo.synchronize();
        gmsh.option.setNumber('Mesh.MeshSizeMin', parsed.diagonal*request.size/2);
        gmsh.option.setNumber('Mesh.MeshSizeMax', parsed.diagonal*request.size);
        gmsh.option.setNumber('Mesh.SecondOrderLinear', request.preserveFacets ? 1 : 0);
        checkpoint('generate'); gmsh.model.mesh.generate(3);
        var descriptor = request.order === 1
          ? { elementType: 'tet4', volumeNodes: 4, gmshVolumeType: 4, solverFaceType: 'tri3', solverFaceNodes: 3, gmshFaceType: 2 }
          : { elementType: 'tet10', volumeNodes: 10, gmshVolumeType: 11, solverFaceType: 'tri6', solverFaceNodes: 6, gmshFaceType: 9 };
        if (request.order === 2) { checkpoint('order'); gmsh.model.mesh.setOrder(2); }
        checkpoint('extract');
        var nodes = denseNodeMap(gmsh);
        var tets = extractElementConnectivity(gmsh.model.mesh.getElements(3, solid), descriptor.gmshVolumeType,
          descriptor.volumeNodes, nodes.indexByNodeTag, 'MESH_EXTRACTION_FAILED');
        var boundary = extractBoundaryFaces(gmsh, surfaces, surfaces.map(function (tag) { return 'experimental-' + tag; }), nodes.indexByNodeTag, descriptor);
        var qualities = gmsh.model.mesh.getElementQualities(tets.elementTags, 'gamma').elementsQuality;
        var summary = meshStatistics(nodes.positions, tets.connectivity, qualities, parsed.diagonal, descriptor);
        var volume = 0;
        for (i = 0; i < tets.connectivity.length; i += descriptor.volumeNodes) {
          var a = tets.connectivity[i]*3, b = tets.connectivity[i+1]*3, c = tets.connectivity[i+2]*3, d = tets.connectivity[i+3]*3;
          var p = nodes.positions;
          var ax=p[b]-p[a], ay=p[b+1]-p[a+1], az=p[b+2]-p[a+2];
          var bx=p[c]-p[a], by=p[c+1]-p[a+1], bz=p[c+2]-p[a+2];
          var cx=p[d]-p[a], cy=p[d+1]-p[a+1], cz=p[d+2]-p[a+2];
          volume += (ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6;
        }
        checkpoint('complete');
        var meshBytes = nodes.positions.byteLength + tets.connectivity.length*4 + boundary.solverConnectivity.byteLength + boundary.triangleConnectivity.byteLength;
        self.postMessage({ type: 'result', result: { sourceBytes: request.bytes.byteLength, serializedBytes: encodedBytes,
          importMethod: request.importMethod === 'merge' ? 'merge' : 'indexed',
          previewBytes: parsed.positions.byteLength + parsed.triangles.byteLength + parsed.patchByTriangle.byteLength,
          meshBytes: meshBytes, patches: parsed.patches.length, patchIds: parsed.patchIds,
          internalSurfaces: surfaces.length, internalSurfacePatchIds: internalSurfacePatchIds,
          sourceVolume: parsed.volume, linearCornerVolume: volume, relativeVolumeError: Math.abs(volume/parsed.volume-1),
          nodes: nodes.positions.length/3, elements: tets.elementTags.length,
          boundaryType: boundary.solverElementType, boundaryElements: boundary.solverConnectivity.length/descriptor.solverFaceNodes,
          displayTriangles: boundary.triangleConnectivity.length/3, quality: summary.quality,
          memorySamples: memorySamples, wasmCapacityHighWaterBytes: Math.max.apply(null, memorySamples.map(function (sample) { return sample.bytes; })),
          elapsedMs: performance.now()-start } });
      } catch (error) { self.postMessage({ type: 'error', stage: stage, code: error.code || 'STL_EXPERIMENT_FAILED', message: error.message }); }
      finally {
        if (gmsh) {
          try { gmsh.FS.unlink('/experiment.stl'); } catch (ignore) {}
          try { gmsh.clear(); } catch (ignoreClear) {}
        }
      }
    };
  }
  function start(request, onStage) {
    var url = URL.createObjectURL(new Blob(root.SpjutsimLocalRuntimeWorkers.gmshParts.concat([
      '\n', root.SpjutsimLocalRuntimeWorkers.mesher, '\n', root.createStlExperiment.toString(),
      '\n(', installExperimentWorker.toString(), ')();'
    ]), { type: 'text/javascript' }));
    var worker = new Worker(url), settled = false, rejectPromise;
    var timeout;
    function dispose() { clearTimeout(timeout); worker.terminate(); URL.revokeObjectURL(url); }
    var promise = new Promise(function (resolve, reject) {
      rejectPromise = reject;
      timeout = setTimeout(function () { if (!settled) { settled = true; dispose(); reject(new Error('Experimental meshing exceeded 120 seconds.')); } }, 120000);
      worker.onmessage = function (event) {
        var message = event.data;
        if (message.type === 'ready') { worker.postMessage(request, [request.bytes]); return; }
        if (message.type === 'stage') { if (onStage) { onStage(message.stage); } return; }
        if (settled) { return; } settled = true; dispose();
        if (message.type === 'error') { var error = new Error(message.stage + ': ' + message.message); error.code = message.code; reject(error); }
        else { resolve(message.result); }
      };
      worker.onerror = function (event) { if (!settled) { settled = true; dispose(); reject(new Error(event.message)); } };
    });
    return { promise: promise, cancel: function () { if (!settled) { settled = true; dispose(); var error = new Error('Cancelled'); error.code = 'CANCELLED'; rejectPromise(error); } } };
  }
  root.StlMesherExperiment = { start: start };
}(globalThis));
