/** 원본 JSON 저장·버전 검사·저장 잠금. 운영 데이터 연결은 Code.gs의 기존 ID를 사용합니다. */
function getFacilityData(){
 const lock=facilityLock_();
 try{return readFacilityData_()}finally{lock.releaseLock()}
}
/** Lightweight version check: never writes business data or reports. */
function getFacilityRevision(){
 const lock=facilityLock_();try{const p=facilitySettings_(),raw=p.getProperty('facilityCommit');return {revision:raw?JSON.parse(raw).revision:Number(p.getProperty('facilityRevision')||0),appVersion:'4.4.24'}}finally{lock.releaseLock()}
}
function facilityRequestHash_(raw){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,raw,Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('')}
function readFacilityData_(book){
  const props=facilitySettings_(),ss=book||SpreadsheetApp.openById(facilitySpreadsheetId_());
  const pointer=props.getProperty('facilityCommit');
  if(pointer){
    const commit=JSON.parse(pointer);
    if(!['_앱데이터_슬롯A','_앱데이터_슬롯B'].includes(commit.sheet)||!Number.isSafeInteger(commit.revision))throw Error('저장 확정 정보 오류. 백업을 확인하세요.');
    const raw=readJsonSheet_(ss.getSheetByName(commit.sheet));
    if(raw===null)throw Error('확정 데이터가 없습니다. 저장 중단 후 백업을 확인하세요.');
    return {savedAt:commit.savedAt||null,revision:commit.revision,data:JSON.parse(raw),reportPending:Number(props.getProperty('facilityReportsRevision')||'-1')!==commit.revision};
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
 // B1 is the authoritative chunk count; older trailing rows are ignored.
 sheet.getRange(1,1,chunks.length+1,3).setValues([['앱 JSON 조각 수',chunks.length,revision],...chunks.map(chunk=>[chunk,'',''])]);
}
function saveFacilityData(raw,expectedRevision,requestId){
 if(typeof raw!=='string'||raw.length>2000000)throw Error('데이터 크기 제한을 초과했습니다.');
 const d=JSON.parse(raw);if(!Array.isArray(d.items)||!Array.isArray(d.tasks)||!d.checks||!Array.isArray(d.stock)||!Array.isArray(d.orders)||!Array.isArray(d.movements))throw Error('데이터 형식 오류');
 if(requestId!==undefined&&(typeof requestId!=='string'||!/^[A-Za-z0-9_.:-]{1,96}$/.test(requestId)))throw Error('저장 요청 식별값 오류');
 const lock=facilityLock_();try{
  const props=facilitySettings_(),ss=SpreadsheetApp.openById(facilitySpreadsheetId_()),current=readFacilityData_(ss),previous=props.getProperty('facilityCommit'),old=previous?JSON.parse(previous):null,same=current.data&&JSON.stringify(current.data)===JSON.stringify(d);
  if(requestId&&old&&old.requestId===requestId){if(old.baseRevision!==Number(expectedRevision)||!same)throw Error('REQUEST_MISMATCH: 동일한 요청 번호의 내용이 다릅니다.');return {ok:true,revision:current.revision,savedAt:old.savedAt||null,reportPending:!!current.reportPending,duplicate:true}}
  const requestHash=requestId?facilityRequestHash_(JSON.stringify(d)):null;
  const receipt=requestId&&old&&Array.isArray(old.recentRequests)?old.recentRequests.find(r=>r.id===requestId):null;
  if(receipt){
   if(receipt.base!==Number(expectedRevision)||receipt.hash!==requestHash)throw Error('REQUEST_MISMATCH: 같은 저장 요청의 기준 또는 내용이 달라졌습니다.');
   return {ok:true,revision:current.revision,appliedRevision:receipt.revision,savedAt:current.savedAt,reportPending:!!current.reportPending,duplicate:true,needsRefresh:!same};
  }
  if(same)return {ok:true,revision:current.revision,savedAt:current.savedAt||null,reportPending:!!current.reportPending,unchanged:true};
  if(current.revision!==Number(expectedRevision))throw Error('CONFLICT: 서버 데이터가 변경되었습니다. 내 기준 '+Number(expectedRevision)+' / 서버 '+current.revision+'. 최신 변경 확인·합치기를 사용하세요.');
  const slot=old&&old.sheet==='_앱데이터_슬롯A'?'_앱데이터_슬롯B':'_앱데이터_슬롯A',next=current.revision+1,savedAt=new Date().toISOString();
  if(current.data)writeJsonSheet_(ss,'_앱데이터_이전저장',JSON.stringify(current.data),current.revision);
  writeJsonSheet_(ss,slot,raw,next);SpreadsheetApp.flush();if(readJsonSheet_(ss.getSheetByName(slot))!==raw)throw Error('저장 검증 실패: 기존 확정 데이터는 유지됩니다.');
  const recentRequests=old&&Array.isArray(old.recentRequests)?old.recentRequests.slice(-15):[];
  if(requestId)recentRequests.push({id:requestId,hash:requestHash,base:Number(expectedRevision),revision:next});
  props.setProperty('facilityCommit',JSON.stringify({sheet:slot,revision:next,savedAt,requestId:requestId||null,baseRevision:Number(expectedRevision),recentRequests}));
  // This legacy marker is not the commit. Its failure must not turn a successful commit into an error.
  try{props.setProperty('facilityRevision',String(next))}catch(error){}
  return {ok:true,revision:next,savedAt,reportPending:true};
 }finally{lock.releaseLock()}
}
function facilityLock_(){
 const lock=LockService.getScriptLock();try{if(typeof lock.tryLock==='function'){if(!lock.tryLock(10000))throw Error('busy')}else lock.waitLock(10000)}catch(error){throw Error('BUSY: 다른 저장 작업이 진행 중입니다. 잠시 후 다시 시도하세요.')}return lock;
}
function refreshFacilityReports_(){
 let token=null,snapshot=null,reportPending=true,reportError='';
 try{
  const lock=facilityLock_();try{
   const props=facilitySettings_(),raw=props.getProperty('facilityReportsLease'),lease=raw?JSON.parse(raw):null;
   if(lease&&lease.expiresAt>Date.now())return {reportPending:true,reportError:'보고용 시트를 갱신 중입니다. 원본 데이터는 저장되었습니다.'};
   snapshot=readFacilityData_();if(!snapshot.data||!snapshot.reportPending)return {reportPending:false,reportError:''};
   token=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);props.setProperty('facilityReportsLease',JSON.stringify({token,expiresAt:Date.now()+420000}));
  }finally{lock.releaseLock()}
  for(let pass=0;pass<2;pass++){
   const ss=SpreadsheetApp.openById(facilitySpreadsheetId_());writeJsonSheet_(ss,'_앱데이터',JSON.stringify(snapshot.data),snapshot.revision);writeAll_(snapshot.data);SpreadsheetApp.flush();
   const finish=facilityLock_();try{
    const props=facilitySettings_(),lease=JSON.parse(props.getProperty('facilityReportsLease')||'null');if(!lease||lease.token!==token)throw Error('보고용 시트 갱신 권한이 만료됐습니다. 재시도해 주세요.');
    const current=readFacilityData_();props.setProperty('facilityReportsRevision',String(snapshot.revision));
    if(current.revision===snapshot.revision){reportPending=false;break}
    snapshot=current;props.setProperty('facilityReportsLease',JSON.stringify({token,expiresAt:Date.now()+420000}));
   }finally{finish.releaseLock()}
  }
 }catch(error){reportError=String(error.message||error)}
 finally{if(token){let cleanup;try{cleanup=facilityLock_();const props=facilitySettings_(),lease=JSON.parse(props.getProperty('facilityReportsLease')||'null');if(lease&&lease.token===token)props.setProperty('facilityReportsLease','')}catch(error){reportPending=true;reportError=reportError||'보고용 시트 재시도가 필요합니다.'}finally{if(cleanup)cleanup.releaseLock()}}}
 return {reportPending,reportError};
}
function retryFacilityReports(){const result=refreshFacilityReports_();try{const state=getFacilityData();return {ok:true,...result,revision:state.revision,reportPending:state.reportPending}}catch(error){return {ok:true,...result,reportPending:true,reportError:result.reportError||String(error.message||error)}}}


function installFacilityStorageMaintenance(){if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='runFacilityStorageMaintenance'))ScriptApp.newTrigger('runFacilityStorageMaintenance').timeBased().everyMinutes(5).create();return {ok:true}}
function runFacilityStorageMaintenance(){try{return retryFacilityReports()}catch(error){return {ok:false,reportPending:true,reportError:String(error.message||error)}}}
