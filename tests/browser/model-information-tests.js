(function(){
  var api=SpjutsimFEA;function assert(v,m){if(!v)throw Error(m);}
  try{
    assert(typeof api.modelInformation==='function','Model information is missing');
    var state=api.createAnalysisDocument();state.geometry=api.assignmentTestGeometry('volume');state.material={densityKgM3:7800};
    assert(api.modelInformation(state).volumeM3===1 && api.modelInformation(state).massKg===7800,'Analytical box volume/mass differs');
    state.geometry.volumeM3=Math.PI*0.01*0.01*0.1;state.material.densityKgM3=2700;
    assert(Math.abs(api.modelInformation(state).massKg-0.08482300164692443)<1e-14,'Cylinder mass differs');
    state.geometry=api.rotateGeometryAroundGlobalAxis(state.geometry,'x',23);assert(Math.abs(api.modelInformation(state).massKg-0.08482300164692443)<1e-14,'Rotation changed mass');
    delete state.geometry.volumeM3;assert(api.modelInformation(state).volumeM3===null && api.modelInformation(state).massKg===null,'Missing CAD volume became box volume or zero');
    state.geometry.volumeM3=1;state.material=null;assert(api.modelInformation(state).massKg===null,'Missing density became zero mass');
    assert(Math.abs(api.displayToSI('massKg',1,'lbm')-0.45359237)<1e-14,'Pound mass conversion wrong');
    assert(Math.abs(api.displayToSI('volumeM3',1,'in³')-0.000016387064)<1e-16,'Cubic inch conversion wrong');
    document.getElementById('test-status').textContent='Passed';
  }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;console.error(e);}
}());
