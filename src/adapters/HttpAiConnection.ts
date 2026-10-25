import type { AiConnection, AiStatus } from "../application/aiConnection.js";
export class HttpAiConnection implements AiConnection {
  private async request(path: string, body?: unknown) {
    const response = await fetch(
      `/api/ai/${path}`,
      body === undefined
        ? undefined
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "AI 연결을 확인해 주세요.");
    return data;
  }
  status(): Promise<AiStatus> {
    return this.request("status");
  }
  connectKey(key: string): Promise<AiStatus> {
    return this.request("key", { key });
  }
  selectModel(model: string): Promise<AiStatus> {
    return this.request("model", { model });
  }
  disconnect(): Promise<AiStatus> {
    return this.request("disconnect", {});
  }
  async signIn(clientId?: string) {
    return (await this.request("sign-in", { clientId })).url as string;
  }
}
