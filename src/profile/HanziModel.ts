import * as THREE from "three";
import { ChiikawaModel } from "../adapters/ChiikawaModel.js";
import { curvedPatch, roundedStroke } from "../adapters/faceGeometry.js";
import { cranialProfile, facePoint } from "../adapters/chiikawaRig.js";
import type { CharacterDocument } from "../domain/character.js";

/** A procedural interpretation of Hanzi's public avatar, not an official model.
 * The avatar is authoritative for accessories; unseen back/feet are inferred.
 * Every marking follows a 3D surface. No avatar photograph is pasted on a plane.
 */
export class HanziModel {
  readonly root: THREE.Group;
  private readonly base = new ChiikawaModel();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly textures = new Set<THREE.Texture>();
  private readonly sphere = new THREE.SphereGeometry(1, 28, 20);
  private readonly headProfile = new THREE.SplineCurve(
    cranialProfile().map((p) => new THREE.Vector2(...p)),
  ).getPoints(96);
  private readonly ink = new THREE.MeshBasicMaterial({
    color: "#252521",
    toneMapped: false,
  });
  private readonly cream = this.material("#f6e2aa");
  private readonly orange = this.material("#f2752b");
  private readonly navy = this.material("#24272b");
  private readonly pink = this.material("#ef9bb9");
  private readonly white = this.material("#fff9ee");

  constructor() {
    // Fixed public profile recipe: avoid shipping the editor's schema validator.
    const document: CharacterDocument = {
      schemaVersion: 3,
      name: "HANZI",
      bodyColor: "#f5dc91",
      earColor: "#f5dc91",
      cheekColor: "#f3a5b2",
      bodyWidth: 1,
      bodyHeight: 1,
      earSize: 1,
      eyeSize: 0.91,
      expression: "gentle",
      accessory: "none",
      parts: [],
      base: {
        id: "usagi",
        name: "우사기",
        bodyColor: "#f5dc91",
        earColor: "#f5dc91",
        cheekColor: "#f3a5b2",
        headWidth: 0.98,
        headHeight: 1.02,
        earLength: 3.15,
        earWidth: 0.88,
        earTilt: 8,
        innerEar: true,
        faceStyle: "rabbit",
        bodyWidth: 1,
        bodyHeight: 1,
        eyeSize: 0.91,
      },
    };
    this.base.update(document);
    this.root = this.base.root;
    this.root.name = "hanzi-usagi";
    this.geometries.add(this.sphere);
    this.materials.add(this.ink);
    const head = this.root.getObjectByName("head")!;
    const gentle = head.getObjectByName("gentle-expression")!;
    // Retain the source's long, arched rabbit eyebrows and glossy open eyes.
    for (const child of gentle.children)
      if (child.userData.faceStyle === "rabbit") head.add(child.clone());
    gentle.visible = false;
    this.face(head);
    this.glasses(head);
    this.jersey();
    this.arms();
    this.eaglesBat();
    this.pinkBeanWand();
    this.root.updateMatrixWorld(true);
  }

  private material(color: string, roughness = 0.8) {
    const material = new THREE.MeshStandardMaterial({ color, roughness });
    this.materials.add(material);
    return material;
  }
  private mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
  ) {
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  private orb(
    parent: THREE.Object3D,
    p: number[],
    s: number[],
    material: THREE.Material,
    name: string,
  ) {
    const mesh = this.mesh(parent, this.sphere, material, name);
    mesh.position.set(p[0], p[1], p[2]);
    mesh.scale.set(s[0], s[1], s[2]);
    return mesh;
  }
  private stroke(
    parent: THREE.Object3D,
    points: number[][],
    radius: number,
    material: THREE.Material,
    name: string,
  ) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    );
    return this.mesh(parent, roundedStroke(curve, radius), material, name);
  }
  private faceDepth(x: number, y: number, offset: number) {
    const points = this.headProfile;
    let r = 0;
    for (let i = 1; i < points.length; i++) {
      if (y <= points[i].y) {
        const t = THREE.MathUtils.clamp(
          (y - points[i - 1].y) / (points[i].y - points[i - 1].y),
          0,
          1,
        );
        r = THREE.MathUtils.lerp(points[i - 1].x, points[i].x, t);
        break;
      }
    }
    return 0.7 * Math.sqrt(Math.max(0, r * r - x * x)) + offset;
  }
  private face(head: THREE.Object3D) {
    const patch = (
      contour: [number, number][],
      material: THREE.Material,
      offset: number,
      name: string,
    ) =>
      this.mesh(
        head,
        curvedPatch(contour, facePoint, this.faceDepth.bind(this), offset),
        material,
        name,
      );
    patch(
      [
        [-0.046, 0.665],
        [-0.035, 0.778],
        [0, 0.806],
        [0.031, 0.777],
        [0.046, 0.665],
      ],
      this.ink,
      0.024,
      "happy-mouth",
    );
    patch(
      [
        [-0.024, 0.754],
        [-0.022, 0.785],
        [0, 0.795],
        [0.02, 0.783],
        [0.023, 0.749],
        [0, 0.758],
      ],
      this.pink,
      0.032,
      "pink-tongue",
    );
    const lip = [
      [-0.066, 0.649],
      [-0.057, 0.675],
      [-0.03, 0.681],
      [0, 0.661],
      [0.03, 0.681],
      [0.059, 0.675],
      [0.068, 0.65],
    ];
    this.stroke(
      head,
      lip.map(([u, v]) => {
        const [x, y] = facePoint(u, v);
        return [x, y, this.faceDepth(x, y, 0.037)];
      }),
      0.022,
      this.ink,
      "w-lip",
    );
    this.stroke(
      head,
      [
        [-0.045, 1.63, this.faceDepth(-0.045, 1.63, 0.028)],
        [0, 1.615, this.faceDepth(0, 1.615, 0.028)],
        [0.055, 1.63, this.faceDepth(0.055, 1.63, 0.028)],
      ],
      0.013,
      this.ink,
      "chin-crease",
    );
  }
  private heart() {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.29);
    shape.bezierCurveTo(-0.11, -0.19, -0.34, -0.015, -0.31, 0.15);
    shape.bezierCurveTo(-0.29, 0.34, -0.08, 0.36, 0, 0.22);
    shape.bezierCurveTo(0.1, 0.36, 0.31, 0.34, 0.32, 0.15);
    shape.bezierCurveTo(0.35, -0.025, 0.11, -0.2, 0, -0.29);
    return shape;
  }
  private glasses(head: THREE.Object3D) {
    const glasses = new THREE.Group();
    glasses.name = "heart-sunglasses";
    glasses.position.set(0, 3.12, 0.43);
    glasses.rotation.x = -0.14;
    head.add(glasses);
    const lensMaterial = new THREE.MeshStandardMaterial({
      color: "#9f638b",
      roughness: 0.22,
      transparent: true,
      opacity: 0.68,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.materials.add(lensMaterial);
    for (const side of [-1, 1]) {
      const frame = new THREE.Group();
      frame.position.x = side * 0.36;
      frame.rotation.z = side * 0.07;
      glasses.add(frame);
      const shape = this.heart();
      const loop = shape
        .getPoints(48)
        .map((p) => new THREE.Vector3(p.x, p.y, 0));
      const curve = new THREE.CatmullRomCurve3(loop, true);
      this.mesh(
        frame,
        new THREE.TubeGeometry(curve, 64, 0.035, 8, true),
        this.navy,
        "heart-frame-trim",
      );
      const rim = this.mesh(
        frame,
        new THREE.TubeGeometry(curve, 64, 0.023, 8, true),
        this.pink,
        "heart-frame-pink",
      );
      rim.position.z = 0.028;
      const lens = this.mesh(
        frame,
        new THREE.ShapeGeometry(shape, 32),
        lensMaterial,
        "heart-lens",
      );
      lens.position.z = 0.008;
      lens.castShadow = false;
      this.stroke(
        glasses,
        [
          [side * 0.65, 0.1, 0],
          [side * 0.81, -0.12, -0.18],
          [side * 0.91, -0.29, -0.6],
        ],
        0.035,
        this.pink,
        "glasses-temple",
      );
      this.stroke(
        frame,
        [
          [-0.19, 0.15, 0.027],
          [-0.14, 0.24, 0.027],
          [-0.08, 0.25, 0.027],
        ],
        0.011,
        this.white,
        "lens-reflection",
      );
    }
    this.stroke(
      glasses,
      [
        [-0.08, 0.1, 0],
        [0, 0.135, 0.035],
        [0.08, 0.1, 0],
      ],
      0.028,
      this.navy,
      "glasses-bridge",
    );
  }
  private clothZ(x: number, y: number) {
    const r =
      1.075 * Math.sqrt(Math.max(0.01, 1 - ((y - 1.01) / 0.78) ** 2)) + 0.035;
    return -0.08 + 0.6 * Math.sqrt(Math.max(0.001, r * r - x * x));
  }
  private jersey() {
    const jersey = new THREE.Group();
    jersey.name = "hanwha-eagles-jersey";
    this.root.add(jersey);
    const profile: THREE.Vector2[] = [];
    for (let i = 0; i <= 32; i++) {
      const y = 0.37 + (i / 32) * 1.17;
      const r =
        1.075 * Math.sqrt(Math.max(0.01, 1 - ((y - 1.01) / 0.78) ** 2)) + 0.035;
      profile.push(new THREE.Vector2(r, y));
    }
    const geometry = new THREE.LatheGeometry(profile, 48);
    geometry.scale(1, 1, 0.6);
    geometry.translate(0, 0, -0.08);
    this.mesh(jersey, geometry, this.orange, "jersey-cloth");
    for (const side of [-1, 1]) {
      const path = [
        [side * 0.43, 1.53],
        [side * 0.24, 1.36],
        [0, 1.24],
      ].map(([x, y]) => [x, y, this.clothZ(x, y) + 0.018]);
      this.stroke(jersey, path, 0.017, this.navy, "v-neck-piping");
      this.stroke(
        jersey,
        path.map(([x, y, z]) => [x + side * 0.035, y + 0.014, z + 0.002]),
        0.007,
        this.white,
        "v-neck-stitch",
      );
    }
    this.stroke(
      jersey,
      [
        [0.015, 1.25, this.clothZ(0.015, 1.25) + 0.015],
        [0.015, 0.88, this.clothZ(0.015, 0.88) + 0.015],
        [0.015, 0.4, this.clothZ(0.015, 0.4) + 0.015],
      ],
      0.013,
      this.navy,
      "button-placket",
    );
    for (const y of [0.5, 0.72, 1.1])
      this.orb(
        jersey,
        [0.06, y, this.clothZ(0.06, y) + 0.024],
        [0.024, 0.024, 0.012],
        this.orange,
        "jersey-button",
      );
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const c = canvas.getContext("2d")!;
    c.clearRect(0, 0, 1024, 512);
    c.fillStyle = "#35445a";
    c.beginPath();
    c.roundRect(93, 76, 253, 79, 8);
    c.fill();
    c.fillStyle = "#fffef5";
    c.font = "bold 54px Arial";
    c.textAlign = "center";
    c.fillText("HANZI", 219, 134);
    c.fillStyle = "#24272b";
    c.font = "40px Arial";
    c.fillText("Hanwha", 739, 142);
    c.font = "italic 900 235px Georgia";
    c.textAlign = "center";
    c.lineJoin = "round";
    c.strokeStyle = "#fff8e8";
    c.lineWidth = 24;
    c.strokeText("Eagles", 510, 367, 870);
    c.strokeStyle = "#282521";
    c.lineWidth = 11;
    c.strokeText("Eagles", 510, 367, 870);
    c.fillStyle = "#282521";
    c.fillText("Eagles", 510, 367, 870);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.textures.add(texture);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.materials.add(mat);
    const decal = new THREE.PlaneGeometry(1.7, 0.78, 32, 18);
    const p = decal.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i) + 0.91;
      p.setXYZ(i, x, y, this.clothZ(x, y) + 0.022);
    }
    decal.computeVertexNormals();
    const logo = this.mesh(jersey, decal, mat, "HANZI-Hanwha-Eagles-lettering");
    logo.castShadow = false;
    // The back is an inferred continuation, deliberately free of invented labels.
  }
  private arms() {
    for (const side of [-1, 1]) {
      const old = this.root.getObjectByName(
        side < 0 ? "left-arm" : "right-arm",
      )!;
      old.visible = false;
      const arm = new THREE.Group();
      arm.position.set(side * 0.98, 1.19, 0.02);
      arm.rotation.z = side * 0.35;
      arm.name = side < 0 ? "raised-left-arm" : "raised-right-arm";
      this.root.add(arm);
      const sleeve = this.orb(
        arm,
        [side * 0.16, 0.09, 0],
        [0.34, 0.23, 0.27],
        this.orange,
        "orange-sleeve",
      );
      sleeve.rotation.z = side * 0.35;
      this.orb(
        arm,
        [side * 0.37, 0.16, 0],
        [0.075, 0.22, 0.25],
        this.navy,
        "sleeve-piping",
      );
      this.orb(
        arm,
        [side * 0.48, 0.21, 0.04],
        [0.22, 0.18, 0.2],
        this.cream,
        "raised-hand",
      );
    }
  }
  private cylinder(
    parent: THREE.Object3D,
    r: number,
    h: number,
    y: number,
    mat: THREE.Material,
    name: string,
    r2 = r,
  ) {
    const mesh = this.mesh(
      parent,
      new THREE.CylinderGeometry(r, r2, h, 20),
      mat,
      name,
    );
    mesh.position.y = y;
    return mesh;
  }
  private eaglesBat() {
    const bat = new THREE.Group();
    bat.name = "hanwha-cheering-bat";
    bat.position.set(-1.47, 1.68, 0.07);
    bat.rotation.z = 0.24;
    this.root.add(bat);
    this.cylinder(bat, 0.044, 0.7, 0.1, this.white, "bat-white-grip");
    this.cylinder(bat, 0.059, 0.85, 0.86, this.orange, "bat-orange-top", 0.052);
    this.cylinder(bat, 0.061, 0.04, 0.45, this.navy, "bat-divider");
    this.orb(
      bat,
      [0, 1.3, 0],
      [0.058, 0.055, 0.058],
      this.orange,
      "bat-rounded-tip",
    );
  }
  private pinkBeanWand() {
    const wand = new THREE.Group();
    wand.name = "kt-wiz-pinkbean-wand";
    wand.position.set(1.47, 1.65, 0.08);
    wand.rotation.z = -0.19;
    this.root.add(wand);
    this.cylinder(
      wand,
      0.065,
      0.45,
      -0.05,
      this.white,
      "wand-white-grip",
      0.084,
    );
    this.cylinder(wand, 0.07, 0.85, 0.59, this.pink, "wand-pink-shaft");
    this.cylinder(
      wand,
      0.077,
      0.045,
      0.2,
      this.material("#d9538a"),
      "wand-pink-ring",
    );
    const bean = new THREE.Group();
    bean.position.y = 1.2;
    bean.name = "pinkbean-head";
    wand.add(bean);
    this.orb(bean, [0, 0, 0], [0.28, 0.26, 0.18], this.pink, "pinkbean-face");
    const purple = this.material("#b38bc2");
    for (const side of [-1, 1]) {
      const ear = this.mesh(
        bean,
        new THREE.ConeGeometry(0.09, 0.19, 12),
        purple,
        "pinkbean-ear",
      );
      ear.position.set(side * 0.2, 0.22, 0);
      ear.rotation.z = -side * 0.45;
      this.orb(
        bean,
        [side * 0.105, 0.035, 0.174],
        [0.024, 0.031, 0.008],
        this.ink,
        "pinkbean-eye",
      );
      this.orb(
        bean,
        [side * 0.175, -0.035, 0.15],
        [0.044, 0.022, 0.013],
        this.material("#e578a0"),
        "pinkbean-blush",
      );
    }
    this.stroke(
      bean,
      [
        [-0.058, -0.032, 0.184],
        [-0.027, -0.058, 0.189],
        [0, -0.037, 0.19],
        [0.029, -0.059, 0.189],
        [0.057, -0.032, 0.184],
      ],
      0.01,
      this.ink,
      "pinkbean-mouth",
    );
    for (const y of [0.4, 0.68, 0.92]) {
      const star = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = Math.PI / 2 + (i * Math.PI) / 5,
          r = i % 2 ? 0.018 : 0.04;
        i
          ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r)
          : star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      star.closePath();
      const m = this.mesh(
        wand,
        new THREE.ShapeGeometry(star),
        purple,
        "wand-star",
      );
      m.position.set(0, y, 0.071);
      m.castShadow = false;
    }
    this.orb(
      wand,
      [0, -0.28, 0],
      [0.12, 0.05, 0.1],
      this.white,
      "wand-flared-base",
    );
  }
  dispose() {
    this.base.dispose();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
  }
}
