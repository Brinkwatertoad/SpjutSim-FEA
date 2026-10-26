/** Surface mechanics only: hosts own rendering, timing, transactions and visibility styles. */
(function(scope){
 'use strict';
 const editable=target=>!!target?.closest?.('input,textarea,select,[contenteditable=""],[contenteditable="true"]');
 function bindDismissal({document:doc=scope.document,isOpen,contains,close,escape=false,focus=true}){
  if(!doc?.addEventListener||![isOpen,contains,close].every(fn=>typeof fn==='function'))throw Error('Dismissal requires document, open state, containment and close callbacks.');
  const outside=event=>{if(isOpen()&&!contains(event.target))close(false,event);};
  const key=event=>{if(!escape||event.defaultPrevented||event.isComposing||event.key!=='Escape'||!isOpen())return;close(true,event);event.preventDefault();event.stopPropagation();};
  const listeners=[['pointerdown',outside],...(focus?[['focusin',outside]]:[]),...(escape?[['keydown',key]]:[])];
  for(const [type,fn]of listeners)doc.addEventListener(type,fn);
  return Object.freeze({destroy(){for(const [type,fn]of listeners)doc.removeEventListener(type,fn);}});
 }
 function createSurface({element,container=scope.document?.body,viewport=scope,inset=4,offset=12,cacheMeasurements=false,setVisible=(node,visible)=>{node.hidden=!visible;}}){
  if(!element?.getBoundingClientRect||!container?.appendChild)throw Error('Surface requires an element and container.');
  let size=null;
  const mount=target=>{const parent=target?.closest?.('dialog[open]')||container;if(element.parentElement!==parent){parent.appendChild(element);size=null;}};
  const position=(x,y,remeasure=false)=>{const width=Number(viewport.innerWidth||0),height=Number(viewport.innerHeight||0);
   if(!cacheMeasurements||remeasure||!size||size.viewportWidth!==width||size.viewportHeight!==height){const rect=element.getBoundingClientRect();size={width:rect.width||element.offsetWidth||0,height:rect.height||element.offsetHeight||0,viewportWidth:width,viewportHeight:height};}
   const coordinate=n=>Number.isFinite(Number(n))?Number(n):0;
   element.style.left=`${Math.min(Math.max(inset,coordinate(x)+offset),Math.max(inset,width-size.width-inset))}px`;
   element.style.top=`${Math.min(Math.max(inset,coordinate(y)+offset),Math.max(inset,height-size.height-inset))}px`;
  };
  const hide=()=>setVisible(element,false);
  return Object.freeze({mount,position,hide,invalidate(){size=null;},destroy(){hide();size=null;}});
 }
 scope.PortableUITransientSurfaces=Object.freeze({bindDismissal,createSurface,isEditable:editable});
}(typeof self!=='undefined'?self:globalThis));
