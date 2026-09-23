(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  // A portable package is bounded independently of the much larger solver heap cap.
  var LIMITS = Object.freeze({archive:2*1024*1024*1024, source:512*1024*1024, derived:512*1024*1024, manifest:8*1024*1024, entries:2048});
  var types = {Float64Array:Float64Array, Float32Array:Float32Array, Uint32Array:Uint32Array, Int32Array:Int32Array, Uint8Array:Uint8Array};
  function validName(name) { return /^[a-zA-Z0-9_./\[\]-]+$/.test(name) && name.split('/').every(function(p){return p && p!=='.' && p!=='..';}); }
  async function readStoredZip(blob) {
    if (!(blob instanceof Blob) || blob.size < 22 || blob.size > LIMITS.archive) { throw Error('Project archive is empty, truncated, or exceeds 2 GiB.'); }
    var end = new DataView(await blob.slice(-22).arrayBuffer());
    var count=end.getUint16(10,true), size=end.getUint32(12,true), offset=end.getUint32(16,true);
    if (end.getUint32(0,true)!==0x06054b50 || end.getUint16(4,true) || end.getUint16(6,true) || end.getUint16(8,true)!==count || end.getUint16(20,true) || !count || count>LIMITS.entries || size>LIMITS.manifest || offset+size!==blob.size-22) { throw Error('Unsupported or malformed project archive directory.'); }
    var directory=new Uint8Array(await blob.slice(offset,offset+size).arrayBuffer()), view=new DataView(directory.buffer), cursor=0, expectedOffset=0, entries=new Map();
    for(var i=0;i<count;i++) {
      if(cursor+46>size || view.getUint32(cursor,true)!==0x02014b50) { throw Error('Truncated project directory.'); }
      var flags=view.getUint16(cursor+8,true), length=view.getUint32(cursor+24,true), nameLength=view.getUint16(cursor+28,true), extra=view.getUint16(cursor+30,true), comment=view.getUint16(cursor+32,true), localOffset=view.getUint32(cursor+42,true), crc=view.getUint32(cursor+16,true);
      if(flags!==0x0800 || view.getUint16(cursor+10,true)!==0 || view.getUint32(cursor+20,true)!==length || extra || comment || view.getUint16(cursor+34,true) || cursor+46+nameLength>size || localOffset!==expectedOffset) { throw Error('Only bounded, stored project entries are supported.'); }
      var name=new TextDecoder('utf-8',{fatal:true}).decode(directory.subarray(cursor+46,cursor+46+nameLength));
      if(!validName(name) || entries.has(name) || localOffset+30+nameLength+length>offset) { throw Error('Invalid, overlapping or duplicate project entry.'); }
      var header=new DataView(await blob.slice(localOffset,localOffset+30+nameLength).arrayBuffer());
      if(header.byteLength!==30+nameLength || header.getUint32(0,true)!==0x04034b50 || header.getUint16(6,true)!==flags || header.getUint16(8,true)!==0 || header.getUint16(26,true)!==nameLength || header.getUint16(28,true) || header.getUint32(14,true)!==crc || header.getUint32(18,true)!==length || header.getUint32(22,true)!==length || new TextDecoder().decode(new Uint8Array(header.buffer,30))!==name) { throw Error('Project entry disagrees with its directory.'); }
      var data=blob.slice(localOffset+30+nameLength,localOffset+30+nameLength+length);
      entries.set(name,{blob:data,crc:crc});expectedOffset=localOffset+30+nameLength+length;cursor+=46+nameLength;
    }
    if(cursor!==size || expectedOffset!==offset) { throw Error('Unexpected project archive data.'); }
    return entries;
  }
  async function entryBytes(entries,name,limit) {
    var entry=entries.get(name);
    if(!entry || entry.blob.size>limit) { throw Error('Missing or oversized project entry: '+name); }
    var bytes=new Uint8Array(await entry.blob.arrayBuffer());
    if(await api.crc32Async(bytes)!==entry.crc) { throw Error('Damaged project entry: '+name); }
    return bytes;
  }
  function encodeBinary(value, files) {
    if(ArrayBuffer.isView(value)) {
      if(!types[value.constructor.name]) { throw Error('Unsupported project array type.'); }
      var name='cache/array-'+files.length+'.bin';
      var descriptor={$array:name,type:value.constructor.name,length:value.length};
      files.push({name:name,data:new Uint8Array(value.buffer,value.byteOffset,value.byteLength),descriptor:descriptor});
      return descriptor;
    }
    if(Array.isArray(value)) { return value.map(function(v){return encodeBinary(v,files);}); }
    if(value && typeof value==='object') { var result={};Object.keys(value).forEach(function(k){result[k]=encodeBinary(value[k],files);});return result; }
    if(typeof value==='number' && !Number.isFinite(value)) { throw Error('Nonfinite project metadata.'); }
    return value;
  }
  function validateBinaryAllocation(value,entries) {
    var total=0, seen=new Set();
    function visit(item,depth) {
      if(depth>32){throw Error('Cache metadata is too deeply nested.');}
      if(!item || typeof item!=='object'){return;}
      if(item.$array!==undefined){
        var Type=types[item.type], entry=entries.get(item.$array);
        if(!Type || !Number.isSafeInteger(item.length) || item.length<0 || !entry || entry.blob.size!==item.length*Type.BYTES_PER_ELEMENT || seen.has(item.$array) || !/^[a-f0-9]{64}$/.test(item.sha256)){throw Error('Invalid cache array allocation.');}
        seen.add(item.$array);total+=entry.blob.size;if(total>LIMITS.derived){throw Error('Saved mesh/results exceed the 512 MiB allocation limit.');}
      }else{Object.keys(item).forEach(function(key){visit(item[key],depth+1);});}
    }
    visit(value,0);
  }
  async function decodeBinary(value,entries,seen,depth) {
    if(depth>32) { throw Error('Project metadata is nested too deeply.'); }
    if(value && typeof value==='object' && value.$array!==undefined) {
      var Type=types[value.type];
      if(!Type || !Number.isSafeInteger(value.length) || value.length<0 || !/^cache\/array-\d+\.bin$/.test(value.$array) || seen.has(value.$array)) { throw Error('Invalid cache array descriptor.'); }
      seen.add(value.$array);
      var entry=entries.get(value.$array), size=value.length*Type.BYTES_PER_ELEMENT;
      if(!entry || entry.blob.size!==size) { throw Error('Truncated cache array.'); }
      var bytes=await entryBytes(entries,value.$array,LIMITS.archive);
      if(await api.projectSourceIdentity(bytes.buffer)!==value.sha256){throw Error('Cache array identity differs from its saved descriptor.');}
      return new Type(bytes.buffer);
    }
    if(Array.isArray(value)) { var list=[];for(var v of value){list.push(await decodeBinary(v,entries,seen,depth+1));}return list; }
    if(value && typeof value==='object') { var result={};for(var key of Object.keys(value)){if(['__proto__','constructor','prototype'].includes(key)){throw Error('Invalid metadata key.');}result[key]=await decodeBinary(value[key],entries,seen,depth+1);}return result; }
    return value;
  }
  async function writeProjectFile(snapshot) {
    var manifest=JSON.parse(JSON.stringify(snapshot.manifest)), files=[];
    if(snapshot.derived) {
      manifest.cache.data=encodeBinary(snapshot.derived,files);
      if(files.reduce(function(total,file){return total+file.data.byteLength;},0)>LIMITS.derived){throw Error('Mesh/results exceed 512 MiB. Save the CAD and setup without cached data.');}
      for(var file of files){file.descriptor.sha256=await api.projectSourceIdentity(file.data);}
      manifest.cache.meshFingerprint=await api.projectSourceIdentity(new TextEncoder().encode(JSON.stringify(manifest.cache.data.mesh)));
    }
    var text=JSON.stringify(manifest);
    if(new TextEncoder().encode(text).length>LIMITS.manifest || snapshot.source.sourceBytes.byteLength>LIMITS.source) { throw Error('Project metadata or CAD source exceeds portable file limits.'); }
    files.unshift({name:'manifest.json',data:text},{name:'source/cad.bin',data:new Uint8Array(snapshot.source.sourceBytes)});
    if(files.length>LIMITS.entries || files.reduce(function(n,f){return n+(typeof f.data==='string'?new TextEncoder().encode(f.data).length:f.data.byteLength)+128;},0)>LIMITS.archive) { throw Error('Project exceeds portable file limits. Save without mesh/results.'); }
    return api.createStoredZip(files);
  }
  async function readProjectFile(blob,options) {
    var entries=await readStoredZip(blob);
    var manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await entryBytes(entries,'manifest.json',LIMITS.manifest)));
    api.validateProjectManifest(manifest);
    var sourceBytes=(await entryBytes(entries,'source/cad.bin',LIMITS.source)).buffer;
    if(await api.projectSourceIdentity(sourceBytes)!==manifest.source.identity) { throw Error('The project CAD source does not match its saved identity.'); }
    var project={manifest:manifest, source:{sourceName:manifest.source.name,sourceFormat:manifest.source.format,sourceBytes:sourceBytes,faceEvidence:manifest.source.faces}};
    if(manifest.cache) {
      var loadDerived=async function(){
        try {
          if(!api.projectCacheMatchesSetup(manifest)){throw Error('Source/setup or producer no longer matches the saved cache.');}
          validateBinaryAllocation(manifest.cache.data,entries);
          if(await api.projectSourceIdentity(new TextEncoder().encode(JSON.stringify(manifest.cache.data.mesh)))!==manifest.cache.meshFingerprint){throw Error('Saved mesh fingerprint differs.');}
          project.derived=await decodeBinary(manifest.cache.data,entries,new Set(),0);
        }
        catch(error) { project.cacheWarning='Saved mesh/results could not be read: '+error.message; }
      };
      if(options && options.deferDerived){project.loadDerived=loadDerived;}else{await loadDerived();}
    }
    return project;
  }
  api.PROJECT_LIMITS=LIMITS;
  api.readStoredZip=readStoredZip;
  api.writeProjectFile=writeProjectFile;
  api.readProjectFile=readProjectFile;
}(globalThis));
