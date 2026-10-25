import { AiConnectionDialog } from "./components/AiConnectionDialog.js";
import { BASE_CATALOG } from "./domain/baseProfile.js";
import { characterFromBase } from "./domain/character.js";
import { useState } from "react";
import { Icon } from "./components/Icon.js";
import { HelpDialog } from "./components/HelpDialog.js";
import { expressionLabels } from "./components/ExpressionPicker.js";
import { useStudio } from "./presentation/useStudio.js";
import { useCharacterRenderer } from "./presentation/useCharacterRenderer.js";
import type { StudioRuntime } from "./presentation/ports.js";

export default function App({ runtime }: { runtime: StudioRuntime }) {
  const {
    refreshCapabilities,
    snapshot,
    chatMode,
    connected,
    busy,
    messages,
    feedback,
    showFeedback,
    send,
    patch,
    action,
    importCharacter,
  } = useStudio(runtime.gateway);
  const { stage, renderer, renderError } = useCharacterRenderer(
    runtime.createRenderer,
    snapshot?.document,
  );
  const { ChatPanel } = runtime;
  const [aiOpen, setAiOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const download = (href: string, name: string) => {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = name;
    anchor.click();
  };
  const exportCharacter = () => {
    if (!snapshot) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(snapshot.document, null, 2)], {
        type: "application/json",
      }),
    );
    download(url, "character-studio.json");
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showFeedback("캐릭터 파일을 저장했어요. + 버튼으로 다시 불러올 수 있어요.");
  };
  return (
    <main className="studio">
      <header className="topbar">
        <a className="brand" href="./" aria-label="Character Studio 홈">
          <span className="brand-symbol">
            <span />
            <span />
          </span>
          <span>
            character<span className="brand-secondary"> / studio</span>
          </span>
        </a>
        <div className="header-actions">
          <button
            className="ai-trigger"
            disabled={busy}
            onClick={() => setAiOpen(true)}
          >
            내 AI 연결
          </button>
          <span className={`connection ${connected ? "" : "offline"}`}>
            <i />
            {connected
              ? runtime.storage === "browser"
                ? "웹 데모 · 이 브라우저에 저장"
                : "이 기기의 작업 공간"
              : "연결 확인 중"}
          </span>
          <button
            className="icon-button help-trigger"
            onClick={() => setHelp(true)}
            aria-label="스튜디오 도움말"
            title="도움말"
          >
            <Icon name="help" />
          </button>
        </div>
      </header>
      <section className="scene-area" aria-label="캐릭터 작업 공간">
        <div className="scene-heading">
          <span className="eyebrow">YOUR LITTLE WORLD</span>
          <h1>
            {snapshot?.document.name ?? "치이카와"}
            <span className="name-dot" />
          </h1>
          <label className="base-picker">
            기본 모델
            <select
              aria-label="기본 캐릭터 선택"
              disabled={busy || !snapshot || !connected}
              value={snapshot?.document.base.id ?? "chiikawa"}
              onChange={(event) => {
                const base = BASE_CATALOG.find(
                  (b) => b.id === event.target.value,
                );
                if (!base) return;
                const { schemaVersion, ...value } = characterFromBase(base);
                void patch(
                  value,
                  `${base.name} 기본 모델을 불러왔어요. 이전 모습은 되돌리기로 복구할 수 있어요.`,
                );
              }}
            >
              {BASE_CATALOG.map((base) => (
                <option key={base.id} value={base.id}>
                  {base.name}
                </option>
              ))}
              {snapshot?.document.base.id === "custom" && (
                <option value="custom">내 이미지 초안</option>
              )}
            </select>
          </label>
        </div>
        <div
          className="stage"
          ref={stage}
          tabIndex={0}
          aria-label="캐릭터 회전 영역. 방향키로 회전, Home 키로 정면."
          onKeyDown={(event) => {
            const keys: Record<string, [number, number]> = {
              ArrowLeft: [-0.15, 0],
              ArrowRight: [0.15, 0],
              ArrowUp: [0, -0.15],
              ArrowDown: [0, 0.15],
            };
            if (keys[event.key]) {
              event.preventDefault();
              renderer.current?.rotate(...keys[event.key]);
            } else if (event.key === "Home") {
              event.preventDefault();
              renderer.current?.resetView();
            }
          }}
        />
        {renderError && (
          <div className="render-error" role="alert">
            <Icon name="help" />
            <p>{renderError}</p>
          </div>
        )}
        <div className="scene-caption">
          <span className="caption-line" />
          드래그해서 둘러보세요
          <span className="caption-detail"> · 스크롤로 확대</span>
        </div>
        <nav className="scene-tools" aria-label="캐릭터 도구">
          <button
            className="icon-button"
            disabled={!snapshot?.canUndo || busy || !connected}
            onClick={() => void action("undo")}
            title="되돌리기"
            aria-label="되돌리기"
          >
            <Icon name="undo" />
          </button>
          <button
            className="icon-button"
            disabled={!snapshot?.canRedo || busy || !connected}
            onClick={() => void action("redo")}
            title="다시 실행"
            aria-label="다시 실행"
          >
            <Icon name="redo" />
          </button>
          <span className="tool-divider" />
          <button
            className="icon-button"
            disabled={!snapshot || busy || !connected}
            onClick={() => void action("reset")}
            title="초기 모습으로 · 되돌리기 가능"
            aria-label="초기 모습으로"
          >
            <Icon name="reset" />
          </button>
          <button
            className="icon-button"
            onClick={() => renderer.current?.resetView()}
            title="정면으로"
            aria-label="정면으로"
          >
            <Icon name="front" />
          </button>
          <button
            className="icon-button"
            onClick={() => {
              if (renderer.current)
                download(renderer.current.capture(), "character-studio.png");
            }}
            title="이미지 저장"
            aria-label="이미지 저장"
          >
            <Icon name="camera" />
          </button>
          <button
            className="icon-button"
            disabled={!snapshot}
            onClick={exportCharacter}
            title="캐릭터 JSON 저장"
            aria-label="캐릭터 파일 저장"
          >
            <Icon name="save" />
          </button>
        </nav>
        <div className="scene-label">
          <span className="sample-tag">3D STUDY 01</span>
          <span>
            {snapshot?.document.base.id === "usagi"
              ? "Usagi"
              : snapshot?.document.base.id === "custom"
                ? "My draft"
                : "Chiikawa"}
          </span>
        </div>
      </section>
      <ChatPanel
        storage={runtime.storage}
        chatMode={chatMode}
        expression={snapshot?.document.expression}
        busy={busy}
        disabled={!snapshot || !connected}
        messages={messages}
        feedback={feedback}
        onExpression={(expression) => {
          if (snapshot?.document.expression !== expression)
            void patch(
              { expression },
              `${expressionLabels[expression]} 표정을 적용했어요.`,
            );
        }}
        onSubmit={send}
        onImport={(file) => void importCharacter(file)}
        onHelp={() => setHelp(true)}
      />
      <AiConnectionDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        connection={runtime.ai}
        onChanged={() => void refreshCapabilities()}
      />
      <HelpDialog
        storage={runtime.storage}
        open={help}
        chatMode={chatMode}
        onClose={() => setHelp(false)}
      />
    </main>
  );
}
