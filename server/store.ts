import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  copyFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type { CharacterRepository } from "../src/application/ports.js";
import { z } from "zod";
import { ConflictError } from "../src/domain/errors.js";
export { ConflictError } from "../src/domain/errors.js";
import {
  applyPatch,
  CharacterSchema,
  DEFAULT_CHARACTER,
  type CharacterDocument,
  type Snapshot,
  type Command,
} from "../src/domain/character.js";

const StoreSchema = z
  .object({
    document: CharacterSchema,
    revision: z.number().int().min(0),
    updatedAt: z.string(),
    past: z.array(CharacterSchema).max(50),
    future: z.array(CharacterSchema).max(50),
  })
  .strict();
export class CharacterStore implements CharacterRepository {
  private state: z.infer<typeof StoreSchema>;
  constructor(private path: string) {
    mkdirSync(dirname(path), { recursive: true });
    // Fail closed: never silently replace a damaged user file with defaults.
    this.state = existsSync(path)
      ? StoreSchema.parse(JSON.parse(readFileSync(path, "utf8")))
      : {
          document: { ...DEFAULT_CHARACTER },
          revision: 0,
          updatedAt: new Date().toISOString(),
          past: [],
          future: [],
        };
  }
  snapshot(): Snapshot {
    return structuredClone({
      document: this.state.document,
      revision: this.state.revision,
      updatedAt: this.state.updatedAt,
      canUndo: !!this.state.past.length,
      canRedo: !!this.state.future.length,
    });
  }
  execute(command: Command, expectedRevision: number): Snapshot {
    if (expectedRevision !== this.state.revision) throw new ConflictError();
    const next = structuredClone(this.state);
    if (command.type === "undo") {
      const previous = next.past.pop();
      if (!previous) throw new Error("되돌릴 변경이 없어요.");
      next.future.push(next.document);
      next.document = previous;
    } else if (command.type === "redo") {
      const future = next.future.pop();
      if (!future) throw new Error("다시 실행할 변경이 없어요.");
      next.past.push(next.document);
      next.document = future;
    } else {
      const document =
        command.type === "reset"
          ? { ...DEFAULT_CHARACTER }
          : applyPatch(next.document, command.patch);
      if (JSON.stringify(document) === JSON.stringify(next.document))
        return this.snapshot();
      next.past.push(next.document);
      next.past = next.past.slice(-50);
      next.future = [];
      next.document = document;
    }
    next.revision++;
    next.updatedAt = new Date().toISOString();
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, JSON.stringify(next, null, 2), "utf8");
    if (existsSync(this.path)) copyFileSync(this.path, `${this.path}.bak`);
    renameSync(temporary, this.path);
    this.state = next;
    return this.snapshot();
  }
}
