import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HanziModel } from "./HanziModel.js";

const container = document.querySelector<HTMLElement>("#stage")!;
const status = document.querySelector<HTMLElement>("#status")!;
try {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  // Geometry and lighting are fixed; orbiting only changes the viewing camera.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.setClearColor("#faf8f5", 0);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute(
    "aria-label",
    "우사기 HANZI 3D. 드래그·방향키로 회전, 스크롤로 확대합니다.",
  );
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  const model = new HanziModel();
  scene.add(model.root);
  scene.add(new THREE.HemisphereLight("#fffdf6", "#d7cdc0", 2.4));
  const key = new THREE.DirectionalLight("#fff4e7", 3.8);
  key.position.set(-3, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3.3;
  key.shadow.camera.right = 3.3;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -2;
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.0001;
  key.shadow.radius = 5;
  key.shadow.blurSamples = 8;
  scene.add(key);
  const fill = new THREE.DirectionalLight("#e2eafa", 1.05);
  fill.position.set(4, 3, -3);
  scene.add(fill);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.ShadowMaterial({ color: "#776c60", opacity: 0.17 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.018;
  floor.receiveShadow = true;
  scene.add(floor);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = !matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  controls.dampingFactor = 0.13;
  controls.minDistance = 6;
  controls.maxDistance = 17;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = Math.PI * 0.62;
  let frame: number | null = null,
    frames = 0;
  const render = () => {
    frame = null;
    const moving = controls.update();
    renderer.render(scene, camera);
    frames++;
    if (moving) invalidate();
  };
  const invalidate = () => {
    if (frame === null && !document.hidden)
      frame = requestAnimationFrame(render);
  };
  const reset = () => {
    controls.enableDamping = false;
    controls.update();
    camera.position.set(0.25, 2.65, 9.2);
    controls.target.set(0, 2.08, 0);
    controls.update();
    controls.enableDamping = !matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    invalidate();
  };
  controls.addEventListener("change", invalidate);
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = THREE.MathUtils.radToDeg(
      2 *
        Math.atan(
          Math.tan(THREE.MathUtils.degToRad(16)) *
            Math.max(1, 0.82 / camera.aspect),
        ),
    );
    camera.updateProjectionMatrix();
    invalidate();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  document.querySelector("#reset")!.addEventListener("click", reset);
  renderer.domElement.addEventListener("keydown", (event) => {
    const keys: Record<string, [number, number]> = {
      ArrowLeft: [-0.13, 0],
      ArrowRight: [0.13, 0],
      ArrowUp: [0, -0.1],
      ArrowDown: [0, 0.1],
    };
    if (!keys[event.key]) return;
    event.preventDefault();
    const [theta, phi] = keys[event.key];
    const spherical = new THREE.Spherical().setFromVector3(
      camera.position.clone().sub(controls.target),
    );
    spherical.theta += theta;
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi + phi,
      0.25,
      Math.PI * 0.62,
    );
    camera.position
      .copy(controls.target)
      .add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update();
    invalidate();
  });
  document.addEventListener("visibilitychange", invalidate);
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    status.textContent = "3D 연결이 끊겼습니다. 새로고침해 주세요.";
  });
  reset();
  resize();
  renderer.render(scene, camera);
  status.textContent = "드래그로 회전 · 스크롤로 확대";
  container.dataset.ready = "true";
  // Read-only diagnostics and deterministic capture, only in local QA mode.
  if (new URLSearchParams(location.search).has("diagnostics"))
    Object.assign(window, {
      hanziPreview: {
        capture: () => {
          renderer.render(scene, camera);
          return renderer.domElement.toDataURL("image/webp", 0.88);
        },
        metrics: () => ({
          triangles: renderer.info.render.triangles,
          calls: renderer.info.render.calls,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          frames,
          camera: camera.position.toArray(),
          target: controls.target.toArray(),
          grid: scene.children.some((o) => o instanceof THREE.GridHelper),
        }),
      },
    });
  window.addEventListener(
    "pagehide",
    (event) => {
      if (event.persisted) return;
      observer.disconnect();
      controls.dispose();
      model.dispose();
      renderer.dispose();
      if (frame !== null) cancelAnimationFrame(frame);
    },
    { once: true },
  );
} catch (error) {
  status.textContent =
    "이 브라우저에서 3D를 표시할 수 없습니다. 프로필로 돌아가 미리보기를 확인해 주세요.";
  console.error(error);
}
