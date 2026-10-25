import type { ComponentType } from "react";
import type { CharacterRenderer, StudioGateway } from "../application/ports.js";
import type { Expression } from "../domain/character.js";

export type ChatMessage = {
  id: number;
  text: string;
  reply: string;
  error: boolean;
};
export interface ChatPanelProps {
  expression?: Expression;
  busy: boolean;
  disabled: boolean;
  messages: ChatMessage[];
  onExpression: (expression: Expression) => void;
  onSubmit: (text: string) => Promise<boolean>;
  onImport: (file: File) => void;
  onHelp: () => void;
}
export interface StudioRuntime {
  gateway: StudioGateway;
  createRenderer: (
    host: HTMLElement,
    onError: (message: string) => void,
  ) => CharacterRenderer;
  ChatPanel: ComponentType<ChatPanelProps>;
}
