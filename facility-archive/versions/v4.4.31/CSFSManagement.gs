var CSFSCore=(function(){
 'use strict';
 function object(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}
 function validMonth(v){return typeof v==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(v)}
 function validDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===v}
 function rows(data,month){if(!validMonth(month))throw Error('조회 월을 확인하세요.');if(data.csfs!=null&&(typeof data.csfs!=='object'||Array.isArray(data.csfs)))throw Error('기존 CSFS 자료 형식을 확인하세요. 기존 값은 보존했습니다.');const months=object(data.csfs).months;if(months!=null&&(typeof months!=='object'||Array.isArray(months)))throw Error('월별 CSFS 자료 형식을 확인하세요. 기존 값은 보존했습니다.');const value=object(months)[month];if(value!==undefined&&!Array.isArray(value))throw Error('이 월의 CSFS 자료 형식을 확인하세요. 기존 값은 보존했습니다.');return value||[]}
 function validate(r){if(!r||typeof r.id!=='string'||!/^[A-Za-z0-9_.:-]{1,80}$/.test(r.id))throw Error('CSFS 항목 번호를 확인하세요.');if(typeof r.title!=='string'||!r.title.trim()||r.title.length>200)throw Error('제목을 200자 이내로 입력하세요.');if(typeof r.target!=='string'||!r.target.trim()||r.target.length>200)throw Error('대상자를 200자 이내로 입력하세요.');if(!validDate(r.due))throw Error('올바른 완료예정일을 입력하세요.');return {...r,title:r.title.trim(),target:r.target.trim()}}
 function replace(data,month,managedIds,drafts){
  const old=rows(data,month),ids=new Set(managedIds),next=drafts.map(validate),lookup=new Map();
  for(const r of next){if(lookup.has(r.id)||!ids.has(r.id))throw Error('중복되거나 잘못된 CSFS 항목 번호입니다.');lookup.set(r.id,r)}
  const months=object(object(data.csfs).months);for(const [other,entries] of Object.entries(months)){if(other!==month&&Array.isArray(entries)&&entries.some(r=>r&&lookup.has(r.id)))throw Error('다른 월에 같은 항목 번호가 있습니다. 새 등록창에서 다시 등록하세요.')}
  const result=[];for(const r of old){if(!r||!ids.has(r.id)){result.push(r);continue}if(lookup.has(r.id)){result.push({...r,...lookup.get(r.id)});lookup.delete(r.id)}}for(const r of lookup.values())result.push(r);
  return {...data,csfs:{...object(data.csfs),months:{...months,[month]:result}}};
 }
 function remove(data,month,id){const old=rows(data,month);if(!old.some(r=>r&&r.id===id))throw Error('삭제할 CSFS 항목을 찾지 못했습니다.');return replace(data,month,[id],[])}
 return {validMonth,validDate,rows,replace,remove};
})();

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
