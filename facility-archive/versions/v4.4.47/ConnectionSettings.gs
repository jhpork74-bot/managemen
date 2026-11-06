/** Only six non-secret connection settings are editable here. No automatic onEdit application. */
const FACILITY_CONNECTION_SHEET='연결설정';
const FACILITY_CONNECTION_MARKER='시설관리 연결설정 v1';
const FACILITY_CONNECTION_ROWS=Object.freeze([
 ['SPREADSHEET_ID','업무 데이터 원본 시트','기존 저장 데이터가 있으면 단순 교체 불가. 별도 이관 필요'],
 ['JANDI_IMAGE_FOLDER_ID','잔디 달력 JPG 저장 폴더','새 폴더 ID 또는 Drive 폴더 주소. 기존 사진은 그대로 보존'],
 ['facilityReminderCalendarId','업무 사전알림 캘린더','기존 연결이 있으면 별도 이벤트 이관 필요'],
 ['dutyNotificationCalendarId','당직표 작성 알림 캘린더','기존 연결이 있으면 별도 이벤트 이관 필요'],
 ['JANDI_WEB_APP_URL','웹앱 실행 주소','현재 사용하는 쿼리 없는 /exec 주소'],
 ['JANDI_ADMIN_EMAIL','관리자 Google 계정 · 복수 가능','개인 이메일, 회사 이메일을 쉼표로 함께 입력. 등록 후 계정 전환마다 바꿀 필요 없음'],
 ['REPAIRS_IMAGE_FOLDER_ID','고장·공사 사진 저장 폴더','새 사진 저장용. 별도 미지정이면 잔디 JPG 폴더 사용. 기존 사진 보존'],
 ['CSFS_IMAGE_FOLDER_ID','CSFS 사진 저장 폴더','사용자가 지정한 회사 Drive 폴더. 미리 채운 C열을 확인하고 적용하세요.'],
 ['ASSET_IMAGE_FOLDER_ID','재물조사 사진 저장 폴더','회사 Drive의 재물조사 폴더 ID 또는 폴더 주소를 입력하세요. 기존 사진은 보존합니다.']
]);
function facilityConnectionCurrent_(key){return facilitySettings_().getProperty(key)||(key==='SPREADSHEET_ID'?INI_LEGACY_SPREADSHEET_ID:key==='REPAIRS_IMAGE_FOLDER_ID'?facilitySettings_().getProperty('JANDI_IMAGE_FOLDER_ID')||'':'')}
function facilityConnectionInput_(key,current){return key==='CSFS_IMAGE_FOLDER_ID'?facilitySettings_().getProperty(key)||'CSFS_FOLDER_PLACEHOLDER':key==='REPAIRS_IMAGE_FOLDER_ID'?facilitySettings_().getProperty(key)||'':current}
function facilityConnectionBook_(){return SpreadsheetApp.openById(facilitySpreadsheetId_())}
function facilityConnectionSheet_(required){
 const book=facilityConnectionBook_(),sheet=book.getSheetByName(FACILITY_CONNECTION_SHEET);
 if(sheet&&sheet.getRange('A1').getValue()!==FACILITY_CONNECTION_MARKER)throw Error('같은 이름의 다른 연결설정 시트가 있습니다. 기존 내용을 보존하기 위해 중단했습니다.');
 if(!sheet&&required)throw Error('먼저 setupFacilityConnectionSettings를 한 번 실행하세요.');
 return {book,sheet};
}
function facilityConnectionRead_(sheet,allowMissing){
 const count=Math.max(0,sheet.getLastRow()-4);if(count>100)throw Error('설정 행이 너무 많습니다. 연결설정 시트를 확인하세요.');
 const range=count?sheet.getRange(5,1,count,6):null,values=range?range.getValues():[],formulas=range?range.getFormulas():[],rows={},known=new Set(FACILITY_CONNECTION_ROWS.map(r=>r[0]));
 for(let i=0;i<values.length;i++){
  const key=String(values[i][1]||'').trim();if(!key)continue;
  if(!known.has(key))throw Error('알 수 없는 설정 키가 있습니다. B열의 설정 키는 수정하지 마세요.');
  if(rows[key])throw Error('중복 설정 키가 있습니다. 행을 중복해서 넣지 마세요.');
  if(formulas[i].some(f=>f))throw Error('설정 행에는 수식을 넣을 수 없습니다. ID와 주소를 일반 텍스트로 입력하세요.');
  rows[key]={row:i+5,proposal:String(values[i][2]||'').trim(),baseline:String(values[i][3]||'').trim()};
 }
 if(!allowMissing&&Object.keys(rows).length!==FACILITY_CONNECTION_ROWS.length)throw Error('필수 설정 행이 누락되었습니다. setupFacilityConnectionSettings를 실행하여 설정 행을 확인하세요.');
 return rows;
}
function setupFacilityConnectionSettings(){
 iniAssertEditor_();const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  let {book,sheet}=facilityConnectionSheet_(false);const created=!sheet;
  if(!sheet){
   sheet=book.insertSheet(FACILITY_CONNECTION_SHEET);
   sheet.getRange('A1').setValue(FACILITY_CONNECTION_MARKER);
   sheet.getRange('A2').setValue('노란 C열만 수정 → 변경 미리보기 → 설정 적용. 빈 칸은 현재 값 유지. 자동 적용하지 않습니다.');
   sheet.getRange('A3').setValue('API 인증키·잔디 웹훅은 기존 스크립트 속성에서 관리하며 이 시트에 적지 않습니다.');
   sheet.getRange(4,1,1,6).setValues([['항목','설정 키 · 수정하지 마세요','변경할 값 · 여기에 입력','현재 적용값 · 수정하지 마세요','설명','상태']]);
   sheet.getRange(5,1,FACILITY_CONNECTION_ROWS.length,6).setNumberFormat('@').setValues(FACILITY_CONNECTION_ROWS.map(([key,label,note])=>{const current=facilityConnectionCurrent_(key);return [label,key,facilityConnectionInput_(key,current),current,note,'현재 설정 불러옴']}));
   sheet.setFrozenRows(4);sheet.getRange(4,1,1,6).setFontWeight('bold').setBackground('#dbeafe');
   sheet.getRange(5,3,FACILITY_CONNECTION_ROWS.length,1).setBackground('#fff2cc');
   sheet.getRange(1,1,4+FACILITY_CONNECTION_ROWS.length,6).setWrap(true);sheet.setColumnWidth(1,190);sheet.setColumnWidth(2,240);sheet.setColumnWidths(3,2,340);sheet.setColumnWidth(5,390);sheet.setColumnWidth(6,230);
  }else{
   const rows=facilityConnectionRead_(sheet,true);
   const missing=FACILITY_CONNECTION_ROWS.filter(([key])=>!rows[key]);
   if(missing.some(([key])=>!['REPAIRS_IMAGE_FOLDER_ID','CSFS_IMAGE_FOLDER_ID','ASSET_IMAGE_FOLDER_ID'].includes(key)))throw Error('기존 필수 설정 행이 누락되었습니다. 삭제한 행을 복구하세요.');
   for(const [key,label,note] of missing){const row=sheet.getLastRow()+1,current=facilityConnectionCurrent_(key);sheet.getRange(row,1,1,6).setNumberFormat('@').setValues([[label,key,facilityConnectionInput_(key,current),current,note,'새 설정 항목 추가']]);sheet.getRange(row,3).setBackground('#fff2cc');rows[key]={row};}
   for(const [key,r] of Object.entries(rows)){
    if(key==='JANDI_ADMIN_EMAIL'){
     sheet.getRange(r.row,1).setValue('관리자 Google 계정 · 복수 가능');sheet.getRange(r.row,5).setValue('개인 이메일, 회사 이메일을 쉼표로 함께 입력. 등록 후 계정 전환마다 바꿀 필요 없음');
     if(r.proposal===r.baseline)sheet.getRange(r.row,3).setNumberFormat('@').setValue(facilityConnectionCurrent_(key));
    }
    sheet.getRange(r.row,4).setNumberFormat('@').setValue(facilityConnectionCurrent_(key));
    sheet.getRange(r.row,6).setValue('현재값 새로고침 · C열 입력 보존');
   }
  }
  const result={ok:true,created,sheet:FACILITY_CONNECTION_SHEET};console.info('연결설정 시트 준비 완료. C열만 수정한 뒤 previewFacilityConnectionSettings → applyFacilityConnectionSettings를 실행하세요.');return result;
 }finally{lock.releaseLock()}
}
function facilityConnectionPlan_(sheet){
 const rows=facilityConnectionRead_(sheet),updates={};
 for(const [key,r] of Object.entries(rows)){
  const current=facilityConnectionCurrent_(key);
  if(r.baseline!==current)throw Error('다른 곳에서 설정이 변경됐습니다. setupFacilityConnectionSettings로 현재값을 새로고침한 뒤 다시 확인하세요.');
  const value=iniNormalize_(key,r.proposal);if(value&&value!==current)updates[key]=value;
 }
 return {rows,updates};
}
function previewFacilityConnectionSettings(){
 iniAssertEditor_();const {sheet}=facilityConnectionSheet_(true),{rows,updates}=facilityConnectionPlan_(sheet);
 for(const [key,r] of Object.entries(rows))sheet.getRange(r.row,6).setValue(updates[key]?'미리보기: 변경 예정':'현재 값 유지');
 const result={changes:Object.keys(updates),applied:false};console.info(JSON.stringify(result));return result;
}
function applyFacilityConnectionSettings(){
 iniAssertEditor_();const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  const {sheet}=facilityConnectionSheet_(true),{rows,updates}=facilityConnectionPlan_(sheet);
  const result=iniApplyUnderLock_(updates);
  try{for(const [key,r] of Object.entries(rows)){
   sheet.getRange(r.row,4).setNumberFormat('@').setValue(facilityConnectionCurrent_(key));
   sheet.getRange(r.row,6).setValue((updates[key]?'적용 완료 · ':'유지 · ')+Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd HH:mm:ss'));
  }}catch(error){console.info('연결 설정 적용은 완료됐지만 시트 상태 표시 갱신에 실패했습니다. setupFacilityConnectionSettings로 현재값을 새로고침하세요.');return {...result,sheetRefreshPending:true}}
  return result;
 }finally{lock.releaseLock()}
}
/** Custom menu is available only when this project is bound to the operational spreadsheet. */
function onOpen(){
 try{SpreadsheetApp.getUi().createMenu('시설관리 설정').addItem('연결설정 시트 만들기·현재값 새로고침','setupFacilityConnectionSettings').addItem('변경 미리보기','previewFacilityConnectionSettings').addItem('설정 적용','applyFacilityConnectionSettings').addToUi()}catch(error){console.info('독립형 프로젝트는 Apps Script 편집기에서 설정 함수를 실행하세요.')}
}
