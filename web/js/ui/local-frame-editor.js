(function(root){
  'use strict';
  var api=root.SpjutsimFEA;
  /** Editor-local frame choice. CAD frames store canonical coordinates, so undo
   * and reopen resolve them against the document orientation without rewriting. */
  function LocalFrameEditor(container,prefix){
    this.container=container;this.prefix=prefix;this.savedFrame=null;
    container.innerHTML='<label for="'+prefix+'-frame-kind">Coordinate frame</label><select id="'+prefix+'-frame-kind"><option value="global">Global XYZ</option><option value="manual">Rectangular (stays global)</option><option value="cad">Planar face (follows CAD)</option></select>'+
      '<fieldset id="'+prefix+'-frame-fields" hidden><legend>Rectangular frame</legend><small>Enter three orthonormal, right handed unit axes as comma-separated XYZ components. Origin does not change a direction.</small>'+
      ['x','y','z'].map(function(axis,i){return '<label for="'+prefix+'-frame-axis-'+axis+'">Local '+axis.toUpperCase()+' axis in global XYZ</label><input id="'+prefix+'-frame-axis-'+axis+'" type="text" value="'+[0,1,2].map(function(j){return i===j?1:0;}).join(', ')+'">';}).join('')+
      ['x','y','z'].map(function(axis){return '<label for="'+prefix+'-frame-origin-'+axis+'">Origin '+axis.toUpperCase()+' (<span data-unit-label="lengthM">m</span>)</label><input id="'+prefix+'-frame-origin-'+axis+'" data-unit-quantity="lengthM" type="number" step="any" value="0">';}).join('')+'</fieldset><small id="'+prefix+'-frame-preview" role="status"></small>';
    var self=this;this.kind=this.get('kind');this.kind.addEventListener('change',function(){self.savedFrame=null;self.refresh();});
  }
  LocalFrameEditor.prototype.get=function(suffix){return document.getElementById(this.prefix+'-frame-'+suffix);};
  LocalFrameEditor.prototype.refresh=function(){this.get('fields').hidden=this.kind.value!=='manual';};
  LocalFrameEditor.prototype.set=function(frame){
    this.savedFrame=frame||null;this.kind.value=frame?(frame.ownership==='cad'?'cad':'manual'):'global';
    var axes=frame?frame.axes:[[1,0,0],[0,1,0],[0,0,1]],origin=frame?frame.originM:[0,0,0],self=this;
    ['x','y','z'].forEach(function(axis,i){self.get('axis-'+axis).value=axes[i].join(', ');self.get('origin-'+axis).value=api.preferredFromSI('lengthM',origin[i]);});this.refresh();
  };
  LocalFrameEditor.prototype.read=function(geometry,faceIds,planar){
    if(planar || this.kind.value==='cad'){
      if(this.savedFrame && this.savedFrame.ownership==='cad' && faceIds.includes(this.savedFrame.faceId))return api.validateLocalFrame(this.savedFrame,geometry.faceIds);
      if(faceIds.length!==1)throw Error('Select exactly one planar face to define the CAD frame.');
      return api.planarFaceFrame(geometry,faceIds[0]);
    }
    if(this.kind.value==='global')return undefined;
    var self=this;
    return api.validateLocalFrame({version:1,ownership:'global',originM:['x','y','z'].map(function(axis){
      var value=self.get('origin-'+axis).value;if(!value.trim())throw Error('Enter the frame origin.');return api.preferredToSI('lengthM',value);
    }),axes:['x','y','z'].map(function(axis){return self.get('axis-'+axis).value.split(',').map(function(value){return value.trim()?Number(value):NaN;});})});
  };
  LocalFrameEditor.prototype.preview=function(item,geometry){
    this.refresh();var text='';
    try{
      if(item && item.frame){var frame=api.resolveLocalFrame(item.frame,geometry);
        function vector(v){return '['+v.map(function(x){return Number(x.toPrecision(5));}).join(', ')+']';}
        text=(item.frame.ownership==='cad'?'Follows CAD. ':'Stays global. ');
        if(item.forceN)text+='Global force '+vector(api.localToGlobal(frame,item.forceN).map(function(v){return api.preferredFromSI('forceN',v);}))+' '+api.preferredUnit('forceN');
        else text+='Global directions: '+Object.keys(item.componentsM||{}).map(function(axis){return axis.toUpperCase()+' '+vector(frame.axes[['x','y','z'].indexOf(axis)]);}).join('; ');
      }
    }catch(error){text=error.message;}
    this.get('preview').textContent=text;
  };
  api.LocalFrameEditor=LocalFrameEditor;
}(globalThis));
