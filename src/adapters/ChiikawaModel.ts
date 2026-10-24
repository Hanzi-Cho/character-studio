import * as THREE from "three";
import type { CharacterDocument } from "../domain/character.js";

import {
  CHIIKAWA_RIG as RIG,
  EXPRESSION_BROWS,
  facePoint,
  bodyProfile,
} from "./chiikawaRig.js";

type Profile = readonly (readonly [radius: number, height: number])[];

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
  private readonly headProfile = this.profile(bodyProfile());
  private readonly headDepth = RIG.head.depthRatio;
  private lastDocument?: CharacterDocument;

  constructor() {
    this.root.name = "chiikawa";
    // No whole-character squash: the measured head height must survive rendering.
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
      ear.position.set(side * RIG.ear.x, RIG.ear.y, RIG.ear.z);
      ear.rotation.z = -side * THREE.MathUtils.degToRad(RIG.ear.outwardDegrees);
      this.ellipsoid(
        ear,
        [0, RIG.ear.lift, 0],
        [RIG.ear.width / 2, RIG.ear.height / 2, RIG.ear.depth / 2],
        this.earFur,
        true,
      );
      this.ears.add(ear);
      const arm = this.ellipsoid(
        this.torso,
        [side * RIG.arm.x, RIG.arm.y, RIG.arm.z],
        [RIG.arm.length / 2, RIG.arm.thickness / 2, RIG.arm.depth / 2],
        this.fur,
        true,
      );
      arm.name = side < 0 ? "left-arm" : "right-arm";
      arm.rotation.z = -side * THREE.MathUtils.degToRad(RIG.arm.downDegrees);
      const foot = this.ellipsoid(
        this.feet,
        [side * RIG.foot.x, RIG.foot.y, RIG.foot.z],
        [RIG.foot.width / 2, RIG.foot.height / 2, RIG.foot.depth / 2],
        this.fur,
        true,
      );
      foot.name = side < 0 ? "left-foot" : "right-foot";
      foot.rotation.z =
        side * THREE.MathUtils.degToRad(RIG.foot.outwardDegrees);
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
    const mesh = this.mesh(parent, geometry, material);
    mesh.castShadow = false;
    return mesh;
  }
  /** All face placement uses the documented head coordinate frame. */
  private mark(
    parent: THREE.Object3D,
    u: number,
    v: number,
    width: number,
    height: number,
    material: THREE.Material,
    offset = 0.018,
    rotation = 0,
  ) {
    const [x, y] = facePoint(u, v);
    return this.faceEllipse(
      parent,
      x,
      y,
      (width * RIG.head.width) / 2,
      (height * RIG.head.width) / 2,
      material,
      offset,
      rotation,
    );
  }
  private line(
    parent: THREE.Object3D,
    points: [number, number][],
    radius = 0.008,
    material: THREE.Material = this.ink,
    offset = 0.029,
  ) {
    return this.stroke(
      parent,
      points.map(([u, v]) => facePoint(u, v)),
      radius * RIG.head.width,
      material,
      offset,
    );
  }
  private muzzle(parent: THREE.Object3D, lift = 0) {
    const lip: [number, number][] = [
      [-0.07, 0.655 + lift],
      [-0.065, 0.68 + lift],
      [-0.044, 0.691 + lift],
      [-0.022, 0.682 + lift],
      [0, 0.655 + lift],
      [0.022, 0.682 + lift],
      [0.044, 0.691 + lift],
      [0.065, 0.68 + lift],
      [0.07, 0.655 + lift],
    ];
    this.line(
      parent,
      lip.map(([u, v]) => [
        (u * RIG.mouth.width) / 0.14,
        v + RIG.mouth.v - 0.67,
      ]),
    ).name = "muzzle";
    this.mark(
      parent,
      0,
      RIG.mouth.v - 0.02 + lift,
      0.022,
      0.016,
      this.ink,
      0.03,
    );
  }
  private eyebrows(
    parent: THREE.Object3D,
    expression: CharacterDocument["expression"],
  ) {
    const { degrees, v } = EXPRESSION_BROWS[expression];
    const rise =
      (0.08 * RIG.head.width * Math.tan(THREE.MathUtils.degToRad(degrees))) /
      RIG.head.height;
    for (const side of [-1, 1]) {
      const brow = this.line(
        parent,
        [
          [side * 0.205, v + rise / 2],
          [side * 0.165, v - 0.01],
          [side * 0.125, v - rise / 2],
        ],
        expression === "angry" ? 0.009 : 0.007,
      );
      brow.name = side < 0 ? "left-brow" : "right-brow";
    }
  }
  private buildFace() {
    for (const side of [-1, 1]) {
      const u = side * RIG.cheek.x;
      this.mark(
        this.head,
        u,
        RIG.cheek.v,
        RIG.cheek.width,
        RIG.cheek.height,
        this.blush,
        0.012,
      ).name = side < 0 ? "left-cheek" : "right-cheek";
      // Three short diagonal blush marks, as in the clear official face studies.
      for (let j = 0; j < 3; j++) {
        const x = u + (j - 1) * 0.035;
        this.line(
          this.head,
          [
            [x - 0.01, RIG.cheek.v + 0.025],
            [x + 0.009, RIG.cheek.v - 0.024],
          ],
          0.004,
          this.ink,
          0.026,
        );
      }
      const eye = new THREE.Group();
      eye.name = side < 0 ? "left-eye" : "right-eye";
      const x = side * RIG.eye.x,
        v = RIG.eye.v;
      this.mark(eye, x, v, RIG.eye.width, RIG.eye.height, this.ink);
      this.mark(
        eye,
        x - 0.006,
        v - 0.034,
        0.063,
        0.03,
        this.highlight,
        0.034,
        0.16,
      );
      this.mark(
        eye,
        x + 0.01,
        v + 0.031,
        0.047,
        0.02,
        this.highlight,
        0.034,
        0.12,
      );
      const [px, py] = facePoint(x, v);
      const pivot = new THREE.Vector3(px, py, this.faceZ(px, py, 0));
      for (const child of eye.children) child.position.sub(pivot);
      eye.position.copy(pivot);
      this.eyes.add(eye);
    }
    const gentle = new THREE.Group();
    this.eyebrows(gentle, "gentle");
    this.muzzle(gentle);
    this.line(
      gentle,
      [
        [-0.025, 0.743],
        [-0.01, 0.755],
        [0.012, 0.755],
        [0.025, 0.744],
      ],
      0.007,
    );

    const happy = new THREE.Group();
    this.eyebrows(happy, "happy");
    // Open mouth is drawn first; W-shaped lip stays legible above it.
    this.mark(happy, 0, 0.697, 0.082, 0.112, this.ink, 0.019);
    this.mark(happy, 0, 0.691, 0.046, 0.075, this.highlight, 0.034);
    this.mark(happy, 0, 0.733, 0.043, 0.023, this.blush, 0.04);
    this.muzzle(happy, -0.05);
    for (const side of [-1, 1])
      this.line(
        happy,
        [
          [side * 0.215, 0.49],
          [side * 0.16, 0.467],
          [side * 0.105, 0.49],
        ],
        0.01,
      );

    const sad = new THREE.Group();
    this.eyebrows(sad, "sad");
    this.muzzle(sad);
    for (const side of [-1, 1]) {
      this.mark(sad, side * 0.178, 0.615, 0.035, 0.088, this.tears, 0.041);
      this.mark(sad, side * 0.174, 0.598, 0.01, 0.029, this.highlight, 0.052);
    }
    this.line(
      sad,
      [
        [-0.027, 0.757],
        [0, 0.741],
        [0.027, 0.757],
      ],
      0.0075,
    );

    const angry = new THREE.Group();
    this.eyebrows(angry, "angry");
    this.muzzle(angry);
    this.line(
      angry,
      [
        [-0.028, 0.752],
        [0, 0.737],
        [0.028, 0.752],
      ],
      0.008,
    );

    const surprised = new THREE.Group();
    this.eyebrows(surprised, "surprised");
    this.mark(surprised, 0, 0.7, 0.061, 0.084, this.ink, 0.025);

    const sleepy = new THREE.Group();
    this.eyebrows(sleepy, "sleepy");
    for (const side of [-1, 1])
      this.line(
        sleepy,
        [
          [side * 0.215, 0.5],
          [side * 0.16, 0.529],
          [side * 0.105, 0.5],
        ],
        0.009,
      );
    this.mark(sleepy, 0, 0.7, 0.032, 0.043, this.ink, 0.026);

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
    bow.position.set(0, 1.12, 0.8);
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
    star.position.set(0.67, 3.17, 0.18);
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
    const headOffset = (RIG.torso.top - RIG.torso.bottom) * (torsoHeight - 1);
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
        const weight =
          1 -
          THREE.MathUtils.smoothstep(y, RIG.torso.blendStart, RIG.torso.top);
        positions.setXYZ(
          i,
          x * (1 + (next.bodyWidth - 1) * weight),
          y >= RIG.torso.top
            ? y + headOffset
            : RIG.torso.bottom + (y - RIG.torso.bottom) * torsoHeight,
          z,
        );
      }
      positions.needsUpdate = true;
      this.bodyGeometry.computeVertexNormals();
      this.bodyGeometry.computeBoundingBox();
      this.bodyGeometry.computeBoundingSphere();
    }
    this.torso.scale.set(next.bodyWidth, torsoHeight, 1);
    this.torso.position.y = RIG.torso.bottom * (1 - torsoHeight);
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
