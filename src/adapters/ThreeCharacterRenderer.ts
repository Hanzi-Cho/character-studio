import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { CharacterDocument } from "../domain/character.js";
import type { CharacterRenderer } from "../application/ports.js";

/** Persistent scene, shared geometry, incremental property writes, truly idle RAF.
 * Architectural lessons from Human Atlas: see docs/HUMAN-ATLAS-RESEARCH.md.
 * This renderer is original code; no anatomy assets or source are bundled.
 */
export class ThreeCharacterRenderer implements CharacterRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly root = new THREE.Group();
  private readonly sphere = new THREE.SphereGeometry(1, 40, 28);
  private readonly geometries = new Set<THREE.BufferGeometry>([this.sphere]);
  private readonly materials = new Set<THREE.Material>();
  private readonly bodyMaterial = this.material("#fffdf7");
  private readonly cheekMaterial = this.material("#f3a5b2");
  private readonly earMaterial = this.material("#f8c1c8");
  private readonly ink = this.material("#35312e");
  private readonly white = this.material("#ffffff");
  private readonly accessoryMaterial = this.material("#e9a5b5");
  private readonly outline = new THREE.MeshBasicMaterial({
    color: "#3a3532",
    side: THREE.BackSide,
  });
  private readonly ears = new THREE.Group();
  private readonly eyes = new THREE.Group();
  private readonly expressions = new Map<string, THREE.Group>();
  private readonly accessories = new Map<string, THREE.Group>();
  private readonly observer: ResizeObserver;
  private frame: number | null = null;
  private disposed = false;
  private frameCount = 0;
  private updateCount = 0;
  private lastDocument?: CharacterDocument;
  private readonly onVisibility = () => {
    if (!document.hidden) this.invalidate();
  };
  private readonly onLost = (event: Event) => {
    event.preventDefault();
    this.onError(
      "3D 화면 연결이 끊겼어요. 페이지를 새로고침해 주세요. 저장한 모습은 유지됩니다.",
    );
  };

  constructor(
    private container: HTMLElement,
    private onError: (message: string) => void,
  ) {
    this.materials.add(this.outline);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor("#f6f5f2", 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3D 캐릭터. 드래그로 회전, 휠로 확대. 방향키로도 회전할 수 있습니다.",
    );
    this.renderer.domElement.setAttribute("role", "img");
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener("webglcontextlost", this.onLost);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    this.controls.dampingFactor = 0.12;
    this.controls.enablePan = false;
    this.controls.minDistance = 4.2;
    this.controls.maxDistance = 11;
    this.controls.minPolarAngle = 0.1;
    this.controls.maxPolarAngle = Math.PI - 0.1;
    this.controls.addEventListener("change", this.invalidate);
    this.controls.addEventListener("start", this.invalidate);
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#d7c9b9", 2.4));
    const key = new THREE.DirectionalLight("#fff7eb", 3.8);
    key.position.set(-3, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -3;
    key.shadow.camera.right = 3;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -3;
    key.shadow.normalBias = 0.035;
    key.shadow.radius = 4;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight("#e2eafa", 1.2);
    fill.position.set(4, 2, -3);
    this.scene.add(fill);
    const floorGeometry = new THREE.PlaneGeometry(200, 200);
    this.geometries.add(floorGeometry);
    const floorMaterial = new THREE.ShadowMaterial({
      color: "#746a5f",
      opacity: 0.15,
    });
    this.materials.add(floorMaterial);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.02;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.buildCharacter();
    this.scene.add(this.root);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(container);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.resetView();
    this.resize();
  }
  private material(color: string) {
    const result = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.84,
      metalness: 0,
    });
    this.materials?.add(result);
    return result;
  }
  private ellipsoid(
    parent: THREE.Object3D,
    position: [number, number, number],
    scale: [number, number, number],
    material: THREE.Material,
    outlined = false,
  ) {
    const mesh = new THREE.Mesh(this.sphere, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    parent.add(mesh);
    if (outlined) {
      const border = new THREE.Mesh(this.sphere, this.outline);
      border.scale.set(1.017, 1.017, 1.035);
      mesh.add(border);
    }
    return mesh;
  }
  private faceZ(x: number, y: number, offset = 0.02) {
    return (
      0.7 *
        Math.sqrt(
          Math.max(0.01, 1 - (x / 1.06) ** 2 - ((y - 1.36) / 1.04) ** 2),
        ) +
      offset
    );
  }
  private stroke(
    parent: THREE.Object3D,
    points: [number, number][],
    radius = 0.017,
  ) {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, y]) => new THREE.Vector3(x, y, this.faceZ(x, y, 0.035))),
    );
    const geometry = new THREE.TubeGeometry(curve, 24, radius, 7, false);
    this.geometries.add(geometry);
    parent.add(new THREE.Mesh(geometry, this.ink));
  }
  private buildCharacter() {
    this.ellipsoid(
      this.root,
      [0, 1.36, 0],
      [1.06, 1.04, 0.7],
      this.bodyMaterial,
      true,
    );
    for (const side of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(side * 0.69, 2.28, -0.02);
      ear.rotation.z = -side * 0.18;
      this.ellipsoid(
        ear,
        [0, 0.1, 0],
        [0.225, 0.3, 0.19],
        this.bodyMaterial,
        true,
      );
      this.ellipsoid(
        ear,
        [0, 0.12, 0.158],
        [0.115, 0.178, 0.022],
        this.earMaterial,
      );
      this.ears.add(ear);
      const arm = this.ellipsoid(
        this.root,
        [side * 0.95, 0.87, 0.025],
        [0.19, 0.32, 0.24],
        this.bodyMaterial,
        true,
      );
      arm.rotation.z = side * 0.36;
      this.ellipsoid(
        this.root,
        [side * 0.39, 0.21, 0.12],
        [0.25, 0.19, 0.31],
        this.bodyMaterial,
        true,
      );
      this.ellipsoid(
        this.root,
        [side * 0.66, 1.2, this.faceZ(side * 0.66, 1.2)],
        [0.18, 0.095, 0.022],
        this.cheekMaterial,
      );
      for (let j = 0; j < 3; j++)
        this.stroke(
          this.root,
          [
            [side * (0.57 + j * 0.075), 1.24],
            [side * (0.59 + j * 0.075), 1.17],
          ],
          0.008,
        );
      const eye = new THREE.Group();
      eye.position.set(side * 0.34, 1.57, this.faceZ(side * 0.34, 1.57, 0.027));
      this.ellipsoid(eye, [0, 0, 0], [0.065, 0.094, 0.025], this.ink);
      this.ellipsoid(
        eye,
        [-0.017, 0.033, 0.023],
        [0.018, 0.022, 0.009],
        this.white,
      );
      this.eyes.add(eye);
    }
    this.root.add(this.ears, this.eyes);
    const gentle = new THREE.Group();
    this.stroke(
      gentle,
      [
        [-0.39, 1.85],
        [-0.33, 1.87],
        [-0.27, 1.91],
      ],
      0.014,
    );
    this.stroke(
      gentle,
      [
        [0.27, 1.91],
        [0.33, 1.87],
        [0.39, 1.85],
      ],
      0.014,
    );
    this.stroke(
      gentle,
      [
        [-0.15, 1.37],
        [-0.12, 1.3],
        [-0.065, 1.29],
        [0, 1.34],
        [0.065, 1.29],
        [0.12, 1.3],
        [0.15, 1.37],
      ],
      0.019,
    );
    const happy = new THREE.Group();
    this.ellipsoid(
      happy,
      [0, 1.3, this.faceZ(0, 1.3, 0.031)],
      [0.14, 0.15, 0.025],
      this.ink,
    );
    this.ellipsoid(
      happy,
      [0, 1.23, this.faceZ(0, 1.23, 0.058)],
      [0.09, 0.055, 0.012],
      this.cheekMaterial,
    );
    for (const side of [-1, 1])
      this.stroke(
        happy,
        [
          [side * 0.44, 1.57],
          [side * 0.34, 1.63],
          [side * 0.24, 1.57],
        ],
        0.022,
      );
    const surprised = new THREE.Group();
    this.ellipsoid(
      surprised,
      [0, 1.3, this.faceZ(0, 1.3, 0.035)],
      [0.069, 0.095, 0.022],
      this.ink,
    );
    for (const side of [-1, 1])
      this.stroke(
        surprised,
        [
          [side * 0.43, 1.92],
          [side * 0.34, 1.95],
          [side * 0.26, 1.92],
        ],
        0.014,
      );
    for (const [name, group] of [
      ["gentle", gentle],
      ["happy", happy],
      ["surprised", surprised],
    ] as const) {
      this.expressions.set(name, group);
      group.visible = name === "gentle";
      this.root.add(group);
    }
    const bow = new THREE.Group();
    bow.position.set(0, 0.65, 0.58);
    for (const side of [-1, 1]) {
      const wing = this.ellipsoid(
        bow,
        [side * 0.13, 0, 0],
        [0.15, 0.12, 0.06],
        this.accessoryMaterial,
        true,
      );
      wing.rotation.z = side * 0.3;
    }
    this.ellipsoid(
      bow,
      [0, 0, 0.045],
      [0.065, 0.07, 0.06],
      this.cheekMaterial,
      true,
    );
    const star = new THREE.Group();
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 0.18 : 0.085;
      const x = Math.cos(a) * r,
        y = Math.sin(a) * r;
      i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    }
    shape.closePath();
    const starGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.035,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 2,
      steps: 1,
    });
    this.geometries.add(starGeometry);
    const starMesh = new THREE.Mesh(starGeometry, this.material("#efcb77"));
    star.add(starMesh);
    star.position.set(0.68, 2.38, 0.18);
    for (const [name, group] of [
      ["bow", bow],
      ["star", star],
    ] as const) {
      this.accessories.set(name, group);
      group.visible = false;
      this.root.add(group);
    }
  }
  update(next: CharacterDocument) {
    if (JSON.stringify(next) === JSON.stringify(this.lastDocument)) return;
    this.bodyMaterial.color.set(next.bodyColor);
    this.cheekMaterial.color.set(next.cheekColor);
    this.earMaterial.color.set(next.earColor);
    this.root.scale.set(next.bodyWidth, next.bodyHeight, 1);
    for (const ear of this.ears.children) ear.scale.setScalar(next.earSize);
    for (const eye of this.eyes.children) eye.scale.setScalar(next.eyeSize);
    this.eyes.visible = next.expression !== "happy";
    for (const [name, group] of this.expressions)
      group.visible = name === next.expression;
    for (const [name, group] of this.accessories)
      group.visible = name === next.accessory;
    this.lastDocument = { ...next };
    this.updateCount++;
    this.invalidate();
  }
  private resize = () => {
    if (this.disposed) return;
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = THREE.MathUtils.radToDeg(
      2 *
        Math.atan(
          Math.tan(THREE.MathUtils.degToRad(16)) *
            Math.max(1, 0.85 / this.camera.aspect),
        ),
    );
    this.camera.setViewOffset(width, height, 0, -height * 0.02, width, height);
    this.camera.updateProjectionMatrix();
    this.invalidate();
  };
  private invalidate = () => {
    if (this.disposed || this.frame !== null || document.hidden) return;
    this.frame = requestAnimationFrame(this.render);
  };
  private render = () => {
    this.frame = null;
    if (this.disposed) return;
    const moving = this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.frameCount++;
    if (moving) this.invalidate();
    if (new URLSearchParams(location.search).has("diagnostics"))
      this.container.dataset.diagnostics = JSON.stringify(this.getMetrics());
  };
  resetView() {
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    this.camera.position.set(0, 2.65, 7.4);
    this.controls.target.set(0, 1.35, 0);
    this.controls.update();
    this.controls.enableDamping = damping;
    this.invalidate();
  }
  rotate(horizontal: number, vertical: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta += horizontal;
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi + vertical,
      0.1,
      Math.PI - 0.1,
    );
    this.camera.position
      .copy(this.controls.target)
      .add(new THREE.Vector3().setFromSpherical(spherical));
    this.controls.update();
    this.invalidate();
  }
  capture() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }
  getMetrics() {
    return {
      frameCount: this.frameCount,
      updateCount: this.updateCount,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      geometryIds: [...this.geometries].map((g) => g.id),
      camera: this.camera.position.toArray(),
      pixelRatio: this.renderer.getPixelRatio(),
      scheduled: this.frame !== null,
    };
  }
  dispose() {
    this.disposed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.renderer.domElement.removeEventListener(
      "webglcontextlost",
      this.onLost,
    );
    this.controls.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
