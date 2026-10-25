/** Read-only evidence capture for ac93896. Run from the repository root:
 * node --import tsx docs/evidence/initial-render-review/measure-model.ts
 * No app server or user data is read/written.
 */
import * as THREE from "three";
import { ChiikawaModel } from "../../../src/adapters/ChiikawaModel.js";
import { DEFAULT_CHARACTER } from "../../../src/domain/character.js";

const model = new ChiikawaModel();
model.update(DEFAULT_CHARACTER);
model.root.updateMatrixWorld(true);
const body = model.root.getObjectByName("body-volume") as THREE.Mesh;
const positions = body.geometry.getAttribute("position");
let headRadius = 0;
let torsoRadius = 0;
let top = -Infinity;
for (let i = 0; i < positions.count; i++) {
  const y = positions.getY(i);
  const x = Math.abs(positions.getX(i));
  if (y >= 1.34) headRadius = Math.max(headRadius, x);
  if (y >= 0.6 && y <= 1.2) torsoRadius = Math.max(torsoRadius, x);
  top = Math.max(top, y);
}
const center = (name: string, firstChild = false) => {
  const object = model.root.getObjectByName(name)!;
  return (firstChild ? object.children[0] : object)
    .getWorldPosition(new THREE.Vector3())
    .toArray();
};
console.log(
  JSON.stringify(
    {
      headWidth: 2 * headRadius,
      headHeight: top - 1.34,
      headHeightToWidth: (top - 1.34) / (2 * headRadius),
      torsoWidth: 2 * torsoRadius,
      headToTorsoWidth: headRadius / torsoRadius,
      eyeCenters: [center("left-eye"), center("right-eye")],
      earCenters: [center("left-ear", true), center("right-ear", true)],
      armCenters: [center("left-arm"), center("right-arm")],
    },
    null,
    2,
  ),
);
model.dispose();
