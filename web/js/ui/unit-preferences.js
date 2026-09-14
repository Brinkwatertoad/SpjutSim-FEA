(function(root){
  'use strict';
  var api=root.SpjutsimFEA, key='spjutsim-fea.unit-preferences', builtins={si:{name:'SI',units:api.SI_UNITS},uscs:{name:'USCS',units:api.USCS_UNITS}};
  function UnitPreferences(storage){
    this.storage=storage;this.active='si';this.units=api.SI_UNITS;this.records=[];this.error='';
    try {
      var data=JSON.parse(storage && storage.getItem(key) || 'null');
      if(!data)return;
      if(!Array.isArray(data.records)||data.records.length>100)throw Error('Invalid library');
      var ids=new Set(),names=new Set(['si','uscs','custom']);
      data.records.forEach(function(r){
        if(!r||!/^preset:[\w-]{1,80}$/.test(r.id)||ids.has(r.id)||typeof r.name!=='string'||!r.name.trim()||r.name.length>80||names.has(r.name.toLowerCase()))throw Error('Invalid preset');
        ids.add(r.id);names.add(r.name.toLowerCase());api.validatePreferredUnits(r.units);
      });
      var units=api.validatePreferredUnits(data.units), record=builtins[data.active]||data.records.find(function(r){return r.id===data.active;});
      this.active=record && Object.keys(units).every(function(k){return record.units[k]===units[k];}) ? data.active : 'custom';
      this.units=units;this.records=data.records;
    } catch(e){this.error='Saved unit preferences could not be loaded. SI defaults are active.';}
  }
  UnitPreferences.prototype.persist=function(){
    try{if(!this.storage)throw Error('No storage');this.storage.setItem(key,JSON.stringify({active:this.active,units:this.units,records:this.records}));this.error='';}
    catch(e){this.error='Unit preferences apply for this session but could not be saved in this browser.';}
  };
  UnitPreferences.prototype.select=function(id){
    var record=builtins[id]||this.records.find(function(r){return r.id===id;});
    if(!record&&id!=='custom')throw Error('Choose an available unit set.');
    this.units=record ? api.validatePreferredUnits(record.units) : this.units;this.active=id;this.persist();
  };
  UnitPreferences.prototype.edit=function(patch){
    var units=api.validatePreferredUnits(Object.assign({},this.units,patch)), record=this.records.find(function(r){return r.id===this.active;},this);
    if(Object.keys(units).every(function(k){return units[k]===this.units[k];},this))return;
    this.units=units;if(record)record.units=units;else this.active='custom';this.persist();
  };
  UnitPreferences.prototype.rename=function(name){
    name=name.trim();
    if(!name||name.length>80||['si','uscs','custom'].includes(name.toLowerCase())||this.records.some(function(r){return r.id!==this.active&&r.name.toLowerCase()===name.toLowerCase();},this))throw Error('Use a unique, nonempty unit set name (up to 80 characters).');
    var record=this.records.find(function(r){return r.id===this.active;},this);
    if(record)record.name=name;
    else {if(this.records.length>=100)throw Error('The library is limited to 100 unit sets.');record={id:'preset:'+root.crypto.randomUUID(),name:name,units:this.units};this.records.push(record);this.active=record.id;}
    this.persist();
  };
  UnitPreferences.prototype.copy=function(){
    var record=builtins[this.active]||this.records.find(function(r){return r.id===this.active;},this), base=(record ? record.name : 'Custom').slice(0,65)+' Copy', name=base, i=1;
    while(this.records.some(function(r){return r.name.toLowerCase()===name.toLowerCase();}))name=base+' '+(++i);
    if(this.records.length>=100)throw Error('The library is limited to 100 unit sets.');
    this.active='custom';this.rename(name);
  };
  UnitPreferences.prototype.remove=function(){
    this.records=this.records.filter(function(r){return r.id!==this.active;},this);this.active='custom';this.persist();
  };
  api.UnitPreferences=UnitPreferences;api.BUILTIN_UNIT_SETS=builtins;
}(globalThis));
