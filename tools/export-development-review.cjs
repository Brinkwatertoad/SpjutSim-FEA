#!/usr/bin/env node
// Optional test tooling. Export portable setup projects and numerical evidence.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const {chromium}=require(process.env.FEA_PLAYWRIGHT_MODULE||path.join(root,'build/verification-tools/node_modules/playwright'));
const output=path.resolve(root,process.argv[2]||'docs/reviews/fixtures/36-38');
async function main(){
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.FEA_CHROMIUM_PATH||path.join(root,'build/operator-tools/chrome-full/chrome-linux64/chrome'),headless:true,args:['--no-sandbox','--allow-file-access-from-files','--enable-unsafe-swiftshader']});
 const evidence={browser:await browser.version(),mode:'file://',headless:true,solverRuntimeSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'web/wasm/fem/fem.js'))).digest('hex'),cases:[]};
 try{
  for(const name of ['bearing-load','moment-load']){
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.join(root,'tests/browser/'+name+'-tests.html')).href+'?review=1');
   await page.waitForFunction(()=>/^(Passed|Failed)/.test(document.getElementById('test-status').textContent),null,{timeout:300000});
   const status=await page.locator('#test-status').textContent();if(!status.startsWith('Passed')||errors.length)throw Error(status+' '+errors.join('; '));
   const packet=await page.evaluate(async()=>{
    const api=SpjutsimFEA;
    async function project(app,name){app.document.projectMetadata={name:name,reportOptions:null};return Array.from(new Uint8Array(await(await api.writeProjectFile(await api.createProjectSnapshot(app))).arrayBuffer()));}
    const files=[{name:window.__spjutsimSurfaceReference?'bearing-hole.spjutsim-fea':'torsion-shaft.spjutsim-fea',bytes:await project(window.__spjutsimReviewApp,'Development review')}];
    if(window.__spjutsimOffsetReviewApp)files.push({name:'offset-cantilever.spjutsim-fea',bytes:await project(window.__spjutsimOffsetReviewApp,'Offset cantilever')});
    return {files,evidence:window.__spjutsimUsabilityEvidence,reference:window.__spjutsimSurfaceReference||null};
   });
   for(const f of packet.files)fs.writeFileSync(path.join(output,f.name),Buffer.from(f.bytes));
   evidence.cases.push({name,status,evidence:packet.evidence});
   if(packet.reference)fs.writeFileSync(path.join(output,'bearing-reference-input.json'),JSON.stringify(packet.reference)+'\n');
   if(name==='moment-load'){
    const bracket=await page.evaluate(async()=>{
     const api=SpjutsimFEA,mesher=new api.MesherClient();let geometry,bytes;
     try{bytes=await(await fetch('../fixtures/cad-corpus/mixed-boss.step')).arrayBuffer();geometry=await mesher.importGeometry({geometryId:'review-bracket',sourceName:'asymmetric-boss-bracket.step',sourceFormat:'step',sourceBytes:bytes});}
     finally{mesher.dispose();}
     const app=new api.AppController({document:api.createAnalysisDocument()});app.replaceGeometry(geometry,{sourceName:geometry.sourceName,sourceFormat:'step',sourceBytes:bytes});app.replaceMaterial({name:'Review material',youngsModulusPa:1e9,poissonsRatio:.25,densityKgM3:1000,tensileYieldPa:250e6});
     const fixed=geometry.faceIds.find(id=>geometry.planarFaces[id]&&geometry.planarFaces[id].normal[0]<-.99),cap=geometry.faceIds.find(id=>geometry.planarFaces[id]&&geometry.planarFaces[id].normal[2]>.99&&geometry.planarFaces[id].originM[2]>.39);
     app.replaceSelectedFaces([fixed]);app.createBoundaryCondition({type:'support',componentsM:{x:0,y:0,z:0}});app.rotateGeometryAroundGlobalAxis('z',23);app.replaceSelectedFaces([cap]);
     const rotation=app.document.geometry.orientation.rotation,reference=api.transformVector3(rotation,[.75,.4,.4]),application=api.transformVector3(rotation,[1.2,.4,.4]);
     app.createLoad({name:'Offset boss force',type:'offset-force',forceN:[0,0,-100],frame:api.planarFaceFrame(app.document.geometry,cap),referencePointM:reference,applicationPointM:application});app.replaceMeshSettings({preset:'custom',minSizeM:.015,maxSizeM:.09,elementType:'tet10'});
     app.document.projectMetadata={name:'Asymmetric bracket with local offset load',reportOptions:null};
     const wrench=api.resolveSurfaceWrench(app.document.loads[0],app.document.geometry);
     return {bytes:Array.from(new Uint8Array(await(await api.writeProjectFile(await api.createProjectSnapshot(app))).arrayBuffer())),volumeM3:geometry.volumeM3,massKg:geometry.volumeM3*1000,wrench};
    });
    fs.writeFileSync(path.join(output,'asymmetric-bracket.spjutsim-fea'),Buffer.from(bracket.bytes));delete bracket.bytes;evidence.cases.push({name:'asymmetric-bracket',evidence:bracket});
   }
   await page.close();console.log(name+': exported review projects');
  }
 }finally{await browser.close();}
 fs.writeFileSync(path.join(output,'expected-values.json'),JSON.stringify(evidence,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
