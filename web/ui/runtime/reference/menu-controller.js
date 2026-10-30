/** Menu mechanics. Commands, catalogs, placement and application state belong to hosts. */
(function(scope){
 'use strict';
 const defaultItems=panel=>Array.from(panel?.querySelectorAll('[role="menuitem"]')||[]).filter(node=>node.closest('[role="menu"]')===panel&&!node.disabled&&!node.hidden);
 function handleMenuKey(event,{menu,getItems=defaultItems,openSubmenu,closeSubmenu,close,escape=true,document:doc=menu?.ownerDocument}={}){
  if(event.defaultPrevented||event.isComposing||scope.PortableUITransientSurfaces.isEditable(event.target)||!menu)return false;
  const items=getItems(menu),active=doc?.activeElement,index=items.indexOf(active),key=event.key;
  if(['ArrowDown','ArrowUp','Home','End'].includes(key)){
   event.preventDefault();event.stopPropagation();const next=key==='Home'?0:key==='End'?items.length-1:index<0?(key==='ArrowUp'?items.length-1:0):(index+(key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();return true;
  }
  if(key==='ArrowRight'&&openSubmenu?.(active,true)){event.preventDefault();event.stopPropagation();return true;}
  if(['ArrowLeft','Escape'].includes(key)&&closeSubmenu?.(menu)){event.preventDefault();event.stopPropagation();return true;}
  if(key==='Escape'&&escape&&close){event.preventDefault();event.stopPropagation();close(true);return true;}
  if(key==='Tab'&&close){close(false);return true;}
  return false;
 }
 function bindSubmenuHover({root,openSubmenu,closeSubmenus,schedule=scope.setTimeout?.bind(scope),cancel=scope.clearTimeout?.bind(scope),delay=180}){
  let timer;
  const leave=()=>{if(timer!==undefined)cancel(timer);timer=undefined;};
  const over=event=>{if(event.pointerType==='touch')return;const button=event.target.closest?.('[role="menuitem"]');if(!button||button.contains(event.relatedTarget))return;leave();timer=schedule(()=>{timer=undefined;const menu=button.closest('[role="menu"]');if(!button.isConnected||!menu?.checkVisibility())return;if(button.hasAttribute('aria-haspopup'))openSubmenu(button,false);else closeSubmenus(menu);},delay);};
  root.addEventListener('pointerover',over);root.addEventListener('pointerleave',leave);
  return Object.freeze({destroy(){leave();root.removeEventListener('pointerover',over);root.removeEventListener('pointerleave',leave);}});
 }
 // Explicit opt-in for flat menus. Hosts with nested popups retain their own containment policy.
 function constrainMenuHeight(menu,{viewport=menu.ownerDocument.defaultView,inset=8}={}){
  const available=Math.max(0,viewport.innerHeight-menu.getBoundingClientRect().top-inset);
  menu.style.maxHeight=available+'px';menu.style.overflowY='auto';return available;
 }
 function createMenuController({entries,document:doc=scope.document,getItems=defaultItems,positionMenu=()=>{},setOpen,beforeOpen=()=>{},focusOnClick=false,canHoverSwitch=()=>true,closeChildren=()=>{},contains,escape=true}){
  if(!Array.isArray(entries)||entries.some(e=>!e.trigger?.addEventListener||!e.panel))throw Error('Menu controller requires trigger/panel entries.');
  let current=null,destroyed=false;const cleanups=[];
  const on=(node,type,fn)=>{node.addEventListener(type,fn);cleanups.push(()=>node.removeEventListener(type,fn));};
  const set=(entry,open)=>{entry.trigger.setAttribute('aria-expanded',String(open));if(setOpen)setOpen(entry,open);else entry.panel.hidden=!open;};
  const closeAll=({restoreFocus=false}={})=>{const previous=current;current=null;closeChildren();for(const entry of entries)set(entry,false);if(restoreFocus)previous?.trigger.focus();};
  const openMenu=(trigger,focusFirst=false,last=false)=>{if(destroyed)return;const entry=entries.find(e=>e.trigger===trigger);if(!entry||trigger.disabled)return;closeAll();beforeOpen(entry);current=entry;set(entry,true);positionMenu(entry.panel,trigger);if(focusFirst){const items=getItems(entry.panel);items[last?items.length-1:0]?.focus();}};
  const dismissForEscape=()=>{if(!current)return false;closeAll({restoreFocus:true});return true;};
  for(const entry of entries){on(entry.trigger,'click',()=>{if(current===entry)closeAll();else openMenu(entry.trigger,typeof focusOnClick==='function'?focusOnClick(entry.trigger):focusOnClick);});
   on(entry.trigger,'keydown',event=>{if(event.defaultPrevented||event.isComposing)return;if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();openMenu(entry.trigger,true,event.key==='ArrowUp');}else if(event.key==='Escape'&&escape&&current){event.preventDefault();event.stopPropagation();dismissForEscape();}});
   on(entry.trigger,'pointerenter',event=>{if(event.pointerType==='touch')return;if(current&&current!==entry&&canHoverSwitch(entry.trigger,current.trigger))openMenu(entry.trigger);});
   on(entry.panel,'keydown',event=>{if(current?.panel===entry.panel && event.target.closest?.('[role="menu"]')===entry.panel)handleMenuKey(event,{menu:entry.panel,getItems,close:restoreFocus=>closeAll({restoreFocus}),escape});});
  }
  const dismissal=scope.PortableUITransientSurfaces.bindDismissal({document:doc,isOpen:()=>!!current,contains:contains||((target)=>entries.some(e=>e.trigger.contains(target)||e.panel.contains(target))),close:restoreFocus=>closeAll({restoreFocus}),escape});
  return Object.freeze({openMenu,closeAll,isOpen:()=>!!current,getOpenTrigger:()=>current?.trigger||null,dismissForEscape,destroy(){if(destroyed)return;closeAll();destroyed=true;dismissal.destroy();for(const cleanup of cleanups)cleanup();}});
 }
 scope.PortableUIMenus=Object.freeze({createMenuController,constrainMenuHeight,handleMenuKey,bindSubmenuHover,defaultItems});
}(typeof self!=='undefined'?self:globalThis));
