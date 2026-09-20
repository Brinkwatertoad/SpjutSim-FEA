(function(root){
 'use strict';
 var api=root.SpjutsimFEA;
 function download(source){if(!source)return;var bytes=source.originalSourceBytes||source.sourceBytes,url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));var a=document.createElement('a');a.href=url;a.download=source.sourceName;a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);}
 function StlImportUI(controller,viewport,handlers){
  this.controller=controller;this.viewport=viewport;this.handlers=handlers;this.panel=document.getElementById('stl-import-panel');this.unit=document.getElementById('stl-length-unit');this.list=document.getElementById('stl-issues');this.accept=document.getElementById('stl-accept-button');this.comparison=document.getElementById('stl-preview-surface');
  var self=this;
  this.unit.onchange=function(){handlers.change({lengthUnit:self.unit.value});};
  document.getElementById('stl-repair-hole-limit').onchange=function(){var value=this.value;if(value==='')return;handlers.change({maxHoleDiameterRatio:Number(value)/100});};
  document.getElementById('stl-retry-button').onclick=function(){handlers.change({});};
  document.getElementById('stl-cancel-button').onclick=handlers.cancel;
  document.getElementById('stl-choose-file').onclick=function(){document.getElementById('import-step-input').click();};
  this.accept.onclick=function(){var s=controller.stlImportSession;handlers.accept({acceptShapeChanges:s&&s.state==='needs-review'});};
  this.comparison.onchange=function(){if(self.display)self.display.showRevision(self.comparison.value);};
  document.getElementById('stl-show-all').onclick=function(){if(self.display)self.display.showIssues(self.display.issues.filter(function(issue){return issue.status==='unresolved';}));};
  document.getElementById('stl-download-original-button').onclick=function(){download(controller.stlImportSession&&controller.stlImportSession.source);};
  document.getElementById('stl-download-installed-original').onclick=function(){download(controller.geometrySource);};
  this.escape=function(event){if(event.key==='Escape'&&controller.stlImportSession){event.preventDefault();handlers.cancel();}};root.addEventListener('keydown',this.escape);
  controller.subscribe(function(){self.render();});
 }
 StlImportUI.prototype.render=function(){
  var s=this.controller.stlImportSession,state=this.controller.document;
  var model=document.getElementById('stl-model-settings'),surface=document.getElementById('mesh-stl-surface-settings');
  model.hidden=surface.hidden=!state.geometry||state.geometry.sourceFormat!=='stl';
  if(!model.hidden&&document.activeElement!==document.getElementById('stl-group-angle'))document.getElementById('stl-group-angle').value=state.geometry.stlSource.patchAngleDegrees;
  this.panel.hidden=!s;document.getElementById('setup-inspector').hidden=!!s;
  if(!s){this.close();return;}
  if(this.session!==s){this.close();this.session=s;this.display=new api.StlDiagnosticsDisplay(this.viewport);this.list.replaceChildren();this.previousResult=null;this.focusBefore=document.activeElement;document.getElementById('toggle-setup-pane').getAttribute('aria-expanded')==='false'&&document.getElementById('toggle-setup-pane').click();this.unit.focus();}
  this.unit.value=s.settings.lengthUnit;
  document.getElementById('stl-repair-hole-limit').value=s.settings.maxHoleDiameterRatio*100;
  document.getElementById('stl-source-summary').textContent=s.source.sourceName+' · '+(s.state==='reading'?'Reading file':s.state==='checking'?'Checking and repairing':s.state==='ready'?'Ready for analysis setup':s.state==='needs-review'?'Review proposed repair':'Repair incomplete');
  document.getElementById('stl-unit-assumption').textContent='Assumed '+this.unit.options[this.unit.selectedIndex].text.toLowerCase()+' — confirm the dimensions.';
  document.getElementById('stl-import-status').textContent=s.message;
  document.getElementById('stl-replacement-note').hidden=!state.geometry;
  this.unit.disabled=!s.source.sourceBytes;
  document.getElementById('stl-repair-hole-limit').disabled=!s.source.sourceBytes;
  document.getElementById('stl-download-original-button').disabled=!s.source.sourceBytes;
  document.getElementById('stl-show-all').hidden=!(s.result&&s.result.diagnostics.issues.some(function(issue){return issue.status==='unresolved';}));
  if(!s.preview)document.getElementById('stl-dimensions').textContent='';
  this.accept.disabled=!['ready','needs-review'].includes(s.state);this.accept.textContent=s.state==='needs-review'?'Use repaired model':'Use model';
  document.getElementById('stl-repair-consent').hidden=s.state!=='needs-review';
  var solid=s.result&&s.result.solidRepair;
  document.getElementById('stl-repair-consent').textContent=solid?'A rebuilt solid joins overlapping surfaces and may fill gaps or round small details. Compare Original and Prepared. Using this repaired model accepts these material changes.':'Using this repaired model approves the highlighted additions or removals. Compare with the original first.';
  document.getElementById('stl-retry-button').hidden=!(s.error&&s.error.code==='STL_PREPARATION_TIMEOUT');
  document.getElementById('stl-error-details').textContent=solid?'Reconstruction offset: '+solid.offset.toPrecision(3)+' '+s.settings.lengthUnit+'; detail scale: '+solid.alpha.toPrecision(3)+' '+s.settings.lengthUnit+'. Construction settings are not a maximum-error guarantee.':s.result&&s.result.error?s.result.error.code:s.error&&s.error.code||'';
  if(s.preview){
   var d=s.preview.bounds;document.getElementById('stl-dimensions').textContent=d.max.map(function(v,i){return(v-d.min[i]).toPrecision(5);}).join(' × ')+' '+s.settings.lengthUnit;
   if(this.sourcePreview!==s.preview){this.sourcePreview=s.preview;this.display.setPreview(s.preview);}
  }
  var result=s.result;if(result&&result.candidatePreview){var bounds=result.candidatePreview.bounds;document.getElementById('stl-dimensions').textContent='Original: '+document.getElementById('stl-dimensions').textContent+' · Prepared: '+bounds.max.map(function(v,i){return(v-bounds.min[i]).toPrecision(5);}).join(' × ')+' '+s.settings.lengthUnit;}document.getElementById('stl-comparison-label').hidden=!(result&&result.candidatePreview);
  if(result!==this.previousResult){this.previousResult=result;this.list.replaceChildren();
   if(result){
    var issues=result.changes.automatic.concat(result.changes.proposed,result.diagnostics.issues),self=this;
    var previews={source:s.preview,candidate:result.candidatePreview||s.preview};this.display.setDiagnostics(issues,previews);
    if(result.candidatePreview){this.comparison.value='candidate';this.display.showRevision('candidate');}
    [['fixed','Fixed automatically'],['proposed','Proposed changes'],['unresolved','Unrepaired regions']].forEach(function(group){
     var selected=issues.map(function(issue,index){return{issue:issue,index:index};}).filter(function(item){return item.issue.status===group[0];});if(!selected.length)return;
     var section=document.createElement(group[0]==='unresolved'||group[0]==='fixed'?'details':'section'),title=document.createElement(group[0]==='unresolved'||group[0]==='fixed'?'summary':'h3');title.textContent=group[1]+' ('+selected.length+')';section.appendChild(title);
     selected.forEach(function(item){var issue=item.issue,button=document.createElement('button');button.type='button';button.textContent=(issue.kind==='rebuilt-surface'?'Rebuilt solid':issue.kind==='intersection'?'Intersection region · '+issue.count+' triangle pairs':issue.kind==='component'?'Separate component · '+issue.triangleIds.length+' triangles':issue.kind.replaceAll('-',' ')+' · '+issue.count)+(issue.status==='proposed'?' · extent '+issue.bounds.max.map(function(v,i){return(v-issue.bounds.min[i]).toPrecision(3);}).join(' × ')+' '+s.settings.lengthUnit:'');button.setAttribute('aria-pressed','false');button.onclick=function(){self.list.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed','false');});button.setAttribute('aria-pressed','true');self.display.focusIssue(item.index);};section.appendChild(button);});self.list.appendChild(section);
    });
    var summary=document.createElement('p'),d=result.diagnostics,parts=[];
    if(d.componentCount>1)parts.push(d.componentCount+' separate components');
    if(d.counts.intersection)parts.push(d.intersectionRegionCount+' intersection regions ('+d.counts.intersection+' triangle pairs)');
    if(parts.length){summary.textContent=parts.join(' · ');this.list.prepend(summary);}
    if(s.state==='blocked'){var help=document.createElement('p');help.textContent='These locations explain why this surface cannot be used yet. They are not individual repair tasks. Export a watertight solid from the source model, or repair the highlighted regions in a mesh editor and import it again.';this.list.prepend(help);}
    var incomplete=result.diagnostics.locationsTruncated||result.changesTruncated||Object.values(result.diagnostics.coverage).some(function(value){return value==='skipped'||value==='limit';});
    if(incomplete){var note=document.createElement('p');note.textContent='Some checks or locations are incomplete. This view does not certify unchecked regions.';this.list.appendChild(note);}
    this.display.showIssues(issues.filter(function(issue){return issue.status!=='fixed';}));
   }else if(this.display){this.display.setDiagnostics([],{source:s.preview});this.display.showIssues([]);}
  }
 };
 StlImportUI.prototype.close=function(){if(this.display){this.display.dispose();this.display=null;}this.session=null;this.sourcePreview=null;if(this.focusBefore&&this.focusBefore.isConnected){this.focusBefore.focus();this.focusBefore=null;}};
 api.StlImportUI=StlImportUI;
 api.stlMeshingAdvice=function(count,mode){return count>=25000?'Detailed STL: start with Coarse and compare refinement. '+(mode==='original'?'Original triangles can retain a dense or low-quality surface. ':'')+'Meshing can take minutes; Cancel remains available.':'';};
}(globalThis));
