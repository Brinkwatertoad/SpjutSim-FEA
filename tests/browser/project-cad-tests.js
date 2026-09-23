(function(){
  function assert(v,m){if(!v)throw Error(m);}
  document.getElementById('application-frame').addEventListener('load',async function(){
    var win=this.contentWindow,api=win.SpjutsimFEA,client,solver,records=[];
    try{
      for(var format of ['step','iges','brep']){
        var name='generated-unit-cube-m.'+format, bytes=await (await fetch('../fixtures/'+name)).arrayBuffer();
        bytes=win.Uint8Array.from(new Uint8Array(bytes)).buffer;
        client=new api.MesherClient();var geometry=await client.importGeometry({geometryId:'project-'+format,sourceName:name,sourceFormat:format,sourceBytes:bytes});client.dispose();
        var app=new api.AppController({document:api.createAnalysisDocument()});app.replaceGeometry(geometry,{sourceName:name,sourceFormat:format,sourceBytes:bytes});
        app.replaceMaterial({youngsModulusPa:1e9,poissonsRatio:0.25,densityKgM3:1000});app.replaceMeshSettings({preset:'coarse',elementType:'tet10'});
        for(var axis=0;axis<3;axis++){
          var face=geometry.faceIds.find(id=>api.analyzeGeometryFaceNormal(geometry,id).normal[axis]<-0.99),components={};components['xyz'[axis]]=0;
          app.replaceSelectedFaces([face]);app.createBoundaryCondition({type:'support',componentsM:components});
        }
        app.replaceSelectedFaces([geometry.faceIds.find(id=>api.analyzeGeometryFaceNormal(geometry,id).normal[0]>0.99)]);app.createLoad({type:'total-force',forceN:[1000,0,0]});
        if(format!=='step'){app.rotateGeometryAroundGlobalAxis('z',37);app.rotateGeometryAroundGlobalAxis('x',19);}
        var started=performance.now(),snapshot=await api.createProjectSnapshot(app),blob=await api.writeProjectFile(snapshot),saveMs=performance.now()-started;
        var fresh=new api.AppController({document:api.createAnalysisDocument()});await new api.ProjectWorkflow(fresh).open(blob);
        assert(fresh.document.loads[0].forceN[0]===1000 && fresh.document.boundaryConditions.length===3,'Lost physical setup for '+format);
        assert(JSON.stringify(fresh.document.geometry.orientation)===JSON.stringify(app.document.geometry.orientation),'Orientation changed for '+format);
        var again=await api.writeProjectFile(await api.createProjectSnapshot(fresh));await new api.ProjectWorkflow(fresh).open(again);
        assert(fresh.document.loads[0].faceIds[0]===app.document.loads[0].faceIds[0],'Second round trip changed face identity for '+format);
        if(format==='step'){
          client=new api.MesherClient();fresh.beginMeshGeneration();fresh.completeMeshGeneration(await client.generateMesh({geometry:fresh.document.geometry,settings:fresh.document.meshSettings,sourceBytes:fresh.geometrySource.sourceBytes}));client.dispose();
          solver=new api.SolverClient();var revision=fresh.beginSolvePreflight();fresh.completeSolvePreflight(revision,await solver.preflight(api.prepareSolverInput(fresh.document),revision));fresh.beginSolve();fresh.completeSolve(revision,await solver.solve(revision,fresh.document.solveSettings,true));solver.dispose();
          assert(Math.abs(fresh.document.results.extrema.rawVonMisesMax.valuePa-1000)<0.2,'Reopened STEP missed 1 kPa analytical axial stress');
          assert(Math.abs(fresh.document.results.equilibrium.totalReactionN[0]+1000)<0.001,'Reopened STEP missed force balance');
        }
        records.push({format:format,sourceBytes:bytes.byteLength,projectBytes:blob.size,saveMs:saveMs,totalMs:performance.now()-started});
      }
      var canvas=win.document.createElement('canvas');canvas.style.cssText='position:fixed;left:0;top:0;width:480px;height:320px';win.document.body.appendChild(canvas);var viewport=new api.ViewportController(canvas);
      try{
        for(var fixture of ['generated-cylinder-r0_5-h1-m.step','cad-corpus/through-hole.step']){
          var raw=await (await fetch('../fixtures/'+fixture)).arrayBuffer(),cad=win.Uint8Array.from(new Uint8Array(raw)).buffer;
          client=new api.MesherClient();var shape=await client.importGeometry({geometryId:fixture,sourceName:'part.step',sourceFormat:'step',sourceBytes:cad});client.dispose();viewport.setGeometryPreview(shape);
          if(fixture.startsWith('generated-cylinder')){assert(Math.abs(shape.volumeM3-Math.PI*0.25)<1e-10,'Actual cylinder CAD volume missed analytical value');}
          var point, hits, found=false, rect=canvas.getBoundingClientRect();
          for(var range of shape.preview.faceRanges){
            var center=new win.THREE.Vector3();for(var vertex=0;vertex<3;vertex++){center.add(new win.THREE.Vector3().fromArray(shape.preview.positionsM,shape.preview.indices[range.start+vertex]*3));}center.multiplyScalar(1/3).project(viewport.camera);
            point={clientX:rect.left+(center.x+1)*rect.width/2,clientY:rect.top+(1-center.y)*rect.height/2};hits=viewport.pickFacesAtPointer(point);
            if(hits.length>1){found=true;break;}
          }
          assert(found,'No obscured face accessible on '+fixture);viewport.setHiddenFaceIds([hits[0]]);assert(viewport.pickFaceAtPointer(point)===hits[1],'Hidden curved face intercepted selection');viewport.setHiddenFaceIds([]);
          var pickingStart=performance.now();for(var pick=0;pick<100;pick++){viewport.pickFacesAtPointer(point);}
          records.push({fixture:fixture,faces:shape.faceIds.length,triangles:shape.preview.indices.length/3,picks:100,pickingMs:performance.now()-pickingStart});
        }
      }finally{viewport.dispose();canvas.remove();}
      window.projectCadEvidence=records;document.getElementById('test-status').textContent='Passed';
    }catch(e){document.getElementById('test-status').textContent='Failed: '+e.message;console.error(e);}finally{if(client)client.dispose();if(solver)solver.dispose();}
  });
}());
