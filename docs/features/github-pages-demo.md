# GitHub Pages Demo

2026-10-25 요청: 공개 저장소에서 설치 없이 접속할 웹 데모와 무작위 추천.

주소: https://hanzi-cho.github.io/character-studio/

## 범위와 데이터

41개 사전 직렬화 예문, 기본 모델 선택, 표정 시안, 회전, undo/redo/reset, PNG/JSON 내보내기와 JSON 가져오기를 제공한다. **내 AI 연결**에서 본인 OpenAI API 키로 자유 채팅과 참고 이미지 초안을 요청할 수 있다. API 사용료는 이용자 계정에 부과된다. 키는 탭 메모리에만 보관하며 고정 OpenAI API로 직접 호출한다. 새로고침·연결 해제로 제거한다. Codex CLI·Node 서버·MCP·Blender는 정적 웹에서 실행하지 않는다. 공식 ChatGPT OAuth는 loopback callback이 필요한 로컬 앱에서 지원한다.

캐릭터와 최근 50개 변경은 방문자의 localStorage `character-studio:web-demo:v1`에 저장한다. 채팅 내역은 탭 메모리에만 남는다. AI 연결 시 자유 입력·현재 설정·사용자가 선택한 참고 이미지는 OpenAI로 전송한다. 원본 이미지와 자격증명은 캐릭터 저장본에 넣지 않는다. 사용자 데이터의 서버 동기화·분석 전송은 없다. 사이트 데이터를 지우면 기록도 사라지며 JSON 내보내기로 별도 보관할 수 있다. 저장 거부·용량 초과는 성공으로 표시하지 않고 기존 상태를 보존한다. 손상된 저장본은 덮어쓰지 않는다.

## 교체 경계

`bootstrap.ts`의 빌드 플래그로 `HttpStudioGateway`와 `BrowserStudioGateway`를 선택한다. UI, Three.js, CharacterService, 예문 해석기, 도메인 스키마를 공유한다. `characterHistory.ts`가 디스크·브라우저의 50회 이력과 revision 규칙을 함께 정의한다. Web Locks로 탭 사이 편집을 직렬화하고 storage 이벤트로 다른 탭의 상태를 갱신한다. 오래된 revision은 충돌로 거부한다.

추천은 첫 표시부터 무작위이며 현재 문장을 제외한다. 인덱스는 UI에 표시하지 않는다. 전체 목록 순회를 보장하는 기능은 아니다.

## 배포와 되돌리기

`pnpm build`는 기존 서버용 `dist/`, `pnpm build:web`는 정적 데모용 `dist-web/`를 생성한다. HTML 자원·홈 경로는 상대 주소여서 `/character-studio/` 하위 경로에서 동작한다. `.github/workflows/pages.yml`이 main에서 타입 검사·로컬 빌드·테스트·웹 빌드 후 `dist-web/`만 Pages에 올린다. 저장소 Settings → Pages → Source는 GitHub Actions다.

문제가 생기면 main의 변경 커밋을 revert하여 이전 정상 코드를 다시 배포한다. 작업 파일·인증 정보·서버는 업로드하지 않는다. 브라우저 저장 구조를 바꿀 때에는 별도 마이그레이션이 필요하다.

## 검증

`tests/browserDemo.test.ts`: 41개 예문 적용, 재조회·undo/redo/reset, 다른 탭의 오래된 revision 거부, 손상·권한/용량 오류, gateway 이벤트.
`tests/commandExamples.test.ts`: 현재 문장을 제외한 모든 후보 도달, 인덱스 범위, 예문 정확 일치와 모델 호출 0회.

브라우저 화면 및 실제 게시 URL 검증 결과는 `docs/TESTING.md`에 기록한다. 모바일 화면 크기 검증은 모바일 실기기 검증을 대신하지 않는다.
