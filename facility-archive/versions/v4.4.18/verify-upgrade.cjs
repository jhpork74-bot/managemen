const fs=require('fs'),vm=require('vm'),assert=require('assert'),dir=__dirname;
const c=vm.createContext({console});vm.runInContext((fs.readFileSync(dir+'/INI.gs','utf8')+'\n'+fs.readFileSync(dir+'/DutyRosterCore.gs','utf8'))+'\n'+fs.readFileSync(dir+'/DutyManagement.gs','utf8'),c);const D=c.DutyRosterCore;
let d=D.normalize(null);d.employees=['a','b','c','x','y'].map((id,i)=>({id,name:'직원'+id,site:i<3?'one':'two',active:true}));
for(const site of ['one','two'])d.sites[site].settings={regularOrder:[],lunchOrder:site==='one'?['a','b','c']:['x','y'],dailyLunch:true,anchorMonth:'2026-09',autoEnabled:true,extraOffDates:[]};
const official=month=>({verified:true,month,days:month==='2026-10'?[{date:'2026-10-09',name:'한글날'}]:[],checkedAt:'test'});
for(const site of ['one','two']){let prev;for(const month of ['2026-09','2026-10','2026-11']){d.sites[site].months[month]=D.generateMonth(d,site,month,official(month),prev);prev=d.sites[site].months[month]}}
assert(!d.sites.one.months['2026-10'].entries['2026-10-09']);
for(const site of ['one','two'])for(const roster of Object.values(d.sites[site].months))for(const e of Object.values(roster.entries)){assert(D.activeEmployees(d,site).some(x=>x.id===e.primaryId));assert(D.activeEmployees(d,site).some(x=>x.id===e.lunchId));assert.notEqual(e.primaryId,e.lunchId)}
const before=JSON.stringify(d.sites.one.months['2026-09']),other=JSON.stringify(d.sites.two),day='2026-10-14',old=d.sites.one.months['2026-10'],priorDays=Object.fromEntries(Object.entries(old.entries).filter(([date])=>date<day));
const changed=D.cascade(d,'one',day,{primaryId:'c',lunchRequired:true,lunchId:'b',lunchManual:true,directorLunch:true});
assert.equal(JSON.stringify(changed.duty.sites.one.months['2026-09']),before);assert.deepStrictEqual(JSON.parse(JSON.stringify(changed.duty.sites.two)),JSON.parse(other));assert.equal(JSON.stringify(Object.fromEntries(Object.entries(changed.duty.sites.one.months['2026-10'].entries).filter(([date])=>date<day))),JSON.stringify(priorDays));
assert.equal(changed.duty.sites.one.months['2026-10'].entries[day].primaryId,'c');assert.equal(changed.duty.sites.one.months['2026-10'].entries[day].lunchName,'직원b');
const normal=D.applyDay(d,'one','2026-10',day,{primaryId:old.entries[day].primaryId,lunchRequired:false});
const fixed=D.applyDay(d,'one','2026-10',day,{primaryId:old.entries[day].primaryId,lunchRequired:true,lunchManual:true,directorLunch:true,lunchId:['a','b','c'].find(id=>id!==old.entries[day].primaryId)});
assert.equal(normal.endLunchIndex,fixed.endLunchIndex);assert.equal(normal.lastLunchId,fixed.lastLunchId);
assert.throws(()=>D.applyDay(d,'one','2026-10',day,{primaryId:'x'}),/당직자/);
let legacy=D.normalize({employees:[{id:'a',name:'a'},{id:'b',name:'b'}],sites:{one:{settings:{regularOrder:['a','b']}},two:{settings:{regularOrder:['b']}}}});assert.equal(legacy.employees[0].site,'one');assert.equal(legacy.employees[1].site,null);
d.employees[0].site='two';assert(!D.siteOrder(d,'one','regularOrder').includes('a'));assert.equal(JSON.stringify(d.sites.one.months['2026-09']),before);
console.log('PASS core: affiliation migration/filtering/transfer, daily two-person rows, holiday skip, cascade across months with past+other-site preservation, fixed lunch no rotation consumption.');
let revision=0,store={extra:'preserved',dutyManagement:changed.duty},saveFail=false,dayOfMonth='2026-10-19',eventCount=0,mailCount=0,popup=0;
const props=new Map([['dutyNotificationCalendarId','owner-calendar']]),events=[];
c.PropertiesService={getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)})};
c.Utilities={formatDate:(_d,_tz,fmt)=>fmt==='yyyy-MM-dd'?dayOfMonth:fmt==='yyyy'?'2026':dayOfMonth.slice(0,7)};
c.getFacilityData=()=>({revision,data:JSON.parse(JSON.stringify(store))});c.saveFacilityData=(raw,expected)=>{if(saveFail)throw Error('CONFLICT');assert.equal(expected,revision);store=JSON.parse(raw);return {revision:++revision}};c.getDutyHolidays=official;
const calendar={getId:()=> 'owner-calendar',getEventById:id=>events.find(e=>e.getId()===id),getEvents:()=>events,createEvent:(title,start,end,opt)=>{eventCount++;assert.equal(title,'당직표작성됨');assert(start>new Date());assert(!opt.guests);const e={getId:()=>String(eventCount),getDescription:()=>opt.description,removeAllReminders(){return this},addPopupReminder(n){assert.equal(n,5);popup++;return this}};events.push(e);return e}};
c.CalendarApp={getDefaultCalendar:()=>calendar,getCalendarById:id=>{assert.equal(id,'owner-calendar');return calendar}};c.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}})};
let triggers=[];c.ScriptApp={getProjectTriggers:()=>triggers,newTrigger:()=>({timeBased(){return this},atHour(){return this},everyDays(){return this},inTimezone(){return this},create(){triggers.push({getHandlerFunction:()=> 'generateCurrentDutyMonths'})}})};
c.installDutyMonthAutomation();c.installDutyMonthAutomation();assert.equal(triggers.length,1);c.generateCurrentDutyMonths();assert.equal(eventCount,0);
dayOfMonth='2026-10-20';c.generateCurrentDutyMonths();assert.equal(eventCount,1);c.generateCurrentDutyMonths();assert.equal(eventCount,1);assert.equal(popup,1);assert.equal(store.extra,'preserved');
// Future incomplete window, holiday error or revision conflict must never partially commit.
const saved=JSON.stringify(store),rev=revision;c.getDutyHolidays=m=>{if(m==='2027-02')throw Error('공휴일 서비스 오류');return official(m)};assert.throws(()=>c.generateDutyWindow('one','2027-02',revision),/공휴일/);assert.equal(JSON.stringify(store),saved);assert.equal(revision,rev);
c.getDutyHolidays=official;assert.throws(()=>c.generateDutyWindow('one','2026-12',-1),/CONFLICT/);
const oct=JSON.stringify(store.dutyManagement.sites.one.months['2026-10']);c.generateDutyWindow('one','2026-12',revision);assert.equal(JSON.stringify(store.dutyManagement.sites.one.months['2026-10']),oct);
dayOfMonth='2027-01-20';saveFail=true;assert.throws(()=>c.generateCurrentDutyMonths(),/CONFLICT/);assert.equal(eventCount,1);
console.log('PASS server: 20th schedules following month, notice after commit, no duplicate event, trigger dedup, notification calendar fixed, atomic holiday failure and conflict guard, unknown data preserved. Google services mocked.');
saveFail=false;store={extra:'keep',dutyManagement:D.normalize(changed.duty)};delete store.dutyManagement.sites.one.months['2026-09'];delete store.dutyManagement.sites.one.months['2026-11'];
const existing=JSON.stringify(store.dutyManagement.sites.one.months['2026-10']);const window=c.generateDutyWindow('one','2026-10',revision);assert.equal(window.created.length,2);assert.equal(JSON.stringify(store.dutyManagement.sites.one.months['2026-10']),existing);
const order=D.siteOrder(store.dutyManagement,'one','regularOrder'),sept=store.dutyManagement.sites.one.months['2026-09'],october=store.dutyManagement.sites.one.months['2026-10'],firstOct=october.entries[Object.keys(october.entries).sort()[0]].primaryId;assert.equal(order[(order.indexOf(sept.lastPrimaryId)+1)%order.length],firstOct);
console.log('PASS window backfill: missing previous/next months, existing center untouched, primary rotation aligned to existing center.');
