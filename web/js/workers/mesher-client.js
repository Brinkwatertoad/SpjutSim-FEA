(function (root) {
  'use strict';

  function clientFailure(code, userMessage, detail, stage) {
    var error = new Error(userMessage);
    error.diagnostic = {
      code: code,
      stage: stage || 'import',
      userMessage: userMessage,
      developerMessage: detail || null,
      recoverable: true
    };
    return error;
  }

  /** @param {{onProgress?: function(Object), onError?: function(Object)}} options */
  function MesherClient(options) {
    options = options || {};
    this.onProgress = options.onProgress || function () {};
    this.onError = options.onError || function () {};
    this.worker = null;
    this.nextRequest = 0;
    this.disposed = false;
  }

  MesherClient.prototype.requestId = function () {
    this.nextRequest += 1;
    return 'mesher-' + Date.now().toString(36) + '-' + this.nextRequest;
  };

  MesherClient.prototype.ensureWorker = function () {
    var self = this;
    if (this.disposed) {
      return Promise.reject(clientFailure('MESHER_CLIENT_DISPOSED', 'The geometry import was cancelled.'));
    }
    if (this.worker) { return Promise.resolve(this.worker); }
    return root.SpjutsimFEA.startLocalWorker('mesher').then(function (worker) {
      if (self.disposed) {
        worker.terminate();
        throw clientFailure('MESHER_CLIENT_DISPOSED', 'The geometry import was cancelled.');
      }
      self.worker = worker;
      return worker;
    });
  };

  MesherClient.prototype.importGeometry = function (request) {
    var self = this;
    if (request && request.sourceFormat === 'stl') {
      if (!root.SpjutsimFEA.validateStlOptions(request.importOptions)) { return Promise.reject(clientFailure('STL_INVALID_OPTIONS', 'Choose explicit STL units and a grouping angle from 1 to 179 degrees.')); }
      if (!(request.sourceBytes instanceof ArrayBuffer) || !request.sourceBytes.byteLength || request.sourceBytes.byteLength > 16 * 1024 * 1024) {
        return Promise.reject(clientFailure('STL_INPUT_LIMIT', 'Choose a nonempty STL file no larger than 16 MiB.'));
      }
    }
    var validation = root.SpjutsimFEA.validateImportRequest(request);
    if (!validation.valid) {
      return Promise.reject(clientFailure('INVALID_IMPORT_REQUEST', 'Choose a non-empty STEP, IGES, BREP, or STL file.', validation.reason));
    }
    return this.ensureWorker().then(function (worker) {
      return new Promise(function (resolve, reject) {
        var requestId = self.requestId();
        var settled = false;
        var transferBytes = request.sourceBytes.slice(0);
        var timeout = request.sourceFormat === 'stl' ? root.setTimeout(function () {
          finish(clientFailure('MESHER_TIMEOUT', 'The geometry operation exceeded 120 seconds. Try a simpler tessellation or coarser mesh.'));
        }, 120000) : null;

        function finish(error, result) {
          if (settled) { return; }
          settled = true;
          root.clearTimeout(timeout);
          if (error) { worker.terminate(); if (self.worker === worker) { self.worker = null; } }
          self.cancelPending = null;
          worker.onmessage = null;
          worker.onerror = null;
          worker.onmessageerror = null;
          if (error) { reject(error); } else { resolve(result); }
        }

        self.cancelPending = function () {
          finish(clientFailure('IMPORT_CANCELLED', 'The geometry import was cancelled.'));
        };

        worker.onmessage = function (event) {
          var message = event.data;
          var response;
          if (!message || message.requestId !== requestId) { return; }
          if (message.type === 'progress') {
            if (root.SpjutsimFEA.validateWorkerProgress(message, requestId).valid) {
              self.onProgress(message.progress);
            }
            return;
          }
          response = root.SpjutsimFEA.validateWorkerResponse(message, requestId, 'import-result');
          if (!response.valid) {
            finish(clientFailure('INVALID_MESHER_RESPONSE', 'The geometry engine returned an invalid import response.', response.reason));
            return;
          }
          if (response.error) {
            self.onError(message.error);
            finish(Object.assign(new Error(message.error.userMessage), { diagnostic: message.error }));
            return;
          }
          var geometryValidation = root.SpjutsimFEA.validateGeometryModel(message.result);
          if (!geometryValidation.valid) {
            finish(clientFailure('INVALID_GEOMETRY_RESULT', 'The geometry engine returned invalid geometry data.', geometryValidation.reason));
            return;
          }
          finish(null, message.result);
        };
        worker.onerror = function (event) {
          finish(clientFailure('MESHER_OPERATION_FAILED', 'The geometry engine stopped while importing the CAD file.', event.message || null));
        };
        worker.onmessageerror = function () {
          finish(clientFailure('MESHER_MESSAGE_FAILED', 'The geometry engine could not return the imported geometry.'));
        };
        try {
          worker.postMessage({
            protocol: root.SpjutsimFEA.WORKER_PROTOCOL_VERSION,
            type: 'import',
            requestId: requestId,
            geometryId: request.geometryId || root.SpjutsimFEA.createGeometryId(),
            sourceName: request.sourceName,
            sourceFormat: request.sourceFormat,
            importOptions: request.importOptions,
            sourceBytes: transferBytes
          }, [transferBytes]);
        } catch (error) {
          finish(clientFailure('MESHER_MESSAGE_FAILED', 'The geometry engine could not receive the CAD file.', error && error.message));
        }
      });
    });
  };

  /** Generate a solver-ready tetrahedral mesh without exposing Gmsh data to the caller. */
  MesherClient.prototype.generateMesh = function (request) {
    var self = this;
    var geometryValidation;
    var settingsValidation;
    var resolvedSettings;
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return Promise.reject(clientFailure('INVALID_MESH_REQUEST', 'Choose valid tetrahedral mesh settings.', 'Mesh request must be an object.', 'mesh'));
    }
    geometryValidation = root.SpjutsimFEA.validateGeometryModel(request.geometry);
    if (!geometryValidation.valid || !(request.sourceBytes instanceof ArrayBuffer) || request.sourceBytes.byteLength === 0) {
      return Promise.reject(clientFailure('INVALID_MESH_REQUEST', 'The geometry must be re-imported before meshing.', geometryValidation.reason || 'missing-source-bytes', 'mesh'));
    }
    if (request.geometry.sourceFormat === 'stl' && request.sourceBytes.byteLength > 16 * 1024 * 1024) {
      return Promise.reject(clientFailure('STL_INPUT_LIMIT', 'Choose an STL file no larger than 16 MiB.', null, 'mesh'));
    }
    settingsValidation = root.SpjutsimFEA.validateMeshSettings(request.settings, request.geometry.boundingBoxM);
    if (!settingsValidation.valid) {
      return Promise.reject(clientFailure('INVALID_MESH_SETTINGS', 'Choose valid tetrahedral mesh settings.', settingsValidation.reason, 'mesh'));
    }
    resolvedSettings = root.SpjutsimFEA.resolveMeshSettings(request.settings, request.geometry.boundingBoxM);
    return this.ensureWorker().then(function (worker) {
      return new Promise(function (resolve, reject) {
        var requestId = self.requestId();
        var settled = false;
        var transferBytes = request.sourceBytes.slice(0);
        var timeout = request.geometry.sourceFormat === 'stl' ? root.setTimeout(function () {
          finish(clientFailure('MESHER_TIMEOUT', 'The geometry operation exceeded 120 seconds. Try a simpler tessellation or coarser mesh.', null, 'mesh'));
        }, 120000) : null;

        function finish(error, result) {
          if (settled) { return; }
          settled = true;
          root.clearTimeout(timeout);
          if (error) { worker.terminate(); if (self.worker === worker) { self.worker = null; } }
          self.cancelPending = null;
          worker.onmessage = null;
          worker.onerror = null;
          worker.onmessageerror = null;
          if (error) { reject(error); } else { resolve(result); }
        }

        self.cancelPending = function () {
          finish(clientFailure('MESH_CANCELLED', 'Mesh generation was cancelled.', null, 'mesh'));
        };
        worker.onmessage = function (event) {
          var message = event.data;
          var response;
          if (!message || message.requestId !== requestId) { return; }
          if (message.type === 'progress') {
            if (root.SpjutsimFEA.validateWorkerProgress(message, requestId).valid) { self.onProgress(message.progress); }
            return;
          }
          response = root.SpjutsimFEA.validateWorkerResponse(message, requestId, 'mesh-result');
          if (!response.valid) {
            finish(clientFailure('INVALID_MESHER_RESPONSE', 'The geometry engine returned an invalid mesh response.', response.reason, 'mesh'));
            return;
          }
          if (response.error) {
            self.onError(message.error);
            finish(Object.assign(new Error(message.error.userMessage), { diagnostic: message.error }));
            return;
          }
          var meshValidation = root.SpjutsimFEA.validateVolumeMeshResult(message.result, request.geometry.faceIds);
          if (!meshValidation.valid) {
            finish(clientFailure('INVALID_VOLUME_MESH_RESULT', 'The geometry engine returned an invalid volume mesh.', meshValidation.reason, 'mesh'));
            return;
          }
          finish(null, message.result);
        };
        worker.onerror = function (event) {
          finish(clientFailure('MESHER_OPERATION_FAILED', 'The geometry engine stopped while generating the mesh.', event.message || null, 'mesh'));
        };
        worker.onmessageerror = function () {
          finish(clientFailure('MESHER_MESSAGE_FAILED', 'The geometry engine could not return the generated mesh.', null, 'mesh'));
        };
        try {
          worker.postMessage({
            protocol: root.SpjutsimFEA.WORKER_PROTOCOL_VERSION,
            type: 'mesh', requestId: requestId, geometryId: request.geometry.geometryId,
            sourceName: request.geometry.sourceName, sourceFormat: request.geometry.sourceFormat,
            importOptions: request.geometry.importOptions, sourceHash: request.geometry.sourceMetadata && request.geometry.sourceMetadata.sha256,
            faceIds: request.geometry.faceIds.slice(), settings: resolvedSettings,
            orientation: { rotation: request.geometry.orientation.rotation.slice(), operations: request.geometry.orientation.operations.slice() },
            sourceBytes: transferBytes
          }, [transferBytes]);
        } catch (error) {
          finish(clientFailure('MESHER_MESSAGE_FAILED', 'The geometry engine could not receive the mesh request.', error && error.message, 'mesh'));
        }
      });
    });
  };

  MesherClient.prototype.cancel = function () {
    this.dispose();
  };

  MesherClient.prototype.dispose = function () {
    this.disposed = true;
    if (this.cancelPending) { this.cancelPending(); }
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.onmessageerror = null;
      this.worker.terminate();
      this.worker = null;
    }
  };

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.MesherClient = MesherClient;
}(globalThis));
