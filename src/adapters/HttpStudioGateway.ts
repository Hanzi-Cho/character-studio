import type { Snapshot } from "../domain/character.js";
import type { StudioGateway } from "../application/ports.js";
export async function request<T>(url: string, body?: unknown): Promise<T> {
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
  read() {
    return request<Snapshot>("/api/state");
  }
  command(text: string, revision: number) {
    return request<Snapshot & { message: string }>("/api/command", {
      text,
      revision,
    });
  }
  subscribe(
    listener: (snapshot: Snapshot) => void,
    onConnection: (connected: boolean) => void,
  ) {
    const events = new EventSource("/api/events");
    events.onmessage = (event) => listener(JSON.parse(event.data));
    events.onopen = () => onConnection(true);
    events.onerror = () => onConnection(false);
    return () => events.close();
  }
}
