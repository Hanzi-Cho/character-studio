import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type FacePoint = readonly [number, number];
export type SurfaceDepth = (x: number, y: number, offset: number) => number;

/** A filled, hand-drawn contour tessellated before projection. Large flat
 * triangles would otherwise cut through a curved cheek or eye surface. */
export function curvedPatch(
  contour: readonly FacePoint[],
  toWorld: (u: number, v: number) => [number, number],
  depth: SurfaceDepth,
  offset: number,
) {
  const curve = new THREE.CatmullRomCurve3(
    contour.map(([u, v]) => new THREE.Vector3(u, -v, 0)),
    true,
    "centripetal",
  );
  const shape = new THREE.Shape(
    curve.getPoints(56).map((p) => new THREE.Vector2(p.x, p.y)),
  );
  const flat = new THREE.ShapeGeometry(shape);
  const source = flat.index ? flat.toNonIndexed() : flat;
  const p = source.getAttribute("position");
  const positions: number[] = [];
  const push = (
    a: THREE.Vector2,
    b: THREE.Vector2,
    c: THREE.Vector2,
    level: number,
  ) => {
    if (level) {
      const ab = a.clone().add(b).multiplyScalar(0.5);
      const bc = b.clone().add(c).multiplyScalar(0.5);
      const ca = c.clone().add(a).multiplyScalar(0.5);
      push(a, ab, ca, level - 1);
      push(ab, b, bc, level - 1);
      push(ca, bc, c, level - 1);
      push(ab, bc, ca, level - 1);
      return;
    }
    for (const point of [a, b, c]) {
      const [x, y] = toWorld(point.x, -point.y);
      positions.push(x, y, depth(x, y, offset));
    }
  };
  for (let i = 0; i < p.count; i += 3) {
    push(
      new THREE.Vector2(p.getX(i), p.getY(i)),
      new THREE.Vector2(p.getX(i + 1), p.getY(i + 1)),
      new THREE.Vector2(p.getX(i + 2), p.getY(i + 2)),
      2,
    );
  }
  if (source !== flat) source.dispose();
  flat.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

/** Variable ink weight with rounded ends, one draw call per stroke. */
export function roundedStroke(
  path: THREE.Curve<THREE.Vector3>,
  radius: number,
) {
  const tube = new THREE.TubeGeometry(path, 32, radius, 8, false);
  const p = tube.getAttribute("position");
  for (let ring = 0; ring <= 32; ring++) {
    const t = ring / 32;
    const center = path.getPointAt(t);
    const weight = 0.76 + 0.24 * Math.sin(Math.PI * t);
    for (let j = 0; j <= 8; j++) {
      const i = ring * 9 + j;
      p.setXYZ(
        i,
        center.x + (p.getX(i) - center.x) * weight,
        center.y + (p.getY(i) - center.y) * weight,
        center.z + (p.getZ(i) - center.z) * weight,
      );
    }
  }
  const caps = [0, 1].map((t) => {
    const center = path.getPointAt(t);
    const cap = new THREE.SphereGeometry(radius * 0.76, 8, 6);
    cap.translate(center.x, center.y, center.z);
    return cap;
  });
  const geometry = mergeGeometries([tube, ...caps])!;
  geometry.userData.strokeEndRing = 32 * 9;
  geometry.computeVertexNormals();
  tube.dispose();
  caps.forEach((cap) => cap.dispose());
  return geometry;
}

/** Procedural pigment falloff, not a downloaded reference-image texture. */
export function blushFalloff() {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(
        ((x + 0.5) / size) * 2 - 1,
        ((y + 0.5) / size) * 2 - 1,
      );
      const alpha = Math.round(
        255 * (1 - THREE.MathUtils.smoothstep(r, 0.68, 1)),
      );
      const at = (y * size + x) * 4;
      pixels.set([alpha, alpha, alpha, 255], at);
    }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
