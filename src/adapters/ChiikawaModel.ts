import * as THREE from "three";
import type { CharacterDocument } from "../domain/character.js";

type Profile = readonly (readonly [radius: number, height: number])[];
const FACE_DROP = 0.16;

/** Reference-driven proportions. One continuous head/torso silhouette;
 * face markings are curved meshes on the head surface, not a front-facing image.
 * User references supplied 2026-10-24; see docs/CHARACTER-MODELING.md.
 */
export class ChiikawaModel {
  readonly root = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly feet = new THREE.Group();
  private readonly ears = new THREE.Group();
  private readonly eyes = new THREE.Group();
  private readonly expressions = new Map<string, THREE.Group>();
  private readonly accessories = new Map<string, THREE.Group>();
  private readonly sphere = new THREE.SphereGeometry(1, 36, 24);
  private readonly geometries = new Set<THREE.BufferGeometry>([this.sphere]);
  private readonly materials = new Set<THREE.Material>();
  private readonly fur = this.surfaceMaterial("#fffdf7");
  private readonly earFur = this.surfaceMaterial("#fffdf7");
  private readonly blush = this.inkMaterial("#f3a5b2");
  private readonly ink = this.inkMaterial("#393833");
  private readonly highlight = this.inkMaterial("#fffef9");
  private readonly ribbon = this.surfaceMaterial("#e9a5b5");
  private readonly silhouette = this.inkMaterial("#69645e", THREE.BackSide);
  private readonly tears = this.inkMaterial("#9bcbdc");
  private bodyGeometry!: THREE.BufferGeometry;
  private bodyBase!: Float32Array;
  private readonly headProfile = this.profile([
    [0, 0.23],
    [0.4, 0.25],
    [0.72, 0.4],
    [0.92, 0.65],
    [1.035, 0.94],
    [1.065, 1.25],
    [1.07, 1.5],
    [1.12, 1.74],
    [1.16, 1.96],
    [1.145, 2.2],
    [1.055, 2.43],
    [0.89, 2.63],
    [0.65, 2.78],
    [0.36, 2.88],
    [0, 2.92],
  ]);
  private readonly headDepth = 0.63;
  private lastDocument?: CharacterDocument;

  constructor() {
    this.root.name = "chiikawa";
    this.root.scale.y = 0.86;
    this.head.name = "head";
    this.torso.name = "torso";
    this.feet.name = "feet";
    this.ears.name = "ears";
    this.eyes.name = "eyes";
    this.root.add(this.torso, this.feet, this.head);
    this.buildVolumes();
    this.buildFace();
    this.buildAccessories();
  }

  private surfaceMaterial(color: string) {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.87,
      metalness: 0,
    });
    this.materials.add(material);
    return material;
  }
  private inkMaterial(color: string, side: THREE.Side = THREE.FrontSide) {
    const material = new THREE.MeshBasicMaterial({
      color,
      side,
      toneMapped: false,
    });
    this.materials.add(material);
    return material;
  }
  private profile(points: Profile) {
    return new THREE.SplineCurve(
      points.map(([r, y]) => new THREE.Vector2(r, y)),
    )
      .getPoints(96)
      .map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  }
  private mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    outline = false,
  ) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    parent.add(mesh);
    if (outline) {
      const edge = new THREE.Mesh(geometry, this.silhouette);
      edge.scale.setScalar(1.004);
      mesh.add(edge);
    }
    return mesh;
  }
  private ellipsoid(
    parent: THREE.Object3D,
    position: [number, number, number],
    scale: [number, number, number],
    material: THREE.Material,
    outline = false,
  ) {
    const mesh = this.mesh(parent, this.sphere, material, outline);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    return mesh;
  }
  private buildVolumes() {
    // A single surface avoids a pinched neck, overlapping shells and a chin seam.
    // Keep the same GPU buffer when changing the lower body's proportions.
    this.bodyGeometry = new THREE.LatheGeometry(this.headProfile, 64);
    this.bodyGeometry.scale(1, 1, this.headDepth);
    this.geometries.add(this.bodyGeometry);
    this.bodyBase = new Float32Array(
      this.bodyGeometry.getAttribute("position").array,
    );
    const body = this.mesh(this.root, this.bodyGeometry, this.fur, true);
    body.name = "body-volume";
    body.receiveShadow = true;
    this.head.add(this.ears, this.eyes);
    for (const side of [-1, 1]) {
      // Short, white rounded ears grow from a buried pivot on the head.
      const ear = new THREE.Group();
      ear.name = side < 0 ? "left-ear" : "right-ear";
      ear.position.set(side * 0.6, 2.76, -0.005);
      ear.rotation.z = -side * 0.14;
      this.ellipsoid(
        ear,
        [0, 0.13, 0],
        [0.145, 0.195, 0.13],
        this.earFur,
        true,
      );
      this.ears.add(ear);
      const arm = this.ellipsoid(
        this.torso,
        [side * 1.075, 1.12, 0.035],
        [0.18, 0.115, 0.135],
        this.fur,
        true,
      );
      arm.name = side < 0 ? "left-arm" : "right-arm";
      arm.rotation.z = -side * 0.6;
      const foot = this.ellipsoid(
        this.feet,
        [side * 0.48, 0.2, 0.09],
        [0.12, 0.18, 0.14],
        this.fur,
        true,
      );
      foot.name = side < 0 ? "left-foot" : "right-foot";
      foot.rotation.z = side * 0.06;
    }
  }

  private faceZ(x: number, y: number, offset = 0.016) {
    const profile = this.headProfile;
    let radius = profile[0].x;
    for (let i = 1; i < profile.length; i++) {
      if (y <= profile[i].y) {
        const previous = profile[i - 1],
          next = profile[i];
        const t = THREE.MathUtils.clamp(
          (y - previous.y) / (next.y - previous.y),
          0,
          1,
        );
        radius = THREE.MathUtils.lerp(previous.x, next.x, t);
        break;
      }
    }
    return (
      this.headDepth * Math.sqrt(Math.max(0, radius * radius - x * x)) + offset
    );
  }

  /** Curved disk with a shallow relief: cheeks and eyes stay on the head in side view. */
  private faceEllipse(
    parent: THREE.Object3D,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    material: THREE.Material,
    offset = 0.014,
    rotation = 0,
  ) {
    cy -= FACE_DROP;
    const positions: number[] = [],
      indices: number[] = [];
    const rings = 6,
      segments = 48;
    const originZ = this.faceZ(cx, cy, 0);
    for (let ring = 0; ring <= rings; ring++) {
      const radius = ring / rings;
      for (let segment = 0; segment <= segments; segment++) {
        const a = (segment / segments) * Math.PI * 2;
        const x = Math.cos(a) * rx * radius,
          y = Math.sin(a) * ry * radius;
        const dx = x * Math.cos(rotation) - y * Math.sin(rotation),
          dy = x * Math.sin(rotation) + y * Math.cos(rotation);
        positions.push(
          dx,
          dy,
          this.faceZ(cx + dx, cy + dy, offset + 0.006 * (1 - radius * radius)) -
            originZ,
        );
        if (ring < rings && segment < segments) {
          const a = ring * (segments + 1) + segment,
            b = a + segments + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    this.geometries.add(geometry);
    const mesh = this.mesh(parent, geometry, material);
    mesh.castShadow = false;
    mesh.position.set(cx, cy, originZ);
    return mesh;
  }
  private stroke(
    parent: THREE.Object3D,
    points: [number, number][],
    radius = 0.018,
    material: THREE.Material = this.ink,
    offset = 0.029,
  ) {
    const spline = new THREE.SplineCurve(
      points.map(([x, y]) => new THREE.Vector2(x, y - FACE_DROP)),
    );
    const project = (x: number, y: number) => this.faceZ(x, y, offset);
    class SurfaceCurve extends THREE.Curve<THREE.Vector3> {
      constructor() {
        super();
      }
      getPoint(t: number, target = new THREE.Vector3()) {
        const p = spline.getPoint(t);
        return target.set(p.x, p.y, project(p.x, p.y));
      }
    }
    const geometry = new THREE.TubeGeometry(
      new SurfaceCurve(),
      32,
      radius,
      8,
      false,
    );
    this.geometries.add(geometry);
    this.mesh(parent, geometry, material).castShadow = false;
  }
  private muzzle(parent: THREE.Object3D) {
    this.stroke(
      parent,
      [
        [-0.135, 2.145],
        [-0.132, 2.092],
        [-0.09, 2.066],
        [-0.044, 2.083],
        [0, 2.132],
        [0.044, 2.083],
        [0.09, 2.066],
        [0.132, 2.092],
        [0.135, 2.145],
      ],
      0.019,
    );
    this.faceEllipse(parent, 0, 2.172, 0.023, 0.017, this.ink, 0.028);
  }
  private eyebrows(parent: THREE.Object3D, lift = 0) {
    for (const side of [-1, 1])
      this.stroke(
        parent,
        [
          [side * 0.44, 2.53 + lift],
          [side * 0.385, 2.548 + lift],
          [side * 0.32, 2.549 + lift],
          [side * 0.275, 2.539 + lift],
        ],
        0.015,
      );
  }
  private buildFace() {
    for (const side of [-1, 1]) {
      const cheekX = side * 0.69;
      this.faceEllipse(this.head, cheekX, 2.1, 0.205, 0.12, this.blush, 0.012);
      for (let j = 0; j < 4; j++) {
        const x = cheekX + (j - 1.5) * 0.065;
        this.stroke(
          this.head,
          [
            [x - 0.029, 2.045],
            [x + 0.027, 2.155],
          ],
          0.0075,
          this.ink,
          0.026,
        );
      }
      const eye = new THREE.Group();
      eye.name = side < 0 ? "left-eye" : "right-eye";
      const x = side * 0.35,
        y = 2.295;
      this.faceEllipse(eye, x, y, 0.137, 0.151, this.ink, 0.018);
      this.faceEllipse(
        eye,
        x - 0.014,
        y + 0.061,
        0.073,
        0.03,
        this.highlight,
        0.034,
        0.18,
      );
      this.faceEllipse(
        eye,
        x + 0.022,
        y - 0.054,
        0.058,
        0.028,
        this.highlight,
        0.034,
        0.18,
      );
      // Local pivot keeps eye-size edits centered rather than shifting facial spacing.
      const pivot = new THREE.Vector3(
        x,
        y - FACE_DROP,
        this.faceZ(x, y - FACE_DROP, 0),
      );
      for (const child of eye.children) child.position.sub(pivot);
      eye.position.copy(pivot);
      this.eyes.add(eye);
    }
    const gentle = new THREE.Group();
    this.eyebrows(gentle);
    this.muzzle(gentle);
    this.stroke(
      gentle,
      [
        [-0.051, 2.025],
        [-0.031, 1.985],
        [0.015, 1.981],
        [0.05, 2.012],
      ],
      0.017,
    );
    const happy = new THREE.Group();
    this.eyebrows(happy, 0.025);
    this.muzzle(happy);
    this.faceEllipse(happy, 0, 1.995, 0.066, 0.078, this.ink, 0.022);
    this.faceEllipse(happy, 0.003, 1.967, 0.043, 0.029, this.blush, 0.036);
    for (const side of [-1, 1])
      this.stroke(
        happy,
        [
          [side * 0.465, 2.275],
          [side * 0.35, 2.345],
          [side * 0.235, 2.275],
        ],
        0.025,
      );
    const surprised = new THREE.Group();
    this.eyebrows(surprised, 0.045);
    this.faceEllipse(surprised, 0, 2.07, 0.061, 0.086, this.ink, 0.023);
    const sad = new THREE.Group();
    const angry = new THREE.Group();
    const sleepy = new THREE.Group();
    for (const side of [-1, 1]) {
      this.stroke(
        sad,
        [
          [side * 0.48, 2.51],
          [side * 0.37, 2.54],
          [side * 0.26, 2.59],
        ],
        0.018,
      );
      this.faceEllipse(sad, side * 0.41, 2.1, 0.045, 0.1, this.tears, 0.041);
      this.faceEllipse(
        sad,
        side * 0.42,
        2.13,
        0.012,
        0.036,
        this.highlight,
        0.05,
      );
      // Brows descend towards the nose; the face outline and eye spacing stay fixed.
      this.stroke(
        angry,
        [
          [side * 0.49, 2.54],
          [side * 0.37, 2.5],
          [side * 0.24, 2.44],
        ],
        0.024,
      );
      this.stroke(
        sleepy,
        [
          [side * 0.47, 2.3],
          [side * 0.35, 2.26],
          [side * 0.23, 2.3],
        ],
        0.022,
      );
    }
    this.stroke(
      sad,
      [
        [-0.07, 2.01],
        [0, 2.05],
        [0.07, 2.01],
      ],
      0.019,
    );
    this.stroke(
      angry,
      [
        [-0.075, 2.02],
        [0, 2.055],
        [0.075, 2.02],
      ],
      0.021,
    );
    this.eyebrows(sleepy, -0.025);
    this.faceEllipse(sleepy, 0, 2.07, 0.032, 0.043, this.ink, 0.026);
    for (const [name, group] of [
      ["gentle", gentle],
      ["happy", happy],
      ["sad", sad],
      ["angry", angry],
      ["surprised", surprised],
      ["sleepy", sleepy],
    ] as const) {
      group.name = name + "-expression";
      group.visible = name === "gentle";
      this.expressions.set(name, group);
      this.head.add(group);
    }
  }
  private buildAccessories() {
    const bow = new THREE.Group();
    bow.name = "bow";
    bow.position.set(0, 1.28, 0.69);
    for (const side of [-1, 1]) {
      const wing = this.ellipsoid(
        bow,
        [side * 0.12, 0, 0],
        [0.14, 0.105, 0.055],
        this.ribbon,
        true,
      );
      wing.rotation.z = side * 0.3;
    }
    this.ellipsoid(bow, [0, 0, 0.035], [0.054, 0.06, 0.05], this.ribbon);
    this.torso.add(bow);
    this.accessories.set("bow", bow);
    bow.visible = false;
    const star = new THREE.Group();
    star.name = "star";
    star.position.set(0.61, 2.94, 0.16);
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5,
        r = i % 2 === 0 ? 0.13 : 0.062;
      const x = Math.cos(a) * r,
        y = Math.sin(a) * r;
      i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.03,
      bevelEnabled: true,
      bevelThickness: 0.007,
      bevelSize: 0.007,
      bevelSegments: 2,
      steps: 1,
    });
    this.geometries.add(geometry);
    this.mesh(star, geometry, this.surfaceMaterial("#efcb77"));
    this.head.add(star);
    this.accessories.set("star", star);
    star.visible = false;
  }
  update(next: CharacterDocument) {
    if (JSON.stringify(next) === JSON.stringify(this.lastDocument))
      return false;
    this.fur.color.set(next.bodyColor);
    this.earFur.color.set(next.earColor);
    this.blush.color.set(next.cheekColor);
    const torsoHeight = next.bodyHeight;
    const headOffset = 1.37 * (torsoHeight - 1);
    if (
      !this.lastDocument ||
      next.bodyWidth !== this.lastDocument.bodyWidth ||
      next.bodyHeight !== this.lastDocument.bodyHeight
    ) {
      const positions = this.bodyGeometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        const x = this.bodyBase[i * 3],
          y = this.bodyBase[i * 3 + 1],
          z = this.bodyBase[i * 3 + 2];
        const weight = 1 - THREE.MathUtils.smoothstep(y, 1.25, 1.82);
        positions.setXYZ(
          i,
          x * (1 + (next.bodyWidth - 1) * weight),
          y >= 1.6 ? y + headOffset : 0.23 + (y - 0.23) * torsoHeight,
          z,
        );
      }
      positions.needsUpdate = true;
      this.bodyGeometry.computeVertexNormals();
      this.bodyGeometry.computeBoundingBox();
      this.bodyGeometry.computeBoundingSphere();
    }
    this.torso.scale.set(next.bodyWidth, torsoHeight, 1);
    this.torso.position.y = 0.23 * (1 - torsoHeight);
    this.head.position.y = headOffset;
    this.feet.scale.x = next.bodyWidth;
    for (const ear of this.ears.children) ear.scale.setScalar(next.earSize);
    for (const eye of this.eyes.children) eye.scale.setScalar(next.eyeSize);
    this.eyes.visible =
      next.expression !== "happy" && next.expression !== "sleepy";
    for (const [name, group] of this.expressions)
      group.visible = name === next.expression;
    for (const [name, group] of this.accessories)
      group.visible = name === next.accessory;
    this.lastDocument = { ...next };
    return true;
  }
  getGeometryIds() {
    return [...this.geometries].map((geometry) => geometry.id);
  }
  dispose() {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
