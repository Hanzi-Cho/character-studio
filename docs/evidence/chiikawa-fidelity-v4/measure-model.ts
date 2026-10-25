/** Read-only measurement of the current v4 source. Run from the repo root. */
import * as THREE from "three";
import { ChiikawaModel } from "../../../src/adapters/ChiikawaModel.js";
import { CHIIKAWA_RIG, EXPRESSION_BROWS } from "../../../src/adapters/chiikawaRig.js";
import { DEFAULT_CHARACTER } from "../../../src/domain/character.js";
const model = new ChiikawaModel();
model.update(DEFAULT_CHARACTER);
model.root.updateMatrixWorld(true);
const body = model.root.getObjectByName("body-volume") as THREE.Mesh;
const p = body.geometry.getAttribute("position");
const split = body.geometry.userData.cranialVertexCount;
const head = new THREE.Box3(), torso = new THREE.Box3();
for (let i=0;i<p.count;i++) (i<split?head:torso).expandByPoint(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(body.matrixWorld));
const center = (name:string, child=false) => {
  const object = model.root.getObjectByName(name)!;
  return (child?object.children[0]:object).getWorldPosition(new THREE.Vector3()).toArray();
};
const rows = Array.from({length:97},(_,i) => ({y:p.getY(i),radius:Math.max(...Array.from({length:65},(_,j)=>Math.abs(p.getX(j*97+i))))}));
const silhouette = [.17,.25,.30,.45,.60,.75,.85,.90,.95].map(v=>{
  const y=3.1-v*1.76, index=rows.findIndex(row=>row.y>=y), a=rows[index-1], b=rows[index];
  return {v,widthOverNominal:THREE.MathUtils.lerp(a.radius,b.radius,(y-a.y)/(b.y-a.y))/1.16};
});
console.log(JSON.stringify({
  source:"v4 working tree 2026-10-24; closed cranium + inset overlapping torso", units:"model units, not centimeters",
  headWidth:head.max.x-head.min.x,headHeight:head.max.y-head.min.y,
  headHeightToWidth:(head.max.y-head.min.y)/(head.max.x-head.min.x),
  torsoWidth:torso.max.x-torso.min.x,headToTorsoWidth:(head.max.x-head.min.x)/(torso.max.x-torso.min.x),
  eyeCenters:[center("left-eye"),center("right-eye")],
  earCenters:[center("left-ear",true),center("right-ear",true)],
  armCenters:[center("left-arm"),center("right-arm")],
  footCenters:[center("left-foot"),center("right-foot")],
  rig:CHIIKAWA_RIG,eyebrows:EXPRESSION_BROWS,silhouette,geometryPool:model.getGeometryIds().length,
},null,2));
model.dispose();
