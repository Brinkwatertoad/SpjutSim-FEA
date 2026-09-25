(function(root){
  'use strict';
  var api=root.SpjutsimFEA;
  var fields=[
    ['youngsModulusPa',"Young’s modulus",'youngsModulusPa',true],
    ['poissonsRatio',"Poisson’s ratio",null,true],
    ['densityKgM3','Density','densityKgM3'],
    ['tensileYieldPa','Tensile yield','strengthPa'],['compressiveYieldPa','Compressive yield','strengthPa'],
    ['ultimateTensilePa','Ultimate tensile','strengthPa'],['ultimateCompressivePa','Ultimate compressive','strengthPa']
  ];
  function bindMaterialLibrary(author){
    var catalog=author.materialCatalog, message=document.getElementById('engineering-library-message'), library;
    function status(text,type){message.textContent=text||'';message.dataset.type=type||'';}
    function use(entry){
      author.renderMaterialCatalogOptions();author.materialCatalogSelect.value=entry.id;
      author.selectMaterialCatalogEntry();
    }
    function renderEditor(options){
      status('');
      var record=options.record || (options.launchContext && options.launchContext.material ? {material:options.launchContext.material,metadata:{source:'User'}} : null);
      var metadata=record && record.metadata || {}, readonly=options.mode==='edit' && record.layer==='factory';
      var form=document.createElement('form');form.dataset.engineeringRecordEditor='material';form.noValidate=true;
      var heading=document.createElement('h3');heading.textContent=(readonly?'View':options.mode==='edit'?'Edit':options.mode==='copy'?'Copy & Modify':'Add')+' material';form.append(heading);
      var initialValues={};
      var grid=document.createElement('div');grid.className='engineering-record-editor-fields';form.append(grid);
      function field(name,label,value,numeric,required,multiline){
        var wrapper=document.createElement('label'),caption=document.createElement('span'),input=document.createElement(multiline?'textarea':'input');
        wrapper.className='engineering-record-field'+(multiline?' engineering-record-field-wide':'');caption.textContent=label+(required?' *':'');
        input.name=name;input.value=value==null?'':value;input.readOnly=readonly;initialValues[name]=input.value;
        if(!multiline)input.type=numeric?'number':'text';if(numeric)input.step='any';input.required=Boolean(required);
        wrapper.append(caption,input);grid.append(wrapper);
      }
      field('name','Name',record ? record.material.name+(options.mode==='copy'?' copy':''):'',false,true);
      field('family','Family',metadata.family);field('standard','Standard',metadata.standard);
      fields.forEach(function(item){var value=record && record.material[item[0]];field(item[0],item[1]+(item[2]?' ('+api.preferredUnit(item[2])+')':''),value==null?'':item[2]?api.preferredFromSI(item[2],value):value,true,item[3]);});
      field('source','Source',metadata.source || (record && record.layer==='factory'?'See property sources below':'User'));
      field('sourceUrl','Source URL',metadata.sourceUrl);
      field('notes','Notes',metadata.notes,false,false,true);
      if(metadata.warning)field('warning','Model limitations',metadata.warning,false,false,true);
      var sources=document.createElement('div');sources.className='fea-material-details';
      Object.keys(metadata.fieldProvenance || {}).forEach(function(key){
        var source=metadata.fieldProvenance[key],row=document.createElement('p'),label=fields.find(function(item){return item[0]===key;});
        row.append((label?label[1]:key)+': ');
        var link;try{var url=new URL(source.url);if(['https:','http:'].includes(url.protocol)){link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noreferrer';}}catch(error){/* Invalid stored links remain plain text. */}
        if(link){link.textContent=source.label;row.append(link);}else row.append(source.label);sources.append(row);
      });form.append(sources);
      var error=document.createElement('p');error.className='engineering-record-editor-error';error.setAttribute('role','alert');form.append(error);
      var actions=document.createElement('div');actions.className='engineering-record-editor-actions';form.append(actions);
      function save(assign){
        try{
          var material={name:form.elements.name.value.trim()}, meta=Object.assign({},metadata);
          fields.forEach(function(item){var value=form.elements[item[0]].value.trim();if(!value){if(item[3])throw Error('Enter '+item[1]+'.');return;}material[item[0]]=record && initialValues[item[0]]!=='' && Number(value)===Number(initialValues[item[0]]) ? record.material[item[0]] : item[2]?api.preferredToSI(item[2],Number(value)):Number(value);});
          ['family','standard','source','sourceUrl','notes','warning'].forEach(function(key){if(form.elements[key])meta[key]=form.elements[key].value;});
          // A copied property retains its citation. Changed values must no longer
          // claim that the original reference supplies that value.
          meta.fieldProvenance=Object.assign({},metadata.fieldProvenance);
          if(record)fields.forEach(function(item){if(material[item[0]]!==record.material[item[0]])delete meta.fieldProvenance[item[0]];});
          var result=options.mode==='edit'?catalog.replaceUser(record.id,material,meta):catalog.saveUser(material,meta);
          author.renderMaterialCatalogOptions();options.refresh();options.close();
          status(result.storageWarning || 'Material saved.',result.storageWarning?'error':'success');
          if(assign){use(result.entry);library.closeLibrary();}
        }catch(e){error.textContent=e.message;}
      }
      if(!readonly){[['Save',false],['Save & Use',true]].forEach(function(action){var button=document.createElement('button');button.type='button';button.textContent=action[0];if(!action[1])button.dataset.engineeringRecordSave='';button.addEventListener('click',function(){save(action[1]);});actions.append(button);});}
      var close=document.createElement('button');close.type='button';close.textContent=readonly?'Close':'Cancel';close.addEventListener('click',options.close);actions.append(close);
      form.addEventListener('submit',function(event){event.preventDefault();if(!readonly)save(false);});
      options.host.replaceChildren(form);
    }
    library=root.TrussEngineeringLibraryUI.createEngineeringLibraryUI({
      document:document,getRecords:function(){return catalog.list();},getCsvGuide:function(){return {};},
      getAdapter:function(){return {label:'Material',getId:function(e){return e.id;},getLabel:function(e){return e.material.name;},getGroup:function(e){return e.metadata.family||e.layer;},getSearchTokens:function(e){return [e.metadata.family,e.metadata.standard,e.metadata.source,e.metadata.notes];},
        canEdit:function(){return true;},canDelete:function(e){return e.layer==='user';},renderEditor:renderEditor,
        columns:[{label:'Name',render:function(e){return e.material.name;}},{label:'Family',render:function(e){return e.metadata.family||'—';}},{label:'E ('+api.preferredUnit('youngsModulusPa')+')',render:function(e){return api.preferredFromSI('youngsModulusPa',e.material.youngsModulusPa);}},{label:'ν',render:function(e){return e.material.poissonsRatio;}},{label:'Library',render:function(e){return e.layer==='factory'?'Built-in':'User';}}]
      };},onUse:function(payload){use(payload.record);},onCopy:function(payload){return {record:payload.record};},
      onDelete:function(payload){try{var result=catalog.removeUser(payload.id);author.renderMaterialCatalogOptions();status(result.storageWarning||'Material removed from library. Project properties are unchanged.');}catch(e){status(e.message,'error');}},onStatus:status
    });
    document.getElementById('open-material-library').addEventListener('click',function(){library.openLibrary({kind:'material',selectedId:author.materialCatalogSelect.value});});
    author.materialLibrary=library;
    return library;
  }
  api.bindMaterialLibrary=bindMaterialLibrary;
}(globalThis));
