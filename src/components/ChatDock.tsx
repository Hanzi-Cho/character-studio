import { useState } from "react";
import { Composer } from "./Composer.js";
import { ExpressionPicker } from "./ExpressionPicker.js";
import { Icon } from "./Icon.js";
import type { ChatPanelProps } from "../presentation/ports.js";

export function ChatDock({
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
        busy={busy}
        disabled={disabled}
        onSubmit={onSubmit}
        onImport={onImport}
        onHelp={onHelp}
      />
      <p className="composer-note">
        <span>로컬 편집</span>
        <span className="note-dot">·</span>색상, 크기, 표정부터 바꿔보세요.
        <span className="desktop-only"> 모든 변경은 이 PC에 저장돼요.</span>
      </p>
    </section>
  );
}
