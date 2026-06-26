/**
 * syntheticJaw — generates a runtime jaw bone + skinning for avatars that have
 * no jaw bone and no mouth blendshapes. Enables jaw-rotation lip sync on
 * AI-generated avatars (Meshy, etc.) without manual Blender editing.
 */
import * as THREE from 'three';

const SYNTHETIC_JAW_NAME = '__synthetic_jaw';
const _dbg = () => import.meta.env.DEV;

// ── Mouth position estimation ───────────────────────────────────────────────

/**
 * Estimate the world-space position of the mouth from the mesh geometry.
 *
 * Strategy (by priority):
 *   1. Head vertex-group bounding box — filters vertices weighted to the head
 *      bone and places the mouth at ~33% below the top of that bbox, on the
 *      front face (head bone's -Z local axis).
 *   2. Global bbox fallback — uses the top ~13% of the full mesh height as an
 *      approximation for the head region.
 *
 * @param {THREE.SkinnedMesh} mesh
 * @param {THREE.Bone} headBone
 * @param {THREE.Skeleton} skeleton
 * @returns {THREE.Vector3} world-space mouth position
 */
export function estimateMouthPosition(mesh, headBone, skeleton) {
  const geom = mesh.geometry;
  const posAttr = geom.attributes.position;
  const skinIdx = geom.attributes.skinIndex;
  const skinWt = geom.attributes.skinWeight;

  const headBoneIndex = skeleton.bones.indexOf(headBone);

  const headVerts = [];
  const MIN_WEIGHT = 0.3;

  if (headBoneIndex >= 0 && skinIdx && skinWt) {
    for (let i = 0; i < posAttr.count; i++) {
      let weightOnHead = 0;
      for (let s = 0; s < skinIdx.itemSize; s++) {
        if (skinIdx.getComponent(i, s) === headBoneIndex) {
          weightOnHead += skinWt.getComponent(i, s);
        }
      }
      if (weightOnHead >= MIN_WEIGHT) {
        const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
        mesh.localToWorld(v);
        headVerts.push(v);
      }
    }
  }

  if (_dbg()) console.log(`[SyntheticJaw] head verts found: ${headVerts.length}`);

  if (headVerts.length >= 8) {
    return _mouthFromHeadVerts(headVerts, headBone);
  }

  if (_dbg()) console.log('[SyntheticJaw] head verts too few, using global bbox fallback');
  return _mouthFromGlobalBbox(mesh);
}

/**
 * Mouth position from head-weighted vertices: 33% down from top of bbox,
 * on the front face (head bone forward direction).
 */
function _mouthFromHeadVerts(verts, headBone) {
  const bbox = new THREE.Box3();
  for (const v of verts) bbox.expandByPoint(v);

  const center = new THREE.Vector3();
  bbox.getCenter(center);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  // Mouth Y: 33% down from the top of the head bbox
  const mouthY = bbox.max.y - size.y * 0.33;

  // Forward direction: head bone's -Z in world space
  const fwd = new THREE.Vector3(0, 0, -1);
  const worldQ = new THREE.Quaternion();
  headBone.getWorldQuaternion(worldQ);
  fwd.applyQuaternion(worldQ);

  // Push mouth toward the front surface of the head bbox
  const frontOffset = Math.max(size.x, size.z) * 0.4;
  const mouth = new THREE.Vector3(
    center.x + fwd.x * frontOffset,
    mouthY,
    center.z + fwd.z * frontOffset,
  );

  if (_dbg()) {
    console.log('[SyntheticJaw] head bbox size:', size.toArray().map(n => n.toFixed(4)));
    console.log('[SyntheticJaw] head bbox min/max Y:', bbox.min.y.toFixed(4), bbox.max.y.toFixed(4));
    console.log('[SyntheticJaw] estimated mouth (world):', mouth.toArray().map(n => n.toFixed(4)));
  }
  return mouth;
}

/**
 * Fallback: top 13% of total mesh height as head region, mouth at 30% within.
 */
function _mouthFromGlobalBbox(mesh) {
  const geom = mesh.geometry;
  geom.computeBoundingBox();
  const bbox = geom.boundingBox.clone();
  bbox.applyMatrix4(mesh.matrixWorld);

  const totalH = bbox.max.y - bbox.min.y;
  const headH = totalH * 0.13;

  const center = new THREE.Vector3();
  bbox.getCenter(center);

  return new THREE.Vector3(
    center.x,
    bbox.max.y - headH * 0.30,
    bbox.min.z + (bbox.max.z - bbox.min.z) * 0.35,
  );
}

// ── Skeleton surgery: add bone + inverse ────────────────────────────────────

function _addBoneToSkeleton(skeleton, newBone) {
  const newIndex = skeleton.bones.length;

  skeleton.bones.push(newBone);

  newBone.updateWorldMatrix(true, false);
  const invMat = new THREE.Matrix4().copy(newBone.matrixWorld).invert();
  skeleton.boneInverses.push(invMat);

  skeleton.boneMatrices = new Float32Array(skeleton.bones.length * 16);

  if (skeleton.boneTexture) {
    skeleton.boneTexture.dispose();
    skeleton.boneTexture = null;
  }
  if (typeof skeleton.computeBoneTexture === 'function') {
    skeleton.computeBoneTexture();
  } else if (typeof skeleton.init === 'function') {
    skeleton.init();
  }

  return newIndex;
}

// ── Skin weight assignment ──────────────────────────────────────────────────

function _assignSkinWeights(mesh, mouthWorldPos, jawBoneIndex, headBoneIndex, radius) {
  const geom = mesh.geometry;
  const posAttr = geom.attributes.position;
  const skinIdx = geom.attributes.skinIndex;
  const skinWt = geom.attributes.skinWeight;
  if (!skinIdx || !skinWt) return 0;

  const radiusSq = radius * radius;
  let affected = 0;

  for (let i = 0; i < posAttr.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
    mesh.localToWorld(v);

    const distSq = v.distanceToSquared(mouthWorldPos);
    if (distSq > radiusSq) continue;

    const dist = Math.sqrt(distSq);
    const jawWeight = Math.max(0, 1 - (dist / radius) ** 2) * 0.6;
    if (jawWeight < 0.01) continue;

    _insertJawWeight(skinIdx, skinWt, i, jawBoneIndex, headBoneIndex, jawWeight);
    affected++;
  }

  skinIdx.needsUpdate = true;
  skinWt.needsUpdate = true;

  return affected;
}

function _insertJawWeight(skinIdx, skinWt, vertexIndex, jawBoneIndex, headBoneIndex, jawWeight) {
  const slots = skinIdx.itemSize;

  const indices = [];
  const weights = [];
  for (let s = 0; s < slots; s++) {
    indices.push(skinIdx.getComponent(vertexIndex, s));
    weights.push(skinWt.getComponent(vertexIndex, s));
  }

  for (let s = 0; s < slots; s++) {
    if (indices[s] === jawBoneIndex && weights[s] > 0) return;
  }

  // Find a free slot or the one with minimum weight
  let targetSlot = -1;
  let minWeight = Infinity;
  let minSlot = 0;
  for (let s = 0; s < slots; s++) {
    if (weights[s] < 0.001) { targetSlot = s; break; }
    if (weights[s] < minWeight) { minWeight = weights[s]; minSlot = s; }
  }
  if (targetSlot < 0) targetSlot = minSlot;

  // Reduce head bone weight to make room
  let headSlot = -1;
  for (let s = 0; s < slots; s++) {
    if (indices[s] === headBoneIndex && weights[s] > 0) { headSlot = s; break; }
  }

  const effectiveJawWeight = Math.min(jawWeight, headSlot >= 0 ? weights[headSlot] * 0.8 : jawWeight);

  if (headSlot >= 0) weights[headSlot] -= effectiveJawWeight;

  indices[targetSlot] = jawBoneIndex;
  weights[targetSlot] = effectiveJawWeight;

  // Normalize
  let total = 0;
  for (let s = 0; s < slots; s++) total += weights[s];
  if (total > 0) {
    for (let s = 0; s < slots; s++) weights[s] /= total;
  }

  for (let s = 0; s < slots; s++) {
    skinIdx.setComponent(vertexIndex, s, indices[s]);
    skinWt.setComponent(vertexIndex, s, weights[s]);
  }
}

// ── Debug visualization ─────────────────────────────────────────────────────

/**
 * Create a small sphere marker at the jaw bone position and a wireframe sphere
 * showing the influence radius — helps verify placement visually.
 * Call from SceneCanvas after injectSyntheticJaw when in dev mode.
 *
 * @param {THREE.Scene} scene
 * @param {THREE.Bone} jawBone
 * @param {number} radius  influence radius used for skinning
 * @returns {{ marker: THREE.Mesh, radiusSphere: THREE.Mesh, dispose: () => void }}
 */
export function createJawDebugVisuals(scene, jawBone, radius) {
  // Jaw bone position marker (red sphere)
  const markerGeo = new THREE.SphereGeometry(0.006, 8, 8);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.renderOrder = 9999;
  jawBone.add(marker);

  // Influence radius (wireframe sphere, yellow)
  const radiusGeo = new THREE.SphereGeometry(radius, 16, 12);
  const radiusMat = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
    depthTest: false,
  });
  const radiusSphere = new THREE.Mesh(radiusGeo, radiusMat);
  radiusSphere.renderOrder = 9998;
  jawBone.add(radiusSphere);

  return {
    marker,
    radiusSphere,
    dispose() {
      jawBone.remove(marker);
      jawBone.remove(radiusSphere);
      markerGeo.dispose();
      markerMat.dispose();
      radiusGeo.dispose();
      radiusMat.dispose();
    },
  };
}

// ── Main entry point ────────────────────────────────────────────────────────

/**
 * @param {THREE.Object3D} model
 * @param {import('./BoneMapper').BoneMapper} boneMapper
 * @returns {{ jawBone: THREE.Bone, radius: number } | null}
 */
export function injectSyntheticJaw(model, boneMapper) {
  const headBone = boneMapper?.get('head');
  if (!headBone) {
    if (_dbg()) console.log('[SyntheticJaw] no head bone found — skipping');
    return null;
  }

  let skinnedMesh = null;
  model.traverse((node) => {
    if (!skinnedMesh && node.isSkinnedMesh && node.skeleton) {
      skinnedMesh = node;
    }
  });
  if (!skinnedMesh) {
    if (_dbg()) console.log('[SyntheticJaw] no SkinnedMesh found — skipping');
    return null;
  }

  const skeleton = skinnedMesh.skeleton;
  const headBoneIndex = skeleton.bones.indexOf(headBone);
  if (headBoneIndex < 0) {
    if (_dbg()) console.log('[SyntheticJaw] head bone not in skeleton — skipping');
    return null;
  }

  model.updateMatrixWorld(true);
  const mouthWorldPos = estimateMouthPosition(skinnedMesh, headBone, skeleton);

  // Create synthetic jaw bone as child of head
  const jawBone = new THREE.Bone();
  jawBone.name = SYNTHETIC_JAW_NAME;
  headBone.add(jawBone);

  // Position in head-local space
  const headWorldInv = new THREE.Matrix4().copy(headBone.matrixWorld).invert();
  const localPos = mouthWorldPos.clone().applyMatrix4(headWorldInv);
  jawBone.position.copy(localPos);
  jawBone.updateWorldMatrix(true, false);

  const jawBoneIndex = _addBoneToSkeleton(skeleton, jawBone);

  // Compute head bbox for radius calculation (reuse head verts logic)
  const headBbox = new THREE.Box3();
  const posAttr = skinnedMesh.geometry.attributes.position;
  const skinIdxAttr = skinnedMesh.geometry.attributes.skinIndex;
  const skinWtAttr = skinnedMesh.geometry.attributes.skinWeight;

  if (skinIdxAttr && skinWtAttr) {
    for (let i = 0; i < posAttr.count; i++) {
      let wt = 0;
      for (let s = 0; s < skinIdxAttr.itemSize; s++) {
        if (skinIdxAttr.getComponent(i, s) === headBoneIndex) {
          wt += skinWtAttr.getComponent(i, s);
        }
      }
      if (wt >= 0.3) {
        const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
        skinnedMesh.localToWorld(v);
        headBbox.expandByPoint(v);
      }
    }
  }

  const headHeight = headBbox.isEmpty() ? 0.2 : (headBbox.max.y - headBbox.min.y);
  const radius = headHeight * 0.28;

  const affectedCount = _assignSkinWeights(
    skinnedMesh, mouthWorldPos, jawBoneIndex, headBoneIndex, radius,
  );

  if (_dbg()) {
    console.log(`[SyntheticJaw] created "${SYNTHETIC_JAW_NAME}" as child of "${headBone.name}"`);
    console.log(`[SyntheticJaw] mouth pos (world): [${mouthWorldPos.toArray().map(n => n.toFixed(4)).join(', ')}]`);
    console.log(`[SyntheticJaw] head height: ${headHeight.toFixed(4)}, radius: ${radius.toFixed(4)}`);
    console.log(`[SyntheticJaw] affected vertices: ${affectedCount}`);
    console.log(`[SyntheticJaw] skeleton now has ${skeleton.bones.length} bones`);
  }

  if (affectedCount === 0 && _dbg()) {
    console.warn('[SyntheticJaw] no vertices affected — jaw may not visually move');
  }

  return { jawBone, radius };
}

/**
 * Reposition an existing synthetic jaw bone to a new world-space point and
 * recalculate skin weights around it.
 *
 * @param {THREE.Object3D} model
 * @param {THREE.Bone} jawBone        the existing synthetic jaw bone
 * @param {THREE.Vector3} worldPos    new mouth position in world space
 * @param {import('./BoneMapper').BoneMapper} boneMapper
 * @returns {{ radius: number, affected: number }}
 */
export function repositionSyntheticJaw(model, jawBone, worldPos, boneMapper, customRadius) {
  const headBone = boneMapper?.get('head');
  if (!headBone) return { radius: 0, affected: 0 };

  let skinnedMesh = null;
  model.traverse((node) => {
    if (!skinnedMesh && node.isSkinnedMesh && node.skeleton) skinnedMesh = node;
  });
  if (!skinnedMesh) return { radius: 0, affected: 0 };

  const skeleton = skinnedMesh.skeleton;
  const headBoneIndex = skeleton.bones.indexOf(headBone);
  const jawBoneIndex = skeleton.bones.indexOf(jawBone);
  if (headBoneIndex < 0 || jawBoneIndex < 0) return { radius: 0, affected: 0 };

  // Move jaw bone to new position (head-local space)
  model.updateMatrixWorld(true);
  const headWorldInv = new THREE.Matrix4().copy(headBone.matrixWorld).invert();
  const localPos = worldPos.clone().applyMatrix4(headWorldInv);
  jawBone.position.copy(localPos);
  jawBone.updateWorldMatrix(true, false);

  // Recompute bone inverse
  skeleton.boneInverses[jawBoneIndex].copy(jawBone.matrixWorld).invert();

  // Clear old jaw weights from all vertices
  const geom = skinnedMesh.geometry;
  const skinIdx = geom.attributes.skinIndex;
  const skinWt = geom.attributes.skinWeight;
  for (let i = 0; i < skinIdx.count; i++) {
    for (let s = 0; s < skinIdx.itemSize; s++) {
      if (skinIdx.getComponent(i, s) === jawBoneIndex) {
        const wt = skinWt.getComponent(i, s);
        skinIdx.setComponent(i, s, 0);
        skinWt.setComponent(i, s, 0);
        // Return weight to head bone if present
        for (let h = 0; h < skinIdx.itemSize; h++) {
          if (skinIdx.getComponent(i, h) === headBoneIndex) {
            skinWt.setComponent(i, h, skinWt.getComponent(i, h) + wt);
            break;
          }
        }
      }
    }
  }

  // Compute head bbox for radius
  const headBbox = new THREE.Box3();
  const posAttr = geom.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    let wt = 0;
    for (let s = 0; s < skinIdx.itemSize; s++) {
      if (skinIdx.getComponent(i, s) === headBoneIndex) wt += skinWt.getComponent(i, s);
    }
    if (wt >= 0.3) {
      const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
      skinnedMesh.localToWorld(v);
      headBbox.expandByPoint(v);
    }
  }

  const headHeight = headBbox.isEmpty() ? 0.2 : (headBbox.max.y - headBbox.min.y);
  const radius = customRadius != null ? customRadius : headHeight * 0.28;

  const affected = _assignSkinWeights(skinnedMesh, worldPos, jawBoneIndex, headBoneIndex, radius);

  skinIdx.needsUpdate = true;
  skinWt.needsUpdate = true;

  if (_dbg()) {
    console.log(`[SyntheticJaw] repositioned to [${worldPos.toArray().map(n => n.toFixed(4)).join(', ')}]`);
    console.log(`[SyntheticJaw] affected vertices: ${affected}, radius: ${radius.toFixed(4)}`);
  }

  return { radius, affected };
}

export { SYNTHETIC_JAW_NAME };
