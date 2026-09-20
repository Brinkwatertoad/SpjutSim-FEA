/* Shared preparation boundary: diagnostic previews are never GeometryModels. */
(function (root) {
  'use strict';
  var scales = Object.freeze({ m:1, mm:.001, cm:.01, in:.0254, ft:.3048 });
  function validRequest(r) {
    return !!(r && typeof r.sessionId === 'string' && r.sessionId && Number.isSafeInteger(r.generation) && r.generation >= 0 &&
      typeof r.sourceName === 'string' && /\.stl$/i.test(r.sourceName) && typeof r.geometryId === 'string' && r.geometryId &&
      r.sourceBytes instanceof ArrayBuffer && r.sourceBytes.byteLength > 0 && r.sourceBytes.byteLength <= 16*1024*1024 &&
      Object.prototype.hasOwnProperty.call(scales,r.lengthUnit) && Number.isFinite(r.patchAngleDegrees) && r.patchAngleDegrees>=1 && r.patchAngleDegrees<=179 &&
      Number.isFinite(r.maxHoleDiameterRatio) && r.maxHoleDiameterRatio>=0 && r.maxHoleDiameterRatio<=.05);
  }
  function vector(v) { return Array.isArray(v) && v.length===3 && v.every(Number.isFinite); }
  function bounds(b) { return b && vector(b.min) && vector(b.max) && b.min.every(function(v,i){return v<=b.max[i];}); }
  function validPreview(p) {
    if(!p || !['source','candidate'].includes(p.revision) || !(p.positions instanceof Float64Array) || p.positions.length<3 || p.positions.length>1800000 || p.positions.length%3 ||
      !(p.triangles instanceof Uint32Array) || !p.triangles.length || p.triangles.length>600000 || p.triangles.length%3 || !bounds(p.bounds))return false;
    for(var i=0;i<p.positions.length;i++)if(!Number.isFinite(p.positions[i]) || p.positions[i]<p.bounds.min[i%3] || p.positions[i]>p.bounds.max[i%3])return false;
    for(i=0;i<p.triangles.length;i++)if(p.triangles[i]>=p.positions.length/3)return false;
    return true;
  }
  function validIssues(issues, previews) {
    if(!Array.isArray(issues)||issues.length>1000)return false;
    var total=0;
    return issues.every(function(issue){
      var p=issue && previews[issue.revision];
      if(!p || typeof issue.kind!=='string' || !['fixed','proposed','unresolved'].includes(issue.status) || !bounds(issue.bounds) || !Number.isSafeInteger(issue.count)||issue.count<0)return false;
      return ['triangleIds','edgeVertexIds','vertexIds'].every(function(key){
        var ids=issue[key],limit=key==='triangleIds'?p.triangles.length/3:p.positions.length/3;
        if(!(ids instanceof Uint32Array)||key==='edgeVertexIds'&&ids.length%2)return false;
        total+=ids.length;if(total>200000)return false;
        for(var i=0;i<ids.length;i++)if(ids[i]>=limit)return false;
        return true;
      });
    });
  }
  function validDiagnostics(d,previews) {
    return !!(d && typeof d.locationsTruncated==='boolean' && typeof d.countsExact==='boolean' && d.coverage &&
      Object.values(d.coverage).every(function(s){return ['passed','failed','skipped','limit'].includes(s);}) && validIssues(d.issues,previews));
  }
  function validResult(r,sourcePreview) {
    if(!r || !['ready','needs-review','blocked'].includes(r.state)|| !/^[a-f0-9]{64}$/.test(r.sourceDigest)||!/^[a-f0-9]{64}$/.test(r.preparedDigest))return false;
    if(r.preparedSourceBytes!==null && (!(r.preparedSourceBytes instanceof ArrayBuffer)||!r.preparedSourceBytes.byteLength||r.preparedSourceBytes.byteLength>16*1024*1024))return false;
    if(r.candidatePreview!==null && !validPreview(r.candidatePreview))return false;
    var previews={source:sourcePreview,candidate:r.candidatePreview||sourcePreview};
    if(!validDiagnostics(r.diagnostics,previews)||!r.changes||!Array.isArray(r.changes.automatic)||!Array.isArray(r.changes.proposed)||!validIssues(r.changes.automatic.concat(r.changes.proposed),previews))return false;
    if(r.state==='blocked')return r.geometryCandidate===null;
    return !!(r.geometryCandidate && r.geometryCandidate.sourceMetadata.sha256===r.preparedDigest && r.validation && r.validation.status==='valid' &&
      (r.state==='needs-review')===r.shapeChanged);
  }
  root.SpjutsimFEA=root.SpjutsimFEA||{};
  Object.assign(root.SpjutsimFEA,{STL_UNIT_SCALES:scales,validateStlPreparationRequest:validRequest,
    validateStlPreview:validPreview,validateStlDiagnostics:validDiagnostics,validateStlPreparationResult:validResult});
}(globalThis));
