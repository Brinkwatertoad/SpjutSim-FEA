(function(){
 'use strict';var status=document.getElementById('test-status');
 function assert(value,message){if(!value)throw new Error(message);}
 try{
  for(var size of [1e-6,1,1e3]) {
   var p=new Float64Array([0,0,0,size,0,0,0,size,0,0,0,size]),ids=new Uint32Array([0,1,2,3]);
   var q=meshStatistics(p,ids,[1],size*1e6,{elementType:'tet4',volumeNodes:4});
   assert(q.nearZeroJacobianCount===0,'A small regular element was rejected because of the whole-model size');
   var quadratic=Array.from(p),pairs=[[0,1],[1,2],[2,0],[0,3],[2,3],[3,1]];pairs.forEach(function(pair){for(var axis=0;axis<3;axis++)quadratic.push((p[pair[0]*3+axis]+p[pair[1]*3+axis])/2);});
   var q10=meshStatistics(new Float64Array(quadratic),new Uint32Array([0,1,2,3,4,5,6,7,8,9]),[1],size*1e6,{elementType:'tet10',volumeNodes:10});
   assert(q10.nearZeroJacobianCount===0&&q10.invertedElementCount===0,'A small regular Tet10 failed the local-scale gate');
   p[11]=size*1e-14;q=meshStatistics(p,ids,[1e-14],size,{elementType:'tet4',volumeNodes:4});
   assert(q.nearZeroJacobianCount===1,'An element-relative degenerate tetrahedron was accepted');
   p[11]=-size;q=meshStatistics(p,ids,[1],size,{elementType:'tet4',volumeNodes:4});
   assert(q.invertedElementCount===1,'An inverted tetrahedron was accepted');
  }
  status.textContent='Passed';status.dataset.result='passed';
 }catch(error){status.textContent=error.message;status.dataset.result='failed';}
}());
