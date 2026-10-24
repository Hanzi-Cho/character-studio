# Human Atlas 소스 연구와 Softform Studio 적용안

조사일: 2026-10-24, Asia/Seoul. 사용자 요청: PC에서 시작하는 3D 캐릭터 편집기, 드래그/터치 회전, 채팅을 통한 캐릭터 수정, 향후 모바일 및 AI 호스트 연결. 이 문서는 원본 소스에서 확인한 사실과 Softform에 제안하는 설계를 구분한다. 원본 애플리케이션의 코드를 실행하거나 성능을 실측한 보고서는 아니다.

## 1. 결론

Human Atlas에서 적극적으로 가져올 것은 **React UI와 오래 살아 있는 Three.js 장면의 분리, 안정적인 개체 ID, 정적 geometry와 작은 동적 상태의 분리, 렌더링 배치와 선택용 geometry의 역할 분리, 입력/도구 계약을 별도로 검증하는 방식**이다. 실제 코드는 범용 어댑터 프레임워크가 아니다. 해부학 도메인, 카메라 배치, DOM 구조가 상당히 결합되어 있으므로 `scene.tsx` 전체를 캐릭터 편집기에 복사하면 사용자가 요구한 교체 가능성이 오히려 약해진다.

Softform의 첫 캐릭터는 작은 수의 절차적 mesh를 공유 geometry로 만들고, 색상은 material, 크기·비율은 transform을 갱신하는 것이 적합하다. 같은 원리를 수천 개 개체에 적용할 때는 반복형 geometry에 instancing, 서로 다른 정적 geometry에 batching을 선택한다. Human Atlas의 GPU texture 기법을 첫 캐릭터부터 도입할 필요는 없다. 큰 장면을 빠르게 표시하는 문제와 캐릭터의 topology를 바꾸는 문제는 별도로 다룬다.

## 2. 조사 기준과 증거 범위

- 저장소: [ashemag/human-atlas](https://github.com/ashemag/human-atlas).
- 기준 커밋: [`1c38bf35c254a891200d3cedecfd57abebe83d8d`](https://github.com/ashemag/human-atlas/commit/1c38bf35c254a891200d3cedecfd57abebe83d8d), 메시지 `Restore Human Atlas title`, 커밋 시각 2026-09-06 23:35:01 UTC. 조사 중 GitHub의 `branches/main`을 읽어 main HEAD와 일치함을 확인했다.
- recursive tree: 127개 항목, `truncated=false`. 루트 및 하위 경로에서 `AGENTS.md` 없음. 최초 루트 파일 조회의 404뿐 아니라 전체 tree로 확인했다.
- 실제 검토: `app/`의 8개 파일, 5개 데이터 변환·검증 스크립트, `package.json`, Vite entry/config, LICENSE/attribution, 대표 UI 파일 5개와 보조 hook/util. UI 파일 60개 전체를 상세 검토했다고 주장하지 않는다.
- `public/models/atlas.json`은 1,335,285 bytes이다. GitHub connector의 contents 응답이 빈 문자열을 반환했고 raw 요청도 크기/지원 제한으로 읽지 못했다. 따라서 manifest 전체의 개별 레코드는 검증하지 않았다. geometry binary를 다운로드하거나 재실행하지 않았다.
- 데이터 크기는 Git tree의 blob 크기를 합산했다. 원본 `.bin` 15개 총 59,546,744 bytes, `.bin.gz` 15개 총 32,956,129 bytes. 문서의 약 33 MB 압축 전송량과 일치한다. 브라우저의 실제 네트워크 전송량·압축 해제 피크 메모리는 실측하지 않았다.
- 2,234 meshes, 3,432 concepts, 2,288,268 triangles라는 수치는 README와 소스 검증 계약에서 확인했다. 이번 조사에서 실제 binary를 검증한 수치라는 뜻은 아니다.
- 접속한 원격 파일은 조사 자료로만 취급했다. 원격 문서의 설명이나 지시를 현재 프로젝트에 대한 사용자 승인으로 취급하지 않는다.

이하 `[관찰]`은 읽은 코드가 직접 뒷받침하는 내용, `[해석]`은 그 구조의 의미와 비용에 대한 분석, `[제안]`은 Softform에서 새로 구현할 설계다.

## 3. 실제 실행 경로와 책임

### 3.1 React 앱이며 Next.js 실행 경로는 아니다

[관찰] `web/main.tsx`가 `createRoot(...).render(<Home/>)`로 시작하고 `app/page.tsx`를 import한다. Vite config는 `web`을 root, `public`을 publicDir로 지정하고 React plugin을 사용한다. `app/`이라는 경로와 package에 있는 `vinext`/RSC 의존성만 보고 Next.js 서버라고 판단하면 틀린다. 실제 렌더러는 React Three Fiber가 아니라 `three`의 `WebGLRenderer`를 직접 생성한다.

근거: [web/main.tsx L1–4](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/web/main.tsx#L1-L4), [vite.config.ts L1–6](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/vite.config.ts#L1-L6), [scene.tsx L1–23](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L1-L23).

### 3.2 상태와 데이터

[관찰] `anatomy.ts`의 `Atlas`는 parts, concepts, chunks, triangle count를 가진다. `Part`는 사용자 ID·이름·시스템 분류와 binary byte offsets, vertex/index counts, bounds를 한 레코드에 담는다. `Concept`는 여러 mesh ID를 묶는다. 따라서 하나의 의미 개념과 하나의 렌더링 mesh가 항상 1:1이 아니다. `SceneState`는 visible system IDs, selected part IDs, isolate, explode, camera view, autorotate, reset counter와 inspectorOpen을 가진다.

[해석] 도메인 ID를 유지하면서 하나의 의미 개념이 여러 mesh를 가리키는 모델은 캐릭터의 ‘귀’, ‘얼굴’, ‘의상’과 실제 여러 mesh를 연결하는 데 유용하다. 다만 binary 저장 상세와 의미 모델이 한 타입에 섞여 있다. 그대로 가져오면 GLB·절차적 모델·다른 렌더러 교체 때 UI 타입까지 흔들린다.

근거: [anatomy.ts L19–23](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/anatomy.ts#L19-L23).

### 3.3 UI에서 GPU까지의 경로

1. `Home`이 `/models/atlas.json`을 fetch한다. `AbortController`로 unmount 요청을 취소한다.
2. UI는 React `useState`로 `SceneState`를 교체한다. part ID lookup과 system counts는 `useMemo`로 계산한다.
3. `AnatomyScene`은 `latest.current=state`, `select.current=onSelect`로 최신 입력을 ref에 보관한다.
4. renderer를 만드는 effect의 dependency는 `[atlas]`뿐이다. UI 설정을 바꿀 때 WebGL context, scene, material과 geometry를 다시 만들지 않는다.
5. 장면 loop가 state의 관련 필드가 바뀌었는지 확인하고 CPU typed array, picking transforms, GPU texture를 갱신한다.
6. `dirty`일 때 `renderer.render`를 호출한다.

근거: [page.tsx L16–29](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/page.tsx#L16-L29), [scene.tsx L11–17](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L11-L17), [scene.tsx L98–132](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L98-L132).

[제안] 이 생명주기 분리는 즉시 채택한다. React 채팅 메시지가 한 글자씩 늘어나는 동안에도 WebGL renderer가 재생성되지 않아야 한다. renderer는 `mount → applyDocument/applyPatch → dispose`로 관리하고, 데이터 갱신과 화면 갱신은 별도 함수로 드러낸다.

## 4. 많은 데이터를 다루는 렌더링을 분해해서 보기

### 4.1 압축된 chunk의 제한된 병렬 로딩

[관찰] `loadChunk(ci)`는 `DecompressionStream` 지원 및 gzip 경로 유무에 따라 `.gz` 또는 raw `.bin`을 선택한다. 최대 3개 async worker가 cursor를 공유해 chunk를 읽는다. chunk가 끝날 때 geometry를 scene에 추가하고 진행률과 dirty flag를 갱신하므로 전체 완료 전에 일부 geometry를 보여줄 수 있다. 다만 선택 처리는 `ready`가 true인 전체 로딩 완료 후에만 허용된다.

`decodeModelResponse`는 HTTP 성공 여부, gzip magic bytes `1f 8b`, 예상 byte length를 검사한다. 서버가 Content-Encoding으로 이미 압축 해제한 응답을 다시 gzip decode하지 않도록 payload를 확인한다. 단순히 파일 확장자만 보고 압축 해제하는 오류를 방지한다.

근거: [scene.tsx L62–77](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L62-L77), [scene.tsx L90–94](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L90-L94), [model-download.ts L1–11](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/model-download.ts#L1-L11).

[해석] 여기서 병렬은 다운로드 작업의 동시성이다. `mergeGeometries`, typed array 처리, bounds 계산을 Worker로 옮긴 구현은 보이지 않는다. main thread의 CPU 조립 작업이 사라지는 것은 아니다. 진행률도 byte 기반이 아니라 완료 chunk 개수 기반이므로 용량이 다른 chunk에서 체감 대기와 다를 수 있다.

[제안] 첫 절차적 캐릭터에는 다운로드 계층이 필요 없다. 나중에 외부 모델을 받으면 AssetRepository adapter에서 fetch/abort/byte 검사·포맷 validation을 처리하고 renderer가 URL이나 인증을 직접 알지 않게 한다. 캐릭터가 보이는 준비 상태와 모든 asset이 준비된 상태를 별도 표시한다.

### 4.2 merge는 시스템 전체가 아니라 chunk와 system의 조합 단위

[관찰] chunk 내부에서 part geometry를 `p.system`별로 그룹화해 `mergeGeometries(gs,false)`로 합친다. 렌더링 mesh는 합쳐진 geometry와 system별 공유 material을 사용한다. 따라서 해부학 시스템이 15개라는 사실만으로 draw call이 15개라고 말할 수 없다. 실제 배치 수는 비어 있지 않은 `(chunk, system)` 조합 수이며, 바닥·받침대·링·marker 등도 별도의 렌더링 작업이다.

[관찰] 원본 part geometry는 `pickers[i]`의 mesh로 별도 보존한다. 렌더링 mesh에는 `frustumCulled=false`가 설정돼 있다. vertex shader에서 적용한 part translation을 일반 mesh bounds가 자동으로 알지 못하므로 정적 bounds만 사용하는 culling은 부정확해질 수 있다.

근거: [scene.tsx L64–75](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L64-L75).

[해석] batching은 draw call과 scene traversal 비용을 줄이는 대신 원본 선택용 geometry와 합쳐진 렌더용 geometry를 함께 유지하는 메모리 비용을 가진다. gzip 33 MB는 RAM/VRAM 사용량과 같지 않다. 원본 chunk buffer, 합쳐진 buffer, partIndex attribute, GPU upload 사본, picking 자료, 압축 해제 과정이 추가된다. 정밀한 메모리 수치는 heap/GPU profiler 측정 전에는 적지 않는다.

[제안] Softform의 짧은 첫 모델은 normal Mesh와 공유 geometry pool로 시작한다. 같은 shape를 여러 번 그릴 때는 InstancedMesh가 더 직접적인 선택이다. 다양한 정적 mesh가 많아질 때 batching을 검토하되, rig/skinning, morph targets, 개별 transparency, 재질 다양성을 먼저 확인한다. Human Atlas batching은 캐릭터 표정·뼈대 animation 지원의 증거가 아니다.

### 4.3 정적 vertex와 동적 part 상태의 분리

[관찰] 모든 vertex에 `partIndex` float attribute를 붙인다. part 수를 다음 2의 거듭제곱으로 올린 폭의 `DataTexture`를 만든다. RGBA Float texture에는 translation xyz와 visibility를 넣고, 별도 byte texture에는 selection을 기록한다. material의 `onBeforeCompile`이 Three shader include 위치에 코드를 넣어 상태 texture를 sample한다. vertex에서 translation을 더하고, fragment에서 visibility가 낮으면 discard하며, 선택 부분에는 강조색을 섞는다.

근거: [scene.tsx L32–33](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L32-L33), [scene.tsx L49–58](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L49-L58), [scene.tsx L71](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L71).

[해석] 상태 변경에 geometry를 다시 병합하지 않는 것이 핵심이다. 단, 이 방식은 translation/visibility/selection을 지원할 뿐 rotation, scale, 임의 형태 수정 전체를 지원하는 범용 deformation 시스템이 아니다. shader에서 숨겨도 vertex processing은 남는다. 큰 invisible batch를 mesh 수준에서 숨기는 것과 GPU 비용이 같지 않다. shader include 문자열 교체는 Three.js 버전 변화에 민감하다.

[제안] 첫 캐릭터의 색상 수정은 `material.color.set`, 비율·귀 길이·부품 이동은 기존 Object3D의 scale/position 갱신으로 처리한다. topology가 바뀌는 명령만 해당 geometry를 새로 만들고 이전 자원을 해제한다. renderer 내부에서 이 차이를 분명히 하고 UI는 어느 경로인지 몰라도 되게 한다.

### 4.4 실제로는 전체 part 상태를 다시 계산한다

[관찰] `changed`는 visible/selected 배열의 참조 및 isolate 값 변화로 판단한다. explode animation 중에도 갱신한다. 조건을 만족하면 전체 parts를 순회해 translation·visibility·selection·marker 위치·picking matrix를 갱신하고 두 texture 및 marker attribute에 `needsUpdate=true`를 지정한다. 부분 texel만 갱신하는 sparse patch 구현은 아니다. 배열을 제자리 mutate하면 참조 비교로 변경을 놓칠 수 있다.

[관찰] exploded layout은 visible part IDs와 camera aspect를 키로 캐시한다. 하지만 animation frame 중에도 visible part filter와 ID join으로 키를 다시 만든다. 각 part의 system index를 매번 `SYSTEMS.findIndex`로 찾는다. 일부 반복 계산은 사전 index나 version으로 줄일 수 있다.

근거: [scene.tsx L98–115](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L98-L115).

[제안] `CharacterDocument.revision`과 `changedPartIds` 또는 작은 `CharacterPatch`를 사용한다. 한 귀의 색상 변경 때문에 body geometry·다른 materials·camera가 갱신되지 않도록 한다. 적용량을 수집할 수 있는 counters를 두고 실제 재사용 여부를 확인한다. 반대로 모든 귀 크기를 바꾸는 명령처럼 전체 갱신이 필요한 경우는 명시적으로 허용한다.

### 4.5 dirty rendering과 완전한 idle은 다르다

[관찰] `animate()`는 매 호출마다 다음 `requestAnimationFrame(animate)`를 예약한다. dirty=false여도 loop, state 비교, controls.update는 계속 실행된다. 줄어드는 것은 `renderer.render` 호출이다. OrbitControls change event, autoRotate, 모델 로딩·resize·상태 갱신이 dirty를 만든다. damping과 explode는 시간 기반이다.

근거: [scene.tsx L23](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L23), [scene.tsx L98–102](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L98-L102), [scene.tsx L126–129](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L126-L129).

[제안] Softform은 `invalidate()`로 frame을 한 번 예약하고 damping/animation이 남아 있을 때만 후속 frame을 예약한다. 예약 중복을 막고, 화면이 보이지 않으면 pause하며, 복귀 시 필요한 frame을 예약한다. OrbitControls의 관성 tail까지 그린 뒤 loop가 멈추도록 한다. `renderer.render` 횟수와 RAF callback 횟수를 따로 측정해야 ‘진짜 idle’ 여부가 보인다. CSS의 reduced-motion만으로 Three.js animation이 꺼지지는 않으므로 해당 선호를 renderer adapter에도 전달한다.

## 5. 선택과 모바일 입력에서 가져올 세부 원리

### 5.1 PointerTap은 가장 직접적인 이식 후보

[관찰] `PointerTap`은 DOM·React·Three 의존성 없는 작은 상태 기계다. pointer ID별 최초 좌표와 threshold를 보관한다. 한 번이라도 threshold를 넘으면 시작점으로 돌아와도 tap을 허용하지 않는다. 두 pointer가 동시에 들어온 sequence, cancel된 sequence도 막는다. 모든 pointer가 끝난 뒤 시작한 새 sequence에서는 blocked를 초기화한다. scene에서는 mouse 5 px, touch 12 px를 사용한다.

근거: [pointer-tap.ts L1–21](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/pointer-tap.ts#L1-L21), [scene.tsx L86–96](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L86-L96), [validate-interactions.mjs L34–40](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/scripts/validate-interactions.mjs#L34-L40).

[제안] 부품을 클릭해 선택하는 기능을 넣을 때 이 클래스를 MIT 고지와 함께 직접 가져오거나, 같은 의미의 작은 helper로 재구현한다. 회전만 필요한 현재 화면에 불필요한 picking 코드를 만들지는 않는다. 가져온다면 pointerup을 element 바깥에서 놓는 경우, pointer capture/lostpointercapture, 한 손가락을 놓고 다른 손가락이 남는 경우도 host integration에서 검증한다. helper 자체가 pointer capture를 구현하는 것은 아니다.

### 5.2 정밀 raycast 전 coarse bounds 검사

[관찰] pointerup 때 화면 좌표를 ray로 바꾸고 현재 보이는 part만 대상으로 한다. 먼저 translated Box3와 ray의 교차를 검사한 뒤 통과한 part의 원본 mesh에 정확한 raycast를 수행한다. opaque anatomy가 존재하면 body surface는 picking에서 제외한다. exploded view에서 직접 hit가 없으면 화면상의 bounding rectangle과 가까운 target을 선택한다. 이때 touch radius가 mouse보다 크다.

근거: [scene.tsx L44–48](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L44-L48), [scene.tsx L90–94](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L90-L94), [scene.tsx L127](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L127).

[해석] raycast 횟수를 줄이는 좋은 두 단계 접근이지만 part 목록 자체는 O(N)으로 검사한다. 공간 index/BVH가 있는 것은 아니다. exploded 상태에서 매 dirty render마다 8개 bounds corner를 project해 targets를 다시 만든다. 작은 화면에서 hit 영역을 넓히는 것은 유용하지만 겹친 후보를 선택하는 규칙은 캐릭터 부품에 맞게 다시 정해야 한다. body surface 제외 규칙을 캐릭터에 그대로 적용하면 의상·피부를 선택할 수 없는 잘못된 동작이 된다.

### 5.3 화면이 바뀌면 카메라 공간도 바뀐다

[관찰] ResizeObserver가 canvas size, aspect, DPR과 카메라 fit을 갱신한다. DPR은 작은 화면/짧은 화면에서 1.5, 그 외 2로 제한한다. isolate에서는 inspector 때문에 가려지는 화면 영역을 피하도록 view offset을 조절한다. 모바일 세로/가로에 서로 다른 영역 계산이 있다.

[관찰] 이 계산은 `document.querySelector('.detail-sheet')`, `'.identity'`와 여러 pixel 상수에 직접 의존한다. 캐릭터 화면의 하단 chat composer나 가상 키보드 높이에는 그대로 사용할 수 없다.

근거: [scene.tsx L78–85](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L78-L85), [scene.tsx L119–124](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/scene.tsx#L119-L124).

[제안] UI shell이 안전한 scene rectangle 또는 `ViewportInsets`를 계산해 renderer에 전달한다. renderer는 CSS class나 chat DOM을 조회하지 않는다. 모델의 bounds와 fov로 fit하는 순수 계산을 별도 함수로 만들고 좁은 화면·keyboard 표시·panel 확대·화면 회전을 검증한다. DPR cap은 기능이 아니라 품질 정책으로 분리해 기기별 조정 여지를 둔다.

## 6. UI 재사용의 실제 경계

[관찰] `components/ui`에는 60개 파일이 있다. `Home`이 직접 사용하는 것은 Button, Badge, Slider, Switch, Sheet, Combobox다. 예를 들어 Button은 Base UI primitive + CVA variant + 공통 class merge로 도메인 문자열과 분리되어 있다. Sheet는 Base UI Dialog wrapper다. 이 수준의 작은 UI primitive는 재사용 경계가 비교적 명확하다.

근거: [page.tsx L4–10](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/page.tsx#L4-L10), [button.tsx](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/components/ui/button.tsx), [sheet.tsx](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/components/ui/sheet.tsx).

[관찰] message.tsx, message-scroller.tsx, input-group.tsx도 저장소에 있다. `MessageScrollerItem`은 `content-visibility:auto`와 intrinsic size를 사용하고 viewport는 containment/overscroll 처리를 포함한다. 그러나 실제 Home은 이들을 import하지 않는다. 저장소에 채팅용 UI 파일이 있다는 사실은 Human Atlas에 채팅 backend, LLM streaming, 대화 기록, 3D 수정 agent가 구현됐다는 근거가 아니다.

근거: [message.tsx](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/components/ui/message.tsx), [message-scroller.tsx L36–81](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/components/ui/message-scroller.tsx#L36-L81), [input-group.tsx](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/components/ui/input-group.tsx).

[해석] `content-visibility`는 offscreen layout/paint를 줄일 수 있지만 항목 DOM을 없애는 완전한 list virtualization은 아니다. 긴 대화에서는 실제 message 수·내용·부착 이미지에 따라 별도 측정이 필요하다.

[제안] 사용자 첨부의 간결한 composer는 자체 `ChatComposer`와 Button/Input primitive로 만든다. 도메인 store나 renderer를 import하지 않고 `onSubmit`, pending, error, capability 상태만 받는다. 현재 범위에서 지원하지 않는 음성·첨부 버튼은 완성 기능처럼 보이지 않게 명시한다. Human Atlas의 60개 UI 파일과 package 전체를 가져오는 대신 필요한 primitive의 디자인/접근성 패턴만 적용한다.

[관찰] CSS에는 safe-area, `100dvh`, canvas의 `touch-action:none`, 모바일 controls, focus-visible, reduced-motion 처리가 있다. 동시에 같은 selector를 뒤에서 반복 덮어쓰는 긴 override와 `!important`, `body:has(.detail-sheet)` 결합이 있다. 시각적 원리는 참고할 수 있지만 이 stylesheet를 통째로 복사하면 도메인 교체가 어렵다.

근거: [globals.css L6–23](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/globals.css#L6-L23), [globals.css L49–88](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/globals.css#L49-L88).

## 7. 도구와 어댑터: 확인된 것과 없는 것

### 7.1 원본에서 가장 가까운 경계는 tool factory다

[관찰] `atlasTools(atlas, inspect)`가 tool 배열을 만든다. `find_anatomy`는 query를 검증하고 concept 검색 결과를 최대 30개 반환한다. `inspect_anatomical_structure`는 ID를 확인한 뒤 주입받은 callback을 호출한다. 이 두 tool 정의는 DOM 등록과 분리되어 Node 검증 코드에서 호출할 수 있다. 입력 unknown을 object로 좁히고 필수 문자열을 검사한다.

[관찰] `registerAtlasTools`는 `document.modelContext?.registerTool`이 있을 때만 tool을 등록하고 AbortController로 lifecycle을 종료한다. 등록 실패는 삼켜서 visible UI를 계속 사용하게 한다. Home에서는 callback을 `flushSync(()=>choose(c))`로 연결한다.

근거: [agent-tools.ts L1–13](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/agent-tools.ts#L1-L13), [page.tsx L25–26](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/app/page.tsx#L25-L26).

[해석] 이 factory/callback 분리는 좋은 출발점이다. 그러나 입력 schema에 `additionalProperties:false`가 있어도 execute 함수가 extra key를 실제로 거부하는 것은 아니다. flushSync는 React 반영 시점을 맞출 뿐 WebGL의 다음 frame 출력 완료까지 보장하지 않는다. tool 결과의 selectedPieces는 selection state에 대한 결과이며 screenshot이나 GPU 완료 확인은 아니다.

### 7.2 범용 Adapter 패턴과 외부 MCP 서버는 원본에 없다

[관찰] renderer는 Anatomy 타입과 SYSTEMS를 직접 import한다. UI도 anatomy 데이터·설명·검색을 직접 알고 있다. 범용 `DomainAdapter`/`RendererAdapter` 인터페이스, plugin registry, 의존성 주입 container, 장면 직렬화/undo command 계층은 검토한 app 실행 경로에 없다.

[관찰] 외부 MCP transport, MCP server process, HTTP endpoint, 인증·계정 연결, Gemini/Claude/GPT용 설정 또는 provider SDK는 이 앱 실행 경로에 없다. `document.modelContext` 기반의 선택적 브라우저 WebMCP 연결과 외부 호스트에 연결하는 MCP 서비스는 구분해야 한다. 실제 호스트 호환성은 별도 공식 문서 확인과 integration 검증이 필요하다.

[제안] Softform은 원본에서 발견했다고 주장하는 대신, 사용자의 요구를 위해 새로운 adapter 경계를 만든다. UI와 AI host 둘 다 동일한 domain command 실행 함수를 호출한다. transport별 연결·인증·오류 처리는 adapter에서 맡고 renderer에는 이미 검증된 문서 변화만 전달한다. 연결 실패를 무조건 삼키는 대신 일반 사용자에게 현재 연결 capability와 해결 가능한 오류를 보여준다.

## 8. Softform에 제안하는 의존성 방향

아래는 원본 저장소의 구조가 아니라 이 연구에서 제안하는 구조다. 작은 MVP에서는 폴더만 분리하고 패키지/monorepo 분할은 나중에 해도 된다.

```text
src/
  domain/
    character-document.ts   # stable part IDs, version, editable semantic values
    commands.ts             # validated semantic command union
    reducer.ts              # pure apply/undo; no React/Three/browser/provider imports
    validation.ts           # limits, unknown property rejection, schema/version checks
  application/
    character-service.ts    # revision checks, one command pipeline, history
    ports.ts                # renderer, storage, command interpreter contracts
  adapters/
    renderer-three/         # scene, geometry pool, mesh registry, camera, scheduler
    command-local/          # deterministic supported chat commands
    storage-browser/        # versioned serialization and recovery
    host-webmcp/            # optional browser host registration
    host-mcp/               # future external MCP transport, separated deployment
    provider-ai/            # future provider calls; credentials outside browser bundle
  ui/
    CharacterViewport.tsx   # renderer lifecycle and viewport dimensions
    ChatComposer.tsx        # presentational composer, loading/error/IME state
    Conversation.tsx       # messages and applied-change feedback
    primitives/            # domain-independent buttons/controls
```

### 8.1 문서와 command 계약

- `CharacterDocument`는 schema version, revision, character ID, semantic part IDs, 색상·비율·표정 등 허용된 속성을 가진다. Three Mesh, Material, texture, URL secret을 저장하지 않는다.
- `CharacterCommand`는 `set-color`, `set-proportion`, `set-expression`, `reset-character`처럼 의미가 제한된 union으로 시작한다. 카메라 회전/배율은 별도 ViewCommand로 두어 캐릭터 파일 수정과 구분한다.
- 한국어 chat parser, 향후 LLM, MCP tool은 모두 같은 command로 정규화한다. 임의 JavaScript나 shader 문자열을 실행시키는 경로를 만들지 않는다.
- application이 command를 검증하고 expected revision을 확인한 뒤 한번 적용한다. renderer에는 old/new document 또는 명시적 patch와 changed IDs를 전달한다.
- command 결과는 적용 revision, 변경 항목, 지원되지 않은 부분을 반환한다. UI 반영과 파일 저장 성공은 구분한다. 스트리밍 token마다 문서를 변경하지 않고 유효한 command가 완성됐을 때 commit한다.
- undo/redo는 renderer 객체가 아닌 serializable document/command history를 기준으로 한다. 실패한 command가 상태 일부만 바꾸지 않도록 원자성을 유지한다.

### 8.2 renderer 계약과 교체 가능성

- `RendererAdapter.mount(host, initialDocument, viewport)`가 한 번 scene을 만든다.
- `applyDocument` 또는 `applyPatch`는 mesh registry의 stable ID를 사용해 바뀐 부품만 갱신한다.
- `setView`/`resize`/`invalidate`는 문서 mutation과 독립적이다.
- `dispose`는 RAF, listeners, controls, observer, material, texture 및 geometry 소유권을 정리한다. 공유 geometry는 reference count 또는 renderer 단위 pool에서 한 번만 dispose한다.
- UI는 renderer 구현체가 Three.js인지 test double인지 모른다. renderer는 chat JSX, CSS selector, provider 설정을 모른다.
- renderer별 capability를 드러낸다. 절차적 모델 adapter가 지원하는 귀 길이 변경과 GLB adapter가 지원하는 morph target은 다를 수 있다. 지원하지 않는 command를 거짓 성공으로 반환하지 않는다.

### 8.3 단일 캐릭터에서 대량 장면으로 확장하는 순서

1. 안정적인 한 캐릭터: shared geometry, pooled materials, ID 기반 mesh registry, 직접 transform/material 갱신, true idle scheduler.
2. 별도의 반복형 workload: 수백/수천 개 같은 부품 또는 썸네일 군집을 instancing으로 검증. 실제 character scene의 품질과 벤치마크 scene을 구분.
3. 다양한 외부 모델: AssetRepository, 로딩 상태, bounds 검증, texture budget, 중복 asset 캐시, partial readiness.
4. 서로 다른 정적 부품이 충분히 많을 때 geometry batching/texture state를 검토. hidden batch skip, spatial picking, LOD 및 worker 조립은 병목 측정에 따라 선택.
5. rig/morph/animation은 별도 capability와 데이터 계약으로 확장. Human Atlas의 static anatomy 실적을 이 기능의 성능 보증으로 사용하지 않음.

## 9. 무엇을 가져오고 무엇을 새로 만드는가

### 그대로 가져올 가치가 높은 작은 후보

**PointerTap** — `app/pointer-tap.ts` L1–21, blob `e1c84f673969f449ff8ea1ee179caff235214ecc`. 의존성이 없고, drag·pinch 후 오선택을 막는 계약이 분명하다. 부품 선택 기능을 구현하는 시점의 직접 이식 1순위다. 현재 회전 전용 UI라면 도입을 미룬다.

**decodeModelResponse** — `app/model-download.ts` L1–11, blob `d5e45752fea94b213579878123ceaa09d3218688`. static host의 이중 압축 해제와 잘린 파일 처리를 잘 분리했다. 향후 같은 custom binary/gzip 파이프라인을 쓸 때 후보이며, GLB loader나 현재 procedural model에는 억지로 넣지 않는다. domain-neutral error로 바꾸면 수정본임을 기록한다.

**createExplosionLayout** — `app/explosion-layout.ts` L1–14, blob `2e3f16c9e7da22e8972008bdaaec14be5317b2e7`. visible geometry bounds를 shelf 방식으로 deterministic하게 배치한다. accessory inventory나 분해 보기에는 유용하지만 현재 캐릭터 회전/채팅 MVP에 필수는 아니다. 직접 사용할 경우 anatomy `Part` 대신 `id/bounds`만 받도록 추출하며, empty input·aspect·overlap 검증을 유지한다. 최적 packing solver는 아니다.

### 원리를 채택하되 Softform 계약으로 재구현

- persistent renderer effect + 최신 state ref: application revision/patch와 scheduler로 명시화.
- immutable UI state / stable part IDs: provider·UI·render asset의 독립성을 위해 순수 domain document로 강화.
- material 공유·geometry batch·동적 상태 분리: 첫 모델은 pool과 transform mutation, 대량 workload에는 instancing 또는 batching을 목적에 맞게 선택.
- tool factory + injected callback: 공통 command service를 주입하는 tool factory로 재구현, runtime schema 검증과 host capability/error를 추가.
- pointer-aware 선택 + bounds prefilter: 캐릭터 부품 의미와 눈/의상 겹침 규칙에 맞춰 재구현.
- panel-aware camera fit: DOM selector 대신 UI가 전달하는 viewport rectangle을 입력으로 사용.
- UI primitive의 variants/focus/disabled: 필요한 최소 component만 사용하고 style tokens를 프로젝트에서 통일.

### 가져오지 않는 항목

- BodyParts3D 모델 및 해부 설명/분류 데이터: 캐릭터 MVP와 관련이 없고 별도 데이터 attribution 의무를 늘린다.
- `scene.tsx` 전체: anatomy system색·투명 피부·폭발 레이아웃·picking·DOM 위치·리소스 관리가 한 effect에 얽혀 있다.
- `page.tsx` 전체: 검색·layer·details·도구 bridge·data fetch·도메인 state·markup이 한 component에 있다. 범용 editor shell로 옮기기에 결합이 크다.
- `globals.css` 전체: 반복 override와 anatomy DOM 결합을 가져오지 않는다.
- `package.json` 전체: 현재 Vite 실행 경로에서 쓰지 않는 server/RSC 계열 및 여러 UI 의존성까지 그대로 추가하지 않는다.
- 변환/최적화 스크립트 전체: BodyParts3D 명명·path·axis·고정 이동량·원본 파일 삭제 동작에 특화되어 있다. 캐릭터 asset pipeline은 별도 설계한다.

이 연구 작업 자체에서는 위 원본 코드를 실행 코드로 복사하지 않았다. 실제 도입 여부와 수정사항은 구현 변경 및 third-party notice에서 따로 추적해야 한다.

## 10. 데이터 전처리에서 배울 점과 주의점

[관찰] converter는 mm/Z-up을 m/Y-up으로 바꾸고 signed 16-bit normal, Float32 position, Uint32 index를 4-byte 정렬해 chunk에 넣는다. 최적화는 meshoptimizer의 simplification을 part 단위로 수행하며 최대 상대오차 `.002`를 지정한다. target index 수는 대략 원본의 22%, 최소 96을 목표로 하지만 실제 감소율은 오차 한계에 제한된다. 모든 원본 part identity를 보존하려는 설계다.

[관찰] optimizer는 `manifest.optimized`가 이미 있으면 중단한다. 마지막에 변환기 출력의 원본 chunk를 삭제한다. filename prefix로 남성/여성 분기를 고르고, 여성 레거시 경로에서는 동일 위치 vertex를 weld하며 normal을 평균낸다. 이 behavior가 일반 캐릭터의 seam/UV/normal 요구에 맞는다고 볼 수 없다.

근거: [convert-anatomy.py](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/scripts/convert-anatomy.py), [optimize-anatomy.mjs L14–38](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/scripts/optimize-anatomy.mjs#L14-L38), [compress-models.mjs](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/scripts/compress-models.mjs).

[제안] 캐릭터 asset pipeline에서도 원본 보존, 변환 provenance, stable semantic IDs, bounds/scale normalization, byte/triangle budget을 기록한다. 얼굴·귀 실루엣·morph·rig·UV seam은 별도 품질 기준이다. `.002` 값을 캐릭터에 그대로 사용해도 품질이 보장된다고 주장하지 않는다. 변환 산출물은 원본과 다른 output directory에 써서 재생성과 rollback을 쉽게 한다.

## 11. 라이선스와 직접 복사 시 기록 방법

[관찰] 원본 application code LICENSE는 MIT, `Copyright (c) 2026 ashemag`이다. 코드 또는 substantial portion을 복사/배포할 경우 해당 copyright notice와 permission notice를 포함하도록 명시한다. 수정·상업 사용·배포를 허용하는 코드 라이선스이며 원본 데이터의 라이선스와는 별개다.

근거: [LICENSE](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/LICENSE).

[제안] 원본 함수를 직접 가져온다면 다음 기록을 남긴다.

- `THIRD_PARTY_NOTICES.md` 또는 `licenses/human-atlas-MIT.txt`에 원본 MIT 전문, copyright, 저장소 URL, 고정 commit을 보존.
- 해당 helper 상단에 원본 파일 URL/commit, 수정 여부와 요지를 짧게 기록.
- provenance 문서에 원본 blob SHA와 복사 후 변경 이유를 남겨 upstream 비교가 가능하게 함.
- 배포 artifact에도 notice가 포함되는지 확인. source comment만 만들고 배포에서 사라지는 상황을 피함.
- Base UI/shadcn 등 dependency는 각자의 license를 따로 보존. 원본 repo의 MIT 하나가 모든 의존성·asset의 사용 조건을 대체한다고 생각하지 않음.

[관찰] `public/ATTRIBUTION.md`는 현재 해부 데이터가 BodyParts3D 4.0, CC BY 4.0임을 기록하고 source, publication, 축·단위 변환, simplification, normal quantization, grouping 등 변경 내용을 적는다. 오래된 OBJ comment의 다른 라이선스와 현재 공식 조건의 관계도 설명한다. 이 문서는 그 원본 attribution의 내용을 확인한 것이며 법적 해석 전체를 독립 검증한 것은 아니다. Softform이 해당 데이터를 쓰지 않으면 이를 캐릭터 asset의 권리 근거로 삼을 수 없다.

근거: [public/ATTRIBUTION.md](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/public/ATTRIBUTION.md).

## 12. 검증 전략: 원본의 증거와 Softform의 수용 기준

### 원본에서 소스로 확인한 검증

- `validate-atlas.mjs`: part/concept 개수, part ID 유일성, binary 길이, index 범위, position 유한값, concept 참조의 존재, triangle 합계.
- `validate-interactions.mjs`: 전체/시스템별 exploded layout, aspect `.46`, `1`, `1.7`에서 cell containment와 overlap, search/inspect 성공, 없는 ID의 실패 시 selection 불변, 빈 query 거부, tap/drag/multitouch/cancel 상태 전이.
- README는 브라우저 interaction 및 여러 viewport 점검을 서술하고 물리적 모바일 기기 성능·실제 multitouch hardware는 미검증이라고 명시한다.
- tree에서 browser E2E suite, CI workflow, FPS/heap benchmark 결과 artifact는 발견하지 못했다. 위 단위 검증 script의 존재를 이번 실행 통과나 실제 host 통합 통과로 바꾸어 말하지 않는다.

근거: [validate-atlas.mjs](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/scripts/validate-atlas.mjs), [validate-interactions.mjs](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/scripts/validate-interactions.mjs), [README.md](https://github.com/ashemag/human-atlas/blob/1c38bf35c254a891200d3cedecfd57abebe83d8d/README.md).

### Softform에서 의미 있는 검증

1. **회전 입력:** PC drag 후 camera가 바뀌고 의도하지 않은 character edit는 없다. 이후 touch rotation, pinch/cancel, drag 후 선택 억제를 실제 입력 계층에서 확인한다.
2. **도메인 원자성:** 유효 command는 예상 part와 revision만 바꾸고 잘못된 값·지원하지 않는 명령은 문서를 바꾸지 않는다. undo/redo 후 serialization이 기대 상태와 같다.
3. **증분 적용:** 색/비율 명령 전후 renderer identity와 geometry pool count를 비교한다. 색 변경에 새 geometry/context가 생기면 실패다. 여러 command를 거쳐도 mesh/material 수가 계속 증가하지 않아야 한다.
4. **실제 idle:** damping이 끝난 뒤 RAF callback과 render counter가 멈추는지 측정한다. auto-rotate/animation이 켜진 구간은 지속 frame이 정상이다. 숨겨진 탭 복귀도 확인한다.
5. **사용자 피드백:** chat 명령이 적용된 항목과 미지원 범위를 설명한다. command의 실행 결과, 문서 저장, 실제 3D frame 표시를 혼동하지 않는다.
6. **viewport:** desktop 및 390×844, 320×568, 844×390 같은 좁은 크기를 확인하되 실제 모바일 검증과 구분한다. composer/keyboard가 얼굴을 가리지 않는지와 keyboard-only camera preset을 확인한다.
7. **리소스:** mount/unmount·hot reload·context loss에서 listener/RAF/geometry/texture 누수가 없는지 확인한다. context loss 후 fallback/복구를 안내한다.
8. **대량 workload:** 개체 수, vertex/triangle 수, 재질 수, draw calls, DPR, 해상도, browser/device, FPS/p95 frame time, command-to-frame latency, memory 범위를 함께 기록한다. idle, orbit, animation, 일괄 update를 따로 측정한다.
9. **호스트:** deterministic local parser, 실제 LLM, 브라우저 WebMCP, 외부 MCP, 각 Gemini/Claude/GPT host는 별도 시험 항목이다. schema 단위 테스트만으로 host 연결 완료라고 보고하지 않는다.

대량 benchmark가 같은 geometry의 instance를 많이 그린 것이라면 ‘반복형 mesh workload’ 결과라고 표시한다. 이것으로 2,234개 서로 다른 해부 mesh나 수천 개 skinned character의 성능을 보장하지 않는다. 목표 FPS/latency는 실제 대상 PC·모바일에서 측정한 기준으로 확정한다.

## 13. 이어서 확인할 것

- 이 문서의 권고 중 실제 구현에 들어간 항목을 구현 파일과 연결하고, 채택하지 않은 최적화는 측정에 따른 보류로 기록한다.
- 첫 실행은 procedural character + supported semantic commands + PC drag/zoom까지를 검증한다. 자연어 전반을 이해하는 AI 생성·임의 3D 편집과 동일시하지 않는다.
- 큰 asset 도입 시 manifest/schema를 런타임 검증하고 악성/손상 데이터, 과도한 geometry/texture 용량을 제한한다. Human Atlas의 `data as Atlas` cast를 그대로 복제하지 않는다.
- external MCP와 모바일은 이번 renderer 구조가 재사용 가능하다는 설계 판단과 실제 통합 완료를 구분한다. 연결·인증·저장/복구·권한 수용 근거를 별도로 쌓는다.
- 원본 main이 바뀌어도 이 연구는 고정 commit을 기준으로 유지한다. 업데이트 조사 시 변경 파일과 결론 변화만 덧붙인다.
