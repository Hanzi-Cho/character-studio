import type { ReferenceImage } from "../domain/referenceImages.js";
import { useEffect, useRef, useState } from "react";
import type { StudioGateway } from "../application/ports.js";
import {
  CharacterImportSchema,
  type CharacterPatch,
  type Snapshot,
} from "../domain/character.js";
import type { ChatMessage, EditFeedback } from "./ports.js";

/** View state and recovery only: no HTTP, renderer, or interpreter implementation. */
export function useStudio(gateway: StudioGateway) {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const latest = useRef<Snapshot | undefined>(undefined);
  const [connected, setConnected] = useState(false);
  const [chatMode, setChatMode] = useState("local");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messageId = useRef(0);
  const [feedback, setFeedback] = useState<EditFeedback>({
    text: "예문이나 표정을 골라 캐릭터를 바꿔보세요.",
    error: false,
  });
  const showFeedback = (text: string, error = false) =>
    setFeedback({ text, error });
  const accept = (value: Snapshot) => {
    if (!latest.current || value.revision >= latest.current.revision) {
      latest.current = value;
      setSnapshot(value);
    }
  };
  useEffect(() => {
    let active = true;
    const receive = (value: Snapshot) => {
      if (active) accept(value);
    };
    latest.current = undefined;
    setSnapshot(undefined);
    setConnected(false);
    gateway
      .capabilities?.()
      .then((info) => {
        if (active) setChatMode(info.chatMode);
      })
      .catch(() => {});
    gateway
      .read()
      .then(receive)
      .catch((error: unknown) => {
        if (active)
          showFeedback(
            error instanceof Error && error.message.length < 200
              ? error.message
              : "스튜디오에 연결하지 못했어요. 실행 창을 확인해 주세요.",
            true,
          );
      });
    const unsubscribe = gateway.subscribe(receive, (value) => {
      if (active) setConnected(value);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [gateway]);
  async function mutate(
    operation: (revision: number) => Promise<Snapshot>,
    onError?: (message: string) => void,
  ) {
    if (!latest.current || busyRef.current) return false;
    const revision = latest.current.revision;
    busyRef.current = true;
    setBusy(true);
    try {
      accept(await operation(revision));
      return true;
    } catch (error) {
      const message =
        error instanceof Error && error.message.length < 200
          ? error.message
          : "요청 형식이나 연결을 확인해 주세요.";
      showFeedback(message, true);
      onError?.(message);
      try {
        accept(await gateway.read());
      } catch {
        setConnected(false);
      }
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const append = (
    text: string,
    reply: string,
    error: boolean,
    audit?: unknown,
  ) => {
    showFeedback(reply, error);
    const id = ++messageId.current;
    setMessages((items) => [
      ...items.slice(-19),
      { id, text, reply, error, audit },
    ]);
  };
  const send = (text: string, images: ReferenceImage[] = []) =>
    mutate(
      async (revision) => {
        const result = await gateway.command(text, revision, images);
        append(text, result.message, false, result.audit);
        return result;
      },
      (message) => append(text, message, true),
    );
  const patch = (value: CharacterPatch, message?: string) =>
    mutate(async (revision) => {
      const result = await gateway.patch(value, revision);
      if (message) showFeedback(message);
      return result;
    });
  const action = (value: "undo" | "redo" | "reset") =>
    mutate(async (revision) => {
      const result = await gateway.action(value, revision);
      showFeedback(result.message);
      return result;
    });
  const importCharacter = (file: File) => {
    if (file.size > 131072) {
      showFeedback("128KB 이하의 캐릭터 JSON 파일을 선택해 주세요.", true);
      return Promise.resolve(false);
    }
    // Capture revision before reading the file; a concurrent edit must conflict.
    return mutate(async (revision) => {
      const { schemaVersion, ...value } = CharacterImportSchema.parse(
        JSON.parse(await file.text()),
      );
      const result = await gateway.patch(value, revision);
      showFeedback(
        "캐릭터를 불러왔어요. 되돌리기로 이전 모습으로 돌아갈 수 있어요.",
      );
      return result;
    });
  };
  return {
    snapshot,
    refreshCapabilities: async () => {
      const info = await gateway.capabilities?.();
      if (info) setChatMode(info.chatMode);
    },
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
  };
}
