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
