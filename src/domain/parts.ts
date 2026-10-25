import { z } from "zod";

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const vector = (min: number, max: number) =>
  z.tuple([
    z.number().min(min).max(max),
    z.number().min(min).max(max),
    z.number().min(min).max(max),
  ]);
export const PrimitiveSchema = z
  .object({
    shape: z.enum([
      "sphere",
      "box",
      "cylinder",
      "cone",
      "torus",
      "capsule",
      "star",
    ]),
    color: hexColor,
    position: vector(-3, 3),
    rotation: vector(-180, 180),
    scale: vector(0.02, 3),
  })
  .strict();
export const PartSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/),
    label: z.string().min(1).max(50),
    kind: z.enum([
      "wings",
      "shirt",
      "cape",
      "hat",
      "crown",
      "glasses",
      "scarf",
      "bow",
      "star",
      "custom",
    ]),
    anchor: z.enum([
      "head",
      "face",
      "neck",
      "body",
      "back",
      "leftEar",
      "rightEar",
    ]),
    color: hexColor,
    accentColor: hexColor,
    position: vector(-2, 2),
    rotation: vector(-180, 180),
    scale: vector(0.1, 2),
    components: z.array(PrimitiveSchema).max(32),
  })
  .strict();
export const PartsSchema = z
  .array(PartSchema)
  .max(12)
  .superRefine((parts, ctx) => {
    if (new Set(parts.map((p) => p.id)).size !== parts.length)
      ctx.addIssue({ code: "custom", message: "장식 ID가 중복됩니다." });
    if (parts.reduce((n, p) => n + p.components.length, 0) > 128)
      ctx.addIssue({
        code: "custom",
        message: "장식의 세부 도형이 너무 많습니다.",
      });
    for (const p of parts)
      if (p.kind === "custom" && !p.components.length)
        ctx.addIssue({
          code: "custom",
          message: "새 장식에는 도형이 필요합니다.",
        });
  });
export type CharacterPart = z.infer<typeof PartSchema>;
export type Primitive = z.infer<typeof PrimitiveSchema>;
