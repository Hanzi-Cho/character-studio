# Codex Character Editing

2026-10-25. 오늘 시연 범위는 치이카와 한 모델, PC 브라우저, 실제 Codex 채팅이다. Blender는 사용자의 결정에 따라 후속으로 둔다.

## 실제 동작

하단 채팅 → 로컬 HTTP → Codex CLI 구조화 JSON 응답 → EditPlan 전체 검증 → CharacterService → revision 검사와 단일 저장 → SSE → Three.js 모델 갱신.

현재 호스트는 ChatGPT 로그인 상태의 Codex CLI 0.163.0-alpha.10.2, 모델은 gpt-6.1-sol이다. 별도 API 키를 만들지 않았다. 요청 문장과 현재 캐릭터 설정을 모델에 보내며 계정 사용 한도가 적용된다. CLI의 도구 사용은 끄고 read-only sandbox와 ephemeral 모드로 실행한다. 모델 출력은 실행 가능한 코드로 취급하지 않는다. 임시 파일은 요청 후 정리한다.

Codex MCP에서는 get_character → get_model_capabilities → apply_edit_plan을 사용할 수 있다. 앱 채팅과 같은 도메인 계약을 지나므로 저장과 되돌리기 결과도 같다. edit_character는 앱의 모델을 한 번 더 호출하므로 호스트에서 직접 직렬화할 때는 apply_edit_plan을 쓴다.

## 편집 계약

- CharacterDocument v2는 기존 기본 모델 값과 parts 배열을 저장한다. v1 문서와 undo/redo 이력도 변환한다.
- action: edit, undo, redo, reset, clarify. edit 안의 operations: set, upsert_part, remove_part, clear_parts.
- 장식은 고정 id로 수정한다. 요청하지 않은 다른 장식·색상·비율은 유지한다.
- 기본 장식 9종: 날개, 셔츠, 망토, 모자, 왕관, 안경, 목도리, 리본, 별.
- custom은 구·상자·원통·원뿔·토러스·캡슐·별을 조합해 새 형태를 만든다. 위치·크기·회전·색상을 직렬화한다.
- 요청당 최대 24개 작업, 장식 최대 12개, 장식당 도형 32개, 전체 도형 128개. 범위를 넘거나 마지막 작업 하나가 잘못돼도 전체를 적용하지 않는다.
- 한 문장의 여러 작업은 한 번의 undo로 복구한다. 초기화도 undo 가능하다. 저장 이력은 최근 50개다.
- 모호하거나 미지원인 요청은 설명하고 무변경 처리한다. AI 응답 중 다른 채널에서 문서가 바뀌면 revision 충돌로 거부하며 조용히 덮어쓰지 않는다.

## 교체 경계

CommandInterpreter는 모델 공급자, CharacterRepository는 저장소, StudioGateway는 전송, CharacterRenderer/CharacterModel은 렌더링, ChatPanel은 화면을 각각 교체한다. 새 parts 렌더러는 직렬화된 데이터만 받으며 채팅·Codex·HTTP를 모른다. 바뀐 장식만 다시 만들고 제거한 geometry/material은 dispose한다. 표정 변경은 장식 geometry를 다시 만들지 않는다.

## 2분 녹화 순서

1. Start-Studio.cmd 실행 → 초기 모습으로 버튼 → 캐릭터를 드래그해 정면과 옆면을 보여준다.
2. `하늘색 셔츠를 입히고 작은 하얀 날개와 금색 왕관을 달아줘. 웃는 표정으로 바꿔줘.` 입력. 실제 응답을 기다린다.
3. `왕관만 빼고 머리 위에 연두색 새싹 장식을 만들어줘. 줄기 하나와 잎 두 장으로. 날개는 지금의 1.5배로 키워줘.` 입력.
4. `셔츠만 분홍색으로, 표정은 놀란 얼굴로. 다른 장식은 유지해줘.` 입력. 일부만 달라지는 모습을 보여준다.
5. 대화 내역에서 적용한 편집 명령을 펼쳐 AI의 직렬화 결과를 보여준다. 되돌리기 → 다시 실행 → 새로고침으로 저장 유지 확인.
6. JSON/PNG 저장과 초기화 버튼으로 마무리한다. 실제 녹화 파일 제작·해커톤 제출은 별도다.

응답은 네트워크와 계정 한도에 따라 달라진다. 검증 중 단일 해석 호출은 약 7.9초였으며 평균·p95·SLA가 아니다. 화면은 모델 응답 대기 상태를 표시한다.

## 현재 한계

의상은 체형에 맞춘 절차적 표면이며 천 시뮬레이션, 재봉 패턴, 스키닝, UV 작업이 아니다. custom은 제한된 도형 조합이며 임의의 정교한 메시·애니메이션·이미지 생성이 아니다. 새 기본 캐릭터, Blender worker, Meta API, 모바일 실제 기기, 사용자별 계정/권한, 모델 응답 평가 20+10개는 후속이다. 원클릭 설치나 공개 서비스 배포는 아직 하지 않았다.

## 실행 근거

23개 자동 테스트와 타입 검사·빌드 통과. 실제 HTTP/stdio MCP에서 복합 plan, 저장, undo, 잘못된 입력, revision 충돌을 검증한다. 실제 AI는 scripts/verify-ai.ts로 수동 호출하며 자동 회귀 시험에서 사용 한도를 소비하지 않는다. 화면 근거는 docs/evidence/codex-chat-v1에 기록한다.

공식 연결 문서: https://learn.chatgpt.com/docs/non-interactive-mode · https://learn.chatgpt.com/docs/extend/mcp?surface=cli
