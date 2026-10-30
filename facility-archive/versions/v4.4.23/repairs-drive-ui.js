const repairDriveCache=new Map(),repairDrivePending=new Map();
function repairIsDrivePhoto(value){return typeof value==='string'&&/^drive-photo:[A-Za-z0-9_-]{10,200}:[a-f0-9]{64}$/.test(value)}
function repairDisplayPhoto(value){return repairDriveCache.get(value)||RepairPhotosCore.imageSource(value)}
function repairLoadDrivePhoto(ref,slot){
 const recordId=$('repairId').value,session=repairSession;if(!recordId||!repairIsDrivePhoto(ref)||repairDriveCache.has(ref))return;
 if(!repairDrivePending.has(ref))repairDrivePending.set(ref,new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getRepairPhoto(recordId,slot)).finally(()=>repairDrivePending.delete(ref)));
 repairDrivePending.get(ref).then(result=>{
  if(result.ref!==ref||!/^data:image\/jpeg;base64,/.test(result.dataUrl))throw Error('사진 연결이 변경됐습니다. 최신 기록을 다시 여세요.');
  repairDriveCache.set(ref,result.dataUrl);
  if(session===repairSession&&$('repairDialog').open)repairPhotoPreview();
 }).catch(error=>{if(session!==repairSession||!$('repairDialog').open)return;const message='사진 불러오기 실패: '+error.message+' · 창을 다시 열어 재시도하세요.';if(slot==='legacy')$('repairLegacyPhoto').textContent=message;else repairSlotStatus(slot,message)});
}
async function repairStoreNewPhotos(recordId,mode,old,draft){
 const slots=mode==='fault'?['fault']:['before','during','after'],prior=RepairPhotosCore.read(old),photos={};
 for(const key of slots)if(typeof draft[key]==='string'&&draft[key].startsWith('data:image/jpeg;base64,')&&draft[key]!==prior[key])photos[key]=draft[key];
 if(!Object.keys(photos).length)return {...draft};
 const signature=JSON.stringify([recordId,photos]);if(!repairUploadRequest||repairUploadRequest.signature!==signature)repairUploadRequest={signature,id:'photo-'+uid()};
 $('repairSaveStatus').textContent='회사 Drive에 사진 저장 중…';
 const result=await new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).uploadRepairPhotos(repairUploadRequest.id,recordId,photos,cloudRevision));
 if(!result||!result.ok||!result.refs)throw Error('Drive 사진 저장 결과를 확인하지 못했습니다. 입력 사진은 유지됩니다.');
 const stored={...draft};for(const key of Object.keys(photos)){const ref=result.refs[key];if(!repairIsDrivePhoto(ref))throw Error('Drive 사진 연결 결과를 확인하세요.');stored[key]=ref;repairDriveCache.set(ref,photos[key])}
 return stored;
}
