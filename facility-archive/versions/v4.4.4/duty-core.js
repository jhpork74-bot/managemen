var DutyRosterCore=(function(){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value}
 function validMonth(value){return typeof value==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value)}
 function nextMonth(value){if(!validMonth(value))throw Error('월 형식 오류');const d=new Date(value+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);return d.toISOString().slice(0,7)}
 function normalize(raw){
  const d=raw&&typeof raw==='object'?clone(raw):{};d.employees=Array.isArray(d.employees)?d.employees:[];d.sites=d.sites||{};
  for(const site of ['one','two']){d.sites[site]=d.sites[site]||{};const s=d.sites[site];s.months=s.months||{};s.settings={regularOrder:[],lunchOrder:[],extraOffDates:[],autoEnabled:false,...(s.settings||{})}}
  for(const e of d.employees){if(!['one','two'].includes(e.site)){const sites=['one','two'].filter(site=>d.sites[site].settings.regularOrder.includes(e.id)||d.sites[site].settings.lunchOrder.includes(e.id));e.site=sites.length===1?sites[0]:null}}
  return d;
 }
 function activeEmployees(d,site){return d.employees.filter(e=>e.active!==false&&(!site||e.site===site))}
 function siteOrder(d,site,kind){const people=activeEmployees(d,site),allowed=new Set(people.map(e=>e.id));const saved=usableOrder(d,d.sites[site].settings[kind]).filter(id=>allowed.has(id));return kind==='regularOrder'?[...saved,...people.map(e=>e.id).filter(id=>!saved.includes(id))]:saved}
 function shiftMonth(month,delta){const date=new Date(month+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+delta);return date.toISOString().slice(0,7)}
 function windowMonths(month){return [-1,0,1].map(n=>shiftMonth(month,n))}
 function usableOrder(d,ids){const active=new Set(activeEmployees(d).map(e=>e.id));return [...new Set((ids||[]).filter(id=>active.has(id)))]}
 function label(d,id){const employee=d.employees.find(e=>e.id===id);return employee?employee.name:'기존 직원'}
 function startIndex(order,previousId,fallback){const index=order.indexOf(previousId);return index>=0?(index+1)%order.length:((Number(fallback)||0)%order.length)}
 function chooseLunch(order,index,primaryId){
  if(!order.length)throw Error('점심 대체자 순번을 먼저 저장하세요.');
  for(let offset=0;offset<order.length;offset++){const n=(index+offset)%order.length;if(order[n]!==primaryId)return {id:order[n],next:(n+1)%order.length}}
  throw Error('주 당직자와 다른 점심 대체자가 필요합니다. 대체자 순번에 다른 직원을 추가하세요.');
 }
 function holidayMap(month,official,settings){
  if(!official||official.verified!==true||official.month!==month)throw Error('공휴일 확인 없이 자동 배치할 수 없습니다.');
  const map={};for(const day of official.days||[]){if(validDate(day.date)&&day.date.startsWith(month))map[day.date]=String(day.name||'공휴일')}
  for(const day of settings.extraOffDates||[]){if(validDate(day.date)&&day.date.startsWith(month))map[day.date]=String(day.name||'시설 휴무')}
  return map;
 }
 function refreshLunch(d,month,settings,site,from){
  const order=site?siteOrder(d,site,'lunchOrder'):usableOrder(d,settings.lunchOrder);let cursor=Number(month.startLunchIndex)||0,last=month.previousLunchId||null;
  for(const date of Object.keys(month.entries).sort()){
   const entry=month.entries[date];
   if(from&&date<from){if(entry.lunchRequired&&!entry.directorLunch){const pos=order.indexOf(entry.lunchId);if(pos>=0)cursor=(pos+1)%order.length;last=entry.lunchId}continue}
   if(!entry.lunchRequired){entry.lunchId=null;entry.lunchName='';continue}
   if(entry.directorLunch){const fixed=activeEmployees(d,site).find(e=>e.id===entry.lunchId);if(!fixed||fixed.id===entry.primaryId)throw Error('관장님 점심당직은 같은 소속의 다른 직원을 선택하세요.');entry.lunchName=fixed.name;continue}
   if(entry.lunchManual){if(entry.lunchId===entry.primaryId)throw Error('주 당직자와 점심 대체자는 달라야 합니다.');const position=order.indexOf(entry.lunchId);if(position>=0)cursor=(position+1)%order.length}
   else{const chosen=chooseLunch(order,cursor,entry.primaryId);entry.lunchId=chosen.id;entry.lunchName=label(d,chosen.id);cursor=chosen.next}
   last=entry.lunchId;
  }
  month.endLunchIndex=cursor;month.lastLunchId=last;return month;
 }
 function generateMonth(d,site,month,official,previous,existing){
  if(!validMonth(month))throw Error('월 형식 오류');const settings=d.sites[site].settings,order=siteOrder(d,site,'regularOrder');
  if(!order.length)throw Error('당직자 순번에 사용 중인 직원을 한 명 이상 등록하세요.');
  const holidays=holidayMap(month,official,settings),lunchOrder=siteOrder(d,site,'lunchOrder');
  let cursor=startIndex(order,previous&&previous.lastPrimaryId,previous&&previous.endRegularIndex),last=previous&&previous.lastPrimaryId||null;
  const startLunch=lunchOrder.length?startIndex(lunchOrder,previous&&previous.lastLunchId,previous&&previous.endLunchIndex):0;
  const result={month,entries:{},holidays,startRegularIndex:cursor,startLunchIndex:startLunch,previousLunchId:previous&&previous.lastLunchId||null,holidayCheckedAt:official.checkedAt||'',holidaySource:official.source||'한국천문연구원 특일정보',generatedAt:new Date().toISOString()};
  const [year,n]=month.split('-').map(Number),count=new Date(Date.UTC(year,n,0)).getUTCDate();
  for(let day=1;day<=count;day++){
   const date=month+'-'+String(day).padStart(2,'0'),weekday=new Date(date+'T12:00:00Z').getUTCDay();if(weekday===0||weekday===6||holidays[date])continue;
   const id=order[cursor];cursor=(cursor+1)%order.length;const old=existing&&existing.entries&&existing.entries[date];
   result.entries[date]=old&&old.manual?clone(old):{primaryId:id,primaryName:label(d,id),lunchRequired:settings.dailyLunch===true,lunchId:null,lunchName:'',manual:false};last=result.entries[date].primaryId;
  }
  result.endRegularIndex=cursor;result.lastPrimaryId=last;refreshLunch(d,result,settings,site);return result;
 }
 function generationPlan(d,site,target){
  const s=d.sites[site],anchor=s.settings.anchorMonth;if(!validMonth(target)||!validMonth(anchor))throw Error('기준 월과 조회 월을 확인하세요.');if(target<anchor)throw Error('자동 배치 기준 월보다 이전입니다. 순번 설정의 기준 월을 확인하세요.');
  if(s.months[target])return [];
  const prior=Object.keys(s.months).filter(m=>validMonth(m)&&m<target).sort().pop();let month=prior?nextMonth(prior):anchor;const result=[];
  while(month<=target){if(!s.months[month])result.push(month);if(result.length>24)throw Error('24개월 이상 비어 있습니다. 중간 월부터 순서대로 작성하세요.');month=nextMonth(month)}return result;
 }
 function applyDay(d,site,month,date,input){
  if(!validDate(date)||!date.startsWith(month))throw Error('해당 월 날짜를 선택하세요.');const current=d.sites[site].months[month];if(!current)throw Error('월 당직표를 먼저 자동 작성하세요.');
  const weekday=new Date(date+'T12:00:00Z').getUTCDay();if(weekday===0||weekday===6||current.holidays[date])throw Error('주말·공휴일·휴무일에는 자동 당직 대상이 아닙니다.');
  const employee=activeEmployees(d,site).find(e=>e.id===input.primaryId);if(!employee)throw Error('주 당직자를 선택하세요.');
  const next=clone(current),old=next.entries[date];if(!old)throw Error('선택한 날짜의 배치가 없습니다. 월표를 다시 확인하세요.');
  const entry={...old,primaryId:employee.id,primaryName:employee.name,manual:true,lunchRequired:!!input.lunchRequired,directorLunch:!!input.directorLunch};
  if(entry.lunchRequired&&(input.lunchManual||input.directorLunch)){const substitute=activeEmployees(d,site).find(e=>e.id===input.lunchId);if(!substitute||substitute.id===employee.id)throw Error('주 당직자와 다른 점심 대체자를 선택하세요.');entry.lunchManual=true;entry.lunchId=substitute.id;entry.lunchName=substitute.name}
  else entry.lunchManual=false;
  next.entries[date]=entry;refreshLunch(d,next,d.sites[site].settings,site,date);const dates=Object.keys(next.entries).sort();next.lastPrimaryId=dates.length?next.entries[dates[dates.length-1]].primaryId:next.lastPrimaryId;
  next.history=[...(next.history||[]),{date,at:new Date().toISOString(),before:old,after:clone(next.entries[date])}];return next;
 }
 function cascade(d,site,date,input){
  const result=normalize(d),store=result.sites[site],month=date.slice(0,7),order=siteOrder(result,site,'regularOrder');
  if(!order.includes(input.primaryId))throw Error('해당 장소의 직원을 선택하세요.');
  const edited=applyDay(result,site,month,date,input),months=Object.keys(store.months).filter(m=>m>=month).sort();
  let cursor=order.indexOf(input.primaryId),previous=null,count=0;
  for(const key of months){const original=store.months[key],roster=key===month?edited:clone(original);
   store.archives=[...(store.archives||[]),{month:key,archivedAt:new Date().toISOString(),reason:'이날부터 이어 배치',roster:clone(original)}];
   if(previous){roster.startRegularIndex=cursor;const lo=siteOrder(result,site,'lunchOrder');roster.startLunchIndex=lo.length?startIndex(lo,previous.lastLunchId,previous.endLunchIndex):0;roster.previousLunchId=previous.lastLunchId}
   for(const day of Object.keys(roster.entries).sort()){if(day<date)continue;const entry=roster.entries[day],id=order[cursor];cursor=(cursor+1)%order.length;entry.primaryId=id;entry.primaryName=label(result,id);entry.manual=true;count++}
   // Only recalculate lunch on and after the selected date. Older lunch rows remain snapshots.
   const before=Object.keys(roster.entries).filter(day=>day<date),frozen={};for(const day of before)frozen[day]=clone(roster.entries[day]);
   let lunchCursor=Number(roster.startLunchIndex)||0,lastLunch=roster.previousLunchId||null;const lunchOrder=siteOrder(result,site,'lunchOrder');
   for(const day of before.sort()){const entry=roster.entries[day];if(entry.lunchRequired&&!entry.directorLunch){const pos=lunchOrder.indexOf(entry.lunchId);if(pos>=0)lunchCursor=(pos+1)%lunchOrder.length;lastLunch=entry.lunchId}}
   const tail={...roster,startLunchIndex:lunchCursor,previousLunchId:lastLunch,entries:{}};for(const day of Object.keys(roster.entries).sort())if(day>=date)tail.entries[day]=roster.entries[day];
   refreshLunch(result,tail,store.settings,site);roster.entries={...frozen,...tail.entries};roster.endLunchIndex=tail.endLunchIndex;roster.lastLunchId=tail.lastLunchId;roster.endRegularIndex=cursor;
   const dates=Object.keys(roster.entries).sort();roster.lastPrimaryId=roster.entries[dates[dates.length-1]].primaryId;store.months[key]=roster;previous=roster;
  }return {duty:result,count};
 }
 return {siteOrder,shiftMonth,windowMonths,cascade,clone,validDate,validMonth,nextMonth,normalize,activeEmployees,usableOrder,label,chooseLunch,holidayMap,generateMonth,generationPlan,applyDay};
})();
