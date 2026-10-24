import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  InstancedPartLayer,
  type RenderPart,
} from "../adapters/InstancedPartLayer.js";

export default function BatchBenchmark() {
  const container = useRef<HTMLDivElement>(null);
  const change = useRef<() => void>(() => {});
  const [metrics, setMetrics] = useState<Record<string, unknown>>({});
  useEffect(() => {
    const host = container.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f6f5f2");
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    camera.position.set(23, 21, 28);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();
    scene.add(new THREE.HemisphereLight("#fff", "#8b9d80", 3));
    const geometry = new THREE.IcosahedronGeometry(0.28, 1);
    const material = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const layer = new InstancedPartLayer(geometry, material, 4096);
    scene.add(layer.mesh);
    const parts: RenderPart[] = Array.from({ length: 4096 }, (_, i) => ({
      id: `sample-${i}`,
      position: [
        (i % 16) - 7.5,
        (Math.floor(i / 16) % 16) - 7.5,
        Math.floor(i / 256) - 7.5,
      ],
      scale: 1,
      color: ["#bdc9af", "#a8c2c2", "#d7c5a4", "#b7accc"][i % 4],
    }));
    layer.update(parts);
    let frames = 0;
    let pending: number | null = null;
    let sequence = 0;
    let latest = {
      changed: 4096,
      matrixChanges: 4096,
      colorChanges: 4096,
      count: 4096,
      cpuSubmitMs: 0,
    };
    const draw = () => {
      pending = null;
      renderer.render(scene, camera);
      frames++;
      const result = {
        ...latest,
        frames,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        bufferBytes: layer.mesh.instanceMatrix.array.byteLength,
      };
      setMetrics(result);
    };
    const invalidate = () => {
      if (pending === null) pending = requestAnimationFrame(draw);
    };
    const resize = () => {
      const box = host.getBoundingClientRect();
      renderer.setSize(box.width, box.height, false);
      camera.aspect = box.width / box.height;
      camera.updateProjectionMatrix();
      invalidate();
    };
    change.current = () => {
      sequence++;
      const patch = parts
        .slice(0, 64)
        .map((part) => ({
          ...part,
          position: [
            part.position[0],
            part.position[1] + (sequence % 2 ? 0.3 : 0),
            part.position[2],
          ] as [number, number, number],
          color: sequence % 2 ? "#f0b7bd" : part.color,
        }));
      const start = performance.now();
      const result = layer.update(patch);
      latest = {
        ...result,
        cpuSubmitMs: Math.round((performance.now() - start) * 1000) / 1000,
      };
      invalidate();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    controls.addEventListener("change", invalidate);
    resize();
    return () => {
      observer.disconnect();
      controls.dispose();
      if (pending !== null) cancelAnimationFrame(pending);
      layer.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <main
      style={{ height: "100dvh", display: "flex", flexDirection: "column" }}
    >
      <header style={{ padding: 20 }}>
        <a href="/">← Studio</a>
        <h1 style={{ fontSize: 22 }}>Instanced parts · 4,096</h1>
        <p>
          반복 지오메트리 전용 실험입니다. 4,096개의 완성 캐릭터 성능을 의미하지
          않습니다.
        </p>
        <button onClick={() => change.current()}>64개만 갱신</button>
        <output
          style={{ display: "block", fontFamily: "monospace", marginTop: 12 }}
          data-benchmark={JSON.stringify(metrics)}
        >
          {JSON.stringify(metrics)}
        </output>
      </header>
      <div ref={container} style={{ flex: 1, minHeight: 0 }} />
    </main>
  );
}
