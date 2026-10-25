export type AiStatus = {
  mode: "none" | "api" | "chatgpt" | "codex";
  model: string;
  models: { id: string; label: string }[];
  account?: string;
  canSignIn: boolean;
};
export interface AiConnection {
  status(): Promise<AiStatus>;
  connectKey(key: string): Promise<AiStatus>;
  selectModel(model: string): Promise<AiStatus>;
  disconnect(): Promise<AiStatus>;
  signIn?(clientId?: string): Promise<string>;
}
