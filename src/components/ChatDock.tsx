import { useState } from "react";
import { Composer } from "./Composer.js";
import { ExpressionPicker } from "./ExpressionPicker.js";
import { Icon } from "./Icon.js";
import { ExampleSuggestion } from "./ExampleSuggestion.js";
import type { ChatPanelProps } from "../presentation/ports.js";

export function ChatDock({
  chatMode = "local",
  expression,
  busy,
  disabled,
  messages,
  onExpression,
  onSubmit,
  onImport,
  onHelp,
}: ChatPanelProps) {
  const [history, setHistory] = useState(false);
  const last = messages.at(-1);
  return (
    <section className="chat-dock" aria-label="캐릭터 편집 채팅">
      <ExpressionPicker
        value={expression}
        disabled={disabled || busy}
        onSelect={onExpression}
      />
      <ExampleSuggestion disabled={disabled || busy} onApply={onSubmit} />
      {history && (
        <div className="history-panel">
          <div className="history-heading">
            <strong>이번 대화</strong>
            <button
              className="icon-button"
              onClick={() => setHistory(false)}
              aria-label="대화 내역 닫기"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          {messages.map((message) => (
            <div className="message" key={message.id}>
              <p className="user-message">{message.text}</p>
              <p className={message.error ? "reply error" : "reply"}>
                {message.reply}
              </p>
              {!!message.audit && (
                <details className="edit-details">
                  <summary>적용한 편집 명령</summary>
                  <pre>{JSON.stringify(message.audit, null, 2)}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
      {last && (
        <div
          className={`last-message ${last.error ? "error" : ""}`}
          aria-live="polite"
        >
          <span className="reply-mark">
            <Icon name="sparkle" size={14} />
          </span>
          <p>{last.reply}</p>
          <button
            className="icon-button"
            onClick={() => setHistory(!history)}
            aria-label="대화 내역 보기"
            title="대화 내역"
          >
            <Icon name="history" size={17} />
          </button>
        </div>
      )}
      <Composer
        modeLabel={chatMode === "codex" ? "Codex AI" : "예문 체험"}
        busy={busy}
        disabled={disabled}
        onSubmit={onSubmit}
        onImport={onImport}
        onHelp={onHelp}
      />
      {busy && (
        <p className="ai-progress" role="status">
          편집을 처리하고 있어요. 잠시만 기다려 주세요.
        </p>
      )}
      <p className="composer-note">
        <span>{chatMode === "codex" ? "Codex AI" : "모델 연결 없음"}</span>
        <span className="note-dot">·</span>
        {chatMode === "codex"
          ? "추천 예문은 로컬 적용, 그 외 채팅은 AI로 전송돼요."
          : "추천 예문을 누르거나 그대로 입력해 보세요."}
        <span className="desktop-only"> 모습은 이 PC에 저장돼요.</span>
      </p>
    </section>
  );
}
