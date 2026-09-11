(async function () {
  'use strict';
  var status = document.getElementById('test-status');
  function assert(value, message) { if (!value) { throw new Error(message); } }
  var options = { version:1, lengthUnit:'m', patchAngleDegrees:40, normalization:'none' };
  function reject(bytes, expected, opts) {
    var code;
    try { StlImport.parse(bytes, opts || options); } catch (error) { code = error.code; }
    assert(code === expected, 'Expected ' + expected + ', received ' + code);
  }
  try {
    assert(typeof StlImport !== 'undefined', 'Production STL adapter is unavailable');
    var records = await (await fetch('../fixtures/stl/manifest.json')).json();
    for (var fixture of records) {
      var bytes = await (await fetch('../fixtures/stl/' + fixture.file)).arrayBuffer();
      if (fixture.expected !== 'valid') { reject(bytes, fixture.expected); continue; }
      var parsed = StlImport.parse(bytes, options);
      assert(Math.abs(parsed.volume - fixture.volume) < 1e-7, fixture.file + ': volume mismatch');
      assert(parsed.validation.status === 'valid', 'Full validation must precede geometry');
      var identity = await StlImport.identify(parsed, bytes);
      var again = await StlImport.identify(StlImport.parse(bytes, options), bytes);
      assert(JSON.stringify(identity.patchIds) === JSON.stringify(again.patchIds), 'Patch identity is not deterministic');
      for (var opts of [null, {}, Object.assign({}, options,{lengthUnit:'auto'}), Object.assign({},options,{patchAngleDegrees:NaN}), Object.assign({},options,{normalization:'repair'})]) {
        var code;
        try { StlImport.parse(bytes,opts); code = null; } catch (error) { code=error.code; }
        assert(code === 'STL_INVALID_OPTIONS', 'Invalid import options were accepted');
      }
    }
    var cube = await (await fetch('../fixtures/stl/cube-binary.stl')).arrayBuffer();
    var legacy = await StlImport.identify(StlImport.parse(cube, options), cube);
    var extraFields = await StlImport.identify(StlImport.parse(cube, Object.assign({}, options,
      { surfaceMode: 'remesh', remeshFeatureAngleDegrees: 40 })), cube);
    assert(legacy.patchIds.join() === extraFields.patchIds.join(), 'Ignored version-2 fields changed legacy patch identity');
    var ascii = await (await fetch('../fixtures/stl/cube-ascii.stl')).text();
    reject(new TextEncoder().encode(ascii.replace(/facet normal [^\r\n]+/, 'facet normal bad normal tokens')).buffer, 'STL_MALFORMED');
    assert(StlImport.parse(new TextEncoder().encode(ascii.replace(/facet normal [^\r\n]+/, 'facet normal NaN Infinity -Infinity')).buffer, options).volume === 1,
      'Advisory stored normals affected the valid solid');
    var nan = cube.slice(0); new DataView(nan).setFloat32(96, NaN, true); reject(nan,'STL_NONFINITE');
    // Move one cube corner through the opposite face: closed edge topology and
    // positive signed volume are insufficient to establish a valid solid.
    var crossed = cube.slice(0), view = new DataView(crossed);
    for (var t=0;t<12;t++) for(var v=0;v<3;v++) {
      var offset=84+50*t+12+12*v;
      if(view.getFloat32(offset,true)===0 && view.getFloat32(offset+4,true)===0 && view.getFloat32(offset+8,true)===1) {
        view.setFloat32(offset,0.5,true); view.setFloat32(offset+4,0.5,true); view.setFloat32(offset+8,-0.5,true);
      }
    }
    reject(crossed,'STL_SELF_INTERSECTION');
    // Closed cubes with a common vertex have two vertex-link cycles.
    var pinched = new ArrayBuffer(84+24*50), out=new Uint8Array(pinched);out.set(new Uint8Array(cube));
    new DataView(pinched).setUint32(80,24,true);out.set(new Uint8Array(cube,84),84+12*50);
    view=new DataView(pinched);
    for(t=12;t<24;t++) for(v=0;v<3;v++) for(var axis=0;axis<3;axis++) {
      offset=84+50*t+12+12*v+4*axis;view.setFloat32(offset,view.getFloat32(offset,true)+1,true);
    }
    reject(pinched,'STL_NONMANIFOLD');
    status.textContent='Passed';status.dataset.result='passed';
  } catch(error) {status.textContent=error.message;status.dataset.result='failed';}
}());
