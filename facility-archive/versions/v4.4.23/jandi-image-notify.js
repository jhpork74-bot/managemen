function notifyDutyChangeJandi(site,eventId,expectedMode,packet){
 if(!['one','two'].includes(site)||typeof eventId!=='string'||!/^[A-Za-z0-9_.:-]{1,100}$/.test(eventId))throw Error('변경 알림 대상 형식 오류');
 const c=jandiConfig_();if(expectedMode!==c.mode)return {state:'blocked',message:'잔디 발송 대상 설정이 변경되었습니다. 연결 상태를 확인하세요.'};
 let route,view;try{route=jandiRoute_(c,c.mode);view=jandiCalendarSnapshot_(site,eventId)}catch(error){return {state:'blocked',message:error.message}}
 const key=jandiReceiptKey_(route,site,eventId),lock=facilityLock_();let previousImage=null;
 try{
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
 c.p.setProperty(key,JSON.stringify({state:result.state,at:Date.now(),sentAt:result.state==='sent'?stamp:null,image}));
 return {...result,mode:route.mode,sentAt:result.state==='sent'?stamp:null};
}
