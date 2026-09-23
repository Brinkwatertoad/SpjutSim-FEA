(function(root){
  'use strict';
  var api=root.SpjutsimFEA;
  var guideKey='spjutsim-fea.setup-guide-dismissed';
  function nextGuideStep(state){
    if(!state.geometry){return 0;}
    if(!state.material){return 1;}
    if(!state.boundaryConditions.some(function(item){return item.enabled!==false;})){return 2;}
    if(!state.loads.some(function(item){return item.enabled!==false;}) && !state.gravity.enabled && !api.hasPrescribedDisplacement(state)){return 3;}
    return state.results ? 5 : 4;
  }
  function applyCubeExample(app){
    var geometry=app.document.geometry;
    if(!geometry || geometry.sourceFormat!=='step'){throw Error('Import the example before applying its setup.');}
    var faceFor=function(axis,sign){return geometry.faceIds.find(function(id){var result=api.analyzeGeometryFaceNormal(geometry,id);return result.normal[axis]*sign>0.99;});};
    var negative=[0,1,2].map(function(axis){return faceFor(axis,-1);}),positive=faceFor(0,1);
    if(negative.some(function(id){return !id;}) || !positive){throw Error('Example face directions could not be identified.');}
    app.replaceMaterial({name:'Example steel',youngsModulusPa:200e9,poissonsRatio:0.3,densityKgM3:7800});
    negative.forEach(function(id,axis){var components={};components['xyz'[axis]]=0;app.replaceSelectedFaces([id]);app.createBoundaryCondition({name:'XYZ'[axis]+' plane',type:'support',componentsM:components});});
    app.replaceSelectedFaces([positive]);app.createLoad({name:'Axial load',type:'total-force',forceN:[1000,0,0]});
    app.replaceMeshSettings({preset:'normal',elementType:'tet10'});app.clearSelectedFaces();
    app.document.projectMetadata={name:'Cube example',reportOptions:null};app.notify('example-ready');
  }
  function bindContextualWorkflow(app,ui,importCadFile){
    var guide=document.getElementById('setup-guide'),step=0,shown=false,dismissed=false,highlighted=null,previous=app.document.geometry && app.document.geometry.geometryId;
    try{dismissed=root.localStorage.getItem(guideKey)==='true';}catch(error){}
    var steps=[
      {title:'Import a part',text:'Import one CAD solid, or open the prepared cube example.',target:'#empty-import'},
      {title:'Apply a material',text:'Choose a material or enter its properties, then Apply.',target:'[data-setup-kind="material"] [data-setup-row-trigger]'},
      {title:'Add supports',text:'Select faces and apply the constraints your part needs. Add more supports as needed, then choose Next.',target:'#setup-add-support-button'},
      {title:'Add loads',text:'Select faces, choose a load and Apply. Add further loads if needed, then choose Next.',target:'#setup-add-load-button'},
      {title:'Mesh and solve',text:'Use the default Tet10 mesh to begin. Mesh and solve runs checks before solving. The cube example should extend by 5 nm under 1 kPa axial stress.',target:'#solve-button'},
      {title:'Review the results',text:'Inspect displacement, stress and warnings. Check convergence before drawing conclusions, then save your project or export a report.',target:'#toggle-results-pane'}
    ];
    function position(){
      if(!shown){return;}
      var selector=steps[step].target;
      var form=step===1 ? document.getElementById('material-form') : step===2 ? document.getElementById('support-form') : step===3 ? document.getElementById('load-form') : null;
      if(form && form.getClientRects().length){selector='#'+form.id+' button[type=submit]';}
      var target=document.querySelector(selector),viewport=document.getElementById('viewport').getBoundingClientRect();
      if(!target || !target.getClientRects().length){guide.hidden=true;return;}
      guide.hidden=false;
      if(highlighted!==target){if(highlighted){highlighted.classList.remove('fea-guide-target');}highlighted=target;highlighted.classList.add('fea-guide-target');}
      var rect=target.getBoundingClientRect(),width=Math.min(270,Math.max(180,viewport.width-24));
      var left=Math.max(viewport.left+12,Math.min(rect.right+16,viewport.right-width-12));
      guide.style.width=width+'px';guide.style.left=left+'px';
      guide.style.top=Math.max(viewport.top+72,Math.min(rect.top,viewport.bottom-guide.offsetHeight-12))+'px';
      guide.dataset.arrow=rect.right<=viewport.left+12?'left':'up';
      guide.style.setProperty('--guide-arrow-left',Math.max(15,Math.min(width-20,rect.left+rect.width/2-left))+'px');
      guide.style.setProperty('--guide-arrow-top',Math.max(15,Math.min(guide.offsetHeight-15,rect.top+rect.height/2-parseFloat(guide.style.top)))+'px');
    }
    function render(){
      guide.hidden=!shown;if(!shown){if(highlighted){highlighted.classList.remove('fea-guide-target');highlighted=null;}return;}
      document.getElementById('setup-guide-title').textContent=steps[step].title;
      var text=steps[step].text;
      if(step===4 && (!app.document.projectMetadata || app.document.projectMetadata.name!=='Cube example')){text=text.split(' The cube example')[0];}
      document.getElementById('setup-guide-text').textContent=text;
      document.getElementById('setup-guide-back').disabled=step===0 || Boolean(app.document.assignmentDraft);
      document.getElementById('setup-guide-next').textContent=step===5?'Done':'Next';
      document.getElementById('setup-guide-next').disabled=Boolean(app.document.assignmentDraft) || (step<4 && nextGuideStep(app.document)<=step) || (step===4 && !app.document.results);
      position();
    }
    function dismiss(){shown=false;dismissed=true;try{root.localStorage.setItem(guideKey,'true');}catch(error){}render();}
    document.getElementById('setup-guide-dismiss').addEventListener('click',dismiss);
    function openStep(){
      var kind=step===1?'material':step===2?'support':step===3?'load':null;
      if(kind){
        var trigger=document.querySelector('[data-setup-kind="'+kind+'"] [data-setup-row-trigger]');
        if(trigger && trigger.getAttribute('aria-expanded')!=='true'){trigger.click();}
        if(trigger){trigger.scrollIntoView({block:'nearest'});}
      }
      render();
    }
    document.getElementById('setup-guide-back').addEventListener('click',function(){step=Math.max(0,step-1);openStep();});
    document.getElementById('setup-guide-next').addEventListener('click',function(){if(step===5){dismiss();return;}step++;openStep();});
    document.querySelector('[data-ui-menu-action="walkthrough"]').addEventListener('click',function(){
      dismissed=false;try{root.localStorage.setItem(guideKey,'false');}catch(error){}
      step=nextGuideStep(app.document);shown=true;
      if(document.getElementById('toggle-setup-pane').getAttribute('aria-expanded')==='false'){document.getElementById('toggle-setup-pane').click();}render();
    });
    document.getElementById('empty-import').addEventListener('click',function(){document.getElementById('import-step-input').click();});
    document.getElementById('load-example').addEventListener('click',function(){importCadFile(new File([api.EXAMPLE_CUBE_STEP],'example-cube.step'),{example:true});});
    document.getElementById('mesh-options-dialog').addEventListener('close',function(){var button=document.querySelector('[data-mesh-options]');if(button){button.focus();}});
    document.getElementById('report-options-button').appendChild(root.PortableUIIcons.createIcon('settings',{document:document,size:20}));
    document.getElementById('report-options-button').classList.add('fea-icon-button');
    var viewport=document.getElementById('viewport');
    viewport.addEventListener('dragover',function(event){event.preventDefault();});
    viewport.addEventListener('drop',function(event){event.preventDefault();if(event.dataTransfer.files.length===1 && !api.engineeringBusy(app.document) && !app.document.assignmentDraft){importCadFile(event.dataTransfer.files[0]);}});
    app.subscribe(function(state,change){
      if(change==='solve-progress' || change==='convergence-progress'){return;}
      document.getElementById('empty-workflow').hidden=Boolean(state.geometry) || app.projectOpening;
      var geometryId=state.geometry && state.geometry.geometryId;
      if(geometryId!==previous){
        previous=geometryId;
        shown=Boolean(state.geometry && !dismissed && change!=='project-open');step=nextGuideStep(state);
      }
      if(change==='project-open' || change==='project-new'){shown=false;}
      if(change==='example-ready' && !dismissed){shown=true;step=4;}
      var info=api.modelInformation(state),detail=document.getElementById('model-information');
      detail.textContent=info.dimensionsM ? 'Dimensions: '+info.dimensionsM.map(function(v){return api.formatResultMagnitude(v,api.preferredUnit('displacementM'));}).join(' × ')+' · CAD volume: '+(info.volumeM3===null?'Unavailable':api.formatResultMagnitude(info.volumeM3,api.preferredUnit('volumeM3')))+' · Mass: '+(info.massKg===null?'Supply density':api.formatResultMagnitude(info.massKg,api.preferredUnit('massKg'))) : '';
      render();
    });
    var frame=null;
    function schedulePosition(){if(frame===null){frame=root.requestAnimationFrame(function(){frame=null;position();});}}
    root.addEventListener('resize',schedulePosition);document.getElementById('setup-pane').addEventListener('scroll',schedulePosition);
    var observer=new ResizeObserver(schedulePosition);observer.observe(viewport);observer.observe(document.getElementById('setup-pane'));
    root.addEventListener('pagehide',function(){observer.disconnect();if(frame!==null){root.cancelAnimationFrame(frame);}root.removeEventListener('resize',schedulePosition);},{once:true});
  }
  api.nextGuideStep=nextGuideStep;api.applyCubeExample=applyCubeExample;api.bindContextualWorkflow=bindContextualWorkflow;
}(globalThis));
