/** Optional Google Calendar notifications. No MailApp, GmailApp or guests. */
function installFacilityCalendarReminders(){
  const props=PropertiesService.getScriptProperties();
  if(!props.getProperty('facilityReminderCalendarId')){
    const cal=CalendarApp.createCalendar('시설관리 업무 알림',{timeZone:'Asia/Seoul',summary:'시설관리 웹앱 전용 알림. 일정 수정은 웹앱에서 하세요.'});
    props.setProperty('facilityReminderCalendarId',cal.getId());
  }
  if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='syncFacilityCalendar')){
    ScriptApp.newTrigger('syncFacilityCalendar').timeBased().everyHours(1).create();
  }
  console.log(JSON.stringify(syncFacilityCalendar()));
}
function syncFacilityCalendar(){
  const props=PropertiesService.getScriptProperties(),calendarId=props.getProperty('facilityReminderCalendarId');
  if(!calendarId)return {enabled:false};
  const lock=LockService.getScriptLock();lock.waitLock(25000);
  try{
    const cal=CalendarApp.getCalendarById(calendarId);
    if(!cal)throw Error('알림 전용 캘린더를 찾을 수 없습니다. 연결 설정을 확인하세요.');
    const snapshot=readFacilityData_();if(!snapshot.data)return {enabled:true,count:0};
    const tasks=snapshot.data.tasks||[],today=Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd');
    const ss=SpreadsheetApp.openById(SPREADSHEET_ID),sh=ss.getSheetByName('_일정알림연결')||ss.insertSheet('_일정알림연결');
    if(sh.getLastRow()===0)sh.appendRow(['업무ID','캘린더이벤트ID','내용서명']);
    const records=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,3).getValues():[];
    const index=new Map(records.map((r,i)=>[String(r[0]),{row:i+2,eventId:r[1],signature:r[2]}]));
    const active=new Map(tasks.filter(t=>t.state!=='완료'&&/^\d{4}-\d{2}-\d{2}$/.test(t.date)&&t.date>=today).map(t=>[String(t.id),t]));
    let changed=0,pending=0;
    // Cap each pass to keep large recurrence batches within execution limits.
    for(const [id,rec] of index){
      if(active.has(id)||!rec.eventId)continue;
      if(changed>=40){pending++;continue}
      const event=cal.getEventById(rec.eventId);
      if(event&&event.getStartTime().getTime()>Date.now())event.deleteEvent();
      sh.getRange(rec.row,2,1,2).clearContent();changed++;
    }
    for(const [id,t] of active){
      const signature=JSON.stringify([t.name,t.date,t.place||'',t.note||'',t.frequency||'daily']);
      const rec=index.get(id);
      // The app exclusively manages this calendar; manual calendar edits are unsupported.
      if(rec&&rec.eventId&&rec.signature===signature)continue;
      if(changed>=40){pending++;continue}
      const start=new Date(t.date+'T09:00:00+09:00'),end=new Date(start.getTime()+30*60000);
      const marker='FACILITY_TASK:'+id;
      const description=marker+'\n'+(t.note||'')+'\n업무 분류: '+(({daily:'일일',weekly:'주간',monthly:'월간'})[t.frequency]||'일일');
      let event=rec&&rec.eventId?cal.getEventById(rec.eventId):null;
      // Recover a creation whose event succeeded but whose mapping write failed.
      if(!event)event=cal.getEvents(start,end,{search:marker}).find(e=>e.getDescription().split('\n')[0]===marker)||null;
      if(!event)event=cal.createEvent(String(t.name),start,end,{description,location:String(t.place||'')});
      else event.setTitle(String(t.name)).setTime(start,end).setDescription(description).setLocation(String(t.place||''));
      event.removeAllReminders();event.addPopupReminder(1440);
      const row=rec?rec.row:sh.getLastRow()+1;
      sh.getRange(row,1,1,3).setValues([[id,event.getId(),signature]]);changed++;
    }
    return {enabled:true,count:active.size,changed,pending};
  }finally{lock.releaseLock()}
}
/** Stop only this integration. Existing calendar events remain until removed by the user. */
function uninstallFacilityCalendarReminders(){
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='syncFacilityCalendar').forEach(t=>ScriptApp.deleteTrigger(t));
  PropertiesService.getScriptProperties().deleteProperty('facilityReminderCalendarId');
}
