(async function(){
  'use strict';var api=SpjutsimFEA;
  function assert(ok,message){if(!ok)throw Error(message);}
  try{
    var load={id:'normal',name:'Normal',faceIds:['face-x+'],type:'total-force',direction:'surface-normal',magnitudeN:100,sense:'pull'};
    assert(api.validateLoad(load,['face-x+']).valid,'Normal magnitude force rejected');
    assert(!api.validateLoad(Object.assign({},load,{magnitudeN:0}),['face-x+']).valid,'Zero magnitude accepted');
    var app=new api.AppController({document:api.createAnalysisDocument()});app.replaceGeometry(api.assignmentTestGeometry('review'),{sourceName:'cube.step',sourceFormat:'step',sourceBytes:new ArrayBuffer(1)});
    app.replaceSelectedFaces(['face-x+']);app.beginAssignmentDraft('load',null,load);app.commitAssignmentDraft();
    assert(!app.document.selectedFaceIds.length,'Apply left selected surfaces');
    var g=app.document.geometry,surface={positionsM:g.preview.positionsM,indices:g.preview.indices,faceMap:{}};
    g.preview.faceRanges.forEach(function(r){surface.faceMap[r.faceId]=r;});
    var samples=api.sampleFaceGlyphPoints(surface,'face-x+',{spacingM:0.3,minCount:1,maxCount:12});
    var minDistance=Infinity; samples.forEach(function(a,i){samples.slice(i+1).forEach(function(b){minDistance=Math.min(minDistance,Math.hypot.apply(Math,a.positionM.map(function(v,k){return v-b.positionM[k];})));});});
    assert(samples.length>=8 && minDistance>0.2,'Surface arrows are clustered or too sparse');
    var tiny={positionsM:new Float64Array([0,0,0,0.01,0,0,0.01,0.01,0,0,0.01,0]),indices:new Uint32Array([0,1,2,0,2,3]),faceMap:{patch:{start:0,count:6}}};
    assert(api.sampleFaceGlyphPoints(tiny,'patch',{spacingM:0.2}).length>=6,'Small faces need multiple arrows');
    var strip=Object.assign({},tiny,{positionsM:new Float64Array([0,0,0,1,0,0,1,0.001,0,0,0.001,0])});
    var stripSamples=api.sampleFaceGlyphPoints(strip,'patch',{spacingM:0.1});
    var xs=stripSamples.map(function(p){return p.positionM[0];}).sort(function(a,b){return a-b;});
    assert(xs.length>=10 && xs.every(function(x,i){return !i || x-xs[i-1]<=0.100001;}),'Long thin faces violate arrow spacing');
    var source=await(await fetch('../../workers/solver-worker.js')).text();
    var pressure=new Function('self','createSpjutsimFemModule',source+';return normalForcePressure;')({postMessage:function(){}},function(){return Promise.resolve({});});
    var positions=new Float64Array([0,0,0,1,0,0,0,1,0,0.5,0,0,0.5,0.5,0,0,0.5,0]);
    var input=Object.assign({},load,{surfaceElementType:'tri6',surfaceConnectivity:new Uint32Array([0,1,2,3,4,5])});
    assert(Math.abs(pressure(input,positions)+200)<1e-10,'Flat Tri6 normal-force area or pull sign wrong');
    input.sense='push';assert(Math.abs(pressure(input,positions)-200)<1e-10,'Push sign wrong');
    input.surfaceConnectivity=new Uint32Array([0,1,2,3,4,5,0,2,1,5,4,3]);
    assert(Math.abs(pressure(input,positions)-100)<1e-10,'Normal magnitude not distributed across total selected area');
    positions[14]=0.2;input.surfaceConnectivity=new Uint32Array([0,1,2,3,4,5]);
    // Independent derivative of x=r, y=s, z=0.8*r*s at the native three quadrature points.
    var area=[[1/6,1/6],[2/3,1/6],[1/6,2/3]].reduce(function(sum,p){return sum+Math.sqrt(1+0.64*(p[0]*p[0]+p[1]*p[1]))/6;},0);
    assert(Math.abs(pressure(input,positions)-100/area)<1e-10,'Curved Tri6 area differs from native quadrature');
    app.document.gravity={enabled:true,accelerationMS2:[0,9.81,0]};
    var glyphs=api.buildAnalysisGlyphDescriptors(app.document);assert(glyphs.some(function(d){return d.type==='gravity'&&d.direction[1]===1;}),'Gravity direction missing');
    app.document.viewportPresentation.showGravity=false;assert(!api.buildAnalysisGlyphDescriptors(app.document).some(function(d){return d.type==='gravity';}),'Gravity visibility ignored');
    document.getElementById('test-status').textContent='Passed';
  }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;}
}());
