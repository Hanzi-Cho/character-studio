import {
  SnapshotSchema,
  type Snapshot,
  type CharacterPatch,
} from "../domain/character.js";
import { z } from "zod";
import type { StudioGateway } from "../application/ports.js";
async function request(url: string, body?: unknown): Promise<unknown> {
  const response = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "연결을 확인해 주세요.");
  return data;
}
export class HttpStudioGateway implements StudioGateway {
  async capabilities() {
    return z
      .object({ chatMode: z.string(), model: z.string() })
      .parse(await request("/api/capabilities"));
  }
  async read() {
    return SnapshotSchema.parse(await request("/api/state"));
  }
  async patch(patch: CharacterPatch, revision: number) {
    return SnapshotSchema.parse(
      await request("/api/patch", { patch, revision }),
    );
  }
  async command(text: string, revision: number) {
    return SnapshotSchema.extend({
      message: z.string(),
      audit: z.unknown().optional(),
    }).parse(
      await request("/api/command", {
        text,
        revision,
      }),
    );
  }
  async action(action: "undo" | "redo" | "reset", revision: number) {
    return SnapshotSchema.extend({ message: z.string() }).parse(
      await request("/api/action", { action, revision }),
    );
  }
  subscribe(
    listener: (snapshot: Snapshot) => void,
    onConnection: (connected: boolean) => void,
  ) {
    const events = new EventSource("/api/events");
    events.onmessage = (event) => {
      try {
        const snapshot = SnapshotSchema.parse(JSON.parse(event.data));
        listener(snapshot);
        onConnection(true);
      } catch {
        onConnection(false);
      }
    };
    events.onopen = () => onConnection(true);
    events.onerror = () => onConnection(false);
    return () => events.close();
  }
}
