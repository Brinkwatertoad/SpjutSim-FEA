(function (root) {
  'use strict';
  /** Normalized positions run from the high end (top/right) to the low end. */
  function buildLegendTicks(range, orientation, height) {
    var count = orientation === 'horizontal' ? 2 : Math.max(2, Math.min(7, Math.floor(height / 44) + 1));
    var ticks = [];
    for (var i = 0; i < count; i += 1) {
      ticks.push({position: i / (count - 1), value: range.maximum * (1 - i / (count - 1)) + range.minimum * (i / (count - 1))});
    }
    return ticks;
  }
  function resultFieldDefinition(field, presentation) {
    var stressUnit = presentation.stressUnit || 'MPa', lengthUnit = presentation.lengthUnit || 'mm';
    var scales = root.SpjutsimFEA.RESULT_UNIT_SCALES;
    var stressScale = scales[stressUnit], lengthScale = scales[lengthUnit];
    var definitions = {
      vonMises:['von Mises',stressUnit,stressScale], maxPrincipal:['Max principal (smoothed)',stressUnit,stressScale],
      minPrincipal:['Min principal (smoothed)',stressUnit,stressScale], factorOfSafety:['Yield FoS (smoothed)','',1],
      displacementMagnitude:['Displacement',lengthUnit,lengthScale], ux:['Ux',lengthUnit,lengthScale], uy:['Uy',lengthUnit,lengthScale], uz:['Uz',lengthUnit,lengthScale]
    };
    return definitions[field];
  }
  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.resultFieldDefinition = resultFieldDefinition;
  root.SpjutsimFEA.buildLegendTicks = buildLegendTicks;
}(globalThis));
