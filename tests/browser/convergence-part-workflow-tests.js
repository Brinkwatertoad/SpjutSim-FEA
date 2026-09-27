(function(){
  'use strict';
  var frame=document.getElementById('application-frame');
  function assert(value,message){if(!value)throw Error(message);}
  function wait(test){return new Promise((resolve,reject)=>{
    var start=performance.now();function poll(){try{if(test())return resolve();if(performance.now()-start>240000)throw Error('Part mesh-check timeout');setTimeout(poll,40);}catch(error){reject(error);}}poll();
  });}
  frame.addEventListener('load',async function(){
    var win=frame.contentWindow,doc=win.document,app,client;
    try{
      await wait(()=>doc.getElementById('app-status').textContent==='Local runtime ready');
      var api=win.SpjutsimFEA,notify=api.AppController.prototype.notify;
      api.AppController.prototype.notify=function(){app=this;return notify.apply(this,arguments);};
      doc.getElementById('load-example').click();await wait(()=>app && app.document.geometry && !doc.querySelector('[data-ui-menu-action="example-cube"]').disabled);
      client=new api.MesherClient();var source={geometryId:'leg-part',sourceName:'Part Studio 1 - Part 1.step',sourceFormat:'step',sourceBytes:await(await win.fetch('../tests/fixtures/cad-corpus/Part Studio 1 - Part 1.step')).arrayBuffer()};
      var geometry=await client.importGeometry(source);client.dispose();client=null;app.replaceGeometry(geometry,source);
      app.replaceMaterial({name:'Steel',youngsModulusPa:200e9,poissonsRatio:0.3,tensileYieldPa:250e6});
      var feet=geometry.faceIds.filter(id=>geometry.planarFaces[id]?.normal[2]<-0.99 && Math.abs(geometry.planarFaces[id].originM[2])<1e-8);
      var top=geometry.faceIds.find(id=>geometry.planarFaces[id]?.normal[2]>0.99);
      assert(feet.length===4 && top,'Test did not identify all feet/top');
      app.replaceSelectedFaces(feet);app.createBoundaryCondition({type:'support',componentsM:{x:0,y:0,z:0}});
      app.replaceSelectedFaces([top]);app.createLoad({type:'total-force',forceN:[0,0,-100]});app.clearSelectedFaces();
      app.replaceMeshSettings({preset:'custom',elementType:'tet10',minSizeM:.002,maxSizeM:.008});
      var setup=JSON.stringify([app.document.boundaryConditions,app.document.loads]),revision=app.document.analysisRevision;
      doc.getElementById('setup-guide-dismiss').click();doc.getElementById('solve-button').click();await wait(()=>app.document.results);
      revision=app.document.analysisRevision;var levels=[api.currentConvergenceBaseline(app.document)];
      for(var index=0;index<2;index++){
        doc.getElementById('quick-mesh-check-button').click();await wait(()=>app.document.convergenceStudy && app.document.convergenceStudy.status!=='running');
        var study=app.document.convergenceStudy;assert(study.status==='completed' && study.levels.length===2,'Quick check failed: '+doc.getElementById('convergence-status').textContent);
        assert(study.levels[1].degreeOfFreedomCount>study.levels[0].degreeOfFreedomCount,'Refinement did not increase mesh resolution');
        levels.push(study.levels[1]);
        assert(app.document.results.equilibrium.relativeResidual<1e-6,'Refined solve violates force balance');
      }
      assert(app.document.geometry===geometry && app.document.analysisRevision===revision && JSON.stringify([app.document.boundaryConditions,app.document.loads])===setup,'Mesh checking changed CAD or assignments');
      doc.getElementById('review-convergence-button').click();
      var host=doc.getElementById('convergence-plot');assert(host.querySelectorAll('svg').length===3,'Real workflow did not display separate charts');
      var changes=app.document.convergenceStudy.classification.changes;
      assert(host.textContent.includes(api.formatResultNumber(changes.rawVonMisesMax*100)+'%'),'Stress chart does not show the computed percentage change');
      assert(host.textContent.includes('design requirements separately'),'Mesh thresholds confused with design limits');
      var pane=doc.getElementById('convergence-summary');assert(Array.from(host.querySelectorAll('svg')).every(svg=>svg.getBoundingClientRect().width<=pane.getBoundingClientRect().width),'Charts overflow the results pane');
      window.__spjutsimConvergenceEvidence={levels:levels,classification:app.document.convergenceStudy.classification,geometryUnchanged:true,displayedText:host.textContent};
      doc.getElementById('start-convergence-button').click();await wait(()=>app.document.convergenceStudy.status!=='running');
      var full=app.document.convergenceStudy;
      assert(full.status==='completed' && full.levels.length===4 && full.stopReason==='level-limit','Full study did not continue through unresolved stress to the four-mesh limit');
      var earlier=api.classifyConvergence(full.levels.slice(0,3),'criteria-met',full.settings);
      assert(earlier.globalConverged && !earlier.stressStable,'Fixture no longer exercises globally stable but stress-unresolved continuation');
      assert(doc.getElementById('convergence-status').textContent.includes('Strength assessment remains unresolved'),'Full study did not explain unresolved strength at its limit');
      assert(api.createReportText(app.document,source.sourceName,1).includes('Strength assessment remains unresolved'),'Report concealed the unresolved stress stop');
      assert(app.document.geometry===geometry && app.document.analysisRevision===revision && JSON.stringify([app.document.boundaryConditions,app.document.loads])===setup,'Full study changed geometry or assignments');
      window.__spjutsimConvergenceEvidence.fullStudy={levels:full.levels,classification:full.classification,statusText:doc.getElementById('convergence-status').textContent};
      document.getElementById('test-status').textContent='Passed';
    }catch(error){document.getElementById('test-status').textContent='Failed: '+error.message;console.error(error);}finally{if(client)client.dispose();}
  });frame.src='../../web/index.html';
}());
