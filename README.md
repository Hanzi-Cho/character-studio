# Character Studio

대화로 여러 종류의 3D 캐릭터를 만들고 수정하는 스튜디오입니다. 기존 작업명과 앱 표기는 **Softform Studio**이며, 공개 저장소는 [Hanzi-Cho/character-studio](https://github.com/Hanzi-Cho/character-studio)입니다.

PC에서 3D 치이카와를 돌려 보고, 하단 채팅으로 색상·비율·표정·장식을 바꾸는 로컬 웹 MVP입니다. React + TypeScript + Three.js로 구현했습니다. 외부 AI 없이 동작하는 **제한된 명령 편집기**와 **실제 stdio MCP 서버**가 있습니다. Gemini·Claude·GPT 앱 연결이나 임의의 3D 생성은 아직 구현/검증하지 않았습니다.

다음 단계는 **Meta Model API**를 연결해 자연어 요청을 검증된 캐릭터 편집 명령으로 변환하는 것입니다. 여러 기본 캐릭터, 날개·새 장식과 모바일 확장은 계획이며, 현재 API 연동이나 자유로운 3D 생성이 구현되었다는 뜻은 아닙니다.

## 이 PC에서 열기

Node.js 24 이상과 pnpm을 준비한 뒤 아래 명령으로 의존성을 설치하고 빌드합니다. Windows에서는 이후 `Start-Studio.cmd`로 서버 확인/시작 후 `http://127.0.0.1:4317`을 열 수 있습니다. 실행 파일 배포본이나 자동 업데이트 앱은 아닙니다.

개발 실행:

```sh
git clone https://github.com/Hanzi-Cho/character-studio.git
cd character-studio
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

검증: `pnpm typecheck`, `pnpm test`. 소스 변경 후 `pnpm build`, 브라우저 새로고침. 서버 코드 변경은 서버 재시작이 필요합니다.

## 사용법

- 마우스로 드래그: 모든 방향 회전. 휠: 확대/축소. 장면에 키보드 초점을 두면 방향키 회전, Home 정면.
- 채팅 예: `몸을 민트색으로, 귀를 크게, 리본 달아줘`, `웃는 표정으로`, `이름을 모찌로`.
- 얼굴 시안에서 **기본·웃음·슬픔·화남·놀람·졸림**을 선택하면 표정만 바뀝니다. `슬픈 표정으로`, `화난 표정으로`, `졸린 표정으로`도 지원합니다. 색상·체형·이름·장식은 유지되고 되돌릴 수 있습니다.
- [치이카와 57개 스티커 관찰 기록](docs/CHIIKAWA-REFERENCE-REVIEW.md) · [31장 추가 사진과 부위별 실측 수치](docs/CHIIKAWA-MEASUREMENTS.md) · [최신 모델링 변경과 확인 범위](docs/CHARACTER-MODELING.md)
- `되돌리기`, `다시 실행`, `초기화`. 최근 50개 변경을 저장합니다. 미지원 문장·부정문·상충 속성은 적용하지 않습니다.
- 카메라 버튼: PNG. 다운로드 버튼: 캐릭터 JSON. + 버튼: 저장한 JSON 가져오기. 사진 입력·음성 버튼이 아닙니다.
- 도움말: 실제 지원 명령, 입력 한계, 로컬 저장 정책을 안내합니다.
- `http://127.0.0.1:4317/?benchmark=1`: 별도의 4,096개 반복 메시 실험. 전체 캐릭터 부하 실험과 구분합니다.

## 구성

```text
src/bootstrap.ts      gateway / renderer / model / ChatPanel 구현 조립
src/domain/           CharacterDocument v1, 허용 속성·범위와 patch 검증
src/application/      편집 서비스 + 렌더러 / 해석기 / 저장소 / gateway 계약
src/presentation/     화면 상태·명령/복구, 렌더 수명과 교체용 UI 계약
src/adapters/         Three.js, 인스턴스 배치, 로컬 해석기, HTTP/SSE
src/components/       교체 가능한 ChatDock, Composer, 표정 시안, 도움말
src/dev/              반복 메시 배칭 검증 화면
server/               단일 저장소 + loopback HTTP + stdio MCP
tests/                도메인·영속화·경계·실제 MCP 통합·배치 회귀
docs/                 아키텍처, 원본 코드 연구, 범위/결정, 검증 근거
.data/                이 PC의 캐릭터·이력·이전 저장본 (Git 제외)
```

## 저장과 권한

서버는 **127.0.0.1**에만 바인딩합니다. 데이터는 `.data/character.json`에 저장되고 직전 저장본은 `.bak`입니다. 임시 파일 기록 후 교체하며, 손상된 파일을 기본값으로 조용히 덮어쓰지 않습니다. 복구는 서버를 멈춘 뒤 현재 파일을 따로 보관하고 검증된 `.bak`를 복사하는 수동 절차입니다. 전원 중단/디스크 장애 복구와 다중 서버 writer는 아직 검증하지 않았습니다.

하나의 로컬 사용자와 하나의 writer 서버를 전제로 합니다. Host/Origin 검사와 JSON 검증이 있지만 로그인/RBAC는 없습니다. 같은 PC의 프로세스·컴퓨터 소유자의 파일 접근을 차단하지 않습니다. AI 전송이나 원격 공개는 현재 하지 않습니다. 채팅 문장은 현재 탭 메모리에만 남습니다. 이름과 변경한 모습·최근 이력은 디스크에 남습니다.

## MCP 개발 연결

앱을 실행한 상태에서 같은 PC의 stdio 지원 클라이언트가 `node --import tsx <절대경로>/server/mcp.ts`를 실행합니다. **클라이언트의 작업 디렉터리**를 이 프로젝트로 설정하거나, 아래처럼 tsx CLI도 절대경로로 실행합니다.

```json
{
  "command": "C:/Users/whwog/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe",
  "args": [
    "C:/Users/whwog/Documents/ChatGPT/developer_/softform-studio/node_modules/tsx/dist/cli.mjs",
    "C:/Users/whwog/Documents/ChatGPT/developer_/softform-studio/server/mcp.ts"
  ]
}
```

이 JSON은 프로세스 실행 정보입니다. 특정 호스트의 설정 파일 형식/지원 보장이나 사용자 앱 설정 변경이 아닙니다. 도구는 `get_character`, `update_character`, `edit_character`입니다. 변경 전 최신 revision을 읽고 충돌 시 재조회합니다. 브라우저는 SSE로 MCP 변경을 수신합니다. 일반 사용자용 원클릭 연결·호스트 안의 3D 임베드·OAuth·모바일 브리지는 후속 작업입니다.

## 문서

- [기능 정의 문서 영역](docs/features/README.md)
- [초기 캐릭터 렌더 생성: 제작 과정·수치·수용 기준](docs/features/initial-character-render-generation.md)
- [v4 닮음 개선: 고정한 10점 기준과 반복 검증](docs/reviews/chiikawa-fidelity-improvement.md)
- [전체 파일 구조·결합도 점검·실제 리팩터링](docs/reviews/architecture-and-replaceability-review.md)
- [12종 기본 모델·채팅 부위 추가·초기화·저장 전략](docs/features/character-catalog-and-customization-strategy.md)
- [개선 전 v3 닮음 피드백](docs/reviews/chiikawa-render-fidelity-review.md)
- [채팅 구현 계획: ChatKit·AI 서비스·Configuration as Code](docs/features/character-chat-implementation-plan.md)
- [아키텍처 선택과 어댑터 경계](docs/ADR-001-ARCHITECTURE.md)
- [Human Atlas 소스 연구](docs/HUMAN-ATLAS-RESEARCH.md)
- [현재 구현·남은 결정](docs/MVP-STATUS.md)
- [요구별 테스트와 실제 검증 범위](docs/TESTING.md)
- [첨부 이미지에 따른 기본 모델 수정](docs/CHARACTER-MODELING.md)
- [출처와 재사용 구분](THIRD_PARTY_NOTICES.md)

치이카와는 사용자 지정 비공식 절차적 3D 스터디입니다. 공식 모델 파일을 사용하지 않았고 서비스 출시용 독자 캐릭터 생성기 완성을 의미하지 않습니다.
