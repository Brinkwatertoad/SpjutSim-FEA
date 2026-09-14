(function(root){
  'use strict';
  var api=root.SpjutsimFEA;
  function bindUnitSettings(controller,ui){
    var storage=null;try{storage=root.localStorage;}catch(e){/* Session preferences remain available. */}
    var prefs=new api.UnitPreferences(storage), selector=document.getElementById('settings-unit-system'), name=document.getElementById('unit-preset-name'), status=document.getElementById('units-error');
    var labels={youngsModulusPa:"Young's modulus",strengthPa:'Material strengths',densityKgM3:'Density',pressurePa:'Pressure loads',forceN:'Forces',stressPa:'Result stress',displacementM:'Displacements and part size',lengthM:'Coordinates and mesh sizes',accelerationMS2:'Acceleration',energyJ:'Energy'};
    var fields=document.getElementById('preferred-unit-fields');
    Object.keys(labels).forEach(function(quantity){
      var row=document.createElement('label');row.className='ui-settings-row';
      var label=document.createElement('span');label.textContent=labels[quantity];
      var select=document.createElement('select');select.dataset.preferredUnit=quantity;select.id='preferred-unit-'+quantity;row.htmlFor=select.id;
      api.UNIT_CHOICES[quantity].forEach(function(unit){select.add(new Option(unit,unit));});
      select.addEventListener('change',function(){edit({[quantity]:select.value});});row.append(label,select);fields.append(row);
    });
    function refresh(){
      selector.replaceChildren(new Option('SI','si'),new Option('USCS','uscs'),new Option('Custom','custom'));
      if(prefs.records.length){var group=document.createElement('optgroup');group.label='Saved presets';prefs.records.forEach(function(r){group.append(new Option(r.name,r.id));});selector.append(group);}
      selector.value=prefs.active;
      var record=api.BUILTIN_UNIT_SETS[prefs.active]||prefs.records.find(function(r){return r.id===prefs.active;});name.value=record ? record.name : 'Custom';
      document.getElementById('delete-unit-preset').disabled=!prefs.records.some(function(r){return r.id===prefs.active;});
      document.getElementById('save-unit-preset').disabled=prefs.records.length>=100;
      fields.querySelectorAll('select').forEach(function(select){select.value=prefs.units[select.dataset.preferredUnit];});
      document.querySelectorAll('[data-unit-label]').forEach(function(label){label.textContent=api.preferredUnit(label.dataset.unitLabel);});
      ['x','y','z'].forEach(function(axis){document.getElementById('support-u'+axis).setAttribute('aria-label','U'+axis+' displacement in '+prefs.units.displacementM);});
      ui.analysisAuthoring.syncLoadUnits();status.textContent=prefs.error;
    }
    // Validate every conversion before committing preferences or touching any field.
    function change(action,units){
      try {
        var converted=Array.from(document.querySelectorAll('input[data-unit-quantity]')).map(function(input){
          var quantity=input.dataset.unitQuantity, previous=api.preferredUnit(quantity), value=input.value;
          if(previous!==units[quantity]){
            if(input.validity.badInput)throw Error('Complete '+(labels[quantity]||quantity)+' before changing units.');
            if(value.trim()!=='')value=String(api.siToDisplay(quantity,api.displayToSI(quantity,Number(value),previous),units[quantity]));
          }
          return {input:input,value:value};
        });
        action();api.setPreferredUnits(prefs.units);
        ui.analysisAuthoring.loadUnits={pressurePa:prefs.units.pressurePa,forceN:prefs.units.forceN};
        controller.replaceViewportPresentation(Object.assign({},controller.document.viewportPresentation,{stressUnit:prefs.units.stressPa,lengthUnit:prefs.units.displacementM}));
        if(ui.viewport)ui.viewport.refreshSelectedResultPoint();
        // Presentation render can refresh editors. Restore converted unsaved entries afterwards.
        converted.forEach(function(entry){entry.input.value=entry.value;});refresh();
      }catch(e){refresh();status.textContent=e.message;ui.analysisAuthoring.loadStatus.textContent=e.message;}
    }
    function edit(patch){change(function(){prefs.edit(patch);},Object.assign({},prefs.units,patch));}
    selector.addEventListener('change',function(){var id=selector.value,record=api.BUILTIN_UNIT_SETS[id]||prefs.records.find(function(r){return r.id===id;});change(function(){prefs.select(id);},record ? record.units : prefs.units);});
    name.addEventListener('change',function(){var title=name.value;try{prefs.rename(title);refresh();}catch(e){status.textContent=e.message;}});
    name.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();name.blur();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();refresh();name.blur();}});
    document.getElementById('save-unit-preset').addEventListener('click',function(){try{prefs.copy();refresh();}catch(e){status.textContent=e.message;}});
    document.getElementById('delete-unit-preset').addEventListener('click',function(){prefs.remove();refresh();});
    ui.analysisAuthoring.onLoadUnitChange=function(quantity,symbol){edit({[quantity]:symbol});};
    [[ui.stressUnit,'stressPa'],[ui.lengthUnit,'displacementM']].forEach(function(entry){entry[0].addEventListener('change',function(e){e.stopImmediatePropagation();edit({[entry[1]]:this.value});},true);});
    change(function(){},prefs.units);
    ui.unitPreferences=prefs;
  }
  api.bindUnitSettings=bindUnitSettings;
}(globalThis));
