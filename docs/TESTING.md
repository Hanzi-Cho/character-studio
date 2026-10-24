# 검증 기록 — 2026-10-24

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
