function includeCSFSManagementUI_(){return HtmlService.createHtmlOutputFromFile('CSFSManagementUI').getContent()}
function uploadCSFSPhoto(requestId,entryId,dataUrl,expectedRevision){
 if(typeof entryId!=='string'||!/^[A-Za-z0-9_.:-]{1,80}$/.test(entryId)||typeof requestId!=='string'||!/^[A-Za-z0-9_.:-]{1,80}$/.test(requestId))throw Error('CSFS 사진 요청 번호를 확인하세요.');
 const result=uploadRepairPhotos('csfs-'+requestId,'csfs-'+entryId,{fault:dataUrl},expectedRevision,'CSFS_IMAGE_FOLDER_ID');return {ok:result.ok,ref:result.refs.fault,duplicate:!!result.duplicate};
}
function getCSFSPhoto(month,entryId){
 const snapshot=getFacilityData();if(!snapshot.data)throw Error('저장된 업무 데이터가 없습니다.');
 const record=CSFSCore.rows(snapshot.data,month).find(r=>r&&r.id===entryId);if(!record)throw Error('저장된 CSFS 항목이 없습니다.');
 return repairReadPrivatePhoto_('csfs-'+entryId,'fault',record.photo);
}
