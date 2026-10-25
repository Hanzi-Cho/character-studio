# Character Base Profiles and AI Connection

기준: 2026-10-25. 사용자 승인: 우사기 기본 모델, 여러 이미지의 특징을 반영한 편집 가능한 단순 3D 초안, 본인 API 키/공식 계정 로그인 구현, 제품화 작업 착수. Meta·Blender는 후속이다.

## 사용자와 사용 동기

첫 사용자는 나노바나나·Sora로 이미지/영상을 만들어 본 일반인 중 3D 편집 경험이 없는 사람이다. SNS·GitHub·커뮤니티의 자기 캐릭터를 바꾸려 할 때 이미 마음에 든 모습을 불러와 옷·장식·표정만 바꾸고, 회전해 확인한 뒤 저장한다. 계절·분위기·활동이 바뀌면 같은 자산을 이어 쓴다.

이것은 수요 가설이다. 일반인 5명의 과업 완료·막힌 지점·재사용 의향을 관찰해 확인한다. 웹 접근, 이미지 편집, 이미지→3D 자체가 독점 기능이라는 주장은 하지 않는다. Gemini도 일관성 있는 이미지 편집을 제공하며 Meshy·Tripo도 이미지→3D를 제공한다. 차별화 목표는 작은 구조화 자산의 부분 수정·복구·반복 사용을 쉽게 만드는 것이다.

## 구현 경계와 파일 구조

- `src/domain/baseProfile.ts`: 기본 자산의 허용 범위와 치이카와/우사기 카탈로그.
- `src/domain/character.ts`, `characterHistory.ts`: v3 문서, v1/v2 이력 마이그레이션, 현재 기본 모델 기준 초기화.
- `src/domain/editPlan.ts`: `load_base`를 포함한 원자적 편집 목록. 기본 모델 교체는 첫 명령에 한 번만 허용한다.
- `src/domain/referenceImages.ts`: 이미지 수·형식·길이·서명 시작값 제한.
- `src/presentation/prepareReferenceImage.ts`: 브라우저 이미지 디코딩·1024px 재인코딩·메타데이터 제거.
- `src/application/ports.ts`, `editorPrompt.ts`, `aiConnection.ts`: UI·저장·해석기의 교체 경계와 공통 편집 계약.
- `src/adapters/OpenAiInterpreter.ts`: 고정 OpenAI endpoint, 모델 목록, Responses SSE, 완료 응답 검증, 메모리 세션.
- `server/CodexCommandInterpreter.ts`: 기존 Codex CLI 로그인, 이미지 임시 파일 입력·정리.
- `server/ChatGptConnection.ts`: 공식 PKCE/OIDC 등록·재로그인·토큰 갱신·철회. 토큰은 서버 메모리, 등록 메타데이터만 디스크.
- `src/components/AiConnectionDialog.tsx`, `Composer.tsx`, `App.tsx`: 연결, 이미지 첨부, 기본 모델 선택 UI.
- `src/adapters/ChiikawaModel.ts`, `CharacterParts.ts`: 프로필 수치에 따른 기존 메시 갱신과 장식 위치. React·모델 공급자 코드는 렌더러에 들어가지 않는다.

기본 모델의 색·이름·몸 비율·얼굴과 귀 기준을 `base`에 기록한다. 현재 외형 필드와 분리해 자유 편집 후 초기화할 수 있다. JSON에는 결과 설정만 저장하고 원본 이미지·키·토큰을 넣지 않는다. 전체 스키마를 통과하지 못한 편집, 오래된 revision의 결과는 기록하지 않는다.

## 주요 모델 수치

치이카와 머리 기준은 너비 2.32, 높이 1.76, 하단 y=1.34, 상단 y=3.10이다. 우사기는 그 너비의 0.98배, 높이의 1.02배이다. 몸통 기본 너비 2.15, 바닥 y=.23, crown y=1.79를 공유한다.

우사기 귀는 기본 높이 .4의 3.15배, 너비 .37의 .88배, 바깥쪽 각도 8도, 피벗 x=±(.69×.48)이다. 내부 분홍 면을 추가하고 털은 #f6e2aa, 눈 크기는 .91배로 설정한다. 기본 표정의 긴 아치형 눈썹은 머리 정규화 좌표 (±.29,.40)→(±.26,.31)→(±.21,.24)→(±.15,.205)을 따른다. 공식 치수가 아니라 확인한 정면 레퍼런스를 현재 리그로 해석한 근사 수치이다.

이미지 초안은 머리 너비·높이 .8–1.2배, 귀 길이 .5–3.5배·너비 .65–1.4배·각도 −10–35도, 눈 .65–1.4배, 몸통 너비 .75–1.35배·높이 .8–1.3배 안에서 만든다. 얼굴 유형은 soft/rabbit이다. 복잡한 머리카락·사람 얼굴·삼각형 귀·원본 토폴로지 재구성은 이 리그가 표현하지 못한다. 입력 범위 밖 요구는 한계를 설명하며 정밀 복원을 주장하지 않는다.

## AI 연결과 데이터 권한

1. 웹: 사용자가 **본인 OpenAI API 키**를 입력하고 AI 전송·본인 과금을 확인한다. OpenAI로 직접 요청하고 운영자 서버는 거치지 않는다. 키는 현재 탭 메모리에만 있다. 탭 새로고침/닫기/해제 시 제거된다. 신뢰하는 배포본에서만 키를 입력한다.
2. 로컬: **Continue with ChatGPT**로 공식 OAuth. 현재 OSS 규격은 127.0.0.1 loopback callback을 사용한다. API 키 없이 지원 ChatGPT 플랜으로 모델을 호출한다. 계정/모델 제한은 공급자 정책을 따른다.
3. 기존 로컬 Codex: 이미 로그인한 CLI를 사용할 수 있다. CLI credential file을 읽거나 웹에 복사하는 기능은 없다.

ChatGPT 로그인은 state·nonce·PKCE S256을 사용한다. JWKS 서명·issuer·issued client audience·만료·nonce·returning subject·모델 사용 scope를 검증한다. credential은 로그·브라우저 저장소·Git에 넣지 않는다. 동일 host/client 등록을 재사용하고 access token 갱신을 직렬화한다. 토큰을 디스크에 영속 저장하지 않으므로 서버를 껐다 켜면 재로그인한다. 원격 철회 실패 시 사용자에게 ChatGPT 설정에서 연결을 해제하도록 안내한다.

로컬 서버는 단일 PC 사용자용이다. API의 Host/Origin/fetch-site 차단을 유지하며 OAuth callback은 state로 검증한다. 외부 로그인에서 돌아오는 정적 문서 GET은 허용한다. 다중 사용자 클라우드 서버, 공유 데이터 ACL, 조직 권한은 구현하지 않았다.

이미지는 사용자 선택 시에만 1–4장을 AI로 전송한다. PNG/JPEG/WebP 각 10MB 이하를 브라우저에서 재인코딩한다. 서버는 PNG/JPEG 데이터 URI와 최대 payload를 재검사하며 CLI 임시 디렉터리는 finally에서 지운다. 공급자 자체 데이터 정책과 앱의 원본 미보관은 구분한다.

Meta의 향후 모델명·API 규격은 확인 전이다. 공급자 어댑터를 추가할 수 있지만 현재 작동하는 메뉴로 표시하지 않는다.

## 수용 기준과 검증 근거

- BASE-01: 우사기 로드→표정/장식 수정→초기화→되돌리기. `tests/aiConnection.test.ts`, 실제 PC 화면. 기존 6개 표정/geometry 재사용 검증 유지.
- IMAGE-01: 2장 첨부→실제 Codex→`load_base`→3D→추가 편집. `docs/evidence/base-profiles-v1/image-draft-audit.json`, 약 6.04초 단일 실행. 일반 성능 평균이 아니다.
- IMAGE-02: 5장·잘못된 형식·모델 미연결은 실패 안내. 테스트에서 적용 전 거부, 기존 모습 보존.
- AUTH-01: 실제 사용자 ChatGPT 동의→모델 목록→gpt-6.1-sol 자유 편집→3D 반영 성공. 꽃잎 다섯 장+꽃술을 구 6개로 새로 조합, 기존 얼굴/날개/목도리 보존, 14,807ms 단일 실행. `docs/evidence/base-profiles-v1/chatgpt-flower-audit.json` 및 화면. 토큰/이메일은 공개 근거에 포함하지 않는다.
- AUTH-02: OAuth state 불일치·취소 재사용 거부, loopback·PKCE·host 유지. 자동 테스트. nonce/서명 검증은 jose를 사용한다.
- AI-01: Responses 요청 `store:false`, `stream:true`, 모델별 JSON schema. 완료 이벤트 이전에 적용하지 않는다. 중단/잘못된 명령/연결 변경 시 적용 거부.
- DATA-01: v1/v2 문서·이력 변환, custom base 초기화/undo, 디스크 backup, 손상 파일 보존. 자동 테스트.
- UI-01: 키보드 dialog/select/첨부 제거, 반응형 브라우저 확인. 물리 모바일 실기기·스크린리더 과업은 후속이다.

실제 API 키로 유료 inference는 수행하지 않았다. 가짜 key의 인증 거부와 mock SSE 자동 검증은 실제 과금 API 성공으로 표시하지 않는다. 공식 API의 CORS는 공개 데모 Origin으로 OPTIONS 요청해 확인했다.

타입 검사·로컬/웹 빌드·자동 테스트 39/39 통과. 실제 브라우저에서 잘못된 API 키의 인증 거부 확인. 로그인에서 돌아온 정적 페이지의 cross-site 차단, 브라우저 fetch 호출 receiver, 최종 이벤트 본문이 생략된 SSE 델타 처리 문제를 고쳤다. API로 받은 스트림을 끝까지 검증하고 완료 전에는 적용하지 않는다.

## 제품화 순서

1. **이번 변경**: 기본 모델·이미지 초안·본인 AI 연결, 기존 자료 보존·실패 복구·명시적 도움말. 에이전트 구현/회귀, 사용자 실제 연결 동의.
2. **정확도와 장애**: 자유 문장 30개·실패 10개를 실제 모델로 평가. 성공 정의는 요청한 속성만 변경, JSON 재로드 동일성, 오류 시 무변경. 응답시간 p50/p95·실패 원인을 기록한다. 공급자 오류·갱신/철회·오프라인·취소·동시 탭을 보강한다.
3. **사용자 5명**: 불러오기→원하는 부분 수정→360도 확인→PNG/JSON 저장→다시 편집. 설치/연결 완료율·수정 재시도·막힘·재사용 의향을 관찰한다. 조재현 모집·판단, 에이전트 시나리오/계측 지원.
4. **출시 준비**: 허가/자체 대표 자산, 브라우저 저장 삭제/백업 복구 UI, 물리 모바일, 접근성, 장애 대응/롤백, 데이터 정책, 라이선스/공개 범위. 수요 확인 전 유료 서버·Kubernetes·분석 추적기를 추가하지 않는다.
5. **후속 확장**: Meta 공식 API, Blender 세부 조형, 여러 캐릭터/3D export. 현재 primitive 초안과 구분해 별도 수용 기준을 만든다.

제품화 진행은 출시 완료가 아니다. 실제 BYOK 과금 API, 장시간 토큰 갱신·철회 실패 재시도, 물리 모바일, 사용자 조사, 정밀 메시 복원은 미검증/후속으로 남긴다.
