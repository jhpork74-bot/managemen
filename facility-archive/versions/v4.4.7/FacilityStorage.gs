/** 원본 JSON 저장·버전 검사·저장 잠금. 운영 데이터 연결은 Code.gs의 기존 ID를 사용합니다. */
function getFacilityData(){
 const lock=facilityLock_();
 try{return readFacilityData_()}finally{lock.releaseLock()}
}
function readFacilityData_(){
  const props=PropertiesService.getScriptProperties(),ss=SpreadsheetApp.openById(SPREADSHEET_ID);
  const pointer=props.getProperty('facilityCommit');
  if(pointer){
    const commit=JSON.parse(pointer);
    if(!['_앱데이터_슬롯A','_앱데이터_슬롯B'].includes(commit.sheet)||!Number.isSafeInteger(commit.revision))throw Error('저장 확정 정보 오류. 백업을 확인하세요.');
    const raw=readJsonSheet_(ss.getSheetByName(commit.sheet));
    if(raw===null)throw Error('확정 데이터가 없습니다. 저장 중단 후 백업을 확인하세요.');
    return {revision:commit.revision,data:JSON.parse(raw),reportPending:Number(props.getProperty('facilityReportsRevision')||'-1')!==commit.revision};
  }
  const raw=readJsonSheet_(ss.getSheetByName('_앱데이터'));
  return {revision:Number(props.getProperty('facilityRevision')||'0'),data:raw===null?null:JSON.parse(raw),reportPending:false};
}
function readJsonSheet_(sheet){
  if(!sheet)return null;const count=Number(sheet.getRange('B1').getValue())||0;
  if(!count)return null;if(!Number.isSafeInteger(count)||count<0||count>=10000)throw Error('JSON 조각 수 오류');
  return sheet.getRange(2,1,count,1).getValues().map(row=>String(row[0])).join('');
}
function writeJsonSheet_(ss,name,raw,revision){
  const sheet=ss.getSheetByName(name)||ss.insertSheet(name),chunks=raw.match(/[\s\S]{1,30000}/g)||[''];
  sheet.clearContents();sheet.getRange(1,1,1,3).setValues([['앱 JSON 조각 수',chunks.length,revision]]);
  sheet.getRange(2,1,chunks.length,1).setValues(chunks.map(x=>[x]));
}
function saveFacilityData(raw,expectedRevision){
  const lock=facilityLock_();let committedRevision;
  try{
    const props=PropertiesService.getScriptProperties(),current=readFacilityData_();
    if(current.revision!==Number(expectedRevision))throw Error('CONFLICT: 다른 기기가 먼저 저장했습니다. 임시본을 백업하고 새로고침하세요.');
    if(typeof raw!=='string'||raw.length>2000000)throw Error('데이터 크기 제한을 초과했습니다.');
    const d=JSON.parse(raw);
    if(!Array.isArray(d.items)||!Array.isArray(d.tasks)||!d.checks||!Array.isArray(d.stock)||!Array.isArray(d.orders)||!Array.isArray(d.movements))throw Error('데이터 형식 오류');
    const ss=SpreadsheetApp.openById(SPREADSHEET_ID),previous=props.getProperty('facilityCommit');
    const old=previous?JSON.parse(previous):null,slot=old&&old.sheet==='_앱데이터_슬롯A'?'_앱데이터_슬롯B':'_앱데이터_슬롯A',next=current.revision+1;
    if(current.data)writeJsonSheet_(ss,'_앱데이터_이전저장',JSON.stringify(current.data),current.revision);
    // Inactive slot only. A failed write/flush leaves the committed slot intact.
    writeJsonSheet_(ss,slot,raw,next);SpreadsheetApp.flush();
    if(readJsonSheet_(ss.getSheetByName(slot))!==raw)throw Error('저장 검증 실패: 기존 확정 데이터는 유지됩니다.');
    // ONE property holds BOTH data pointer and revision. No projection precedes commit.
    props.setProperty('facilityCommit',JSON.stringify({sheet:slot,revision:next}));
    props.setProperty('facilityRevision',String(next));committedRevision=next;
  }finally{lock.releaseLock()}
  // Projection work must never hold the canonical data lock.
  const projection=refreshFacilityReports_();return {ok:true,revision:committedRevision,...projection};
}
function facilityLock_(){
 const lock=LockService.getScriptLock();try{if(typeof lock.tryLock==='function'){if(!lock.tryLock(10000))throw Error('busy')}else lock.waitLock(10000)}catch(error){throw Error('BUSY: 다른 저장 작업이 진행 중입니다. 잠시 후 다시 시도하세요.')}return lock;
}
function refreshFacilityReports_(){
 let token=null,snapshot=null,reportPending=true,reportError='';
 try{
  const lock=facilityLock_();try{
   const props=PropertiesService.getScriptProperties(),raw=props.getProperty('facilityReportsLease'),lease=raw?JSON.parse(raw):null;
   if(lease&&lease.expiresAt>Date.now())return {reportPending:true,reportError:'보고용 시트를 갱신 중입니다. 원본 데이터는 저장되었습니다.'};
   snapshot=readFacilityData_();if(!snapshot.data||!snapshot.reportPending)return {reportPending:false,reportError:''};
   token=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);props.setProperty('facilityReportsLease',JSON.stringify({token,expiresAt:Date.now()+420000}));
  }finally{lock.releaseLock()}
  for(let pass=0;pass<2;pass++){
   const ss=SpreadsheetApp.openById(SPREADSHEET_ID);writeJsonSheet_(ss,'_앱데이터',JSON.stringify(snapshot.data),snapshot.revision);writeAll_(snapshot.data);SpreadsheetApp.flush();
   const finish=facilityLock_();try{
    const props=PropertiesService.getScriptProperties(),lease=JSON.parse(props.getProperty('facilityReportsLease')||'null');if(!lease||lease.token!==token)throw Error('보고용 시트 갱신 권한이 만료됐습니다. 재시도해 주세요.');
    const current=readFacilityData_();props.setProperty('facilityReportsRevision',String(snapshot.revision));
    if(current.revision===snapshot.revision){reportPending=false;break}
    snapshot=current;props.setProperty('facilityReportsLease',JSON.stringify({token,expiresAt:Date.now()+420000}));
   }finally{finish.releaseLock()}
  }
 }catch(error){reportError=String(error.message||error)}
 finally{if(token){let cleanup;try{cleanup=facilityLock_();const props=PropertiesService.getScriptProperties(),lease=JSON.parse(props.getProperty('facilityReportsLease')||'null');if(lease&&lease.token===token)props.setProperty('facilityReportsLease','')}catch(error){reportPending=true;reportError=reportError||'보고용 시트 재시도가 필요합니다.'}finally{if(cleanup)cleanup.releaseLock()}}}
 return {reportPending,reportError};
}
function retryFacilityReports(){return {ok:true,...refreshFacilityReports_()}}

