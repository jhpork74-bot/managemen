/** Apps Script 편집기에서 선택해 실행하는 통합 설치 함수입니다. */
function AUTO() {
 iniAssertEditor_();
 const account=String(Session.getEffectiveUser().getEmail()||'').trim().toLowerCase();
 const props=facilitySettings_(),lock=facilityLock_();
 try {
  const owner=props.getProperty('FACILITY_AUTO_OWNER');
  if(owner&&owner!==account)throw Error('AUTO를 처음 등록한 Google 계정으로 실행하세요. 계정마다 별도의 트리거가 만들어집니다.');
  if(!ScriptApp.getProjectTriggers().some(trigger=>trigger.getHandlerFunction()==='facilityAutoDaily_')){
   ScriptApp.newTrigger('facilityAutoDaily_').timeBased().atHour(6).everyDays(1).inTimezone('Asia/Seoul').create();
  }
  if(!owner)props.setProperty('FACILITY_AUTO_OWNER',account);
 }finally{lock.releaseLock()}
 return facilityAutoRun_(true);
}

/** 설치형 트리거는 등록한 관리자의 권한으로 실행됩니다. */
function facilityAutoDaily_() {
 const account=String(Session.getEffectiveUser().getEmail()||'').trim().toLowerCase();
 const admins=facilityAdminEmails_();
 if(!account||facilitySettings_().getProperty('FACILITY_AUTO_OWNER')!==account||(admins.length&&!admins.includes(account))){
  throw Error('AUTO 등록 계정이나 관리자 허용 목록을 확인하세요.');
 }
 return facilityAutoRun_(false);
}

function facilityAutoRun_(manual) {
 const lock=LockService.getUserLock();
 if(!lock.tryLock(1000)){
  console.info('AUTO가 이미 실행 중입니다.');
  return {ok:true,alreadyRunning:true};
 }
 const results=[];
 function record(label,work){
  try{
   const outcome=work();
   results.push({label,status:outcome.status,message:outcome.message});
   console.info(label+' · '+outcome.message);
  }catch(error){
   results.push({label,status:'error',message:'권한과 연결 설정을 확인하세요.'});
   console.warn(label+' · 실행 실패. 권한과 연결 설정을 확인하세요.');
  }
 }
 const ready=message=>({status:'ready',message});
 const pending=message=>({status:'pending',message});
 try{
  record('연결설정',()=>{
   if(manual){setupFacilityConnectionSettings();return ready('시트 준비 및 현재값 확인 완료');}
   return facilityConnectionSheet_(false).sheet?ready('연결설정 시트 확인'):pending('Apps Script 편집기에서 AUTO를 실행하여 연결설정 시트를 준비하세요.');
  });
  const registered=new Set(ScriptApp.getProjectTriggers().map(trigger=>trigger.getHandlerFunction()));
  const jobs=[
   ['보고용 시트 · 5분마다','runFacilityStorageMaintenance',installFacilityStorageMaintenance],
   ['종료 없는 반복업무 · 매일 03시대','maintainNoEndRepeats',installNoEndRepeatMaintenance],
   ['업무 알림 · 매시간','syncFacilityCalendar',installFacilityCalendarReminders],
   ['시설관리 배움터 · 매일 07시대','refreshFacilityLearningDaily',installFacilityLearningDailyUpdate],
   ['당직 자동작성 · 매일 04시대 확인','generateCurrentDutyMonths',installDutyMonthAutomation]
  ];
  for(const [label,handler,install] of jobs){
   record(label,()=>{
    if(handler==='generateCurrentDutyMonths'&&!facilitySettings_().getProperty(INI_PROPERTY_KEYS.HOLIDAY_API_KEY)){
     return pending('당직인원관리에서 공휴일 API 인증키를 등록하세요.');
    }
    if(registered.has(handler))return ready('기존 자동 실행 등록 확인');
    // The learning installer requires the active editor user. A trigger has only an effective user.
    if(handler==='refreshFacilityLearningDaily'&&!manual){
     ScriptApp.newTrigger(handler).timeBased().atHour(7).everyDays(1).inTimezone('Asia/Seoul').create();
    }else install();
    return ready('자동 실행 등록 완료');
   });
  }
  record('사진 저장 폴더',()=>{
   const props=facilitySettings_();
   const folderKeys=['JANDI_IMAGE_FOLDER_ID','REPAIRS_IMAGE_FOLDER_ID','CSFS_IMAGE_FOLDER_ID','ASSET_IMAGE_FOLDER_ID'];
   const fallback=props.getProperty(INI_PROPERTY_KEYS.JANDI_IMAGE_FOLDER_ID);
   let count=0;
   for(const key of folderKeys){
    const folderId=props.getProperty(INI_PROPERTY_KEYS[key])||(key==='REPAIRS_IMAGE_FOLDER_ID'?fallback:null);
    if(!folderId)continue;
    if(DriveApp.getFolderById(folderId).isTrashed())throw Error('휴지통에 있는 폴더');
    count++;
   }
   return count===folderKeys.length?ready('설정된 폴더 읽기 확인'):pending(count+'개 연결 확인 · 사용하는 기능의 폴더를 연결설정 시트에 입력하세요.');
  });
  record('잔디 알림 설정',()=>{
   const status=getDutyJandiStatus();
   if(!status.enabled)return pending('잔디 사용 시 연결 설정에서 활성화 상태를 확인하세요.');
   if(!status.baseConfigured||!(status.mode==='topic'?status.topicConfigured&&status.testPassed:status.testConfigured)||!status.imageReady){
    return pending('웹앱 주소, 발송 대상 및 이미지 준비 상태를 확인하세요.');
   }
   return ready('저장된 발송 설정 확인');
  });
  const result={ok:results.every(item=>item.status!=='error'),results};
  console.info('AUTO 점검 · '+results.filter(item=>item.status==='ready').length+'개 확인 · '+results.filter(item=>item.status==='pending').length+'개 설정 대기 · '+results.filter(item=>item.status==='error').length+'개 오류');
  return result;
 }finally{lock.releaseLock()}
}
