import { z } from "zod";
import {
  CharacterImportSchema,
  type CharacterDocument,
} from "../domain/character.js";

export const LIBRARY_LIMIT = 50;
export const LibraryNameSchema = z.string().trim().min(1).max(40);
export const LibraryEntrySchema = z
  .object({
    id: z.string().uuid(),
    name: LibraryNameSchema,
    revision: z.number().int().min(1),
    updatedAt: z.string().datetime(),
    document: CharacterImportSchema,
  })
  .strict();
export const LibrarySchema = z
  .object({
    version: z.literal(1),
    entries: z.array(LibraryEntrySchema).max(LIBRARY_LIMIT),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.entries.map((entry) => entry.id)).size ===
      value.entries.length,
  );
export type LibraryEntry = z.infer<typeof LibraryEntrySchema>;

/** Portable settings only; no meshes, screenshots, input images, chat or AI credentials. */
export function characterJson(document: CharacterDocument) {
  return JSON.stringify(CharacterImportSchema.parse(document));
}
export function characterBytes(document: CharacterDocument) {
  return new TextEncoder().encode(characterJson(document)).byteLength;
}
export function formatBytes(bytes: number) {
  return bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} KB`;
}
export interface CharacterLibrary {
  list(): Promise<LibraryEntry[]>;
  save(
    document: CharacterDocument,
    name: string,
    previous?: Pick<LibraryEntry, "id" | "revision">,
  ): Promise<LibraryEntry>;
  remove(id: string, revision: number): Promise<void>;
  subscribe(listener: () => void): () => void;
}
