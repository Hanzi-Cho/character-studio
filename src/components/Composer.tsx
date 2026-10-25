import type { ReferenceImage } from "../domain/referenceImages.js";
import { prepareReferenceImage } from "../presentation/prepareReferenceImage.js";
import { useRef, useState } from "react";
import { Icon } from "./Icon.js";
export function Composer({
  modeLabel = "Codex AI",
  busy,
  disabled,
  onSubmit,
  onImport,
  onHelp,
}: {
  modeLabel?: string;
  busy: boolean;
  disabled: boolean;
  onSubmit: (text: string, images?: ReferenceImage[]) => Promise<boolean>;
  onImport: (file: File) => void;
  onHelp: () => void;
}) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<ReferenceImage[]>([]);
  const [imageError, setImageError] = useState("");
  const [loading, setLoading] = useState(false);
  const composing = useRef(false);
  const file = useRef<HTMLInputElement>(null);
  const submit = async () => {
    if ((!text.trim() && !images.length) || busy || disabled || loading) return;
    const sent =
      text.trim() ||
      "이 참고 이미지의 특징으로 편집 가능한 단순 3D 기본 모델을 만들어줘.";
    if (await onSubmit(sent, images)) {
      setText("");
      setImages([]);
    }
  };
  return (
    <div className="composer-wrap">
      {images.length > 0 && (
        <div className="reference-tray">
          {images.map((image, i) => (
            <div key={i}>
              <img src={image.dataUrl} alt={`참고 이미지 ${i + 1}`} />
              <button
                disabled={busy}
                onClick={() =>
                  setImages((values) => values.filter((_, j) => i !== j))
                }
                aria-label={`참고 이미지 ${i + 1} 제거`}
              >
                ×
              </button>
            </div>
          ))}
          <p>
            이미지 {images.length}/4 · 보내면 AI로 단순 3D 초안을 만듭니다. 기존
            모습은 되돌리기로 복구할 수 있어요.
          </p>
        </div>
      )}
      {imageError && (
        <p role="alert" className="error">
          {imageError}
        </p>
      )}
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
          accept="application/json,.json,image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={async (event) => {
            const selected = Array.from(event.target.files ?? []);
            event.target.value = "";
            setImageError("");
            if (!selected.length) return;
            if (
              selected.length === 1 &&
              selected[0].name.toLowerCase().endsWith(".json")
            ) {
              onImport(selected[0]);
              return;
            }
            if (selected.length + images.length > 4) {
              setImageError("참고 이미지는 최대 4장까지 추가할 수 있어요.");
              return;
            }
            setLoading(true);
            try {
              const prepared = await Promise.all(
                selected.map(prepareReferenceImage),
              );
              setImages((items) => [...items, ...prepared]);
            } catch (error) {
              setImageError(
                error instanceof Error && error.message.length < 120
                  ? error.message
                  : "이미지를 읽지 못했어요.",
              );
            } finally {
              setLoading(false);
            }
          }}
        />
        <button
          className="icon-button import-button"
          type="button"
          title="참고 이미지 또는 캐릭터 JSON 불러오기"
          aria-label="이미지 또는 캐릭터 파일 첨부"
          disabled={disabled || busy || loading}
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
          title="채팅 편집 도움말"
          onClick={onHelp}
        >
          {modeLabel}
          <Icon name="chevron" size={14} />
        </button>
        <button
          className="send-button"
          type="submit"
          aria-label="편집 명령 보내기"
          disabled={
            busy || disabled || loading || (!text.trim() && !images.length)
          }
        >
          {busy ? <span className="spinner" /> : <Icon name="send" size={22} />}
        </button>
      </form>
    </div>
  );
}
