/** Repair JPEG uploads are private Drive files. No setSharing, deleting or moving existing images. */
function repairPhotoHash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('')}
function repairPhotoFolderId_(){const p=facilitySettings_();return p.getProperty('REPAIRS_IMAGE_FOLDER_ID')||p.getProperty('JANDI_IMAGE_FOLDER_ID')||''}
function repairPhotoProof_(repairId,slot,fileId){const secret=facilitySettings_().getProperty('REPAIR_PHOTO_SIGNING_KEY');if(!secret)throw Error('사진 연결 확인키가 없습니다. 기존 스크립트 속성 백업을 확인하세요.');return Utilities.computeHmacSha256Signature(repairId+'\n'+slot+'\n'+fileId,secret).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('')}
function repairPhotoBytes_(dataUrl){
 if(typeof dataUrl!=='string'||dataUrl.length>160000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(dataUrl))throw Error('사진은 160KB 이하의 축소 JPG 형식이어야 합니다.');
 const b=Utilities.base64Decode(dataUrl.slice(23));if(b.length<4||(b[0]&255)!==255||(b[1]&255)!==216||(b[b.length-2]&255)!==255||(b[b.length-1]&255)!==217)throw Error('JPG 사진 형식을 확인하세요.');return b;
}
function uploadRepairPhotos(requestId,repairId,photos,expectedRevision){
 if(typeof requestId!=='string'||!/^[A-Za-z0-9_.:-]{1,100}$/.test(requestId)||typeof repairId!=='string'||!/^[A-Za-z0-9_.:-]{1,100}$/.test(repairId))throw Error('사진 저장 요청 번호를 확인하세요.');
 if(!photos||typeof photos!=='object'||Array.isArray(photos))throw Error('사진 입력 형식 오류');
 const keys=Object.keys(photos).sort();if(!keys.length||keys.length>4||keys.some(k=>!['fault','before','during','after'].includes(k)))throw Error('사진 단계를 확인하세요.');
 const bytes={},hashes={};for(const key of keys){bytes[key]=repairPhotoBytes_(photos[key]);hashes[key]=repairPhotoHash_(bytes[key])}
 const signature=repairPhotoHash_(JSON.stringify([repairId,hashes])),receiptKey='REPAIR_UPLOAD_'+repairPhotoHash_(requestId).slice(0,32),p=facilitySettings_();let folderId;
 const lock=facilityLock_();try{
  const raw=p.getProperty(receiptKey),old=raw?JSON.parse(raw):null;
  if(old&&old.signature!==signature)throw Error('REQUEST_MISMATCH: 같은 사진 요청 번호의 내용이 달라졌습니다.');
  if(old&&old.state==='done')return {ok:true,refs:old.refs,duplicate:true};
  if(old&&old.state==='pending'&&old.expiresAt>Date.now())throw Error('사진을 저장하고 있습니다. 잠시 후 다시 확인하세요.');
  const snapshot=readFacilityData_();if(!snapshot.data||snapshot.revision!==Number(expectedRevision))throw Error('CONFLICT: 최신 업무 데이터를 불러온 뒤 다시 저장하세요.');
  if(!p.getProperty('REPAIR_PHOTO_SIGNING_KEY')&&(snapshot.data.repairs||[]).some(r=>[r.photo,...Object.values(r.workPhotos||{})].some(v=>typeof v==='string'&&v.startsWith('drive-photo:'))))throw Error('기존 Drive 사진 연결 확인키가 없습니다. 기존 스크립트 속성 백업을 복원한 뒤 저장하세요.');
  folderId=old&&old.folderId||repairPhotoFolderId_();if(!folderId)throw Error('연결설정 시트에서 고장·공사 사진 저장 폴더를 지정하세요.');
  const receipts=Object.keys(p.getProperties()).filter(k=>k.startsWith('REPAIR_UPLOAD_'));
  for(const k of receipts){try{const r=JSON.parse(p.getProperty(k));if(r.state!=='pending'&&r.at<Date.now()-14*86400000)p.deleteProperty(k)}catch(e){}}
  if(Object.keys(p.getProperties()).filter(k=>k.startsWith('REPAIR_UPLOAD_')).length>=200&&!old)throw Error('사진 저장 확인 기록이 많습니다. 관리자에게 문의하세요.');
  p.setProperty(receiptKey,JSON.stringify({state:'pending',at:Date.now(),expiresAt:Date.now()+360000,signature,folderId}));
  if(!p.getProperty('REPAIR_PHOTO_SIGNING_KEY'))p.setProperty('REPAIR_PHOTO_SIGNING_KEY',Utilities.getUuid()+Utilities.getUuid());
 }finally{lock.releaseLock()}
 try{
  let folder;try{folder=DriveApp.getFolderById(folderId);if(folder.isTrashed())throw Error('trash')}catch(e){throw Error('회사 사진 폴더에 접근할 수 없습니다. 실행 계정에 폴더 편집 권한을 부여했는지 확인하세요.')}
  const refs={};
  for(const slot of keys){
   const name='repair_'+repairId+'_'+slot+'_'+hashes[slot]+'.jpg',found=folder.getFilesByName(name);let file=null;
   while(found.hasNext()){const candidate=found.next();if(!candidate.isTrashed()&&candidate.getMimeType()==='image/jpeg'&&candidate.getSize()<=120000&&repairPhotoHash_(candidate.getBlob().getBytes())===hashes[slot]){file=candidate;break}}
   if(!file)file=folder.createFile(Utilities.newBlob(bytes[slot],'image/jpeg',name));
   const fileId=file.getId();refs[slot]='drive-photo:'+fileId+':'+repairPhotoProof_(repairId,slot,fileId);
  }
  p.setProperty(receiptKey,JSON.stringify({state:'done',at:Date.now(),signature,folderId,refs}));return {ok:true,refs};
 }catch(error){try{p.setProperty(receiptKey,JSON.stringify({state:'failed',at:Date.now(),signature,folderId}))}catch(ignored){}throw Error('사진 Drive 저장 실패: '+error.message+' · 입력 사진과 기존 기록은 유지됩니다.')}
}
function getRepairPhoto(repairId,slot){
 if(typeof repairId!=='string'||!['fault','before','during','after','legacy'].includes(slot))throw Error('사진 조회 대상 오류');
 const snapshot=getFacilityData(),record=(snapshot.data&&snapshot.data.repairs||[]).find(r=>r.id===repairId);
 if(!record)throw Error('저장된 고장·공사 기록이 없습니다.');
 const ref=['fault','legacy'].includes(slot)?record.photo:record.workPhotos&&record.workPhotos[slot];
 const match=typeof ref==='string'&&ref.match(/^drive-photo:([A-Za-z0-9_-]{10,200}):([a-f0-9]{64})$/);if(!match)throw Error('이 기록에 연결된 Drive 사진이 없습니다.');
 if(match[2]!==repairPhotoProof_(repairId,slot==='legacy'?'fault':slot,match[1]))throw Error('사진 연결 확인에 실패했습니다. 원본 기록과 설정을 확인하세요.');
 // Caller cannot provide an arbitrary Drive file ID: only canonical record references are read.
 const file=DriveApp.getFileById(match[1]);if(file.isTrashed()||file.getMimeType()!=='image/jpeg'||file.getSize()>120000)throw Error('연결된 사진의 상태나 크기를 확인하세요.');
 return {ref,dataUrl:'data:image/jpeg;base64,'+Utilities.base64Encode(file.getBlob().getBytes())};
}
