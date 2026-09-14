(async function () {
  function assert(ok, message) { if (!ok) throw Error(message); }
  try {
    var api = SpjutsimFEA, png = new Uint8Array(24); png.set([137,80,78,71,13,10,26,10]);
    new DataView(png.buffer).setUint32(16,800); new DataView(png.buffer).setUint32(20,600);
    var blob = await api.createReportDocx('SpjutSim FEA analysis report\n\nFile\tA & <B>.step\n\nResults\nParameter\tValue\nFoS\t∞\n', [{name:'01-part-loads-supports.png',data:png}]);
    assert(blob.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document','Wrong MIME');
    var bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer), entries = {}, at=0;
    while (view.getUint32(at,true)===0x04034b50) {
      var size=view.getUint32(at+18,true), len=view.getUint16(at+26,true), start=at+30+len;
      entries[new TextDecoder().decode(bytes.slice(at+30,start))]=bytes.slice(start,start+size);at=start+size;
    }
    ['[Content_Types].xml','_rels/.rels','word/document.xml','word/styles.xml','word/_rels/document.xml.rels','word/media/01-part-loads-supports.png'].forEach(function(name){assert(entries[name],name+' missing');});
    Object.keys(entries).filter(function(name){return /xml$|rels$/.test(name);}).forEach(function(name){
      var xml=new DOMParser().parseFromString(new TextDecoder().decode(entries[name]),'application/xml');
      assert(!xml.querySelector('parsererror'),'Invalid XML '+name);
    });
    var xml = new TextDecoder().decode(entries['word/document.xml']);
    assert(xml.includes('A &amp; &lt;B&gt;.step') && xml.includes('∞'),'Escaping/unicode lost');
    assert((xml.match(/<w:tbl>/g)||[]).length===2 && xml.includes('r:embed="image1"'),'Editable tables/image missing');
    assert(xml.includes('cx="5943600" cy="4457700"'),'Image aspect ratio changed');
    for (var name of ['../bad','word/../bad','/absolute','word//bad','word\\bad','word/./bad']) {
      var rejected=false;try{await api.createStoredZip([{name:name,data:'x'}]);}catch(e){rejected=true;}assert(rejected,'Unsafe ZIP path accepted '+name);
    }
    window.docxTestBlob=blob;
    document.getElementById('test-status').textContent='Passed';
  } catch(e) { document.getElementById('test-status').textContent='Failed: '+e.message; }
}());
