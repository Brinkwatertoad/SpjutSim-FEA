(function (root) {
  'use strict';
  var api = root.SpjutsimFEA;
  var office = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  var packageNs = 'http://schemas.openxmlformats.org/package/2006/relationships';
  var declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  function escape(value) {
    return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function paragraph(text, style) {
    return '<w:p>' + (style ? '<w:pPr><w:pStyle w:val="' + style + '"/></w:pPr>' : '') + '<w:r><w:t xml:space="preserve">' + escape(text) + '</w:t></w:r></w:p>';
  }
  function table(rows) {
    var columns = Math.max.apply(Math, rows.map(function (r) { return r.length; }));
    var width = Math.floor(9360 / columns);
    return '<w:tbl><w:tblPr><w:tblStyle w:val="ReportTable"/><w:tblW w:w="9360" w:type="dxa"/></w:tblPr><w:tblGrid>' +
      Array(columns).fill('<w:gridCol w:w="' + width + '"/>').join('') + '</w:tblGrid>' + rows.map(function (row, i) {
        var header = i === 0 && ['Parameter', 'Level'].indexOf(row[0]) >= 0;
        return '<w:tr>' + (header ? '<w:trPr><w:tblHeader/></w:trPr>' : '') + row.map(function (cell) {
          return '<w:tc><w:tcPr><w:tcW w:w="' + width + '" w:type="dxa"/>' + (header ? '<w:shd w:fill="E8EEF5"/>' : '') + '</w:tcPr>' + paragraph(cell) + '</w:tc>';
        }).join('') + '</w:tr>';
      }).join('') + '</w:tbl>';
  }
  // The tab-delimited report is the common content contract for both export formats.
  function textBody(text) {
    var result = '', pending = [];
    function flush() { if (pending.length) { result += table(pending); pending = []; } }
    text.split('\n').forEach(function (line, i) {
      if (line.includes('\t')) { pending.push(line.split('\t')); return; }
      flush();
      if (line) { result += paragraph(line, i === 0 ? 'Title' : /^(Results|Diagnostics|Convergence study)$/.test(line) ? 'Heading1' : null); }
    });
    flush(); return result;
  }
  var captions = {
    '01-part-loads-supports.png': 'Part with loads and supports', '02-part-mesh.png': 'Finite element mesh',
    '03-part-stress-von-mises.png': 'Von Mises stress', '04-part-factor-of-safety.png': 'Yield factor of safety',
    '05-part-deformation-auto.png': 'Deformation — Auto shape'
  };
  async function createReportDocx(text, images) {
    var body = textBody(text), relationships = '<Relationship Id="styles" Type="' + office + 'styles" Target="styles.xml"/>', media = [];
    for (var i = 0; i < images.length; i++) {
      var file = images[i], bytes = file.data instanceof Uint8Array ? file.data : new Uint8Array(await file.data.arrayBuffer());
      if (bytes.length < 24 || ![137,80,78,71,13,10,26,10].every(function (v, n) { return bytes[n] === v; })) { throw Error('Report image must be PNG.'); }
      var header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), width = header.getUint32(16), height = header.getUint32(20);
      if (!width || !height) { throw Error('Report image has invalid dimensions.'); }
      // Fit within 6.5 × 7.5 inches, preserving the canvas aspect ratio.
      var scale = Math.min(5943600 / width, 6858000 / height), cx = Math.round(width * scale), cy = Math.round(height * scale);
      var id = 'image' + (i + 1), caption = captions[file.name] || file.name;
      relationships += '<Relationship Id="' + id + '" Type="' + office + 'image" Target="media/' + escape(file.name) + '"/>';
      media.push({name: 'word/media/' + file.name, data: bytes});
      body += '<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:pageBreakBefore/></w:pPr><w:r><w:t>' + escape(caption) + '</w:t></w:r></w:p>' +
        '<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/>' +
        '<wp:docPr id="' + (i + 1) + '" name="' + escape(caption) + '" descr="' + escape(caption) + '; Reset View then Fit Model"/>' +
        '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="' + escape(file.name) + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
        '<pic:blipFill><a:blip r:embed="' + id + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
        '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
    }
    var styles = '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>' +
      '<w:style w:type="table" w:styleId="ReportTable"><w:name w:val="Report Table"/><w:tblPr><w:tblBorders>' + ['top','left','bottom','right','insideH','insideV'].map(function(edge){return '<w:' + edge + ' w:val="single" w:sz="4" w:color="C5CDD5"/>';}).join('') +
      '</w:tblBorders><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>';
    var files = [
      { name:'[Content_Types].xml', data:declaration + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
      { name:'_rels/.rels', data:declaration + '<Relationships xmlns="' + packageNs + '"><Relationship Id="document" Type="' + office + 'officeDocument" Target="word/document.xml"/></Relationships>' },
      { name:'word/document.xml', data:declaration + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="' + office.slice(0,-1) + '" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>' + body + '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>' },
      { name:'word/styles.xml', data:declaration + styles },
      { name:'word/_rels/document.xml.rels', data:declaration + '<Relationships xmlns="' + packageNs + '">' + relationships + '</Relationships>' }
    ];
    return new Blob([await api.createStoredZip(files.concat(media))], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  }
  api.createReportDocx = createReportDocx;
}(globalThis));
