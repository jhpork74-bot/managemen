const fs=require('fs'),vm=require('vm'),assert=require('assert');
const cells=new Map(),props=new Map();let failStage=false,failPointer=false,failReport=false;
class Sheet{
 constructor(name){this.name=name;this.rows=[]}
 clearContents(){if(failStage&&this.name.includes('슬롯'))throw Error('stage failed');this.rows=[]}
 getRange(r,c,n=1,m=1){if(typeof r==='string'){assert.equal(r,'B1');return {getValue:()=>this.rows[0]?.[1]||''}}
  return {setValues:values=>{if(failStage&&this.name.includes('슬롯'))throw Error('stage failed');for(let i=0;i<n;i++){this.rows[r-1+i]||=[];for(let j=0;j<m;j++)this.rows[r-1+i][c-1+j]=values[i][j]}},getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>this.rows[r-1+i]?.[c-1+j]??''))}}
}
const ss={getSheetByName:name=>cells.get(name),insertSheet:name=>{const sh=new Sheet(name);cells.set(name,sh);return sh}};
const c=vm.createContext({console,SpreadsheetApp:{openById:()=>ss,flush(){}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty(k,v){if(failPointer&&k==='facilityCommit')throw Error('pointer failed');props.set(k,v)}})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})}});
vm.runInContext((fs.readFileSync(__dirname+'/INI.gs','utf8')+'\n'+fs.readFileSync(__dirname+'/Code.gs','utf8'))+'\n'+fs.readFileSync(__dirname+'/FacilityStorage.gs','utf8'),c);
c.writeAll_=()=>{if(failReport)throw Error('report failed')};
c.Utilities={DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,raw)=>[...require('crypto').createHash('sha256').update(raw).digest()]};
const data=n=>({items:[],tasks:[{id:String(n)}],checks:{},weeklyChecks:{},monthlyChecks:{},stock:[],orders:[],movements:[],unknown:'preserved'});
// Legacy store is readable before migration.
c.writeJsonSheet_(ss,'_앱데이터',JSON.stringify(data(0)),0);props.set('facilityRevision','4');assert.equal(c.getFacilityData().revision,4);
failStage=true;assert.throws(()=>c.saveFacilityData(JSON.stringify(data(1)),4),/stage/);assert.equal(c.getFacilityData().data.tasks[0].id,'0');assert.equal(c.getFacilityData().revision,4);failStage=false;
failPointer=true;assert.throws(()=>c.saveFacilityData(JSON.stringify(data(1)),4),/pointer/);assert.equal(c.getFacilityData().data.tasks[0].id,'0');assert.equal(c.getFacilityData().revision,4);failPointer=false;
failReport=true;const saved=c.saveFacilityData(JSON.stringify(data(1)),4);assert.equal(saved.revision,5);assert.equal(saved.reportPending,true);assert.equal(c.getFacilityData().data.tasks[0].id,'1');assert.equal(c.getFacilityData().revision,5);assert.equal(c.getFacilityData().reportPending,true);assert.throws(()=>c.saveFacilityData(JSON.stringify(data(2)),4),/CONFLICT/);
failReport=false;c.retryFacilityReports();assert.equal(c.getFacilityData().reportPending,false);
failStage=true;assert.throws(()=>c.saveFacilityData(JSON.stringify(data(2)),5),/stage/);assert.equal(c.getFacilityData().revision,5);assert.equal(c.getFacilityData().data.tasks[0].id,'1');failStage=false;
assert.equal(c.saveFacilityData(JSON.stringify(data(2)),5).revision,6);assert.equal(c.getFacilityData().data.unknown,'preserved');
const stats=c.inspectionMonthAggregate({items:[{id:'d'},{id:'w',frequency:'weekly'},{id:'m1',frequency:'monthly'},{id:'m2',frequency:'monthly'}],checks:{'2026-10-01':{d:true}},weeklyChecks:{'2026-09-28':{w:true,_dates:{w:'2026-10-01'}}},monthlyChecks:{'2026-10':{m1:true,m2:true}}},'2026-10');assert.equal(stats.done,4);assert.equal(stats.cycles.monthly.done,2);assert.equal(stats.cycles.weekly.done,1);assert.equal(stats.total,4);
const reports=new Map(),projection=vm.createContext({console,PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},SpreadsheetApp:{openById:()=>({})}});vm.runInContext((fs.readFileSync(__dirname+'/INI.gs','utf8')+'\n'+fs.readFileSync(__dirname+'/Code.gs','utf8'))+'\n'+fs.readFileSync(__dirname+'/FacilityStorage.gs','utf8'),projection);projection.put_=(_book,name,head,rows)=>reports.set(name,{head,rows});
projection.writeAll_({items:[1,2,3,4].map(n=>({id:'m'+n,frequency:'monthly',name:'점검'+n})),tasks:[],checks:{},monthlyChecks:{'2026-10':{m1:true,m2:true}},weeklyChecks:{},stock:[{id:'coffee',name:'커피',pack:1,one:8,two:0,boxone:0,boxtwo:0}],orders:[],movements:[]});
assert.equal(reports.get('자판기 재고').head.length,17);assert.equal(reports.get('자판기 재고').rows[0].length,17);assert.equal(reports.get('자판기 재고').rows[0][10],'아니오');assert.equal(reports.get('자판기 재고').rows[0][16],'예');assert.equal(reports.get('월간 통계').rows[0][2],2);assert.equal(reports.get('월간 통계').rows[0][3],4);assert.equal(reports.get('월간 통계').rows[0][4],50);
const helpers=vm.createContext({stockSiteTotal:(item,site)=>item[site]||0});vm.runInContext(fs.readFileSync(__dirname+'/stock-needs.js','utf8'),helpers);let needs=helpers.stockLocationNeeds({one:8,two:0});assert.equal(needs.length,1);assert.equal(needs[0].site,'two');assert.equal(needs[0].transfer,4);assert.equal(helpers.stockLocationNeeds({one:8,two:0,siteUseTwo:false}).length,0);assert.equal(helpers.stockLocationNeeds({one:8,two:0,siteMinTwo:0}).length,0);assert.equal(helpers.stockLocationMinimum({siteMinTwo:-1},'two'),4);
console.log('PASS: storage failure/commit/revision tests; monthly 2 of 4 = 50% in reporting sheet; 17-column site stock reporting; annex zero shortage despite total 8, transfer suggestion, site opt-out and limits. Google services mocked.');
