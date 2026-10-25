import { z } from "zod";
import { PartsSchema } from "./parts.js";
import {
  BaseProfileSchema,
  CHIIKAWA_BASE,
  type BaseProfile,
} from "./baseProfile.js";

export const EXPRESSIONS = [
  "gentle",
  "happy",
  "sad",
  "angry",
  "surprised",
  "sleepy",
] as const;
export type Expression = (typeof EXPRESSIONS)[number];

const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((v) => v.toLowerCase());
export const CharacterSchema = z
  .object({
    schemaVersion: z.literal(3),
    base: BaseProfileSchema,
    name: z.string().trim().min(1).max(40),
    bodyColor: color,
    cheekColor: color,
    earColor: color,
    bodyWidth: z.number().min(0.75).max(1.35),
    bodyHeight: z.number().min(0.8).max(1.3),
    earSize: z.number().min(0.6).max(1.8),
    eyeSize: z.number().min(0.65).max(1.4),
    expression: z.enum(EXPRESSIONS),
    accessory: z.enum(["none", "bow", "star"]),
    parts: PartsSchema,
  })
  .strict();
export type CharacterDocument = z.infer<typeof CharacterSchema>;
export const PatchSchema = CharacterSchema.omit({ schemaVersion: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "변경할 속성이 없습니다.");
export type CharacterPatch = z.infer<typeof PatchSchema>;
export const DEFAULT_CHARACTER: CharacterDocument = {
  schemaVersion: 3,
  base: structuredClone(CHIIKAWA_BASE),
  name: "치이카와",
  bodyColor: "#fffdf7",
  cheekColor: "#f3a5b2",
  earColor: "#fffdf7",
  bodyWidth: 1,
  bodyHeight: 1,
  earSize: 1,
  eyeSize: 1,
  expression: "gentle",
  accessory: "none",
  parts: [],
};
/** Preserve v1 documents and undo history when upgrading to composable parts. */
export const CharacterImportSchema = z.preprocess((value) => {
  if (
    value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    (value.schemaVersion === 1 || value.schemaVersion === 2)
  )
    return {
      ...value,
      schemaVersion: 3,
      base: structuredClone(CHIIKAWA_BASE),
      ...(value.schemaVersion === 1 ? { parts: [] } : {}),
    };
  return value;
}, CharacterSchema);
export function characterFromBase(input: BaseProfile): CharacterDocument {
  const base = BaseProfileSchema.parse(input);
  return CharacterSchema.parse({
    ...structuredClone(DEFAULT_CHARACTER),
    base,
    name: base.name,
    bodyColor: base.bodyColor,
    earColor: base.earColor,
    cheekColor: base.cheekColor,
    bodyWidth: base.bodyWidth,
    bodyHeight: base.bodyHeight,
    eyeSize: base.eyeSize,
  });
}
export function applyPatch(
  document: CharacterDocument,
  input: unknown,
): CharacterDocument {
  return CharacterSchema.parse({ ...document, ...PatchSchema.parse(input) });
}
export const SnapshotSchema = z.object({
  document: CharacterSchema,
  revision: z.number().int().min(0),
  canUndo: z.boolean(),
  canRedo: z.boolean(),
  updatedAt: z.string(),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type Command =
  | { type: "patch"; patch: CharacterPatch; summary: string }
  | { type: "undo"; summary: string }
  | { type: "redo"; summary: string }
  | { type: "reset"; summary: string };
