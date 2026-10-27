# 시설관리 웹앱 버전 보관

시설관리 v4.4 개발 과정의 5개 버전 소스와 검증 기록을 보관합니다.

| 보관 번호 | 내용 | 확인 범위 |
|---|---|---|
| [v4.4.1](facility-archive/versions/v4.4.1) | 리뷰 반영 통합본 | 로컬 검증 |
| [v4.4.2](facility-archive/versions/v4.4.2) | 조회일 중앙 15일 업무일지 | 로컬 검증 |
| [v4.4.3](facility-archive/versions/v4.4.3) | 월 당직표 초기 통합본 | 사용자가 월 자동작성 기능 확인 + 로컬 검증 |
| [v4.4.4](facility-archive/versions/v4.4.4) | 소속별 세 달 당직표 | 로컬 검증 / 운영 확인 전 |
| [v4.4.5](facility-archive/versions/v4.4.5) | 직원 등록 간소화·자동/고정 점심대체 | 로컬 검증 / 운영 확인 전 |

이 번호는 2026-10-27에 붙인 보관용 번호이며 실제 과거 배포 번호나 배포 날짜를 뜻하지 않습니다. 모든 버전을 무오류 안정판으로 보증하지 않습니다.

- [복구·설정 안내](facility-archive/README.md)
- [검증 결과](facility-archive/VALIDATION.json)
- [버전 목록과 원본 해시](facility-archive/VERSIONS.json)
- [사본 파일 해시](facility-archive/SHA256SUMS.json)

소스의 직원 실명은 가명으로, 실제 스프레드시트 ID는 자리표시자로 바꿨습니다. 인증키·운영 JSON·사진·실제 직원 명부는 포함하지 않았습니다. 복구 시 Code.gs의 스프레드시트 ID를 본인 기존 ID로 설정하고, Index.html은 Apps Script의 HTML 파일 Index에 넣으세요.

원래 GitHub 저장소의 LICENSE와 .gitignore는 유지했습니다. 보관된 소스만으로 Google ScriptProperties·권한·트리거·운영 데이터가 복구되지는 않습니다.
