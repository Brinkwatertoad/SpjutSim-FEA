(function (root) {
  'use strict';
  var api = root.SpjutsimFEA = root.SpjutsimFEA || {};
  var fields = ['vonMises', 'factorOfSafety', 'maxPrincipal', 'minPrincipal', 'displacementMagnitude', 'ux', 'uy', 'uz'];
  /** Color limits are SI values owned by one field; numerical result ranges stay untouched. */
  function validateColorRange(range, field) {
    if (!range || range.field !== field) { return { mode: 'automatic', field: field, locked: false }; }
    if (fields.indexOf(field) < 0 || ['automatic', 'manual'].indexOf(range.mode) < 0) { throw new Error('Choose Automatic or Manual range.'); }
    var bounded = range.mode === 'manual' || range.locked === true;
    if (bounded && (!Number.isFinite(range.minimum) || !Number.isFinite(range.maximum) ||
        range.minimum > range.maximum || (range.mode === 'manual' && range.minimum === range.maximum))) {
      throw new Error('Enter finite limits with minimum below maximum.');
    }
    return Object.assign({ mode: range.mode, field: field, locked: range.locked === true },
      bounded ? { minimum: range.minimum, maximum: range.maximum } : {});
  }
  function resolveColorRange(result, presentation) {
    var automatic = api.getResultDisplayRange(result, presentation.field);
    var range = presentation.colorRange;
    if (!range || range.field !== presentation.field || (range.mode !== 'manual' && !range.locked)) { return automatic; }
    return { minimum: range.minimum, maximum: range.maximum,
      clipped: automatic.minimum < range.minimum || automatic.maximum > range.maximum || automatic.clipped === true };
  }
  api.validateColorRange = validateColorRange;
  api.resolveColorRange = resolveColorRange;
}(globalThis));
