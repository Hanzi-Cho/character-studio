import type { CharacterDocument } from "../domain/character.js";

/** Measured reference interpretation, not an official character blueprint.
 * See docs/CHIIKAWA-MEASUREMENTS.md and reference-data/landmarks.json.
 * Face coordinates: u = signed horizontal distance / head width;
 * v = distance down from crown / head height. Sizes use head width.
 */
export const CHIIKAWA_RIG = {
  head: { width: 2.32, height: 1.76, top: 3.1, bottom: 1.34, depthRatio: 0.7 },
  torso: { bottom: 0.23, top: 1.34, width: 2.15, blendStart: 1.03 },
  ear: {
    x: 0.65,
    y: 2.924,
    z: -0.03,
    lift: 0.12,
    width: 0.34,
    height: 0.4,
    depth: 0.29,
    outwardDegrees: 18,
  },
  arm: {
    x: 1.08,
    y: 1.07,
    z: 0.04,
    length: 0.44,
    thickness: 0.24,
    depth: 0.28,
    downDegrees: 35,
  },
  foot: {
    x: 0.44,
    y: 0.2,
    z: 0.13,
    width: 0.27,
    height: 0.36,
    depth: 0.32,
    outwardDegrees: 4,
  },
  eye: { x: 0.16, v: 0.51, width: 0.125, height: 0.13 },
  cheek: { x: 0.3, v: 0.61, width: 0.17, height: 0.115 },
  mouth: { width: 0.14, v: 0.67 },
} as const;

/** Positive angle means inner end is higher (sad); negative means lower (angry).
 * Angles are explicit design choices informed by the cited reference endpoints.
 */
export const EXPRESSION_BROWS: Record<
  CharacterDocument["expression"],
  { degrees: number; v: number }
> = {
  gentle: { degrees: 10, v: 0.3 },
  happy: { degrees: 8, v: 0.285 },
  sad: { degrees: 22, v: 0.3 },
  angry: { degrees: -30, v: 0.32 },
  surprised: { degrees: 0, v: 0.26 },
  sleepy: { degrees: 0, v: 0.33 },
};

export function facePoint(u: number, v: number): [number, number] {
  return [
    u * CHIIKAWA_RIG.head.width,
    CHIIKAWA_RIG.head.top - v * CHIIKAWA_RIG.head.height,
  ];
}

/** Radius/height samples, normalized so changing the rig cannot leave the
 * facial coordinate frame out of sync with its supporting surface. */
export function bodyProfile(): [number, number][] {
  const { head, torso } = CHIIKAWA_RIG;
  const lower = [
    [0, 0],
    [0.3721, 0.018],
    [0.6698, 0.1441],
    [0.893, 0.3423],
    [1, 0.6036],
    [0.986, 0.8198],
  ].map(([r, h]): [number, number] => [
    (r * torso.width) / 2,
    torso.bottom + h * (torso.top - torso.bottom),
  ]);
  const upper = [
    [0.8922, 1],
    [0.9397, 0.8807],
    [0.9871, 0.7386],
    [1, 0.5682],
    [0.9741, 0.4545],
    [0.8836, 0.3125],
    [0.6897, 0.1705],
    [0.4138, 0.0682],
    [0.2069, 0.017],
    [0, 0],
  ].map(([r, v]): [number, number] => [
    (r * head.width) / 2,
    head.top - v * head.height,
  ]);
  return [...lower, ...upper];
}
