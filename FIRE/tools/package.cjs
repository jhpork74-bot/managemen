const fs=require('fs'),path=require('path'),crypto=require('crypto');
const source=path.resolve(__dirname,'..'),target=path.resolve(source,'../FIRE');
fs.mkdirSync(target,{recursive:true});
const files=['Index.html','Maps.html','Engine3D.html','Code.gs','appsscript.json','README.md','사용안내.md','기존배포-업데이트.txt','preview.html','data/maps.json','data/floor1-faces.json','data/floor2-faces.json','assets/firefighter-119-transparent.png','assets/character-transparent-prompt.txt','tools/build.cjs','tools/serve.cjs','tools/test.cjs','tools/test-server.cjs','tools/extract.ps1','tools/package.cjs'];
const hashes={};for(const file of files){const dest=path.join(target,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(source,file),dest);hashes[file]=crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex');}
fs.writeFileSync(path.join(target,'SHA256SUMS.json'),JSON.stringify(hashes,null,2));
fs.writeFileSync(path.join(target,'VALIDATION.json'),JSON.stringify({version:'FIRE-3D-1.0',wallHeightMeters:2.8,cellMeters:.25,localLogicTests:true,mockedGoogleTests:true,webGLBrowserRendered:true,fireOnlySmokeLogicTest:true,editedGridGeometryTest:true,googleDeploymentTested:false,physicalMobileTested:false,notes:'WebGL scene uses a simplified firefighter mesh. Procedural material textures and visual smoke; not a physical fire simulation. User-specific browser map settings are not bundled.'},null,2));
console.log('Packaged '+files.length+' source files into '+target);
