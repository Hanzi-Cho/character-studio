import { useEffect, useRef, useState } from "react";
import type { StudioGateway } from "../application/ports.js";
import {
  CharacterSchema,
  type CharacterPatch,
  type Snapshot,
} from "../domain/character.js";
import type { ChatMessage } from "./ports.js";

/** View state and recovery only: no HTTP, renderer, or interpreter implementation. */
export function useStudio(gateway: StudioGateway) {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const latest = useRef<Snapshot | undefined>(undefined);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messageId = useRef(0);
  const [notice, setNotice] = useState("");
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
      .read()
      .then(receive)
      .catch(() => {
        if (active)
          setNotice("스튜디오에 연결하지 못했어요. 실행 창을 확인해 주세요.");
      });
    const unsubscribe = gateway.subscribe(receive, (value) => {
      if (active) setConnected(value);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [gateway]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

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
      (onError ?? setNotice)(message);
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
  const append = (text: string, reply: string, error: boolean) => {
    const id = ++messageId.current;
    setMessages((items) => [...items.slice(-19), { id, text, reply, error }]);
  };
  const send = (text: string) =>
    mutate(
      async (revision) => {
        const result = await gateway.command(text, revision);
        append(text, result.message, false);
        return result;
      },
      (message) => append(text, message, true),
    );
  const patch = (value: CharacterPatch, message?: string) =>
    mutate(async (revision) => {
      const result = await gateway.patch(value, revision);
      if (message) setNotice(message);
      return result;
    });
  const action = (value: "undo" | "redo" | "reset") =>
    mutate(async (revision) => {
      const result = await gateway.action(value, revision);
      setNotice(result.message);
      return result;
    });
  const importCharacter = (file: File) => {
    if (file.size > 16384) {
      setNotice("16KB 이하의 캐릭터 JSON 파일을 선택해 주세요.");
      return Promise.resolve(false);
    }
    // Capture revision before reading the file; a concurrent edit must conflict.
    return mutate(async (revision) => {
      const { schemaVersion, ...value } = CharacterSchema.parse(
        JSON.parse(await file.text()),
      );
      const result = await gateway.patch(value, revision);
      setNotice(
        "캐릭터를 불러왔어요. 되돌리기로 이전 모습으로 돌아갈 수 있어요.",
      );
      return result;
    });
  };
  return {
    snapshot,
    connected,
    busy,
    messages,
    notice,
    setNotice,
    send,
    patch,
    action,
    importCharacter,
  };
}
