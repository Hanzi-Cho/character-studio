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
import type { Command } from "../src/domain/character.js";
import {
  advanceHistory,
  HistorySchema,
  historySnapshot,
  initialHistory,
  type CharacterHistory,
} from "../src/domain/characterHistory.js";
export { ConflictError } from "../src/domain/errors.js";

export class CharacterStore implements CharacterRepository {
  private state: CharacterHistory;
  constructor(private path: string) {
    mkdirSync(dirname(path), { recursive: true });
    // Fail closed: never silently replace a damaged user file with defaults.
    this.state = existsSync(path)
      ? HistorySchema.parse(JSON.parse(readFileSync(path, "utf8")))
      : initialHistory();
  }
  snapshot() {
    return historySnapshot(this.state);
  }
  execute(command: Command, expectedRevision: number) {
    const next = advanceHistory(this.state, command, expectedRevision);
    if (next === this.state) return this.snapshot();
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, JSON.stringify(next, null, 2), "utf8");
    if (existsSync(this.path)) copyFileSync(this.path, `${this.path}.bak`);
    renameSync(temporary, this.path);
    this.state = next;
    return this.snapshot();
  }
}
