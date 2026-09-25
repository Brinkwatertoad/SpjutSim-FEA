(function(root){
  'use strict';
  var api=root.SpjutsimFEA;
  var guideKey='spjutsim-fea.setup-guide-dismissed';
  function nextGuideStep(state){
    if(!state.geometry){return 0;}
    if(!state.material){return 1;}
    if(!state.boundaryConditions.some(function(item){return item.enabled!==false;})){return 2;}
    if(!state.loads.some(function(item){return item.enabled!==false;}) && !state.gravity.enabled && !api.hasPrescribedDisplacement(state)){return 3;}
    return state.results ? 7 : state.mesh ? 5 : 4;
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
    var highlight=document.createElement('div');
    highlight.id='setup-guide-highlight';highlight.className='fea-guide-highlight';highlight.hidden=true;
    highlight.setAttribute('aria-hidden','true');document.body.appendChild(highlight);
    try{dismissed=root.localStorage.getItem(guideKey)==='true';}catch(error){}
    var steps=[
      {title:'Import a part',text:'Open Model to import a CAD solid. Dismiss this guide to use the opening panel or prepared cube example.',target:'[data-setup-kind="model"] [data-setup-row-trigger]'},
      {title:'Apply a material',text:'Open Material to choose a material or enter its properties.',target:'[data-setup-kind="material"] [data-setup-row-trigger]'},
      {title:'Add supports',text:'Choose Add to create a support. Add as many supports as your part needs, then choose Next.',target:'#setup-add-support-button'},
      {title:'Add loads',text:'Choose Add to create a load. Add further loads if needed, then choose Next.',target:'#setup-add-load-button'},
      {title:'Generate mesh',text:'Open Mesh, choose a density and Generate mesh. Start with the default density; complicated parts may need finer settings.',target:'[data-setup-kind="mesh"] [data-setup-row-trigger]'},
      {title:'Inspect the mesh',text:'Choose Mesh view, then rotate and zoom to inspect holes, small features and loaded areas. Refine the density and regenerate if needed. Visual inspection is a first check; convergence is needed to assess accuracy.',target:'[data-view-mode="mesh"]'},
      {title:'Solve',text:'Choose Solve to run checks and calculate results. Resolve any reported setup problems before continuing.',target:'#solve-button'},
      {title:'Review the results',text:'Inspect displacement, stress and warnings. Check convergence before drawing conclusions, then save your project or export a report beside Results.',target:'#toggle-results-pane'}
    ];
    function needsFaces(){
      var draft=app.document.assignmentDraft;
      return Boolean(draft && ((step===2 && draft.kind==='support') || (step===3 && draft.kind==='load')) && draft.faceIds.length===0);
    }
    function clearHighlight(){
      highlight.hidden=true;
      if(highlighted){highlighted.classList.remove('fea-guide-target');highlighted=null;}
    }
    function guideTarget(){
      var form=step===1 ? document.getElementById('material-form') : step===2 ? document.getElementById('support-form') : step===3 ? document.getElementById(app.document.assignmentDraft && app.document.assignmentDraft.kind==='gravity' ? 'gravity-form' : 'load-form') : null;
      if(form && form.getClientRects().length){return needsFaces() ? document.getElementById('viewport') : form.querySelector('select, input');}
      var generate=document.getElementById('generate-mesh-button');
      if(step===4 && generate.getClientRects().length){return generate;}
      return document.querySelector(steps[step].target);
    }
    function position(){
      if(!shown){clearHighlight();return;}
      var target=guideTarget(),viewport=document.getElementById('viewport').getBoundingClientRect();
      if(!target || !target.getClientRects().length){guide.hidden=true;clearHighlight();return;}
      var rect=target.getBoundingClientRect(),pane=target.closest('#setup-pane');
      if(pane){
        var paneBounds=pane.getBoundingClientRect();
        if(rect.top<paneBounds.top || rect.bottom>paneBounds.bottom){guide.hidden=true;clearHighlight();return;}
      }
      guide.hidden=false;
      if(highlighted!==target){clearHighlight();highlighted=target;highlighted.classList.add('fea-guide-target');}
      var picking=target.id==='viewport',width=Math.min(270,Math.max(180,viewport.width-24));
      // Render the ring at document level so all four sides survive clipped controls.
      highlight.hidden=picking;
      if(!picking){
        highlight.style.left=(rect.left-4)+'px';highlight.style.top=(rect.top-4)+'px';
        highlight.style.width=(rect.width+8)+'px';highlight.style.height=(rect.height+8)+'px';
      }
      var beside=Boolean(pane);
      var left=Math.max(viewport.left+12,Math.min(beside || picking ? viewport.left+12 : rect.left+rect.width/2-width/2,viewport.right-width-12));
      guide.style.width=width+'px';guide.style.left=left+'px';
      guide.style.top=Math.max(viewport.top+12,Math.min(picking ? viewport.top+(viewport.height-guide.offsetHeight)/2 : beside ? rect.top : rect.bottom+16,viewport.bottom-guide.offsetHeight-12))+'px';
      guide.dataset.arrow=picking?'right':beside?'left':'up';
      guide.style.setProperty('--guide-arrow-left',Math.max(15,Math.min(width-20,rect.left+rect.width/2-left))+'px');
      guide.style.setProperty('--guide-arrow-top',Math.max(15,Math.min(guide.offsetHeight-15,rect.top+rect.height/2-parseFloat(guide.style.top)))+'px');
    }
    function render(){
      document.getElementById('empty-workflow').hidden=Boolean(app.document.geometry) || app.projectOpening || shown;
      guide.hidden=!shown;if(!shown){clearHighlight();return;}
      document.getElementById('setup-guide-title').textContent=needsFaces() ? 'Select '+(step===2?'support':'load')+' faces' : steps[step].title;
      var target=guideTarget(),text=steps[step].text;
      if(needsFaces()){text='Click faces on the model to select them. Click a selected face again to deselect it.';}
      if(target && target.closest('form'))text='Changes are saved automatically. Enter a value and press Enter or leave the field. Use Undo to reverse an edit.';
      if(step===4 && target && target.id==='generate-mesh-button'){text='Choose a mesh density, then click Generate mesh. Complicated parts may need finer settings. When generation finishes, choose Next to inspect it.';}
      if(step===7 && app.document.projectMetadata && app.document.projectMetadata.name==='Cube example'){text+=' The cube should extend by 5 nm under 1 kPa axial stress.';}
      document.getElementById('setup-guide-text').textContent=text;
      document.getElementById('setup-guide-back').disabled=step===0 || api.hasPendingAssignment(app.document);
      document.getElementById('setup-guide-next').textContent=step===7?'Done':'Next';
      document.getElementById('setup-guide-next').disabled=api.hasPendingAssignment(app.document) || (step<4 && nextGuideStep(app.document)<=step) || ((step===4 || step===5) && !app.document.mesh) || (step===5 && app.document.viewportPresentation.mode!=='mesh') || (step===6 && !app.document.results);
      position();
    }
    function dismiss(){shown=false;dismissed=true;try{root.localStorage.setItem(guideKey,'true');}catch(error){}render();}
    document.getElementById('setup-guide-dismiss').addEventListener('click',dismiss);
    function openStep(){
      // User-driven stage changes may reveal the next target. Never open an editor on the user's behalf.
      var target=guideTarget(),pane=document.getElementById('setup-pane');
      if(target && target.closest('#setup-pane')){
        var bounds=target.getBoundingClientRect(),paneBounds=pane.getBoundingClientRect();
        if(bounds.top<paneBounds.top || bounds.bottom>paneBounds.bottom){pane.scrollTop+=bounds.top-paneBounds.top-12;}
      }
      render();
    }
    // Editor open/close can finish after controller notifications. Refresh after the user action,
    // without scrolling or targeting a detached control.
    document.getElementById('setup-pane').addEventListener('click',render);
    document.getElementById('setup-pane').addEventListener('submit',render);
    document.getElementById('setup-pane').addEventListener('fea-material-applied',function(){
      if(shown && step===1){step=2;openStep();}
    });
    document.addEventListener('keydown',function(event){if(event.key==='Escape'){render();}});
    document.getElementById('setup-guide-back').addEventListener('click',function(){step=Math.max(0,step-1);openStep();});
    document.getElementById('setup-guide-next').addEventListener('click',function(){if(step===7){dismiss();return;}step++;openStep();});
    document.querySelector('[data-ui-menu-action="walkthrough"]').addEventListener('click',function(){
      dismissed=false;try{root.localStorage.setItem(guideKey,'false');}catch(error){}
      step=nextGuideStep(app.document);shown=true;
      if(document.getElementById('toggle-setup-pane').getAttribute('aria-expanded')==='false'){document.getElementById('toggle-setup-pane').click();}openStep();
    });
    document.getElementById('empty-import').addEventListener('click',function(){document.getElementById('import-step-input').click();});
    document.getElementById('load-example').addEventListener('click',function(){importCadFile(new File([api.EXAMPLE_CUBE_STEP],'example-cube.step'),{example:true});});
    document.getElementById('mesh-options-dialog').addEventListener('close',function(){var button=document.querySelector('[data-mesh-options]');if(button){button.focus();}});
    document.getElementById('report-options-button').appendChild(root.PortableUIIcons.createIcon('settings',{document:document,size:20}));
    document.getElementById('report-options-button').classList.add('fea-icon-button');
    var viewport=document.getElementById('viewport');
    viewport.addEventListener('dragover',function(event){event.preventDefault();});
    viewport.addEventListener('drop',function(event){event.preventDefault();if(event.dataTransfer.files.length===1 && !api.engineeringBusy(app.document) && !api.hasPendingAssignment(app.document)){importCadFile(event.dataTransfer.files[0]);}});
    app.subscribe(function(state,change){
      if(change==='solve-progress' || change==='convergence-progress'){return;}
      var geometryId=state.geometry && state.geometry.geometryId;
      if(geometryId!==previous){
        previous=geometryId;
        shown=Boolean(state.geometry && !dismissed && change!=='project-open');step=nextGuideStep(state);
      }
      if(change==='project-open' || change==='project-new'){shown=false;}
      if(change==='example-ready' && !dismissed){shown=true;step=4;openStep();}
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
