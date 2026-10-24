import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ChiikawaModel } from "../src/adapters/ChiikawaModel.js";
import { DEFAULT_CHARACTER, EXPRESSIONS } from "../src/domain/character.js";

test("world-space head remains round and facial landmarks match the measured coordinate frame", () => {
  const model = new ChiikawaModel();
  try {
    model.update(DEFAULT_CHARACTER);
    model.root.updateMatrixWorld(true);
    const body = model.root.getObjectByName("body-volume") as THREE.Mesh;
    const box = new THREE.Box3().setFromBufferAttribute(
      body.geometry.getAttribute("position") as THREE.BufferAttribute,
    );
    box.applyMatrix4(body.matrixWorld);
    const width = box.max.x - box.min.x;
    const headHeight = box.max.y - 1.34;
    assert.ok(
      headHeight / width > 0.74 && headHeight / width < 0.78,
      "a global y squash must not silently flatten the head again",
    );
    const left = model.root
      .getObjectByName("left-eye")!
      .getWorldPosition(new THREE.Vector3());
    const right = model.root
      .getObjectByName("right-eye")!
      .getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs((right.x - left.x) / width - 0.32) < 0.005);
    assert.ok(Math.abs((box.max.y - left.y) / headHeight - 0.51) < 0.005);
    for (const side of ["left", "right"]) {
      const cheek = model.root
        .getObjectByName(side + "-cheek")!
        .getWorldPosition(new THREE.Vector3());
      assert.ok(Math.abs(Math.abs(cheek.x) / width - 0.3) < 0.005);
      assert.ok(Math.abs((box.max.y - cheek.y) / headHeight - 0.61) < 0.005);
      const ear = model.root.getObjectByName(side + "-ear")!;
      assert.ok(
        Math.abs(Math.abs(THREE.MathUtils.radToDeg(ear.rotation.z)) - 18) <
          0.01,
      );
      const earBounds = new THREE.Box3().setFromObject(ear);
      assert.ok(
        earBounds.min.y < 2.96 && earBounds.max.y > 3.2,
        "ears must intersect the dome and protrude above it",
      );
      assert.ok(
        (earBounds.max.y - earBounds.min.y) / width < 0.22,
        "ears must remain small rounded caps, not rabbit ears",
      );
    }
  } finally {
    model.dispose();
  }
});

test("all six eyebrow angles are measured from the rendered tube endpoints", () => {
  const model = new ChiikawaModel();
  try {
    const expected = {
      gentle: 10,
      happy: 8,
      sad: 22,
      angry: -30,
      surprised: 0,
      sleepy: 0,
    };
    for (const expression of EXPRESSIONS) {
      const group = model.root.getObjectByName(expression + "-expression")!;
      for (const side of ["left", "right"]) {
        const brow = group.getObjectByName(
          side + "-brow",
        ) as THREE.Mesh<THREE.TubeGeometry>;
        const p = brow.geometry.getAttribute("position");
        const center = (start: number) => {
          const sum = new THREE.Vector3();
          for (let i = 0; i < 8; i++)
            sum.add(new THREE.Vector3().fromBufferAttribute(p, start + i));
          return sum.divideScalar(8);
        };
        const outer = center(0),
          inner = center(p.count - 9);
        const degrees = THREE.MathUtils.radToDeg(
          Math.atan2(inner.y - outer.y, Math.abs(inner.x - outer.x)),
        );
        assert.ok(
          Math.abs(degrees - expected[expression]) < 0.1,
          expression + " " + side,
        );
      }
    }
  } finally {
    model.dispose();
  }
});

test("default face is only slightly wider than torso; body edits preserve face and ground contact", () => {
  const model = new ChiikawaModel();
  try {
    model.update(DEFAULT_CHARACTER);
    const body = model.root.getObjectByName("body-volume") as THREE.Mesh;
    const positions = body.geometry.getAttribute("position");
    const initial = new Float32Array(positions.array);
    let faceRadius = 0,
      torsoRadius = 0;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i),
        x = Math.abs(positions.getX(i));
      if (y >= 1.34) faceRadius = Math.max(faceRadius, x);
      if (y >= 0.6 && y <= 1.2) torsoRadius = Math.max(torsoRadius, x);
    }
    assert.ok(
      faceRadius / torsoRadius >= 1.04 && faceRadius / torsoRadius <= 1.12,
    );
    for (const bodyHeight of [0.8, 1, 1.3])
      for (const bodyWidth of [0.75, 1, 1.35]) {
        model.update({ ...DEFAULT_CHARACTER, bodyHeight, bodyWidth });
        model.root.updateMatrixWorld(true);
        const f = new THREE.Box3().setFromObject(
          model.root.getObjectByName("feet")!,
        );
        assert.ok(f.min.y >= 0 && f.min.y < 0.03);
        for (let i = 0; i < positions.count; i++) {
          if (initial[i * 3 + 1] >= 1.34) {
            assert.equal(
              positions.getX(i),
              initial[i * 3],
              "body-width edits must not stretch the face",
            );
            assert.ok(
              Math.abs(
                positions.getY(i) -
                  initial[i * 3 + 1] -
                  model.root.getObjectByName("head")!.position.y,
              ) < 1e-6,
              "facial features must follow the upper surface",
            );
          }
        }
      }
  } finally {
    model.dispose();
  }
});

test("six expressions retain body buffers, proportions, colors and accessories", () => {
  const model = new ChiikawaModel();
  try {
    const custom = {
      ...DEFAULT_CHARACTER,
      bodyColor: "#b7dfcf",
      bodyWidth: 1.2,
      bodyHeight: 1.15,
      earSize: 1.8,
      eyeSize: 1.4,
      accessory: "bow" as const,
    };
    model.update(custom);
    const ids = model.getGeometryIds();
    const body = model.root.getObjectByName("body-volume") as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;
    const buffer = body.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const version = buffer.version;
    const bodyPositions = Array.from(buffer.array);
    for (const expression of EXPRESSIONS) {
      model.update({ ...custom, expression });
      assert.deepEqual(model.getGeometryIds(), ids);
      assert.equal(
        buffer.version,
        version,
        "expression edits must not re-upload body geometry",
      );
      assert.deepEqual(Array.from(buffer.array), bodyPositions);
      assert.equal(body.material.color.getHexString(), "b7dfcf");
      assert.equal(model.root.getObjectByName("bow")!.visible, true);
      for (const name of EXPRESSIONS)
        assert.equal(
          model.root.getObjectByName(name + "-expression")!.visible,
          name === expression,
        );
      assert.equal(
        model.root.getObjectByName("eyes")!.visible,
        expression !== "happy" && expression !== "sleepy",
      );
      model.root.traverse((object) => {
        if (object instanceof THREE.Mesh)
          for (const value of object.geometry.getAttribute("position").array)
            assert.ok(Number.isFinite(value));
      });
    }
    assert.equal(model.update({ ...custom, expression: "sleepy" }), false);
  } finally {
    model.dispose();
  }
});
