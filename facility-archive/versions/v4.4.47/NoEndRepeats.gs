/** Rolling occurrences for no-end tasks; uses the existing JSON/revision storage. */
function installNoEndRepeatMaintenance(){
  if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='maintainNoEndRepeats')){
    ScriptApp.newTrigger('maintainNoEndRepeats').timeBased().atHour(3).everyDays(1).inTimezone('Asia/Seoul').create();
  }
  console.log(JSON.stringify(maintainNoEndRepeats()));
}
function getNoEndRepeatStatus(){
  return {enabled:ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='maintainNoEndRepeats')};
}
function maintainNoEndRepeats(){
  const today=Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd');
  for(let attempt=0;attempt<3;attempt++){
    const snapshot=getFacilityData();if(!snapshot.data)return {added:0};
    const result=extendNoEndRepeats_(snapshot.data,today);
    if(!result.changed)return {added:0};
    const raw=JSON.stringify(result.data);
    if(raw.length>1700000)throw Error('반복업무 보충 중단: 저장 용량이 부족합니다. 기존 데이터는 유지됩니다. JSON 백업 후 사진 용량과 종료한 반복업무를 확인하세요.');
    try{
      const saved=saveFacilityData(raw,snapshot.revision);
      if(typeof syncFacilityCalendar==='function'){
        try{syncFacilityCalendar()}catch(error){console.warn('일정 저장됨. 캘린더 동기화는 별도 재시도 필요: '+error.message)}
      }
      return {added:result.added,revision:saved.revision};
    }catch(error){if(!/CONFLICT|충돌/.test(String(error.message))||attempt===2)throw error}
  }
}
function noEndDate_(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?date:null;
}
function noEndOccurrence_(start,frequency,n){
  const date=new Date(start);
  if(frequency==='monthly'){
    date.setUTCDate(1);date.setUTCMonth(start.getUTCMonth()+n);
    const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0,12)).getUTCDate();
    date.setUTCDate(Math.min(start.getUTCDate(),last));
  }else date.setUTCDate(start.getUTCDate()+n*(frequency==='weekly'?7:1));
  return date.toISOString().slice(0,10);
}
function noEndBusinessDate_(value,frequency){
  const date=noEndDate_(value),day=date.getUTCDay();
  if(day===0||day===6){if(frequency==='daily')return '';date.setUTCDate(date.getUTCDate()+(day===6?2:1))}
  return date.toISOString().slice(0,10);
}
function extendNoEndRepeats_(original,today){
  const now=noEndDate_(today);if(!now)throw Error('날짜 형식 오류');
  const horizonDate=new Date(now);horizonDate.setUTCDate(now.getUTCDate()+90);const horizon=horizonDate.toISOString().slice(0,10);
  const schedules=original.repeatSchedules;if(!schedules||typeof schedules!=='object'||Array.isArray(schedules))return {changed:false,added:0,data:original};
  const tasks=[...original.tasks],updated={...schedules};let added=0,changed=false;
  const groups=new Set(tasks.map(t=>String(t.repeatGroup||'')));
  const usedIds=new Set(tasks.map(t=>String(t.id)));
  for(const [key,config] of Object.entries(schedules)){
    if(!config||config.active!==true||config.noEnd!==true)continue;
    const start=noEndDate_(config.start),through=noEndDate_(config.generatedThrough);
    if(!start||!through||through<start||!['daily','weekly','monthly'].includes(config.frequency)||!config.template)throw Error('종료없음 반복 설정 오류: '+key);
    const group=String(config.group||key);
    // A deleted full group is a cancellation. Never recreate it.
    if(!groups.has(group)){updated[key]={...config,active:false,cancelledAt:new Date().toISOString()};changed=true;continue}
    if(config.generatedThrough>=horizon)continue;
    let n=config.frequency==='monthly'?(through.getUTCFullYear()-start.getUTCFullYear())*12+through.getUTCMonth()-start.getUTCMonth():Math.floor((through-start)/86400000/(config.frequency==='weekly'?7:1));
    let date=noEndOccurrence_(start,config.frequency,n);
    while(date<=config.generatedThrough){n++;date=noEndOccurrence_(start,config.frequency,n)}
    let issuedThrough=horizon;
    while(date<=horizon){
      const actualDate=config.weekdaysOnly===true?noEndBusinessDate_(date,config.frequency):date;
      if(!actualDate){updated[key]={...config,generatedThrough:date};issuedThrough=date;n++;date=noEndOccurrence_(start,config.frequency,n);continue}
      if(added>=500){issuedThrough=updated[key]&&updated[key].generatedThrough||config.generatedThrough;break}
      let id='noend:'+group+':'+date;let suffix=0;while(usedIds.has(id))id='noend:'+group+':'+date+':'+(++suffix);
      usedIds.add(id);tasks.push({...config.template,id,date:actualDate,state:'예정',frequency:config.frequency,repeatGroup:group,repeatStart:config.start,repeatUntil:'',repeatNoEnd:true,repeatWeekdaysOnly:config.weekdaysOnly===true});
      added++;updated[key]={...config,generatedThrough:date};issuedThrough=date;n++;date=noEndOccurrence_(start,config.frequency,n);
    }
    if(date>horizon)issuedThrough=horizon;
    if(issuedThrough!==config.generatedThrough){updated[key]={...config,generatedThrough:issuedThrough};changed=true}
  }
  return {changed,added,data:changed?{...original,tasks,repeatSchedules:updated}:original};
}
/** Optional one-time migration. Run only after exporting a complete JSON backup. */
function applyWeekdaysToExistingRepeats(){
  const today=Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd');
  for(let attempt=0;attempt<3;attempt++){
    const snapshot=getFacilityData();if(!snapshot.data)return {removed:0,moved:0};
    const result=convertExistingRepeatsToWeekdays_(snapshot.data,today);
    if(!result.changed){console.log('평일 반복 적용 대상 없음');return {removed:0,moved:0}}
    const raw=JSON.stringify(result.data);if(raw.length>1700000)throw Error('저장 용량이 부족합니다. 원본 데이터는 유지됩니다.');
    try{
      const saved=saveFacilityData(raw,snapshot.revision);
      if(typeof syncFacilityCalendar==='function'){try{syncFacilityCalendar()}catch(error){console.warn('업무 저장 완료. 캘린더 동기화 재시도 필요: '+error.message)}}
      const summary={removed:result.removed,moved:result.moved,revision:saved.revision};console.log(JSON.stringify(summary));return summary;
    }catch(error){if(!/CONFLICT|충돌/.test(String(error.message))||attempt===2)throw error}
  }
}
function convertExistingRepeatsToWeekdays_(original,today){
  let removed=0,moved=0,changed=false;const tasks=[];
  for(const task of original.tasks){
    // Checklist reservations use a different workflow and have no repeatStart.
    if(!task.repeatGroup||!task.repeatStart||task.state==='완료'||!noEndDate_(task.date)||task.date<today){tasks.push(task);continue}
    const frequency=['daily','weekly','monthly'].includes(task.frequency)?task.frequency:'daily';
    const date=noEndBusinessDate_(task.date,frequency);
    if(!date){removed++;changed=true;continue}
    if(!task.repeatNoEnd&&task.repeatUntil&&date>task.repeatUntil){removed++;changed=true;continue}
    if(date!==task.date)moved++;
    if(date!==task.date||task.repeatWeekdaysOnly!==true)changed=true;
    tasks.push({...task,date,repeatWeekdaysOnly:true});
  }
  const schedules={...(original.repeatSchedules||{})};
  for(const [key,cfg] of Object.entries(schedules)){
    if(cfg&&cfg.active===true&&cfg.noEnd===true&&cfg.weekdaysOnly!==true){schedules[key]={...cfg,weekdaysOnly:true};changed=true}
  }
  return {changed,removed,moved,data:changed?{...original,tasks,...(original.repeatSchedules?{repeatSchedules:schedules}:{})}:original};
}
