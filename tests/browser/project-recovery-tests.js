(async function(){
  var api=SpjutsimFEA;function assert(v,m){if(!v)throw Error(m);}
  try{
    assert(typeof api.ProjectRecoveryStore==='function','Recovery storage is missing');
    var store=new api.ProjectRecoveryStore('spjutsim-recovery-test-'+Date.now());
    var app=new api.AppController({document:api.createAnalysisDocument()});
    app.replaceGeometry(api.assignmentTestGeometry('recover'),{sourceName:'cube.step',sourceFormat:'step',sourceBytes:new Uint8Array([1,2,3]).buffer});
    var snapshot=await api.createProjectSnapshot(app);
    var first=await store.write('record','owner-a',0,snapshot);
    app.replaceMaterial({youngsModulusPa:200e9,poissonsRatio:0.3});var next=await api.createProjectSnapshot(app);
    await store.write('record','owner-a',first.generation,next);
    var stats=await store.inspect();assert(stats.records.length===1 && stats.sources.length===1 && stats.sources[0].blob.size===3,'Recovery copied unchanged CAD or retained mesh');
    var originalPut=IDBObjectStore.prototype.put;
    var replacement=Object.assign({},next,{source:{sourceBytes:new Uint8Array([4,5,6]).buffer},manifest:structuredClone(next.manifest)});
    replacement.manifest.source.identity=await api.projectSourceIdentity(replacement.source.sourceBytes);
    IDBObjectStore.prototype.put=function(value){if(this.name==='records'){throw new DOMException('Injected quota failure','QuotaExceededError');}return originalPut.apply(this,arguments);};
    var interrupted=false;try{await store.write('record','owner-a',2,replacement);}catch(e){interrupted=true;}finally{IDBObjectStore.prototype.put=originalPut;}
    stats=await store.inspect();assert(interrupted && stats.sources.length===1 && stats.records[0].generation===2,'Interrupted source/setup transaction lost previous recovery');
    var available=await store.list();var restored=await store.read(available[0].id);
    assert(restored.manifest.setup.material.youngsModulusPa===200e9 && !restored.derived,'Recovery did not preserve only committed setup');
    var owned=await store.claim('record','owner-b',available[0].generation);
    var rejected=false;try{await store.write('record','owner-a',available[0].generation,snapshot);}catch(e){rejected=true;}
    assert(rejected && (await store.read('record')).manifest.setup.material.youngsModulusPa===200e9,'Competing session overwrote last valid recovery');
    await store.discard('record','owner-b',owned.generation);stats=await store.inspect();assert(!stats.records.length&&!stats.sources.length,'Discard retained source blobs');
    var coordinated=new api.ProjectRecoveryStore('spjutsim-session-test-'+Date.now());
    var firstRecovery=new api.ProjectRecovery(app,{store:coordinated}),secondRecovery=new api.ProjectRecovery(app,{store:coordinated});
    var memory=new Map(),preferences={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
    var firstSession=new api.RecoverySession(firstRecovery,{local:preferences,tab:preferences}),secondSession=new api.RecoverySession(secondRecovery,{local:preferences,tab:preferences});
    await firstSession.hold(firstRecovery.id);var record=await coordinated.write(firstRecovery.id,firstRecovery.owner,0,next);
    firstSession.remember({id:record.id});assert((await secondSession.previous()).id===record.id,'Previous project was not located');
    var conflict=false;try{await secondSession.adopt(record);}catch(error){conflict=true;}assert(conflict,'A live tab lost its recovery ownership');
    await firstSession.close();await secondSession.adopt(record);assert(secondRecovery.id===record.id && secondRecovery.generation===2,'Closed session could not be resumed in place');
    secondSession.remember({empty:true});assert(await secondSession.previous()===null,'Explicit New did not suppress previous part recovery');secondSession.close();coordinated.close();
    var rollingStore=new api.ProjectRecoveryStore('spjutsim-rolling-test-'+Date.now());
    for(var k=0;k<4;k++){await rollingStore.write('old-'+k,'old-owner',0,next);}
    var rolling=new api.ProjectRecovery(app,{store:rollingStore}),rollingSession=new api.RecoverySession(rolling,{local:preferences,tab:preferences});
    await rollingSession.fresh();await rollingSession.writeSnapshot(next);
    assert((await rollingStore.list()).length===4 && (await rollingStore.list()).some(r=>r.id===rolling.id),'New parts exhausted recovery instead of retaining recent copies');
    var retainedIds=(await rollingStore.list()).map(r=>r.id).sort().join(',');await rollingSession.fresh();
    IDBObjectStore.prototype.put=function(value){if(this.name==='records'){throw new DOMException('Injected retirement failure','QuotaExceededError');}return originalPut.apply(this,arguments);};
    var retirementFailed=false;try{await rollingSession.writeSnapshot(next);}catch(error){retirementFailed=true;}finally{IDBObjectStore.prototype.put=originalPut;}
    assert(retirementFailed && (await rollingStore.list()).map(r=>r.id).sort().join(',')===retainedIds,'Failed new snapshot deleted an older recovery');
    await rollingSession.close();rollingStore.close();
    var unavailablePreferences=new api.RecoverySession(new api.ProjectRecovery(app),{local:null,tab:null});var stateFailed=false;try{unavailablePreferences.remember({empty:true});}catch(error){stateFailed=true;}assert(stateFailed,'New silently failed to remember the empty startup state');
    var writes=0, pending, status;
    var recovery=new api.ProjectRecovery(app,{store:{write:async function(id,owner,generation,s){writes++;assert(!s.derived,'Numerical cache leaked to recovery');return {generation:generation+1};}},schedule:function(fn){pending=fn;return 1;},unschedule:function(){},onStatus:function(s){status=s;}});
    recovery.start();app.replaceMaterial({youngsModulusPa:100e9,poissonsRatio:0.3});app.replaceMaterial({youngsModulusPa:90e9,poissonsRatio:0.3});await pending();
    assert(writes===1 && status.includes('Recovered')===false,'Burst edits were not coalesced');
    app.notify();assert(writes===1,'No-op produced a recovery write');recovery.stop();store.close();
    for(var i=0;i<4;i++){await store.write('bounded-'+i,'owner',0,snapshot);}
    var limited=false;try{await store.write('fifth','owner',0,snapshot);}catch(e){limited=true;}
    assert(limited && (await store.list()).length===4,'Retention overflow destroyed existing recovery');
    var recoveryFailure=new api.ProjectRecovery(app,{store:{write:async function(){throw Error('Quota exceeded');}},schedule:function(fn){pending=fn;return 1;},unschedule:function(){},onStatus:function(s){status=s;}});
    recoveryFailure.start();await pending();assert(!recoveryFailure.active && status.includes('unavailable'),'Storage failure was silent');recoveryFailure.stop();
    var manual=await api.writeProjectFile(await api.createProjectSnapshot(app));assert(manual.size>0,'Recovery failure prevented portable saving');
    var cleanupStore=new api.ProjectRecoveryStore('spjutsim-cleanup-test-'+Date.now());
    var cleanup=new api.ProjectRecovery(app,{store:cleanupStore,schedule:function(fn){pending=fn;return 1;},unschedule:function(){}});cleanup.start();await pending();app.clearGeometry();
    for(var attempt=0;attempt<20 && (await cleanupStore.list()).length;attempt++){await new Promise(r=>setTimeout(r,10));}
    assert(!(await cleanupStore.list()).length,'Removing the model retained its recoverable source');cleanup.stop();cleanupStore.close();
    window.recoveryEvidence={records:(await store.list()).length,sources:(await store.inspect()).sources.length,sourceBytes:3,debouncedWrites:writes};store.close();
    document.getElementById('test-status').textContent='Passed';
  }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;console.error(e);}
}());
