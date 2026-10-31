var AssetCore=(()=>{
 'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),validId=v=>typeof v==='string'&&/^[A-Za-z0-9_.:-]{1,80}$/.test(v);
 const states=['사용중','불용예정','불용완료'];
 function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v}
 function text(v,label,max=200,required=true){if(typeof v!=='string'||v.length>max||required&&!v.trim())throw Error(label+'을 확인하세요.');return v.trim()}
 function store(data){
  const s=data.assetManagement;if(s!=null&&(!s||typeof s!=='object'||Array.isArray(s)))throw Error('기존 재물관리 자료 형식을 확인하세요.');
  const r=clone(s||{});if(r.schemaVersion&&r.schemaVersion!==1)throw Error('더 최신 재물관리 자료입니다. 프로그램 버전을 확인하세요.');
  for(const key of ['items','locations','movements','surveys','statusHistory']){if(r[key]!=null&&!Array.isArray(r[key]))throw Error('재물관리 '+key+' 자료 형식을 확인하세요.');r[key]=r[key]||[]}
  r.schemaVersion=1;return r;
 }
 function wrap(data,s){return {...data,assetManagement:s}}
 function location(s,id){const l=s.locations.find(x=>x&&x.id===id&&x.active!==false);if(!l)throw Error('등록된 장소를 선택하세요.');return l}
 function addLocation(data,{id,name}){const s=store(data);if(!validId(id))throw Error('장소 번호 오류');name=text(name,'장소명',80);const old=s.locations.find(x=>x&&x.id===id);if(old){if(old.name!==name)throw Error('장소 번호가 중복됩니다.');return data}if(s.locations.some(x=>x&&x.name===name))throw Error('이미 등록된 장소입니다.');s.locations.push({id,name,active:true});return wrap(data,s)}
 function upsert(data,record,today){
  if(!date(today)||!record||!validId(record.id))throw Error('물품 등록 정보를 확인하세요.');
  const s=store(data),old=s.items.find(x=>x&&x.id===record.id),r={...old,...record};
  r.assetNo=text(r.assetNo,'관리번호',80);r.name=text(r.name,'물품명',160);r.department=text(r.department||'','부서',100,false);r.manager=text(r.manager||'','담당자',100,false);r.note=text(r.note||'','비고',2000,false);
  if(!Number.isSafeInteger(r.quantity)||r.quantity<1||r.quantity>1000000)throw Error('수량은 1 이상의 정수로 입력하세요.');
  if(r.acquiredDate&&(!date(r.acquiredDate)||r.acquiredDate>today))throw Error('취득일을 확인하세요.');r.acquiredDate=r.acquiredDate||'';
  if(s.items.some(x=>x&&x.id!==r.id&&String(x.assetNo).trim().toLowerCase()===r.assetNo.toLowerCase()))throw Error('이미 등록된 관리번호입니다.');
  const l=location(s,r.locationId);
  if(old){if(r.locationId!==old.locationId)throw Error('장소는 이동경로 추적 창에서 변경하세요.');if(r.status!==old.status)throw Error('불용 상태는 전용 버튼에서 변경하세요.');r.firstLocationId=old.firstLocationId;r.firstLocationName=old.firstLocationName;r.createdDate=old.createdDate;r.lastSurveyDate=old.lastSurveyDate||'';}
  else{r.firstLocationId=l.id;r.firstLocationName=l.name;r.createdDate=today;r.status='사용중';r.lastSurveyDate='';}
  r.locationName=l.name;if(r.photo!=null&&typeof r.photo!=='string')throw Error('사진 연결 정보를 확인하세요.');r.photo=r.photo||'';r.updatedDate=today;
  if(old)s.items=s.items.map(x=>x&&x.id===r.id?r:x);else s.items.push(r);return wrap(data,s);
 }
 function move(data,entry,today){
  const s=store(data);if(!entry||!validId(entry.id)||!validId(entry.itemId)||!date(entry.date)||!date(today)||entry.date>today)throw Error('이동일과 물품 정보를 확인하세요.');
  const duplicate=s.movements.find(x=>x&&x.id===entry.id);if(duplicate){if(duplicate.itemId!==entry.itemId||duplicate.toLocationId!==entry.toLocationId||duplicate.date!==entry.date||duplicate.note!==(entry.note||'').trim())throw Error('같은 이동 요청의 내용이 달라졌습니다.');return data}
  const item=s.items.find(x=>x&&x.id===entry.itemId);if(!item)throw Error('등록된 물품이 없습니다.');if(item.status==='불용완료')throw Error('불용처리 완료 물품은 이동할 수 없습니다.');
  const last=s.movements.filter(x=>x&&x.itemId===item.id).slice(-1)[0];if(entry.date<(last?last.date:item.createdDate))throw Error('이동일은 최초 등록일 또는 마지막 이동일 이후여야 합니다.');
  if(entry.expectedLocationId!==item.locationId)throw Error('물품의 현재 장소가 바뀌었습니다. 최신 내용을 다시 확인하세요.');
  const target=location(s,entry.toLocationId);if(target.id===item.locationId)throw Error('현재 장소와 다른 마지막장소를 선택하세요.');
  s.movements.push({id:entry.id,itemId:item.id,date:entry.date,firstLocationId:item.firstLocationId,firstLocationName:item.firstLocationName,fromLocationId:item.locationId,fromLocationName:item.locationName,toLocationId:target.id,toLocationName:target.name,note:text(entry.note||'','이동 메모',1000,false),quantity:item.quantity});
  item.locationId=target.id;item.locationName=target.name;item.updatedDate=today;return wrap(data,s);
 }
 function survey(data,{id,itemIds,date:day},today){
  if(!validId(id)||!date(day)||!date(today)||day>today)throw Error('조사일을 확인하세요.');
  if(!Array.isArray(itemIds)||!itemIds.length||new Set(itemIds).size!==itemIds.length)throw Error('조사 완료한 물품을 선택하세요.');
  const s=store(data),prior=s.surveys.find(x=>x&&x.id===id);if(prior){if(prior.date!==day||!same(prior.itemIds,itemIds))throw Error('같은 조사 요청의 내용이 달라졌습니다.');return data}
  const records=itemIds.map(id=>{const item=s.items.find(x=>x&&x.id===id);if(!item||item.status==='불용완료')throw Error('사용 중이거나 불용 예정인 물품만 조사할 수 있습니다.');if(day<item.createdDate||item.lastSurveyDate&&day<item.lastSurveyDate)throw Error('조사일은 등록일 또는 마지막 조사일 이후여야 합니다.');return item});
  s.surveys.push({id,date:day,itemIds:[...itemIds],items:records.map(x=>({id:x.id,assetNo:x.assetNo,name:x.name,quantity:x.quantity,locationId:x.locationId,locationName:x.locationName,status:x.status}))});
  records.forEach(x=>x.lastSurveyDate=day);return wrap(data,s);
 }
 function changeStatus(data,{id,itemIds,status,date:day},today){
  if(!validId(id)||!Array.isArray(itemIds)||!itemIds.length||new Set(itemIds).size!==itemIds.length||!['불용예정','불용완료','사용중'].includes(status)||!date(day)||!date(today)||day>today)throw Error('대상 물품·처리일·상태를 확인하세요.');
  const s=store(data),old=s.statusHistory.find(x=>x&&x.id===id);if(old){if(old.status!==status||old.date!==day||!same(old.itemIds,itemIds))throw Error('같은 처리 요청의 내용이 달라졌습니다.');return data}
  const records=itemIds.map(id=>{const x=s.items.find(x=>x&&x.id===id);if(!x)throw Error('등록된 물품이 없습니다.');if(day<x.createdDate)throw Error('처리일을 확인하세요.');if(status==='불용완료'&&x.status!=='불용예정')throw Error('불용예정으로 저장한 물품만 완료 처리할 수 있습니다.');if(status==='불용예정'&&x.status!=='사용중'||status==='사용중'&&x.status!=='불용예정')throw Error('선택한 상태로 변경할 수 없는 물품이 있습니다.');return x});
  s.statusHistory.push({id,itemIds:[...itemIds],date:day,status,before:records.map(x=>({id:x.id,status:x.status}))});records.forEach(x=>{x.status=status;x.updatedDate=today});return wrap(data,s);
 }
 function assignManager(data,{itemIds,manager},today){
  if(!date(today)||!Array.isArray(itemIds)||!itemIds.length||new Set(itemIds).size!==itemIds.length)throw Error('담당자를 지정할 물품을 선택하세요.');
  manager=text(manager,'담당자',100);const s=store(data),ids=new Set(itemIds);
  if(itemIds.some(id=>!validId(id)||!s.items.some(x=>x&&x.id===id)))throw Error('선택 물품이 변경되었습니다. 최신 목록에서 다시 선택하세요.');
  s.items=s.items.map(x=>x&&ids.has(x.id)?{...x,manager,updatedDate:today}:x);return wrap(data,s);
 }
 return {store,addLocation,upsert,assignManager,move,survey,changeStatus,date,states};
})();

function includeAssetManagementUI_(){return HtmlService.createTemplateFromFile('AssetManagementUI').getRawContent()}
function uploadAssetPhoto(requestId,itemId,dataUrl,expectedRevision){
 if(typeof requestId!=='string'||!/^[A-Za-z0-9_.:-]{1,80}$/.test(requestId)||typeof itemId!=='string'||!/^[A-Za-z0-9_.:-]{1,80}$/.test(itemId))throw Error('재물 사진 요청 번호를 확인하세요.');
 const result=uploadRepairPhotos('asset-'+requestId,'asset-'+itemId,{fault:dataUrl},expectedRevision,'ASSET_IMAGE_FOLDER_ID');return {ok:result.ok,ref:result.refs.fault,duplicate:!!result.duplicate};
}
function getAssetPhoto(itemId){
 if(typeof itemId!=='string'||!/^[A-Za-z0-9_.:-]{1,80}$/.test(itemId))throw Error('재물 번호를 확인하세요.');
 const snapshot=getFacilityData(),item=AssetCore.store(snapshot.data||{}).items.find(x=>x&&x.id===itemId);if(!item)throw Error('저장된 물품을 찾지 못했습니다.');
 return repairReadPrivatePhoto_('asset-'+itemId,'fault',item.photo);
}
/** Called only by deferred reporting. The canonical JSON remains authoritative. */
function writeAssetReports_(book,data){
 const s=AssetCore.store(data),names=Object.fromEntries(s.items.filter(Boolean).map(x=>[x.id,x]));
 put_(book,'재물관리대장',['물품ID','관리번호','물품명','수량','취득일','부서','최초장소','현재장소','상태','최근조사일','내용','사진등록','담당자'],s.items.filter(Boolean).map(x=>[x.id,x.assetNo,x.name,x.quantity,x.acquiredDate||'',x.department||'',x.firstLocationName,x.locationName,x.status,x.lastSurveyDate||'',x.note||'',x.photo?'있음':'없음',x.manager||'']));
 put_(book,'재물이동이력',['이력ID','물품ID','관리번호','물품명','최초장소','이동일','직전장소','마지막장소','수량','내용'],s.movements.filter(Boolean).map(x=>[x.id,x.itemId,names[x.itemId]?.assetNo||'',names[x.itemId]?.name||'',x.firstLocationName,x.date,x.fromLocationName,x.toLocationName,x.quantity,x.note||'']));
 put_(book,'재물조사기록',['조사ID','조사일','물품ID','관리번호','물품명','수량','조사당시장소','상태'],s.surveys.flatMap(x=>(x.items||[]).map(item=>[x.id,x.date,item.id,item.assetNo,item.name,item.quantity,item.locationName,item.status])));
}
