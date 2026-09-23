(function (root) {
  'use strict';
  var api = root.SpjutsimFEA = root.SpjutsimFEA || {};
  var crcTable = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var bit = 0; bit < 8; bit++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
    crcTable[n] = c;
  }
  function crc32(bytes) {
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) { crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8); }
    return (crc ^ 0xffffffff) >>> 0;
  }
  async function crc32Async(bytes) {
    var crc = 0xffffffff;
    for (var start = 0; start < bytes.length; start += 4 * 1024 * 1024) {
      var end = Math.min(bytes.length, start + 4 * 1024 * 1024);
      for (var i = start; i < end; i++) { crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8); }
      if (end < bytes.length) { await new Promise(function(resolve){root.setTimeout(resolve,0);}); }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  // Stored ZIP entries: PNG already compresses the large payloads. No runtime dependency.
  async function createStoredZip(files) {
    if (!files.length || files.length > 65535) { throw Error('Invalid archive file count.'); }
    var encoder = new TextEncoder(), parts = [], directory = [], offset = 0, directorySize = 0, names = new Set();
    for (var file of files) {
      if ((typeof file.name !== 'string' || !/^[a-zA-Z0-9_./\[\]-]+$/.test(file.name) || file.name.split('/').some(function (part) { return !part || part === '.' || part === '..'; })) || names.has(file.name)) { throw Error('Invalid or duplicate archive filename.'); }
      names.add(file.name);
      var name = encoder.encode(file.name);
      var bytes = typeof file.data === 'string' ? encoder.encode(file.data) : file.data instanceof Uint8Array ? file.data : new Uint8Array(await file.data.arrayBuffer());
      if (name.length > 65535 || bytes.length > 0xffffffff || offset + 30 + name.length + bytes.length > 0xffffffff) { throw Error('Archive exceeds ZIP size limits.'); }
      var checksum = await crc32Async(bytes), local = new Uint8Array(30 + name.length), header = new DataView(local.buffer);
      header.setUint32(0, 0x04034b50, true); header.setUint16(4, 20, true); header.setUint16(6, 0x0800, true);
      header.setUint16(12, 33, true); // 1980-01-01; deterministic archive metadata.
      header.setUint32(14, checksum, true); header.setUint32(18, bytes.length, true); header.setUint32(22, bytes.length, true);
      header.setUint16(26, name.length, true); local.set(name, 30);
      var central = new Uint8Array(46 + name.length), entry = new DataView(central.buffer);
      entry.setUint32(0, 0x02014b50, true); entry.setUint16(4, 20, true); entry.setUint16(6, 20, true); entry.setUint16(8, 0x0800, true);
      entry.setUint16(14, 33, true); entry.setUint32(16, checksum, true); entry.setUint32(20, bytes.length, true); entry.setUint32(24, bytes.length, true);
      entry.setUint16(28, name.length, true); entry.setUint32(42, offset, true); central.set(name, 46);
      parts.push(local, file.data instanceof Blob ? file.data : bytes); directory.push(central); directorySize += central.length; offset += local.length + bytes.length;
    }
    if (offset + directorySize + 22 > 0xffffffff) { throw Error('Archive exceeds ZIP size limits.'); }
    var end = new Uint8Array(22), endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, files.length, true); endView.setUint16(10, files.length, true);
    endView.setUint32(12, directorySize, true); endView.setUint32(16, offset, true);
    return new Blob(parts.concat(directory, [end]), { type: 'application/zip' });
  }
  api.crc32 = crc32;
  api.crc32Async = crc32Async;
  api.createStoredZip = createStoredZip;
}(globalThis));
