import type { CharacterDocument } from "../domain/character.js";

/** Measured reference interpretation, not an official character blueprint.
 * See docs/CHIIKAWA-MEASUREMENTS.md and reference-data/landmarks.json.
 * Face coordinates: u = signed horizontal distance / head width;
 * v = distance down from crown / head height. Sizes use head width.
 */
export const CHIIKAWA_RIG = {
  head: { width: 2.32, height: 1.76, top: 3.1, bottom: 1.34, depthRatio: 0.7 },
  torso: {
    bottom: 0.23,
    top: 1.34,
    width: 2.15,
    crown: 1.79,
    depth: 1.28,
    z: -0.08,
  },
  ear: {
    x: 0.69,
    y: 2.95,
    z: -0.03,
    lift: 0.125,
    width: 0.37,
    height: 0.4,
    depth: 0.34,
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
  cheek: { x: 0.3, v: 0.61, width: 0.18, height: 0.125 },
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

/** Closed cranial contour. Lower cheeks and chin follow the measured Kitan
 * face silhouette; the torso overlaps behind the chin without stretching it. */
export function cranialProfile(): [number, number][] {
  const { head } = CHIIKAWA_RIG;
  const upper = [
    [0, 1],
    [0.5, 0.95],
    [0.69, 0.9],
    [0.8, 0.85],
    [0.925, 0.75],
    [1, 0.6],
    [0.99, 0.45],
    [0.9, 0.3],
    [0.85, 0.25],
    [0.75, 0.17],
    [0.64, 0.08],
    [0.4, 0.025],
    [0.21, 0.004],
    [0, 0],
  ].map(([r, v]): [number, number] => [
    (r * head.width) / 2,
    head.top - v * head.height,
  ]);
  return upper;
}
