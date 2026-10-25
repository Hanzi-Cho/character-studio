import { useState } from "react";
import { Composer } from "./Composer.js";
import { ExpressionPicker } from "./ExpressionPicker.js";
import { Icon } from "./Icon.js";
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
        modeLabel={chatMode === "codex" ? "Codex AI" : "로컬 편집"}
        busy={busy}
        disabled={disabled}
        onSubmit={onSubmit}
        onImport={onImport}
        onHelp={onHelp}
      />
      {busy && (
        <p className="ai-progress" role="status">
          원하는 모습을 해석하고 있어요. 잠시만 기다려 주세요.
        </p>
      )}
      {!messages.length && !busy && chatMode === "codex" && (
        <div className="prompt-suggestions">
          {[
            "하늘색 셔츠를 입히고 웃는 표정으로",
            "금색 왕관과 작은 하얀 날개를 달아줘",
            "분홍색 안경을 만들어줘",
          ].map((text) => (
            <button
              key={text}
              disabled={disabled}
              onClick={() => void onSubmit(text)}
            >
              {text}
            </button>
          ))}
        </div>
      )}
      <p className="composer-note">
        <span>{chatMode === "codex" ? "Codex AI 연결" : "로컬 편집"}</span>
        <span className="note-dot">·</span>
        {chatMode === "codex"
          ? "채팅과 현재 캐릭터 설정을 AI에 보냅니다."
          : "색상, 크기, 표정을 바꿔보세요."}
        <span className="desktop-only"> 모습은 이 PC에 저장돼요.</span>
      </p>
    </section>
  );
}
