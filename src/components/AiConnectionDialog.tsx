import { useEffect, useRef, useState } from "react";
import type { AiConnection, AiStatus } from "../application/aiConnection.js";
import { Icon } from "./Icon.js";

export function AiConnectionDialog({
  open,
  onClose,
  connection,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  connection: AiConnection;
  onChanged: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [info, setInfo] = useState<AiStatus>();
  const [key, setKey] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      void connection
        .status()
        .then(setInfo)
        .catch(() => setError("연결 상태를 읽지 못했어요."));
    } else {
      dialog.current?.close();
      setKey("");
      setConsent(false);
    }
  }, [open, connection]);
  async function run(operation: () => Promise<AiStatus>) {
    setPending(true);
    setError("");
    try {
      setInfo(await operation());
      setKey("");
      onChanged();
    } catch (error) {
      setError(
        error instanceof Error && error.message.length < 200
          ? error.message
          : "연결을 완료하지 못했어요.",
      );
    } finally {
      // A failed remote revocation can still clear the local session.
      await connection.status().then(setInfo).catch(() => {});
      onChanged();
      setPending(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="help-dialog ai-dialog"
      aria-labelledby="ai-heading"
      onCancel={onClose}
    >
      <div className="help-content">
        <button
          className="icon-button dialog-close"
          onClick={onClose}
          aria-label="AI 연결 닫기"
        >
          <Icon name="close" />
        </button>
        <span className="eyebrow">YOUR AI CONNECTION</span>
        <h2 id="ai-heading">내 AI 연결</h2>
        <p>
          채팅과 현재 캐릭터 설정, 선택한 참고 이미지를 OpenAI로 보내 편집안을
          만듭니다. 캐릭터 파일에는 키나 원본 이미지를 넣지 않습니다.
        </p>
        {info?.mode !== "none" && info && (
          <div className="ai-connected">
            <strong>
              {info.mode === "chatgpt" ? "ChatGPT 연결됨" : "OpenAI API 연결됨"}
            </strong>
            {info.account && <p>{info.account}</p>}
            <label>
              사용 모델
              <select
                value={info.model}
                disabled={pending}
                onChange={(e) =>
                  void run(() => connection.selectModel(e.target.value))
                }
              >
                {info.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={pending}
              onClick={() => void run(() => connection.disconnect())}
            >
              연결 해제
            </button>
          </div>
        )}
        <section className="ai-choice">
          <h3>ChatGPT 계정으로 연결</h3>
          {info?.canSignIn ? (
            <>
              <p>
                지원되는 ChatGPT 플랜과 앱 사용 권한이 필요합니다. 공식 로그인
                화면에서 계정을 선택하세요. 서버를 종료하면 다시 로그인해야
                합니다.
              </p>
              <button
                className="help-done"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  setError("");
                  try {
                    location.assign(await connection.signIn!());
                  } catch {
                    setError("로그인을 시작하지 못했어요.");
                    setPending(false);
                  }
                }}
              >
                Continue with ChatGPT
              </button>
              {(
                (
                  info as AiStatus & {
                    registrations?: { clientId: string; label: string }[];
                  }
                ).registrations ?? []
              ).map((r, i) => (
                <button
                  className="saved-account"
                  key={r.clientId}
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    try {
                      location.assign(await connection.signIn!(r.clientId));
                    } catch {
                      setError("계정 연결을 시작하지 못했어요.");
                      setPending(false);
                    }
                  }}
                >
                  {r.label} · 연결 {i + 1} 다시 사용
                </button>
              ))}
            </>
          ) : (
            <p>
              ChatGPT 로그인은 현재 로컬 실행에서 지원합니다.{" "}
              <a
                href="https://github.com/Hanzi-Cho/character-studio#자신의-codex로-자유롭게-채팅하기"
                target="_blank"
                rel="noreferrer"
              >
                로컬 실행 안내 ↗
              </a>{" "}
              웹에서는 아래 API 키 방식으로 연결하세요.
            </p>
          )}
          <a
            href="https://chatgpt.com/settings/usage"
            target="_blank"
            rel="noreferrer"
          >
            ChatGPT 사용량·앱 권한 관리 ↗
          </a>
        </section>
        <form
          className="ai-choice"
          onSubmit={(e) => {
            e.preventDefault();
            if (consent) void run(() => connection.connectKey(key));
          }}
        >
          <h3>내 OpenAI API 키로 연결</h3>
          <p>
            API 사용료는 본인 OpenAI 계정에 청구되며 ChatGPT 구독과 별도입니다.
            키는 실행 중인 메모리에만 보관하고, 연결을 해제하면 지웁니다.
          </p>
          <label>
            API 키
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk-…"
              maxLength={512}
            />
          </label>
          <label className="consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            AI 전송과 내 계정의 API 사용에 동의합니다.
          </label>
          <button
            className="help-done"
            disabled={pending || !consent || !key.trim()}
          >
            {pending ? "연결 확인 중…" : "API 키 연결"}
          </button>
        </form>
        <p className="help-fineprint">
          Meta 모델 연결은 공식 API 접근 권한과 호출 규격을 확인한 뒤
          추가합니다. Google 계정 로그인만으로 모델 사용 권한이 생기지는
          않습니다.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}
