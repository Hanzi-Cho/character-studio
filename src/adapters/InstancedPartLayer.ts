import * as THREE from "three";

export type RenderPart = {
  id: string;
  position: readonly [number, number, number];
  scale: number;
  color: string;
};
/** Dense, repeated-shape adapter. A domain mapper supplies RenderPart[]; the layer knows no character/anatomy fields.
 * Geometry/material are caller-owned, instance buffers are layer-owned.
 * Adapted architecture (original implementation), inspired by Human Atlas chunk/system batching.
 */
export class InstancedPartLayer {
  readonly mesh: THREE.InstancedMesh;
  private readonly indices = new Map<string, number>();
  private readonly values = new Map<string, RenderPart>();
  private readonly transform = new THREE.Object3D();
  private readonly color = new THREE.Color();
  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    readonly capacity: number,
  ) {
    if (!Number.isInteger(capacity) || capacity < 1)
      throw new Error("capacity must be a positive integer");
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; // Caller may spatially chunk layers; moving instances cannot leave stale bounds.
  }
  update(parts: readonly RenderPart[]) {
    const identifiers = new Set<string>();
    let additions = 0;
    for (const part of parts) {
      if (identifiers.has(part.id)) throw new Error("duplicate part id");
      identifiers.add(part.id);
      if (!this.indices.has(part.id)) additions++;
      if (
        !part.id ||
        !Number.isFinite(part.scale) ||
        part.scale <= 0 ||
        part.position.some((value) => !Number.isFinite(value)) ||
        !/^#[a-f\d]{6}$/i.test(part.color)
      )
        throw new Error("invalid part");
    }
    if (this.indices.size + additions > this.capacity)
      throw new Error("batch capacity exceeded");
    let changed = 0,
      matrixChanges = 0,
      colorChanges = 0;
    for (const part of parts) {
      let index = this.indices.get(part.id);
      if (index === undefined) {
        index = this.indices.size;
        this.indices.set(part.id, index);
        this.mesh.count = this.indices.size;
      }
      const previous = this.values.get(part.id);
      if (
        !previous ||
        part.scale !== previous.scale ||
        part.position.some((value, i) => value !== previous.position[i])
      ) {
        this.transform.position.set(...part.position);
        this.transform.scale.setScalar(part.scale);
        this.transform.updateMatrix();
        this.mesh.setMatrixAt(index, this.transform.matrix);
        this.mesh.instanceMatrix.addUpdateRange(index * 16, 16);
        matrixChanges++;
      }
      if (!previous || previous.color !== part.color) {
        this.mesh.setColorAt(index, this.color.set(part.color));
        this.mesh.instanceColor!.addUpdateRange(index * 3, 3);
        colorChanges++;
      }
      if (!previous || JSON.stringify(previous) !== JSON.stringify(part))
        changed++;
      this.values.set(part.id, {
        ...part,
        position: [...part.position] as [number, number, number],
      });
    }
    if (matrixChanges) this.mesh.instanceMatrix.needsUpdate = true;
    if (colorChanges) this.mesh.instanceColor!.needsUpdate = true;
    return { changed, matrixChanges, colorChanges, count: this.mesh.count };
  }
  idAt(index: number) {
    return [...this.indices.keys()][index];
  }
  dispose() {
    this.mesh.dispose();
    this.indices.clear();
    this.values.clear();
  }
}
