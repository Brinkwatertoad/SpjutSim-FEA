(function(root){
  'use strict';
  var api=root.SpjutsimFEA, identity=[[1,0,0],[0,1,0],[0,0,1]];
  function LocalFrameEditor(container,prefix){
    this.container=container;this.prefix=prefix;this.savedFrame=null;this.axes=identity.map(function(v){return v.slice();});
    container.innerHTML='<label for="'+prefix+'-frame-kind">Coordinate frame</label><select id="'+prefix+'-frame-kind"><option value="global">Global XYZ</option><option value="manual">Rectangular (stays global)</option><option value="cad">Planar face (follows CAD)</option></select>'+
      '<fieldset id="'+prefix+'-frame-fields" hidden><legend>Rotate frame</legend>'+
      '<svg id="'+prefix+'-frame-triad" class="fea-frame-triad" viewBox="0 0 180 130" role="img" aria-label="Local frame axes in global coordinates"></svg>'+
      '<label for="'+prefix+'-frame-rotation-axis">Global axis</label><select data-frame-control id="'+prefix+'-frame-rotation-axis"><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select>'+
      '<label for="'+prefix+'-frame-angle">Angle (°)</label><input data-frame-control id="'+prefix+'-frame-angle" type="number" step="any" value="15">'+
      '<div class="fea-frame-actions">'+[['minus','− angle'],['plus','+ angle'],['minus-90','−90°'],['plus-90','+90°'],['reset','Reset']].map(function(item){return '<button type="button" id="'+prefix+'-frame-'+item[0]+'">'+item[1]+'</button>';}).join('')+'</div>'+
      '<details><summary>Frame origin</summary>'+['x','y','z'].map(function(axis){return '<label for="'+prefix+'-frame-origin-'+axis+'">'+axis.toUpperCase()+' (<span data-unit-label="lengthM">'+api.preferredUnit('lengthM')+'</span>)</label><input id="'+prefix+'-frame-origin-'+axis+'" data-unit-quantity="lengthM" type="number" step="any" value="0">';}).join('')+'</details></fieldset>'+
      '<details class="fea-info"><summary aria-label="Coordinate frame information" title="Coordinate frame information">ⓘ</summary><small id="'+prefix+'-frame-preview"></small></details><small id="'+prefix+'-frame-error" class="fea-error" role="status"></small>';
    var self=this;this.kind=this.get('kind');
    this.kind.addEventListener('change',function(){self.savedFrame=null;self.refresh();});
    ['minus','plus','minus-90','plus-90','reset'].forEach(function(action){self.get(action).addEventListener('click',function(){
      try{
        if(action==='reset')self.axes=identity.map(function(v){return v.slice();});
        else{
          var text=self.get('angle').value, angle=action.includes('90')?90:(text.trim()?Number(text):NaN);
          if(!Number.isFinite(angle))throw Error('Enter a finite rotation angle.');
          var matrix=api.axisRotationMatrix(self.get('rotation-axis').value,(action.indexOf('minus')===0?-1:1)*angle);
          self.axes=self.axes.map(function(axis){return api.transformVector3(matrix,axis);});
        }
        self.get('error').textContent='';self.refresh();
        self.container.dispatchEvent(new Event('change',{bubbles:true}));
      }catch(error){self.get('error').textContent=error.message;}
    });});
  }
  LocalFrameEditor.prototype.get=function(suffix){return document.getElementById(this.prefix+'-frame-'+suffix);};
  LocalFrameEditor.prototype.refresh=function(){
    this.get('fields').hidden=this.kind.value!=='manual';
    var svg=this.get('triad'), ns='http://www.w3.org/2000/svg';svg.replaceChildren();
    function project(v){return [90+48*(v[0]-.65*v[1]),70+48*(.35*v[0]+.35*v[1]-v[2])];}
    function draw(axes,global){axes.forEach(function(v,i){var end=project(v),line=document.createElementNS(ns,'line'),label=document.createElementNS(ns,'text');
      line.setAttribute('x1',90);line.setAttribute('y1',70);line.setAttribute('x2',end[0]);line.setAttribute('y2',end[1]);line.setAttribute('stroke',global?'currentColor':['#df6363','#5da66b','#609de0'][i]);line.setAttribute('stroke-width',global?1:3);if(global)line.setAttribute('stroke-dasharray','3 3');
      label.setAttribute('x',end[0]+4);label.setAttribute('y',end[1]-4);label.setAttribute('fill','currentColor');label.textContent=(global?'':'Local ')+'XYZ'[i];svg.append(line,label);
    });}
    draw(identity,true);draw(this.axes,false);
  };
  LocalFrameEditor.prototype.set=function(frame){
    this.savedFrame=frame||null;this.kind.value=frame?(frame.ownership==='cad'?'cad':'manual'):'global';
    this.axes=(frame?frame.axes:identity).map(function(v){return v.slice();});
    var origin=frame?frame.originM:[0,0,0],self=this;
    ['x','y','z'].forEach(function(axis,i){self.get('origin-'+axis).value=api.preferredFromSI('lengthM',origin[i]);});this.refresh();
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
    }),axes:this.axes.map(function(v){return v.slice();})});
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
