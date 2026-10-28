/** Calendar JPEGs only. Existing files, folders, spreadsheet data and app access remain untouched. */
function enableJandiCalendarImages(){
 jandiAssertAdmin_();const p=PropertiesService.getScriptProperties();let folder;
 const id=p.getProperty('JANDI_IMAGE_FOLDER_ID');if(id)folder=DriveApp.getFolderById(id);else{folder=DriveApp.createFolder('시설관리_잔디_당직변경이미지');p.setProperty('JANDI_IMAGE_FOLDER_ID',folder.getId())}
 p.setProperty('JANDI_IMAGES_ENABLED','true');console.info('달력 JPG 전송 준비 완료. 새로 생성하는 JPG만 링크를 아는 사용자가 조회하도록 공유합니다. 기존 파일·폴더 권한은 변경하지 않습니다.');return {ready:true};
}
function disableJandiCalendarImages(){jandiAssertAdmin_();PropertiesService.getScriptProperties().setProperty('JANDI_IMAGES_ENABLED','false');console.info('달력 JPG 전송을 껐습니다. 기존 이미지와 당직 데이터는 유지됩니다.');}
function jandiCalendarSnapshot_(site,eventId){
 const snapshot=getFacilityData(),history=snapshot.data&&snapshot.data.dutyChanges&&snapshot.data.dutyChanges.sites&&snapshot.data.dutyChanges.sites[site],event=history&&(history.history||[]).find(x=>x.id===eventId);
 if(!event||!/^\d{4}-\d{2}-\d{2}$/.test(event.date))throw Error('서버에 저장된 변경이력을 찾지 못했습니다.');
 const roster=DutyChangesCore.view(snapshot.data,site,event.date.slice(0,7));if(!roster)throw Error('이 월의 원본 당직표가 없습니다.');
 const sequence=(history.history||[]).filter(x=>x.date&&x.date.startsWith(event.date.slice(0,7))).findIndex(x=>x.id===eventId)+1;return {event,roster,sequence,rosterHash:jandiHash_(JSON.stringify(roster)),revision:snapshot.revision};
}
function jandiReceiptKey_(route,site,eventId){return 'JANDI_RCPT_'+jandiHash_(route.key+'\n'+site+'\n'+eventId)}
function jandiReceiptResult_(receipt){return {state:receipt.state==='pending'?(Date.now()-receipt.at>120000?'unknown':'pending'):receipt.state,message:receipt.state==='sent'?'이미 잔디 전송 성공을 확인한 변경입니다.':'같은 알림의 처리 결과 또는 잔디 수신 여부를 확인하세요. 자동으로 중복 발송하지 않습니다.',sentAt:receipt.sentAt||null,duplicate:true}}
function prepareDutyJandiImage(site,eventId,expectedMode){
 if(!['one','two'].includes(site)||typeof eventId!=='string'||!/^[A-Za-z0-9_.:-]{1,100}$/.test(eventId))return {state:'blocked',message:'변경 대상 형식을 확인하세요.'};
 const c=jandiConfig_();if(expectedMode!==c.mode)return {state:'blocked',message:'잔디 발송 대상이 변경됐습니다. 연결 상태를 확인하세요.'};
 let route,view;try{route=jandiRoute_(c,c.mode);if(!c.imageReady)return {state:'blocked',message:'Apps Script에서 enableJandiCalendarImages를 한 번 실행해 이미지 전송을 준비하세요.'};view=jandiCalendarSnapshot_(site,eventId)}catch(error){return {state:'blocked',message:error.message}}
 const old=c.p.getProperty(jandiReceiptKey_(route,site,eventId));if(old){const receipt=JSON.parse(old);if(receipt.state!=='failed')return jandiReceiptResult_(receipt)}
 return {state:'ready',...view,date:view.event.date,site,stamp:Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd HH:mm:ss')};
}
function jandiValidateImage_(packet){
 if(!packet||typeof packet.dataUrl!=='string'||packet.dataUrl.length>2800000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(packet.dataUrl))throw Error('달력 JPG 형식이나 크기를 확인하세요.');
 const bytes=Utilities.base64Decode(packet.dataUrl.slice(23));
 if(bytes.length<4||bytes.length>2097152||(bytes[0]&255)!==255||(bytes[1]&255)!==216||(bytes[bytes.length-2]&255)!==255||(bytes[bytes.length-1]&255)!==217)throw Error('유효한 JPG 이미지가 아닙니다.');
 return bytes;
}
function jandiCreateImage_(c,site,date,packet,previous){
 if(previous&&previous.rosterHash===packet.rosterHash){try{const file=DriveApp.getFileById(previous.fileId);if(!file.isTrashed())return previous}catch(error){}}
 const bytes=jandiValidateImage_(packet),folder=DriveApp.getFolderById(c.p.getProperty('JANDI_IMAGE_FOLDER_ID'));
 const name=date.slice(0,7)+'_'+(site==='one'?'본관':'분관')+'_변경_'+Date.now()+'.jpg',file=folder.createFile(Utilities.newBlob(bytes,'image/jpeg',name));
 try{file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW)}catch(error){try{file.setTrashed(true)}catch(ignored){}throw Error('새 JPG의 링크 조회 공유를 허용하지 못했습니다. Drive 조직 정책·권한을 확인하세요.');}
 let url='https://drive.google.com/thumbnail?id='+encodeURIComponent(file.getId())+'&sz=w2000';
 const resourceKey=typeof file.getResourceKey==='function'?file.getResourceKey():null;if(resourceKey)url+='&resourcekey='+encodeURIComponent(resourceKey);
 return {fileId:file.getId(),url,rosterHash:packet.rosterHash};
}
function jandiVerifyImageAccess_(image){
 // A browser-authenticated Drive viewer is not enough: JANDI must fetch an actual image without credentials.
 for(let attempt=0;attempt<3;attempt++){
  try{const r=UrlFetchApp.fetch(image.url,{muteHttpExceptions:true,followRedirects:true}),headers=r.getHeaders(),type=String(headers['Content-Type']||headers['content-type']||'');if(r.getResponseCode()===200&&/^image\//i.test(type))return true}catch(error){}
  if(attempt<2)Utilities.sleep(800);
 }
 return false;
}
