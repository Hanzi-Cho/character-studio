import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ChiikawaModel } from "../src/adapters/ChiikawaModel.js";
import { DEFAULT_CHARACTER } from "../src/domain/character.js";

test("torso edits keep the separate head attached and feet grounded", () => {
  const model = new ChiikawaModel();
  try {
    const head = model.root.getObjectByName("head-volume")!;
    const torso = model.root.getObjectByName("torso-volume")!;
    const feet = model.root.getObjectByName("feet")!;
    let headWidth: number | undefined;
    for (const bodyHeight of [0.8, 1, 1.3]) {
      for (const bodyWidth of [0.75, 1, 1.35]) {
        model.update({ ...DEFAULT_CHARACTER, bodyHeight, bodyWidth });
        model.root.updateMatrixWorld(true);
        const h = new THREE.Box3().setFromObject(head),
          b = new THREE.Box3().setFromObject(torso);
        const f = new THREE.Box3().setFromObject(feet);
        assert.ok(
          h.min.y < b.max.y && h.max.y > b.max.y,
          "head must overlap the torso at its joint",
        );
        assert.ok(
          f.min.y >= 0 && f.min.y < 0.03,
          "feet must stay on the ground",
        );
        const width = h.max.x - h.min.x;
        headWidth ??= width;
        assert.ok(
          Math.abs(width - headWidth) < 1e-6,
          "body-width edits must not stretch the face",
        );
      }
    }
  } finally {
    model.dispose();
  }
});

test("face, ears and expressions reuse valid geometry through edits", () => {
  const model = new ChiikawaModel();
  try {
    const ids = model.getGeometryIds();
    for (const expression of ["gentle", "happy", "surprised"] as const) {
      model.update({
        ...DEFAULT_CHARACTER,
        expression,
        earSize: 1.8,
        eyeSize: 1.4,
        accessory: "bow",
      });
      assert.deepEqual(model.getGeometryIds(), ids);
      assert.equal(
        model.root.getObjectByName(expression + "-expression")!.visible,
        true,
      );
      assert.equal(
        model.root.getObjectByName("eyes")!.visible,
        expression !== "happy",
      );
      model.root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          const positions = object.geometry.getAttribute("position");
          for (const value of positions.array)
            assert.ok(Number.isFinite(value));
        }
      });
    }
    assert.equal(
      model.update({
        ...DEFAULT_CHARACTER,
        expression: "surprised",
        earSize: 1.8,
        eyeSize: 1.4,
        accessory: "bow",
      }),
      false,
    );
  } finally {
    model.dispose();
  }
});
