// Loaded in the same lexical scope as the common save queue.
let cloudBaseData=null,cloudLoading=false,cloudReconciling=false,cloudLoadSequence=0,cloudMergeAttempts=0;
let cloudRemoteRevision=null,cloudPollBusy=false,cloudPollAt=0,cloudConflictSnapshot=null;
const conflictPanel=document.createElement('div');conflictPanel.id='facilityConflictPanel';conflictPanel.hidden=true;conflictPanel.setAttribute('role','status');conflictPanel.style.cssText='margin:10px 16px;padding:14px;border:2px solid #b45309;background:#fff7ed;border-radius:10px';
conflictPanel.innerHTML='<strong>서버 변경 확인</strong><p id="facilityConflictMessage"></p><div class="flex"><button id="facilityMergeCheck" type="button">최신 변경 확인·합치기</button><button id="facilityDraftDownload" type="button">내 미저장 내용 백업</button><button id="facilityUseServer" type="button">내 임시본 보관 후 서버 내용 사용</button></div>';
$('cloudLoadBar').after(conflictPanel);
function cloudConflictNotice(){
 const visible=cloudBlocked||cloudRemoteRevision!==null;conflictPanel.hidden=!visible;
 if(!visible)return;
 $('facilityConflictMessage').textContent=cloudBlocked?'내 변경을 보존하고 저장을 멈췄습니다. 열려 있는 입력창을 닫은 뒤 최신 변경을 비교하세요. '+(cloudError||''):'서버에 새 변경이 있습니다. 작성 중인 입력은 유지됩니다. 입력창을 닫은 뒤 최신 변경을 확인하세요.';
 $('facilityMergeCheck').disabled=cloudReconciling||cloudSaving||cloudLoading;
 $('facilityUseServer').disabled=cloudReconciling||cloudSaving||cloudLoading;
}
function cloudRpcGet(){return new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getFacilityData())}
function cloudApplySnapshot(res,next){
 cloudRevision=res.revision;cloudBaseData=FacilityMerge.clone(normalizeData(res.data||seed()));data=next;cloudSavedAt=res.savedAt||'';reportsPending=!!res.reportPending;cloudRemoteRevision=null;cloudActiveRequest=null;cloudBlocked=false;cloudError='';cloudConflictSnapshot=null;
 cloudPending=!FacilityMerge.equal(data,cloudBaseData);
 if(cloudPending)persistDraft();else{try{localStorage.setItem(KEY,JSON.stringify(data));const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(d&&FacilityMerge.equal(d.data,data))localStorage.removeItem(DRAFT_KEY)}catch(e){draftStorageError='서버 확인 완료 · 임시본 정리는 실패했습니다.'}}
 render();renderSync();
}
async function cloudReconcile(automatic=false,acknowledgedBase=null){
 if(cloudLoading||cloudReconciling)return false;
 cloudReconciling=true;const sequence=cloudLoadSequence;cloudConflictNotice();
 if(acknowledgedBase){cloudBaseData=FacilityMerge.clone(acknowledgedBase);/* Its revision remains the acknowledged one. */}
 try{
  const res=await cloudRpcGet();if(sequence!==cloudLoadSequence)return false;
  if(!Number.isSafeInteger(res.revision)||res.revision<cloudRevision)throw Error('서버 버전 응답을 확인하세요.');
  const remote=normalizeData(res.data||seed()),merged=FacilityMerge.merge(cloudBaseData,data,remote);
  // Photo forms keep draft fields outside `data` until uploads finish. Never
  // rebase underneath those fields when that same business area changed.
  const formArea=document.querySelector('#csfsDialog[open]')?'csfs':document.querySelector('#repairDialog[open]')?'repairs':null;
  if(automatic&&formArea&&cloudBaseData&&!FacilityMerge.equal(cloudBaseData[formArea],remote[formArea])){
   cloudBlocked=true;cloudRemoteRevision=res.revision;throw Error('작성 중인 '+(formArea==='csfs'?'CSFS':'고장·공사')+' 영역에 서버 변경이 있습니다. 입력을 보존한 뒤 창을 닫고 최신 변경을 비교하세요.');
  }
  if(!merged.conflicts.length){
   cloudApplySnapshot(res,merged.data);cloudReconciling=false;
   if(cloudPending){if(automatic&&cloudMergeAttempts>=2){cloudBlocked=true;cloudError='서버 변경이 연속 발생했습니다. 잠시 후 최신 변경 확인을 눌러 주세요.';renderSync();settleCloudWaiters(new Error(cloudError));return false}cloudMergeAttempts++;cloudFlush()}
   else{cloudMergeAttempts=0;settleCloudWaiters(null,{ok:true,revision:cloudRevision});}
   return true;
  }
  cloudBlocked=true;cloudPending=true;cloudActiveRequest=null;cloudRemoteRevision=res.revision;cloudError=merged.legacy?'이전 임시본에는 기준 자료가 없어 자동 병합하지 않습니다. 백업 후 서버 자료와 직접 비교하세요.':'같은 업무 영역이 변경되었습니다: '+merged.conflicts.map(x=>x.label).join(', ');persistDraft();
  cloudConflictSnapshot={res,remote,local:FacilityMerge.clone(data),merged};
  if(!automatic&&!merged.legacy)cloudShowChoices();
  settleCloudWaiters(new Error(cloudError));renderSync();return false;
 }catch(error){cloudError='최신 내용 확인 실패: '+(error.message||String(error));cloudPending=true;persistDraft();settleCloudWaiters(new Error(cloudError));renderSync();return false}
 finally{cloudReconciling=false;cloudConflictNotice()}
}
const conflictDialog=document.createElement('dialog');conflictDialog.id='facilityConflictDialog';conflictDialog.style.cssText='width:min(740px,94vw);max-height:85vh;overflow:auto';document.body.appendChild(conflictDialog);
function cloudShowChoices(){
 const snap=cloudConflictSnapshot;if(!snap)return;
 conflictDialog.innerHTML='<h2>저장 충돌 해결</h2><p>같은 업무 영역에서는 한쪽 내용을 선택해야 합니다. 선택하지 않은 내용도 기기에 임시본으로 보관합니다. 확인한 뒤 저장하세요.</p><div id="facilityConflictChoices"></div><div class="flex"><button type="button" id="facilityConflictCancel">닫기 · 입력 유지</button><button type="button" id="facilityConflictApply">선택한 내용으로 저장</button></div><p id="facilityConflictResult" role="status"></p>';
 const host=conflictDialog.querySelector('#facilityConflictChoices');
 for(const item of snap.merged.conflicts){const section=document.createElement('fieldset'),title=document.createElement('legend');title.textContent=item.label;section.appendChild(title);const select=document.createElement('select');select.dataset.conflictKey=item.key;select.setAttribute('aria-label',item.label+' 선택');for(const [value,label] of [['','선택해 주세요'],['remote','서버 내용 사용'],['local','내 변경 사용']]){const o=document.createElement('option');o.value=value;o.textContent=label;select.appendChild(o)}section.appendChild(select);for(const [label,value] of [['내 변경',item.local],['서버 내용',item.remote]]){const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent=label+' 상세';pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:200px;overflow:auto';pre.textContent=JSON.stringify(value,(k,v)=>typeof v==='string'&&v.startsWith('data:image/')?'[첨부 사진]':v,2);details.append(summary,pre);section.appendChild(details)}host.appendChild(section)}
 conflictDialog.querySelector('#facilityConflictCancel').onclick=()=>conflictDialog.close();
 conflictDialog.querySelector('#facilityConflictApply').onclick=async()=>{
  const controls=[...conflictDialog.querySelectorAll('select')],out=conflictDialog.querySelector('#facilityConflictResult');if(controls.some(x=>!x.value)){out.textContent='각 영역에서 사용할 내용을 선택하세요.';return}
  if(!FacilityMerge.equal(data,snap.local)){out.textContent='내 입력이 바뀌었습니다. 닫고 최신 변경을 다시 확인하세요.';return}
  if(!confirm('선택한 업무 영역의 내용을 저장할까요? 현재 임시본은 먼저 보관합니다.'))return;
  try{persistDraft();localStorage.setItem(DRAFT_KEY+'_보관_서버_'+Date.now(),JSON.stringify({baseRevision:snap.res.revision,data:snap.remote,savedAt:new Date().toISOString()}));archiveDraft()}catch(e){out.textContent='기기 백업 실패. 먼저 내 미저장 내용을 다운로드하세요.';return}
  const choices=Object.fromEntries(controls.map(x=>[x.dataset.conflictKey,x.value])),merged=FacilityMerge.merge(cloudBaseData,data,snap.remote,choices);cloudApplySnapshot(snap.res,merged.data);conflictDialog.close();cloudMergeAttempts=0;if(cloudPending)cloudFlush();
 };
 conflictDialog.showModal();
}
$('facilityMergeCheck').onclick=()=>{if(document.querySelector('dialog[open]')){cloudError='입력창을 닫은 뒤 다시 확인하세요. 작성 중인 내용은 먼저 보존하세요.';cloudConflictNotice();return}cloudMergeAttempts=0;cloudReconcile(false)};
$('facilityDraftDownload').onclick=()=>download('시설관리_미저장내용_'+TODAY+'.json',JSON.stringify(data,null,2),'application/json;charset=utf-8');
$('facilityUseServer').onclick=()=>cloudLoad();
async function cloudCheckRevision(){
 if(cloudPollBusy||cloudLoading||cloudReconciling||!cloudReady||cloudSaving||navigator.onLine===false||document.visibilityState==='hidden'||Date.now()-cloudPollAt<30000)return;
 cloudPollAt=Date.now();cloudPollBusy=true;const seq=cloudLoadSequence;
 google.script.run.withSuccessHandler(res=>{cloudPollBusy=false;if(seq!==cloudLoadSequence)return;if(Number.isSafeInteger(res.revision)&&res.revision>cloudRevision){cloudRemoteRevision=res.revision;cloudConflictNotice()}}).withFailureHandler(()=>{cloudPollBusy=false}).getFacilityRevision();
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')cloudCheckRevision()});
setInterval(cloudCheckRevision,60000);
