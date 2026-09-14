(function () {
  function assert(ok,m){if(!ok)throw Error(m);}
  try {
    var api=SpjutsimFEA, saved='', storage={getItem:function(){return saved||null;},setItem:function(k,v){saved=v;}}, prefs=new api.UnitPreferences(storage);
    assert(prefs.units.forceN==='N'&&prefs.units.stressPa==='MPa','SI defaults');
    prefs.select('uscs'); assert(prefs.units.youngsModulusPa==='ksi'&&prefs.units.lengthM==='in'&&prefs.units.forceN==='lbf'&&prefs.units.pressurePa==='psi','USCS defaults');
    assert(Math.abs(api.displayToSI('lengthM',1,'in')-0.0254)<1e-15,'Inch conversion');
    assert(Math.abs(api.displayToSI('forceN',1,'lbf')-4.4482216152605)<1e-12,'Pound-force conversion');
    prefs.rename('Shop'); var id=prefs.active;assert(id!=='uscs'&&prefs.records.length===1,'Naming built-in must save custom');
    prefs.edit({forceN:'kip'});assert(prefs.active===id&&prefs.records[0].units.forceN==='kip','Saved set edits update');
    prefs.rename('Shop revised');prefs.copy();assert(prefs.records.length===2&&prefs.records[1].name==='Shop revised Copy','Copy lifecycle');
    var reloaded=new api.UnitPreferences(storage);assert(reloaded.active===prefs.active&&reloaded.units.forceN==='kip','Persistence');
    reloaded.remove();assert(reloaded.active==='custom'&&reloaded.units.forceN==='kip','Delete preserves units');
    var rejected=false;try{reloaded.rename('SI');}catch(e){rejected=true;}assert(rejected,'Reserved name allowed');
    rejected=false;try{reloaded.edit({forceN:'psi'});}catch(e){rejected=true;}assert(rejected&&reloaded.units.forceN==='kip','Invalid units mutate state');
    var corrupt=new api.UnitPreferences({getItem:function(){return '{bad';}});assert(corrupt.active==='si'&&corrupt.error,'Corrupt settings recovery');
    var draftText=api.describeAssignmentDraft({assignmentDraft:{kind:'load',faceIds:[],definition:{type:'total-force',direction:'surface-normal',magnitudeN:NaN,sense:'push'}}});
    assert(draftText.includes('— N'),'Invalid load draft should display without throwing');
    document.getElementById('test-status').textContent='Passed';
  }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;}
}());
