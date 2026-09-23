(function(){'use strict';var api=SpjutsimFEA;
function check(ok,message){if(!ok)throw Error(message);}
function rejects(fn,message){var failed=false;try{fn();}catch(e){failed=true;}check(failed,message);}
try{
 var frame={version:1,ownership:'global',originM:[.1,.2,.3],axes:[[0,1,0],[-1,0,0],[0,0,1]]};
 check(JSON.stringify(api.localToGlobal(api.validateLocalFrame(frame),[2,3,4]))==='[-3,2,4]','rectangular basis transform');
 rejects(function(){api.validateLocalFrame(Object.assign({},frame,{axes:[[1,0,0],[1,0,0],[0,0,1]]}));},'dependent axes rejected');
 rejects(function(){api.validateLocalFrame(Object.assign({},frame,{axes:[[1,0,0],[0,1,0],[0,0,-1]]}));},'left handed axes rejected');
 rejects(function(){api.validateLocalFrame(Object.assign({},frame,{originM:[Infinity,0,0]}));},'invalid origin rejected');
 var g={faceIds:['plane'],orientation:api.identityRigidOrientation(),planarFaces:{plane:{version:1,originM:[0,0,0],normal:[0,0,-1]}}};
 var attached=api.planarFaceFrame(g,'plane');
 check(attached.axes[2][2]===-1,'outward normal sign preserved');
 g.orientation={rotation:api.axisRotationMatrix('x',90),operations:[]};
 var resolved=api.resolveLocalFrame(attached,g);
 check(Math.abs(resolved.axes[2][1]-1)<1e-12,'CAD attached rotation');
 check(api.resolveLocalFrame(frame,g).axes[0][1]===1,'manual frame stays global');
 rejects(function(){api.planarFaceFrame(g,'curved');},'curved face rejected');
 var support={id:'s',name:'Local support',type:'support',faceIds:['plane'],componentsM:{z:api.displayToSI('displacementM',2,'mm')},frame:attached,preset:'sliding'};
 check(api.validateBoundaryCondition(support,g.faceIds).value.componentsM.z===.002,'SI local prescription');
 check(api.validateBoundaryCondition(support,g.faceIds).value.frame.ownership==='cad','frame survives normalization');
 check(!api.validateBoundaryCondition(Object.assign({},support,{frame:Object.assign({},attached,{faceId:'missing'})}),g.faceIds).valid,'missing frame reference rejected');
 document.getElementById('test-status').textContent='Passed local frames';
}catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;throw e;}
}());
