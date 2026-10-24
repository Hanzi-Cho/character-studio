# 출처와 재사용 구분

## Human Atlas

https://github.com/ashemag/human-atlas, 기준 SHA `1c38bf35c254a891200d3cedecfd57abebe83d8d`.

원본 소스 라이선스는 MIT이며 해부 데이터는 별도 CC BY 4.0 고지를 가진다. 이 MVP는 원본 source file, shader, CSS, mesh, texture, 해부학 데이터 파일을 복사하거나 번들하지 않았다. persistent Three.js scene, 상태/geometry 분리, ID와 batching 같은 설계 원리를 분석하여 새 코드로 구현했다. “Human Atlas 코드의 통째 이식”이라고 표현하지 않는다.

향후 `PointerTap` 등 코드의 실질적 부분을 이식한다면 기준 커밋의 원문 MIT copyright와 permission notice를 해당 배포물에 보존하고 변경 지점을 기록해야 한다. 해부학 데이터는 현재 제품과 무관하므로 가져오지 않았다. 상세 관찰과 후보는 docs/HUMAN-ATLAS-RESEARCH.md 참조.

## 런타임 의존성

React, React DOM, Three.js, Zod와 MCP TypeScript SDK는 package.json/pnpm-lock.yaml에 고정했다. 각 의존성의 원본 LICENSE는 패키지에 포함되어 있으며 esbuild는 보존 대상 legal comment를 출력한다. 배포 패키지를 만들 때 의존성 license notice 수집을 추가해야 한다. 현재는 로컬 개발 실행본이다.

## 캐릭터

치이카와는 사용자 요청에 따라 코드로 만든 비공식 3D 스터디다. 공식 mesh/texture/이미지 파일을 다운로드·재배포하지 않았다. 공식 제휴나 원작 캐릭터에 대한 권리 보유를 주장하지 않는다. 공개용 최종 서비스 자산과 독자 캐릭터 생성 범위는 별도 결정이다.
