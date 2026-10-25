import { useState } from "react";
import { Composer } from "./Composer.js";
import { ExpressionPicker } from "./ExpressionPicker.js";
import { Icon } from "./Icon.js";
import { ExampleSuggestion } from "./ExampleSuggestion.js";
import type { ChatPanelProps } from "../presentation/ports.js";

export function ChatDock({
  chatMode = "local",
  storage = "local",
  expression,
  busy,
  disabled,
  messages,
  feedback,
  onExpression,
  onSubmit,
  onImport,
  onHelp,
}: ChatPanelProps) {
  const [history, setHistory] = useState(false);
  return (
    <section className="chat-dock" aria-label="캐릭터 편집 채팅">
      <div
        className={`last-message ${!busy && feedback.error ? "error" : ""}`}
        aria-label="편집 상태"
      >
        <span className="reply-mark">
          <Icon name="sparkle" size={14} />
        </span>
        <p role="status" aria-live="polite" aria-atomic="true" tabIndex={0}>
          {busy
            ? "편집을 처리하고 있어요. 잠시만 기다려 주세요."
            : feedback.text}
        </p>
        <button
          className="icon-button"
          disabled={messages.length === 0}
          onClick={() => setHistory(!history)}
          aria-label="대화 내역 보기"
          aria-expanded={history}
          title="대화 내역"
        >
          <Icon name="history" size={17} />
        </button>
      </div>
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
      <Composer
        modeLabel={
          chatMode === "api"
            ? "OpenAI API"
            : chatMode === "chatgpt"
              ? "ChatGPT"
              : chatMode === "codex"
                ? "Codex AI"
                : "예문 체험"
        }
        busy={busy}
        disabled={disabled}
        onSubmit={onSubmit}
        onImport={onImport}
        onHelp={onHelp}
      />
      <p className="composer-note">
        <span>
          {["api", "chatgpt", "codex"].includes(chatMode)
            ? "AI 연결됨"
            : "모델 연결 없음"}
        </span>
        <span className="note-dot">·</span>
        {["api", "chatgpt", "codex"].includes(chatMode)
          ? "추천 예문은 로컬 적용, 자유 채팅·첨부 이미지는 AI로 전송돼요."
          : "추천 예문을 누르거나 그대로 입력해 보세요."}
        <span className="desktop-only">
          {" "}
          {storage === "browser"
            ? "모습은 이 브라우저에 저장돼요."
            : "모습은 이 PC에 저장돼요."}
        </span>
        {storage === "browser" && (
          <>
            {" "}
            <a
              href="https://github.com/Hanzi-Cho/character-studio#자신의-codex로-자유롭게-채팅하기"
              target="_blank"
              rel="noreferrer"
            >
              AI 채팅 실행 방법 ↗
            </a>
          </>
        )}
      </p>
    </section>
  );
}
