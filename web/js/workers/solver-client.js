(function (root) {
  'use strict';

  function clientFailure(code, userMessage, detail, stage) {
    var error = new Error(userMessage);
    error.diagnostic = { code: code, stage: stage || 'solve', userMessage: userMessage,
      developerMessage: detail || null, recoverable: true };
    return error;
  }

  function transferInput(input) {
    var mesh = input.mesh;
    var copy = {
      protocol: input.protocol,
      mesh: Object.assign({}, mesh, {
        nodePositionsM: new Float64Array(mesh.nodePositionsM),
        elementConnectivity: new Uint32Array(mesh.elementConnectivity),
        boundaryFaces: Object.assign({}, mesh.boundaryFaces, {
          solverConnectivity: new Uint32Array(mesh.boundaryFaces.solverConnectivity),
          triangleConnectivity: new Uint32Array(mesh.boundaryFaces.triangleConnectivity)
        })
      }),
      material: Object.assign({}, input.material),
      constraintStability: Object.assign({}, input.constraintStability, {
        modes: input.constraintStability.modes.map(function (mode) { return Object.assign({}, mode); })
      }),
      boundaryConditions: input.boundaryConditions.map(function (condition) {
        return Object.assign({}, condition, {
          boundaryTriangleConnectivity: new Uint32Array(condition.boundaryTriangleConnectivity),
          nodeIndices: new Uint32Array(condition.nodeIndices)
        });
      }),
      loads: input.loads.map(function (load) {
        return Object.assign({}, load, {
          surfaceConnectivity: new Uint32Array(load.surfaceConnectivity),
          triangleConnectivity: new Uint32Array(load.triangleConnectivity),
          triangleAreasM2: new Float64Array(load.triangleAreasM2),
          outwardNormals: new Float64Array(load.outwardNormals),
          nodeIndices: new Uint32Array(load.nodeIndices),
          equivalentNodalForcesN: new Float64Array(load.equivalentNodalForcesN)
        });
      }),
      gravity: { enabled: input.gravity.enabled, accelerationMS2: input.gravity.accelerationMS2.slice() }
    };
    var buffers = [copy.mesh.nodePositionsM.buffer, copy.mesh.elementConnectivity.buffer,
      copy.mesh.boundaryFaces.solverConnectivity.buffer, copy.mesh.boundaryFaces.triangleConnectivity.buffer];
    copy.boundaryConditions.forEach(function (condition) {
      buffers.push(condition.boundaryTriangleConnectivity.buffer, condition.nodeIndices.buffer);
    });
    copy.loads.forEach(function (load) {
      buffers.push(load.surfaceConnectivity.buffer, load.triangleConnectivity.buffer, load.triangleAreasM2.buffer, load.outwardNormals.buffer,
        load.nodeIndices.buffer, load.equivalentNodalForcesN.buffer);
    });
    return { input: copy, buffers: buffers };
  }

  function SolverClient(options) {
    options = options || {};
    this.onProgress = options.onProgress || function () {};
    this.worker = null;
    this.pending = null;
    this.sequence = 0;
    this.disposed = false;
  }

  SolverClient.prototype.ensureWorker = function () {
    var self = this;
    if (this.disposed) { return Promise.reject(clientFailure('SOLVER_CLIENT_DISPOSED', 'The solve was cancelled.')); }
    if (this.worker) { return Promise.resolve(this.worker); }
    return root.SpjutsimFEA.startLocalWorker('solver').then(function (worker) {
      if (self.disposed) { worker.terminate(); throw clientFailure('SOLVER_CLIENT_DISPOSED', 'The solve was cancelled.'); }
      self.worker = worker;
      return worker;
    });
  };

  SolverClient.prototype.request = function (type, payload, transfer, expectedType, validate) {
    var self = this;
    if (this.pending) { return Promise.reject(clientFailure('SOLVER_BUSY', 'The solver is already processing a request.')); }
    return this.ensureWorker().then(function (worker) {
      return new Promise(function (resolve, reject) {
        var requestId = 'solver-' + Date.now().toString(36) + '-' + (++self.sequence);
        var settled = false;
        function finish(error, result) {
          if (settled) { return; }
          settled = true; self.pending = null;
          worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null;
          if (error) { reject(error); } else { resolve(result); }
        }
        self.pending = function () { finish(clientFailure('SOLVE_CANCELLED', 'The solve was cancelled.')); };
        worker.onmessage = function (event) {
          var message = event.data;
          var envelope;
          var validation;
          if (!message || message.requestId !== requestId) { return; }
          if (message.type === 'progress') {
            if (root.SpjutsimFEA.validateWorkerProgress(message, requestId).valid) { self.onProgress(message.progress); }
            return;
          }
          envelope = root.SpjutsimFEA.validateWorkerResponse(message, requestId, expectedType);
          if (!envelope.valid) { finish(clientFailure('INVALID_SOLVER_RESPONSE', 'The solver returned an invalid response.', envelope.reason)); return; }
          if (envelope.error) { finish(Object.assign(new Error(message.error.userMessage), { diagnostic: message.error })); return; }
          try { validation = validate(message.result); } catch (error) { validation = { valid: false, reason: error.message }; }
          if (!validation.valid) { finish(clientFailure('INVALID_SOLVER_RESULT', 'The solver returned invalid numerical data.', validation.reason)); return; }
          finish(null, message.result);
        };
        worker.onerror = function (event) { finish(clientFailure('SOLVER_WORKER_FAILED', 'The solver worker stopped unexpectedly.', event.message)); };
        worker.onmessageerror = function () { finish(clientFailure('SOLVER_MESSAGE_FAILED', 'The solver could not return its result.')); };
        try { worker.postMessage(Object.assign({ protocol: 1, type: type, requestId: requestId }, payload), transfer || []); }
        catch (error) { finish(clientFailure('SOLVER_MESSAGE_FAILED', 'The solver could not receive the analysis.', error.message)); }
      });
    });
  };

  SolverClient.prototype.preflight = function (input, analysisRevision, deviceMemoryGiB) {
    var transfer = transferInput(input);
    return this.request('preflight', { input: transfer.input, analysisRevision: analysisRevision,
      deviceMemoryGiB: Number(deviceMemoryGiB) || 0 }, transfer.buffers, 'preflight-result', root.SpjutsimFEA.validatePreflightResult);
  };

  SolverClient.prototype.solve = function (analysisRevision, solveSettings, confirmEightGiB) {
    return this.request('solve', { analysisRevision: analysisRevision, solveSettings: solveSettings,
      confirmEightGiB: confirmEightGiB === true }, [], 'solve-result', function (result) {
      return root.SpjutsimFEA.validateResultModel(result, analysisRevision);
    });
  };

  SolverClient.prototype.cancel = function () { this.dispose(); };
  SolverClient.prototype.dispose = function () {
    this.disposed = true;
    if (this.pending) { this.pending(); }
    if (this.worker) { this.worker.terminate(); this.worker = null; }
  };

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.cloneSolverTransferInput = transferInput;
  root.SpjutsimFEA.SolverClient = SolverClient;
}(globalThis));
