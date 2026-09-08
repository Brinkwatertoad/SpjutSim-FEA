(function (root) {
  'use strict';
  var status = document.getElementById('test-status');
  function assert(condition, message) { if (!condition) { throw new Error(message); } }
  try {
    var api = root.SpjutsimFEA;
    [[0, 'N', '0 N'], [-0, 'N', '0 N'], [-1234.567, 'N', '-1235 N'],
      [1e-12, 'N', '1e-12 N'], [1e12, 'Pa', '1e+12 Pa'], [1234567, 'MPa', '1.235 MPa'],
      [0.000012345, 'mm', '0.01235 mm']].forEach(function (item) {
      assert(api.formatResultMagnitude(item[0], item[1]) === item[2], 'incorrect magnitude: ' + item[0] + ' ' + item[1]);
    });
    assert(api.formatResultNumber(Infinity) === '∞', 'unbounded FoS was presented as a finite value');
    assert(api.formatResultNumber(-Infinity) === '−∞', 'negative infinity lost its sign');
    assert(api.formatResultNumber(NaN) === '—', 'unavailable value was formatted as an engineering number');
    var reaction = new Float64Array([1e-12, -1e-12, 0]);
    reaction.forEach(function (value) { api.formatResultMagnitude(value, 'N'); });
    assert(reaction[0] === 1e-12 && reaction[1] === -1e-12, 'formatting rounded stored reactions');
    status.textContent = 'Passed'; status.dataset.result = 'passed';
  } catch (error) { status.textContent = error.message; status.dataset.result = 'failed'; throw error; }
}(globalThis));
