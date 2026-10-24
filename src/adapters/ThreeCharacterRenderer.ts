import * as THREE from "three";
import { ChiikawaModel } from "./ChiikawaModel.js";
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
  private readonly model = new ChiikawaModel();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly observer: ResizeObserver;
  private frame: number | null = null;
  private disposed = false;
  private frameCount = 0;
  private updateCount = 0;
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
    this.scene.add(this.model.root);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(container);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.resetView();
    this.resize();
  }
  update(next: CharacterDocument) {
    if (!this.model.update(next)) return;
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
    this.camera.position.set(0, 2.04, 8.2);
    this.controls.target.set(0, 1.67, 0);
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
      geometryIds: [
        ...this.model.getGeometryIds(),
        ...[...this.geometries].map((g) => g.id),
      ],
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
    this.model.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
