const fs=require('fs'),vm=require('vm'),assert=require('assert'),read=f=>fs.readFileSync(__dirname+'/'+f,'utf8');
const c=vm.createContext({Map,Promise});vm.runInContext(read('asset-photo-loader.js'),c);
(async()=>{
 let active=0,maximum=0,calls=0;const waiting=[];
 const loader=c.createAssetPhotoLoader((id,ref)=>new Promise(resolve=>{active++;calls++;maximum=Math.max(maximum,active);waiting.push(()=>{active--;resolve('image:'+ref)})}),new Map(),2,3);
 const a=loader.load('a','r1'),dup=loader.load('a','r1'),b=loader.load('b','r2'),d=loader.load('c','r3'),e=loader.load('d','r4');assert.strictEqual(a,dup);
 await new Promise(r=>setImmediate(r));assert.equal(calls,2);assert.equal(active,2);
 while(waiting.length||active){for(const f of waiting.splice(0))f();await new Promise(r=>setImmediate(r))}
 const results=await Promise.all([a,b,d,e]);assert.equal(results[0],'image:r1');assert.equal(calls,4);assert.equal(maximum,2);assert.equal(loader.cache.size,3);assert(!loader.cache.has('r1'));
 assert.equal(await loader.load('d','r4'),'image:r4');assert.equal(calls,4);
 let failures=0;const retry=c.createAssetPhotoLoader(()=>{failures++;return failures===1?Promise.reject(Error('denied')):Promise.resolve('ok')});await assert.rejects(retry.load('x','ref'),/denied/);await new Promise(r=>setImmediate(r));assert.equal(await retry.load('x','ref'),'ok');assert.equal(failures,2);
 const ui=read('AssetManagementUI.html');assert(ui.includes('제품사진'));assert(ui.includes('data-asset-register'));assert(ui.includes('>등록</button>'));assert(ui.includes('>변경</button>'));assert(ui.includes('IntersectionObserver'));assert(ui.includes('button.isConnected'));assert(ui.includes("current?.photo!==ref"));
 for(const m of ui.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(m[1]);
 console.log('PASS product photos: bounded two-request private photo queue; duplicate coalescing; 40-entry runtime/3-entry test LRU; failure retry; photo caption and register/change buttons; lazy visibility and stale DOM/ref guards; HTML script syntax.');
 fs.writeFileSync(__dirname+'/제품사진_검증.json',JSON.stringify({date:'2026-10-31',passed:true,scope:'Queue concurrency/dedup/cache/failure tests and built UI syntax. Real Google Drive unchanged; browser UI verification recorded separately.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
