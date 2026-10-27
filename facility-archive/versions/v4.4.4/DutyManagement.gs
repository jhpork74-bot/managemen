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

function setDutyHolidayApiKey(value){
 if(typeof value!=='string'||!value.trim()||value.length>1000)throw Error('공공데이터포털 인증키를 입력하세요.');
 let key=value.trim();try{if(key.includes('%'))key=decodeURIComponent(key)}catch(error){throw Error('인증키 형식을 확인하세요.')}
 const p=PropertiesService.getScriptProperties();p.setProperty('dutyHolidayApiKey',key);p.setProperty('dutyHolidayCacheVersion',String(Date.now()));return {ok:true};
}
function getDutyServiceStatus(){const p=PropertiesService.getScriptProperties();return {hasHolidayKey:!!p.getProperty('dutyHolidayApiKey'),automatic:ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='generateCurrentDutyMonths'),lastAutomation:p.getProperty('dutyAutomationStatus')||''}}
function getDutyHolidays(month,force){
 if(!DutyRosterCore.validMonth(month))throw Error('조회 월을 확인하세요.');
 const year=Number(month.slice(0,4)),currentYear=Number(Utilities.formatDate(new Date(),'Asia/Seoul','yyyy'));if(year<2000||year>currentYear+1)throw Error('공휴일 자동 조회는 2000년부터 다음 해까지 지원합니다. 더 먼 기간은 공휴일 공표 뒤 작성하세요.');
 const p=PropertiesService.getScriptProperties(),key=p.getProperty('dutyHolidayApiKey');if(!key)throw Error('공공데이터포털 특일정보 인증키를 먼저 저장하세요. 공휴일 확인 전에는 자동 배치하지 않습니다.');
 const cache=CacheService.getScriptCache(),cacheKey='dutyHoliday:'+month+':'+(p.getProperty('dutyHolidayCacheVersion')||'0'),cached=!force&&cache.get(cacheKey);if(cached)return JSON.parse(cached);
 const url='https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey='+encodeURIComponent(key)+'&solYear='+month.slice(0,4)+'&solMonth='+month.slice(5)+'&numOfRows=100&pageNo=1';
 let response;try{response=UrlFetchApp.fetch(url,{muteHttpExceptions:true})}catch(error){throw Error('공휴일 서비스 연결 실패. 자동 배치를 중단했습니다.')}if(response.getResponseCode()!==200)throw Error('공휴일 서비스 응답 실패. 자동 배치를 중단했습니다.');
 let root;try{root=XmlService.parse(response.getContentText()).getRootElement()}catch(error){throw Error('공휴일 응답 형식 오류. 인증키와 서비스 활용승인을 확인하세요.')}
 const header=root.getChild('header'),body=root.getChild('body');if(!header||!body||header.getChildText('resultCode')!=='00')throw Error('공휴일 조회 승인 또는 서비스 오류. 인증키·활용승인을 확인하세요.');
 const count=Number(body.getChildText('totalCount'));if(!Number.isSafeInteger(count)||count<0||count>100)throw Error('공휴일 응답 건수 오류');
 const items=body.getChild('items'),rows=items?items.getChildren('item'):[];if(rows.length!==count)throw Error('공휴일 응답 일부가 누락되었습니다. 자동 배치를 중단했습니다.');
 const dates={};for(const row of rows){if(row.getChildText('isHoliday')!=='Y')continue;const raw=row.getChildText('locdate')||'',date=raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6,8);if(!DutyRosterCore.validDate(date)||!date.startsWith(month))throw Error('공휴일 날짜 오류');const name=row.getChildText('dateName')||'공휴일';dates[date]=dates[date]?dates[date]+' / '+name:name}
 const fixed={'01':['01'],'03':['01'],'05':['05'],'06':['06'],'08':['15'],'10':['03','09'],'12':['25']};if((fixed[month.slice(5)]||[]).some(day=>!dates[month+'-'+day]))throw Error('고정 공휴일 정보가 누락되었습니다. 해당 연도 자료 공표와 서비스 응답을 확인하세요.');
 const result={verified:true,month,days:Object.entries(dates).map(([date,name])=>({date,name})),source:'한국천문연구원 특일정보 공휴일(Y)',checkedAt:new Date().toISOString()};cache.put(cacheKey,JSON.stringify(result),21600);return result;
}
function generateDutyMonth(site,target,expectedRevision,regenerate){
 if(!['one','two'].includes(site)||!DutyRosterCore.validMonth(target))throw Error('장소와 월을 확인하세요.');
 return mutateDutyMonths_([{site,target,regenerate:!!regenerate}],expectedRevision);
}
function mutateDutyMonths_(requests,expectedRevision){
 for(let attempt=0;attempt<3;attempt++){
  const snapshot=getFacilityData();if(!snapshot.data)throw Error('기존 앱 데이터를 먼저 저장하세요.');
  if(expectedRevision!==undefined&&snapshot.revision!==Number(expectedRevision))throw Error('CONFLICT: 다른 기기에서 먼저 저장했습니다. 최신 데이터를 불러오세요.');
  const duty=DutyRosterCore.normalize(snapshot.data.dutyManagement),created=[];
  for(const request of requests){
   const site=duty.sites[request.site];let plan;
   if(request.regenerate){if(!site.months[request.target])throw Error('재작성할 기존 당직표가 없습니다.');plan=[request.target]}
   else plan=DutyRosterCore.generationPlan(duty,request.site,request.target);
   for(const month of plan){
    const official=getDutyHolidays(month,request.regenerate),prior=Object.keys(site.months).filter(m=>m<month).sort().pop(),old=site.months[month];
    const generated=DutyRosterCore.generateMonth(duty,request.site,month,official,prior?site.months[prior]:null,old);
    if(old){site.archives=[...(site.archives||[]),{month,archivedAt:new Date().toISOString(),roster:old}]}site.months[month]=generated;created.push(request.site+':'+month);
   }
  }
  if(!created.length)return {ok:true,revision:snapshot.revision,created:[]};
  const raw=JSON.stringify({...snapshot.data,dutyManagement:duty});if(raw.length>1700000)throw Error('저장 용량이 부족하여 당직표를 저장하지 않았습니다. 백업 후 사진 용량을 확인하세요.');
  try{const saved=saveFacilityData(raw,snapshot.revision);return {ok:true,revision:saved.revision,created}}catch(error){if(expectedRevision!==undefined||!/CONFLICT|충돌/.test(error.message)||attempt===2)throw error}
 }
}

// Generate the three visible months in one version-checked commit.
function generateDutyWindow(site,center,expectedRevision){
 if(!['one','two'].includes(site)||!DutyRosterCore.validMonth(center))throw Error('장소와 조회 월을 확인하세요.');
 const snap=getFacilityData();if(!snap.data||snap.revision!==Number(expectedRevision))throw Error('CONFLICT: 최신 데이터를 불러오세요.');
 const D=DutyRosterCore,duty=D.normalize(snap.data.dutyManagement),store=duty.sites[site],created=[];
 for(const month of D.windowMonths(center)){
  if(store.months[month])continue;
  const official=getDutyHolidays(month),prior=Object.keys(store.months).filter(m=>m<month).sort().pop(),later=Object.keys(store.months).filter(m=>m>month).sort()[0];
  let previous=prior?store.months[prior]:null;
  if(!previous&&later){
   const next=store.months[later],order=D.siteOrder(duty,site,'regularOrder'),holidays=D.holidayMap(month,official,store.settings);if(!order.length)throw Error('소속 직원을 등록하세요.');
   const dates=Object.keys(next.entries).sort(),nextId=dates.length?next.entries[dates[0]].primaryId:null;let count=0;
   for(let n=1;n<=31;n++){const date=month+'-'+String(n).padStart(2,'0');if(!D.validDate(date))continue;const day=new Date(date+'T12:00:00Z').getUTCDay();if(day>0&&day<6&&!holidays[date])count++}
   const first=Math.max(0,order.indexOf(nextId)),start=(first-count%order.length+order.length)%order.length;
   previous={lastPrimaryId:order[(start+order.length-1)%order.length],endLunchIndex:next.startLunchIndex||0,lastLunchId:next.previousLunchId||null};
  }
  store.months[month]=D.generateMonth(duty,site,month,official,previous);created.push(site+':'+month);
 }
 if(!created.length)return {ok:true,revision:snap.revision,created};
 if(!store.settings.anchorMonth||store.settings.anchorMonth>D.windowMonths(center)[0])store.settings.anchorMonth=D.windowMonths(center)[0];
 const raw=JSON.stringify({...snap.data,dutyManagement:duty});if(raw.length>1700000)throw Error('저장 용량이 부족합니다.');
 const saved=saveFacilityData(raw,snap.revision);return {ok:true,revision:saved.revision,created};
}
function installDutyMonthAutomation(){
 // Run this as the intended recipient in the Apps Script editor to authorize Calendar.
 const calendar=CalendarApp.getDefaultCalendar();if(!calendar)throw Error('알림을 받을 Google 캘린더를 찾을 수 없습니다.');
 PropertiesService.getScriptProperties().setProperty('dutyNotificationCalendarId',calendar.getId());
 if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='generateCurrentDutyMonths'))ScriptApp.newTrigger('generateCurrentDutyMonths').timeBased().atHour(4).everyDays(1).inTimezone('Asia/Seoul').create();
 return getDutyServiceStatus();
}
function notifyDutyWritten_(target,sites){
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  const p=PropertiesService.getScriptProperties(),calendarId=p.getProperty('dutyNotificationCalendarId');if(!calendarId)throw Error('자동작성 설치 함수를 실행해 캘린더 권한을 승인하세요.');
  const cal=CalendarApp.getCalendarById(calendarId);if(!cal)throw Error('알림 캘린더에 접근할 수 없습니다.');
  const key='dutyNotice:'+target,old=p.getProperty(key),now=new Date(),marker='facility-duty-written:'+target;
  let event=old?cal.getEventById(old):null;
  if(event)return {id:event.getId(),existing:true};
  // Find a previously created event if a prior run failed before saving its ID.
  const from=new Date(now.getTime()-86400000),until=new Date(now.getTime()+86400000);
  event=cal.getEvents(from,until,{search:'당직표작성됨'}).find(e=>(e.getDescription()||'').includes(marker));
  if(!event){const today=Utilities.formatDate(now,'Asia/Seoul','yyyy-MM-dd'),morning=new Date(today+'T09:05:00+09:00'),start=morning.getTime()>now.getTime()+5*60000?morning:new Date(now.getTime()+10*60000);event=cal.createEvent('당직표작성됨',start,new Date(start.getTime()+15*60000),{description:target+' 당직표 준비 완료 · '+sites.map(s=>s==='one'?'본관':'분관').join(', ')+'\n'+marker});}
  event.removeAllReminders();event.addPopupReminder(5);p.setProperty(key,event.getId());return {id:event.getId(),existing:false};
 }finally{lock.releaseLock()}
}
function generateCurrentDutyMonths(){
 const p=PropertiesService.getScriptProperties(),now=new Date(),today=Utilities.formatDate(now,'Asia/Seoul','yyyy-MM-dd');
 if(Number(today.slice(8))<20)return {created:[],skipped:'매월 20일 이후 다음 달 표를 확인합니다.'};
 try{
  const snapshot=getFacilityData();if(!snapshot.data)return;const duty=DutyRosterCore.normalize(snapshot.data.dutyManagement),target=DutyRosterCore.nextMonth(today.slice(0,7)),sites=['one','two'].filter(site=>duty.sites[site].settings.autoEnabled),requests=[];
  for(const site of sites){if(!duty.sites[site].settings.anchorMonth)throw Error((site==='one'?'본관':'분관')+' 자동작성 기준 월을 저장하세요.');requests.push({site,target,regenerate:false})}
  const result=requests.length?mutateDutyMonths_(requests):{created:[]};
  // Calendar is touched only after the canonical data commit succeeds. Failed notices retry next day.
  if(sites.length){const saved=getFacilityData();if(!sites.every(site=>saved.data.dutyManagement.sites[site].months[target]))throw Error('저장 확인 실패');notifyDutyWritten_(target,sites)}
  p.setProperty('dutyAutomationStatus',today+' · '+target+' · '+(sites.length?'작성·캘린더 알림 확인':'자동작성 장소 없음'));return result;
 }catch(error){p.setProperty('dutyAutomationStatus',today+' · 실패 · '+error.message);throw error}
}
