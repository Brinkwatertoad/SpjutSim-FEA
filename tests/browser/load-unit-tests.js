(function () {
  'use strict';
  var api = SpjutsimFEA;
  function near(a,b) { if (Math.abs(a-b)>1e-12*Math.max(1,Math.abs(b))) { throw Error(a+' != '+b); } }
  try {
    near(api.displayToSI('forceN',1,'lbf'),4.4482216152605);
    near(api.displayToSI('forceN',1,'kip'),4448.2216152605);
    near(api.displayToSI('pressurePa',1,'psi'),6894.757293168361);
    near(api.displayToSI('pressurePa',1,'ksi'),6894757.293168361);
    ['N','kN','lbf','kip'].forEach(function (u) { near(api.siToDisplay('forceN',api.displayToSI('forceN',-1.25,u),u),-1.25); });
    ['Pa','MPa','psi','ksi'].forEach(function (u) { near(api.siToDisplay('pressurePa',api.displayToSI('pressurePa',123.4,u),u),123.4); });
    near(api.displayToSI('pressurePa',1),1e6); near(api.displayToSI('forceN',1),1);
    [['forceN','psi'],['pressurePa','lbf']].forEach(function (entry) {
      var rejected=false;try { api.displayToSI(entry[0],1,entry[1]); } catch(e) { rejected=true; }
      if(!rejected)throw Error('Cross-dimension unit accepted');
    });
    document.getElementById('test-status').textContent='Passed';
  } catch(e) { document.getElementById('test-status').textContent='Failed: '+e.message; }
}());
