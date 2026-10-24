import { useEffect, useRef, useState } from "react";
import { ThreeCharacterRenderer } from "./adapters/ThreeCharacterRenderer.js";
import { HttpStudioGateway, request } from "./adapters/HttpStudioGateway.js";
import {
  CharacterSchema,
  type Snapshot,
  type Expression,
} from "./domain/character.js";
import type { CharacterRenderer } from "./application/ports.js";
import { Composer } from "./components/Composer.js";
import { Icon } from "./components/Icon.js";
import {
  ExpressionPicker,
  expressionLabels,
} from "./components/ExpressionPicker.js";

const gateway = new HttpStudioGateway();
type Message = { id: number; text: string; reply: string; error: boolean };
declare global {
  interface Window {
    softformDiagnostics?: () => Record<string, unknown>;
  }
}
export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const latest = useRef<Snapshot | undefined>(undefined);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [help, setHelp] = useState(false);
  const [history, setHistory] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notice, setNotice] = useState("");
  const [renderError, setRenderError] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const renderer = useRef<CharacterRenderer | undefined>(undefined);
  const dialog = useRef<HTMLDialogElement>(null);
  const accept = (value: Snapshot) => {
    if (!latest.current || value.revision >= latest.current.revision) {
      latest.current = value;
      setSnapshot(value);
    }
  };
  useEffect(() => {
    let active = true;
    gateway
      .read()
      .then((value) => {
        if (active) accept(value);
      })
      .catch(() =>
        setNotice("스튜디오에 연결하지 못했어요. 실행 창을 확인해 주세요."),
      );
    const unsubscribe = gateway.subscribe(accept, setConnected);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!stage.current) return;
    try {
      renderer.current = new ThreeCharacterRenderer(
        stage.current,
        setRenderError,
      );
      window.softformDiagnostics = () => renderer.current?.getMetrics() ?? {};
    } catch {
      setRenderError(
        "이 브라우저에서 3D 화면을 시작하지 못했어요. WebGL을 지원하는 최신 Chrome 또는 Edge에서 열어 주세요.",
      );
    }
    return () => {
      renderer.current?.dispose();
      delete window.softformDiagnostics;
    };
  }, []);
  useEffect(() => {
    if (snapshot) renderer.current?.update(snapshot.document);
  }, [snapshot]);
  useEffect(() => {
    if (help) dialog.current?.showModal();
    else dialog.current?.close();
  }, [help]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function send(text: string) {
    if (!latest.current || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await gateway.command(text, latest.current.revision);
      accept(result);
      setMessages((items) => [
        ...items.slice(-19),
        { id: Date.now(), text, reply: result.message, error: false },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "연결을 확인해 주세요.";
      setMessages((items) => [
        ...items.slice(-19),
        { id: Date.now(), text, reply: message, error: true },
      ]);
      try {
        accept(await gateway.read());
      } catch {
        setConnected(false);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const download = (href: string, name: string) => {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = name;
    anchor.click();
  };
  async function selectExpression(expression: Expression) {
    if (
      !latest.current ||
      busyRef.current ||
      latest.current.document.expression === expression
    )
      return;
    busyRef.current = true;
    setBusy(true);
    try {
      // An expression choice must never reset the user's customized character.
      accept(await gateway.patch({ expression }, latest.current.revision));
      setNotice(`${expressionLabels[expression]} 표정을 적용했어요.`);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "표정을 저장하지 못했어요.",
      );
      try {
        accept(await gateway.read());
      } catch {
        setConnected(false);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const exportCharacter = () => {
    if (!snapshot) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(snapshot.document, null, 2)], {
        type: "application/json",
      }),
    );
    download(url, "softform-character.json");
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("캐릭터 파일을 저장했어요. + 버튼으로 다시 불러올 수 있어요.");
  };
  const importCharacter = async (file: File) => {
    if (!latest.current || busyRef.current) return;
    if (file.size > 16384) {
      setNotice("16KB 이하의 캐릭터 JSON 파일을 선택해 주세요.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const { schemaVersion, ...patch } = CharacterSchema.parse(
        JSON.parse(await file.text()),
      );
      const value = await request<Snapshot>("/api/patch", {
        patch,
        revision: latest.current.revision,
      });
      accept(value);
      setNotice(
        "캐릭터를 불러왔어요. 되돌리기로 이전 모습으로 돌아갈 수 있어요.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error && error.message.length < 200
          ? error.message
          : "이 스튜디오에서 저장한 캐릭터 JSON 파일을 선택해 주세요.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const last = messages.at(-1);
  return (
    <main className="studio">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Softform Studio 홈">
          <span className="brand-symbol">
            <span />
            <span />
          </span>
          <span>
            softform<span className="brand-secondary"> / studio</span>
          </span>
        </a>
        <div className="header-actions">
          <span className={`connection ${connected ? "" : "offline"}`}>
            <i />
            {connected ? "이 기기의 작업 공간" : "연결 확인 중"}
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
          <p>작은 변화로, 나다운 캐릭터.</p>
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
            onClick={() => void send("되돌리기")}
            title="되돌리기"
            aria-label="되돌리기"
          >
            <Icon name="undo" />
          </button>
          <button
            className="icon-button"
            disabled={!snapshot?.canRedo || busy || !connected}
            onClick={() => void send("다시 실행")}
            title="다시 실행"
            aria-label="다시 실행"
          >
            <Icon name="redo" />
          </button>
          <span className="tool-divider" />
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
                download(renderer.current.capture(), "softform-character.png");
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
          <span>Chiikawa</span>
        </div>
      </section>
      <section className="chat-dock" aria-label="캐릭터 편집 채팅">
        <ExpressionPicker
          value={snapshot?.document.expression}
          disabled={!snapshot || !connected || busy}
          onSelect={(expression) => void selectExpression(expression)}
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
          disabled={!snapshot || !connected}
          onSubmit={send}
          onImport={(file) => void importCharacter(file)}
          onHelp={() => setHelp(true)}
        />
        <p className="composer-note">
          <span>로컬 편집</span>
          <span className="note-dot">·</span>색상, 크기, 표정부터 바꿔보세요.
          <span className="desktop-only"> 모든 변경은 이 PC에 저장돼요.</span>
        </p>
      </section>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      <dialog
        ref={dialog}
        className="help-dialog"
        onCancel={() => setHelp(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setHelp(false);
        }}
      >
        <div className="help-content">
          <button
            className="icon-button dialog-close"
            onClick={() => setHelp(false)}
            aria-label="도움말 닫기"
          >
            <Icon name="close" />
          </button>
          <span className="eyebrow">MAKE IT YOURS</span>
          <h2>말로 다듬는 작은 세계</h2>
          <p>
            마우스로 드래그하거나 방향키로 캐릭터를 돌려보세요. 터치 화면에서는
            한 손가락으로 회전하고 두 손가락으로 확대할 수 있어요.
          </p>
          <div className="help-examples">
            {[
              ["색상", "몸을 민트색으로, 볼을 분홍색으로"],
              ["크기", "귀를 크게 / 눈을 작게 / 몸을 통통하게"],
              ["표정", "기본 / 웃는 / 슬픈 / 화난 / 놀란 / 졸린 표정으로"],
              ["장식", "리본 달아줘 / 별 달아줘 / 장식 제거"],
              ["이름·복구", "이름을 모찌로 / 되돌리기 / 다시 실행 / 초기화"],
            ].map(([label, text]) => (
              <div key={label}>
                <strong>{label}</strong>
                <span>{text}</span>
              </div>
            ))}
          </div>
          <p className="help-limitation">
            표정 시안을 누르면 얼굴 표정만 바뀌어요. 색상·체형·장식은 유지되며
            되돌리기도 가능해요. 현재는 정해진 속성을 해석하는 로컬 편집기예요.
            외부 AI 대화·음성·이미지로 모델 생성은 아직 연결되지 않았어요.
            지원하지 않는 요청은 변경하지 않고 안내합니다.
          </p>
          <p className="help-fineprint">
            모습과 최근 50회 변경은 이 PC에 저장됩니다. 채팅 문장은 현재 탭에만
            남습니다. + 버튼은 캐릭터 JSON 불러오기입니다. 비공식 치이카와
            절차적 3D 스터디이며 원본 모델 파일을 사용하지 않습니다.
          </p>
          <button className="help-done" onClick={() => setHelp(false)}>
            만들어 볼게요 <span>↗</span>
          </button>
        </div>
      </dialog>
    </main>
  );
}
