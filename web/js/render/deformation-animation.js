(function (root) {
  'use strict';
  var PERIOD_MS = 2400;
  function deformationAnimationMultiplier(elapsedMs) {
    var elapsed = Number.isFinite(Number(elapsedMs)) ? Number(elapsedMs) : 0;
    var phase = ((elapsed % PERIOD_MS) + PERIOD_MS) % PERIOD_MS;
    return 0.5 + 0.5 * Math.cos(phase / PERIOD_MS * Math.PI * 2);
  }
  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.DEFORMATION_ANIMATION_PERIOD_MS = PERIOD_MS;
  root.SpjutsimFEA.deformationAnimationMultiplier = deformationAnimationMultiplier;
}(globalThis));
