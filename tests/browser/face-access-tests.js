(function(){
  var api=SpjutsimFEA,viewport;
  function assert(v,m){if(!v)throw Error(m);}
  try{
    var geometry=api.assignmentTestGeometry('faces');
    var edgePairs=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    var owners=[['face-y-','face-z-'],['face-x+','face-z-'],['face-y+','face-z-'],['face-x-','face-z-'],
      ['face-y-','face-z+'],['face-x+','face-z+'],['face-y+','face-z+'],['face-x-','face-z+'],
      ['face-x-','face-y-'],['face-x+','face-y-'],['face-x+','face-y+'],['face-x-','face-y+']];
    geometry.preview.featureEdges={positionsM:geometry.preview.positionsM,indices:new Uint32Array(edgePairs.flat()),
      ranges:owners.map(function(faceIds,index){return {faceIds:faceIds,start:index*2,count:2};})};
    viewport=new api.ViewportController(document.getElementById('viewport'));viewport.setGeometryPreview(geometry);
    assert(typeof viewport.pickFacesAtPointer==='function','Pick-through selection is missing');
    viewport.setViewOrientation('+x',{animate:false});viewport.fitCurrentModel({animate:false});
    var rect=viewport.canvas.getBoundingClientRect(),point={clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2};
    var hits=viewport.pickFacesAtPointer(point);assert(hits.length===2 && new Set(hits).size===2,'Pick-through did not return distinct front/back faces');
    viewport.setHiddenFaceIds([hits[0]]);assert(viewport.pickFaceAtPointer(point)===hits[1],'Hidden front face intercepted picking');
    assert(viewport.previewMesh.geometry.groups.find((g,i)=>viewport.previewMesh.userData.faceIdsByRange[i]===hits[0]).materialIndex===2,'Hidden face still rendered');
    viewport.setSelectedFaceIds([hits[1]]);viewport.isolateSelectedFaces();assert(viewport.hiddenFaceIds.size===5,'Isolate did not hide other faces');
    viewport.revealFaces([hits[0]]);assert(!viewport.hiddenFaceIds.has(hits[0]),'Locating assignment did not reveal its face');
    viewport.setHiddenFaceIds([]);assert(viewport.pickFacesAtPointer(point).length===2,'Show all did not restore picking');
    viewport.setPresentation({mode:'model',displayStyle:'wireframe'});
    viewport.setSelectedFaceIds(['face-x-']);viewport.isolateSelectedFaces();
    var edges=viewport.importedGeometry.getObjectByName('imported-geometry-feature-edges');
    assert(edges.visible && edges.geometry.drawRange.count===8,'Wireframe isolation must retain the selected face outline');
    assert(Array.from(edges.geometry.index.array.subarray(0,8)).join() === '3,0,7,4,0,4,3,7',
      'Wireframe isolation exposed hidden-face edges or triangle diagonals');
    var edgeBuffer=edges.geometry.index;
    viewport.setSelectedFaceIds(['face-x+']);viewport.isolateSelectedFaces();
    assert(edges.geometry.index===edgeBuffer && edges.geometry.drawRange.count===8,'Visibility changes must reuse the edge buffer');
    viewport.setHiddenFaceIds([]);
    assert(edges.visible && Array.from(edges.geometry.index.array).join()===edgePairs.flat().join(), 'Show all did not restore CAD edges');
    var rotated=api.rotateGeometryAroundGlobalAxis(geometry,'z',30);
    assert(rotated.preview.featureEdges.ranges && rotated.preview.featureEdges.ranges.length===12,'Rotation discarded edge ownership');
    var bad=structuredClone(geometry);bad.preview.featureEdges.ranges[0].faceIds=['missing'];
    assert(!api.validateGeometryModel(bad).valid,'Unknown edge owner accepted at geometry boundary');
    bad=structuredClone(geometry);bad.preview.featureEdges.ranges[0].count=3;
    assert(!api.validateGeometryModel(bad).valid,'Incomplete edge segment range accepted');
    viewport.setHiddenFaceIds([hits[0]]);viewport.setGeometryPreview(api.assignmentTestGeometry('replacement'));assert(!viewport.hiddenFaceIds.size,'Model replacement retained hidden faces');
    document.getElementById('test-status').textContent='Passed';
  }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;console.error(e);}finally{if(viewport)viewport.dispose();}
}());
