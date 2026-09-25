(function (root) {
  'use strict';
  var api=root.SpjutsimFEA, identities=new WeakMap();
  var LEGACY_PRODUCER='spjutsim-fea/cad-face-map-1/mesh-1/result-2';
  var PRODUCER=LEGACY_PRODUCER+'/local-frame-1';
  function clone(value) { return value===undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function setupDefinition(controller) {
    var state=controller.document;
    return {material:state.material,boundaryConditions:state.boundaryConditions,loads:state.loads,gravity:state.gravity,
      meshSettings:state.meshSettings,solveSettings:state.solveSettings,orientation:state.geometry && state.geometry.orientation,
      materialProvenance:state.materialProvenance || ((api.FACTORY_MATERIALS || []).find(function(entry){return JSON.stringify(entry.material)===JSON.stringify(state.material);}) || {}).metadata || null,
      metadata:state.projectMetadata || {name:'',reportOptions:null}};
  }
  function projectFaceEvidence(geometry) {
    var preview=geometry.preview;
    return preview.faceRanges.map(function(range) {
      // Ordered canonical tessellation binds each opaque FaceId to its actual surface.
      var coordinates=new Float64Array(range.count*3);
      for(var i=0;i<range.count;i++) {
        var node=preview.indices[range.start+i]*3;
        coordinates[i*3]=preview.positionsM[node];coordinates[i*3+1]=preview.positionsM[node+1];coordinates[i*3+2]=preview.positionsM[node+2];
      }
      return {id:range.faceId,count:range.count,crc:api.crc32(new Uint8Array(coordinates.buffer))};
    });
  }
  async function projectSourceIdentity(buffer) {
    if(!identities.has(buffer)) {
      if(!root.crypto || !root.crypto.subtle) { throw Error('Project identity requires browser Web Crypto. Open locally or on localhost.'); }
      identities.set(buffer,root.crypto.subtle.digest('SHA-256',buffer).then(function(hash){return Array.from(new Uint8Array(hash),function(v){return v.toString(16).padStart(2,'0');}).join('');}));
    }
    return identities.get(buffer);
  }
  function validateProjectManifest(manifest) {
    if(!manifest || manifest.format!=='SpjutSim-FEA' || manifest.version!==1 || ![PRODUCER,LEGACY_PRODUCER].includes(manifest.producer)) { throw Error('Unsupported project version or CAD identity producer. Open with the producing app version.'); }
    var source=manifest.source;
    if(!source || typeof source.name!=='string' || api.sourceFormatForFilename(source.name)!==source.format || !/^[a-f0-9]{64}$/.test(source.identity) || typeof source.geometryId!=='string' || !Array.isArray(source.faces) || !source.faces.length || source.faces.length>100000) { throw Error('Invalid project CAD identity.'); }
    var ids=new Set();source.faces.forEach(function(face){if(!face || typeof face.id!=='string' || !face.id || ids.has(face.id) || !Number.isSafeInteger(face.count) || face.count<=0 || !Number.isInteger(face.crc) || face.crc<0 || face.crc>0xffffffff){throw Error('Invalid project face evidence.');}ids.add(face.id);});
    var setup=manifest.setup;
    if(!setup || !Array.isArray(setup.loads) || !Array.isArray(setup.boundaryConditions) || setup.loads.length+setup.boundaryConditions.length>10000 || !api.validateRigidOrientation(setup.orientation).valid) { throw Error('Invalid saved setup.'); }
    if(manifest.producer===LEGACY_PRODUCER && setup.loads.concat(setup.boundaryConditions).some(function(item){return item && (item.frame!==undefined || item.preset!==undefined);})) { throw Error('Legacy project producer cannot contain local frame definitions.'); }
    var provenance=setup.materialProvenance;
    if(provenance !== null && provenance !== undefined) {
      if(typeof provenance !== 'object' || typeof provenance.notes !== 'string' ||
        !provenance.fieldProvenance || typeof provenance.fieldProvenance !== 'object' || Array.isArray(provenance.fieldProvenance) ||
        Object.keys(provenance.fieldProvenance).some(function(key){
          var entry=provenance.fieldProvenance[key];
          return !entry || typeof entry.label !== 'string' || typeof entry.url !== 'string';
        })) { throw Error('Invalid saved material provenance.'); }
    }
    var assignmentIds=new Set();setup.loads.concat(setup.boundaryConditions).forEach(function(item){if(!item || typeof item.id!=='string' || assignmentIds.has(item.id)){throw Error('Invalid or duplicate assignment ID.');}assignmentIds.add(item.id);});
    var counters=manifest.counters;
    if(!counters || !['item','support','load'].every(function(k){return Number.isSafeInteger(counters[k]) && counters[k]>0;})) { throw Error('Invalid assignment counters.'); }
    if(setup.metadata && (typeof setup.metadata.name!=='string' || setup.metadata.name.length>256)) { throw Error('Invalid project name.'); }
    function finite(value,depth) {
      if(depth>32) { throw Error('Project metadata is too deeply nested.'); }
      if(typeof value==='number' && !Number.isFinite(value)) { throw Error('Project metadata contains a nonfinite number.'); }
      if(value && typeof value==='object') { Object.keys(value).forEach(function(k){if(['__proto__','constructor','prototype'].includes(k)){throw Error('Invalid project metadata key.');}finite(value[k],depth+1);}); }
    }
    finite(manifest,0);
  }
  function fingerprint(manifest) { return JSON.stringify({source:manifest.source.identity,faces:manifest.source.faces,setup:manifest.setup,producer:manifest.producer}); }
  function projectCacheMatchesSetup(manifest) {
    return Boolean(manifest.cache && manifest.cache.producer===PRODUCER && manifest.cache.byteOrder==='little' && new Uint8Array(new Uint16Array([1]).buffer)[0]===1 && manifest.cache.fingerprint===fingerprint(manifest) && Number.isSafeInteger(manifest.cache.analysisRevision) && manifest.cache.analysisRevision>=0);
  }
  function meshMatchesResult(mesh,result) {
    var surface=result.originalSurface, boundary=mesh.boundaryFaces.triangleConnectivity;
    if(!surface || !result.meshStatistics || result.elementType!==mesh.elementType || result.meshStatistics.elementCount!==mesh.statistics.elementCount || surface.nodePositionsM.length!==mesh.nodePositionsM.length || !surface.triangleConnectivity || boundary.length!==surface.triangleConnectivity.length){return false;}
    for(var i=0;i<mesh.nodePositionsM.length;i++){if(Math.fround(mesh.nodePositionsM[i])!==surface.nodePositionsM[i]){return false;}}
    return boundary.every(function(value,index){return value===surface.triangleConnectivity[index];});
  }
  function resultForCache(result) {
    if (!result || !result.factorOfSafety) { return result; }
    // FoS is regenerated from validated stresses/material on open. Its legitimate
    // infinities are not JSON metadata; retain the bulk solver arrays by reference.
    var saved = Object.assign({}, result, {
      surfaceFields: Object.assign({}, result.surfaceFields),
      ranges: Object.assign({}, result.ranges),
      extrema: Object.assign({}, result.extrema)
    });
    delete saved.factorOfSafety;
    delete saved.surfaceFields.factorOfSafety;
    delete saved.ranges.factorOfSafety;
    delete saved.extrema.rawFactorOfSafetyMinimum;
    delete saved.extrema.displayedFactorOfSafetyMinimum;
    return saved;
  }
  async function createProjectSnapshot(controller,options) {
    if(!controller.geometrySource || !controller.document.geometry) { throw Error('Import a CAD model before saving a project.'); }
    if(root.SpjutsimFEA.hasPendingAssignment(controller.document)) { throw Error('Finish the incomplete edit or close its editor before saving.'); }
    controller.observeProject();
    var source=controller.geometrySource, state=controller.document, revision=controller.projectRevision;
    var manifest={format:'SpjutSim-FEA',version:1,producer:PRODUCER,
      source:{name:source.sourceName,format:source.sourceFormat,geometryId:state.geometry.geometryId,faces:clone(source.faceEvidence || projectFaceEvidence(state.geometry))},
      setup:clone(setupDefinition(controller)),counters:{item:controller.nextAnalysisItemSequence,support:controller.nextSupportNameSequence,load:controller.nextLoadNameSequence},
      presentation:clone(state.viewportPresentation)};
    var derived=null;
    if(options && options.includeDerived && state.mesh) {
      if(api.engineeringBusy(state)){throw Error('Finish or cancel the current operation before saving mesh/results.');}
      if(state.results && !meshMatchesResult(state.mesh,state.results)){throw Error('The displayed result belongs to a different mesh (for example a convergence level). Save CAD/setup only, or generate and solve the current mesh before including results.');}
      derived={mesh:state.mesh,results:state.results && state.results.analysisRevision===state.analysisRevision ? resultForCache(state.results) : null,
        convergence:state.convergenceStudy && state.convergenceStudy.status!=='running' ? clone(Object.assign({},state.convergenceStudy,{selectedResult:null})) : null};
      manifest.cache={producer:PRODUCER,byteOrder:'little',analysisRevision:state.analysisRevision};
    }
    manifest.source.identity=await projectSourceIdentity(source.sourceBytes);
    if(manifest.cache) { manifest.cache.fingerprint=fingerprint(manifest); }
    validateProjectManifest(manifest);
    return {manifest:manifest,source:source,derived:derived,revision:revision};
  }
  function restoreConvergence(study,revision,geometry) {
    if(study===null || study===undefined){return null;}
    if(study.schemaVersion!==1 || !['completed','cancelled','failed'].includes(study.status) || study.analysisRevision!==revision || !Array.isArray(study.levels) || study.levels.length>4 || !study.settings){throw Error('Invalid saved convergence study.');}
    var settings=api.createConvergenceSettings(study.settings);
    study.levels.forEach(function(level,index){
      if(!level || level.level!==index+1 || !Number.isFinite(level.targetSizeM) || level.targetSizeM<=0 ||
        !['nodeCount','elementCount','degreeOfFreedomCount','estimatedPeakBytes'].every(function(key){return Number.isSafeInteger(level[key]) && level[key]>0;}) ||
        !['maximumDisplacementM','strainEnergyJ','rawVonMisesMaxPa','solveDurationMs','iterations'].every(function(key){return Number.isFinite(level[key]) && level[key]>=0;}) ||
        !Array.isArray(level.peakLocationM) || level.peakLocationM.length!==3 || !level.peakLocationM.every(Number.isFinite)){throw Error('Invalid saved convergence level.');}
    });
    var diagonal=Math.hypot.apply(null,geometry.boundingBoxM.maxM.map(function(v,i){return v-geometry.boundingBoxM.minM[i];}));
    return {schemaVersion:1,status:study.status,settings:settings,levels:clone(study.levels),
      classification:api.classifyConvergence(study.levels,settings,diagonal,study.stopReason),stopReason:study.stopReason,
      error:study.error && {userMessage:String(study.error.userMessage || 'Saved study did not complete.')},
      progress:null,selectedLevel:study.selectedLevel,selectedResult:null,analysisRevision:revision};
  }
  function prepareProjectCandidate(project,geometry) {
    var manifest=project.manifest;validateProjectManifest(manifest);
    var valid=api.validateGeometryModel(geometry);
    if(!valid.valid || geometry.geometryId!==manifest.source.geometryId || JSON.stringify(projectFaceEvidence(geometry))!==JSON.stringify(manifest.source.faces)) { throw Error('Saved CAD face identity could not be reproduced. The current project was preserved; use the original app version or reimport CAD and review assignments.'); }
    var oriented=api.restoreGeometryOrientation(geometry,manifest.setup.orientation);
    var controller=new api.AppController({document:api.createAnalysisDocument()});
    controller.replaceGeometryWithSetup(oriented,project.source,manifest.setup);
    var state=controller.document;state.materialProvenance=clone(manifest.setup.materialProvenance || null);state.projectMetadata=clone(manifest.setup.metadata || {name:'',reportOptions:null});
    var warning=project.cacheWarning || null;
    if(manifest.cache && !warning) {
      try {
        if(!projectCacheMatchesSetup(manifest) || !project.derived) { throw Error('Source/setup or cache producer differs.'); }
        var mesh=project.derived.mesh, meshValidation=api.validateVolumeMeshResult(mesh,geometry.faceIds);
        if(!meshValidation.valid || mesh.elementType!==state.meshSettings.elementType) { throw Error('Mesh is invalid or incompatible with setup.'); }
        var results=project.derived.results;
        if(results) {
          var resultValidation=api.validateResultModel(results,manifest.cache.analysisRevision);
          if(!resultValidation.valid || !meshMatchesResult(mesh,results)){throw Error('Saved results are invalid or incompatible with the mesh.');}
        }
        var convergence=restoreConvergence(project.derived.convergence,manifest.cache.analysisRevision,geometry);
        state.mesh=mesh;state.meshMetadata={statistics:mesh.statistics,quality:mesh.quality,memoryInputs:mesh.memoryInputs};state.meshGeneration.status='succeeded';
        state.analysisRevision=manifest.cache.analysisRevision;state.results=results ? api.decorateResultWithTrust(results,state.material) : null;
        state.convergenceStudy=convergence;
        if(state.results && convergence){state.results.convergenceStatus=convergence.classification.status;if(convergence.classification.warning && !state.results.warnings.includes(convergence.classification.warning)){state.results.warnings.push(convergence.classification.warning);}}
        if(results) { state.solveExecution.status='succeeded';state.solveExecution.analysisRevision=state.analysisRevision; }
        controller.refreshConstraintStability();
      } catch(error) { warning='Open setup only: '+error.message; }
    }
    if(warning) { state.mesh=null;state.meshMetadata=null;state.results=null;state.convergenceStudy=null;state.meshGeneration.status='idle';state.solveExecution={status:'idle',error:null,progress:null,analysisRevision:null};controller.refreshConstraintStability(); }
    var presentation=clone(manifest.presentation);
    if(presentation && presentation.field==='factorOfSafety' && !(state.results && state.results.factorOfSafety)){presentation.field='vonMises';}
    try { controller.replaceViewportPresentation(presentation); } catch(error) { /* Derived views fall back to the model when unavailable. */ }
    return {document:state,source:project.source,counters:manifest.counters,cacheWarning:warning};
  }
  var prototype=api.AppController.prototype;
  prototype.newProject=function() {
    this.document=api.createAnalysisDocument();this.geometrySource=null;
    this.history.clear();this.assignmentDraftReturn=null;this.solvedPresentation=null;
    this.nextAnalysisItemSequence=1;this.nextSupportNameSequence=1;this.nextLoadNameSequence=1;
    this.notify('project-new');
  };
  prototype.observeProject=function() {
    var source=this.geometrySource;
    if(source && !source.faceEvidence) { source.faceEvidence=projectFaceEvidence(this.document.geometry); }
    var definition=JSON.stringify(setupDefinition(this));
    if(this.projectDefinition!==definition || this.projectSource!==source) {
      this.projectDefinition=definition;this.projectSource=source;this.projectRevision=(this.projectRevision || 0)+1;
    }
    this.projectDirty=Boolean(source && this.savedProjectRevision!==this.projectRevision);
  };
  prototype.markProjectSaved=function(revision) { this.savedProjectRevision=revision;this.notify('project-status'); };
  prototype.replaceProjectMetadata=function(metadata) {
    if(!metadata || typeof metadata.name!=='string' || metadata.name.length>256) { throw Error('Use a project name of at most 256 characters.'); }
    this.document.projectMetadata=clone(metadata);this.notify('project-metadata');
  };
  prototype.installProject=function(candidate,recovered) {
    this.document=candidate.document;this.geometrySource=candidate.source;
    this.history.clear();this.assignmentDraftReturn=null;this.solvedPresentation=null;
    var ids=this.document.loads.concat(this.document.boundaryConditions), next=1;
    ids.forEach(function(item){var match=/-(\d+)$/.exec(item.id);if(match){next=Math.max(next,Number(match[1])+1);}});
    this.nextAnalysisItemSequence=Math.max(next,candidate.counters.item);
    this.nextSupportNameSequence=candidate.counters.support;this.nextLoadNameSequence=candidate.counters.load;
    this.document.boundaryConditions.forEach(function(item){var match=/^Support (\d+)$/.exec(item.name);if(match){this.nextSupportNameSequence=Math.max(this.nextSupportNameSequence,Number(match[1])+1);}},this);
    this.document.loads.forEach(function(item){var match=/^Load (\d+)$/.exec(item.name);if(match){this.nextLoadNameSequence=Math.max(this.nextLoadNameSequence,Number(match[1])+1);}},this);
    this.observeProject();this.savedProjectRevision=recovered ? null : this.projectRevision;this.notify('project-open');
  };
  api.projectFaceEvidence=projectFaceEvidence;
  api.projectCacheMatchesSetup=projectCacheMatchesSetup;
  api.projectSourceIdentity=projectSourceIdentity;
  api.validateProjectManifest=validateProjectManifest;
  api.createProjectSnapshot=createProjectSnapshot;
  api.prepareProjectCandidate=prepareProjectCandidate;
}(globalThis));
