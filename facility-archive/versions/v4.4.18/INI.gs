/** 설정 원본 INI.CS와 동일합니다. Apps Script에는 스크립트 INI.gs 한 개만 추가하세요.
 * 빈 문자열은 현재 ScriptProperties 설정 유지. 수정 후 previewIniSettings → applyIniSettings 실행.
 * 비밀 키/웹훅은 아래에 적지 말고 기존 스크립트 속성에서 관리하세요. */
const INI_SETTINGS = Object.freeze({
  REPAIRS_IMAGE_FOLDER_ID: '',        // 고장·공사 사진 폴더. 미지정이면 잔디 JPG 폴더 사용
  SPREADSHEET_ID: '',                 // 원본 업무 시트. 기존 데이터가 있으면 다른 시트로 변경 차단
  JANDI_IMAGE_FOLDER_ID: '',           // 잔디 달력 JPG 저장 폴더 ID 또는 Drive 폴더 주소
  facilityReminderCalendarId: '',      // 업무 사전알림 전용 캘린더 ID
  dutyNotificationCalendarId: '',      // 당직표 작성 알림 캘린더 ID
  JANDI_WEB_APP_URL: '',               // 기존 배포의 /exec 주소
  JANDI_ADMIN_EMAIL: ''                // Apps Script를 실행하는 관리자 Google 계정
});
// 이 값은 구버전 Code.gs에서 옮긴 기존 연결입니다. 최초 설치 시 보존하며 일반 변경은 위에서 합니다.
const INI_LEGACY_SPREADSHEET_ID = 'PASTE_YOUR_SPREADSHEET_ID_HERE';
const INI_PROPERTY_KEYS = Object.freeze({
  REPAIRS_IMAGE_FOLDER_ID:'REPAIRS_IMAGE_FOLDER_ID',
  SPREADSHEET_ID:'SPREADSHEET_ID', JANDI_IMAGE_FOLDER_ID:'JANDI_IMAGE_FOLDER_ID',
  facilityReminderCalendarId:'facilityReminderCalendarId', dutyNotificationCalendarId:'dutyNotificationCalendarId',
  JANDI_WEB_APP_URL:'JANDI_WEB_APP_URL', JANDI_ADMIN_EMAIL:'JANDI_ADMIN_EMAIL',
  HOLIDAY_API_KEY:'dutyHolidayApiKey', JANDI_TEST_WEBHOOK_URL:'JANDI_TEST_WEBHOOK_URL',
  JANDI_TOPIC_WEBHOOK_URL:'JANDI_TOPIC_WEBHOOK_URL'
});
function facilitySettings_(){return PropertiesService.getScriptProperties()}
function facilitySpreadsheetId_(){return facilitySettings_().getProperty(INI_PROPERTY_KEYS.SPREADSHEET_ID)||INI_LEGACY_SPREADSHEET_ID}
function iniAssertEditor_(){
 const active=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
 const effective=String(Session.getEffectiveUser().getEmail()||'').trim().toLowerCase();
 const admin=String(facilitySettings_().getProperty('JANDI_ADMIN_EMAIL')||'').trim().toLowerCase();
 if(!active||active!==effective||(admin&&active!==admin))throw Error('현재 관리자 계정의 Apps Script 편집기에서 실행하세요. 웹앱에서는 설정을 변경할 수 없습니다.');
}
function iniNormalize_(key,value){
 let v=String(value||'').trim();if(!v)return '';
 if(key==='JANDI_IMAGE_FOLDER_ID'||key==='REPAIRS_IMAGE_FOLDER_ID'){
  const m=v.match(/^https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)(?:[?#].*)?$/);if(m)v=m[1];
 }
 if(['SPREADSHEET_ID','JANDI_IMAGE_FOLDER_ID','REPAIRS_IMAGE_FOLDER_ID'].includes(key)&&!/^[A-Za-z0-9_-]{10,200}$/.test(v))throw Error(key+'의 ID 또는 폴더 주소를 확인하세요.');
 if(key==='JANDI_WEB_APP_URL'&&!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(v))throw Error('웹앱은 쿼리 없는 /exec 주소를 입력하세요.');
 if((key.endsWith('CalendarId')||key==='JANDI_ADMIN_EMAIL')&&(!/^[^\s@]+@[^\s@]+$/.test(v)||v.length>300))throw Error(key+' 형식을 확인하세요.');
 return v;
}
function iniPlan_(){
 const p=facilitySettings_(),updates={};
 for(const key of Object.keys(INI_SETTINGS)){const v=iniNormalize_(key,INI_SETTINGS[key]);if(v&&v!==(p.getProperty(key)||(key==='SPREADSHEET_ID'?INI_LEGACY_SPREADSHEET_ID:'')))updates[key]=v}
 return updates;
}
function previewIniSettings(){
 iniAssertEditor_();const changes=Object.keys(iniPlan_());
 const result={changes,emptyMeans:'현재 값 유지',secrets:'인증키·웹훅은 스크립트 속성 유지',photoStorage:'고장·공사 사진은 업무 JSON 안에 저장; Drive 폴더는 잔디 달력 JPG 전용'};
 console.info(JSON.stringify(result));return result;
}
function applyIniSettings(){
 iniAssertEditor_();const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{return iniApplyUnderLock_(iniPlan_())}finally{lock.releaseLock()}
}
/** Shared by the editor and settings-sheet entry points; caller holds ScriptLock. */
function iniApplyUnderLock_(updates){
  const p=facilitySettings_();
  if(updates.JANDI_IMAGE_FOLDER_ID||updates.REPAIRS_IMAGE_FOLDER_ID){
   const activeUpload=Object.entries(p.getProperties()).some(([k,v])=>{if(!k.startsWith('REPAIR_UPLOAD_'))return false;try{const r=JSON.parse(v);return r.state==='pending'&&r.expiresAt>Date.now()}catch(e){return false}});
   if(activeUpload)throw Error('고장·공사 사진 저장 중입니다. 완료 후 폴더를 변경하세요.');
  }
  if(updates.REPAIRS_IMAGE_FOLDER_ID){const folder=DriveApp.getFolderById(updates.REPAIRS_IMAGE_FOLDER_ID);if(folder.isTrashed())throw Error('휴지통의 폴더는 사용할 수 없습니다.');}
  if(updates.SPREADSHEET_ID&&(p.getProperty('facilityCommit')||p.getProperty('facilityRevision')))throw Error('기존 데이터의 저장 확정 정보가 있어 시트 교체를 중단했습니다. 원본과 확정 정보를 함께 이관하는 별도 작업이 필요합니다.');
  for(const leaseKey of ['facilityCalendarLease','facilityReportsLease']){const lease=JSON.parse(p.getProperty(leaseKey)||'null');if(lease&&lease.expiresAt>Date.now())throw Error('일정 또는 보고 작업 중입니다. 완료 후 설정을 다시 적용하세요.')}
  if(updates.JANDI_IMAGE_FOLDER_ID){
   const pending=Object.entries(p.getProperties()).some(([k,v])=>{if(!k.startsWith('JANDI_RCPT_'))return false;try{const r=JSON.parse(v);return r.state==='pending'&&Date.now()-r.at<120000}catch(e){return false}});
   if(pending)throw Error('잔디 이미지 전송 중입니다. 완료 후 폴더를 변경하세요.');
   const folder=DriveApp.getFolderById(updates.JANDI_IMAGE_FOLDER_ID);if(folder.isTrashed())throw Error('휴지통의 폴더는 사용할 수 없습니다.');
  }
  for(const key of ['facilityReminderCalendarId','dutyNotificationCalendarId'])if(updates[key]){
   if(p.getProperty(key))throw Error('기존 이벤트 연결이 있어 '+key+' 교체를 중단했습니다. 중복 알림 방지를 위한 연결 이관이 필요합니다.');
   if(!CalendarApp.getCalendarById(updates[key]))throw Error('지정한 캘린더에 접근할 수 없습니다.');
  }
  if(updates.SPREADSHEET_ID)SpreadsheetApp.openById(updates.SPREADSHEET_ID).getId();
  if(!Object.keys(updates).length){console.info('변경할 설정이 없습니다. 현재 연결을 유지합니다.');return {ok:true,changed:[]}}
  const previous={};for(const k of Object.keys(updates))previous[k]=p.getProperty(k);
  p.setProperty('INI_PREVIOUS_SETTINGS',JSON.stringify({at:new Date().toISOString(),previous,applied:updates}));
  p.setProperties(updates,false);
  console.info('설정 적용 완료: '+Object.keys(updates).join(', ')+' · 기존 파일과 업무 데이터는 이동·삭제하지 않았습니다.');
  return {ok:true,changed:Object.keys(updates)};
}
function showIniSettingsStatus(){
 iniAssertEditor_();const p=facilitySettings_(),configured={};for(const [label,key] of Object.entries(INI_PROPERTY_KEYS))configured[label]=!!(p.getProperty(key)||(key==='SPREADSHEET_ID'?INI_LEGACY_SPREADSHEET_ID:''));
 console.info(JSON.stringify({configured,valuesHidden:true}));return {configured,valuesHidden:true};
}
