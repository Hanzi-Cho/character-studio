import * as THREE from "three";
import type { CharacterDocument } from "../domain/character.js";
import type { CharacterPart, Primitive } from "../domain/parts.js";

/** Serialized recipes and primitives. No chat/provider dependencies or executable input. */
export class CharacterParts {
  readonly root = new THREE.Group();
  private entries = new Map<
    string,
    { key: string; root: THREE.Group; part: CharacterPart }
  >();
  update(document: CharacterDocument) {
    const wanted = new Set(document.parts.map((p) => p.id));
    for (const [id, entry] of this.entries)
      if (!wanted.has(id)) {
        this.release(entry.root);
        this.entries.delete(id);
      }
    for (const part of document.parts) {
      const key = JSON.stringify(part);
      let entry = this.entries.get(part.id);
      if (entry?.key !== key) {
        if (entry) this.release(entry.root);
        const root = this.build(part);
        root.name = `part:${part.id}`;
        entry = { key, root, part };
        this.entries.set(part.id, entry);
        this.root.add(root);
      }
      const offset = 1.11 * (document.bodyHeight - 1);
      const headY = (y: number) =>
        1.34 + (y - 1.34) * document.base.headHeight + offset;
      const earX =
        0.69 *
        document.base.headWidth *
        (document.base.faceStyle === "rabbit" ? 0.48 : 1);
      const anchor: Record<CharacterPart["anchor"], [number, number, number]> =
        {
          head: [0, headY(3.03), 0],
          face: [0, headY(2.2), 0.79],
          neck: [0, 1.38 + offset, 0.63],
          body: [0, 0.23 * (1 - document.bodyHeight), 0],
          back: [0, 1.33 + offset, -0.52],
          leftEar: [-earX, headY(2.95 + 0.21 * document.base.earLength), 0],
          rightEar: [earX, headY(2.95 + 0.21 * document.base.earLength), 0],
        };
      entry!.root.position
        .set(...anchor[part.anchor])
        .add(new THREE.Vector3(...part.position));
      entry!.root.rotation.set(
        ...(part.rotation.map(THREE.MathUtils.degToRad) as [
          number,
          number,
          number,
        ]),
      );
      entry!.root.scale.set(...part.scale);
      if (part.anchor === "body")
        entry!.root.scale.multiply(
          new THREE.Vector3(document.bodyWidth, document.bodyHeight, 1),
        );
    }
  }
  private release(group: THREE.Group) {
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          m.dispose(),
        );
      }
    });
    group.removeFromParent();
  }
  private material(color: string) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.72,
      metalness: 0.03,
      side: THREE.DoubleSide,
    });
  }
  private mesh(
    group: THREE.Group,
    geometry: THREE.BufferGeometry,
    color: string,
    position: number[] = [0, 0, 0],
    scale: number[] = [1, 1, 1],
    rotation: number[] = [0, 0, 0],
  ) {
    const mesh = new THREE.Mesh(geometry, this.material(color));
    mesh.position.set(...(position as [number, number, number]));
    mesh.scale.set(...(scale as [number, number, number]));
    mesh.rotation.set(
      ...(rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  private orb(
    group: THREE.Group,
    color: string,
    position: number[],
    scale: number[],
    rotation: number[] = [0, 0, 0],
  ) {
    return this.mesh(
      group,
      new THREE.SphereGeometry(1, 24, 16),
      color,
      position,
      scale,
      rotation,
    );
  }
  private star() {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5,
        r = i % 2 === 0 ? 0.5 : 0.23;
      i === 0
        ? shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
        : shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelSize: 0.02,
      bevelThickness: 0.02,
      bevelSegments: 2,
      steps: 1,
    });
  }
  private primitive(group: THREE.Group, p: Primitive) {
    const geometry = {
      sphere: () => new THREE.SphereGeometry(1, 24, 16),
      box: () => new THREE.BoxGeometry(1, 1, 1),
      cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 24),
      cone: () => new THREE.ConeGeometry(0.5, 1, 24),
      torus: () => new THREE.TorusGeometry(0.5, 0.1, 10, 36),
      capsule: () => new THREE.CapsuleGeometry(0.5, 1, 6, 16),
      star: () => this.star(),
    }[p.shape]();
    this.mesh(group, geometry, p.color, p.position, p.scale, p.rotation);
  }
  private build(p: CharacterPart) {
    const g = new THREE.Group(),
      c = p.color,
      a = p.accentColor;
    if (p.kind === "wings") {
      for (const side of [-1, 1]) {
        this.orb(
          g,
          c,
          [side * 1.35, 0.12, 0],
          [0.65, 0.33, 0.13],
          [0, 0, side * 32],
        );
        for (let i = 0; i < 6; i++)
          this.orb(
            g,
            i % 2 ? a : c,
            [side * (1.32 + i * 0.14), 0.03 + i * 0.085, 0.04],
            [0.17, 0.58 - i * 0.045, 0.09],
            [0, 0, -side * (38 + i * 7)],
          );
        this.orb(
          g,
          a,
          [side * 1.08, -0.05, 0.12],
          [0.25, 0.16, 0.075],
          [0, 0, side * 25],
        );
      }
    } else if (p.kind === "shirt") {
      const profile: THREE.Vector2[] = [];
      for (let i = 0; i <= 24; i++) {
        const y = 0.37 + (i / 24) * 1.12;
        const r =
          1.075 * Math.sqrt(Math.max(0.01, 1 - ((y - 1.01) / 0.78) ** 2)) +
          0.035;
        profile.push(new THREE.Vector2(r, y));
      }
      const cloth = new THREE.LatheGeometry(profile, 48);
      cloth.scale(1, 1, 0.6);
      cloth.translate(0, 0, -0.08);
      this.mesh(g, cloth, c);
      for (const side of [-1, 1])
        this.orb(
          g,
          c,
          [side * 1.08, 1.07, 0.04],
          [0.28, 0.19, 0.18],
          [0, 0, -side * 35],
        );
      for (let i = 0; i < 3; i++)
        this.orb(g, a, [0, 1.14 - i * 0.22, 0.58], [0.045, 0.045, 0.03]);
      this.orb(g, a, [-0.45, 1.12, 0.5], [0.13, 0.11, 0.025]);
    } else if (p.kind === "cape") {
      const shape = new THREE.Shape();
      shape.moveTo(-0.45, 0.08);
      shape.quadraticCurveTo(-0.8, -0.3, -1.05, -1.03);
      shape.quadraticCurveTo(0, -1.24, 1.05, -1.03);
      shape.quadraticCurveTo(0.8, -0.3, 0.45, 0.08);
      shape.closePath();
      this.mesh(
        g,
        new THREE.ExtrudeGeometry(shape, {
          depth: 0.065,
          bevelEnabled: true,
          bevelSize: 0.04,
          bevelThickness: 0.025,
          bevelSegments: 3,
          steps: 1,
        }),
        c,
        [0, 0, -0.08],
      );
      this.orb(g, a, [0, 0.05, 0.05], [0.18, 0.08, 0.08]);
    } else if (p.kind === "hat") {
      this.mesh(
        g,
        new THREE.CylinderGeometry(0.86, 0.86, 0.065, 48),
        c,
        [0, 0.12, 0],
        [1, 1, 0.75],
      );
      this.mesh(
        g,
        new THREE.CylinderGeometry(0.45, 0.56, 0.48, 40),
        c,
        [0, 0.38, 0],
        [1, 1, 0.85],
      );
      this.mesh(
        g,
        new THREE.CylinderGeometry(0.535, 0.56, 0.095, 40),
        a,
        [0, 0.22, 0],
        [1, 1, 0.86],
      );
      this.mesh(g, this.star(), a, [0.25, 0.36, 0.48], [0.2, 0.2, 0.2]);
    } else if (p.kind === "crown") {
      this.mesh(
        g,
        new THREE.CylinderGeometry(0.46, 0.46, 0.17, 40, 1, true),
        c,
        [0, 0.11, 0],
        [1, 1, 0.8],
      );
      for (let i = 0; i < 7; i++) {
        const t = (i * Math.PI * 2) / 7;
        this.mesh(g, new THREE.ConeGeometry(0.12, 0.3, 4), c, [
          Math.sin(t) * 0.43,
          0.32,
          Math.cos(t) * 0.34,
        ]);
        this.orb(
          g,
          a,
          [Math.sin(t) * 0.43, 0.49, Math.cos(t) * 0.34],
          [0.045, 0.045, 0.045],
        );
      }
      this.orb(g, a, [0, 0.12, 0.38], [0.07, 0.075, 0.035]);
    } else if (p.kind === "glasses") {
      for (const side of [-1, 1]) {
        this.mesh(g, new THREE.TorusGeometry(0.24, 0.028, 10, 40), c, [
          side * 0.37,
          0,
          0,
        ]);
        this.mesh(
          g,
          new THREE.BoxGeometry(0.24, 0.028, 0.035),
          c,
          [side * 0.72, 0, -0.09],
          [1, 1, 1],
          [0, side * 40, 0],
        );
      }
      this.mesh(
        g,
        new THREE.BoxGeometry(0.26, 0.028, 0.035),
        c,
        [0, 0.02, 0.01],
      );
    } else if (p.kind === "scarf") {
      this.mesh(
        g,
        new THREE.TorusGeometry(0.67, 0.105, 12, 48),
        c,
        [0, 0, -0.55],
        [1.3, 0.75, 1],
        [90, 0, 0],
      );
      this.mesh(
        g,
        new THREE.CapsuleGeometry(0.12, 0.43, 6, 16),
        c,
        [0.3, -0.29, 0.02],
        [1, 1, 0.4],
        [0, 0, -12],
      );
      this.orb(g, a, [0.3, -0.12, 0.075], [0.14, 0.05, 0.03]);
    } else if (p.kind === "bow") {
      for (const side of [-1, 1])
        this.orb(
          g,
          c,
          [side * 0.18, 0, 0],
          [0.2, 0.14, 0.075],
          [0, 0, side * 20],
        );
      this.orb(g, a, [0, 0, 0.06], [0.08, 0.085, 0.055]);
    } else if (p.kind === "star")
      this.mesh(g, this.star(), c, [0, 0, 0.1], [0.5, 0.5, 0.5]);
    for (const component of p.components) this.primitive(g, component);
    return g;
  }
  geometryIds() {
    const ids: number[] = [];
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) ids.push(o.geometry.id);
    });
    return ids;
  }
  dispose() {
    for (const e of this.entries.values()) this.release(e.root);
    this.entries.clear();
  }
}
