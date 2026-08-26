'use strict';
var WORKER_PROTOCOL_VERSION = 1;
var WASM_HEAP_CAP_BYTES = 3758096384;
var activeAnalysis = null;
var femModulePromise = typeof createSpjutsimFemModule === 'function'
  ? createSpjutsimFemModule({ noInitialRun: true })
  : Promise.reject(new Error('The generated FEM WebAssembly runtime is missing.'));

function diagnostic(code, stage, userMessage, developerMessage, recoverable, details) {
  return { code: code, stage: stage, userMessage: userMessage, developerMessage: developerMessage || null,
    recoverable: recoverable !== false, diagnostics: details || null };
}

function reply(requestId, type, result, transfer) {
  self.postMessage({ protocol: WORKER_PROTOCOL_VERSION, requestId: requestId, type: type, result: result }, transfer || []);
}

function fail(requestId, error) {
  self.postMessage({ protocol: WORKER_PROTOCOL_VERSION, requestId: requestId, type: 'error', error: error && error.code ? error :
    diagnostic('SOLVER_OPERATION_FAILED', 'solve', 'The solver stopped unexpectedly.', error && error.message) });
}

function progress(requestId, stage, userMessage) {
  self.postMessage({ protocol: WORKER_PROTOCOL_VERSION, requestId: requestId, type: 'progress',
    progress: { stage: stage, userMessage: userMessage } });
}

function validTypedArray(value, Type, multiple, allowEmpty) {
  var i;
  if (!(value instanceof Type) || value.length % multiple || (!allowEmpty && !value.length)) { return false; }
  if (Type === Float64Array) {
    for (i = 0; i < value.length; i += 1) { if (!Number.isFinite(value[i])) { return false; } }
  }
  return true;
}

function validateInput(input) {
  var mesh;
  var nodeCount;
  var i;
  if (!input || input.protocol !== 1 || !input.mesh || !input.material ||
      !Array.isArray(input.boundaryConditions) || !Array.isArray(input.loads) || !input.gravity) {
    throw diagnostic('INVALID_SOLVER_INPUT', 'preflight', 'The analysis input is incomplete.');
  }
  mesh = input.mesh;
  if (mesh.elementType !== 'tet4' || !validTypedArray(mesh.nodePositionsM, Float64Array, 3, false) ||
      !validTypedArray(mesh.elementConnectivity, Uint32Array, 4, false) || !mesh.boundaryFaces ||
      !validTypedArray(mesh.boundaryFaces.triangleConnectivity, Uint32Array, 3, false) ||
      !Array.isArray(mesh.boundaryFaces.faceRanges)) {
    throw diagnostic('INVALID_SOLVER_MESH', 'preflight', 'The Tet4 mesh buffers are invalid.');
  }
  nodeCount = mesh.nodePositionsM.length / 3;
  for (i = 0; i < mesh.elementConnectivity.length; i += 1) {
    if (mesh.elementConnectivity[i] >= nodeCount) { throw diagnostic('MESH_INVALID_INDEX', 'mesh', 'The mesh references a missing node.'); }
  }
  for (i = 0; i < mesh.boundaryFaces.triangleConnectivity.length; i += 1) {
    if (mesh.boundaryFaces.triangleConnectivity[i] >= nodeCount) { throw diagnostic('MESH_INVALID_INDEX', 'mesh', 'The boundary mesh references a missing node.'); }
  }
  if (!(Number.isFinite(input.material.youngsModulusPa) && input.material.youngsModulusPa > 0) ||
      !(Number.isFinite(input.material.poissonsRatio) && input.material.poissonsRatio > -1 && input.material.poissonsRatio < 0.5)) {
    throw diagnostic('MATERIAL_INVALID', 'preflight', 'Enter valid isotropic material properties before solving.');
  }
  input.boundaryConditions.forEach(function (condition) {
    if (!(condition.nodeIndices instanceof Uint32Array) || !condition.nodeIndices.length) {
      throw diagnostic('INVALID_CONSTRAINT', 'preflight', 'A support has no mesh nodes.');
    }
  });
  input.loads.forEach(function (load) {
    if (!(load.triangleConnectivity instanceof Uint32Array) || !load.triangleConnectivity.length ||
        load.triangleConnectivity.length % 3) {
      throw diagnostic('INVALID_LOAD', 'preflight', 'A surface load has no boundary triangles.');
    }
  });
  return input;
}

function copyToWasm(Module, array) {
  var pointer = Module._malloc(array.byteLength || 1);
  if (!pointer) { throw diagnostic('MEMORY_LIMIT_EXCEEDED', 'preflight', 'WebAssembly could not allocate an input buffer.'); }
  new Uint8Array(Module.HEAPU8.buffer, pointer, array.byteLength).set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
  return pointer;
}

function withWasmArray(Module, array, operation) {
  var pointer = copyToWasm(Module, array);
  try { return operation(pointer); } finally { Module._free(pointer); }
}

function readCString(Module, pointer) {
  var end = pointer;
  if (!pointer) { return ''; }
  while (Module.HEAPU8[end]) { end += 1; }
  return new TextDecoder('utf-8').decode(Module.HEAPU8.subarray(pointer, end));
}

function nativeError(Module, context, fallbackStage) {
  Module._fem_wasm_read_error(context);
  return diagnostic(readCString(Module, Module._fem_wasm_error_string(0)) || 'NATIVE_SOLVER_ERROR',
    readCString(Module, Module._fem_wasm_error_string(1)) || fallbackStage,
    readCString(Module, Module._fem_wasm_error_string(2)) || 'The FEM solver rejected the analysis.',
    readCString(Module, Module._fem_wasm_error_string(3)) || null,
    Boolean(Module._fem_wasm_error_value(4)), {
      iterations: Module._fem_wasm_error_value(0), terminationReason: Module._fem_wasm_error_value(1),
      finalRelativeResidual: Module._fem_wasm_error_value(2), durationMs: Module._fem_wasm_error_value(3)
    });
}

function checkNative(Module, context, status, stage) {
  if (status !== 0) { throw nativeError(Module, context, stage); }
}

function buildConstraints(input) {
  var entries = [];
  input.boundaryConditions.forEach(function (condition) {
    var components = condition.type === 'fixed' ? [[0, 0], [1, 0], [2, 0]] :
      [[0, condition.uxM], [1, condition.uyM], [2, condition.uzM]].filter(function (item) { return item[1] !== undefined; });
    condition.nodeIndices.forEach(function (node) {
      components.forEach(function (component) { entries.push([node * 3 + component[0], component[1]]); });
    });
  });
  entries.sort(function (a, b) { return a[0] - b[0]; });
  return { indices: new Uint32Array(entries.map(function (item) { return item[0]; })),
    valuesM: new Float64Array(entries.map(function (item) { return item[1]; })) };
}

function loadAnalysis(Module, input) {
  var context = Module._fem_create();
  var constraints;
  if (!context) { throw diagnostic('MEMORY_LIMIT_EXCEEDED', 'preflight', 'WebAssembly could not create the FEM context.'); }
  try {
    withWasmArray(Module, input.mesh.nodePositionsM, function (positions) {
      withWasmArray(Module, input.mesh.elementConnectivity, function (connectivity) {
        checkNative(Module, context, Module._fem_load_mesh(context, positions, input.mesh.nodePositionsM.length / 3,
          connectivity, input.mesh.elementConnectivity.length / 4, 4), 'mesh');
      });
    });
    checkNative(Module, context, Module._fem_set_material(context, input.material.youngsModulusPa,
      input.material.poissonsRatio, input.material.densityKgM3 || 0), 'preflight');
    constraints = buildConstraints(input);
    withWasmArray(Module, constraints.indices, function (dofs) {
      withWasmArray(Module, constraints.valuesM, function (values) {
        checkNative(Module, context, Module._fem_set_constraints(context, dofs, values, constraints.indices.length), 'preflight');
      });
    });
    checkNative(Module, context, Module._fem_clear_loads(context), 'preflight');
    input.loads.forEach(function (load) {
      withWasmArray(Module, load.triangleConnectivity, function (triangles) {
        if (load.type === 'pressure') {
          checkNative(Module, context, Module._fem_add_pressure(context, triangles,
            load.triangleConnectivity.length / 3, load.pressurePa), 'preflight');
        } else {
          withWasmArray(Module, new Float64Array(load.forceN), function (force) {
            checkNative(Module, context, Module._fem_add_total_face_force(context, triangles,
              load.triangleConnectivity.length / 3, force), 'preflight');
          });
        }
      });
    });
    withWasmArray(Module, new Float64Array(input.gravity.accelerationMS2), function (gravity) {
      checkNative(Module, context, Module._fem_set_gravity(context, input.gravity.enabled ? 1 : 0, gravity), 'preflight');
    });
    return { context: context, constraintCount: constraints.indices.length };
  } catch (error) {
    Module._fem_destroy(context);
    throw error;
  }
}

function memoryResult(Module, input, constraintCount) {
  var v = Module._fem_wasm_memory_value;
  return {
    modelVersion: v(0), classification: ['likely-safe', 'caution', 'likely-insufficient'][v(1)] || 'likely-insufficient',
    nodeCount: v(2), elementCount: v(3), degreeOfFreedomCount: v(4), adjacencyEdgeCount: v(5), exactNnz: v(6),
    modeledPeakBytes: v(7), estimatedPeakBytes: v(8), wasmHeapCapBytes: v(9), safetyMultiplier: v(10),
    deviceMemoryGiBHint: v(11) || null, exceedsWasmCap: Boolean(v(12)), requiresEightGiBConfirmation: Boolean(v(13)),
    allocations: { meshBytes: v(14), graphBytes: v(15), matrixValuesBytes: v(16), matrixIndexBytes: v(17),
      rowPointerBytes: v(18), assemblyWorkBytes: v(19), solverWorkBytes: v(20), resultBytes: v(21), runtimeOverheadBytes: v(22) },
    elementType: input.mesh.elementType, quality: input.mesh.quality, constraintCount: constraintCount,
    supportCount: input.boundaryConditions.length, loadCount: input.loads.length + (input.gravity.enabled ? 1 : 0),
    warnings: input.mesh.quality && input.mesh.quality.warning ? [input.mesh.quality.warning] : []
  };
}

function copyResultArray(Module, pointer, length) {
  return new Float64Array(Module.HEAPF64.subarray(pointer / 8, pointer / 8 + length));
}

function smooth(connectivity, elements, nodeCount) {
  var sums = new Float64Array(nodeCount);
  var counts = new Uint32Array(nodeCount);
  var element;
  var corner;
  var node;
  for (element = 0; element < elements.length; element += 1) {
    for (corner = 0; corner < 4; corner += 1) {
      node = connectivity[element * 4 + corner]; sums[node] += elements[element]; counts[node] += 1;
    }
  }
  for (node = 0; node < nodeCount; node += 1) { sums[node] = counts[node] ? sums[node] / counts[node] : 0; }
  return new Float32Array(sums);
}

function component(displacement, axis) {
  var field = new Float32Array(displacement.length / 3);
  var node;
  for (node = 0; node < field.length; node += 1) { field[node] = displacement[node * 3 + axis]; }
  return field;
}

function range(field) {
  var minimum = Infinity;
  var maximum = -Infinity;
  field.forEach(function (value) { minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); });
  return { minimum: minimum, maximum: maximum };
}

function elementLocation(mesh, element) {
  var location = [0, 0, 0];
  var corner;
  var axis;
  var node;
  for (corner = 0; corner < 4; corner += 1) {
    node = mesh.elementConnectivity[element * 4 + corner];
    for (axis = 0; axis < 3; axis += 1) { location[axis] += mesh.nodePositionsM[node * 3 + axis] / 4; }
  }
  return location;
}

function boundaryMapping(mesh) {
  var byKey = Object.create(null);
  var faces = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];
  var boundary = mesh.boundaryFaces.triangleConnectivity;
  var elementIndices = new Uint32Array(boundary.length / 3);
  var faceIndices = new Uint32Array(boundary.length / 3);
  var element;
  var face;
  var triangle;
  var key;
  for (element = 0; element < mesh.elementConnectivity.length / 4; element += 1) {
    for (face = 0; face < 4; face += 1) {
      key = faces[face].map(function (corner) { return mesh.elementConnectivity[element * 4 + corner]; })
        .sort(function (a, b) { return a - b; }).join(':');
      byKey[key] = element;
    }
  }
  for (triangle = 0; triangle < elementIndices.length; triangle += 1) {
    key = [boundary[triangle * 3], boundary[triangle * 3 + 1], boundary[triangle * 3 + 2]]
      .sort(function (a, b) { return a - b; }).join(':');
    elementIndices[triangle] = byKey[key];
  }
  mesh.boundaryFaces.faceRanges.forEach(function (faceRange, index) {
    for (triangle = faceRange.start / 3; triangle < (faceRange.start + faceRange.count) / 3; triangle += 1) { faceIndices[triangle] = index; }
  });
  return { elementIndices: elementIndices, faceIndices: faceIndices };
}

function makeResult(Module, input, revision, preflight) {
  var v = Module._fem_wasm_result_value;
  var p = Module._fem_wasm_result_pointer;
  var nodes = v(0);
  var elements = v(1);
  var displacement = copyResultArray(Module, p(0), nodes * 3);
  var displacementMagnitude = copyResultArray(Module, p(1), nodes);
  var raw = { strain: copyResultArray(Module, p(2), elements * 6), stressPa: copyResultArray(Module, p(3), elements * 6),
    vonMisesPa: copyResultArray(Module, p(4), elements), maxPrincipalPa: copyResultArray(Module, p(5), elements),
    minPrincipalPa: copyResultArray(Module, p(6), elements) };
  var surface = { vonMisesPa: smooth(input.mesh.elementConnectivity, raw.vonMisesPa, nodes),
    maxPrincipalPa: smooth(input.mesh.elementConnectivity, raw.maxPrincipalPa, nodes),
    minPrincipalPa: smooth(input.mesh.elementConnectivity, raw.minPrincipalPa, nodes),
    displacementMagnitudeM: new Float32Array(displacementMagnitude), uxM: component(displacement, 0),
    uyM: component(displacement, 1), uzM: component(displacement, 2) };
  var mapping = boundaryMapping(input.mesh);
  var maximumDisplacement = range(displacementMagnitude).maximum;
  var maximumNode = displacementMagnitude.indexOf(maximumDisplacement);
  var warnings = preflight.warnings.slice();
  if (Number.isFinite(input.mesh.statistics.boundingBoxDiagonalM) &&
      maximumDisplacement > 0.05 * input.mesh.statistics.boundingBoxDiagonalM) {
    warnings.push('Displacement exceeds 5% of the model diagonal; geometric nonlinearity may matter.');
  }
  return {
    schemaVersion: 1, analysisRevision: revision, elementType: 'tet4',
    originalSurface: { nodePositionsM: new Float32Array(input.mesh.nodePositionsM),
      triangleConnectivity: new Uint32Array(input.mesh.boundaryFaces.triangleConnectivity),
      faceIds: input.mesh.boundaryFaces.faceRanges.map(function (item) { return item.faceId; }),
      triangleFaceIndices: mapping.faceIndices, triangleElementIndices: mapping.elementIndices },
    displacementM: displacement, displacementMagnitudeM: displacementMagnitude, rawElementFields: raw, surfaceFields: surface,
    ranges: { vonMises: range(surface.vonMisesPa), maxPrincipal: range(surface.maxPrincipalPa),
      minPrincipal: range(surface.minPrincipalPa), displacementMagnitude: range(surface.displacementMagnitudeM),
      ux: range(surface.uxM), uy: range(surface.uyM), uz: range(surface.uzM) },
    extrema: {
      maxDisplacement: { valueM: maximumDisplacement, nodeIndex: maximumNode,
        locationM: Array.prototype.slice.call(input.mesh.nodePositionsM, maximumNode * 3, maximumNode * 3 + 3) },
      rawVonMisesMax: { valuePa: v(15), elementIndex: v(18), locationM: elementLocation(input.mesh, v(18)) },
      displayedVonMisesMax: { valuePa: range(surface.vonMisesPa).maximum },
      rawMaxPrincipal: { valuePa: v(16), elementIndex: v(19), locationM: elementLocation(input.mesh, v(19)) },
      rawMinPrincipal: { valuePa: v(17), elementIndex: v(20), locationM: elementLocation(input.mesh, v(20)) }
    },
    reactionsN: copyResultArray(Module, p(7), nodes * 3),
    equilibrium: { totalReactionN: [v(9), v(10), v(11)], totalAppliedForceN: [v(12), v(13), v(14)], relativeResidual: v(8) },
    solverStatistics: { iterations: v(3), terminationReason: 'converged', finalRelativeResidual: v(5),
      solveDurationMs: v(6), strainEnergyJ: v(7), wasmMemoryBytes: Module.HEAPU8.buffer.byteLength },
    meshStatistics: input.mesh.statistics, preflight: preflight, warnings: warnings
  };
}

function transfers(result) {
  var output = [];
  function add(value) { if (value && value.buffer && output.indexOf(value.buffer) < 0) { output.push(value.buffer); } }
  Object.keys(result.originalSurface).forEach(function (key) { add(result.originalSurface[key]); });
  add(result.displacementM); add(result.displacementMagnitudeM); add(result.reactionsN);
  Object.keys(result.rawElementFields).forEach(function (key) { add(result.rawElementFields[key]); });
  Object.keys(result.surfaceFields).forEach(function (key) { add(result.surfaceFields[key]); });
  return output;
}

function handlePreflight(Module, message) {
  var input = validateInput(message.input);
  var loaded;
  var estimate;
  if (activeAnalysis) { Module._fem_destroy(activeAnalysis.context); activeAnalysis = null; }
  progress(message.requestId, 'preparing', 'Preparing solver input…');
  loaded = loadAnalysis(Module, input);
  progress(message.requestId, 'preflight', 'Counting exact matrix nonzeros and estimating memory…');
  checkNative(Module, loaded.context, Module._fem_wasm_preflight(loaded.context, Number(message.deviceMemoryGiB) || 0,
    WASM_HEAP_CAP_BYTES, 1.5), 'preflight');
  estimate = memoryResult(Module, input, loaded.constraintCount);
  activeAnalysis = { context: loaded.context, input: input, revision: message.analysisRevision, preflight: estimate };
  reply(message.requestId, 'preflight-result', estimate);
}

function handleSolve(Module, message) {
  var result;
  if (!activeAnalysis || activeAnalysis.revision !== message.analysisRevision) {
    throw diagnostic('STALE_SOLVE_REQUEST', 'solve', 'The analysis changed after preflight. Run preflight again.');
  }
  if (activeAnalysis.preflight.exceedsWasmCap) {
    throw diagnostic('MEMORY_LIMIT_EXCEEDED', 'preflight', 'The estimate exceeds the configured WebAssembly heap cap. Use a coarser mesh.');
  }
  if (activeAnalysis.preflight.requiresEightGiBConfirmation && message.confirmEightGiB !== true) {
    throw diagnostic('HIGH_MEMORY_CONFIRMATION_REQUIRED', 'preflight', 'Confirm the high-memory warning before solving.');
  }
  progress(message.requestId, 'assembly', 'Assembling stiffness and load vectors…');
  progress(message.requestId, 'constraints', 'Applying constraints…');
  progress(message.requestId, 'solve', 'Solving the sparse system…');
  checkNative(Module, activeAnalysis.context, Module._fem_wasm_solve(activeAnalysis.context,
    Number(message.solveSettings && message.solveSettings.relativeTolerance) || 1e-8,
    Number(message.solveSettings && message.solveSettings.equilibriumTolerance) || 1e-6,
    Number(message.solveSettings && message.solveSettings.maxIterations) || 0), 'solve');
  progress(message.requestId, 'recovery', 'Recovering stresses and reactions…');
  checkNative(Module, activeAnalysis.context, Module._fem_wasm_read_results(activeAnalysis.context), 'postprocess');
  progress(message.requestId, 'visualization', 'Preparing visualization buffers…');
  result = makeResult(Module, activeAnalysis.input, activeAnalysis.revision, activeAnalysis.preflight);
  Module._fem_destroy(activeAnalysis.context);
  activeAnalysis = null;
  reply(message.requestId, 'solve-result', result, transfers(result));
}

self.onmessage = function (event) {
  var message = event.data;
  if (!message || message.protocol !== WORKER_PROTOCOL_VERSION || typeof message.requestId !== 'string') {
    fail(message && message.requestId || 'unknown', diagnostic('WORKER_PROTOCOL_MISMATCH', 'worker-startup',
      'The solver worker protocol does not match the application.'));
    return;
  }
  femModulePromise.then(function (Module) {
    if (Module._fem_wasm_api_version() !== 1) { throw diagnostic('FEM_API_VERSION_MISMATCH', 'worker-startup', 'The FEM WebAssembly API does not match the application.'); }
    if (message.type === 'diagnostics') {
      reply(message.requestId, 'diagnostics-result', { apiVersion: 1, runtimeMode: 'serial-local-embedded',
        wasmMemoryBytes: Module.HEAPU8.buffer.byteLength, wasmHeapCapBytes: WASM_HEAP_CAP_BYTES });
    } else if (message.type === 'preflight') { handlePreflight(Module, message); }
    else if (message.type === 'solve') { handleSolve(Module, message); }
    else { throw diagnostic('INVALID_WORKER_REQUEST', 'solve', 'The solver worker received an unsupported request.'); }
  }).catch(function (error) { fail(message.requestId, error); });
};

femModulePromise.then(function () {
  self.postMessage({ protocol: WORKER_PROTOCOL_VERSION, type: 'ready', worker: 'solver' });
}).catch(function (error) {
  self.postMessage({ protocol: WORKER_PROTOCOL_VERSION, type: 'startup-error', worker: 'solver',
    error: diagnostic('FEM_WASM_INITIALIZATION_FAILED', 'worker-startup', 'The FEM WebAssembly runtime could not start.', error && error.message) });
});
