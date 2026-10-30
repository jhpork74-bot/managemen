//테스트확인용 프로그램에는 반영되지않음//
/** 읽기 전용 진단. 설정 변경·파일 생성·삭제·잔디 발송 없음. */
function checkCSFSDriveConnection() {
  const expected = 'CSFS_FOLDER_PLACEHOLDER';
  const p = PropertiesService.getScriptProperties();
  const configured = String(p.getProperty('CSFS_IMAGE_FOLDER_ID') || '').trim();
  const active = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const effective = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  const report = {
    folderIdRegistered: Boolean(configured),
    folderIdMatches: configured === expected,
    configModuleReady: typeof iniNormalize_ === 'function' && String(iniNormalize_).includes('CSFS_IMAGE_FOLDER_ID'),
    csfsServiceReady: typeof uploadCSFSPhoto === 'function',
    photoStorageModuleReady: typeof repairPhotoFolderId_ === 'function' && String(repairPhotoFolderId_).includes('CSFS_IMAGE_FOLDER_ID'),
    runtimeFolderMatches: false,
    sameExecutionAccount: Boolean(active && active === effective),
    folderReadable: false,
    folderTrashed: null,
    fileWriteTested: false
  };
  try {
    if (typeof repairPhotoFolderId_ === 'function') {
      report.runtimeFolderMatches = repairPhotoFolderId_('CSFS_IMAGE_FOLDER_ID') === expected;
    }
  } catch (error) {}
  try {
    const folder = DriveApp.getFolderById(expected);
    folder.getName();
    report.folderTrashed = folder.isTrashed();
    report.folderReadable = !report.folderTrashed;
  } catch (error) {
    report.folderReadable = false;
  }
  console.log(JSON.stringify(report));
  console.log('이 진단은 폴더 조회까지만 확인합니다. 파일 쓰기·웹앱 배포 상태는 별도 확인이 필요합니다.');
  return report;
}
