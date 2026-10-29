(()=>{
 'use strict';
 const section=document.getElementById('dutyChanges');if(!section)return;
 const send=document.createElement('button');send.id='jandiSendImage';send.type='button';send.className='primary';send.textContent='잔디로 이미지 전송';send.style.minHeight='44px';section.querySelector('h2').after(send);
 const panel=document.createElement('div');panel.className='panel jandi-duty-panel';panel.innerHTML='<h3>잔디 이미지 전송</h3><p id="jandiConnection" role="status">잔디 설정 확인 중…</p><p id="jandiDelivery" role="status">수정·저장은 계속할 수 있습니다. 제목 옆 ‘잔디로 이미지 전송’을 누를 때만 선택한 월 달력을 보냅니다.</p><div class="flex"><button id="jandiRefresh" type="button">연결 상태 새로 확인</button><button id="jandiRetry" type="button" class="hidden">전송 결과 확인·재시도</button></div><p class="mutedtext">여러 날짜를 저장한 뒤 최신 달력 전체를 한 번에 전송합니다. 웹앱 접속 링크는 표시하지 않습니다.</p>';
 section.appendChild(panel);let last=null,sending=false;const $j=id=>document.getElementById(id);
 function rpc(name,...args){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('잔디 연결 응답을 확인하지 못했습니다.')),90000);google.script.run.withSuccessHandler(result=>{clearTimeout(timer);resolve(result)}).withFailureHandler(()=>{clearTimeout(timer);reject(Error('잔디 연결 응답을 확인하지 못했습니다.'))})[name](...args)})}
 async function status(){try{const s=await rpc('getDutyJandiStatus'),mode=s.mode==='topic'?'직원 전체 토픽':'개인 시험 대상 (나와의 대화)';$j('jandiConnection').textContent=!s.enabled?'잔디 연결 꺼짐 · Apps Script 설정을 확인하세요.':!s.imageReady?'Apps Script에서 enableJandiCalendarImages를 실행하세요.':s.mode==='topic'&&!s.testPassed?'개인 시험 발송 성공 확인 후 전체 토픽으로 전환하세요.':!(s.mode==='topic'?s.topicConfigured:s.testConfigured)?mode+' 연결 주소 설정이 필요합니다.':'수동 전송 대상: '+mode;return s}catch(error){$j('jandiConnection').textContent=error.message;return null}}
 function latest(context){return (DutyChangesCore.store(data,context.site).history||[]).filter(h=>h.date&&h.date.startsWith(context.month+'-')).slice(-1)[0]}
 async function deliver(retry){
  if(sending)return;
  const view=window.DutyChangesView&&window.DutyChangesView.getContext();
  if(!view){$j('jandiDelivery').textContent='DutyChangesUI HTML도 이번 버전으로 교체하세요.';return}
  if(view.busy||$j('dcDialog').open){$j('jandiDelivery').textContent='열린 변경창을 먼저 저장하거나 닫은 뒤 전송하세요.';return}
  if(!cloudReady||cloudBlocked){$j('jandiDelivery').textContent='클라우드 연결·저장 충돌을 확인하세요. 아직 전송하지 않았습니다.';return}
  const target={site:view.site,month:view.month};sending=true;send.disabled=true;$j('jandiRetry').disabled=true;window.DutyChangesView.setSending(true);
  let posted=false;
  try{
   $j('jandiDelivery').textContent='선택한 월의 서버 저장 완료를 확인 중…';await saveAndWait();
   const event=latest(target);if(!event){$j('jandiDelivery').textContent='이 장소·월에 저장된 변경이력이 없습니다. 먼저 변경을 저장하세요.';return}
   if(retry&&(retry.site!==target.site||retry.month!==target.month||retry.eventId!==event.id)){$j('jandiDelivery').textContent='추가 수정 또는 조회 대상 변경이 있습니다. 제목 옆 ‘잔디로 이미지 전송’으로 최신 달력을 보내세요.';return}
   const s=await status();if(!s||!s.enabled||!s.imageReady||!(s.mode==='topic'?s.topicConfigured&&s.testPassed:s.testConfigured)){$j('jandiDelivery').textContent='잔디 설정을 확인하세요. 저장은 완료됐으며 아직 전송하지 않았습니다.';return}
   if(retry&&retry.mode!==s.mode){$j('jandiDelivery').textContent='전송 대상이 바뀌었습니다. 제목 옆 전송 버튼으로 현재 대상에 보내세요.';return}
   const context=retry||{...target,eventId:event.id,mode:s.mode||'test'};last=context;let result;
   for(let attempt=0;attempt<2;attempt++){
    const prepared=await rpc('prepareDutyJandiImage',context.site,context.eventId,context.mode);if(prepared.state!=='ready'){result=prepared;break}
    $j('jandiDelivery').textContent='최신 월간 달력을 JPG로 만드는 중…';const packet=await JandiCalendarCanvas.render(prepared);packet.manual=true;
    $j('jandiDelivery').textContent='JPG 저장 및 잔디 전송 중…';posted=true;result=await rpc('notifyDutyChangeJandi',context.site,context.eventId,context.mode,packet);if(result.state!=='stale')break;
   }
   $j('jandiDelivery').textContent=(result.message||'잔디 전송 결과 미확인')+(result.sentAt?' ('+result.sentAt+' 한국시간)':'');$j('jandiRetry').classList.toggle('hidden',result.state==='sent');
  }catch(error){$j('jandiDelivery').textContent=posted?'잔디 수신 여부 미확인 · 결과 확인 버튼으로 같은 요청의 처리 상태를 확인하세요.':'저장 또는 전송 준비 실패 · 아직 잔디에 요청하지 않았습니다. 상단 저장 상태를 확인하세요.';if(posted)$j('jandiRetry').classList.remove('hidden')}
  finally{sending=false;send.disabled=false;$j('jandiRetry').disabled=false;window.DutyChangesView.setSending(false)}
 }
 function onSaved(){if(!sending)$j('jandiDelivery').textContent='변경을 저장했습니다. 계속 수정할 수 있으며, 제목 옆 ‘잔디로 이미지 전송’을 누를 때만 보냅니다.'}
 // Compatibility with an older DutyChangesUI: saving must never send automatically.
 window.DutyJandi={onSaved,notify:async()=>onSaved()};
 send.onclick=()=>deliver(null);$j('jandiRefresh').onclick=status;$j('jandiRetry').onclick=()=>{if(last)deliver(last)};status();
 if(google.script.url&&typeof google.script.url.getLocation==='function')google.script.url.getLocation(location=>{const q=location.parameter||{};if(q.page!=='dutyChanges'||!['one','two'].includes(q.site)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(q.month||''))return;const date=typeof q.date==='string'&&q.date.startsWith(q.month+'-')&&/^\d{4}-\d{2}-\d{2}$/.test(q.date)?q.date:'';document.dispatchEvent(new CustomEvent('duty-changes-navigate',{detail:{site:q.site,month:q.month,date}}))});
})();
