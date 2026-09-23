(function(root){
  'use strict';
  var api=root.SpjutsimFEA;
  var MAX_RECORDS=4, MAX_SOURCE_BYTES=512*1024*1024;
  function requestValue(request) { return new Promise(function(resolve,reject){request.onsuccess=function(){resolve(request.result);};request.onerror=function(){reject(request.error);};}); }
  function transactionDone(transaction) { return new Promise(function(resolve,reject){transaction.oncomplete=resolve;transaction.onabort=function(){reject(transaction.error || Error('Recovery transaction was interrupted.'));};transaction.onerror=function(){};}); }
  function ProjectRecoveryStore(name) { this.name=name || 'spjutsim-fea-recovery-v1';this.connection=null; }
  ProjectRecoveryStore.prototype.open=async function(){
    if(this.connection) { return this.connection; }
    if(!root.indexedDB) { throw Error('Browser storage is unavailable.'); }
    var request=root.indexedDB.open(this.name,1);
    request.onupgradeneeded=function(){request.result.createObjectStore('records',{keyPath:'id'});request.result.createObjectStore('sources',{keyPath:'id'});};
    this.connection=await requestValue(request);return this.connection;
  };
  ProjectRecoveryStore.prototype.inspect=async function(){
    var db=await this.open(),transaction=db.transaction(['records','sources'],'readonly');
    var values=await Promise.all([requestValue(transaction.objectStore('records').getAll()),requestValue(transaction.objectStore('sources').getAll())]);
    return {records:values[0],sources:values[1]};
  };
  ProjectRecoveryStore.prototype.list=async function(){
    var db=await this.open(),rows=await requestValue(db.transaction('records','readonly').objectStore('records').getAll());
    return rows.sort(function(a,b){return b.updated-a.updated;});
  };
  ProjectRecoveryStore.prototype.read=async function(id){
    var db=await this.open(),transaction=db.transaction(['records','sources'],'readonly');
    var record=await requestValue(transaction.objectStore('records').get(id));
    if(!record) { throw Error('This recovery is no longer available.'); }
    api.validateProjectManifest(record.manifest);
    var source=await requestValue(transaction.objectStore('sources').get(record.manifest.source.identity));
    if(!source || source.blob.size>MAX_SOURCE_BYTES) { throw Error('Recovery CAD data is missing or oversized.'); }
    var bytes=await source.blob.arrayBuffer();
    if(await api.projectSourceIdentity(bytes)!==record.manifest.source.identity) { throw Error('Recovery CAD identity is damaged.'); }
    return {manifest:record.manifest,source:{sourceName:record.manifest.source.name,sourceFormat:record.manifest.source.format,sourceBytes:bytes,faceEvidence:record.manifest.source.faces}};
  };
  ProjectRecoveryStore.prototype.write=async function(id,owner,generation,snapshot,eviction){
    // All hashing/snapshot work happens before opening the short storage transaction.
    var manifest=JSON.parse(JSON.stringify(snapshot.manifest));delete manifest.cache;
    api.validateProjectManifest(manifest);
    if(new TextEncoder().encode(JSON.stringify(manifest)).length>api.PROJECT_LIMITS.manifest) { throw Error('Recovery setup exceeds its metadata limit.'); }
    var db=await this.open(),transaction=db.transaction(['records','sources'],'readwrite'), done=transactionDone(transaction);
    var records=transaction.objectStore('records'),sources=transaction.objectStore('sources'), failure=null, record;
    try {
      var values=await Promise.all([requestValue(records.getAll()),requestValue(sources.getAll())]);
      var existing=values[0].find(function(row){return row.id===id;});
      if(existing ? existing.owner!==owner || existing.generation!==generation : generation!==0) { throw Error('Another tab owns this recovery. Automatic recovery stopped; save a project file.'); }
      if(eviction && !existing){
        var retired=values[0].find(function(row){return row.id===eviction.id;});
        if(!retired || retired.owner!==eviction.owner || retired.generation!==eviction.generation){throw Error('Recovery changed while retaining recent projects. Retry recovery.');}
        values[0]=values[0].filter(function(row){return row.id!==retired.id;});records.delete(retired.id);
      }
      if(!existing && values[0].length>=MAX_RECORDS) { throw Error('Recovery storage holds four projects. Discard an older recovery to enable automatic recovery.'); }
      var referenced=new Set(values[0].filter(function(row){return row.id!==id;}).map(function(row){return row.manifest.source.identity;}));referenced.add(manifest.source.identity);
      var found=values[1].some(function(source){return source.id===manifest.source.identity;});
      var bytes=values[1].reduce(function(n,source){return n+(referenced.has(source.id)?source.blob.size:0);},0)+(found?0:snapshot.source.sourceBytes.byteLength);
      if(bytes>MAX_SOURCE_BYTES) { throw Error('Recovery CAD data exceeds 512 MiB. Manual project saving remains available.'); }
      if(!found) { sources.put({id:manifest.source.identity,blob:new Blob([snapshot.source.sourceBytes])}); }
      values[1].forEach(function(source){if(!referenced.has(source.id)){sources.delete(source.id);}});
      record={id:id,owner:owner,generation:generation+1,updated:Date.now(),manifest:manifest};records.put(record);
    } catch(error) { failure=error;transaction.abort(); }
    try { await done; } catch(error) { throw failure || error; }
    return record;
  };
  ProjectRecoveryStore.prototype.claim=async function(id,owner,generation){
    var db=await this.open(),transaction=db.transaction('records','readwrite'),done=transactionDone(transaction), records=transaction.objectStore('records');
    var row=await requestValue(records.get(id));
    if(!row || row.generation!==generation) { transaction.abort();try{await done;}catch(e){}throw Error('Recovery changed in another tab. Refresh the recovery list.'); }
    row.owner=owner;row.generation++;records.put(row);await done;return row;
  };
  ProjectRecoveryStore.prototype.discard=async function(id,owner,generation){
    var db=await this.open(),transaction=db.transaction(['records','sources'],'readwrite'),done=transactionDone(transaction),records=transaction.objectStore('records'),sources=transaction.objectStore('sources');
    var rows=await requestValue(records.getAll()),row=rows.find(function(value){return value.id===id;});
    if(row && (row.owner!==owner || row.generation!==generation)) { transaction.abort();try{await done;}catch(e){}throw Error('Recovery changed in another tab. Refresh before discarding.'); }
    records.delete(id);var keep=new Set(rows.filter(function(value){return value.id!==id;}).map(function(value){return value.manifest.source.identity;}));
    var keys=await requestValue(sources.getAllKeys());keys.forEach(function(key){if(!keep.has(key)){sources.delete(key);}});await done;
  };
  ProjectRecoveryStore.prototype.close=function(){if(this.connection){this.connection.close();this.connection=null;}};
  function ProjectRecovery(controller,options){
    options=options || {};this.controller=controller;this.store=options.store || new ProjectRecoveryStore();
    this.schedule=options.schedule || function(fn){return setTimeout(fn,0);};this.unschedule=options.unschedule || function(id){root.clearTimeout(id);};
    this.onStatus=options.onStatus || function(){};this.owner=api.createGeometryId();this.id=this.owner;this.generation=0;this.epoch=0;this.pending=null;this.running=false;this.active=false;this.lastRevision=null;
  }
  ProjectRecovery.prototype.start=function(){
    var self=this;this.active=true;
    if(!this.subscribed){this.controller.subscribe(function(){self.changed();});this.subscribed=true;}
    this.changed();
  };
  ProjectRecovery.prototype.changed=function(){
    if(!this.active) { return; }
    if(!this.controller.geometrySource) {
      if(this.generation || this.running) { this.clearCurrentRecord(); }
      return;
    }
    this.controller.observeProject();var revision=this.controller.projectRevision;
    if(revision===this.lastRevision) { return; }this.lastRevision=revision;
    if(this.pending!==null) { this.unschedule(this.pending); }
    var self=this;this.pending=this.schedule(function(){self.pending=null;return self.flush();});
  };
  ProjectRecovery.prototype.clearCurrentRecord=function(){
    var self=this, id=this.id, owner=this.owner;
    this.epoch++;this.id=api.createGeometryId();this.generation=0;this.lastRevision=null;
    if(this.pending!==null){this.unschedule(this.pending);this.pending=null;}
    this.store.list().then(function(rows){
      var row=rows.find(function(value){return value.id===id && value.owner===owner;});
      return row ? self.store.discard(id,owner,row.generation) : null;
    }).then(function(){self.onStatus('Recovery cleared for the removed model.');}).catch(function(error){self.onStatus('Recovery cleanup failed: '+error.message);});
  };
  ProjectRecovery.prototype.retry=function(){this.active=true;this.lastRevision=null;this.changed();};
  ProjectRecovery.prototype.checkpoint=async function(){
    if(this.pending!==null){this.unschedule(this.pending);this.pending=null;}
    if(!this.controller.geometrySource){return;}
    do {
      if(this.inFlight){await this.inFlight;}
      if(!this.active){throw Error('Local recovery is unavailable. Save a project file before replacing it.');}
      if(this.writtenRevision===this.controller.projectRevision){return;}
      await this.flush();
    } while(this.writtenRevision!==this.controller.projectRevision);
  };
  ProjectRecovery.prototype.flush=function(){
    if(this.inFlight){return this.inFlight;}
    var self=this;
    this.inFlight=this.writeCommitted().finally(function(){self.inFlight=null;});
    return this.inFlight;
  };
  ProjectRecovery.prototype.writeCommitted=async function(){
    if(!this.active || this.running || !this.controller.geometrySource) { return; }
    // Incomplete drafts are excluded: snapshot the committed document through a shallow facade.
    this.running=true;var epoch=this.epoch,revision=this.controller.projectRevision;
    try {
      var facade=Object.create(this.controller);facade.document=Object.assign({},this.controller.document,{assignmentDraft:null});
      var snapshot=await api.createProjectSnapshot(facade);
      if(!this.active || epoch!==this.epoch) { return; }
      var row=this.writeSnapshot ? await this.writeSnapshot(snapshot) : await this.store.write(this.id,this.owner,this.generation,snapshot);
      if(epoch!==this.epoch) { return; }this.generation=row.generation;this.writtenRevision=snapshot.revision;this.onStatus('');
    } catch(error) { this.active=false;this.onStatus('Recovery unavailable: '+error.message); }
    finally {
      this.running=false;
      if(this.active && revision!==this.controller.projectRevision) { this.lastRevision=null;this.changed(); }
    }
  };
  ProjectRecovery.prototype.stop=function(){this.active=false;this.epoch++;if(this.pending!==null){this.unschedule(this.pending);this.pending=null;}};
  // A browser-owned lock survives for the page lifetime and is released even on a crash.
  // Record generations still protect transactions when a different page claims a record.
  function RecoverySession(recovery,options) {
    options=options || {};this.recovery=recovery;this.release=null;
    this.locks=options.locks === undefined ? root.navigator && root.navigator.locks : options.locks;
    try{this.local=options.local === undefined ? root.localStorage : options.local;}catch(error){this.local=null;}
    try{this.tab=options.tab === undefined ? root.sessionStorage : options.tab;}catch(error){this.tab=null;}
    this.key='spjutsim-fea.current-project';
    recovery.writeSnapshot=this.writeSnapshot.bind(this);
  }
  RecoverySession.prototype.writeSnapshot=async function(snapshot){
    var recovery=this.recovery,store=recovery.store,rows=await store.list();
    if(rows.length<MAX_RECORDS || rows.some(function(row){return row.id===recovery.id;})){
      return store.write(recovery.id,recovery.owner,recovery.generation,snapshot);
    }
    if(this.locks){
      // Keep active tabs intact. Retirement and the new snapshot share one transaction.
      for(var previous of rows.slice().reverse()){
        var written=await this.locks.request('spjutsim-fea.recovery.'+previous.id,{ifAvailable:true},function(lock){
          return lock ? store.write(recovery.id,recovery.owner,recovery.generation,snapshot,previous) : null;
        });
        if(written){return written;}
      }
    }
    throw Error('All recovery slots are in use. Close another project tab or save a project file.');
  };
  RecoverySession.prototype.remember=function(value){
    var stored=false;
    [this.tab,this.local].forEach(function(storage){try{if(storage){storage.setItem(this.key,JSON.stringify(value));stored=true;}}catch(error){}},this);
    if(!stored){throw Error('Browser storage could not remember the startup state. Keep a project file; the next launch may reopen an older recovery.');}
  };
  RecoverySession.prototype.previous=async function(){
    var value=null;
    try{value=JSON.parse(this.tab && this.tab.getItem(this.key) || this.local && this.local.getItem(this.key) || 'null');}catch(error){}
    if(value && value.empty){return null;}
    var rows=await this.recovery.store.list();
    if(value && value.id){var row=rows.find(function(record){return record.id===value.id;});if(!row){throw Error('The previous recovery is no longer available. Open a project file or choose another local recovery.');}return row;}
    return rows[0] || null;
  };
  RecoverySession.prototype.hold=async function(id){
    if(!this.locks){throw Error('This browser cannot coordinate automatic recovery between tabs. Use Open or Local recovery.');}
    var self=this;
    await new Promise(function(resolve,reject){
      self.lockTask=self.locks.request('spjutsim-fea.recovery.'+id,{ifAvailable:true},function(lock){
        if(!lock){reject(Error('This project is active in another tab. Use Local recovery to open an independent copy.'));return;}
        return new Promise(function(release){self.release=release;resolve();});
      });
      self.lockTask.catch(reject);
    });
  };
  RecoverySession.prototype.adopt=async function(record){
    await this.hold(record.id);
    try{
      var row=await this.recovery.store.claim(record.id,this.recovery.owner,record.generation);
      this.recovery.id=row.id;this.recovery.generation=row.generation;
    }catch(error){this.close();throw error;}
  };
  RecoverySession.prototype.fresh=async function(){
    await this.close();this.recovery.id=api.createGeometryId();this.recovery.generation=0;
    this.recovery.lastRevision=null;this.recovery.writtenRevision=null;
    // Without Web Locks a fresh, uniquely named record is still safe to write.
    if(this.locks){await this.hold(this.recovery.id);}
  };
  RecoverySession.prototype.close=function(){var done=this.lockTask || Promise.resolve();if(this.release){this.release();this.release=null;}this.lockTask=null;return done;};
  api.RecoverySession=RecoverySession;
  api.ProjectRecoveryStore=ProjectRecoveryStore;api.ProjectRecovery=ProjectRecovery;
}(globalThis));
