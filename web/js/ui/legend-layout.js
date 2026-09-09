(function (root) {
  'use strict';
  // Compact per-orientation placement; resizing the workspace clamps without losing the preference.
  function LegendLayout(element, changed) {
    this.element=element; this.canvas=element.closest('.fea-canvas'); this.changed=changed; this.saved={};
    try { var saved=JSON.parse(root.localStorage.getItem('spjutsim-fea-legend-layout-v1'));
      if(saved && typeof saved==='object' && !Array.isArray(saved)){['vertical','horizontal'].forEach(function(key){var box=saved[key];if(box && ['x','y','w','h'].every(function(k){return Number.isFinite(box[k]);}))this.saved[key]={x:box.x,y:box.y,w:box.w,h:box.h};},this);} } catch(ignored) {}
    var self=this;
    ['legend-title','legend-resize'].forEach(function(id) {
      var handle=element.querySelector('#'+id); if(!handle)return;
      handle.addEventListener('pointerdown',function(event) {
        if(event.button!==0)return;
        event.preventDefault();handle.setPointerCapture(event.pointerId);
        self.drag={id:event.pointerId,x:event.clientX,y:event.clientY,box:self.box,resize:id==='legend-resize'};
      });
      handle.addEventListener('pointermove',function(event) {
        var drag=self.drag;if(!drag || drag.id!==event.pointerId)return;
        var dx=event.clientX-drag.x,dy=event.clientY-drag.y,b=drag.box;
        self.update(drag.resize ? {x:b.x,y:b.y,w:b.w+dx,h:b.h+dy} : {x:b.x+dx,y:b.y+dy,w:b.w,h:b.h});
      });
      function finish(){if(self.drag){self.drag=null;self.persist();}}
      handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);handle.addEventListener('lostpointercapture',finish);
      handle.addEventListener('keydown',function(event) {
        var vector={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!vector)return;
        event.preventDefault();var b=self.box,step=event.shiftKey?20:5;
        self.update(id==='legend-resize' ? {x:b.x,y:b.y,w:b.w+vector[0]*step,h:b.h+vector[1]*step} : {x:b.x+vector[0]*step,y:b.y+vector[1]*step,w:b.w,h:b.h});self.persist();
      });
    });
    this.observer=new root.ResizeObserver(function(){self.apply();self.changed();});this.observer.observe(this.canvas);
  }
  LegendLayout.prototype.apply=function(){
    var orientation=this.element.dataset.orientation || 'vertical',horizontal=orientation==='horizontal';
    var cw=this.canvas.clientWidth,ch=this.canvas.clientHeight,s=this.saved[orientation];
    if(!s || !['x','y','w','h'].every(function(k){return Number.isFinite(s[k]);}))s={x:1,y:0.72,w:horizontal?320:150,h:horizontal?145:330};
    var w=Math.min(cw,Math.max(horizontal?180:120,s.w)),h=Math.min(ch,Math.max(horizontal?110:160,s.h));
    this.box={x:Math.max(0,Math.min(1,s.x))*(cw-w),y:Math.max(0,Math.min(1,s.y))*(ch-h),w:w,h:h};
    var b=this.box;Object.assign(this.element.style,{left:b.x+'px',top:b.y+'px',width:w+'px',height:h+'px'});
  };
  LegendLayout.prototype.update=function(box){
    var cw=this.canvas.clientWidth,ch=this.canvas.clientHeight,horizontal=this.element.dataset.orientation==='horizontal';
    var w=Math.min(cw,Math.max(horizontal?180:120,box.w)),h=Math.min(ch,Math.max(horizontal?110:160,box.h));
    this.saved[this.element.dataset.orientation || 'vertical']={x:Math.max(0,Math.min(1,box.x/Math.max(1,cw-w))),y:Math.max(0,Math.min(1,box.y/Math.max(1,ch-h))),w:w,h:h};
    this.apply();this.changed();
  };
  LegendLayout.prototype.persist=function(){try{root.localStorage.setItem('spjutsim-fea-legend-layout-v1',JSON.stringify(this.saved));}catch(ignored){}};
  LegendLayout.prototype.dispose=function(){this.observer.disconnect();};
  root.SpjutsimFEA.LegendLayout=LegendLayout;
}(globalThis));
