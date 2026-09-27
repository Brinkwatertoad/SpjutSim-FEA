(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var status = document.getElementById('test-status');
  function assert(value, message) { if (!value) { throw new Error(message); } }
  function output(index, active) {
    var value = index ? 1.01 : 1;
    return { mesh: { statistics: { nodeCount: 10 + index, elementCount: 2 + index } },
      preflight: { degreeOfFreedomCount: 30 + index * 3, estimatedPeakBytes: 1000, exceedsWasmCap: false,
        requiresEightGiBConfirmation: false }, material: {},
      solve: function () { return Promise.resolve({ warnings: [], meshStatistics: { boundingBoxDiagonalM: 1 },
        recoverySampleFields: { vonMisesPa: new Float64Array([100]), elementIndices: new Uint32Array([0]) },
        surfaceFields: { vonMisesPa: new Float32Array([100]) },
        extrema: { maxDisplacement: { valueM: value }, rawVonMisesMax: { valuePa: 100, locationM: [0, 0, 0] } },
        solverStatistics: { strainEnergyJ: value, iterations: 2, solveDurationMs: 1 } }); },
      dispose: function () { active.count -= 1; } };
  }
  var active = { count: 0, maximum: 0 };
  var targets = [];
  var completion;
  var runner = new api.ConvergenceRunner({
    prepareLevel: function (target, index) { targets.push(target); active.count += 1; active.maximum = Math.max(active.maximum, active.count); return Promise.resolve(output(index, active)); },
    onLevel: function () {}, onComplete: function (classification) { completion = classification; }
  });
  runner.start(1).then(function () {
    assert(targets.length === 2 && targets[1] === 0.7, 'runner did not refine deterministically');
    assert(active.maximum === 1 && active.count === 0, 'level resources overlapped or leaked');
    assert(completion.status === 'converged', 'runner did not stop after all convergence criteria');
    var resourceCompletion;
    var resourceOutput = output(0, { count: 1 });
    resourceOutput.preflight.exceedsWasmCap = true;
    resourceOutput.solve = function () { throw new Error('over-cap level was solved'); };
    var resourceRunner = new api.ConvergenceRunner({ prepareLevel: function () { return Promise.resolve(resourceOutput); },
      onComplete: function (classification) { resourceCompletion = classification; } });
    return resourceRunner.start(1).then(function () {
      assert(resourceCompletion.status === 'indeterminate-resource-limit', 'over-cap level was not stopped safely');
      var cancellationCompletion;
      var cancellationRunner = new api.ConvergenceRunner({
        prepareLevel: function (target, index) { return Promise.resolve(output(index, { count: 1 })); },
        onLevel: function () { cancellationRunner.cancel(); },
        onComplete: function (classification) { cancellationCompletion = classification; }
      });
      return cancellationRunner.start(1).then(function () {
        assert(cancellationCompletion.stopReason === 'cancelled', 'cancelled study continued refining');
      });
    });
  }).then(async function () {
    var baseline = {level:1,targetSizeM:1,maximumDisplacementM:1,strainEnergyJ:1,rawVonMisesMaxPa:100,peakLocationM:[0,0,0]};
    var quickTargets = [], quickCompletion, emitted = 0;
    var quick = new api.ConvergenceRunner({
      prepareLevel:function(target,index){quickTargets.push(target);return Promise.resolve(output(index,{count:1}));},
      onLevel:function(){emitted++;},onComplete:function(value){quickCompletion=value;}
    });
    await quick.start(1,{maxLevels:2},1,baseline);
    assert(quickTargets.length===1 && quickTargets[0]===0.7 && emitted===1,'Quick check did not reuse the existing solve and run exactly one finer mesh');
    assert(quickCompletion.globalConverged && Math.abs(quickCompletion.changes.maximumDisplacement-0.01)<1e-12,'Quick comparison omitted its baseline');
    var blocked = output(1,{count:1}); blocked.preflight.exceedsWasmCap=true;
    blocked.solve=function(){throw Error('Memory guard bypassed by quick check');};
    var blockedQuick=new api.ConvergenceRunner({prepareLevel:function(){return Promise.resolve(blocked);},onComplete:function(value){quickCompletion=value;}});
    await blockedQuick.start(1,{maxLevels:2},1,baseline);
    assert(quickCompletion.status==='indeterminate-resource-limit' && !quickCompletion.globalConverged,'Blocked quick check claimed mesh stability');
    blocked.preflight.exceedsWasmCap=false;blocked.preflight.requiresEightGiBConfirmation=true;
    await blockedQuick.start(1,{maxLevels:2},1,baseline);
    assert(quickCompletion.stopReason==='high-memory-confirmation','Quick check bypassed memory confirmation');
    var cancelledQuick=new api.ConvergenceRunner({prepareLevel:function(){cancelledQuick.cancel();return Promise.resolve(blocked);},onLevel:function(){throw Error('Cancelled quick check published a result');},onComplete:function(value){quickCompletion=value;}});
    await cancelledQuick.start(1,{maxLevels:2},1,baseline);
    assert(quickCompletion.stopReason==='cancelled' && !quickCompletion.globalConverged,'Cancelled quick check claimed mesh stability');
  }).then(async function () {
    async function stressStudy(stresses, options) {
      var count=0, live={count:0,maximum:0}, final, study;
      study=new api.ConvergenceRunner({prepareLevel:async function(target,index){
        count++;live.count++;live.maximum=Math.max(live.maximum,live.count);
        var prepared=output(index,live),solve=prepared.solve;
        prepared.solve=async function(){var result=await solve();result.extrema.rawVonMisesMax.valuePa=stresses[index];result.recoverySampleFields.vonMisesPa[0]=stresses[index];return result;};
        if(options && options.blockAt===index)prepared.preflight.exceedsWasmCap=true;
        return prepared;
      },onLevel:function(summary){if(options && options.cancelAt===summary.level)study.cancel();},onComplete:function(value){final=value;}});
      await study.start(1,{maxLevels:options && options.maxLevels || 4},1);
      assert(live.count===0 && live.maximum===1,'Stress refinement leaked/overlapped level resources');
      return {count:count,classification:final};
    }
    var stabilized=await stressStudy([100,120,122,123]);
    assert(stabilized.count===3 && stabilized.classification.stopReason==='criteria-met' && stabilized.classification.stressStable,'Study stopped before peak stress stabilized');
    var cancelAtStable=await stressStudy([100,120,122],{cancelAt:3});
    assert(cancelAtStable.count===3 && cancelAtStable.classification.stopReason==='cancelled','Convergence hid a cancellation on the stable level');
    var rising=await stressStudy([100,120,144,172.8]);
    assert(rising.count===4 && rising.classification.stopReason==='level-limit' && rising.classification.globalConverged && !rising.classification.stressStable,'Unresolved stress did not reach the bounded mesh limit');
    var quick=await stressStudy([100,120],{maxLevels:2});
    assert(quick.count===2 && quick.classification.stopReason==='level-limit' && !quick.classification.stressStable,'Quick screening expanded beyond two meshes or claimed all criteria met');
    var blocked=await stressStudy([100,120,144],{blockAt:2});
    assert(blocked.count===3 && blocked.classification.stopReason==='resource-limit','Stress continuation bypassed memory limit');
    var cancelled=await stressStudy([100,120,122],{cancelAt:2});
    assert(cancelled.count===2 && cancelled.classification.stopReason==='cancelled','Stress continuation ignored cancellation');
  }).then(function () {
    status.textContent = 'Passed'; status.dataset.result = 'passed';
  }).catch(function (error) { status.textContent = error.message; status.dataset.result = 'failed'; throw error; });
}(globalThis));
