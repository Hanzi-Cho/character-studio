# 검증 기록

## 2026-10-25 · 공개 실행과 41개 오프라인 예문

- 사용자 결정: 공개 GitHub에서 코드를 내려받아 각자 PC·Codex 로그인으로 사용. 원격 AI 웹 호스팅은 이번 범위에서 제외. Codex 없는 체험도 추가 요청했다.
- `pnpm demo`, `Start-Demo.cmd`, 41개 JSON 예문, 추천 한 문장·새로고침·바로 적용을 추가했다. AI 모드에서도 정확히 일치하는 예문은 모델 호출을 건너뛴다.
- 타입 검사·빌드 성공, 자동 테스트 **27/27 통과**. 예문 전체를 실제 HTTP로 적용하고 파일 재조회·undo를 검증했다. 모델 대체 함수 호출 0회, 부정문 추가/오래된 revision/잘못된 Origin 거부와 상태 보존을 확인했다.
- Windows npm shim을 Node로 직접 실행해 공백·`&`가 포함된 경로와 인자를 검증했다. shell 실행을 사용하지 않는다. 독립 실행형 경로와 누락된 npm entry 실패도 확인했다.
- `pnpm doctor`: Node 24.19.0, Codex 0.163.0-alpha.10.2의 필요한 CLI 옵션, ChatGPT 로그인, 화면 빌드 모두 통과. 초회 로그인 점검의 잘못된 CLI 옵션을 수정한 뒤 재실행했다. doctor는 모델을 호출하지 않는다.
- 별도 4318 / `.data/publication-demo`에서 존재하지 않는 Codex 경로를 지정하고 데모 모드 실행. 복합 예문 버튼 → 추천 새로고침 → 색 적용 → undo → 새싹 예문 직접 입력 → 초기화/undo → 페이지 재열기를 확인했다. 실제 CLI가 없는 다른 PC의 검증을 대신하지는 않는다.
- 1280×720 PC 및 390×844 viewport 확인. 390px에서 가로·세로 overflow 없음, 예문과 적용/새로고침 버튼 표시. 물리 휴대폰 터치 검증은 아니다. 브라우저 error/warn 0개. [PC](evidence/offline-examples/desktop.png) · [390px](evidence/offline-examples/mobile-390.png).
- 수정한 Codex 경로로 예문 목록에 없는 자유 입력을 실제 호출: 본체/귀 `#a8d5ba` + 놀람, 5,883ms, 기대 명령 일치. [모델 응답](evidence/offline-examples/codex-smoke.json). 단일 해석 시험이며 평균 지연이나 사용자별 모델 접근 보장은 아니다.
- commit `730f21a`를 `.data/publication-clean`에 Git 파일만 새로 복제해 frozen-lockfile 설치·빌드·타입 검사·27개 테스트를 모두 통과했다. 기존 앱의 node_modules와 사용자 데이터를 복사하지 않았으며, 같은 Windows의 pnpm 패키지 캐시는 재사용했다. 별도 PC·새 OS·빈 다운로드 캐시 검증은 아니다.


## 2026-10-25 · 실제 Codex 채팅과 조합형 장식

- Windows PC, Codex CLI 0.163.0-alpha.10.2 / ChatGPT 로그인 / gpt-6.1-sol. 외부 API 키 신규 발급 없음. 앱 채팅으로 실제 모델 호출, MCP 5도구 등록. 등록 확인과 현재 대화의 동적 도구 발견 여부는 구분한다.
- 타입 검사·빌드 성공, 자동 테스트 **23/23 통과**, 실패·skip 0. HTTP + 실제 stdio MCP에서 apply_edit_plan의 복합 편집·저장·충돌·잘못된 마지막 작업의 원자적 거부·undo 검증. v1 저장본/이력 마이그레이션, 장식 geometry 재사용/dispose 회귀 포함.
- 실제 UI: 전체 초기화 → 셔츠/날개/왕관/웃음 동시 적용 → 왕관 제거/새싹 새로 조합/날개 1.5배 → 셔츠만 분홍색/놀람. 새싹과 날개·본체 색 유지. 드래그/방향키 회전, undo/redo, 초기화 후 undo 확인.
- 새싹 응답은 원통 1개 + 구 2개, 3개 작업, 10,830ms. [실제 모델 응답](evidence/codex-chat-v1/sprout-model-output.json). 별도 단일 해석 시험은 약 7,918ms. 평균·p95 성능이나 30개 정확도 평가가 아니다.
- 10초 걷기 애니메이션 요청은 미지원 안내, 입력 유지, 저장 문서 무변경. 최종 revision 76의 문서가 [부분 변경 직후 문서](evidence/codex-chat-v1/final-character.json)와 같음을 대조했다.
- [새싹 화면](evidence/codex-chat-v1/03-generated-sprout.png), [부분 색/표정](evidence/codex-chat-v1/04-partial-edit.png), [회전](evidence/codex-chat-v1/05-rotated.png). 실제 화면은 642×510 IAB viewport이며 모바일 실기기 증거가 아니다.
- 기존 사용자 저장본은 `.data/character.before-v2.json`에 보관했다. 현재 작업 공간에는 이번 데모 캐릭터가 저장돼 있다. 이 파일과 CLI 인증 정보는 Git 제외다.
- 최신 서버 재시작 후 revision 76, 저장 파일 SHA256 완전 일치. 시작 스크립트 PowerShell 구문 검사 통과.
- PDF 초안 6쪽, 221,320 bytes. 전체 6쪽을 PNG로 렌더해 한글·줄바꿈·이미지·여백을 확인했다. 파일 생성은 대회 제출 완료가 아니다.
- 후속: 정상 20/실패 10 요청 평가, 실제 Codex 데스크톱 채팅의 새 MCP 도구 발견, 사용 한도/네트워크 장애·취소 UX, 다른 PC 설치, 실제 휴대폰, 정밀 메시·Blender, 5명 사용성, 자산 권리와 제출 완료. 프로젝트 MVP 단계 유지.

## 2026-10-24 · v4 닮음 개선 및 전체 구조 리팩터링

- Windows / Node 24.19.0 / React19.3.0 / Three0.186.1 / IAB Chromium. 시작 HEAD `ac93896`, 이후 로컬 작업 트리.
- 최종 `node node_modules/typescript/bin/tsc --noEmit`, `node scripts/build.mjs` 통과. `node --import tsx --test tests/*.test.ts`: **19/19 통과, 실패/skip 0**.
- 새 테스트 초회에는 TS7 패키지의 compiler API 부재 및 LatheGeometry vertex 순서를 잘못 읽은 측정 코드가 실패했다. static import 검사와 실제 lathe의 97점×65열 인덱스로 수정한 뒤 최종 전체 19개를 통과했다. 실패를 모델 품질 통과로 숨기지 않는다.

| 요구 / 위험 | 입력 → 기대 결과 | 실제 근거 |
| --- | --- | --- |
| F001 조형 | 기본값 → H/W .74~.78, head/body1.04~1.12, 단면9구간 차이<.025 | model.test.ts, v4 mesh JSON; 실제 .754164 / 1.085447 |
| F001 얼굴 부착 | eyeSize .65/1/1.4 → 머리 곡면 위, geometry 재할당 없음 | 실제 head triangle raycast, relief0~.03; model.test.ts |
| F001 표정 | 6개 선택 → body buffer·색·장식 유지 | 모델/도메인/HTTP-MCP 회귀, 최종 6장 화면 |
| ARCH-01 경계 | domain/application·UI·HTTP·renderer → concrete 외부 구현 직접 의존 금지 | architecture.test.ts의 static import 규칙 |
| ARCH-02 async 충돌 | interpreter 대기 중 다른 편집 → 늦은 응답 거부, 저장 보존 | application.test.ts의 대체 interpreter + 실제 파일 저장소 |
| ARCH-03 복구 독립 | interpreter 장애 → typed undo/redo/reset 정상 | application.test.ts, /api/action HTTP, 실제 UI undo/redo |
| ARCH-04 알림 | HTTP 밖 service.patch → 연결 SSE 최신화 | integration.test.ts 실제 loopback 스트림 |
| ARCH-05 실패 | 잘못된/미지원 요청 → 무변경·입력 유지 | 기존 strict schema/MCP 테스트 + 실제 `add wings` UI 실패 |
| ARCH-06 저장본 | 최신 서버 재시작 → 사용자 문서/이력 보존 | 4317 revision46→46, bodyColor#f4b5c5, character.json SHA256 동일 |

브라우저는 별도 4318·`.data/fidelity-qa`에서 검증했다. `mint, eyes bigger` 성공 후 민트색/눈1.15, 웃음 선택 후 같은 커스텀 값, typed undo로 기본 표정만 복구, redo로 웃음 복구를 확인했다. 저장 API 재조회도 일치했다. 미지원 `add wings`는 문서 변경 없이 원문이 입력창에 남았다. 첫 한국어 자동 fill에는 마지막 `ㅁ`이 추가로 들어간 상태가 관찰되어 전체 요청이 거부됐다. 이후 명시적으로 확인한 영문 입력으로 정상 편집을 검증했으며 실제 한국어 IME 조작을 통과로 주장하지 않는다.

1280×720의 기본/6표정·좌우 사면·측면·후면을 직접 관찰했다. 390×844에서 clientWidth=scrollWidth=390, clientHeight=scrollHeight=844, 여섯 시안·모델·입력·도구 표시 확인. 해당 폭에서 마우스 드래그 후 camera 이동도 관찰했다. 실제 모바일 touch/IME/GPU 성능과 구분한다.

[최종 이미지](evidence/chiikawa-fidelity-v4/20-final-front.jpg), [390px](evidence/chiikawa-fidelity-v4/32-mobile-390.jpg), [수치 원시값](evidence/chiikawa-fidelity-v4/mesh-measurement.json), [윤곽 원본 측정](reference-data/contour-v4.json). 원본 이미지 sha256와 threshold 민감도도 기록했다. 새 창/서버가 사용자 파일을 초기화하지 않았다.

기본 정면 초기 관찰 drawCalls40 / triangles74,066 / CPU model geometry pool73, 6표정 방문 후 동일 geometryIds. GPU는 최초 표시 때만 추가 upload된다. 수치는 renderer.info의 주 pass이며 FPS/p95/GPU 전체 비용이 아니다. 브라우저 error/warn 로그는 조회 시 0개였다. 드래그 직후의 browser-metrics.json은 damping 중 scheduled=true인 관찰이며 idle 완료 증거로 사용하지 않는다. 초기 정면 및 재로드 뒤에는 scheduled=false, frameCount3이 유지됨을 확인해 [idle 관찰](evidence/chiikawa-fidelity-v4/browser-idle-metrics.json)을 별도로 저장했다.

현재 미검증: 실제 ChatKit/외부 AI 호스트, 실제 Android/iOS, 전체 한국어 IME/스크린리더, OS PNG 다운로드/JSON 파일선택의 전체 경로, 전원/디스크 장애·다중 writer·v2 마이그레이션. 사용자 닮음 최종 평가는 에이전트 수용 판정과 별도다. 제품화/출시 전이 없음.

## 2026-10-24 · 기능 정의·닮음 피드백·채팅 계획 문서화

- 앱 구현 기준 `ac93896`. 앱 코드/의존성/사용자 저장 설정 변경 없음. 전체 자동 테스트·타입 검사·빌드는 이번 문서화에서 재실행하지 않았다. 아래 14/14는 해당 구현 시점의 통과 이력이다.
- 별도 4318 서버·`.data/feature-audit`에서 1280×720 실제 WebGL 정면/사면/기본·웃음·슬픔·화남을 재관찰하고 공식 사진과 비교했다. [새 피드백](reviews/chiikawa-render-fidelity-review.md)에 기능과 닮음 판정을 분리했다.
- [측정 스크립트](evidence/initial-render-review/measure-model.ts)를 실행해 실제 버텍스·월드 중심값을 [JSON](evidence/initial-render-review/mesh-measurement.json)으로 저장했다. 머리 H/W=.7583008538, 머리/몸통 폭=1.0739530163. 선언 상수의 비율과 구분했다.
- 새 기능/피드백/계획 문서와 README의 로컬 링크 존재 여부 및 주요 측정값 일치를 검사했다. 기존 사용자 작업 공간의 분홍색 캐릭터를 별도로 재조회했고 검토용 초기화를 수행하지 않았다.
- [채팅 계획](features/character-chat-implementation-plan.md)은 공식 문서와 현재 코드를 바탕으로 한 제안이다. ChatKit·OpenAI API·Python 브리지의 설치/연결/호환성/실제 AI 동작은 미검증이며 실행 비용은 발생시키지 않았다.

## 2026-10-24 · R02.3 실측 비율 회귀

- `node node_modules/typescript/bin/tsc --noEmit`, `node scripts/build.mjs`: 통과.
- `node --import tsx --test tests/model.test.ts tests/domain.test.ts tests/integration.test.ts tests/batch.test.ts`: **14/14 통과**.
- 신규: 실제 월드 버텍스에서 머리 높이/폭 0.74~0.78, 눈·볼 정규화 좌표, 귀 연결·18° 기울기; 6종 눈썹 tube 양 끝 단면 중심에서 각도 검증.
- 유지: 몸통 크기 극값에서 얼굴 불변/발 바닥 접촉, 6표정 변경 시 geometry ID·몸 버퍼 version·색·장식 보존, 실제 HTTP/stdin MCP·저장/되돌리기·충돌·도메인 경계 검증.
- 1280×720 실제 WebGL 정면/드래그 회전/6표정 화면 확인. 390×844 화면에서 머리·귀·팔다리·선택 UI·입력창 표시 및 가로 overflow 없음 (clientWidth=scrollWidth=390).
- 브라우저 error 로그 0개. 6표정 방문 후 geometry ID 유지, 대기 시 scheduled=false. GPU geometry 수 증가는 최초 방문 표정의 lazy upload이며 재생성은 없음을 별도 모델 테스트로 확인했다.
- 근거: `docs/evidence/chiikawa-measured-*-v3.jpg`, [측정 보고서](CHIIKAWA-MEASUREMENTS.md), `tests/model.test.ts`.
- 실제 휴대폰 터치/성능, 외부 AI 호스트의 새 모델 표시, 사용자의 닮음 최종 평가는 미검증. 이 변경으로 제품화/출시 상태를 올리지 않는다.


## 2026-10-24 2차 비율·6종 표정 검증 (현재)

R02.2: 얼굴/몸 폭 약 1.08:1, 연속 표면, 짧은 팔다리. R03.2: 표정 시안 6종과 expression-only patch. 자동 테스트 12/12 통과. 기존 테스트를 새로운 연속 표면에 맞춰 갱신했고 체형 최솟값/최댓값에서도 얼굴 폭·위치와 바닥 접촉을 검사한다. 6종 전환 시 몸 vertex buffer version/내용, 재질 색, geometry ID, 장식을 보존하는지 확인한다.

`tests/domain.test.ts`: 기본/웃음/슬픔/화남/놀람/졸림 한국어/영어 해석, 다른 필드 보존, 부정·상충 명령 거부.
`tests/integration.test.ts`: 임시 저장소의 실제 HTTP+stdio MCP 6종 적용/파일 재조회/되돌리기, 기존 충돌·Origin 경계 회귀.
`tests/model.test.ts`: 기본 폭 비율과 체형 편집, 6종 단독 가시성 및 몸 buffer 재업로드 방지.

Windows의 IAB에서 1280×720 6종 화면을 각각 관찰했다. 4318의 별도 `.data/expression-qa` 저장소에서 새로고침 후 졸림 유지, 되돌리기 시 놀람 복원, 채팅으로 민트/리본/슬픔 적용 후 버튼으로 웃음 전환 시 민트·리본 보존을 확인했다. Enter 키로 화남 선택 후 드래그 회전에서 얼굴 곡면 부착을 확인했다. 390×844에서 가로 overflow 없음(clientWidth=scrollWidth=390), 여섯 버튼·모델·채팅 모두 화면에 보임. 브라우저 error/warn 로그 없음. 실제 모바일 기기의 touch/성능 검증으로 간주하지 않는다.

사용자 작업 공간 4317의 revision 16 분홍색 문서는 테스트용 초기화 없이 보존했다. 새 화면/표정 캡처는 [모델링 기록](CHARACTER-MODELING.md), 57개 참고 그림의 선별 근거는 [레퍼런스 검토](CHIIKAWA-REFERENCE-REVIEW.md) 참조. 아래 1차 검증은 당시 이력이다.


## 기본 모델 수정 후 추가 검증

사용자 제공 3장을 반영한 모델 수정 뒤 typecheck/build 통과, 자동 테스트 **11/11** 통과. 추가 `tests/model.test.ts`는 머리/몸통 연결, 몸 크기 변경 시 얼굴 폭 유지, 발 바닥 유지, 표정 전환과 geometry 재사용·유한 좌표를 검사한다. 브라우저에서 기본 정면/사면과 `몸을 크게, 귀를 크게, 눈을 작게, 놀란 표정으로`의 실제 편집 및 되돌리기를 확인했다. 새 캡처와 구조는 [모델링 변경 기록](CHARACTER-MODELING.md)을 참조한다. 아래 9개 테스트·옛 geometry 수치와 캡처는 최초 MVP 당시 기록이다.

환경: Windows, Node 24.19.0, React 19.3.0, Three.js 0.186.1, MCP SDK 2.3.1. 브라우저는 Codex in-app Chromium. 표준 stdio 클라이언트로 실제 자식 MCP 프로세스를 연결했다. 실제 Gemini·Claude·GPT 대화나 모바일 실기기 검증과 구분한다.

## 자동 검증

`pnpm typecheck`, `pnpm build` 통과. `pnpm test`: 9/9 통과, skip 0.

- R03 / domain.test.ts: schema unknown key·무한수·범위 밖·잘못된 색상 거부; 여러 clause의 원자적 적용; 미지원/상충 요청 거부; 이름/범위; 부정문·미지원 trailing intent 거부; 도움말/예시 문법.
- R04 / domain.test.ts: 저장 후 새 Store 재조회, revision 증가/오래된 revision 거부, undo/redo/reset, `.bak`, 손상 파일 fail-closed 및 원문 보존.
- R06 / integration.test.ts: 별도 임시 저장소와 loopback 서버, 실제 stdio MCP process initialize/listTools/get/update/undo, HTTP 재조회로 상태 일치 확인, stale revision의 isError, unsupported command 무변경, cross-origin 403, non-JSON 415.
- R07 / batch.test.ts: 4,096개 instance 생성, 64개 transform만 수정, 같은 matrix buffer/geometry 객체 유지, 불변 요청 버전 증가 없음, capacity/invalid value 거부.

첫 sandbox 실행에서는 OS 임시 파일 rename EPERM/loopback EACCES가 발생했다. 파일 저장을 비원자적으로 바꾸어 우회하지 않고 사용자 PC 권한 환경에서 다시 실행해 위 결과를 확인했다. 이는 제품 기능 실패와 환경 제한을 구분한 기록이다.

## 실제 브라우저 관찰

- R02: 기본 3D 모델 표시, 마우스 드래그로 뒤쪽/옆면의 실제 입체 geometry 확인, 정면 복귀. 전면 이미지 평면이 아니다.
- 키보드: ArrowRight 후 진단 camera가 `[0,2.65,7.4]`에서 `[1.1058,2.65,7.3169]`로 변경됨을 확인했다. Home/정면 버튼 경로도 확인했다.
- R03: `몸을 민트색으로, 귀를 크게, 리본 달아줘` 입력 후 UI 성공 안내 및 실제 모델 색/귀/장식 변경 확인. `날개 달아줘`는 미지원 안내와 무변경. 웃는 표정 표시도 확인.
- R04: 새로고침으로 저장된 민트/리본 상태 유지, 되돌리기/다시 실행으로 전체 거래 단위 복구. 서버 프로세스를 재시작한 후 저장된 상태를 실제 API에서 다시 읽었다.
- R05: 1280×800 데스크톱, 390×844 화면 확인. 모바일 폭에서 초기 모델이 우측 도구에 겹치는 문제를 카메라 FOV 보정으로 수정했다. 화면 폭/scrollWidth 모두 390, 높이/scrollHeight 모두 844. 물리적 touch·pinch·IME 키보드·모바일 GPU는 미검증.
- 도움말 dialog의 실제 표시, Esc로 닫기, 지원/미지원 설명 확인. 완전한 스크린리더/접근성 인증이나 광범위한 브라우저 호환성 시험은 아니다.

증거: [PC 기본](evidence/desktop-default.jpg), [채팅 편집](evidence/desktop-edited.jpg), [모바일 폭](evidence/mobile-390.jpg), [4,096개 배칭](evidence/batch-4096.jpg).

## 렌더링 측정 범위

동일 renderer에서 기본→민트/큰 귀/리본 편집 전후 geometryIds 배열이 같았다. 초기 구현 관찰 기준 GPU geometry 16개와 texture 3개가 증가하지 않았다. 이후 초기 비활성 표정/장식을 숨기는 수정으로 기본 GPU geometry는 11개(첫 사용 시 업로드), 전체 CPU geometry pool은 그대로 16개다. 새로운 표정/장식의 첫 표시 때 GPU geometry가 늘 수 있으며 이것을 누수로 오인하지 않는다.

기본 모델 renderer.info: draw calls 47, triangles 82,946. 리본 추가 상태: draw calls 56, triangles 102,386. 이는 renderer.info의 주 render pass 카운터이며 shadow pass 등 GPU 전체 비용/FPS를 대변하지 않는다.

별도 반복 도형 실험: 4,096 instance, draw call 1, triangles 327,680, geometry 1, matrix buffer 262,144 bytes. 64개 위치/색만 변경한 한 샘플의 CPU submit은 0.2ms였다. 이 수치는 GPU 완료 시간·프레임 시간·통계적 p95가 아니다. CPU 부하 테스트는 별도 자동 테스트이고, 다양한 기기의 FPS·메모리·열/전력 비교는 하지 않았다.

diagnostics에서 대기 중 `scheduled:false`, frame counter가 상호작용 없이 증가하지 않는 것을 확인했다. 원본 Human Atlas 성능을 이번 PC에서 실행/실측한 것은 아니다.

## 명시적 미검증과 다음 수용 기준

- 실제 Gemini·Claude·GPT 호스트: 설치/연결 → get → 명시한 수정 → 화면 반영 → 거부/충돌/서버 종료 → 재연결까지 검증 필요.
- 실제 Android/iOS: 한 손가락 회전, pinch, 가상 키보드, 화면 회전, 백그라운드 복귀, WebGL context 복구와 성능.
- PNG 다운로드/JSON 업로드의 전체 OS 파일 선택·다운로드 경로, 다른 브라우저와 한국어 IME 실입력은 구현과 별도로 추가 수동 검증 필요.
- 데이터: 50개 이력 상한, 디스크 가득참·전원 중단·복원·schema migration·동일 포트 이외 다중 writer 방지·삭제 UX.
- 보안/출시: 같은 PC 프로세스는 신뢰 경계 안이다. remote OAuth/소유권/타인 ID 접근 거부, 공개 배포·로그/분석/업데이트/롤백은 미구현이다.
- 사용자 실제 사용감: 모델 닮음, 귀/눈 비율, 회전 감도, 문법 발견성, 자유 수정 기대 차이를 사용자에게 확인한다.

위 미검증은 제품화/출시 완료를 막는 범위이며, 현재 PC 로컬 데모를 실행한 근거와 혼합하지 않는다.

## 2026-10-25 · GitHub Pages용 정적 데모 / 무작위 추천

- 요구: 설치·Codex 연결 없이 웹 URL로 체험. 추천 첫 문장과 새로고침은 무작위, 번호 숨김, 직전 문장 반복 제외.
- 구현: BrowserStudioGateway + localStorage 저장소, 디스크/브라우저 공통 characterHistory, Web Locks 편집 직렬화, storage 이벤트 갱신. 로컬 HTTP/AI 연결은 유지.
- Windows Node 24 런타임: typecheck, 서버·정적 빌드 통과. 테스트 **31/31 통과**. 샌드박스 안에서는 localhost/임시 파일 교체 제한으로 7개 실패했고, 일반 로컬 실행에서 전체 재검증했다.
- 정적 파일만 제공하는 http.server에서 실제 UI 확인: 추천 새로고침(서로 다른 문장·번호 없음), 적용, 재열기 후 표정 유지, undo, 셔츠+날개+웃음 복합 예문 직접 입력.
- 390×844 브라우저 화면: 가로 넘침 없음(scrollWidth 390), 편집 컨트롤 표시, 콘솔 오류·경고 없음. 실제 모바일 기기 검증은 미실시. 화면: `docs/evidence/pages-demo/mobile.png`.
- 정적 번들에 `/api/state`, EventSource, loopback 연결 문자열 없음. 배포 대상은 `dist-web/`만이며 `.data`와 인증 파일은 포함하지 않는다.
- 실제 GitHub Pages 게시/원격 URL 검증은 배포 후 Linear HAN-186 기록으로 남긴다. 공개 AI 백엔드 배포와 구분한다.
- PDF: 기존 6쪽에서 2쪽으로 축약, 실제 편집 전후 이미지·5개 핵심 제안·1인 역할·출처·웹 데모 링크. 173,405 bytes, 8개 링크, 두 페이지 Poppler 렌더 시각 검수 완료. 참가 신청 완료·기획서 미제출 상태를 유지한다.
- 실제 공개 URL https://hanzi-cho.github.io/character-studio/ 확인. main 9bc56c8의 GitHub Actions run 40181971018에서 Linux 빌드·타입·테스트·Pages 배포 모두 성공. 공개 화면에서 무작위 추천, 복합 예문 적용, 새로고침 후 저장 유지와 직접 입력 성공. 콘솔 오류·경고 없음. 저장소 About Website와 README에 URL 연결. 화면: `docs/evidence/pages-demo/public-demo.png`.
- 후속 PDF 요청 반영: 채팅 → Codex JSON 직렬화 → JSON.parse → Zod의 명령/ENUM 검증 → compilePlan/patch/저장 → Three.js 갱신을 6노드로 표현. 실제 JSON 예시, 4개 편집 op와 6개 표정 enum, 부위 단위 갱신·메시 재사용·필요 시 렌더·예문 AI 호출 생략을 설명. PNG/JSON 다운로드·여러 시점 보기·세부 수정, Blender와 다른 기본 캐릭터 확장을 명시. 재생성 후 2쪽·173,405 bytes 및 양쪽 렌더 시각 검수 통과.

## 2026-10-25 · 항상 보이는 편집 상태 영역

- 요구: 초기 안내/적용 결과를 표정 버튼 위에 고정. 표정 변경 토스트 제거. 예문의 AI 없이 체험/분류와 캐릭터 소개 문구 제거.
- 구현: useStudio의 단일 feedback 상태를 ChatPanel 계약으로 전달. 처리 중·예문·표정·undo/reset·파일·오류를 한 영역으로 통합. 채팅 이력과 분리해 표정 변경 뒤 이전 채팅 결과가 재노출되지 않게 했다. 토스트 및 시간제 숨김 제거.
- 타입·서버 빌드·정적 웹 빌드 및 기존 31개 테스트 통과. UI 변경에 구현을 반복하는 새 단위 테스트는 추가하지 않았다.
- 실제 정적 웹 UI: 초기 안내 → 첫 예문 → 슬픔 표정 → 미지원 요청 오류 확인. 상태 영역 항상 52px, toast 요소 0, 제거 대상 문구 없음. 오류 뒤에도 모델의 기존 상태 유지.
- 1280×720: 첫 적용 전후 stage/status/expression/example/composer의 경계 좌표 모두 동일. 390×844: 표정 영역 y=585.600px와 상태 높이 52px 유지, 가로 넘침 없음. 실제 모바일 기기 검증은 별도. 화면: docs/evidence/edit-feedback/mobile.png.
