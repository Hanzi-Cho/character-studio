import type { Object3D } from "three";
import type { CharacterDocument } from "../domain/character.js";

/** Three-specific model adapter contract; no UI or chat dependencies. */
export interface ThreeCharacterModel {
  readonly root: Object3D;
  update(document: CharacterDocument): boolean;
  getGeometryIds(): number[];
  dispose(): void;
}
