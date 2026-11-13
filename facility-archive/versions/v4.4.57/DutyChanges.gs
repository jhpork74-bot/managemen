var DutyChangesCore=(function(){
 'use strict';const clone=x=>JSON.parse(JSON.stringify(x));
 function validate(site,month){if(!['one','two'].includes(site)||!DutyRosterCore.validMonth(month))throw Error('장소와 조회 월을 확인하세요.')}
 function pair(e){return {primaryId:e.primaryId,primaryName:e.primaryName,lunchRequired:!!e.lunchRequired,lunchId:e.lunchRequired?e.lunchId:null,lunchName:e.lunchRequired?e.lunchName:'',pairFixed:!!e.pairFixed,directorLunch:!!e.directorLunch}}
 function same(a,b){return a.primaryId===b.primaryId&&a.lunchRequired===b.lunchRequired&&(!a.lunchRequired||a.lunchId===b.lunchId)}
 function weekday(date){
  const day=new Date(date+'T12:00:00Z').getUTCDay();
  return day>=1&&day<=5?day:0;
 }
 function samePair(a,b){return same(a,b)&&a.primaryName===b.primaryName&&a.lunchName===b.lunchName&&a.pairFixed===b.pairFixed&&a.directorLunch===b.directorLunch}
 function historyId(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}
 function store(data,site){return data.dutyChanges&&data.dutyChanges.sites&&data.dutyChanges.sites[site]||{entries:{},history:[]}}
 function view(data,site,month){validate(site,month);const source=data.dutyManagement&&data.dutyManagement.sites&&data.dutyManagement.sites[site]&&data.dutyManagement.sites[site].months[month];if(!source)return null;const result=clone(source),changes=store(data,site);for(const date of Object.keys(result.entries)){const change=(changes.entries||{})[date];if(change){result.entries[date]={...result.entries[date],...clone(change.after),requestedChange:true};result.entries[date].baselineChanged=!same(pair(source.entries[date]),change.baseline)}}return result}
 function preview(data,site,date,primaryId){const d=DutyRosterCore.normalize(data.dutyManagement),month=date.slice(0,7);validate(site,month);const primary=DutyRosterCore.activeEmployees(d,site).find(e=>e.id===primaryId);if(!primary)throw Error('현재 장소의 당직자를 선택하세요.');const rule=DutyRosterCore.policyAt(d.sites[site].settings,date)||{},row=rule.mode==='byPerson'?(rule.assignments||[]).find(r=>r.primaryId===primaryId):rule.mode==='fixed'&&rule.primaryId===primaryId?rule:null;if(row&&row.mode==='fixed'){const lunch=DutyRosterCore.fixedLunchEmployees(d,site).find(e=>e.id===row.lunchId);if(!lunch||lunch.id===primaryId)throw Error('고정 점심대체자의 소속·사용 상태를 확인하세요.');return {primaryId,primaryName:primary.name,lunchRequired:true,lunchId:lunch.id,lunchName:lunch.name,pairFixed:true,directorLunch:false}}const r=DutyRosterCore.applyDay(d,site,month,date,{primaryId,assignmentMode:'auto'});return pair(r.entries[date])}
 function writable(data,site){const result=clone(data);result.dutyChanges=result.dutyChanges||{schema:1,sites:{}};result.dutyChanges.sites=result.dutyChanges.sites||{};const old=result.dutyChanges.sites[site]||{};result.dutyChanges.sites[site]={...old,entries:old.entries||{},history:old.history||[]};return result}
 function apply(data,site,date,input){
  validate(site,date.slice(0,7));if(!DutyRosterCore.validDate(date))throw Error('변경 날짜를 확인하세요.');const current=view(data,site,date.slice(0,7));if(!current||!current.entries[date])throw Error('원본 당직표에 있는 근무일을 선택하세요.');
  const d=DutyRosterCore.normalize(data.dutyManagement),primary=DutyRosterCore.activeEmployees(d,site).find(e=>e.id===input.primaryId);if(!primary)throw Error('현재 장소의 당직자를 선택하세요.');let lunch=null;if(input.lunchRequired){lunch=DutyRosterCore.fixedLunchEmployees(d,site).find(e=>e.id===input.lunchId);if(!lunch||lunch.id===primary.id)throw Error('당직자와 다른 점심대체자를 선택하세요.')}
  const before=pair(current.entries[date]),after={primaryId:primary.id,primaryName:primary.name,lunchRequired:!!lunch,lunchId:lunch?lunch.id:null,lunchName:lunch?lunch.name:'',pairFixed:!!lunch,directorLunch:false};
  if(same(before,after))return {data:clone(data),changed:false};const result=writable(data,site),changes=result.dutyChanges.sites[site],base=pair(data.dutyManagement.sites[site].months[date.slice(0,7)].entries[date]);
  const previous=(store(data,site).entries||{})[date];changes.entries[date]={...(previous?clone(previous):{}),baseline:base,after};changes.history.push({kind:'change',beforeChange:previous?clone(previous):null,baselineAtChange:clone(base),id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),date,before,after});return {data:result,changed:true};
 }
 function cancel(data,site,date){validate(site,date.slice(0,7));const current=view(data,site,date.slice(0,7)),change=(store(data,site).entries||{})[date];if(!current||!current.entries[date]||!change)return {data:clone(data),changed:false};const result=writable(data,site),changes=result.dutyChanges.sites[site],before=pair(current.entries[date]),after=pair(data.dutyManagement.sites[site].months[date.slice(0,7)].entries[date]);delete changes.entries[date];changes.history.push({kind:'reset',beforeChange:clone(change),baselineAtChange:clone(after),id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),date,before,after});return {data:result,changed:true};}
 function swap(data,site,from,to,shown){
  if(!DutyRosterCore.validDate(from)||!DutyRosterCore.validDate(to)||from.slice(0,7)!==to.slice(0,7)||!weekday(from)||!weekday(to)){
   throw Error('같은 장소·월의 평일 두 날짜를 선택하세요.');
  }
  const month=from.slice(0,7),current=view(data,site,month);
  if(from===to)return {data,changed:false};
  const dates=[from,to];
  if(!current||dates.some(date=>!current.entries[date]||(current.holidays||{})[date])){
   throw Error('당직자가 배치된 근무일끼리만 맞바꿀 수 있습니다.');
  }
  const pairs=dates.map(date=>pair(current.entries[date]));
  if(dates.some((date,index)=>current.entries[date].baselineChanged||!shown?.[date]||!samePair(pairs[index],pair(shown[date])))){
   throw Error('당직 배치가 바뀌었습니다. 현재 달력을 확인한 후 다시 시도하세요.');
  }
  if(samePair(pairs[0],pairs[1]))return {data,changed:false};
  const result=writable(data,site),changes=result.dutyChanges.sites[site],swapId=historyId();
  const baseline=data.dutyManagement.sites[site].months[month].entries;
  dates.forEach((date,index)=>{
   const previous=changes.entries[date]||null,base=pair(baseline[date]),before=pairs[index],after=pairs[1-index];
   changes.entries[date]={...previous,baseline:base,after};
   changes.history.push({id:swapId+'-'+index,kind:'swap',swapId,date,before,after,beforeChange:previous,baselineAtChange:base});
  });
  return {data:result,changed:true,date:to,swap:true};
 }
 function undoCandidate(data,site,month){
  validate(site,month);const history=store(data,site).history||[],undone=new Set(history.filter(h=>h.kind==='undo'&&h.undoOf).map(h=>h.undoOf));
  return history.slice().reverse().find(h=>h.kind!=='undo'&&h.id&&h.date&&h.date.startsWith(month+'-')&&!undone.has(h.id))||null;
 }
 function undoLast(data,site,month){
  const target=undoCandidate(data,site,month);if(!target)return {data:clone(data),changed:false};
  const state=store(data,site),history=state.history||[],current=view(data,site,month);
  const group=target.swapId?history.filter(h=>h.kind==='swap'&&h.swapId===target.swapId):[target];
  if(target.swapId&&(group.length!==2||group[0].date===group[1].date||group.some(h=>history.some(row=>row.undoOf===h.id)))){
   throw Error('두 날짜의 맞교체 이력이 맞지 않아 자동 복구를 멈췄습니다.');
  }
  const rows=group.map(event=>{
   const date=event.date;
   if(!date.startsWith(month+'-')||!current||!current.entries[date])throw Error('복구할 날짜의 원본 당직표가 없습니다. 원본부터 확인하세요.');
   const before=pair(current.entries[date]),base=pair(data.dutyManagement.sites[site].months[month].entries[date]);
   const oldEntry=(state.entries||{})[date],expectedBase=event.baselineAtChange||(oldEntry&&oldEntry.baseline);
   if(!event.before||!event.after||!(target.swapId?samePair(before,event.after):same(before,event.after)))throw Error('현재 배치가 마지막 변경이력과 다릅니다. 새로고침 후 확인하세요.');
   if(expectedBase&&!same(base,expectedBase))throw Error('원본 당직표가 변경되어 자동 복구를 멈췄습니다. 원본과 변경이력을 확인하세요.');
   return {date,event,before,base,oldEntry};
  });
  const result=writable(data,site),changes=result.dutyChanges.sites[site];
  rows.forEach(({date,event,before,base,oldEntry})=>{
   if(Object.prototype.hasOwnProperty.call(event,'beforeChange')){
    if(event.beforeChange===null)delete changes.entries[date];else changes.entries[date]=clone(event.beforeChange);
   }else if(same(base,event.before))delete changes.entries[date];
   else changes.entries[date]={...(oldEntry?clone(oldEntry):{}),baseline:clone(base),after:clone(event.before)};
   const restored=changes.entries[date];
   changes.history.push({id:historyId(),date,before,after:restored?pair(restored.after):base,kind:'undo',undoOf:event.id,baselineAtChange:clone(base)});
  });
  return {data:result,changed:true,date:target.date,restoredId:target.id,undo:true,swap:!!target.swapId};
 }

 return {pair,view,preview,apply,cancel,store,weekday,swap,undoCandidate,undoLast};
})();

function includeDutyChangesUI_(){return HtmlService.createHtmlOutputFromFile('DutyChangesUI').getContent()}
function getDutyChangeView(site,month){const snapshot=getFacilityData();return {revision:snapshot.revision,roster:DutyChangesCore.view(snapshot.data||{},site,month)}}
