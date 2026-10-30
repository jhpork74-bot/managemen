//테스트확인용 프로그램에는 반영되지않음//
/**
 * 계정 확인 전용 진단입니다. 설정·계정·권한을 변경하지 않습니다.
 * 복수 관리자 계정을 지원하는 INI.gs의 기존 진단 함수를 사용합니다.
 * Apps Script 편집기 상단 함수 목록에서 checkAccount를 선택해 실행하세요.
 */
function checkAccount() {
  if (typeof checkFacilityAdminAccounts !== 'function') {
    throw Error('최신 INI.gs를 먼저 설치하세요. 계정 설정은 변경하지 않았습니다.');
  }
  return checkFacilityAdminAccounts();
}
