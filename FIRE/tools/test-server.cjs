const fs=require('fs'),vm=require('vm'),assert=require('assert');
const sheets=new Map(),props=new Map([['SHEET_ID','test']]);
function sheet(name){if(!sheets.has(name))sheets.set(name,{rows:name==='Sessions'?[['id','name','start','limit','done']]:[],getDataRange(){return {getValues:()=>this.rows};},appendRow(r){this.rows.push(r);},getRange(a,b){return {getValue:()=>this.rows[1]?.[1]||'',setValue:v=>{this.rows[a-1][b-1]=v;},setValues:vs=>{if(a==='A2:B2')this.rows[1]=vs[0];}};}});return sheets.get(name);}
const env={console,Date,JSON,Number,String,Array,Utilities:{getUuid:()=>Math.random().toString(36)},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)})},SpreadsheetApp:{openById:()=>({getSheetByName:sheet})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})}};
vm.createContext(env);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../Code.gs'),'utf8'),env);
const c={spawn:{f:0,x:5,y:5},stairs:[{f:0,x:6,y:6},{f:1,x:6,y:6}],extinguishers:[{f:0,x:7,y:7}],limit:180,edits:[],rooms:[{f:0,x:4,y:4,name:'프로그램실'}]};
assert.equal(env.saveConfig(c),true);assert.deepEqual(env.getConfig(),c);
const s=env.startSession('=IMPORTXML("x")');assert.ok(s.id);assert.ok(sheet('Sessions').rows[1][1].startsWith("'="));
const result=env.finishSession(s.id,true);assert.equal(result.result,'완료');assert.equal(sheet('Records').rows.length,1);assert.throws(()=>env.finishSession(s.id,true));
const t=env.startSession('timeout');sheet('Sessions').rows[2][2]=Date.now()-200000;assert.equal(env.finishSession(t.id,true).result,'시간초과');
assert.throws(()=>env.saveConfig({...c,stairs:[c.stairs[1],c.stairs[0]]}));
assert.throws(()=>env.saveConfig({...c,rooms:[{f:0,x:4,y:4,name:'가'.repeat(31)}]}));
assert.throws(()=>env.saveConfig({...c,rooms:[{f:0,x:4,y:4,name:''}]}));
env.saveConfig({...c,aeds:[{f:1,x:4,y:4}]});const cardiac=env.startSession('AED participant','cardiac');env.finishSession(cardiac.id,true);assert.equal(sheet('Records').rows.at(-1)[5],'심정지');assert.throws(()=>env.startSession('bad','unknown'));assert.throws(()=>env.saveConfig({...c,aeds:[{f:2,x:4,y:4}]}));
console.log('PASS: AED config persistence, cardiac session record, invalid mode and AED rejection');
console.log('PASS: config round-trip, server session timing, duplicate rejection, timeout, formula-safe participant names, stair validation');
