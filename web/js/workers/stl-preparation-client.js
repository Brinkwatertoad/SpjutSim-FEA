(function(root){
  'use strict';
  var api=root.SpjutsimFEA;
  function failure(code,message){var e=new Error(message);e.diagnostic={code:code,stage:'stl-preparation',userMessage:message};return e;}
  function StlPreparationClient(options){this.onEvent=options&&options.onEvent||function(){};this.worker=null;this.disposed=false;}
  StlPreparationClient.prototype.prepare=async function(request){
    var self=this,started=Date.now();
    if(self.disposed||self.pending)throw failure('STL_PREPARATION_BUSY','This STL preparation is no longer available.');
    if(!api.validateStlPreparationRequest(request))throw failure('STL_INVALID_OPTIONS','Choose valid STL source units and repair limits.');
    self.pending=true;
    var worker=await api.startLocalWorker('stl-preparation');
    if(self.disposed){worker.terminate();throw failure('STL_PREPARATION_CANCELLED','STL preparation cancelled.');}
    self.worker=worker;
    return new Promise(function(resolve,reject){
      var id='stl-'+request.sessionId+'-'+request.generation,sourcePreview,settled=false;
      var timer=root.setTimeout(function(){finish(failure('STL_PREPARATION_TIMEOUT','STL checking exceeded two minutes. The source remains available for inspection; try a simpler export.'));},Math.max(1,120000-(Date.now()-started)));
      function finish(error,result){if(settled)return;settled=true;root.clearTimeout(timer);worker.terminate();self.worker=null;self.cancelPending=null;self.pending=false;if(error)reject(error);else resolve(result);}
      self.cancelPending=function(){finish(failure('STL_PREPARATION_CANCELLED','STL preparation cancelled.'));};
      worker.onerror=function(e){finish(failure('STL_PREPARATION_FAILED',e.message||'STL preparation failed.'));};
      worker.onmessageerror=function(){finish(failure('INVALID_STL_PREPARATION','The preparation worker returned unreadable data.'));};
      worker.onmessage=function(event){
        if(settled)return;
        var m=event.data;
        if(!m||m.requestId!==id||m.sessionId!==request.sessionId||m.generation!==request.generation)return;
        try{
          if(m.protocol!==api.WORKER_PROTOCOL_VERSION)throw failure('INVALID_STL_PREPARATION','The STL worker version does not match the application.');
          if(m.type==='error')throw failure(m.error.code,m.error.userMessage);
          if(m.type==='stl-preview'){
            if(sourcePreview||!api.validateStlPreview(m.preview)||m.preview.revision!=='source')throw failure('INVALID_STL_PREPARATION','Invalid source preview.');
            sourcePreview=m.preview;
          }else if(m.type==='stl-progress'){
            if(typeof m.message!=='string')throw failure('INVALID_STL_PREPARATION','Invalid preparation progress.');
          }else if(m.type==='stl-prepared'){
            if(!sourcePreview||!api.validateStlPreparationResult(m.result,sourcePreview))throw failure('INVALID_STL_PREPARATION','Invalid STL preparation result.');
            self.onEvent(m);finish(null,m.result);return;
          }else throw failure('INVALID_STL_PREPARATION','Unexpected preparation response.');
          self.onEvent(m);
        }catch(e){finish(e);}
      };
      var bytes=request.sourceBytes.slice(0);
      worker.postMessage(Object.assign({},request,{protocol:api.WORKER_PROTOCOL_VERSION,type:'prepare-stl',requestId:id,sourceBytes:bytes}),[bytes]);
    });
  };
  StlPreparationClient.prototype.cancel=function(){this.disposed=true;if(this.cancelPending)this.cancelPending();else if(this.worker){this.worker.terminate();this.worker=null;}};
  StlPreparationClient.prototype.dispose=StlPreparationClient.prototype.cancel;
  api.StlPreparationClient=StlPreparationClient;
}(globalThis));
