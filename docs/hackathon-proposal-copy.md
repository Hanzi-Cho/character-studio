# Character Studio 제안서 문안

2026-10-25 · 2쪽 간결본

대화로 만드는
나만의 3D 캐릭터

SNS 프로필과 GitHub·커뮤니티에서 나를 표현할 캐릭터를
채팅으로 꾸미고, 원하는 모습으로 계속 수정하는 서비스입니다.

01  해결하려는 문제와 주요 사용자

주요 사용자는 자신만의 캐릭터로 프로필을 꾸미고 싶은 3D 비전문가입니다. 옷이나 표정만 바꾸려 해도 전문 모델링 도구와 용어를 배워야 하는 부담을 줄이고, 원하는 부분을 말로 고치며 같은 캐릭터를 여러 모습으로 활용하도록 돕습니다.

02  핵심 기능과 이용 흐름

기본 캐릭터

셔츠·날개·새싹·웃음 적용

실제 Codex 채팅 편집 화면. 색상·옷·장식·표정을 바꾸고, 다른 부위는 유지합니다.

원하는 모습 말하기

“하늘색 셔츠와 작은 날개를 달고 웃는 표정으로.”

돌려 보고 부분 수정하기

“왕관만 빼고 새싹을 달아줘.” 3D로 확인하고 되돌리거나 초기화합니다.

내 캐릭터로 활용하기

PNG로 저장해 프로필에 쓰고, 설정 JSON을 다시 열어 다른 모습으로 꾸밉니다.

현재 체험: 웹 데모에서 치이카와 1종과 41개 예문을 바로 체험합니다. 자유로운 AI 채팅은 PC에서 실행합니다.

구현 방식과 발전 계획

03  AI 적용 방식·데이터·기술

텍스트 요청과 현재 캐릭터 설정을 Codex에 전달해 JSON 편집 명령으로 직렬화합니다. 명령을 검증한 뒤 색·표정·부위 설정을 저장하고 3D 화면에 반영합니다.

텍스트·현재 설정 → Codex JSON 명령 → 검증·저장 → Three.js 화면 갱신

현재 연결은 Codex CLI의 ChatGPT 로그인 방식입니다. 입력 데이터는 텍스트·캐릭터 JSON·직접 작성한 도형 및 장식 정의이며, 별도 모델 학습은 하지 않습니다.

기술 구성: React·TypeScript / Three.js / Node.js / Zod 검증 / HTTP·SSE 및 MCP

04  구현 계획·역할 분담·기대 효과

현재는 Codex 채팅으로 색상·의상·장식·표정을 수정하고 저장·복구하며, 별도 설치 없는 예문 웹 데모를 제공합니다. 다음 단계에서는 서비스용 모델 API와 사용자별 저장을 연결해 자유로운 AI 채팅도 브라우저 접속만으로 사용하도록 발전시킵니다. 이후 내부 Blender 실행기와 CLI-Anything을 연동해 정밀 조형과 의상·표정 편집으로 확장할 계획입니다.

1인 프로젝트로 기획, 구현, 자료 조사와 제출 자료 제작을 모두 담당합니다. Codex는 코드 구현과 편집 명령 해석에 활용합니다.

기대 효과는 3D 도구를 배우는 부담을 낮추고, 하나의 캐릭터를 취향과 활동에 맞춰 변형해 SNS·GitHub·커뮤니티에서 일관된 자기 표현에 활용하는 것입니다.

05  외부 자료·오픈소스·AI 도구 출처

[Codex: 코드 구현·편집 명령 해석](https://learn.chatgpt.com/docs/cli)

[React·Three.js·Zod 등: 앱 구성](https://github.com/Hanzi-Cho/character-studio/blob/main/package.json)

[Human Atlas: 렌더링·구조 참고](https://github.com/ashemag/human-atlas)

[Humanizer: 제안서 문장 교정](https://github.com/blader/humanizer)

[Blender: 정밀 모델링 연동 예정](https://www.blender.org/)

[CLI-Anything: 에이전트 도구 연동 예정](https://github.com/HKUDS/CLI-Anything)

화면의 치이카와는 원작을 참고해 코드로 만든 비공식 3D 스터디입니다. 공식 모델 파일은 사용하지 않았으며, 공개 서비스용 자산은 자체 제작 또는 이용 허락을 받은 캐릭터로 준비할 계획입니다.

[웹 데모  hanzi-cho.github.io/character-studio/](https://hanzi-cho.github.io/character-studio/)

[공개 코드·AI 실행 안내  github.com/Hanzi-Cho/character-studio](https://github.com/Hanzi-Cho/character-studio)
