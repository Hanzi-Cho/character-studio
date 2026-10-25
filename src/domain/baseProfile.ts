import { z } from "zod";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
/** A bounded, editable approximation, never executable generated geometry. */
export const BaseProfileSchema = z
  .object({
    id: z.enum(["chiikawa", "usagi", "custom"]),
    name: z.string().trim().min(1).max(40),
    bodyColor: color,
    earColor: color,
    cheekColor: color,
    headWidth: z.number().min(0.8).max(1.2),
    headHeight: z.number().min(0.8).max(1.2),
    earLength: z.number().min(0.5).max(3.5),
    earWidth: z.number().min(0.65).max(1.4),
    earTilt: z.number().min(-10).max(35),
    innerEar: z.boolean(),
    faceStyle: z.enum(["soft", "rabbit"]),
    bodyWidth: z.number().min(0.75).max(1.35),
    bodyHeight: z.number().min(0.8).max(1.3),
    eyeSize: z.number().min(0.65).max(1.4),
  })
  .strict();
export type BaseProfile = z.infer<typeof BaseProfileSchema>;
export const CHIIKAWA_BASE: BaseProfile = {
  id: "chiikawa",
  name: "치이카와",
  bodyColor: "#fffdf7",
  earColor: "#fffdf7",
  cheekColor: "#f3a5b2",
  headWidth: 1,
  headHeight: 1,
  earLength: 1,
  earWidth: 1,
  earTilt: 18,
  innerEar: false,
  faceStyle: "soft",
  bodyWidth: 1,
  bodyHeight: 1,
  eyeSize: 1,
};
export const USAGI_BASE: BaseProfile = {
  ...CHIIKAWA_BASE,
  id: "usagi",
  name: "우사기",
  bodyColor: "#f6e2aa",
  earColor: "#f6e2aa",
  headWidth: 0.98,
  headHeight: 1.02,
  earLength: 3.15,
  earWidth: 0.88,
  earTilt: 8,
  innerEar: true,
  faceStyle: "rabbit",
  eyeSize: 0.91,
};
export const BASE_CATALOG = [CHIIKAWA_BASE, USAGI_BASE] as const;
