import { useEffect, useRef, useState } from "react";
import {
  characterBytes,
  formatBytes,
  LIBRARY_LIMIT,
  type CharacterLibrary,
  type LibraryEntry,
} from "../application/characterLibrary.js";
import type { CharacterDocument } from "../domain/character.js";
import { expressionLabels } from "./ExpressionPicker.js";
import { Icon } from "./Icon.js";

export function CharacterLibraryDialog({
  open,
  onClose,
  library,
  current,
  busy,
  onLoad,
  onExport,
}: {
  open: boolean;
  onClose: () => void;
  library: CharacterLibrary;
  current?: CharacterDocument;
  busy: boolean;
  onLoad: (document: CharacterDocument) => Promise<boolean>;
  onExport: (document: CharacterDocument) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [selected, setSelected] = useState<LibraryEntry>();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState<string>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const operationRef = useRef(false);
  useEffect(() => {
    if (!open) {
      dialog.current?.close();
      return;
    }
    dialog.current?.showModal();
    setDeleting(undefined);
    setNotice("");
    let active = true;
    const refresh = () =>
      void library
        .list()
        .then((items) => {
          if (active) {
            setEntries(items);
            setError("");
          }
        })
        .catch(() => {
          if (active)
            setError(
              "보관함을 읽지 못했어요. 기존 데이터는 보존했어요. 사이트 저장 권한을 확인하고 현재 모습은 JSON으로 내려받아 주세요.",
            );
        });
    refresh();
    const unsubscribe = library.subscribe(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [open, library]);
  useEffect(() => {
    if (open && !selected) setName(current?.name ?? "내 캐릭터");
  }, [open, selected, current?.name]);
  async function run(operation: () => Promise<void>) {
    if (operationRef.current || busy) return;
    operationRef.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      await operation();
      setEntries(await library.list());
    } catch (e) {
      setError(
        e instanceof Error && e.message.length < 200
          ? e.message
          : "보관함 작업을 완료하지 못했어요.",
      );
    } finally {
      operationRef.current = false;
      setPending(false);
    }
  }
  const save = (replace: boolean) =>
    run(async () => {
      if (!current) return;
      const entry = await library.save(
        current,
        name,
        replace ? selected : undefined,
      );
      setSelected(entry);
      setName(entry.name);
      setNotice(
        `「${entry.name}」 저장 완료. 나중에 불러와 이어서 꾸밀 수 있어요.`,
      );
    });
  const disabled = pending || busy;
  return (
    <dialog
      ref={dialog}
      className="help-dialog library-dialog"
      aria-labelledby="library-heading"
      onCancel={onClose}
    >
      <div className="help-content">
        <button
          className="icon-button dialog-close"
          onClick={onClose}
          aria-label="보관함 닫기"
        >
          <Icon name="close" />
        </button>
        <span className="eyebrow">YOUR CHARACTER LIBRARY</span>
        <h2 id="library-heading">내 캐릭터 보관함</h2>
        <p>
          좋아하는 모습을 저장해 두고, 표정·옷·장식을 바꾸며 계속 다듬어 쓰세요.
        </p>
        <form
          className="library-save"
          onSubmit={(event) => {
            event.preventDefault();
            void save(Boolean(selected));
          }}
        >
          <label htmlFor="library-name">보관할 이름</label>
          <input
            id="library-name"
            maxLength={40}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={disabled}
          />
          <div className="library-save-actions">
            <button
              type="submit"
              className="example-apply"
              disabled={disabled || !current || !name.trim()}
            >
              {selected ? "변경 저장" : "현재 모습 저장"}
            </button>
            {selected && (
              <button
                type="button"
                disabled={disabled || !current || !name.trim()}
                onClick={() => void save(false)}
              >
                새 캐릭터로 저장
              </button>
            )}
            {current && (
              <span>현재 설정 {formatBytes(characterBytes(current))}</span>
            )}
          </div>
          {selected && (
            <small>
              ‘변경 저장’은 보관본 「{selected.name}」을 현재 모습으로
              갱신합니다.
            </small>
          )}
        </form>
        <p className="library-storage-note">
          색·비율·표정·장식 설정만 작은 JSON으로 저장합니다. PNG는 공유용
          이미지이며 편집 정보는 포함하지 않습니다.
        </p>
        {error && (
          <p className="library-error" role="alert">
            {error}
          </p>
        )}
        <p className="library-notice" role="status">
          {notice}
        </p>
        <div className="library-list-heading">
          <strong>저장한 캐릭터</strong>
          <span>
            {entries.length} / {LIBRARY_LIMIT}
          </span>
        </div>
        {entries.length === 0 && !error && (
          <p className="library-empty">
            아직 저장한 캐릭터가 없어요. 위에서 첫 모습을 보관해 보세요.
          </p>
        )}
        <ul className="library-list">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={selected?.id === entry.id ? "is-selected" : ""}
            >
              <div className="library-entry-summary">
                <span
                  className="library-swatch"
                  style={{ backgroundColor: entry.document.bodyColor }}
                  aria-hidden="true"
                >
                  <Icon name="front" size={22} />
                </span>
                <div>
                  <strong>{entry.name}</strong>
                  <small>
                    {entry.document.base.name} ·{" "}
                    {expressionLabels[entry.document.expression]} · 장식{" "}
                    {entry.document.parts.length}개 ·{" "}
                    {formatBytes(characterBytes(entry.document))}
                  </small>
                  <small>
                    {new Date(entry.updatedAt).toLocaleString("ko-KR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </small>
                </div>
              </div>
              <div className="library-entry-actions">
                <button
                  disabled={disabled}
                  onClick={() =>
                    void run(async () => {
                      if (!(await onLoad(entry.document)))
                        throw new Error(
                          "불러오지 못했어요. 현재 연결 상태를 확인해 주세요.",
                        );
                      setSelected(entry);
                      setName(entry.name);
                      onClose();
                    })
                  }
                >
                  불러오기
                </button>
                <button
                  disabled={disabled}
                  onClick={() => onExport(entry.document)}
                  aria-label={`${entry.name} JSON 다운로드`}
                >
                  JSON
                </button>
                {deleting === entry.id ? (
                  <>
                    <button
                      className="library-delete"
                      disabled={disabled}
                      onClick={() =>
                        void run(async () => {
                          await library.remove(entry.id, entry.revision);
                          if (selected?.id === entry.id) setSelected(undefined);
                          setDeleting(undefined);
                          setNotice(
                            "보관본을 삭제했어요. 편집 중인 캐릭터는 그대로예요.",
                          );
                        })
                      }
                    >
                      삭제 확인
                    </button>
                    <button
                      disabled={disabled}
                      onClick={() => setDeleting(undefined)}
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <button
                    disabled={disabled}
                    onClick={() => setDeleting(entry.id)}
                    aria-label={`${entry.name} 삭제`}
                  >
                    삭제
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="help-fineprint">
          이 사이트의 현재 브라우저에 보관합니다. 다른 기기와 자동 동기화되지
          않으며 사이트 데이터를 지우면 사라집니다. JSON을 내려받아 백업하고,
          채팅의 + 버튼으로 다시 불러오세요. 불러오기 전 모습은 되돌리기로
          복구할 수 있어요.
        </p>
      </div>
    </dialog>
  );
}
