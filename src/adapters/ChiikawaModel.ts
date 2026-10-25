import * as THREE from "three";
import { CharacterParts } from "./CharacterParts.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { CharacterDocument } from "../domain/character.js";
import {
  curvedPatch,
  roundedStroke,
  blushFalloff,
  type FacePoint,
} from "./faceGeometry.js";

import {
  CHIIKAWA_RIG as RIG,
  EXPRESSION_BROWS,
  facePoint,
  cranialProfile,
} from "./chiikawaRig.js";

type Profile = readonly (readonly [radius: number, height: number])[];

/** Reference-driven proportions. A rounded cranium over an inset torso;
 * face markings are curved meshes on the head surface, not a front-facing image.
 * User references supplied 2026-10-24; see docs/CHARACTER-MODELING.md.
 */
export class ChiikawaModel {
  private readonly parts = new CharacterParts();
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
  private readonly eyeBases = new Map<THREE.BufferGeometry, Float32Array>();
  private readonly materials = new Set<THREE.Material>();
  private readonly fur = this.surfaceMaterial("#fffdf7");
  private readonly earFur = this.surfaceMaterial("#fffdf7");
  private readonly ink = this.inkMaterial("#252825");
  private readonly highlight = this.inkMaterial("#fffef9");
  private readonly ribbon = this.surfaceMaterial("#e9a5b5");
  private readonly silhouette = this.inkMaterial("#69645e", THREE.BackSide);
  private readonly tears = this.inkMaterial("#9bcbdc");
  private readonly blushTexture = blushFalloff();
  private readonly cheekPigment = this.inkMaterial("#f3a5b2");
  private bodyGeometry!: THREE.BufferGeometry;
  private bodyBase!: Float32Array;
  private cranialVertexCount = 0;
  private readonly headProfile = this.profile(cranialProfile());
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
    this.root.add(this.parts.root);
    this.cheekPigment.alphaMap = this.blushTexture;
    this.cheekPigment.transparent = true;
    this.cheekPigment.depthWrite = false;
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
    // Keep a closed chin contour instead of stretching the face into the torso.
    // The inset body overlaps at the neck. Both surfaces share one GPU buffer.
    const cranium = new THREE.LatheGeometry(this.headProfile, 64);
    cranium.scale(1, 1, this.headDepth);
    this.cranialVertexCount = cranium.getAttribute("position").count;
    const belly = new THREE.SphereGeometry(1, 48, 32);
    const torsoHeight = RIG.torso.crown - RIG.torso.bottom;
    belly.scale(RIG.torso.width / 2, torsoHeight / 2, RIG.torso.depth / 2);
    belly.translate(0, RIG.torso.bottom + torsoHeight / 2, RIG.torso.z);
    this.bodyGeometry = mergeGeometries([cranium, belly])!;
    this.bodyGeometry.userData.cranialVertexCount = this.cranialVertexCount;
    cranium.dispose();
    belly.dispose();
    this.geometries.add(this.bodyGeometry);
    this.bodyBase = new Float32Array(
      this.bodyGeometry.getAttribute("position").array,
    );
    const body = this.mesh(this.root, this.bodyGeometry, this.fur);
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
      const inner = this.ellipsoid(
        ear,
        [0, RIG.ear.lift, 0.145],
        [0.085, 0.14, 0.015],
        this.surfaceMaterial("#eeb1ab"),
      );
      inner.name = "inner-ear";
      inner.visible = false;
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
      this.headDepth * Math.sqrt(Math.max(0, radius * radius - x * x)) +
      offset * 0.4
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
      uvs: number[] = [],
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
        uvs.push(
          0.5 + (Math.cos(a) * radius) / 2,
          0.5 + (Math.sin(a) * radius) / 2,
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
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
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
    const geometry = roundedStroke(new SurfaceCurve(), radius);
    // Keep the rounded ink silhouette but flatten its relief onto the curved skin.
    // Cylindrical tubes otherwise look like floating rods from the side.
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    for (let i = 0; i < positions.count; i++)
      positions.setZ(
        i,
        project(positions.getX(i), positions.getY(i)) + normals.getZ(i) * 0.001,
      );
    geometry.computeVertexNormals();
    this.geometries.add(geometry);
    const mesh = this.mesh(parent, geometry, material);
    mesh.castShadow = false;
    return mesh;
  }
  private patch(
    parent: THREE.Object3D,
    contour: readonly FacePoint[],
    material: THREE.Material = this.ink,
    offset = 0.025,
  ) {
    const geometry = curvedPatch(
      contour,
      facePoint,
      (x, y, d) => this.faceZ(x, y, d),
      offset,
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
      [-0.067, 0.654 + lift],
      [-0.059, 0.676 + lift],
      [-0.038, 0.685 + lift],
      [-0.015, 0.679 + lift],
      [0, 0.655 + lift],
      [0.014, 0.68 + lift],
      [0.039, 0.686 + lift],
      [0.061, 0.675 + lift],
      [0.069, 0.655 + lift],
    ];
    this.line(
      parent,
      lip.map(([u, v]) => [
        (u * RIG.mouth.width) / 0.14,
        v + RIG.mouth.v - 0.67,
      ]),
      0.011,
    ).name = "muzzle";
    this.line(
      parent,
      [
        [0, 0.656 + lift],
        [0.001, 0.637 + lift],
      ],
      0.0105,
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
        expression === "sad"
          ? [
              [side * 0.205, v + rise / 2],
              [side * 0.18, v + 0.02],
              [side * 0.15, v - 0.025],
              [side * 0.125, v - rise / 2],
            ]
          : [
              [side * 0.205, v + rise / 2],
              [side * 0.165, v - 0.01],
              [side * 0.125, v - rise / 2],
            ],
        expression === "angry" ? 0.01 : 0.008,
      );
      brow.name = side < 0 ? "left-brow" : "right-brow";
      if (expression === "gentle") {
        brow.userData.faceStyle = "soft";
        const rabbitBrow = this.line(
          parent,
          [
            [side * 0.29, 0.4],
            [side * 0.26, 0.31],
            [side * 0.21, 0.24],
            [side * 0.15, 0.205],
          ],
          0.01,
        );
        rabbitBrow.userData.faceStyle = "rabbit";
        rabbitBrow.visible = false;
      }
    }
  }
  private buildOpenEye(
    side: number,
    style: "gentle" | "sad" | "angry" | "surprised",
  ) {
    const eye = new THREE.Group();
    const label = side < 0 ? "left" : "right";
    eye.name = style === "gentle" ? label + "-eye" : `${label}-${style}-eye`;
    eye.userData.expression = style;
    const u = side * RIG.eye.x,
      v = RIG.eye.v;
    const width = RIG.eye.width,
      height = RIG.eye.height * (style === "surprised" ? 1.1 : 1);
    const map = (points: readonly FacePoint[], tilt = false): FacePoint[] =>
      points.map(([x, y]) => [
        u + x * width,
        v +
          (y * height * RIG.head.width) / RIG.head.height +
          (tilt && style === "angry" && y < 0 ? -side * x * 0.035 : 0),
      ]);
    this.patch(
      eye,
      map(
        [
          [0, -0.5],
          [0.3, -0.43],
          [0.47, -0.2],
          [0.49, 0.12],
          [0.34, 0.41],
          [0.06, 0.5],
          [-0.27, 0.44],
          [-0.47, 0.18],
          [-0.49, -0.12],
          [-0.33, -0.39],
        ],
        true,
      ),
    ).name = label + "-eye-ink";
    this.patch(
      eye,
      map(
        [
          [-0.05, -0.34],
          [0.18, -0.28],
          [0.27, -0.12],
          [0.11, 0.025],
          [-0.14, 0.035],
          [-0.25, -0.105],
          [-0.17, -0.26],
        ],
        true,
      ),
      this.highlight,
      0.041,
    ).name = label + "-upper-highlight";
    this.patch(
      eye,
      map([
        [-0.28, 0.17],
        [-0.1, 0.225],
        [0.09, 0.22],
        [0.29, 0.14],
        [0.205, 0.335],
        [0.015, 0.385],
        [-0.18, 0.33],
      ]),
      this.highlight,
      0.041,
    ).name = label + "-crescent-highlight";
    const [px, py] = facePoint(u, v);
    const pivot = new THREE.Vector3(px, py, this.faceZ(px, py, 0));
    for (const child of eye.children) {
      child.position.sub(pivot);
      if (child instanceof THREE.Mesh)
        this.eyeBases.set(
          child.geometry,
          new Float32Array(child.geometry.getAttribute("position").array),
        );
    }
    eye.position.copy(pivot);
    this.eyes.add(eye);
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
        this.cheekPigment,
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
          0.0055,
          this.ink,
          0.026,
        );
      }
      for (const style of ["gentle", "sad", "angry", "surprised"] as const)
        this.buildOpenEye(side, style);
    }
    const gentle = new THREE.Group();
    this.eyebrows(gentle, "gentle");
    this.muzzle(gentle);
    this.line(
      gentle,
      [
        [-0.024, 0.737],
        [-0.008, 0.744],
        [0.012, 0.743],
        [0.024, 0.735],
      ],
      0.009,
    );

    const happy = new THREE.Group();
    this.eyebrows(happy, "happy");
    // Open mouth is drawn first; W-shaped lip stays legible above it.
    this.patch(
      happy,
      [
        [-0.044, 0.653],
        [-0.033, 0.749],
        [0, 0.79],
        [0.031, 0.757],
        [0.043, 0.654],
      ],
      this.ink,
      0.019,
    );
    this.patch(
      happy,
      [
        [-0.024, 0.674],
        [-0.02, 0.743],
        [0, 0.763],
        [0.018, 0.741],
        [0.023, 0.674],
      ],
      this.highlight,
      0.035,
    );
    this.muzzle(happy, -0.025);
    this.line(
      happy,
      [
        [-0.023, 0.825],
        [0, 0.835],
        [0.023, 0.824],
      ],
      0.008,
    );
    for (const side of [-1, 1])
      this.line(
        happy,
        [
          [side * 0.208, 0.51],
          [side * 0.16, 0.493],
          [side * 0.113, 0.508],
        ],
        0.012,
      );

    const sad = new THREE.Group();
    this.eyebrows(sad, "sad");
    this.muzzle(sad);
    for (const side of [-1, 1]) {
      const u = side * 0.16;
      this.patch(
        sad,
        [
          [u - 0.035, 0.61],
          [u - 0.014, 0.657],
          [u - 0.007, 0.701],
          [u + 0.019, 0.701],
          [u + 0.034, 0.638],
          [u + 0.032, 0.608],
        ],
        this.tears,
        0.038,
      );
      this.line(
        sad,
        [
          [u - 0.036, 0.6],
          [u - 0.032, 0.627],
          [u - 0.012, 0.652],
          [u - 0.009, 0.689],
          [u + 0.008, 0.709],
          [u + 0.028, 0.69],
          [u + 0.031, 0.651],
          [u + 0.041, 0.622],
        ],
        0.008,
        this.ink,
        0.046,
      );
      this.mark(sad, side * 0.235, 0.54, 0.01, 0.037, this.ink, 0.032);
    }
    this.line(
      sad,
      [
        [-0.027, 0.757],
        [0, 0.741],
        [0.027, 0.757],
      ],
      0.009,
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
      0.009,
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
    this.cheekPigment.color.set(next.cheekColor);
    const torsoHeight = next.bodyHeight;
    const headOffset = (RIG.torso.top - RIG.torso.bottom) * (torsoHeight - 1);
    if (
      !this.lastDocument ||
      next.bodyWidth !== this.lastDocument.bodyWidth ||
      next.bodyHeight !== this.lastDocument.bodyHeight ||
      JSON.stringify(next.base) !== JSON.stringify(this.lastDocument.base)
    ) {
      const positions = this.bodyGeometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        const x = this.bodyBase[i * 3],
          y = this.bodyBase[i * 3 + 1],
          z = this.bodyBase[i * 3 + 2];
        const cranial = i < this.cranialVertexCount;
        positions.setXYZ(
          i,
          cranial ? x * next.base.headWidth : x * next.bodyWidth,
          cranial
            ? RIG.head.bottom +
                (y - RIG.head.bottom) * next.base.headHeight +
                headOffset
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
    this.head.scale.set(next.base.headWidth, next.base.headHeight, 1);
    this.head.position.y =
      headOffset + RIG.head.bottom * (1 - next.base.headHeight);
    this.feet.scale.x = next.bodyWidth;
    for (const [index, ear] of this.ears.children.entries()) {
      const side = index === 0 ? -1 : 1;
      ear.position.x =
        side * RIG.ear.x * (next.base.faceStyle === "rabbit" ? 0.48 : 1);
      ear.scale.set(
        next.earSize * next.base.earWidth,
        next.earSize * next.base.earLength,
        next.earSize,
      );
      ear.rotation.z = -side * THREE.MathUtils.degToRad(next.base.earTilt);
      const inner = ear.getObjectByName("inner-ear");
      if (inner) inner.visible = next.base.innerEar;
    }
    for (const eye of this.eyes.children) {
      if (!this.lastDocument || next.eyeSize !== this.lastDocument.eyeSize) {
        for (const child of eye.children) {
          if (!(child instanceof THREE.Mesh)) continue;
          const base = this.eyeBases.get(child.geometry)!;
          const positions = child.geometry.getAttribute("position");
          for (let i = 0; i < positions.count; i++) {
            const x = base[i * 3],
              y = base[i * 3 + 1];
            const px = eye.position.x + (x - eye.position.x) * next.eyeSize;
            const py = eye.position.y + (y - eye.position.y) * next.eyeSize;
            const relief = base[i * 3 + 2] - this.faceZ(x, y, 0);
            positions.setXYZ(i, px, py, this.faceZ(px, py, 0) + relief);
          }
          positions.needsUpdate = true;
          child.geometry.computeVertexNormals();
          child.geometry.computeBoundingSphere();
        }
      }
      eye.visible = eye.userData.expression === next.expression;
    }
    this.eyes.visible =
      next.expression !== "happy" && next.expression !== "sleepy";
    this.head.traverse((object) => {
      if (object.userData.faceStyle)
        object.visible = object.userData.faceStyle === next.base.faceStyle;
    });
    for (const [name, group] of this.expressions)
      group.visible = name === next.expression;
    for (const [name, group] of this.accessories)
      group.visible = name === next.accessory;
    this.parts.update(next);
    this.lastDocument = structuredClone(next);
    return true;
  }
  getGeometryIds() {
    return [...this.geometries]
      .map((geometry) => geometry.id)
      .concat(this.parts.geometryIds());
  }
  dispose() {
    this.parts.dispose();
    this.blushTexture.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
