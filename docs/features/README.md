# Feature Definitions

최신 추가: [내 캐릭터 보관함](character-library.md) — 현재 모습 저장·불러오기·변경 저장·별도 저장·JSON 백업·삭제. 브라우저별 최대 50개.

최신 확장: [기본 모델·이미지 초안·API/ChatGPT 연결과 제품화 순서](character-base-and-ai-connection.md). 치이카와/우사기 2종이며 12종 전체는 후속이다.

기능의 목적, 제작 과정, 입력·출력, 수치, 수용 기준을 관리하는 영역이다. 구현 사실과 제안·미검증을 구분한다. 문서를 작성했다고 기능이나 제품화가 완료된 것으로 처리하지 않는다.

| ID    | 문서                                                                                            | 상태                                                     |
| ----- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| F-001 | [Initial Character Render Generation](initial-character-render-generation.md)                   | PC 렌더·6표정·v4 닮음 개선 및 검증                       |
| F-002 | [Character Chat Implementation Plan](character-chat-implementation-plan.md)                     | 초기 비교 계획. 현재 구현은 F-004 참고                   |
| F-003 | [Character Catalog and Customization Strategy](character-catalog-and-customization-strategy.md) | 12종·부위/표정·초기화·저장 확장 전략, 미구현             |
| F-004 | [Codex Character Editing](codex-character-editing.md)                                           | 실제 Codex 채팅·직렬화·옷/장식·도형 조합, 23개 회귀 시험 |

각 문서는 요구 → 근거 → 설계값 → 코드 → 검증 → 남은 결정을 연결한다. 현재 실행 값의 정본은 코드이고, 웹 표본·원시 좌표는 [reference-data](../reference-data/), 실행 증거는 [evidence](../evidence/)에 둔다. 문서의 숫자는 기준 커밋을 명시한 스냅샷이다.

관련 검토: [치이카와 렌더 닮음 피드백](../reviews/chiikawa-render-fidelity-review.md), [현재 MVP 범위](../MVP-STATUS.md), [검증 기록](../TESTING.md).

최신 리뷰: [v4 개선 수용 기준](../reviews/chiikawa-fidelity-improvement.md), [전체 구조와 교체 경계](../reviews/architecture-and-replaceability-review.md).
