(function (root) {
  'use strict';

  function ConvergenceRunner(options) {
    this.prepareLevel = options.prepareLevel;
    this.onLevel = options.onLevel || function () {};
    this.onComplete = options.onComplete || function () {};
    this.onProgress = options.onProgress || function () {};
    this.confirmHighMemory = options.confirmHighMemory || function () { return false; };
    this.cancelCurrent = null;
    this.cancelled = false;
  }

  ConvergenceRunner.prototype.cancel = function () {
    this.cancelled = true;
    if (this.cancelCurrent) { this.cancelCurrent(); }
  };

  ConvergenceRunner.prototype.start = async function (initialTargetSizeM, suppliedSettings, modelDiagonal) {
    var settings = root.SpjutsimFEA.createConvergenceSettings(suppliedSettings);
    var levels = [];
    var stopReason = 'level-limit';
    var index;
    this.cancelled = false;
    for (index = 0; index < settings.maxLevels; index += 1) {
      if (this.cancelled) { stopReason = 'cancelled'; break; }
      var target = initialTargetSizeM * Math.pow(settings.refinementFactor, index);
      var output = null;
      this.onProgress({ level: index + 1, stage: 'meshing', targetSizeM: target });
      try {
        output = await this.prepareLevel(target, index, this);
        if (this.cancelled) { stopReason = 'cancelled'; break; }
        if (output.preflight.exceedsWasmCap) { stopReason = 'resource-limit'; break; }
        if (output.preflight.requiresEightGiBConfirmation &&
            !this.confirmHighMemory(output.preflight, index + 1)) {
          stopReason = 'high-memory-confirmation'; break;
        }
        this.onProgress({ level: index + 1, stage: 'solving', targetSizeM: target });
        output.result = await output.solve();
        var decorated = root.SpjutsimFEA.decorateResultWithTrust(output.result, output.material);
        var summary = root.SpjutsimFEA.convergenceLevelSummary(index, target, output.mesh, output.preflight, decorated);
        levels.push(summary);
        this.onLevel(summary, decorated);
        var interim = root.SpjutsimFEA.classifyConvergence(levels, 'criteria-met', settings, modelDiagonal);
        if (interim.globalConverged) { stopReason = 'criteria-met'; break; }
      } catch (error) {
        if (this.cancelled || (error.diagnostic && error.diagnostic.code === 'SOLVE_CANCELLED')) {
          stopReason = 'cancelled';
        } else if (error.diagnostic && error.diagnostic.code === 'MEMORY_LIMIT_EXCEEDED') {
          stopReason = 'resource-limit';
        } else {
          stopReason = 'failed';
        }
        this.onComplete(root.SpjutsimFEA.classifyConvergence(levels, stopReason, settings, modelDiagonal), error);
        return;
      } finally {
        if (output && output.dispose) { output.dispose(); }
        this.cancelCurrent = null;
      }
    }
    this.onComplete(root.SpjutsimFEA.classifyConvergence(levels, stopReason, settings, modelDiagonal), null);
  };

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.ConvergenceRunner = ConvergenceRunner;
}(globalThis));
