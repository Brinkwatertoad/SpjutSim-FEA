/** Portable workspace mechanics. Hosts own state, geometry, transactions and persistence. */
(function(scope){
 'use strict';
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function snapSize({raw,min,max=Infinity,start,collapsible=true}){
  return collapsible&&raw<=min/2?{open:false,size:start}:{open:true,size:clamp(raw,min,Math.max(min,max))};
 }
 function fitSizes({preferred,min,available,priority}){
  if(Number.isInteger(priority)&&priority>=0&&priority<preferred.length){const sizes=min.slice(),others=preferred.map((_,i)=>i).filter(i=>i!==priority);sizes[priority]=clamp(preferred[priority],min[priority],Math.max(min[priority],available-others.reduce((n,i)=>n+min[i],0)));const fitted=fitSizes({preferred:others.map(i=>preferred[i]),min:others.map(i=>min[i]),available:available-sizes[priority]});others.forEach((i,n)=>sizes[i]=fitted[n]);return sizes;}
  const floor=min.reduce((a,b)=>a+b,0),extra=preferred.reduce((a,b,i)=>a+Math.max(0,b-min[i]),0),ratio=extra?clamp((available-floor)/extra,0,1):0;
  return preferred.map((v,i)=>min[i]+Math.max(0,v-min[i])*ratio);
 }
 function resolveLayout({width,wideAt=1000,compactAt=600}){return width>=wideAt?'docked':width>=compactAt?'stacked':'compact';}
 function decorateHandle(handle,axis='x'){
  handle.classList.add('ui-pane-divider');handle.dataset.uiPaneAxis=axis;handle.setAttribute('role','separator');handle.setAttribute('tabindex','0');handle.setAttribute('aria-orientation',axis==='x'?'vertical':'horizontal');
 }
 function bindResizeHandle({handle,getSize,onResize,onCommit,onCancel,keyboardTarget,onStart,onFinish,axis='x',direction=1,getBounds,getDefaultSize,getSnapshot,getOpen,setOpen,onToggle}){
  if(!handle?.addEventListener||![getSize,onResize,onCommit].every(fn=>typeof fn==='function'))throw Error('Pane resize requires a handle and geometry callbacks.');
  const doc=handle.ownerDocument,readAxis=()=>typeof axis==='function'?axis():axis,readDirection=()=>typeof direction==='function'?direction():direction;
  if(!['x','y'].includes(readAxis())||![1,-1].includes(readDirection()))throw Error('Pane axis/direction is invalid.');
  let drag=null;
  function sync(){const a=readAxis();decorateHandle(handle,a);if(getBounds){const b=getBounds(),closed=getOpen&&!getOpen(),n=closed?0:getSize();handle.setAttribute('aria-valuemin',String(Math.round(closed?0:b.min)));handle.setAttribute('aria-valuemax',String(Math.round(b.max)));handle.setAttribute('aria-valuenow',String(Math.round(n)));handle.setAttribute('aria-valuetext',Math.round(n)+' pixels');}if(getOpen)handle.dataset.uiPaneClosed=String(!getOpen());}
  function release(current){try{if(handle.hasPointerCapture?.(current.id))handle.releasePointerCapture(current.id);}catch{/* Pointer may already have ended. */}}
  function finish(reason,event){if(!drag)return;const current=drag;drag=null;delete handle.dataset.uiPaneDragging;release(current);if(reason==='cancel'){if(onCancel)onCancel(current.size,event,current.snapshot);else onResize(current.size,{phase:'cancel',event,startSize:current.size});}else if(current.moved)onCommit(getSize(),event);sync();onFinish?.(reason);}
  function down(event){if(event.button!==0||drag)return;event.preventDefault();const a=readAxis();drag={id:event.pointerId,start:a==='x'?event.clientX:event.clientY,size:getOpen&&!getOpen()?0:getSize(),axis:a,direction:readDirection(),snapshot:getSnapshot?.(),moved:false};handle.dataset.uiPaneDragging='true';try{handle.setPointerCapture?.(event.pointerId);}catch{/* Synthetic pointer has no capture. */}onStart?.(event);}
  function move(event){if(!drag||drag.id!==event.pointerId)return;const c=drag.axis==='x'?event.clientX:event.clientY,raw=drag.size+(c-drag.start)*drag.direction;drag.moved=true;const stop=onResize(raw,{phase:'pointer',event,startSize:drag.size,snapshot:drag.snapshot})===false;sync();if(stop)finish('commit',event);}
  function end(event){if(!drag||drag.id!==event.pointerId)return;finish(event.type==='pointerup'?'commit':'cancel',event);}
  function escape(event){if(drag&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish('cancel',event);}}
  function key(event){if(event.isComposing||event.defaultPrevented)return;if(event.key==='Enter'&&onToggle){event.preventDefault();onToggle(event);sync();return;}if((event.ctrlKey||event.metaKey)&&event.key==='Home'&&getDefaultSize){reset(event);return;}let target;if(keyboardTarget)target=keyboardTarget(event,getSize());else if(getBounds){const b=getBounds(),a=readAxis(),d=(event.shiftKey?40:10)*readDirection(),size=getSize();const lower=a==='x'?'ArrowLeft':'ArrowUp',higher=a==='x'?'ArrowRight':'ArrowDown';target=event.key===lower?size-d:event.key===higher?size+d:event.key==='Home'?b.min:event.key==='End'?b.max:undefined;if(target!==undefined)target=clamp(target,b.min,b.max);}if(event.key==='Enter'&&setOpen&&getOpen){event.preventDefault();setOpen(!getOpen());sync();return;}if(target===undefined)return;if(!Number.isFinite(target))throw Error('Pane keyboard policy must return a finite size.');event.preventDefault();onResize(target,{phase:'keyboard',event,startSize:getSize()});onCommit(getSize(),event);sync();}
  function reset(event){if(!getDefaultSize)return;event.preventDefault();const value=getDefaultSize();onResize(value,{phase:'reset',event,startSize:getSize()});onCommit(getSize(),event);sync();}
  const listeners=[['pointerdown',down],['pointermove',move],['pointerup',end],['pointercancel',end],['lostpointercapture',end],['keydown',key],['dblclick',reset]];
  for(const[name,fn]of listeners)handle.addEventListener(name,fn);doc.addEventListener('keydown',escape,true);if(getDefaultSize)handle.setAttribute('aria-keyshortcuts','Control+Home Meta+Home');sync();
  return Object.freeze({sync,cancel(){finish('cancel');},destroy(){finish('cancel');for(const[name,fn]of listeners)handle.removeEventListener(name,fn);doc.removeEventListener('keydown',escape,true);}});
 }
 function bindScrollPane(pane){
  pane.classList.add('ui-pane-scroll');const win=pane.ownerDocument.defaultView||scope;
  const measure=()=>{const style=win.getComputedStyle(pane),border=parseFloat(style.borderLeftWidth||0)+parseFloat(style.borderRightWidth||0),lane=Math.max(0,pane.offsetWidth-pane.clientWidth-border);if(pane.clientWidth>0)pane.style.setProperty('--ui-scrollbar-width',lane+'px');};
  const observer=new win.ResizeObserver(measure);observer.observe(pane);measure();return {destroy(){observer.disconnect();}};
 }
 function bindPaneFocus({pane,toggle}){
  const doc=pane.ownerDocument;let focused=null;
  const remember=event=>{focused=event.target;};pane.addEventListener('focusin',remember);
  const observer=new MutationObserver(()=>{if(pane.hidden&&focused&&(doc.activeElement===focused||doc.activeElement===doc.body)){toggle?.focus({preventScroll:true});}});observer.observe(pane,{attributes:true,attributeFilter:['hidden']});
  return {restore(){if(focused?.isConnected&&!pane.hidden)focused.focus({preventScroll:true});},destroy(){observer.disconnect();pane.removeEventListener('focusin',remember);}};
 }
 function bindDrawer({pane,toggle,isActive,close,canDismiss=()=>true,contains=target=>pane.contains(target)||toggle?.contains(target),side='left',returnFocus}){
  const doc=pane.ownerDocument,win=doc.defaultView||scope;pane.classList.add('ui-pane-drawer');pane.dataset.uiPaneSide=side;
  const refresh=()=>{pane.dataset.uiPaneDrawer=String(isActive());};
  const resize=new win.ResizeObserver(refresh),observer=new win.MutationObserver(refresh);resize.observe(pane.parentElement||pane);observer.observe(pane,{attributes:true,attributeFilter:['hidden']});if(pane.parentElement)observer.observe(pane.parentElement,{attributes:true});refresh();
  const dismiss=event=>{if(!isActive()||!canDismiss(event))return false;close(event);refresh();if(returnFocus)returnFocus(event);else toggle?.focus({preventScroll:true});return true;};
  const pointer=event=>{const target=event.target?.nodeType===1?event.target:event.target?.parentElement||doc.documentElement;if(event.button===0&&isActive()&&!contains(target))dismiss(event);};
  const key=event=>{if(event.key==='Escape'&&!event.defaultPrevented&&!event.isComposing&&dismiss(event)){event.preventDefault();event.stopImmediatePropagation();}};
  doc.addEventListener('pointerdown',pointer);doc.addEventListener('keydown',key);
  return {destroy(){resize.disconnect();observer.disconnect();doc.removeEventListener('pointerdown',pointer);doc.removeEventListener('keydown',key);pane.classList.remove('ui-pane-drawer');delete pane.dataset.uiPaneDrawer;}};
 }

 scope.PortableUIPanes=Object.freeze({bindResizeHandle,decorateHandle,bindPaneFocus,bindDrawer,bindScrollPane,snapSize,fitSizes,resolveLayout});
}(typeof self!=='undefined'?self:globalThis));
