/** JANDI: calendar JPEG attachment; no app link in message. Secrets remain in Script Properties, never in facility JSON or client HTML. */
function includeJandiNotificationsUI_(){return HtmlService.createHtmlOutputFromFile('JandiNotificationsUI').getContent()}
function jandiConfig_(){
 const p=facilitySettings_(),mode=p.getProperty('JANDI_MODE')||'test';
 if(!['test','topic'].includes(mode))throw Error('JANDI_MODE는 test 또는 topic으로 설정하세요.');
 let base=p.getProperty(INI_PROPERTY_KEYS.JANDI_WEB_APP_URL)||'';if(!base){try{base=ScriptApp.getService().getUrl()||''}catch(error){}}
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(base))base='';
 return {p,mode,enabled:p.getProperty('JANDI_ENABLED')==='true',base,testUrl:p.getProperty(INI_PROPERTY_KEYS.JANDI_TEST_WEBHOOK_URL)||'',topicUrl:p.getProperty(INI_PROPERTY_KEYS.JANDI_TOPIC_WEBHOOK_URL)||'',imageReady:p.getProperty('JANDI_IMAGES_ENABLED')==='true'&&!!p.getProperty(INI_PROPERTY_KEYS.JANDI_IMAGE_FOLDER_ID)};
}
function jandiEndpoint_(url){
 if(!/^https:\/\/wh\.jandi\.com\/connect-api\/webhook\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/?$/.test(url))throw Error('일반 Incoming Webhook의 공식 HTTPS 주소를 설정하세요.');
 return {url};
}
function jandiHash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('').slice(0,32)}
function jandiTestFingerprint_(c){return jandiHash_(c.testUrl+'\n'+c.base)}
function getDutyJandiStatus(){
 try{const c=jandiConfig_();let testConfigured=false,topicConfigured=false;try{jandiEndpoint_(c.testUrl);testConfigured=true}catch(error){}try{jandiEndpoint_(c.topicUrl);topicConfigured=true}catch(error){}
 return {enabled:c.enabled,mode:c.mode,imageReady:c.imageReady,baseConfigured:!!c.base,testConfigured,topicConfigured,testPassed:!!c.base&&c.p.getProperty('JANDI_TEST_OK')===jandiTestFingerprint_(c)}
 }catch(error){return {enabled:false,mode:'test',error:'잔디 설정을 확인하세요.'}}
}
function jandiLink_(c,site,date){return c.base+'?page=dutyChanges&site='+encodeURIComponent(site)+'&month='+encodeURIComponent(date.slice(0,7))+'&date='+encodeURIComponent(date)}
function jandiMessage_(c,site,date,stamp,test){
 const month=Number(date.slice(5,7)),year=date.slice(0,4),time=Utilities.formatDate(stamp,'Asia/Seoul','yyyy-MM-dd HH:mm:ss');
 return (test?'[연결시험 · 나와의 대화]\n':'')+month+'월 당직표 변경내용 <'+time+'>\n대상: '+year+'년 '+month+'월 · '+(site==='one'?'본관':'분관')+'\n변경일: '+date;
}
function jandiAssertAdmin_(){
 const admins=facilityAdminEmails_(),active=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
 if(!admins.length||!active||!admins.includes(active))throw Error('JANDI_ADMIN_EMAIL에 등록한 개인 또는 회사 관리자 계정으로 Apps Script 편집기에서 실행하세요.');
}
/** Editor diagnosis only: no message, no test upload, no sharing change, no secret values. */
function diagnoseJandiConnection(){
 jandiAssertAdmin_();const state={...getDutyJandiStatus(),currentAccountAllowed:true,folderAccessible:false,folderTrashed:null,folderWriteAndPublicSharing:'not_tested',messageSent:false};
 try{const id=facilitySettings_().getProperty(INI_PROPERTY_KEYS.JANDI_IMAGE_FOLDER_ID);if(id){const folder=DriveApp.getFolderById(id);state.folderTrashed=folder.isTrashed();state.folderAccessible=!state.folderTrashed}}catch(error){state.folderAccessible=false}
 state.hint=!state.enabled?'JANDI_ENABLED 확인':!state.imageReady?'enableJandiCalendarImages 실행 필요':!state.folderAccessible?'현재 실행 계정의 잔디 달력 폴더 접근 권한 확인':state.mode==='topic'&&!state.testPassed?'개인 시험 성공 확인 필요. 웹앱 주소 변경 후 시험 확인이 달라졌을 수 있음':'전송 버튼 아래 안내 문구 확인. 회사 폴더의 새 JPG 쓰기·외부 이미지 조회는 실제 전송 때 별도 확인 필요';
 console.info(JSON.stringify(state));return state;
}
function jandiRoute_(c,mode){
 if(!c.enabled)throw Error('잔디 자동 알림이 꺼져 있습니다.');
 if(mode==='topic'&&c.p.getProperty('JANDI_TEST_OK')!==jandiTestFingerprint_(c))throw Error('개인 시험 발송 성공 확인 후 전체 토픽으로 전환할 수 있습니다.');
 const endpoint=jandiEndpoint_(mode==='topic'?c.topicUrl:c.testUrl);
 return {...endpoint,mode,key:jandiHash_(mode+'\n'+endpoint.url+'\n'+c.base)};
}
function jandiTransport_(route,body,image){
 const payload={body,connectColor:route.mode==='test'?'#E5A21A':'#16805D'};if(image)payload.connectInfo=[{title:'변경된 월간 당직표',imageUrl:image.url}];
 let response;try{response=UrlFetchApp.fetch(route.url,{method:'post',contentType:'application/json',headers:{Accept:'application/vnd.tosslab.jandi-v2+json'},payload:JSON.stringify(payload),muteHttpExceptions:true,followRedirects:false})}catch(error){return {state:'unknown',message:'통신 응답을 확인하지 못했습니다. 잔디 수신 여부를 확인하세요. 자동 재발송하지 않습니다.'}}
 const code=response.getResponseCode();
 if(code<200||code>=300)return {state:code>=500||code===408?'unknown':'failed',message:'잔디 응답 HTTP '+code+(code>=500||code===408?' · 수신 여부 미확인. 자동 재발송하지 않습니다.':' · 연결 설정과 사용 제한을 확인한 뒤 재시도하세요.')};
 // HTTP success does not override an explicit application-level error response.
 let text='';try{text=typeof response.getContentText==='function'?response.getContentText().trim():''}catch(error){return {state:'unknown',message:'잔디 응답 본문을 확인하지 못했습니다. 수신 여부 확인 전 재발송하지 않습니다.',httpStatus:code}}
 if(/^</.test(text))return {state:'unknown',message:'잔디에서 예상하지 않은 응답 형식을 받았습니다. 수신방과 연결 주소를 확인하세요.',httpStatus:code};
 let api=null;try{api=text?JSON.parse(text):null}catch(error){}
 const apiCode=api&&Number.isFinite(Number(api.code))?Number(api.code):null;
 if(api&&(api.success===false||(apiCode!==null&&apiCode>=40000)))return {state:apiCode!==null&&apiCode>=50000?'unknown':'failed',message:'잔디가 요청 오류를 반환했습니다'+(apiCode!==null?' (코드 '+apiCode+')':'')+'. Webhook 활성 상태·수신방·연결 주소를 확인하세요.',httpStatus:code,apiCode};
 return {state:'sent',message:'잔디 '+(route.mode==='test'?'개인 시험 대상':'직원 전체 토픽')+' 서버의 성공 응답을 확인했습니다. 실제 수신방에서 메시지·이미지를 확인하세요.',httpStatus:code,apiCode};
}
function notifyDutyChangeJandi(site,eventId,expectedMode,packet){
 if(!['one','two'].includes(site)||typeof eventId!=='string'||!/^[A-Za-z0-9_.:-]{1,100}$/.test(eventId))throw Error('변경 알림 대상 형식 오류');
 const c=jandiConfig_();if(expectedMode!==c.mode)return {state:'blocked',message:'잔디 발송 대상 설정이 변경되었습니다. 연결 상태를 확인하세요.'};
 let route,view;try{route=jandiRoute_(c,c.mode);view=jandiCalendarSnapshot_(site,eventId)}catch(error){return {state:'blocked',message:error.message}}
 let key;try{key=jandiDeliveryKey_(c,route,site,eventId,packet&&packet.resendId)}catch(error){return {state:'blocked',message:error.message}}
 const lock=facilityLock_();let previousImage=null;
 try{
  try{key=jandiDeliveryKey_(c,route,site,eventId,packet&&packet.resendId)}catch(error){return {state:'blocked',message:error.message}}
  const previous=c.p.getProperty(key);if(previous){const receipt=JSON.parse(previous);if(receipt.state!=='failed')return jandiReceiptResult_(receipt);previousImage=receipt.image||null}
  if(!packet||packet.manual!==true)return {state:'blocked',message:'새 화면의 잔디로 이미지 전송 버튼을 눌러 실행하세요.'};
  if(!c.imageReady)return {state:'blocked',message:'Apps Script에서 enableJandiCalendarImages를 실행하세요.'};
  if(!packet||packet.rosterHash!==view.rosterHash)return {state:'stale',message:'달력이 다시 변경되어 최신 이미지가 필요합니다.'};
  try{jandiValidateImage_(packet)}catch(error){return {state:'failed',message:error.message}}
  if(Date.now()-parseInt(eventId.split('-')[0],36)>90*86400000)return {state:'blocked',message:'90일이 지난 변경 알림은 발송하지 않습니다.'};
  const receipts=Object.keys(c.p.getProperties()).filter(k=>k.startsWith('JANDI_RCPT_'));if(receipts.length>=800)return {state:'blocked',message:'잔디 발송 기록 한도입니다. 관리자에게 문의하세요.'};
  c.p.setProperty(key,JSON.stringify({state:'pending',at:Date.now(),image:previousImage}));
 }finally{lock.releaseLock()}
 let image=previousImage,result;const now=new Date(),stamp=Utilities.formatDate(now,'Asia/Seoul','yyyy-MM-dd HH:mm:ss');
 try{
  image=jandiCreateImage_(c,site,view.event.date,packet,previousImage);
  if(!jandiVerifyImageAccess_(image))result={state:'failed',message:'JPG는 생성했지만 외부 이미지 조회를 확인하지 못했습니다. 잠시 후 결과 확인·재시도를 누르세요. 잔디에는 아직 발송하지 않았습니다.'};
  else result=jandiTransport_(route,jandiMessage_(c,site,view.event.date,now,false)+'\n변경: '+view.sequence+'번째 (해당 장소·월)',image);
 }catch(error){result={state:'failed',message:'달력 이미지 저장·공유에 실패했습니다. Drive 권한과 enableJandiCalendarImages 실행 여부를 확인하세요. 잔디에는 아직 발송하지 않았습니다.'}}
 c.p.setProperty(key,JSON.stringify({state:result.state,at:Date.now(),sentAt:result.state==='sent'?stamp:null,image,httpStatus:result.httpStatus||null,apiCode:result.apiCode||null}));
 return {...result,mode:route.mode,sentAt:result.state==='sent'?stamp:null};
}

/** Run from the Apps Script editor. Sends only to the TEST endpoint, even when topic mode is selected. */
function sendJandiSelfTest(){
 jandiAssertAdmin_();const c=jandiConfig_(),route=jandiRoute_(c,'test'),site=c.p.getProperty('JANDI_TEST_SITE')==='two'?'two':'one',month=c.p.getProperty('JANDI_TEST_MONTH')||Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM');
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('JANDI_TEST_MONTH는 2026-11 형식으로 입력하세요.');
 const result=jandiTransport_(route,jandiMessage_(c,site,month+'-01',new Date(),true));if(result.state==='sent')c.p.setProperty('JANDI_TEST_OK',jandiTestFingerprint_(c));
 console.info(JSON.stringify(result));return result;
}
function enableJandiTopicMode(){jandiAssertAdmin_();const c=jandiConfig_();jandiRoute_(c,'topic');c.p.setProperty('JANDI_MODE','topic');console.info('잔디 자동 알림 대상: 직원 전체 토픽');return {mode:'topic'}}
function enableJandiTestMode(){jandiAssertAdmin_();const c=jandiConfig_();jandiRoute_(c,'test');c.p.setProperty('JANDI_MODE','test');console.info('잔디 자동 알림 대상: 개인 시험 대상');return {mode:'test'}}
