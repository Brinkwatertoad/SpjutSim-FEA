(function(){
  var api=SpjutsimFEA,viewport;
  function assert(v,m){if(!v)throw Error(m);}
  try{
    viewport=new api.ViewportController(document.getElementById('viewport'));viewport.setGeometryPreview(api.assignmentTestGeometry('faces'));
    assert(typeof viewport.pickFacesAtPointer==='function','Pick-through selection is missing');
    viewport.setViewOrientation('+x',{animate:false});viewport.fitCurrentModel({animate:false});
    var rect=viewport.canvas.getBoundingClientRect(),point={clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2};
    var hits=viewport.pickFacesAtPointer(point);assert(hits.length===2 && new Set(hits).size===2,'Pick-through did not return distinct front/back faces');
    viewport.setHiddenFaceIds([hits[0]]);assert(viewport.pickFaceAtPointer(point)===hits[1],'Hidden front face intercepted picking');
    assert(viewport.previewMesh.geometry.groups.find((g,i)=>viewport.previewMesh.userData.faceIdsByRange[i]===hits[0]).materialIndex===2,'Hidden face still rendered');
    viewport.setSelectedFaceIds([hits[1]]);viewport.isolateSelectedFaces();assert(viewport.hiddenFaceIds.size===5,'Isolate did not hide other faces');
    viewport.revealFaces([hits[0]]);assert(!viewport.hiddenFaceIds.has(hits[0]),'Locating assignment did not reveal its face');
    viewport.setHiddenFaceIds([]);assert(viewport.pickFacesAtPointer(point).length===2,'Show all did not restore picking');
    viewport.setHiddenFaceIds([hits[0]]);viewport.setGeometryPreview(api.assignmentTestGeometry('replacement'));assert(!viewport.hiddenFaceIds.size,'Model replacement retained hidden faces');
    document.getElementById('test-status').textContent='Passed';
  }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;console.error(e);}finally{if(viewport)viewport.dispose();}
}());
