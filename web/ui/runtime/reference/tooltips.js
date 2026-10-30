/** Canonical immediate compact/expanded help. Hosts own metadata, preferences and styling. */
(function(scope){
 'use strict';
 function createTooltipController(input={}){
  const doc=input.document??scope.document,viewport=input.viewport??scope,container=input.container??doc.body;
  const getHelpEnabled=input.getHelpEnabled??(()=>false),cleanups=new Set(),entries=new WeakMap();let destroyed=false,activeCompact=null,activeHelp=null,lastPosition=null,pointerDown=false,lastMode=null,lastCompactText=null,lastHelpSignature=null;
  const make=(element,className,kind)=>{const node=element??doc.createElement('div');if(!element){node.className=className;node.dataset.tooltipSurface=kind;container.append(node);}node.setAttribute('role','tooltip');return node;};
  const compact=make(input.compactElement,input.compactClassName??'ui-tooltip','compact'),expanded=make(input.expandedElement,input.expandedClassName??'ui-tooltip ui-tooltip-expanded','expanded');
  compact.dataset.toolTooltip='1';expanded.dataset.helpTooltip='1';
  const visible=(node,value)=>{node.hidden=!value;if(input.visibility==='display')node.style.display=value?'block':'none';};
  visible(compact,false);visible(expanded,false);
  const surfaces=new Map([...new Set([compact,expanded])].map(element=>[element,scope.PortableUITransientSurfaces.createSurface({element,container,viewport,...input.surfaceOptions})]));
  const collectedBindings=new FinalizationRegistry(cleanup=>cleanups.delete(cleanup));
  // Targets own their handlers; controller teardown must not retain either one.
  const cleanupBinding=(nodeRef,handlerRef,type,options)=>()=>nodeRef.deref()?.removeEventListener(type,handlerRef.deref(),options);
  const on=(node,type,fn,options)=>{node.addEventListener(type,fn,options);const cleanup=cleanupBinding(new WeakRef(node),new WeakRef(fn),type,options);cleanups.add(cleanup);collectedBindings.register(node,cleanup,cleanup);};
  const hideCompact=target=>{if(target&&activeCompact!==target)return;activeCompact=null;visible(compact,false);};
  const hideHelp=target=>{if(target&&activeHelp!==target)return;activeHelp=null;visible(expanded,false);};
  const hideAll=()=>{hideCompact();hideHelp();};
  const mount=(node,target,x,y,remeasure=false)=>{surfaces.get(node).mount(target);visible(node,true);surfaces.get(node).position(x,y,remeasure);};
  const allowed=target=>!destroyed&&(!input.shouldShow||input.shouldShow(target));
  const showCompact=(target,text,x,y)=>{if(!text||!allowed(target))return;const changed=lastCompactText!==String(text)||(compact===expanded&&lastMode!=='compact'),opening=compact.hidden;hideHelp();activeCompact=target;lastPosition={x,y};if(changed){if(input.renderCompact)input.renderCompact(compact,String(text));else compact.textContent=String(text);}lastCompactText=String(text);lastMode='compact';mount(compact,target,x,y,changed||opening);};
  const showHelp=(target,entry,x,y)=>{if(!allowed(target))return;const signature=JSON.stringify([entry?.title,entry?.summary,entry?.definition]),changed=lastHelpSignature!==signature||(compact===expanded&&lastMode!=='help'),opening=expanded.hidden;hideCompact();activeHelp=target;lastPosition={x,y};if(changed){expanded.replaceChildren();if(input.renderHelp)input.renderHelp(expanded,entry);else{
   const title=String(entry?.title??'').trim(),body=[entry?.summary,entry?.definition].map(v=>String(v??'').trim()).filter(Boolean).join(' ');
   if(title){const strong=doc.createElement('strong');strong.textContent=title;expanded.append(strong);}if(body){const detail=doc.createElement('div');detail.textContent=body;if(title)detail.style.marginTop='4px';expanded.append(detail);}
  }}lastHelpSignature=signature;lastMode='help';mount(expanded,target,x,y,changed||opening);};
  const anchor=target=>{const r=target.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top};};
  const helpEntry=target=>({title:target.dataset.helpTitle,summary:target.dataset.helpSummary,definition:target.dataset.helpDefinition});
  function attachTooltip(target,text){
   if(!target?.addEventListener)return;target.dataset.tooltip=String(text??'').trim();let entry=entries.get(target);if(entry?.compact)return;entry=entry??{};entry.compact=true;target.dataset.tooltipBound='1';entries.set(target,entry);let pointer=null;
   const show=p=>{if(getHelpEnabled()&&(target.dataset.helpTitle||target.dataset[input.helpTitleAttribute??'helpTitle']))return;showCompact(target,target.dataset.tooltip,p.x,p.y);};
   on(target,'mouseenter',e=>{pointer={x:e.clientX,y:e.clientY};show(pointer);});on(target,'mousemove',e=>{pointer={x:e.clientX,y:e.clientY};if(activeCompact===target)show(pointer);});on(target,'mouseleave',()=>{pointer=null;hideCompact(target);});on(target,'focus',()=>show(pointer??anchor(target)));on(target,'blur',()=>hideCompact(target));
  }
  function applyCustomTooltip(target,text){if(!target)return;target.removeAttribute('title');const value=String(text??'').trim();target.dataset.tooltip=value;if(!value){hideCompact(target);return;}target.setAttribute('aria-label',value);attachTooltip(target,value);if(activeCompact===target&&lastPosition){if(input.repositionOnUpdate===false){if(input.renderCompact)input.renderCompact(compact,value);else compact.textContent=value;lastCompactText=value;}else showCompact(target,value,lastPosition.x,lastPosition.y);}}
  function registerHelpTarget(target,value){if(!target)return;Object.assign(target.dataset,{helpTitle:String(value.title??''),helpSummary:String(value.summary??''),helpDefinition:String(value.definition??'')});let entry=entries.get(target)??{};if(entry.help)return;entry.help=true;target.dataset.helpBound='1';entries.set(target,entry);let pointer=null;const show=p=>{if(getHelpEnabled())showHelp(target,helpEntry(target),p.x,p.y);};
   on(target,'mouseenter',e=>{pointer={x:e.clientX,y:e.clientY};show(pointer);});on(target,'mousemove',e=>{pointer={x:e.clientX,y:e.clientY};if(activeHelp===target)show(pointer);});on(target,'mouseleave',()=>{pointer=null;hideHelp(target);});on(target,'focus',()=>show(pointer??anchor(target)));on(target,'blur',()=>hideHelp(target));
  }
  function updateHelpTarget(target,value){registerHelpTarget(target,value);applyCustomTooltip(target,value.title);hideHelp(target);}
  function registerCompositeHelpTarget(target,value){let pointerInside=false,focusInside=false,pointer=null;const show=p=>getHelpEnabled()?showHelp(target,value,p.x,p.y):showCompact(target,value.title,p.x,p.y),hide=()=>{if(!pointerInside&&!focusInside){hideCompact(target);hideHelp(target);}};
   on(target,'mouseenter',e=>{pointerInside=true;pointer={x:e.clientX,y:e.clientY};show(pointer);});on(target,'mousemove',e=>{pointer={x:e.clientX,y:e.clientY};show(pointer);});on(target,'mouseleave',()=>{pointerInside=false;pointer=null;hide();});on(target,'focusin',()=>{focusInside=true;show(pointer??anchor(target));});on(target,'focusout',e=>{if(target.contains(e.relatedTarget))return;focusInside=false;hide();});return{reset(){pointerInside=focusInside=false;pointer=null;hide();}};
  }
  function bindDelegated({root=doc,selector,resolve,exclude=()=>false,position=target=>{const r=target.getBoundingClientRect();return{x:r.left,y:r.bottom+7};}}){let current=null;
   const show=target=>{if(exclude(target))return;const entry=resolve(target);if(!entry)return;current=target;const p=position(target);getHelpEnabled()?showHelp(target,entry,p.x,p.y):showCompact(target,entry.title,p.x,p.y);};
   on(root,'pointerover',e=>{const t=e.target.closest?.(selector);if(t&&t!==current)show(t);});on(root,'pointerout',e=>{if(current&&!current.contains(e.relatedTarget)){current=null;hideAll();}});on(root,'focusin',e=>{const t=e.target.closest?.(selector);if(t&&!pointerDown)show(t);});on(root,'focusout',e=>{if(current&&!current.contains(e.relatedTarget)){current=null;hideAll();}});
   on(root,'pointerdown',()=>{pointerDown=true;current=null;hideAll();});on(root,'pointerup',()=>{pointerDown=false;});on(root,'pointercancel',()=>{pointerDown=false;});on(root,'scroll',()=>{current=null;hideAll();},true);
  }
  return Object.freeze({compact,expanded,showCompact,showHelp,hideCompact,hideHelp,hideAll,attachTooltip,applyCustomTooltip,registerHelpTarget,updateHelpTarget,registerCompositeHelpTarget,bindDelegated,destroy(){if(destroyed)return;destroyed=true;hideAll();for(const fn of cleanups){fn();collectedBindings.unregister(fn);}cleanups.clear();for(const surface of surfaces.values())surface.destroy();if(!input.compactElement)compact.remove();if(!input.expandedElement)expanded.remove();}});
 }
 scope.PortableUITooltips=Object.freeze({createTooltipController});
}(typeof self!=='undefined'?self:globalThis));
