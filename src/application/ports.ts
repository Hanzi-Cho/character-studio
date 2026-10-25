import type { ReferenceImage } from "../domain/referenceImages.js";
import type {
  CharacterDocument,
  CharacterPatch,
  Command,
  Snapshot,
} from "../domain/character.js";
import type { EditPlan } from "../domain/editPlan.js";

/** No React or Three.js types cross these boundaries. */
export interface CommandInterpreter {
  interpret(
    text: string,
    document: CharacterDocument,
    images?: ReferenceImage[],
  ): Command | Promise<Command>;
}
export interface CharacterRepository {
  snapshot(): Snapshot;
  execute(command: Command, expectedRevision: number): Snapshot;
}
export interface CharacterRenderer {
  update(document: CharacterDocument): void;
  resetView(): void;
  rotate(horizontal: number, vertical: number): void;
  capture(): string;
  getMetrics(): Record<string, unknown>;
  dispose(): void;
}
export interface StudioGateway {
  capabilities?(): Promise<{ chatMode: string; model: string }>;
  read(): Promise<Snapshot>;
  patch(patch: CharacterPatch, revision: number): Promise<Snapshot>;
  command(
    text: string,
    revision: number,
    images?: ReferenceImage[],
  ): Promise<Snapshot & { message: string; audit?: unknown }>;
  action(
    action: "undo" | "redo" | "reset",
    revision: number,
  ): Promise<Snapshot & { message: string }>;
  subscribe(
    listener: (snapshot: Snapshot) => void,
    onConnection: (connected: boolean) => void,
  ): () => void;
}

/** Transport-independent application boundary shared by HTTP and future AI tools. */
export interface CharacterApplication {
  applyPlan(plan: EditPlan, revision: number): Snapshot & { message: string };
  read(): Snapshot;
  patch(patch: CharacterPatch, revision: number): Snapshot;
  command(
    text: string,
    revision: number,
    images?: ReferenceImage[],
  ): Promise<Snapshot & { message: string }>;
  action(
    action: "undo" | "redo" | "reset",
    revision: number,
  ): Snapshot & { message: string };
  subscribe(listener: (snapshot: Snapshot) => void): () => void;
}
