import { z } from "zod";

const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((v) => v.toLowerCase());
export const CharacterSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().trim().min(1).max(40),
    bodyColor: color,
    cheekColor: color,
    earColor: color,
    bodyWidth: z.number().min(0.75).max(1.35),
    bodyHeight: z.number().min(0.8).max(1.3),
    earSize: z.number().min(0.6).max(1.8),
    eyeSize: z.number().min(0.65).max(1.4),
    expression: z.enum(["gentle", "happy", "surprised"]),
    accessory: z.enum(["none", "bow", "star"]),
  })
  .strict();
export type CharacterDocument = z.infer<typeof CharacterSchema>;
export const PatchSchema = CharacterSchema.omit({ schemaVersion: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "변경할 속성이 없습니다.");
export type CharacterPatch = z.infer<typeof PatchSchema>;
export const DEFAULT_CHARACTER: CharacterDocument = {
  schemaVersion: 1,
  name: "치이카와",
  bodyColor: "#fffdf7",
  cheekColor: "#f3a5b2",
  earColor: "#f8c1c8",
  bodyWidth: 1,
  bodyHeight: 1,
  earSize: 1,
  eyeSize: 1,
  expression: "gentle",
  accessory: "none",
};
export function applyPatch(
  document: CharacterDocument,
  input: unknown,
): CharacterDocument {
  return CharacterSchema.parse({ ...document, ...PatchSchema.parse(input) });
}
export type Snapshot = {
  document: CharacterDocument;
  revision: number;
  canUndo: boolean;
  canRedo: boolean;
  updatedAt: string;
};
export type Command =
  | { type: "patch"; patch: CharacterPatch; summary: string }
  | { type: "undo"; summary: string }
  | { type: "redo"; summary: string }
  | { type: "reset"; summary: string };
