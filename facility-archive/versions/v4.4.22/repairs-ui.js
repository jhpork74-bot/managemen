
$('stock').before($('repairs'));
// 고장·공사 관리: 기존 점검 및 업무 데이터와 독립적으로 저장
let repairMode='fault',repairPhotos={},repairSession=0,repairProcessing=0,repairSaving=false,repairCameraPending=null,repairUploadRequest=null;
window.RepairPhotoDraftSignature=()=>JSON.stringify(repairPhotos);
function repairCurrency(n){return Number(n||0).toLocaleString('ko-KR')+'원'}
function repairStatus(x){return x.kind==='fault'?(x.done||'미완료'):(x.workStatus||'미완료')}
function setRepairMode(mode){repairMode=mode;$('repairFaultMode').classList.toggle('primary',mode==='fault');$('repairWorkMode').classList.toggle('primary',mode==='work');$('repairHelp').textContent=mode==='fault'?'고장 위치·사진·담당자·재료 구비·조치완료 여부를 관리합니다.':'공사명·견적서·예산·진행 상태와 공사 전·중·후 사진을 관리합니다.';$('repairAdd').textContent=mode==='fault'?'+ 고장 항목 추가':'+ 공사 항목 추가';renderRepairs()}
$('repairFaultMode').onclick=()=>setRepairMode('fault');$('repairWorkMode').onclick=()=>setRepairMode('work');$('repairSearch').oninput=renderRepairs;$('repairAdd').onclick=()=>openRepair();$('repairCancel').onclick=()=>{if(!repairSaving)$('repairDialog').close()};
function renderRepairs(){
 const q=$('repairSearch').value.trim().toLowerCase();
 const rows=(data.repairs||[]).filter(x=>x.kind===repairMode&&[x.title,x.site,x.owner,x.note].join(' ').toLowerCase().includes(q)).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 const all=(data.repairs||[]).filter(x=>x.kind===repairMode),completed=all.filter(x=>['조치완료','완료'].includes(repairStatus(x))).length;
 $('repairStats').innerHTML=[['전체 등록',all.length+'건'],['처리 완료',completed+'건'],['미완료·진행 중',(all.length-completed)+'건']].map(([k,v])=>`<div class="stat">${k}<b>${v}</b></div>`).join('');
 $('repairList').innerHTML=rows.length?rows.map(x=>{
  const current=repairStatus(x),complete=['조치완료','완료'].includes(current);
  const materialOptions=['미확인','구비 필요','구비 중','구비 완료','불필요'];
  const stateOptions=x.kind==='fault'?['미완료','조치 중','조치완료']:['미완료','진행 중','완료'];
  const selectOptions=(values,selected)=>values.map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
  return `<article class="repair-card" role="button" tabindex="0" aria-label="${esc(x.title)} 상세 수정" data-repair-card="${esc(x.id)}">
    <span class="repair-card-status ${complete?'complete':''}">${esc(current)}</span>
    <div class="repair-card-date">📅 ${esc(x.kind==='work'?(x.due||x.date||'날짜 미정'):(x.date||'접수일 미정'))}</div>
    <div class="repair-card-title" title="${esc(x.title)}">${esc(x.title)}</div>
    <div class="repair-card-actions repair-dropdown-actions">
      ${x.kind==='fault'?`<label class="repair-inline-field">재료 구비<select data-repair-materials="${esc(x.id)}" aria-label="${esc(x.title)} 재료 구비">${selectOptions(materialOptions,x.materials||'미확인')}</select></label>`:`<label class="repair-inline-field">견적 상황<select data-repair-quote="${esc(x.id)}" aria-label="${esc(x.title)} 견적 상황">${selectOptions(['견적 요청 전','견적 요청','견적 대기','견적 수령','견적 검토 중','견적 확정'],x.quote||'견적 요청 전')}</select></label>`}
      <label class="repair-inline-field">${x.kind==='fault'?'조치 상태':'공사 상태'}<select data-repair-status="${esc(x.id)}" aria-label="${esc(x.title)} ${x.kind==='fault'?'조치 상태':'공사 상태'}">${selectOptions(stateOptions,current)}</select></label>
      <button type="button" class="repair-delete-button" data-repair-remove="${esc(x.id)}">삭제</button>
    </div>
  </article>`
 }).join(''):'<p class="mutedtext">등록된 내역이 없습니다. 추가 버튼을 눌러 등록하세요.</p>';
 document.querySelectorAll('#repairList [data-repair-card]').forEach(card=>{
  card.onclick=e=>{if(e.target.closest('button, input, select, label'))return;openRepair(card.dataset.repairCard)};
  card.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target===card){e.preventDefault();openRepair(card.dataset.repairCard)}}
 });
 document.querySelectorAll('#repairList [data-repair-materials]').forEach(el=>el.onchange=()=>{
  const x=data.repairs.find(r=>r.id===el.dataset.repairMaterials&&r.kind==='fault');
  if(!x)return;x.materials=el.value;save();renderRepairs();
 });
 document.querySelectorAll('#repairList [data-repair-quote]').forEach(el=>el.onchange=()=>{
  const x=data.repairs.find(r=>r.id===el.dataset.repairQuote&&r.kind==='work');
  if(!x)return;x.quote=el.value;save();renderRepairs();
 });
 document.querySelectorAll('#repairList [data-repair-status]').forEach(el=>el.onchange=()=>{
  const x=data.repairs.find(r=>r.id===el.dataset.repairStatus);
  if(!x)return;
  if(x.kind==='fault')x.done=el.value;else x.workStatus=el.value;
  save();renderRepairs();
 });
 document.querySelectorAll('#repairList [data-repair-remove]').forEach(el=>el.onclick=()=>{
  const x=data.repairs.find(r=>r.id===el.dataset.repairRemove);
  if(x&&confirm('['+x.title+'] 기록을 삭제하시겠습니까?\\n삭제 후에는 되돌릴 수 없습니다.')){
   data.repairs=data.repairs.filter(r=>r.id!==x.id);save();renderRepairs();
  }
 });

}
function openRepair(id){
 const x=(data.repairs||[]).find(r=>r.id===id)||{id:'',kind:repairMode,title:'',site:'복지관 본관',date:TODAY,photo:'',owner:'',materials:'미확인',done:'미완료',quote:'견적 요청 전',due:'',budget:'',funding:'',workStatus:'미완료',note:''};
 $('repairDialogTitle').textContent=(repairMode==='fault'?'고장':'공사')+(id?' 수정':' 등록');
 $('repairId').value=x.id;$('repairTitle').value=x.title;$('repairSite').value=x.site||'기타';$('repairDate').value=x.date||TODAY;$('repairOwner').value=x.owner||'';$('repairMaterials').value=x.materials||'미확인';$('repairDone').value=x.done||'미완료';$('repairQuote').value=x.quote||'견적 요청 전';$('repairDue').value=x.due||'';$('repairBudget').value=x.budget??'';$('repairFunding').value=x.funding||'';$('repairWorkStatus').value=x.workStatus||'미완료';$('repairNote').value=x.note||'';
 repairSession++;repairProcessing=0;repairCameraPending=null;repairUploadRequest=null;repairPhotos=RepairPhotosCore.read(x);document.querySelectorAll('#repairDialog input[type=file]').forEach(el=>el.value='');document.querySelectorAll('[data-photo-status]').forEach(el=>el.textContent='');$('repairSaveStatus').textContent='';repairPhotoPreview();repairSetBusy();
 document.querySelectorAll('.fault-field').forEach(el=>el.classList.toggle('hidden',repairMode!=='fault'));document.querySelectorAll('.work-field').forEach(el=>el.classList.toggle('hidden',repairMode!=='work'));
 $('repairDialog').showModal();
}
function repairSetBusy(){
 const blocked=repairSaving||repairProcessing>0;
 $('repairSubmit').disabled=blocked;$('repairCancel').disabled=repairSaving;
 document.querySelectorAll('#repairDialog button[data-camera],#repairDialog button[data-gallery],#repairDialog button[data-photo-remove]').forEach(el=>el.disabled=blocked);
 // Freeze editable fields only while waiting for the server so a confirmed snapshot matches the form.
 document.querySelectorAll('#repairDialog input:not([type=file]),#repairDialog select,#repairDialog textarea').forEach(el=>el.disabled=repairSaving);
}
function repairSlotStatus(key,text){document.querySelector('[data-photo-status="'+key+'"]').textContent=text}
function repairPhotoPreview(){
 for(const key of ['fault','before','during','after']){
  const src=repairDisplayPhoto(repairPhotos[key]);
  document.querySelector('[data-photo-preview="'+key+'"]').innerHTML=src?'<button type="button" class="repair-photo-link" data-view-photo="'+key+'" aria-label="사진 크게 보기"><img class="repair-photo" src="'+esc(src)+'" alt="'+({fault:'고장',before:'공사 전',during:'공사 중',after:'공사 후'}[key])+' 사진 미리보기"></button>':'<p class="mutedtext">등록된 사진 없음</p>';
  if(!src&&repairIsDrivePhoto(repairPhotos[key])){document.querySelector('[data-photo-preview="'+key+'"]').textContent='Drive 사진 불러오는 중…';repairLoadDrivePhoto(repairPhotos[key],key)}
 }
 const old=(data.repairs||[]).find(r=>r.id===$('repairId').value),legacyRef=repairMode==='work'&&old&&old.photo,legacy=repairDisplayPhoto(legacyRef);
 $('repairLegacyPhoto').innerHTML=legacy?'<p>기존 사진 (단계 미지정·보존)</p><button type="button" class="repair-photo-link" data-view-photo="legacy"><img class="repair-photo" src="'+esc(legacy)+'" alt="기존 공사 사진"></button>':'';
 if(!legacy&&repairIsDrivePhoto(legacyRef)){$('repairLegacyPhoto').textContent='기존 Drive 사진 불러오는 중…';repairLoadDrivePhoto(legacyRef,'legacy')}
 document.querySelectorAll('#repairDialog [data-view-photo]').forEach(button=>button.onclick=()=>{
  let viewer=$('repairPhotoViewer');if(!viewer){viewer=document.createElement('dialog');viewer.id='repairPhotoViewer';viewer.innerHTML='<form method="dialog"><button>닫기</button></form><img alt="첨부 사진 확대">';document.body.appendChild(viewer)}
  const source=button.dataset.viewPhoto==='legacy'?legacy:repairDisplayPhoto(repairPhotos[button.dataset.viewPhoto]);viewer.querySelector('img').src=source;viewer.showModal();
 });
}
function repairChoosePhoto(key,camera){
 if(repairSaving||repairProcessing||!$('repairDialog').open)return;
 const input=$((camera?'repairCamera-':'repairGallery-')+key);input.value='';
 repairCameraPending=camera?{key,session:repairSession}:null;
 document.querySelector('[data-gallery="'+key+'"]').classList.remove('repair-gallery-needed');
 if(camera)repairSlotStatus(key,'카메라를 열도록 요청했습니다. 촬영을 취소하면 갤러리에서 선택할 수 있습니다.');
 try{input.click()}catch(error){repairShowGallery(key,false)}
}
function repairShowGallery(key,tryAutomatic){
 repairCameraPending=null;
 if(!$('repairDialog').open)return;
 const button=document.querySelector('[data-gallery="'+key+'"]');button.classList.add('repair-gallery-needed');
 repairSlotStatus(key,'촬영이 취소되었거나 선택된 사진이 없습니다. 갤러리에서 사진을 선택해 주세요. 기존 사진은 유지됩니다.');
 const input=$('repairGallery-'+key);input.value='';
 // Opening another native picker may require a fresh user gesture. Never loop on cancellation.
 if(tryAutomatic&&navigator.userActivation&&navigator.userActivation.isActive&&typeof input.showPicker==='function'){
  try{input.showPicker();return}catch(error){/* Explicit gallery button remains available. */}
 }
 button.focus({preventScroll:true});
}
async function repairLoadPhoto(key,input){
 const file=input.files&&input.files[0];repairCameraPending=null;if(!file)return;
 const session=repairSession;repairProcessing++;repairSetBusy();repairSlotStatus(key,'사진을 축소하고 있습니다…');
 try{
  if(!file.type.startsWith('image/'))throw Error('이미지 파일을 선택하세요.');
  const url=URL.createObjectURL(file),img=new Image();
  try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('사진을 읽을 수 없습니다. JPG 또는 PNG 사진을 선택하세요.'));img.src=url})}finally{URL.revokeObjectURL(url)}
  const canvas=document.createElement('canvas'),scale=Math.min(1,960/Math.max(img.width,img.height));canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  let photo='';for(const quality of [.65,.45,.3]){photo=canvas.toDataURL('image/jpeg',quality);if(photo.length<115000)break}
  if(photo.length>160000)throw Error('사진이 큽니다. 더 작은 사진을 선택하세요.');
  if(session!==repairSession||!$('repairDialog').open)return;
  repairPhotos[key]=photo;repairPhotoPreview();repairSlotStatus(key,'사진이 준비되었습니다. 아래 저장을 눌러 반영하세요.');
 }catch(error){if(session===repairSession&&$('repairDialog').open)repairSlotStatus(key,'사진 처리 실패: '+error.message+' 기존 사진은 유지됩니다.')}
 finally{input.value='';if(session===repairSession){repairProcessing--;repairSetBusy()}}
}
for(const key of ['fault','before','during','after']){
 document.querySelector('[data-camera="'+key+'"]').onclick=()=>repairChoosePhoto(key,true);
 document.querySelector('[data-gallery="'+key+'"]').onclick=()=>repairChoosePhoto(key,false);
 document.querySelector('[data-photo-remove="'+key+'"]').onclick=()=>{if(repairSaving||repairProcessing)return;repairPhotos[key]='';repairPhotoPreview();repairSlotStatus(key,'사진 삭제가 준비되었습니다. 저장을 눌러 반영하세요.')};
 $('repairCamera-'+key).onchange=e=>repairLoadPhoto(key,e.target);
 $('repairGallery-'+key).onchange=e=>repairLoadPhoto(key,e.target);
 $('repairCamera-'+key).addEventListener('cancel',()=>{if(repairCameraPending&&repairCameraPending.key===key&&repairCameraPending.session===repairSession)repairShowGallery(key,true)});
 $('repairGallery-'+key).addEventListener('cancel',()=>repairSlotStatus(key,'갤러리 선택을 취소했습니다. 기존 사진은 유지됩니다.'));
}
// Older mobile browsers may not emit input.cancel. Returning to the app exposes the gallery button.
function repairCameraReturn(){const pending=repairCameraPending;if(!pending)return;setTimeout(()=>{if(repairCameraPending===pending&&pending.session===repairSession&&!repairProcessing)repairShowGallery(pending.key,false)},800)}
window.addEventListener('focus',repairCameraReturn);document.addEventListener('visibilitychange',()=>{if(!document.hidden)repairCameraReturn()});
$('repairDialog').addEventListener('cancel',event=>{if(repairSaving)event.preventDefault()});
$('repairDialog').addEventListener('close',()=>{repairSession++;repairProcessing=0;repairCameraPending=null});

$('repairForm').onsubmit=async e=>{
 e.preventDefault();if(repairSaving||repairProcessing)return;if(!cloudReady||cloudBlocked){alert('구글시트 연결을 확인하세요.');return}
 const id=$('repairId').value,idx=data.repairs.findIndex(x=>x.id===id),old=idx>=0?data.repairs[idx]:{};
 const x={...old,id:id||uid(),kind:repairMode,title:$('repairTitle').value.trim(),site:$('repairSite').value,date:$('repairDate').value||TODAY,note:$('repairNote').value.trim()};
 if(repairMode==='fault')Object.assign(x,{owner:$('repairOwner').value.trim(),materials:$('repairMaterials').value,done:$('repairDone').value});
 else Object.assign(x,{quote:$('repairQuote').value,due:$('repairDue').value,budget:Number($('repairBudget').value||0),funding:$('repairFunding').value.trim(),workStatus:$('repairWorkStatus').value});
 if(!x.title)return;
 $('repairId').value=x.id;
 repairSaving=true;repairSetBusy();$('repairSaveStatus').textContent='기존 변경 저장 확인 중…';
 try{
  await saveAndWait();
  const stored=await repairStoreNewPhotos(x.id,repairMode,old,repairPhotos);
  if(repairMode==='fault')x.photo=stored.fault;else x.workPhotos=RepairPhotosCore.merge(old.workPhotos,stored);
  const prospective=[...data.repairs],currentIndex=prospective.findIndex(r=>r.id===x.id);if(currentIndex>=0)prospective[currentIndex]=x;else prospective.push(x);
  if(JSON.stringify({...data,repairs:prospective}).length>1700000)throw Error('업무 데이터 저장 용량 한도에 가깝습니다. 입력 사진과 Drive 파일은 보존합니다.');
  $('repairId').value=x.id;data.repairs=prospective;$('repairSaveStatus').textContent='사진 연결과 업무 기록 저장 중…';await saveAndWait();$('repairDialog').close();renderRepairs();
 }catch(error){$('repairSaveStatus').textContent='저장 완료를 확인하지 못했습니다. '+error.message+' · 상단 저장 상태를 확인하세요. 입력 내용은 유지됩니다.'}finally{repairSaving=false;repairSetBusy()}
};

