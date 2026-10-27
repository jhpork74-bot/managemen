const fs=require('fs'),vm=require('vm'),assert=require('assert'),c=vm.createContext({});vm.runInContext(fs.readFileSync(__dirname+'/duty-core.js','utf8'),c);const D=c.DutyRosterCore;
let d=D.normalize(null);const main=['본관직원01','본관직원02','본관직원03','본관직원04','본관직원05','본관직원06','본관직원07','본관직원08'],annex=['분관직원01','분관직원02','분관직원03','분관직원04','분관직원05','분관직원06'];
d.employees=[...main,'본관직원09',...annex].map((name,i)=>({id:name,name,site:i<9?'one':'two',active:true}));for(const site of ['one','two'])d.sites[site].settings={regularOrder:site==='one'?main:annex,lunchOrder:site==='one'?['본관직원01','본관직원03','본관직원07']:['분관직원01','분관직원03','분관직원04'],anchorMonth:'2026-11',autoEnabled:true,extraOffDates:[],dailyLunch:false};
const assignments={one:[{primaryId:'본관직원02',mode:'auto'},{primaryId:'본관직원08',mode:'fixed',lunchId:'본관직원09'}],two:[{primaryId:'분관직원02',mode:'auto'},{primaryId:'분관직원06',mode:'auto'}]};
for(const site of ['one','two'])d=D.savePolicy(d,site,{from:'2026-11-01',mode:'byPerson',assignments:assignments[site]},false).duty;
const holiday=month=>({verified:true,month,days:[]});
for(const site of ['one','two']){let prev,cursor=0,primaryCursor=0;const order=site==='one'?main:annex,lunch=d.sites[site].settings.lunchOrder;for(const month of ['2026-11','2026-12']){
const roster=D.generateMonth(d,site,month,holiday(month),prev);d.sites[site].months[month]=roster;
for(const entry of Object.values(roster.entries)){assert.equal(entry.primaryId,order[primaryCursor++%order.length]);if(site==='one'&&entry.primaryId==='본관직원08'){assert.equal(entry.lunchId,'본관직원09');assert(entry.pairFixed);assert(!entry.primaryFixed);continue}
const needs=assignments[site].some(row=>row.mode==='auto'&&row.primaryId===entry.primaryId);assert.equal(entry.lunchRequired,needs);if(needs){const expected=D.chooseLunch(lunch,cursor,entry.primaryId);assert.equal(entry.lunchId,expected.id);cursor=expected.next}else assert.equal(entry.lunchId,null)}assert.equal(roster.endLunchIndex,cursor);prev=roster;}}
assert(!D.siteOrder(d,'one','regularOrder').includes('본관직원09'));
const old=JSON.stringify(d),primaryBefore=Object.fromEntries(Object.entries(d.sites.one.months['2026-11'].entries).map(([date,e])=>[date,e.primaryId]));
const changed=D.savePolicy(d,'one',{from:'2026-11-15',mode:'byPerson',assignments:[{primaryId:'본관직원02',mode:'fixed',lunchId:'본관직원03'},{primaryId:'본관직원08',mode:'fixed',lunchId:'본관직원09'}]},true).duty;
assert.deepStrictEqual(Object.fromEntries(Object.entries(changed.sites.one.months['2026-11'].entries).map(([date,e])=>[date,e.primaryId])),primaryBefore);
assert.equal(JSON.stringify(changed.sites.two),JSON.stringify(d.sites.two));assert.equal(JSON.stringify(d),old);
for(const [date,e] of Object.entries(d.sites.one.months['2026-11'].entries).filter(([date])=>date<'2026-11-15'))assert.equal(JSON.stringify(changed.sites.one.months['2026-11'].entries[date]),JSON.stringify(e));
console.log('PASS user examples: exact 8-person main/6-person annex sequence over November+December, Park Sora auto, Kim Eunju→Park Jeongho fixed only on own turns, annex Kim Eunmi/Lee Jeongseon auto, independent lunch cursors, substitute-only Park excluded from primary, applying lunch rules preserves all November primary assignments and pre-start snapshots.');
const oldNov=JSON.stringify(d.sites.one.months['2026-11']);let starts=D.configureStarts(d,'one','2026-11',{primaryId:'본관직원02',lunchId:'본관직원07'},false);assert.equal(JSON.stringify(starts.duty.sites.one.months['2026-11']),oldNov);
let generated=D.generateMonth(starts.duty,'one','2026-11',holiday('2026-11'),null);assert.equal(generated.entries['2026-11-02'].primaryId,'본관직원02');assert.equal(generated.entries['2026-11-02'].lunchId,'본관직원07');
starts=D.configureStarts(d,'one','2026-11',{primaryId:'본관직원02',lunchId:'본관직원07'},true);assert.equal(starts.duty.sites.one.months['2026-11'].entries['2026-11-02'].primaryId,'본관직원02');assert(starts.count>0);assert(starts.duty.sites.one.archives.length>0);assert.equal(JSON.stringify(starts.duty.sites.two),JSON.stringify(d.sites.two));assert.equal(JSON.stringify(d.sites.one.months['2026-11']),oldNov);
assert.throws(()=>D.configureStarts(d,'one','2026-11',{primaryId:'분관직원06'},false),/같은 소속/);
console.log('PASS starting staff: requested primary/lunch starts used in new month, existing November retained by default, explicit rebuild archived and site independent, cross-site starts rejected.');
