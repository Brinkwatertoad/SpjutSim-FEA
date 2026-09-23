(function(root){
  'use strict';
  var api=root.SpjutsimFEA;
  function bindProjectUI(app,options){
    options=options || {};
    var notice=document.getElementById('project-notice'),status=document.getElementById('project-status'),recoveryStatus=document.getElementById('recovery-status');
    var input=document.getElementById('project-file-input'),saveDialog=document.getElementById('save-project-dialog'),question=document.getElementById('project-question-dialog');
    var busy=true,opener=null,session;
    function message(text){status.textContent=text;notice.hidden=!text && !recoveryStatus.textContent;}
    var recovery=new api.ProjectRecovery(app,{onStatus:function(text){
      recoveryStatus.textContent=text;notice.hidden=!text && !status.textContent;
      document.getElementById('retry-recovery').hidden=!text;
      if(!text && app.geometrySource){session.remember({id:recovery.id});}
    }});
    session=new api.RecoverySession(recovery);
    function ask(text,choices){
      return new Promise(function(resolve){
        question.querySelector('p').textContent=text;var actions=question.querySelector('.fea-dialog-actions');actions.replaceChildren();question.returnValue='cancel';
        choices.forEach(function(choice){var button=document.createElement('button');button.type='button';button.textContent=choice[1];button.addEventListener('click',function(){question.close(choice[0]);});actions.appendChild(button);});
        question.addEventListener('close',function(){resolve(question.returnValue);},{once:true});question.showModal();
      });
    }
    var flow=new api.ProjectWorkflow(app,Object.assign({},options,{acceptSetupOnly:async function(text){return await ask(text+' Open the CAD and setup without cached results?',[['open','Open setup only'],['cancel','Cancel']])==='open';}}));
    function render(){
      document.querySelectorAll('[data-project-save]').forEach(function(button){button.disabled=busy || !app.geometrySource || Boolean(app.document.assignmentDraft);});
      document.querySelectorAll('[data-project-open],[data-project-new]').forEach(function(button){button.disabled=busy || api.engineeringBusy(app.document) || Boolean(app.document.assignmentDraft);});
      var saveButton=document.getElementById('save-project-button');
      saveButton.title='Save project ('+modifier+'S)'+(app.projectDirty?' · Unsaved changes':'');
    }
    async function save(includeDerived){
      busy=true;render();message('Preparing project…');
      try{
        var snapshot=await api.createProjectSnapshot(app,{includeDerived:includeDerived}),blob=await api.writeProjectFile(snapshot);
        var name=(snapshot.manifest.setup.metadata.name || snapshot.source.sourceName.replace(/\.[^.]+$/,'')).replace(/[^a-zA-Z0-9_-]+/g,'-')+'.spjutsim-fea';
        var url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
        app.markProjectSaved(snapshot.revision);message('Project download requested.');return true;
      }catch(error){message('Save failed: '+error.message);return false;}
      finally{busy=false;render();}
    }
    async function preserveCurrent(){
      if(app.document.assignmentDraft){message('Apply or Cancel the draft first.');return false;}
      if(!app.geometrySource){return true;}
      try{await recovery.checkpoint();return true;}
      catch(error){
        var answer=await ask(error.message,[['save','Save project'],['discard','Continue without recovery'],['cancel','Cancel']]);
        if(answer==='save'){return await save(false) && !app.projectDirty;}
        return answer==='discard';
      }
    }
    async function open(file,restored){
      if(busy || !await preserveCurrent()){return;}
      busy=true;recovery.stop();render();message('Opening and checking CAD face identity…');document.getElementById('cancel-project-open').hidden=false;
      try{
        var candidate=await flow.open(file,{recovered:restored});
        if(candidate){await session.fresh();recovery.start();await recovery.checkpoint();message('');}
        else{recovery.start();message('Open cancelled.');}
        return candidate;
      }catch(error){recovery.start();message('Open failed: '+error.message);}
      finally{busy=false;render();document.getElementById('cancel-project-open').hidden=true;}
    }
    async function newProject(){
      if(busy || !await preserveCurrent()){return;}
      busy=true;recovery.stop();render();
      try{
        flow.cancel();if(options.beforeInstall){options.beforeInstall();}
        await session.fresh();app.newProject();session.remember({empty:true});recovery.start();message('');
      }catch(error){message('Could not start a new project: '+error.message);}
      finally{busy=false;render();}
    }
    document.getElementById('cancel-project-open').addEventListener('click',function(){flow.cancel();});
    document.addEventListener('click',function(event){
      var target=event.target.closest('[data-project-open],[data-project-save],[data-project-new]');if(!target || target.disabled){return;}
      if(target.hasAttribute('data-project-new')){newProject();}
      else if(target.hasAttribute('data-project-open')){input.click();}
      else{opener=target;document.getElementById('project-include-cache').checked=false;document.getElementById('project-include-cache').disabled=!app.document.mesh;saveDialog.returnValue='';saveDialog.showModal();}
    });
    saveDialog.addEventListener('close',function(){if(opener){opener.focus();}if(saveDialog.returnValue==='save'){save(document.getElementById('project-include-cache').checked);}saveDialog.returnValue='';});
    input.addEventListener('change',function(){var file=input.files[0];input.value='';if(!file){return;}if(api.sourceFormatForFilename(file.name)){options.importCad(file);}else{open(file,false);}});
    var modifier=/Mac|iPhone|iPad/.test(root.navigator.platform)?'⌘':'Ctrl+';
    document.querySelectorAll('[data-project-shortcut]').forEach(function(label){label.textContent=modifier+label.dataset.projectShortcut.toUpperCase();});
    root.addEventListener('keydown',function(event){
      if(!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.isComposing || !['o','s'].includes(event.key.toLowerCase())){return;}
      event.preventDefault();if(busy || document.querySelector('dialog[open]') || app.document.assignmentDraft){return;}
      if(event.key.toLowerCase()==='o'){document.querySelector('[data-project-open]').click();}
      else{document.getElementById('save-project-button').click();}
    });
    async function showRecovery(){
      var dialog=document.getElementById('recovery-dialog');
      try{
        var records=await recovery.store.list(),list=document.getElementById('recovery-list');list.replaceChildren();
        if(!records.length){var empty=document.createElement('li');empty.textContent='No local recovery copies.';list.appendChild(empty);}
        records.forEach(function(record){
          var row=document.createElement('li'),label=document.createElement('span');label.textContent=(record.manifest && record.manifest.source && record.manifest.source.name || 'Unreadable project')+' · '+new Date(record.updated).toLocaleString();row.appendChild(label);
          var restore=document.createElement('button');restore.type='button';restore.textContent='Open copy';row.appendChild(restore);
          restore.addEventListener('click',async function(){dialog.close();try{await open(await recovery.store.read(record.id),true);}catch(error){message('Recovery failed: '+error.message);}});
          var discard=document.createElement('button');discard.type='button';discard.textContent='Discard';row.appendChild(discard);
          discard.addEventListener('click',async function(){
            try{await recovery.store.discard(record.id,record.owner,record.generation);if(record.id===recovery.id){recovery.stop();await session.fresh();session.remember({empty:true});}await showRecovery();}catch(error){message(error.message);}
          });list.appendChild(row);
        });
        if(!dialog.open){dialog.showModal();}
      }catch(error){message('Recovery unavailable: '+error.message);}
    }
    document.querySelector('[data-recovery-manage]').addEventListener('click',showRecovery);
    document.getElementById('clear-recovery').addEventListener('click',async function(){
      document.getElementById('recovery-dialog').close();
      if(await ask('Delete all local recovery copies, including those from other tabs? Downloaded project files are unaffected.',[['clear','Clear recovery'],['cancel','Cancel']])!=='clear'){return;}
      try{
        recovery.stop();if(recovery.inFlight){await recovery.inFlight;}var rows=await recovery.store.list();
        for(var row of rows){await recovery.store.discard(row.id,row.owner,row.generation);}
        await session.fresh();session.remember({empty:true});message('Local recovery cleared. Retry recovery to resume saving this project.');document.getElementById('retry-recovery').hidden=false;
      }catch(error){message('Recovery cleanup failed: '+error.message);}
    });
    document.getElementById('retry-recovery').addEventListener('click',function(){recovery.retry();});
    document.getElementById('dismiss-project-notice').addEventListener('click',function(){notice.hidden=true;});
    app.subscribe(render);
    var ready=(async function(){
      app.projectOpening=true;app.notify('project-status');
      try{
        var record=await session.previous();
        if(record){
          await session.adopt(record);message('Reopening previous part…');
          await flow.open(await recovery.store.read(record.id),{recovered:true});
          session.remember({id:record.id});
        }else{await session.fresh();}
        recovery.start();message('');
      }catch(error){
        await session.close();
        try{await session.fresh();}catch(lockError){session.locks=null;await session.fresh();}
        recovery.start();message('Could not reopen the previous part: '+error.message);
      }finally{busy=false;app.projectOpening=false;app.notify('project-status');render();}
    }());
    root.addEventListener('pagehide',function(){flow.cancel();recovery.stop();session.close();recovery.store.close();},{once:true});
    return {flow:flow,recovery:recovery,session:session,ready:ready,open:open,save:save,newProject:newProject};
  }
  api.bindProjectUI=bindProjectUI;
}(globalThis));
