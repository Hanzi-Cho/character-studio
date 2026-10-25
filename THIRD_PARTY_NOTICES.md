# 출처와 재사용 구분

## Humanizer

https://github.com/blader/humanizer, 버전 3.1.0, 고정 SHA `8c307f367c91bd974002f10f2be2965d642c13df`.

프로젝트 문서 교정용 에이전트 스킬을 `.agents/skills/humanizer`에 설치했다. MIT License, Copyright (c) 2025 Siqi Chen. 원문 LICENSE와 SKILL.md를 함께 보존한다. 앱 런타임에는 포함하지 않는다. 수치·권한·미검증 사실은 유지하면서 제안서 문장과 가독성을 다듬는 용도로 사용한다. [적용 절차](docs/WRITING.md).

## Human Atlas

https://github.com/ashemag/human-atlas, 기준 SHA `1c38bf35c254a891200d3cedecfd57abebe83d8d`.

원본 소스 라이선스는 MIT이며 해부 데이터는 별도 CC BY 4.0 고지를 가진다. 이 MVP는 원본 source file, shader, CSS, mesh, texture, 해부학 데이터 파일을 복사하거나 번들하지 않았다. persistent Three.js scene, 상태/geometry 분리, ID와 batching 같은 설계 원리를 분석하여 새 코드로 구현했다. “Human Atlas 코드의 통째 이식”이라고 표현하지 않는다.

향후 `PointerTap` 등 코드의 실질적 부분을 이식한다면 기준 커밋의 원문 MIT copyright와 permission notice를 해당 배포물에 보존하고 변경 지점을 기록해야 한다. 해부학 데이터는 현재 제품과 무관하므로 가져오지 않았다. 상세 관찰과 후보는 docs/HUMAN-ATLAS-RESEARCH.md 참조.

## 런타임 의존성

React, React DOM, Three.js, Zod와 MCP TypeScript SDK는 package.json/pnpm-lock.yaml에 고정했다. 각 의존성의 원본 LICENSE는 패키지에 포함되어 있으며 esbuild는 보존 대상 legal comment를 출력한다. 배포 패키지를 만들 때 의존성 license notice 수집을 추가해야 한다. 현재는 로컬 개발 실행본이다.

## 캐릭터

치이카와는 사용자 요청에 따라 코드로 만든 비공식 3D 스터디다. 공식 mesh/texture/이미지 파일을 다운로드·재배포하지 않았다. 공식 제휴나 원작 캐릭터에 대한 권리 보유를 주장하지 않는다. 공개용 최종 서비스 자산과 독자 캐릭터 생성 범위는 별도 결정이다.


## 이번 연결·기본 모델 확장

- jose 6.2.13, MIT: 공식 OAuth ID 토큰 서명·issuer·audience·만료 검증. 패키지 LICENSE 보존.
- OpenAI 공식 [등록·로그인](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [모델 호출](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [제약](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations), [세션](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)을 2026-10-25 확인했다. 문서 예제를 통째로 복제하지 않고 현재 어댑터에 맞춰 구현했다.
- 우사기도 사용자 요청으로 만든 비공식 절차적 스터디다. [캐릭터 소개의 정면 레퍼런스](https://gobo-hk.com/blogs/sumikko/2024%E5%B9%B4-chiikawa%E5%90%89%E4%BC%8A%E5%8D%A1%E5%93%87%E8%A7%92%E8%89%B2%E5%85%A8%E4%BB%8B%E7%B4%B9-%E6%87%B6%E4%BA%BA%E5%8C%85%E4%B8%80%E5%88%86%E9%90%98%E7%90%86%E8%A7%A3%E9%80%99%E7%99%82%E7%99%92%E7%89%A9%E7%A8%AE-9009)를 시각 확인했으며 이미지 자체를 번들/재배포하지 않았다. 귀·색·눈썹의 관찰을 수치화한 근사 모델이며 공식 치수가 아니다.
