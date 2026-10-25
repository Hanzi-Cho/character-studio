import { z } from "zod";
import {
  applyPatch,
  CharacterImportSchema,
  DEFAULT_CHARACTER,
  type Command,
  type Snapshot,
} from "./character.js";
import { ConflictError } from "./errors.js";

/** Shared history semantics for the disk and browser persistence adapters. */
export const HistorySchema = z
  .object({
    document: CharacterImportSchema,
    revision: z.number().int().min(0),
    updatedAt: z.string(),
    past: z.array(CharacterImportSchema).max(50),
    future: z.array(CharacterImportSchema).max(50),
  })
  .strict();
export type CharacterHistory = z.infer<typeof HistorySchema>;
export function initialHistory(): CharacterHistory {
  return {
    document: structuredClone(DEFAULT_CHARACTER),
    revision: 0,
    updatedAt: new Date().toISOString(),
    past: [],
    future: [],
  };
}
export function historySnapshot(state: CharacterHistory): Snapshot {
  return structuredClone({
    document: state.document,
    revision: state.revision,
    updatedAt: state.updatedAt,
    canUndo: !!state.past.length,
    canRedo: !!state.future.length,
  });
}
export function advanceHistory(
  state: CharacterHistory,
  command: Command,
  revision: number,
): CharacterHistory {
  if (revision !== state.revision) throw new ConflictError();
  const next = structuredClone(state);
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
        ? structuredClone(DEFAULT_CHARACTER)
        : applyPatch(next.document, command.patch);
    if (JSON.stringify(document) === JSON.stringify(next.document))
      return state;
    next.past.push(next.document);
    next.past = next.past.slice(-50);
    next.future = [];
    next.document = document;
  }
  next.revision++;
  next.updatedAt = new Date().toISOString();
  return next;
}
