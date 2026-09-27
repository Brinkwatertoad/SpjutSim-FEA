(function(){
 'use strict';function assert(v,m){if(!v)throw Error(m);}
 try{
  var api=SpjutsimFEA;assert(typeof api.renderConvergenceCharts==='function','Readable convergence charts are missing');
  api.preferredUnit=k=>({lengthM:'mm',stressPa:'MPa',energyJ:'J'})[k];
  api.preferredFromSI=(k,v)=>v*({lengthM:1000,stressPa:1e-6,energyJ:1})[k];api.formatResultNumber=v=>Number(v.toPrecision(4)).toString();
  var host=document.getElementById('charts'),settings=api.createConvergenceSettings(),levels=[{level:1,degreeOfFreedomCount:100,maximumDisplacementM:.001,strainEnergyJ:1,rawVonMisesMaxPa:10e6},{level:2,degreeOfFreedomCount:300,maximumDisplacementM:.00101,strainEnergyJ:1.01,rawVonMisesMaxPa:12e6}];
  var study={status:'completed',levels:levels,settings:settings};
  api.renderConvergenceCharts(host,study);
  assert(host.querySelectorAll('svg').length===3,'Quantities do not have separate charts');
  assert(host.textContent.includes('mm') && host.textContent.includes('MPa') && host.textContent.includes('Degrees of freedom'),'Charts lack units or mesh axis');
  assert(host.textContent.includes('20%') && host.textContent.includes('5%') && host.textContent.includes('1%'),'Actual changes/thresholds missing');
  assert(host.textContent.includes('Peak stress remains mesh-sensitive'),'Stable displacement concealed unresolved stress');
  assert(!host.innerHTML.includes('NaN') && !host.innerHTML.includes('Infinity'),'Nonfinite SVG coordinates');
  assert(host.querySelector('svg').getBoundingClientRect().width<=host.clientWidth,'Chart overflows narrow pane');
  var first=host.querySelector('svg').getAttribute('aria-label');assert(first.includes('1.01') && first.includes('300'),'Accessible chart omits actual measurements');
  var charts=host.querySelectorAll('.fea-convergence-chart');
  assert(charts[1].textContent.includes('Convergence band') && charts[1].textContent.includes('9.5–10.5 MPa'),'Stress band is not previous value ±5% in displayed units');
  assert(charts[0].textContent.includes('0.98–1.02 mm'),'Displacement band does not use its 2% threshold');
  var band=charts[1].querySelector('rect.fea-convergence-band');
  assert(band && Number(band.getAttribute('height'))>20,'Band geometry does not match stress-value coordinates');
  study.settings=api.createConvergenceSettings({stressTolerance:0.1});study.levels=[levels[0],Object.assign({},levels[1],{rawVonMisesMaxPa:10e6})];
  api.renderConvergenceCharts(host,study);var stress=host.querySelectorAll('.fea-convergence-chart')[1];
  assert(stress.textContent.includes('9–11 MPa'),'Band ignored recorded custom threshold');
  var customBand=stress.querySelector('rect.fea-convergence-band');
  assert(Number(customBand.getAttribute('y'))>=18 && Number(customBand.getAttribute('height'))>0,'Band clipped above a flat data series');
  assert(stress.querySelector('svg').getAttribute('aria-label').includes('Convergence band'),'Band is not described to assistive technology');
  var three=[levels[0],Object.assign({},levels[1],{rawVonMisesMaxPa:11e6}),Object.assign({},levels[1],{level:3,degreeOfFreedomCount:600,rawVonMisesMaxPa:12e6})];
  study.levels=three;api.renderConvergenceCharts(host,study);
  var plot=host.querySelectorAll('svg')[1];
  assert(host.textContent.includes('auto-range'),'Auto-ranging not explained');
  assert(Array.from(plot.querySelectorAll('.fea-convergence-x-label')).some(n=>n.textContent==='300'),'Previous mesh DOF label missing');
  assert(Array.from(plot.querySelectorAll('.fea-convergence-y-label')).some(n=>n.textContent==='11'),'Data value missing on Y axis');
  function noOverlap(nodes){
    var boxes=Array.from(nodes,n=>n.getBoundingClientRect());
    return boxes.every((a,i)=>boxes.every((b,j)=>i===j || a.right+2<=b.left || b.right+2<=a.left || a.bottom+2<=b.top || b.bottom+2<=a.top));
  }
  assert(noOverlap(plot.querySelectorAll('.fea-convergence-y-label')),'Y labels overlap');
  assert(noOverlap(plot.querySelectorAll('.fea-convergence-x-label')),'X labels overlap');
  study.levels=[three[0],Object.assign({},three[1],{degreeOfFreedomCount:599}),three[2]];
  api.renderConvergenceCharts(host,study);
  assert(noOverlap(host.querySelectorAll('svg')[1].querySelectorAll('.fea-convergence-x-label')),'Nearby DOF labels overlap');
  study.settings=settings;
  study.levels=[levels[0]];api.renderConvergenceCharts(host,study);assert(host.textContent.includes('another mesh') && host.querySelectorAll('circle').length===3,'Single mesh presented as a comparison or invisible');assert(!host.querySelector('.fea-convergence-band'),'Single mesh invents a convergence band');
  study.levels=[Object.assign({},levels[0],{maximumDisplacementM:0}),levels[1]];api.renderConvergenceCharts(host,study);assert(host.textContent.includes('percentage undefined') && !host.innerHTML.includes('Infinity'),'Zero baseline produced a false percentage');assert(Number(host.querySelector('.fea-convergence-band').getAttribute('height'))===0,'Zero baseline band has an invented tolerance');
  study.levels=[levels[0],Object.assign({},levels[0],{level:2})];api.renderConvergenceCharts(host,study);assert(!host.innerHTML.includes('NaN') && host.textContent.includes('0%'),'Equal values/DOFs break the chart');
  study.levels=levels.map(level=>Object.assign({},level,{maximumDisplacementM:0,strainEnergyJ:0,rawVonMisesMaxPa:0}));
  api.renderConvergenceCharts(host,study);
  assert(!host.innerHTML.includes('NaN') && !host.innerHTML.includes('Infinity'),'All-zero auto-range is invalid');
  assert(Array.from(host.querySelectorAll('circle')).every(n=>Number(n.getAttribute('cy'))>=18 && Number(n.getAttribute('cy'))<=110),'Zero samples lie outside the plot');
  study.status='failed';api.renderConvergenceCharts(host,study);assert(host.textContent.includes('Completed meshes only'),'Failed study appears completed');
  var stopped=api.convergenceStatusMessage({status:'completed',settings:settings,levels:levels,stopReason:'level-limit',classification:{status:'converged-stress-unresolved',globalConverged:true,stressStable:false}});
  assert(stopped.includes('4-level limit') && stopped.includes('Strength assessment remains unresolved'),'Stress-limited study hides why refinement stopped');
  api.renderConvergenceCharts(host,null);assert(host.textContent.includes('No mesh comparison'),'Empty state unclear');
  document.getElementById('test-status').textContent='Passed';
 }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;console.error(e);}
}());
