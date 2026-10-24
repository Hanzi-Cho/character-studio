import type {
  CharacterDocument,
  CharacterPatch,
  Command,
  Snapshot,
} from "../domain/character.js";

/** No React or Three.js types cross these boundaries. */
export interface CommandInterpreter {
  interpret(
    text: string,
    document: CharacterDocument,
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
  read(): Promise<Snapshot>;
  patch(patch: CharacterPatch, revision: number): Promise<Snapshot>;
  command(
    text: string,
    revision: number,
  ): Promise<Snapshot & { message: string }>;
  subscribe(
    listener: (snapshot: Snapshot) => void,
    onConnection: (connected: boolean) => void,
  ): () => void;
}
