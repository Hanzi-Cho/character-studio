import { useRef, useState } from "react";
import { Icon } from "./Icon.js";
export function Composer({
  busy,
  disabled,
  onSubmit,
  onImport,
  onHelp,
}: {
  busy: boolean;
  disabled: boolean;
  onSubmit: (text: string) => Promise<void>;
  onImport: (file: File) => void;
  onHelp: () => void;
}) {
  const [text, setText] = useState("");
  const composing = useRef(false);
  const file = useRef<HTMLInputElement>(null);
  const submit = async () => {
    if (!text.trim() || busy || disabled) return;
    const sent = text;
    setText("");
    await onSubmit(sent);
  };
  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) onImport(selected);
          event.target.value = "";
        }}
      />
      <button
        className="icon-button import-button"
        type="button"
        title="저장한 캐릭터 JSON 불러오기"
        aria-label="저장한 캐릭터 불러오기"
        disabled={disabled || busy}
        onClick={() => file.current?.click()}
      >
        <Icon name="plus" size={25} />
      </button>
      <textarea
        aria-label="캐릭터 편집 명령"
        rows={1}
        maxLength={1000}
        value={text}
        placeholder="어떤 모습으로 바꿔볼까요?"
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onCompositionStart={() => (composing.current = true)}
        onCompositionEnd={() => (composing.current = false)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !composing.current &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            void submit();
          }
        }}
      />
      <button
        type="button"
        className="mode-button"
        title="로컬 편집 명령 도움말"
        onClick={onHelp}
      >
        빠른 편집
        <Icon name="chevron" size={14} />
      </button>
      <button
        className="send-button"
        type="submit"
        aria-label="편집 명령 보내기"
        disabled={busy || disabled || !text.trim()}
      >
        {busy ? <span className="spinner" /> : <Icon name="send" size={22} />}
      </button>
    </form>
  );
}
