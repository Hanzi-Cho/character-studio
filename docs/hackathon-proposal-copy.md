# Character Studio 제안서 문안

2026-10-25 · 표지 포함 3쪽

대화로 만드는 나만의 3D 캐릭터

Character Studio

나만의 캐릭터를 채팅으로 꾸미고, 원하는 모습으로 수정하는 웹 기반 3D 편집 도구

지금 바로 사용해 볼 수 있는 웹 데모

[웹 데모 열기  →  hanzi-cho.github.io/character-studio/](https://hanzi-cho.github.io/character-studio/)

설치 없이 접속해 41개 예문으로 색·옷·장식·표정을 바꾸고,
3D 회전·PNG/JSON 다운로드·브라우저 저장을 직접 확인할 수 있습니다.

공개 배포된 동작 화면입니다. 자유로운 AI 채팅은 자신의 PC에서 Codex를 연결해 사용합니다.

실제 편집 결과 · 셔츠, 날개, 새싹, 웃는 표정

개인 참여 · 조재현

팀명 · 캐릭터스튜디오   |   기획·구현·자료 조사

사용자와 핵심 기능

SNS 프로필과 GitHub·커뮤니티에서 나를 표현할 캐릭터를
채팅으로 꾸미고, 원하는 모습으로 계속 수정하는 서비스입니다.

01  해결하려는 문제와 주요 사용자

주요 사용자는 자신만의 캐릭터로 프로필을 꾸미고 싶은 3D 비전문가입니다. 옷이나 표정만 바꾸려 해도 전문 모델링 도구와 용어를 배워야 하는 부담을 줄이고, 원하는 부분을 말로 고치며 같은 캐릭터를 여러 모습으로 활용하도록 돕습니다.

02  핵심 기능과 이용 흐름

기본 캐릭터

셔츠·날개·새싹·웃음 적용

실제 Codex 채팅 편집 화면. 색상·옷·장식·표정을 바꾸고, 다른 부위는 유지합니다.

채팅으로 세부 수정하기

“하늘색 셔츠와 작은 날개를 달고 웃는 표정으로.” 색·옷·장식을 부분 수정합니다.

3D를 여러 시점에서 보기

드래그·확대로 정면·옆·뒤·위를 확인합니다. 변경은 되돌리거나 초기화할 수 있습니다.

이미지·JSON 다운로드

PNG 이미지를 프로필에 쓰고, 캐릭터 설정 JSON을 내려받아 다시 불러와 편집합니다.

현재 체험: 웹 데모에서 치이카와 1종과 41개 예문을 바로 체험합니다. 자유로운 AI 채팅은 PC에서 실행합니다.

대화가 3D에 반영되는 과정

03  AI 적용 방식·데이터·기술

자연어를 정해진 편집 명령으로 바꾸고, 검증된 설정만 3D에 반영합니다. 아래는 n8n처럼 노드로 표현한 실제 앱 흐름입니다(n8n 실행 엔진은 사용하지 않음).

01  채팅 입력: 문장 + 현재 캐릭터 설정

02  Codex 직렬화: JSON Schema에 맞춘 명령 출력

03  JSON 파싱: JSON.parse → 명령 객체

04  ENUM·값 검증: Zod: 허용 명령·값·한도 검사

05  설정 변경·저장: compilePlan → patch → 저장

06  Three.js 반영: 변경된 부위 갱신 → 화면 렌더

예: “웃는 표정으로” → {"action":"edit", "message":"웃는 표정을 적용했어요",
"operations":[{"op":"set", "key":"expression", "value":"happy"}]}

명령은 set(속성), upsert_part(부위 추가·수정), remove_part(삭제), clear_parts(장식 정리)로 제한합니다. 표정은 gentle / happy / sad / angry / surprised / sleepy 중 선택합니다. 오류·충돌이면 전체 변경을 취소합니다.

빠른 이유: 전체 3D 모델을 다시 생성하지 않고 색·표정·변경된 부위만 갱신합니다. 유지되는 메시를 재사용하고 화면도 필요할 때만 그립니다. 41개 예문은 AI 호출을 생략합니다. 자유 채팅의 AI 응답 대기 시간은 별도입니다.

현재 Codex CLI의 ChatGPT 로그인 사용. 데이터는 텍스트·캐릭터 JSON·직접 작성한 도형 정의이며 학습은 하지 않습니다. React·TypeScript / Three.js / Node.js / Zod / HTTP·SSE·MCP로 구성합니다.

04  구현 계획·역할 분담·기대 효과

현재: 로컬 Codex 채팅 편집·저장·복구와 설치 없는 예문 웹 데모. 다음: 모델 API와 사용자별 저장을 연결해 브라우저에서 자유로운 AI 채팅 제공. 이후: Blender + CLI-Anything으로 메시·의상·표정의 세부 수정을 연동하고, 다른 캐릭터 기본 모델을 추가합니다.

1인으로 기획·구현·자료 조사·제출 자료를 담당하며 Codex를 활용합니다. 3D 도구의 학습 부담을 줄이고, SNS·GitHub·커뮤니티에서 나만의 캐릭터로 표현하도록 돕습니다.

05  외부 자료·오픈소스·AI 도구 출처

파란색 밑줄을 누르면 해당 자료나 웹페이지가 열립니다.

[Codex: 코드 구현·편집 명령 해석](https://learn.chatgpt.com/docs/cli)

[React·Three.js·Zod 등: 앱 구성](https://github.com/Hanzi-Cho/character-studio/blob/main/package.json)

[Human Atlas: 렌더링·구조 참고](https://github.com/ashemag/human-atlas)

[Humanizer: 제안서 문장 교정](https://github.com/blader/humanizer)

[Blender: 정밀 모델링 연동 예정](https://www.blender.org/)

[CLI-Anything: 에이전트 도구 연동 예정](https://github.com/HKUDS/CLI-Anything)

화면의 치이카와는 원작을 참고해 코드로 만든 비공식 3D 스터디입니다. 공식 모델 파일은 사용하지 않았으며, 공개 서비스용 자산은 자체 제작 또는 이용 허락을 받은 캐릭터로 준비할 계획입니다.

[지금 바로 웹 데모 체험  →  hanzi-cho.github.io/character-studio/](https://hanzi-cho.github.io/character-studio/)

[공개 코드·AI 실행 안내  github.com/Hanzi-Cho/character-studio](https://github.com/Hanzi-Cho/character-studio)
