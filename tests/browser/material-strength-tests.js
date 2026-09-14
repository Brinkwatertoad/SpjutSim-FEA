(function () {
  'use strict';
  var api = SpjutsimFEA;
  function assert(ok, message) { if (!ok) { throw Error(message); } }
  try {
    var catalog = new api.MaterialCatalog();
    var pla = catalog.get('factory.material.polymer.pla');
    var abs = catalog.get('factory.material.polymer.abs');
    assert(pla.material.tensileYieldPa === 62e6 && pla.material.compressiveYieldPa === 70.8e6, 'PLA bulk yield defaults missing');
    assert(abs.material.compressiveYieldPa === 46.1e6, 'ABS bulk compressive yield missing');
    assert(api.selectYieldStrength(pla.material).valuePa === 62e6, 'PLA FoS must use lower yield');
    assert(api.selectYieldStrength(abs.material).valuePa === 26.84e6, 'Existing ABS tensile yield must remain controlling');
    ['tensileYieldPa','compressiveYieldPa'].forEach(function (key) {
      assert(pla.metadata.fieldProvenance[key].url.startsWith('https://'), 'PLA yield provenance missing');
    });
    assert(abs.metadata.fieldProvenance.compressiveYieldPa.url.startsWith('https://'), 'ABS yield provenance missing');
    pla.material.tensileYieldPa = 1;
    assert(catalog.materialSnapshot(pla.id).tensileYieldPa === 62e6, 'Editing snapshot mutated factory');
    document.getElementById('test-status').textContent = 'Passed';
  } catch (e) { document.getElementById('test-status').textContent = 'Failed: ' + e.message; }
}());
