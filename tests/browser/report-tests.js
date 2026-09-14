(async function () {
  'use strict';
  function assert(ok,msg){if(!ok)throw Error(msg);}
  try {
    var api=SpjutsimFEA;
    assert(typeof api.createStoredZip==='function','ZIP export is missing');
    var zip=await api.createStoredZip([{name:'report.txt',data:'Quantity\tValue\nFoS\t∞\n'},{name:'mesh.png',data:new Uint8Array([0,1,2,255])}]);
    var bytes=new Uint8Array(await zip.arrayBuffer()),view=new DataView(bytes.buffer);
    assert(view.getUint32(0,true)===0x04034b50 && view.getUint16(8,true)===0,'ZIP header or storage method wrong');
    assert(view.getUint16(bytes.length-12,true)===2 && view.getUint32(bytes.length-22,true)===0x06054b50,'ZIP directory missing');
    // Known IEEE CRC-32 vector, independent of ZIP implementation.
    var check=new DataView(await(await api.createStoredZip([{name:'check',data:'123456789'}])).arrayBuffer());
    assert(check.getUint32(14,true)===0xcbf43926,'ZIP CRC-32 wrong');
    var rejected=false;try{await api.createStoredZip([{name:'../bad',data:'x'}]);}catch(e){rejected=true;}assert(rejected,'ZIP traversal accepted');
    var state={results:{analysisRevision:2,factorOfSafety:null},analysisRevision:2};
    assert(api.canExportReport(state),'Solved state rejected');
    assert(!api.canExportReport(Object.assign({},state,{assignmentDraft:{}})),'Pending edit exported');
    assert(!api.canExportReport(Object.assign({},state,{analysisRevision:3})),'Stale result exported');
    assert(!api.canExportReport(Object.assign({},state,{meshGeneration:{status:'generating'}})),'Running mesh exported');
    var views=api.reportViewPresets(state,123);
    assert(views.length===4&&!views.some(function(v){return v.presentation.field==='factorOfSafety';}),'Unavailable FoS exported');
    state.results.factorOfSafety={};views=api.reportViewPresets(state,123);
    assert(views.length===5&&views[4].presentation.deformationScale===123&&views[4].presentation.deformationMode==='auto','Auto deformation preset missing');
    assert(views[0].presentation.showLoads&&views[0].presentation.showSupports&&!views[2].presentation.showLoads,'Assignment visibility wrong');
    window.reportTestZip=zip;
    document.getElementById('test-status').textContent='Passed';
  }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;}
}());
