import * as THREE from "three";
import type { CharacterDocument } from "../domain/character.js";

type Profile = readonly (readonly [radius: number, height: number])[];

/** Reference-driven proportions. Head and torso are separate rounded volumes;
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
  private readonly headProfile = this.profile([
    [0, 1.38],
    [0.39, 1.39],
    [0.69, 1.44],
    [0.93, 1.55],
    [1.09, 1.73],
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
    this.head.name = "head";
    this.head.scale.x = 0.98;
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
  private lathe(
    parent: THREE.Object3D,
    points: THREE.Vector2[],
    depth: number,
  ) {
    const geometry = new THREE.LatheGeometry(points, 64);
    // Bake depth and center silhouette inflation at the volume center, not world zero.
    geometry.scale(1, 1, depth);
    geometry.computeBoundingBox();
    const centerY =
      (geometry.boundingBox!.max.y + geometry.boundingBox!.min.y) / 2;
    geometry.translate(0, -centerY, 0);
    this.geometries.add(geometry);
    const mesh = this.mesh(parent, geometry, this.fur, true);
    mesh.position.y = centerY;
    mesh.receiveShadow = true;
    return mesh;
  }
  private buildVolumes() {
    this.lathe(this.head, this.headProfile, this.headDepth).name =
      "head-volume";
    this.lathe(
      this.torso,
      this.profile([
        [0, 0.23],
        [0.24, 0.25],
        [0.43, 0.34],
        [0.57, 0.5],
        [0.65, 0.71],
        [0.69, 0.96],
        [0.68, 1.19],
        [0.6, 1.39],
        [0.44, 1.48],
        [0, 1.5],
      ]),
      0.69,
    ).name = "torso-volume";
    this.torso.getObjectByName("torso-volume")!.scale.x = 1.08;
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
        [side * 0.8, 1.16, 0.015],
        [0.255, 0.105, 0.115],
        this.fur,
        true,
      );
      arm.name = side < 0 ? "left-arm" : "right-arm";
      arm.rotation.z = -side * 0.35;
      const foot = this.ellipsoid(
        this.feet,
        [side * 0.29, 0.2, 0.035],
        [0.082, 0.18, 0.105],
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
      points.map(([x, y]) => new THREE.Vector2(x, y)),
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
      const pivot = new THREE.Vector3(x, y, this.faceZ(x, y, 0));
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
    for (const [name, group] of [
      ["gentle", gentle],
      ["happy", happy],
      ["surprised", surprised],
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
    bow.position.set(0, 1.28, 0.42);
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
    const torsoHeight = 0.87 * next.bodyHeight;
    this.torso.scale.set(next.bodyWidth, torsoHeight, 1);
    this.torso.position.y = 0.23 * (1 - torsoHeight);
    this.head.position.y = 1.2 * (torsoHeight - 1);
    this.feet.scale.x = next.bodyWidth;
    for (const ear of this.ears.children) ear.scale.setScalar(next.earSize);
    for (const eye of this.eyes.children) eye.scale.setScalar(next.eyeSize);
    this.eyes.visible = next.expression !== "happy";
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
