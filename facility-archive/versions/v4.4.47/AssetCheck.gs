//테스트확인용 프로그램에는 반영되지않음//
/** 읽기 전용. 파일 쓰기·공유·삭제·설정 적용을 하지 않습니다. */
function checkAssetDriveConnection(){
 const p=PropertiesService.getScriptProperties(),id=String(p.getProperty('ASSET_IMAGE_FOLDER_ID')||'').trim();
 const result={folderIdRegistered:!!id,assetModuleReady:typeof uploadAssetPhoto==='function'&&typeof getAssetPhoto==='function',photoStorageModuleReady:typeof repairPhotoFolderId_==='function'&&String(repairPhotoFolderId_).includes('ASSET_IMAGE_FOLDER_ID'),runtimeFolderMatches:false,folderReadable:false,folderTrashed:null,fileWriteTested:false};
 try{result.runtimeFolderMatches=!!id&&typeof repairPhotoFolderId_==='function'&&repairPhotoFolderId_('ASSET_IMAGE_FOLDER_ID')===id}catch(e){}
 if(id)try{const folder=DriveApp.getFolderById(id);folder.getName();result.folderTrashed=folder.isTrashed();result.folderReadable=!result.folderTrashed}catch(e){}
 console.info(JSON.stringify(result));console.info('폴더 조회만 확인했습니다. 실제 사진 쓰기·저장·배포 성공은 별도 확인이 필요합니다.');return result;
}
