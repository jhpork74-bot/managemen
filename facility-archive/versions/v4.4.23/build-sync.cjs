const fs=require('fs'),path=require('path'),vm=require('vm'),dir=__dirname,read=f=>fs.readFileSync(path.join(dir,f),'utf8');
const original=path.join(dir,'../시설관리_v4.4.22_CSFS게시판_회사사진저장');
function once(s,a,b){if(!s.includes(a))throw Error('Missing patch: '+a.slice(0,90));return s.replace(a,b)}
for(const file of ['Index.html','base-index.html']){
 let s=fs.readFileSync(path.join(original,file),'utf8');
 s=once(s,'// Draft durability and server acknowledgements share one save queue.',read('sync-merge.js')+'\n// Draft durability and server acknowledgements share one save queue.');
 s=once(s,'{baseRevision:cloudRevision,data,savedAt:new Date().toISOString()}','{baseRevision:cloudRevision,baseData:cloudBaseData,data,savedAt:new Date().toISOString()}');
 s=once(s,"function renderSync(){cloudStatus(","function renderSync(){cloudConflictNotice();cloudStatus(");
 s=once(s,"cloudBlocked?'⚠️ 버전 충돌 · 임시본 백업 필요'","cloudBlocked?'⚠️ 변경 내용 비교 필요 · 입력 보존됨'");
 s=once(s,"if(cloudSaving){alert('저장 중입니다. 완료 후 다시 시도하세요.');return}","if(cloudLoading||cloudReconciling)return Promise.resolve(false);if(cloudSaving){alert('저장 중입니다. 완료 후 다시 시도하세요.');return Promise.resolve(false)}");
 s=once(s,'clearTimeout(cloudRetryTimer);cloudRetryTimer=null;cloudActiveRequest=null;cloudReportAttempts=0;',"cloudLoading=true;const loadSequence=++cloudLoadSequence;clearTimeout(cloudTimer);clearTimeout(cloudRetryTimer);cloudRetryTimer=null;cloudActiveRequest=null;cloudReportAttempts=0;cloudMergeAttempts=0;");
 s=once(s,'cloudRevision=res.revision||0;cloudSavedAt=',"if(loadSequence!==cloudLoadSequence){resolve(false);return}if(!Number.isSafeInteger(res.revision))throw Error('서버 버전 형식 오류');cloudRevision=res.revision;cloudSavedAt=");
 s=once(s,'data=server;cloudPending=false;',"data=server;cloudBaseData=FacilityMerge.clone(server);cloudRemoteRevision=null;cloudPending=false;");
 s=once(s,'const conflict=Number(draft.baseRevision)!==cloudRevision;',"const conflict=Number(draft.baseRevision)!==cloudRevision||!draft.baseData;");
 s=once(s,'data=draft.data;cloudPending=true;cloudBlocked=conflict;',"data=draft.data;cloudPending=true;cloudBlocked=conflict;cloudRemoteRevision=conflict?res.revision:null;cloudRevision=Number(draft.baseRevision);cloudBaseData=draft.baseData?normalizeData(draft.baseData):null;cloudError=conflict?'임시본의 원래 기준을 보존했습니다. 최신 변경 확인·합치기를 눌러 주세요.':'';");
 s=once(s,'cloudReady=true;cloudSaving=false;',"cloudLoading=false;cloudReady=true;cloudSaving=false;");
 s=once(s,"}catch(error){cloudError=error.message;cloudStatus('❌ 데이터 복구 실패", "}catch(error){cloudLoading=false;cloudReady=false;cloudError=error.message;cloudStatus('❌ 데이터 복구 실패");
 s=once(s,"}).withFailureHandler(error=>{$('cloudLoadBar')", "}).withFailureHandler(error=>{cloudLoading=false;$('cloudLoadBar')");
 s=once(s,'if(!cloudReady||cloudSaving||cloudBlocked||!cloudPending)return;',"if(!cloudReady||cloudLoading||cloudReconciling||cloudSaving||cloudBlocked||!cloudPending)return;");
 s=once(s,"cloudSaving=false;cloudRevision=res.revision;cloudSavedAt=", "if(res.needsRefresh){cloudSaving=false;cloudRevision=res.appliedRevision;cloudActiveRequest=null;cloudPending=true;cloudBaseData=JSON.parse(request.snapshot);persistDraft();cloudReconcile(true,cloudBaseData);return}\n  cloudSaving=false;cloudRevision=res.revision;cloudBaseData=JSON.parse(request.snapshot);cloudSavedAt=");
 s=once(s,'cloudPending=false;try{localStorage.setItem(KEY,request.snapshot);',"cloudPending=false;cloudMergeAttempts=0;try{localStorage.setItem(KEY,request.snapshot);");
 s=once(s,"cloudBlocked=/CONFLICT|충돌|REQUEST_MISMATCH/.test(cloudError);persistDraft();", "cloudBlocked=/CONFLICT|충돌|REQUEST_MISMATCH/.test(cloudError);persistDraft();\n  if(/CONFLICT/.test(cloudError)&&cloudBaseData&&cloudMergeAttempts<2){cloudActiveRequest=null;cloudReconcile(true);return}");
 s=once(s,"if(cloudBlocked){alert('임시본을 JSON으로 백업한 뒤 최신 데이터를 불러오세요.');return}","if(cloudBlocked){cloudMergeAttempts=0;cloudReconcile(false);return}");
 s=once(s,"function validDate(s)",read('sync-recovery.js')+'\nfunction validDate(s)');
 s=once(s,'시설관리 통합업무 v4.4 · 리뷰 수정 통합본','시설관리 통합업무 v4.4.23 · 저장 충돌 복구 개선');
 for(const match of s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(match[1]);
 fs.writeFileSync(path.join(dir,file),s);
}
console.log('Built v4.4.23 common sync recovery into Index and base-index.');
