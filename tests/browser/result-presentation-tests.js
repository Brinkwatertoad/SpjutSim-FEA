(function () {
  'use strict';
  var api = SpjutsimFEA;
  function assert(value, message) { if (!value) { throw new Error(message); } }
  var ui = new api.UIController({document:{}});
  var result = {
    elementType:'tet10', meshStatistics:{nodeCount:10,elementCount:1},
    extrema:{maxDisplacement:{valueM:1e-6,locationM:[0,0,0]},
      rawVonMisesMax:{valuePa:5000,locationM:[0.25,0.25,0.25]},displayedVonMisesMax:{valuePa:4000},
      rawMaxPrincipal:{valuePa:5000},rawMinPrincipal:{valuePa:-1e-8}},
    equilibrium:{totalAppliedForceN:[1000,0,0],totalReactionN:[-1000,1e-12,0]},
    solverStatistics:{strainEnergyJ:1e-6}, assumptions:['linear-elastic'], convergenceStatus:'not-run',warnings:[],
    ranges:{vonMises:{minimum:1000,maximum:4000},factorOfSafety:{minimum:2,maximum:2.5,clipped:false}},
    factorOfSafety:{rawMinimum:{value:2},displayedMinimum:2.5,strength:{valuePa:10000}}
  };
  try {
    var display = Object.create(api.ViewportController.prototype);
    display.presentation = {mode:'stress', displayStyle:'lines', meshOverlay:false};
    display.resultSurface = {material:{}};
    display.resultDisplay = {userData:{lines:{visible:true},partEdges:{visible:false}}};
    display.applyPresentation();
    assert(!display.resultDisplay.userData.lines.visible, 'Mesh overlay off still displays element lines');
    assert(display.resultDisplay.userData.partEdges.visible, 'Shaded edges lost part boundaries');
    var ticks = api.buildLegendTicks({minimum:-4,maximum:8}, 'vertical', 280);
    assert(ticks.length >= 5 && ticks.length <= 7 && ticks[0].value === 8 && ticks[0].position === 0 && ticks[ticks.length-1].value === -4, 'Vertical signed ticks are not ordered top to bottom');
    assert(api.buildLegendTicks({minimum:0,maximum:1}, 'horizontal', 280).length === 2, 'Horizontal key must only label endpoints');
    assert(api.buildLegendTicks({minimum:3,maximum:3}, 'vertical', 80).every(function(t){return Number.isFinite(t.position) && t.value === 3;}), 'Uniform key has invalid ticks');
    assert(api.buildLegendTicks({minimum:0,maximum:1}, 'vertical', 80).length === 2, 'Short legend is crowded');
    assert(api.buildLegendTicks({minimum:-1e308,maximum:1e308},'vertical',280).every(function(t){return Number.isFinite(t.value);}), 'Finite signed limits produced invalid legend ticks');
    var range = api.resolveColorRange(result, {field:'vonMises',colorRange:{mode:'manual',field:'vonMises',minimum:2000,maximum:3000}});
    assert(range.minimum === 2000 && range.maximum === 3000 && range.clipped, 'Manual range does not describe clipping');
    assert(api.resolveColorRange(result,{field:'factorOfSafety',colorRange:{mode:'manual',field:'vonMises',minimum:2000,maximum:3000}}).maximum === 2.5, 'An incompatible field reused manual bounds');
    assert(api.resultFieldDefinition('vonMises',{stressUnit:'kPa'})[2] === 1000 && api.resultFieldDefinition('uz',{lengthUnit:'m'})[2] === 1, 'Unit changes have incorrect scale');
    var outline = api.buildPartEdgeIndices(new Uint32Array([0,1,2,0,2,3]), [{start:0,count:6}]);
    assert(outline.length === 8 && !Array.from(outline).some(function(v,i){return i%2===0 && v===0 && outline[i+1]===2;}), 'A planar face diagonal became a part outline');
    ui.renderSolve({mesh:{}});
    assert(!document.getElementById('solve-button').disabled && !api.solveReadiness({mesh:{}}).canSolve, 'Solve must be available to check while execution remains gated');
    ui.renderSolve({mesh:{},solvePreflight:{status:'running'}});
    assert(document.getElementById('solve-button').disabled, 'Solve enabled during preflight');
    ui.renderSolve({mesh:{},solvePreflight:{status:'ready',result:{exceedsWasmCap:true}}});
    assert(document.getElementById('solve-button').disabled, 'Solve enabled above memory cap');
    ui.renderSolve({mesh:{},solvePreflight:{status:'failed',error:{userMessage:'Add supports to constrain rigid-body motion.'}}});
    assert(!document.getElementById('solve-output-status').hidden && document.getElementById('solve-output-status').textContent.includes('Add supports'), 'Preflight failure is not visible in Results when Tools is collapsed');
    ui.renderSolve({mesh:null});
    assert(!document.getElementById('solve-button').disabled, 'Incomplete model cannot show actionable checks');
    var before = JSON.stringify(result);
    ui.renderResults({results:result});
    assert(document.getElementById('peak-headline').textContent.includes('0.005 MPa'), 'Engineering headline did not use sample peak');
    assert(document.getElementById('yield-headline').textContent.endsWith(': 2'), 'Engineering yield headline used smoothed FoS');
    assert(document.getElementById('trust-headline').textContent.includes('Not studied'), 'Single solve implied convergence');
    ui.renderLegend({results:result,viewportPresentation:{mode:'stress',field:'factorOfSafety'}});
    assert(!document.getElementById('legend-title').textContent.includes('clipped') && document.getElementById('legend-status').textContent.includes('Unclipped'), 'Unclipped FoS was described as clipped');
    ui.renderLegend({results:result,viewportPresentation:{mode:'stress',field:'vonMises'}});
    assert(document.getElementById('legend-title').textContent === 'von Mises (MPa)', 'Stress legend is not quiet');
    assert(document.getElementById('legend-min').textContent === '0' && document.getElementById('legend-max').textContent === '0.005', 'Legend does not span zero to model sample peak');
    assert(document.getElementById('legend-status').hidden && document.getElementById('result-legend').title.includes('0.004 MPa'), 'Smoothing detail is not confined to the tooltip');
    assert(api.getResultDisplayRange(result, 'vonMises').maximum === 5000 && result.ranges.vonMises.maximum === 4000, 'Display range replaced boundary metadata');
    assert(api.getResultDisplayRange(result, 'factorOfSafety') === result.ranges.factorOfSafety, 'Other field ranges changed');
    var imperial = {mode:'stress',field:'vonMises',stressUnit:'psi',lengthUnit:'in'};
    ui.renderResults({results:result,viewportPresentation:imperial});ui.renderLegend({results:result,viewportPresentation:imperial});
    assert(document.getElementById('peak-headline').textContent.includes('0.7252 psi') && document.getElementById('legend-title').textContent==='von Mises (psi)', 'Imperial stress units do not agree between summary and legend');
    assert(document.getElementById('results-values').textContent.includes('3.937e-5 in'), 'Displacement summary omitted inch conversion');
    assert(api.resultFieldDefinition('ux',imperial)[2]===0.0254 && Math.abs(api.resultFieldDefinition('maxPrincipal',{stressUnit:'ksi'})[2]-6894757.293168361)<1e-8,'Imperial field scales are incorrect');
    assert(JSON.stringify(result)===before,'Display units mutated SI result data');
    // Exercise the actual color-buffer update, independently of camera/WebGL startup.
    var renderer = Object.create(api.ViewportController.prototype);
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(9), 3));
    renderer.resultSurface = {geometry:geometry};
    renderer.resultDisplay = {userData:{lines:{geometry:geometry.clone()}}};
    renderer.resultModel = Object.assign({}, result, {
      originalSurface:{nodePositionsM:new Float64Array([0,0,0,1,0,0,0,1,0])},
      displacementM:new Float64Array(9), surfaceFields:{vonMisesPa:new Float32Array([1000,2500,4000])}
    });
    renderer.presentation = {field:'vonMises',deformationScale:0}; renderer.deformationAnimationMultiplier = 1;
    renderer.updateResultPresentation();
    var color = geometry.getAttribute('color').array;
    assert(Math.abs(color[3] - 0.2738384) < 1e-6 && Math.abs(color[4] - 0.5623174) < 1e-6 && Math.abs(color[5] - 0.1587321) < 1e-6, 'Surface color does not use the same zero-to-sample-peak scale as legend');
    var positionVersion = geometry.getAttribute('position').version, colorVersion = geometry.getAttribute('color').version;
    renderer.presentation.legendOrientation = 'horizontal'; renderer.updateResultPresentation();
    assert(geometry.getAttribute('position').version === positionVersion && geometry.getAttribute('color').version === colorVersion, 'Legend-only change rewrote bulk result buffers');
    renderer.presentation.deformationScale = 10;renderer.updateResultPresentation();
    assert(geometry.getAttribute('color').version === colorVersion, 'Deformation animation rebuilt unchanged colors');
    renderer.resultModel.extrema = {rawVonMisesMax:{valuePa:0}};
    renderer.resultModel.surfaceFields.vonMisesPa.fill(0); renderer.updateResultPresentation();
    assert(Array.from(color).every(Number.isFinite), 'Zero stress produced nonfinite colors');
    renderer.resultDisplay.userData.lines.geometry.dispose(); geometry.dispose();
    var values = document.getElementById('results-values');
    var reaction = Array.from(values.querySelectorAll('dt')).find(function (label) { return label.textContent === 'Reaction'; }).nextElementSibling;
    assert(reaction.textContent.includes('1e-12 N'), 'Small reaction was silently rounded to zero');
    assert(Array.from(values.querySelectorAll('dd')).every(function (value) { return value.getBoundingClientRect().width >= 100; }), 'Result labels squeezed values into an unreadable column');
    assert(JSON.stringify(result) === before, 'Formatting mutated engineering data');
    document.getElementById('peak-location-status').textContent = 'Old level peak';
    ui.renderResults({results:Object.assign({},result,{factorOfSafety:null})});
    assert(document.getElementById('yield-headline').textContent.includes('unavailable'), 'Missing strength did not remove the yield headline');
    assert(document.getElementById('peak-location-status').textContent === '', 'A different result retained the previous peak location');
    document.getElementById('peak-location-status').textContent = 'Old peak';
    ui.renderResults({results:null});
    assert(document.getElementById('peak-location-status').textContent === '', 'Stale peak location survived result invalidation');
    var emitted = null;
    var contextUI = new api.UIController({document:{viewportPresentation:{mode:'deformation',field:'displacementMagnitude'}},replaceViewportPresentation:function(value){emitted=value;}});
    contextUI.viewportMode={value:'stress'};contextUI.deformationMode={value:'user'};contextUI.deformationScale={value:'50'};
    contextUI.updateViewportPresentation();
    assert(emitted && emitted.deformationScale===0 && emitted.deformationMode==='undeformed','Stress retains inaccessible deformation scaling');
    document.getElementById('test-status').textContent = 'Passed';
  } catch (error) { document.getElementById('test-status').textContent = 'Failed: ' + error.message; }
}());
