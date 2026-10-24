import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  InstancedPartLayer,
  type RenderPart,
} from "../src/adapters/InstancedPartLayer.js";
test("4096 stable instances: 64 sparse edits, no-op upload suppression and atomic bounds", () => {
  const geometry = new THREE.IcosahedronGeometry(1, 1),
    material = new THREE.MeshBasicMaterial();
  const layer = new InstancedPartLayer(geometry, material, 4096);
  const parts: RenderPart[] = Array.from({ length: 4096 }, (_, i) => ({
    id: String(i),
    position: [i, 0, 0],
    scale: 1,
    color: "#aabbcc",
  }));
  assert.equal(layer.update(parts).count, 4096);
  const buffer = layer.mesh.instanceMatrix;
  layer.mesh.instanceMatrix.clearUpdateRanges();
  layer.mesh.instanceColor!.clearUpdateRanges();
  const result = layer.update(
    parts.slice(0, 64).map((p) => ({ ...p, position: [p.position[0], 1, 0] })),
  );
  assert.equal(result.matrixChanges, 64);
  assert.equal(result.colorChanges, 0);
  assert.equal(layer.mesh.instanceMatrix, buffer);
  assert.equal(layer.mesh.geometry, geometry);
  const version = buffer.version;
  assert.equal(layer.update(parts.slice(64)).changed, 0);
  assert.equal(buffer.version, version);
  assert.throws(() =>
    layer.update([
      { id: "overflow", position: [0, 0, 0], scale: 1, color: "#ffffff" },
    ]),
  );
  assert.equal(layer.mesh.count, 4096);
  assert.throws(() => layer.update([{ ...parts[0], color: "invalid" }]));
  assert.equal(layer.idAt(2), "2");
  layer.dispose();
  geometry.dispose();
  material.dispose();
});
