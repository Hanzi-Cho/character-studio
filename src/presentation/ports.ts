import type { AiConnection } from "../application/aiConnection.js";
import type { ReferenceImage } from "../domain/referenceImages.js";
import type { ComponentType } from "react";
import type { CharacterRenderer, StudioGateway } from "../application/ports.js";
import type { Expression } from "../domain/character.js";

export type ChatMessage = {
  id: number;
  text: string;
  reply: string;
  error: boolean;
  audit?: unknown;
};
export type EditFeedback = { text: string; error: boolean };
export interface ChatPanelProps {
  chatMode?: string;
  storage?: "browser" | "local";
  expression?: Expression;
  busy: boolean;
  disabled: boolean;
  messages: ChatMessage[];
  feedback: EditFeedback;
  onExpression: (expression: Expression) => void;
  onSubmit: (text: string, images?: ReferenceImage[]) => Promise<boolean>;
  onImport: (file: File) => void;
  onHelp: () => void;
}
export interface StudioRuntime {
  storage: "browser" | "local";
  ai: AiConnection;
  gateway: StudioGateway;
  createRenderer: (
    host: HTMLElement,
    onError: (message: string) => void,
  ) => CharacterRenderer;
  ChatPanel: ComponentType<ChatPanelProps>;
}
