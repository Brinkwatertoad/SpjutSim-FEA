(function (root) {
  'use strict';

  function AppController(options) {
    this.document = options.document;
    this.listeners = [];
    this.history = new root.SpjutsimFEA.EngineeringHistory();
    this.historyNotice = 'Undo/Redo covers setup edits. Import, replacement, and removal clear history.';
    this.geometrySource = null;
    this.nextAnalysisItemSequence = 1;
    this.nextSupportNameSequence = 1;
    this.nextLoadNameSequence = 1;
  }

  function findItem(items, id, label) {
    var index = items.findIndex(function (item) { return item.id === id; });
    if (index === -1) { throw new Error('Unknown ' + label + ' identifier.'); }
    return index;
  }

  function validatedFaceIds(geometry, faceIds) {
    var knownFaceIds;
    var uniqueFaceIds;
    if (!Array.isArray(faceIds)) {
      throw new Error('Selected faces must be an array of FaceId values.');
    }
    if (!geometry) {
      if (faceIds.length === 0) { return []; }
      throw new Error('Cannot select faces before geometry is available.');
    }
    knownFaceIds = new Set(geometry.faceIds);
    uniqueFaceIds = [];
    faceIds.forEach(function (faceId) {
      if (typeof faceId !== 'string' || !knownFaceIds.has(faceId)) {
        throw new Error('Unknown CAD face identifier.');
      }
      if (uniqueFaceIds.indexOf(faceId) === -1) { uniqueFaceIds.push(faceId); }
    });
    return uniqueFaceIds;
  }

  function validateViewportPresentation(presentation, meshAvailable, resultsAvailable) {
    var fields = ['vonMises', 'factorOfSafety', 'maxPrincipal', 'minPrincipal', 'displacementMagnitude', 'ux', 'uy', 'uz'];
    var deformationModes = ['undeformed', 'true-scale', 'auto', 'user'];
    if (!presentation || typeof presentation !== 'object' || Array.isArray(presentation) ||
        ['model', 'mesh', 'stress', 'deformation'].indexOf(presentation.mode) < 0 ||
        (['lines', 'shaded', 'shaded-edges', 'wireframe'].indexOf(presentation.displayStyle) < 0)) {
      throw new Error('Invalid viewport presentation.');
    }
    if (presentation.mode === 'mesh' && !meshAvailable) {
      throw new Error('Generate a mesh before selecting Mesh view.');
    }
    if ((presentation.mode === 'stress' || presentation.mode === 'deformation') && !resultsAvailable) {
      throw new Error('Solve the analysis before selecting a result view.');
    }
    if (presentation.field !== undefined && fields.indexOf(presentation.field) < 0) { throw new Error('Invalid result field.'); }
    if (presentation.deformationMode !== undefined && deformationModes.indexOf(presentation.deformationMode) < 0) {
      throw new Error('Invalid deformation mode.');
    }
    if (presentation.userDeformationScale !== undefined &&
        (!Number.isFinite(presentation.userDeformationScale) || presentation.userDeformationScale < 0)) {
      throw new Error('Deformation scale must be a finite non-negative value.');
    }
    return {
      mode: presentation.mode, displayStyle: presentation.displayStyle === 'lines' ? 'shaded-edges' : presentation.displayStyle,
      stressUnit: ['Pa','kPa','MPa','psi','ksi'].indexOf(presentation.stressUnit) >= 0 ? presentation.stressUnit : 'MPa',
      lengthUnit: ['m','mm','in'].indexOf(presentation.lengthUnit) >= 0 ? presentation.lengthUnit : 'mm',
      legendOrientation: presentation.legendOrientation === 'horizontal' ? 'horizontal' : 'vertical',
      colorRange: root.SpjutsimFEA.validateColorRange(presentation.colorRange, presentation.field || 'vonMises'),
      field: presentation.field || (presentation.mode === 'deformation' ? 'displacementMagnitude' : 'vonMises'),
      meshOverlay: presentation.meshOverlay === true, showGravity:presentation.showGravity !== false, showLoads:presentation.showLoads !== false, showSupports:presentation.showSupports !== false,
      deformationMode: presentation.deformationMode || 'undeformed',
      deformationScale: Number.isFinite(presentation.deformationScale) ? presentation.deformationScale : 0,
      userDeformationScale: Number.isFinite(presentation.userDeformationScale) ? presentation.userDeformationScale : 1
    };
  }

  AppController.prototype.subscribe = function (listener) {
    this.listeners.push(listener);
    listener(this.document);
  };

  AppController.prototype.notify = function (change) {
    var documentState = this.document;
    this.listeners.forEach(function (listener) { listener(documentState, change); });
  };

  AppController.prototype.invalidateResults = function (reason) {
    var hadResults = Boolean(this.document.results);
    if (hadResults) { this.rememberSolvedPresentation(); }
    this.document.results = null;
    this.document.convergenceStudy = null;
    this.document.analysisRevision = (this.document.analysisRevision || 0) + 1;
    if (this.document.assignmentDraft) { this.refreshAssignmentDraft(); }
    this.document.resultInvalidation = { reason: reason, revision: this.document.analysisRevision, stale: hadResults };
    this.document.solvePreflight = { status: 'idle', result: null, error: null, progress: null, analysisRevision: null };
    this.document.solveExecution = { status: 'idle', error: null, progress: null, analysisRevision: null };
    if (this.document.viewportPresentation.mode === 'stress' || this.document.viewportPresentation.mode === 'deformation') {
      this.document.viewportPresentation = Object.assign({}, this.document.viewportPresentation, { mode: this.document.mesh ? 'mesh' : 'model' });
    }
  };

  AppController.prototype.refreshConstraintStability = function () {
    this.document.constraintStability = root.SpjutsimFEA.analyzeDocumentConstraintStability(this.document);
    return this.document.constraintStability;
  };

  AppController.prototype.createAnalysisItemId = function (prefix) {
    var id = prefix + '-' + this.nextAnalysisItemSequence;
    this.nextAnalysisItemSequence += 1;
    return id;
  };

  AppController.prototype.beginGeometryImport = function (sourceName) {
    this.document.geometryImport = { status: 'importing', sourceName: sourceName, error: null };
    this.notify();
  };

  AppController.prototype.reportGeometryImportProgress = function (progress) {
    if (this.document.geometryImport.status !== 'importing') { return; }
    this.document.geometryImport = {
      status: 'importing', sourceName: this.document.geometryImport.sourceName,
      progress: progress, error: null
    };
    this.notify();
  };

  AppController.prototype.failGeometryImport = function (error) {
    this.document.geometryImport = {
      status: 'failed', sourceName: this.document.geometryImport.sourceName,
      error: error && error.diagnostic ? error.diagnostic : error
    };
    this.notify();
  };

  AppController.prototype.restoreGeometryImportStatus = function () {
    this.document.geometryImport = this.document.geometry
      ? { status: 'succeeded', sourceName: this.document.geometry.sourceName, error: null }
      : { status: 'idle', sourceName: null, error: null };
    this.notify();
  };

  AppController.prototype.beginStlImport = function(source, settings) {
    var api=root.SpjutsimFEA, unit='mm';
    try { var saved=root.localStorage.getItem('spjutsim-fea-stl-source-unit'); if(api.STL_UNIT_SCALES[saved])unit=saved; } catch(e) {}
    settings=Object.assign({lengthUnit:unit,patchAngleDegrees:40,maxHoleDiameterRatio:.01},settings);
    var id=api.createGeometryId(),request=Object.assign({},settings,source,{sessionId:id,generation:0,geometryId:id});
    // A selected file can open its transaction before asynchronous byte reading.
    if(source.sourceBytes===null)request.sourceBytes=new ArrayBuffer(1);
    if(!api.validateStlPreparationRequest(request))throw new Error('Choose a readable STL source and valid units.');
    this.stlImportSession={sessionId:id,generation:0,geometryId:id,source:source,settings:settings,state:'reading',preview:null,result:null,message:'Reading '+source.sourceName+'…'};
    this.beginGeometryImport(source.sourceName);return this.stlImportSession;
  };
  AppController.prototype.completeStlFileRead = function(session, bytes) {
    if(this.stlImportSession!==session)return false;
    var source=Object.assign({},session.source,{sourceBytes:bytes});
    if(!root.SpjutsimFEA.validateStlPreparationRequest(Object.assign({},source,session.settings,{sessionId:session.sessionId,generation:session.generation,geometryId:session.geometryId})))throw new Error('The selected STL could not be read.');
    session.source=source;this.notify();return true;
  };
  AppController.prototype.updateStlImportSettings = function(settings) {
    var s=this.stlImportSession;if(!s)return;
    var next=Object.assign({},s.settings,settings);
    if(!root.SpjutsimFEA.validateStlPreparationRequest(Object.assign({},s.source,next,{sessionId:s.sessionId,generation:s.generation,geometryId:s.geometryId})))throw new Error('Choose valid source units and repair limits.');
    s.settings=next;s.generation++;s.result=null;s.state=s.preview?'checking':'reading';s.message='Checking model…';this.notify();return s.generation;
  };
  AppController.prototype.applyStlPreparationEvent = function(event) {
    var s=this.stlImportSession,api=root.SpjutsimFEA;
    if(!s||event.sessionId!==s.sessionId||event.generation!==s.generation)return false;
    if(event.type==='stl-preview'){
      if(!api.validateStlPreview(event.preview)||event.preview.revision!=='source')throw new Error('Invalid STL preview.');
      s.preview=event.preview;s.state='checking';s.message='Checking and repairing '+s.source.sourceName+'…';
    }else if(event.type==='stl-progress')s.message=event.message;
    else if(event.type==='stl-prepared'){
      var r=event.result;
      if(!api.validateStlPreparationResult(r,s.preview)||r.lengthUnit!==s.settings.lengthUnit||s.source.preparation&&r.sourceDigest!==s.source.preparation.preparedDigest)throw new Error('The STL result does not match this review.');
      if(r.geometryCandidate&&(!api.validateGeometryModel(r.geometryCandidate).valid||r.geometryCandidate.geometryId!==s.geometryId||r.geometryCandidate.sourceName!==s.source.sourceName||r.geometryCandidate.stlSource.lengthUnit!==s.settings.lengthUnit||!api.sameStlSourceOptions(r.geometryCandidate.stlSource,Object.assign({version:3},s.settings))))throw new Error('The prepared solid has an invalid geometry contract.');
      s.result=r;s.state=r.state;s.message=r.state==='ready'?'Ready for analysis setup — confirm the dimensions, then use this model.':r.state==='needs-review'?'Review the highlighted additions or removals before using this repaired model.':(s.settings.faceEdits&&r.error&&/^STL_FACE_EDIT_/.test(r.error.code)?'Face correction could not be applied. ':'Automatic repair could not produce a usable solid. ')+(r.error&&r.error.message||'Review the highlighted regions.');
    }else return false;
    this.notify();return true;
  };
  AppController.prototype.failStlImport = function(session,generation,error) {
    var s=this.stlImportSession;if(s!==session||s.generation!==generation)return;
    s.state='blocked';s.result=null;s.message=error.message;s.error=error.diagnostic;this.notify();
  };
  AppController.prototype.cancelStlImport = function() {this.stlImportSession=null;this.restoreGeometryImportStatus();};
  AppController.prototype.acceptStlImport = function(consent) {
    var s=this.stlImportSession,r=s&&s.result,api=root.SpjutsimFEA;
    if(!r||!['ready','needs-review'].includes(s.state)||!r.geometryCandidate||r.lengthUnit!==s.settings.lengthUnit||
      (r.shapeChanged&&(!consent||consent.acceptShapeChanges!==true))||!api.validateGeometryModel(r.geometryCandidate).valid)throw new Error('Confirm a fully checked model and any proposed shape changes.');
    var source=Object.assign({},s.source,{sourceBytes:r.preparedSourceBytes||s.source.sourceBytes,
      originalSourceBytes:s.source.originalSourceBytes||s.source.sourceBytes,stlSource:r.geometryCandidate.stlSource,
      preparation:{version:1,originalDigest:s.source.preparation?s.source.preparation.originalDigest:r.sourceDigest,
        sourceDigest:r.sourceDigest,preparedDigest:r.preparedDigest,shapeChanged:r.shapeChanged,shapeChangesAccepted:r.shapeChanged,
        lengthUnit:s.settings.lengthUnit,solidRepair:r.solidRepair||null}});
    var geometry=r.geometryCandidate,installed=this.document.geometry;
    if(installed&&installed.sourceFormat==='stl'&&installed.sourceMetadata.sha256===geometry.sourceMetadata.sha256)geometry=api.restoreGeometryOrientation(geometry,installed.orientation);
    return {geometry:geometry,source:source};
  };
  AppController.prototype.stlFaceEditSettings = function(type) {
    var geometry=this.document.geometry,selection=this.document.selectedFaceIds;
    if(!geometry||geometry.sourceFormat!=='stl'||this.stlImportSession||this.document.assignmentDraft||!['split','merge'].includes(type)||selection.length<(type==='split'?1:2)||type==='split'&&selection.length!==1)throw new Error('Finish the current edit, then select '+(type==='split'?'one face to split.':'touching faces to merge.'));
    var operations=geometry.stlSource.faceEdits?geometry.stlSource.faceEdits.operations.slice():[];
    if(operations.length>=64)throw new Error('The face correction limit is reached. Reset recognition before making further changes.');
    operations.push({type:type,faceIndices:selection.map(function(id){return geometry.faceIds.indexOf(id);}).sort(function(a,b){return a-b;})});
    return Object.assign({},geometry.stlSource,{faceEdits:{sourceHash:geometry.sourceMetadata.sha256,operations:operations}});
  };
  AppController.prototype.beginStlSurfaceReview = function(settings) {
    var api=root.SpjutsimFEA,g=this.document.geometry;
    if(this.stlImportSession||!g||g.sourceFormat!=='stl'||!api.validateStlSurfaceSettings(settings))throw new Error('Choose valid STL surface settings.');
    this.stlSurfaceReview={geometry:g,revision:this.document.analysisRevision,settings:Object.assign({},settings),candidate:null};
    this.notify();return this.stlSurfaceReview;
  };
  AppController.prototype.completeStlSurfaceReview = function(review,candidate) {
    var g=this.document.geometry,api=root.SpjutsimFEA;
    if(review!==this.stlSurfaceReview||review.geometry!==g||review.revision!==this.document.analysisRevision)return false;
    if(!api.validateGeometryModel(candidate).valid||candidate.sourceMetadata.sha256!==g.sourceMetadata.sha256||
      !api.sameStlSourceOptions(candidate.stlSource,g.stlSource)||candidate.faceIds.join()!==g.faceIds.join()||
      !api.sameEngineeringDefinition(candidate.stlSurface,review.settings))throw new Error('The candidate does not preserve source group ownership.');
    review.candidate=api.restoreGeometryOrientation(candidate,g.orientation);this.notify();return true;
  };
  AppController.prototype.cancelStlSurfaceReview = function(){this.stlSurfaceReview=null;this.notify();};
  AppController.prototype.applyStlSurfaceReview = function(){
    var r=this.stlSurfaceReview;
    if(!r||!r.candidate||r.geometry!==this.document.geometry||r.revision!==this.document.analysisRevision)throw new Error('Review the current surface candidate first.');
    this.stlSurfaceReview=null;
    this.replaceMeshSettings(Object.assign({},this.document.meshSettings,{stlSurface:r.settings}));
  };
  AppController.prototype.rememberStlUnit = function(source) {
    if(source.sourceFormat==='stl')try{root.localStorage.setItem('spjutsim-fea-stl-source-unit',source.stlSource.lengthUnit);}catch(e){}
  };

  /** Replace engineering state that depends on the imported geometry. */
  AppController.prototype.replaceGeometry = function (geometry, source) {
    var validation = root.SpjutsimFEA.validateGeometryModel(geometry);
    if (!validation.valid) {
      throw new Error('Invalid geometry model: ' + validation.reason);
    }
    if (!source || typeof source.sourceName !== 'string' || source.sourceFormat !== geometry.sourceFormat ||
        root.SpjutsimFEA.sourceFormatForFilename(source.sourceName) !== source.sourceFormat ||
        !(source.sourceBytes instanceof ArrayBuffer) || source.sourceBytes.byteLength === 0) {
      throw new Error('A non-empty canonical CAD source matching the geometry format is required.');
    }
    if (geometry.sourceFormat === 'stl' && !root.SpjutsimFEA.sameStlSourceOptions(source.stlSource, geometry.stlSource)) {
      throw new Error('The retained STL source must match the reviewed import options.');
    }
    if(!root.SpjutsimFEA.validateStlSourceProvenance(source,geometry))throw new Error('The prepared source does not match the geometry.');
    this.clearEngineeringHistory();
    this.geometrySource = { sourceName: source.sourceName, sourceFormat: source.sourceFormat, sourceBytes: source.sourceBytes,
      stlSource: source.stlSource ? Object.assign({}, source.stlSource) : undefined,
      originalSourceBytes: source.originalSourceBytes, preparation: source.preparation };
    this.rememberStlUnit(source);
    this.document.geometry = geometry;
    this.document.meshSettings=Object.assign({},this.document.meshSettings,{stlSurface:geometry.sourceFormat==='stl'?geometry.stlSurface:undefined});
    this.document.selectedFaceIds = [];
    this.document.boundaryConditions = [];
    this.document.loads = [];
    this.document.meshMetadata = null;
    this.document.mesh = null;
    this.document.viewportPresentation = Object.assign({}, this.document.viewportPresentation, {mode: 'model'});
    this.document.meshGeneration = { status: 'idle', error: null, progress: null };
    this.refreshConstraintStability();
    this.invalidateResults('geometry');
    this.document.geometryImport = { status: 'succeeded', sourceName: source.sourceName, error: null };
    this.notify();
  };

  /** Atomically install a replacement geometry and a completely validated setup transfer. */
  AppController.prototype.replaceGeometryWithSetup = function (geometry, source, transfer) {
    var geometryValidation = root.SpjutsimFEA.validateGeometryModel(geometry);
    var materialValidation;
    var gravityValidation;
    var meshValidation;
    var supports;
    var loads;
    var viewportPreferences;
    if (!geometryValidation.valid) { throw new Error('Invalid replacement geometry: ' + geometryValidation.reason); }
    if (!source || typeof source.sourceName !== 'string' || source.sourceFormat !== geometry.sourceFormat ||
        root.SpjutsimFEA.sourceFormatForFilename(source.sourceName) !== source.sourceFormat ||
        !(source.sourceBytes instanceof ArrayBuffer) || !source.sourceBytes.byteLength) {
      throw new Error('A non-empty canonical CAD source matching the replacement geometry is required.');
    }
    if (geometry.sourceFormat === 'stl' && !root.SpjutsimFEA.sameStlSourceOptions(source.stlSource, geometry.stlSource)) {
      throw new Error('The retained STL source must match the reviewed import options.');
    }
    if (!transfer || !Array.isArray(transfer.boundaryConditions) || !Array.isArray(transfer.loads)) {
      throw new Error('A completed replacement setup transfer is required.');
    }
    materialValidation = transfer.material === null ? { valid: true, value: null }
      : root.SpjutsimFEA.validateIsotropicMaterial(transfer.material, transfer.gravity);
    if (!materialValidation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(materialValidation)); }
    gravityValidation = root.SpjutsimFEA.validateGravity(transfer.gravity, materialValidation.value);
    if (!gravityValidation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(gravityValidation)); }
    supports = transfer.boundaryConditions.map(function (item) {
      var validation = root.SpjutsimFEA.validateBoundaryCondition(item, geometry.faceIds);
      if (!validation.valid) { throw new Error('Invalid selected CAD faces for replacement support: ' + root.SpjutsimFEA.firstValidationMessage(validation)); }
      return validation.value;
    });
    loads = transfer.loads.map(function (item) {
      var validation = root.SpjutsimFEA.validateLoad(item, geometry.faceIds);
      if (!validation.valid) { throw new Error('Invalid selected CAD faces for replacement load: ' + root.SpjutsimFEA.firstValidationMessage(validation)); }
      return validation.value;
    });
    meshValidation = root.SpjutsimFEA.validateMeshSettings(transfer.meshSettings, geometry.boundingBoxM);
    if (!meshValidation.valid) { throw new Error('Invalid transferred mesh settings: ' + meshValidation.reason); }
    if (!transfer.solveSettings || !Number.isFinite(transfer.solveSettings.relativeTolerance) || transfer.solveSettings.relativeTolerance <= 0 ||
        !Number.isFinite(transfer.solveSettings.equilibriumTolerance) || transfer.solveSettings.equilibriumTolerance <= 0 ||
        !Number.isFinite(transfer.solveSettings.maxIterations) || transfer.solveSettings.maxIterations < 0 ||
        (transfer.solveSettings.maxDurationMs !== undefined && (!Number.isFinite(transfer.solveSettings.maxDurationMs) ||
          transfer.solveSettings.maxDurationMs < 1000 || transfer.solveSettings.maxDurationMs > 3600000))) {
      throw new Error('Invalid transferred solve settings.');
    }
    viewportPreferences = transfer.viewportPreferences || {};

    if(!root.SpjutsimFEA.validateStlSourceProvenance(source,geometry))throw new Error('The prepared source does not match the geometry.');
    this.clearEngineeringHistory();
    this.geometrySource = { sourceName: source.sourceName, sourceFormat: source.sourceFormat, sourceBytes: source.sourceBytes,
      stlSource: source.stlSource ? Object.assign({}, source.stlSource) : undefined,
      originalSourceBytes: source.originalSourceBytes, preparation: source.preparation };
    this.rememberStlUnit(source);
    this.document.geometry = geometry;
    this.document.material = materialValidation.value;
    this.document.boundaryConditions = supports;
    this.document.loads = loads;
    this.document.gravity = gravityValidation.value;
    this.document.meshSettings = Object.assign({}, transfer.meshSettings,{stlSurface:geometry.sourceFormat==='stl'?geometry.stlSurface:undefined});
    this.document.solveSettings = Object.assign({}, transfer.solveSettings);
    this.document.selectedFaceIds = [];
    this.document.meshMetadata = null;
    this.document.mesh = null;
    this.document.meshGeneration = { status: 'idle', error: null, progress: null };
    this.refreshConstraintStability();
    this.invalidateResults('geometry');
    this.document.viewportPresentation = {
      mode: 'model', displayStyle: viewportPreferences.displayStyle === 'lines' ? 'shaded-edges' : viewportPreferences.displayStyle || 'shaded-edges', field: 'vonMises', meshOverlay: false,
      deformationMode: 'undeformed', deformationScale: 0,
      userDeformationScale: Number.isFinite(viewportPreferences.userDeformationScale) ? viewportPreferences.userDeformationScale : 100
    };
    this.document.geometryImport = { status: 'succeeded', sourceName: source.sourceName, error: null };
    this.notify();
  };

  AppController.prototype.clearGeometry = function () {
    this.clearEngineeringHistory();
    this.geometrySource = null;
    this.document.geometry = null;
    this.document.selectedFaceIds = [];
    this.document.boundaryConditions = [];
    this.document.loads = [];
    this.document.meshMetadata = null;
    this.document.mesh = null;
    this.document.viewportPresentation = Object.assign({}, this.document.viewportPresentation, {mode: 'model'});
    this.document.meshGeneration = { status: 'idle', error: null, progress: null };
    this.refreshConstraintStability();
    this.invalidateResults('geometry');
    this.document.geometryImport = { status: 'idle', sourceName: null, error: null };
    this.notify();
  };

  AppController.prototype.replaceOrientedGeometry = function (oriented) {
    var validation;
    validation = root.SpjutsimFEA.validateGeometryModel(oriented);
    if (!validation.valid) { throw new Error('Invalid oriented geometry: ' + validation.reason); }
    if (root.SpjutsimFEA.sameEngineeringDefinition(this.document.geometry.orientation,oriented.orientation)) { return this.document.geometry.orientation; }
    this.recordEngineeringEdit('orientation',this.document.geometry.orientation,oriented.orientation,'Rotate model');
    this.document.geometry = oriented;
    this.document.mesh = null;
    this.document.meshMetadata = null;
    this.document.meshGeneration = { status: 'idle', error: null, progress: null };
    this.refreshConstraintStability();
    this.document.viewportPresentation = Object.assign({}, this.document.viewportPresentation, { mode: 'model' });
    this.invalidateResults('orientation');
    this.notify();
    return oriented.orientation;
  };

  AppController.prototype.applyGeometryRotation = function (rotation, operationLabel) {
    if (!this.document.geometry) { throw new Error('Import geometry before changing model orientation.'); }
    return this.replaceOrientedGeometry(root.SpjutsimFEA.applyRotationToGeometry(this.document.geometry, rotation, operationLabel));
  };

  AppController.prototype.rotateGeometryAroundGlobalAxis = function (axis, degrees) {
    var rotation = root.SpjutsimFEA.axisRotationMatrix(axis, degrees);
    var normalized = Number(Number(degrees).toPrecision(8));
    var label = axis.toUpperCase() + ' ' + (normalized >= 0 ? '+' : '−') + Math.abs(normalized) + '°';
    return this.applyGeometryRotation(rotation, label);
  };

  AppController.prototype.resetGeometryOrientation = function () {
    if (!this.document.geometry) { throw new Error('Import geometry before changing model orientation.'); }
    return this.replaceOrientedGeometry(root.SpjutsimFEA.resetGeometryOrientation(this.document.geometry));
  };

  AppController.prototype.orientSelectedFaceToDirection = function (direction) {
    var directions = {
      '+x': { vector: [1, 0, 0], label: '+X' }, '-x': { vector: [-1, 0, 0], label: '−X' },
      '+y': { vector: [0, 1, 0], label: '+Y' }, '-y': { vector: [0, -1, 0], label: '−Y' },
      '+z': { vector: [0, 0, 1], label: '+Z' }, '-z': { vector: [0, 0, -1], label: '−Z' }
    };
    var target = directions[direction];
    var result;
    if (!this.document.geometry) { throw new Error('Import geometry before changing model orientation.'); }
    if (this.document.selectedFaceIds.length !== 1) {
      throw new Error('Select exactly one CAD face to orient it to a global direction.');
    }
    if (!target) { throw new Error('Choose a global +X, −X, +Y, −Y, +Z, or −Z direction.'); }
    result = root.SpjutsimFEA.alignGeometryFaceNormal(
      this.document.geometry, this.document.selectedFaceIds[0], target.vector, target.label
    );
    this.replaceOrientedGeometry(result.geometry);
    return result;
  };

  /** Replace the UI-only set of selected CAD faces. */
  AppController.prototype.replaceSelectedFaces = function (faceIds) {
    this.document.selectedFaceIds = validatedFaceIds(this.document.geometry, faceIds);
    this.notify();
  };

  /** Toggle a single known CAD face without creating a boundary condition. */
  AppController.prototype.toggleSelectedFace = function (faceId) {
    var selectedFaceIds = validatedFaceIds(this.document.geometry, [faceId]);
    var selectedFaceId = selectedFaceIds[0];
    var nextSelectedFaceIds = this.document.selectedFaceIds.slice();
    var index = nextSelectedFaceIds.indexOf(selectedFaceId);
    if (index === -1) {
      nextSelectedFaceIds.push(selectedFaceId);
    } else {
      nextSelectedFaceIds.splice(index, 1);
    }
    this.document.selectedFaceIds = nextSelectedFaceIds;
    this.notify();
  };

  AppController.prototype.clearSelectedFaces = function () {
    if (!this.document.selectedFaceIds.length) { return; }
    this.document.selectedFaceIds = [];
    this.notify();
  };

  /** Replace the single homogeneous material while keeping geometry and mesh intact. */
  AppController.prototype.replaceMaterial = function (material) {
    var validation = root.SpjutsimFEA.validateIsotropicMaterial(material, this.document.gravity);
    if (!validation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validation)); }
    if (root.SpjutsimFEA.sameEngineeringDefinition(this.document.material,validation.value)) { return validation; }
    this.recordEngineeringEdit('material',this.document.material,validation.value,'Edit material');
    this.document.material = validation.value;
    this.invalidateResults('material');
    this.notify();
    return validation;
  };

  AppController.prototype.clearMaterial = function () {
    if (this.document.gravity.enabled) { throw new Error('Disable gravity before removing the material.'); }
    if (!this.document.material) { return; }
    this.recordEngineeringEdit('material',this.document.material,null,'Remove material');
    this.document.material = null;
    this.invalidateResults('material');
    this.notify();
  };

  AppController.prototype.createBoundaryCondition = function (definition) {
    var candidate = Object.assign({}, definition, {
      id: this.createAnalysisItemId('support'),
      name: definition.name === undefined ? 'Support ' + this.nextSupportNameSequence : definition.name,
      faceIds: this.document.selectedFaceIds.slice()
    });
    var validation = root.SpjutsimFEA.validateBoundaryCondition(candidate, this.document.geometry && this.document.geometry.faceIds);
    if (!validation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validation)); }
    this.recordEngineeringEdit('support',null,validation.value,'Add support',this.document.boundaryConditions.length);
    this.document.boundaryConditions.push(validation.value);
    this.nextSupportNameSequence += 1;
    this.refreshConstraintStability();
    this.invalidateResults('boundary-conditions');
    this.notify();
    return validation.value.id;
  };

  AppController.prototype.replaceBoundaryCondition = function (id, definition) {
    var index = findItem(this.document.boundaryConditions, id, 'support');
    var existing = this.document.boundaryConditions[index];
    var candidate = Object.assign({}, definition, {
      id: id,
      name: definition.name === undefined ? existing.name : definition.name,
      type: definition.type === undefined ? existing.type : definition.type,
      faceIds: definition.faceIds === undefined ? existing.faceIds.slice() : definition.faceIds
    });
    var validation = root.SpjutsimFEA.validateBoundaryCondition(candidate, this.document.geometry && this.document.geometry.faceIds);
    if (!validation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validation)); }
    if (root.SpjutsimFEA.sameEngineeringDefinition(existing,validation.value)) { return; }
    var previousDefinition = Object.assign({},existing,{name:''});
    var nextDefinition = Object.assign({},validation.value,{name:''});
    this.recordEngineeringEdit('support',existing,validation.value,root.SpjutsimFEA.sameEngineeringDefinition(previousDefinition,nextDefinition) ? 'Rename support' : 'Edit support',index);
    this.document.boundaryConditions[index] = validation.value;
    if (root.SpjutsimFEA.sameEngineeringDefinition(previousDefinition,nextDefinition)) { this.notify(); return; }
    this.refreshConstraintStability();
    this.invalidateResults('boundary-conditions');
    this.notify();
  };

  AppController.prototype.selectBoundaryCondition = function (id) {
    var index = findItem(this.document.boundaryConditions, id, 'support');
    this.document.selectedFaceIds = validatedFaceIds(this.document.geometry, this.document.boundaryConditions[index].faceIds);
    this.notify();
  };

  AppController.prototype.removeBoundaryCondition = function (id) {
    var index = findItem(this.document.boundaryConditions, id, 'support');
    this.recordEngineeringEdit('support',this.document.boundaryConditions[index],null,'Delete support',index);
    this.document.boundaryConditions.splice(index, 1);
    this.refreshConstraintStability();
    this.invalidateResults('boundary-conditions');
    this.notify();
  };

  AppController.prototype.createLoad = function (definition) {
    var candidate = Object.assign({}, definition, {
      id: this.createAnalysisItemId('load'),
      name: definition.name === undefined ? 'Load ' + this.nextLoadNameSequence : definition.name,
      faceIds: this.document.selectedFaceIds.slice()
    });
    var validation = root.SpjutsimFEA.validateLoad(candidate, this.document.geometry && this.document.geometry.faceIds);
    if (!validation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validation)); }
    this.recordEngineeringEdit('load',null,validation.value,'Add load',this.document.loads.length);
    this.document.loads.push(validation.value);
    this.nextLoadNameSequence += 1;
    this.invalidateResults('loads');
    this.notify();
    return validation.value.id;
  };

  AppController.prototype.replaceLoad = function (id, definition) {
    var index = findItem(this.document.loads, id, 'load');
    var existing = this.document.loads[index];
    var candidate = Object.assign({}, definition, {
      id: id,
      name: definition.name === undefined ? existing.name : definition.name,
      type: definition.type === undefined ? existing.type : definition.type,
      faceIds: definition.faceIds === undefined ? existing.faceIds.slice() : definition.faceIds
    });
    var validation = root.SpjutsimFEA.validateLoad(candidate, this.document.geometry && this.document.geometry.faceIds);
    if (!validation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validation)); }
    if (root.SpjutsimFEA.sameEngineeringDefinition(existing,validation.value)) { return; }
    var previousDefinition = Object.assign({},existing,{name:''});
    var nextDefinition = Object.assign({},validation.value,{name:''});
    this.recordEngineeringEdit('load',existing,validation.value,root.SpjutsimFEA.sameEngineeringDefinition(previousDefinition,nextDefinition) ? 'Rename load' : 'Edit load',index);
    this.document.loads[index] = validation.value;
    if (root.SpjutsimFEA.sameEngineeringDefinition(previousDefinition,nextDefinition)) { this.notify(); return; }
    this.invalidateResults('loads');
    this.notify();
  };

  AppController.prototype.selectLoad = function (id) {
    var index = findItem(this.document.loads, id, 'load');
    this.document.selectedFaceIds = validatedFaceIds(this.document.geometry, this.document.loads[index].faceIds);
    this.notify();
  };

  AppController.prototype.removeLoad = function (id) {
    var index = findItem(this.document.loads, id, 'load');
    this.recordEngineeringEdit('load',this.document.loads[index],null,'Delete load',index);
    this.document.loads.splice(index, 1);
    this.invalidateResults('loads');
    this.notify();
  };

  AppController.prototype.renameAssignment = function (kind, id, name) {
    if (['support','load'].indexOf(kind) < 0) { throw new Error('Choose a support or load.'); }
    var items = kind === 'support' ? this.document.boundaryConditions : this.document.loads;
    var item = items[findItem(items,id,kind)];
    var definition = Object.assign({},item,{name:name});
    if (kind === 'support') { this.replaceBoundaryCondition(id,definition); } else { this.replaceLoad(id,definition); }
  };

  AppController.prototype.replaceGravity = function (gravity) {
    var validation = root.SpjutsimFEA.validateGravity(gravity, this.document.material);
    if (!validation.valid) { throw new Error(root.SpjutsimFEA.firstValidationMessage(validation)); }
    if (root.SpjutsimFEA.sameEngineeringDefinition(this.document.gravity,validation.value)) { return; }
    this.recordEngineeringEdit('gravity',this.document.gravity,validation.value,'Edit gravity');
    if (!this.document.gravity.enabled && validation.value.enabled) { this.document.viewportPresentation.showGravity = true; }
    this.document.gravity = validation.value;
    this.invalidateResults('gravity');
    this.notify();
  };

  AppController.prototype.replaceMeshSettings = function (settings) {
    var validation = root.SpjutsimFEA.validateMeshSettings(settings, this.document.geometry && this.document.geometry.boundingBoxM);
    if (!validation.valid) { throw new Error('Invalid mesh settings: ' + validation.reason); }
    if (root.SpjutsimFEA.sameEngineeringDefinition(this.document.meshSettings,settings)) { return; }
    this.recordEngineeringEdit('meshSettings',this.document.meshSettings,settings,'Edit mesh settings');
    this.document.meshSettings = Object.assign({}, settings);
    this.document.mesh = null;
    this.document.meshMetadata = null;
    this.refreshConstraintStability();
    this.invalidateResults('mesh-settings');
    this.document.meshGeneration = { status: 'idle', error: null, progress: null };
    this.document.viewportPresentation = Object.assign({}, this.document.viewportPresentation, {mode: 'model'});
    this.notify();
  };

  AppController.prototype.beginMeshGeneration = function () {
    if(this.stlImportSession||this.stlSurfaceReview)throw new Error('Finish or cancel STL preparation first.');
    if (!this.document.geometry || !this.geometrySource) { throw new Error('Import geometry before generating a mesh.'); }
    this.document.meshGeneration = { status: 'generating', error: null, progress: null };
    this.notify();
  };

  AppController.prototype.reportMeshProgress = function (progress) {
    if (this.document.meshGeneration.status !== 'generating') { return; }
    this.document.meshGeneration = { status: 'generating', error: null, progress: progress };
    this.notify();
  };

  AppController.prototype.completeMeshGeneration = function (mesh) {
    var validation = root.SpjutsimFEA.validateVolumeMeshResult(mesh, this.document.geometry && this.document.geometry.faceIds);
    if (!validation.valid) { throw new Error('Invalid volume mesh: ' + validation.reason); }
    this.document.mesh = mesh;
    this.document.viewportPresentation = Object.assign({}, this.document.viewportPresentation, {mode: 'mesh'});
    this.document.meshMetadata = { statistics: mesh.statistics, quality: mesh.quality, memoryInputs: mesh.memoryInputs };
    this.refreshConstraintStability();
    this.invalidateResults('mesh');
    this.document.meshGeneration = { status: 'succeeded', error: null, progress: null };
    this.notify();
  };

  AppController.prototype.clearMesh = function () {
    this.document.mesh = null;
    this.document.meshMetadata = null;
    this.refreshConstraintStability();
    this.invalidateResults('mesh');
    this.document.meshGeneration = { status: 'idle', error: null, progress: null };
    this.document.viewportPresentation = Object.assign({}, this.document.viewportPresentation, {mode: 'model'});
    this.notify();
  };

  AppController.prototype.failMeshGeneration = function (error) {
    this.document.meshGeneration = { status: 'failed', error: error && error.diagnostic ? error.diagnostic : error, progress: null };
    this.notify();
  };

  /** Update viewport-only state without invalidating imported or analysis data. */
  AppController.prototype.replaceViewportPresentation = function (presentation) {
    this.document.viewportPresentation = validateViewportPresentation(presentation, Boolean(this.document.mesh), Boolean(this.document.results));
    this.notify();
  };

  AppController.prototype.beginSolvePreflight = function () {
    if(this.stlImportSession||this.stlSurfaceReview)throw new Error('Finish or cancel STL preparation first.');
    if (!root.SpjutsimFEA.solveReadiness(this.document).canCheck) { throw new Error(root.SpjutsimFEA.solveReadiness(this.document).message); }
    if (!this.document.mesh) { throw new Error('Generate a mesh before preflight.'); }
    this.document.solvePreflight = { status: 'running', result: null, error: null, progress: null,
      analysisRevision: this.document.analysisRevision };
    this.document.solveExecution = { status: 'idle', error: null, progress: null, analysisRevision: null };
    this.notify();
    return this.document.analysisRevision;
  };

  AppController.prototype.replaceSolveTimeLimit = function (milliseconds) {
    if (root.SpjutsimFEA.engineeringBusy(this.document) || this.document.assignmentDraft) {
      throw new Error('Finish or cancel the current operation before changing the solve time limit.');
    }
    if (!Number.isFinite(milliseconds) || milliseconds < 1000 || milliseconds > 3600000) {
      throw new Error('Choose a solve time limit between one second and 60 minutes.');
    }
    // A runtime budget does not change the physical model or accepted results.
    this.document.solveSettings = Object.assign({}, this.document.solveSettings, { maxDurationMs: milliseconds });
    this.notify();
  };

  AppController.prototype.reportSolveProgress = function (progress) {
    var target = this.document.solveExecution.status === 'running' ? this.document.solveExecution : this.document.solvePreflight;
    if (target.status !== 'running') { return; }
    target.progress = progress;
    this.notify('solve-progress');
  };

  AppController.prototype.completeSolvePreflight = function (revision, result) {
    if (revision !== this.document.analysisRevision || this.document.solvePreflight.status !== 'running') { return false; }
    var validation = root.SpjutsimFEA.validatePreflightResult(result);
    if (!validation.valid) { throw new Error('Invalid solve preflight: ' + validation.reason); }
    this.document.solvePreflight = { status: 'ready', result: result, error: null, progress: null, analysisRevision: revision };
    this.document.lastSolveCheck = this.document.solvePreflight;
    this.notify();
    return true;
  };

  AppController.prototype.failSolvePreflight = function (revision, error) {
    if (revision !== this.document.analysisRevision) { return false; }
    this.document.solvePreflight = { status: 'failed', result: null,
      error: error && error.diagnostic ? error.diagnostic : error, progress: null, analysisRevision: revision };
    this.document.lastSolveCheck = this.document.solvePreflight;
    this.notify();
    return true;
  };

  AppController.prototype.beginSolve = function () {
    if(this.stlImportSession||this.stlSurfaceReview)throw new Error('Finish or cancel STL preparation first.');
    var preflight = this.document.solvePreflight;
    if (!root.SpjutsimFEA.solveReadiness(this.document).canSolve) {
      throw new Error('Complete a valid solve preflight before solving.');
    }
    this.document.solveExecution = { status: 'running', error: null, progress: null, analysisRevision: this.document.analysisRevision };
    this.notify();
    return this.document.analysisRevision;
  };

  // Keep the chosen view through temporary mesh/model fallbacks during setup edits.
  AppController.prototype.rememberSolvedPresentation = function () {
    var presentation = this.assignmentDraftReturn ? this.assignmentDraftReturn.presentation : this.document.viewportPresentation;
    this.solvedPresentation = {};
    ['mode','field','deformationMode','userDeformationScale'].forEach(function (key) {
      this.solvedPresentation[key] = presentation[key];
    }, this);
  };

  AppController.prototype.restoreSolvedPresentation = function () {
    var presentation = Object.assign({}, this.document.viewportPresentation, this.solvedPresentation || {
      mode:'stress',field:'vonMises',deformationMode:'undeformed',userDeformationScale:1
    });
    presentation.colorRange = root.SpjutsimFEA.validateColorRange(null,presentation.field);
    var scale = 0;
    if (presentation.mode === 'deformation') {
      if (presentation.deformationMode === 'true-scale') { scale = 1; }
      if (presentation.deformationMode === 'user') { scale = presentation.userDeformationScale; }
      if (presentation.deformationMode === 'auto') {
        var positions = this.document.results.originalSurface.nodePositionsM;
        var min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
        for (var i = 0; i < positions.length; i += 3) {
          for (var axis = 0; axis < 3; axis++) { min[axis] = Math.min(min[axis],positions[i+axis]); max[axis] = Math.max(max[axis],positions[i+axis]); }
        }
        var displacement = this.document.results.extrema.maxDisplacement.valueM;
        scale = displacement > 0 ? Math.hypot(max[0]-min[0],max[1]-min[1],max[2]-min[2])*0.1/displacement : 1;
      }
    }
    presentation.deformationScale = scale;
    this.document.viewportPresentation = presentation;
  };

  AppController.prototype.completeSolve = function (revision, result) {
    if (revision !== this.document.analysisRevision || this.document.solveExecution.status !== 'running') { return false; }
    var validation = root.SpjutsimFEA.validateResultModel(result, revision);
    if (!validation.valid) { throw new Error('Invalid solve result: ' + validation.reason); }
    if (this.document.results) { this.rememberSolvedPresentation(); }
    this.document.results = root.SpjutsimFEA.decorateResultWithTrust(result, this.document.material);
    this.document.solveExecution = { status: 'succeeded', error: null, progress: null, analysisRevision: revision };
    this.document.resultInvalidation = null;
    this.restoreSolvedPresentation();
    this.notify();
    return true;
  };

  AppController.prototype.beginConvergenceStudy = function (settings) {
    if(this.stlImportSession||this.stlSurfaceReview)throw new Error('Finish the geometry review first.');
    if (this.document.assignmentDraft) { throw new Error('Apply or Cancel the assignment draft before starting convergence.'); }
    if (!this.document.geometry || !this.document.material || !this.geometrySource) {
      throw new Error('Import geometry and define a material before starting convergence.');
    }
    this.document.convergenceStudy = { schemaVersion: 1, status: 'running',
      settings: root.SpjutsimFEA.createConvergenceSettings(settings), levels: [],
      classification: null, stopReason: null, error: null, progress: null,
      selectedLevel: null, selectedResult: null, analysisRevision: this.document.analysisRevision };
    this.notify();
    return this.document.analysisRevision;
  };

  AppController.prototype.reportConvergenceProgress = function (revision, progress) {
    var study = this.document.convergenceStudy;
    if (!study || study.status !== 'running' || revision !== this.document.analysisRevision) { return false; }
    study.progress = progress; this.notify('convergence-progress'); return true;
  };

  AppController.prototype.completeConvergenceLevel = function (revision, summary, result) {
    var study = this.document.convergenceStudy;
    if (!study || study.status !== 'running' || revision !== this.document.analysisRevision) { return false; }
    study.levels.push(summary);
    study.selectedLevel = summary.level;
    study.selectedResult = result;
    if (this.document.results) { this.rememberSolvedPresentation(); }
    this.document.results = result;
    this.restoreSolvedPresentation();
    this.notify(); return true;
  };

  AppController.prototype.completeConvergenceStudy = function (revision, classification, error) {
    var study = this.document.convergenceStudy;
    if (!study || revision !== this.document.analysisRevision) { return false; }
    study.status = classification.stopReason === 'cancelled' ? 'cancelled' :
      classification.status === 'failed' ? 'failed' : 'completed';
    study.classification = classification;
    study.stopReason = classification.stopReason;
    study.error = error || null;
    study.progress = null;
    if (study.selectedResult) {
      study.selectedResult.convergenceStatus = classification.status;
      if (classification.warning && study.selectedResult.warnings.indexOf(classification.warning) < 0) {
        study.selectedResult.warnings.push(classification.warning);
      }
    }
    this.notify(); return true;
  };

  AppController.prototype.cancelConvergenceStudy = function () {
    var study = this.document.convergenceStudy;
    if (!study || study.status !== 'running') { return false; }
    study.status = 'cancelled'; study.stopReason = 'cancelled'; study.progress = null;
    this.notify(); return true;
  };

  AppController.prototype.restartConvergenceStudy = function () {
    var settings = this.document.convergenceStudy && this.document.convergenceStudy.settings;
    return this.beginConvergenceStudy(settings);
  };

  AppController.prototype.selectConvergenceLevel = function (level) {
    var study = this.document.convergenceStudy;
    if (!study || study.selectedLevel !== level || !study.selectedResult) { return false; }
    this.document.results = study.selectedResult; this.notify(); return true;
  };

  AppController.prototype.failSolve = function (revision, error) {
    if (revision !== this.document.analysisRevision) { return false; }
    this.document.solveExecution = { status: 'failed', error: error && error.diagnostic ? error.diagnostic : error,
      progress: null, analysisRevision: revision };
    this.notify();
    return true;
  };

  AppController.prototype.cancelSolve = function () {
    var wasRunning = this.document.solveExecution.status === 'running' || this.document.solvePreflight.status === 'running';
    if (!wasRunning) { return; }
    if (this.document.solveExecution.status === 'running') {
      this.document.solveExecution = { status: 'cancelled', error: null, progress: null, analysisRevision: this.document.analysisRevision };
    } else {
      this.document.solvePreflight = { status: 'cancelled', result: null, error: null, progress: null, analysisRevision: this.document.analysisRevision };
    }
    this.notify();
  };

  AppController.prototype.discardSolvePreflight = function () {
    if (this.document.solvePreflight.status === 'idle' && this.document.solveExecution.status !== 'running') { return; }
    this.document.solvePreflight = { status: 'idle', result: null, error: null, progress: null, analysisRevision: null };
    if (this.document.solveExecution.status !== 'succeeded') {
      this.document.solveExecution = { status: 'idle', error: null, progress: null, analysisRevision: null };
    }
    this.notify();
  };

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.AppController = AppController;
}(globalThis));
