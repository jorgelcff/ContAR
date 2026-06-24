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
  const pos = geom.attributes.position;
  const skinIdx = geom.attributes.skinIndex;
  const skinWt = geom.attributes.skinWeight;

  const headBoneIndex = skeleton.bones.indexOf(headBone);

  // Collect world-space positions of vertices significantly weighted to the head bone.
  const headVerts = [];
  const _v = new THREE.Vector3();
  const MIN_WEIGHT = 0.3;

  if (headBoneIndex >= 0 && skinIdx && skinWt) {
    for (let i = 0; i < pos.count; i++) {
      let weightOnHead = 0;
      for (let s = 0; s < skinIdx.itemSize; s++) {
        if (skinIdx.getComponent(i, s) === headBoneIndex) {
          weightOnHead += skinWt.getComponent(i, s);
        }
      }
      if (weightOnHead >= MIN_WEIGHT) {
        _v.fromBufferAttribute(pos, i);
        mesh.localToWorld(_v.clone());
        headVerts.push(_v.clone());
      }
    }
  }

  if (headVerts.length >= 8) {
    return _mouthFromHeadVerts(headVerts, headBone);
  }

  // Fallback: global bbox, top ~13% = head region
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
  headBone.getWorldQuaternion(new THREE.Quaternion()).clone();
  const worldQ = new THREE.Quaternion();
  headBone.getWorldQuaternion(worldQ);
  fwd.applyQuaternion(worldQ);

  // Project bbox center onto the front face along forward axis
  const frontOffset = Math.max(size.x, size.z) * 0.4;
  const mouth = new THREE.Vector3(
    center.x + fwd.x * frontOffset,
    mouthY,
    center.z + fwd.z * frontOffset,
  );

  if (_dbg()) {
    console.log('[SyntheticJaw] head bbox:', { min: bbox.min.toArray(), max: bbox.max.toArray() });
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

  // Transform to world
  const mat = mesh.matrixWorld;
  bbox.applyMatrix4(mat);

  const totalH = bbox.max.y - bbox.min.y;
  const headTop = bbox.max.y;
  const headBottom = headTop - totalH * 0.13;
  const headH = totalH * 0.13;

  const center = new THREE.Vector3();
  bbox.getCenter(center);

  return new THREE.Vector3(
    center.x,
    headTop - headH * 0.30,
    bbox.min.z + (bbox.max.z - bbox.min.z) * 0.35,
  );
}

// ── Skeleton surgery: add bone + inverse ────────────────────────────────────

/**
 * Add a new bone to an existing THREE.Skeleton, updating boneInverses and
 * the internal boneMatrices typed array.
 *
 * @param {THREE.Skeleton} skeleton
 * @param {THREE.Bone} newBone
 */
function _addBoneToSkeleton(skeleton, newBone) {
  const newIndex = skeleton.bones.length;

  // 1. Push bone
  skeleton.bones.push(newBone);

  // 2. Compute bone inverse (bind-pose world matrix inverted)
  newBone.updateWorldMatrix(true, false);
  const invMat = new THREE.Matrix4().copy(newBone.matrixWorld).invert();
  skeleton.boneInverses.push(invMat);

  // 3. Rebuild boneMatrices with new size
  skeleton.boneMatrices = new Float32Array(skeleton.bones.length * 16);

  // 4. Re-bind the skeleton so the texture (if used) is rebuilt
  if (skeleton.boneTexture) {
    skeleton.boneTexture.dispose();
    skeleton.boneTexture = null;
  }
  // THREE.js r150+ computeBoneTexture; older: init()
  if (typeof skeleton.computeBoneTexture === 'function') {
    skeleton.computeBoneTexture();
  } else if (typeof skeleton.init === 'function') {
    skeleton.init();
  }

  return newIndex;
}

// ── Skin weight assignment ──────────────────────────────────────────────────

/**
 * Assign skin weights for the synthetic jaw bone to nearby mouth vertices.
 *
 * For each vertex within `radius` of `mouthPos`, inserts weight for
 * `jawBoneIndex` by blending down existing head-bone weight proportionally.
 *
 * @param {THREE.SkinnedMesh} mesh
 * @param {THREE.Vector3} mouthWorldPos
 * @param {number} jawBoneIndex
 * @param {number} headBoneIndex
 * @param {number} radius  world-space radius of influence
 * @returns {number} count of affected vertices
 */
function _assignSkinWeights(mesh, mouthWorldPos, jawBoneIndex, headBoneIndex, radius) {
  const geom = mesh.geometry;
  const posAttr = geom.attributes.position;
  const skinIdx = geom.attributes.skinIndex;
  const skinWt = geom.attributes.skinWeight;
  if (!skinIdx || !skinWt) return 0;

  const _v = new THREE.Vector3();
  const radiusSq = radius * radius;
  let affected = 0;

  for (let i = 0; i < posAttr.count; i++) {
    _v.fromBufferAttribute(posAttr, i);
    mesh.localToWorld(_v);

    const distSq = _v.distanceToSquared(mouthWorldPos);
    if (distSq > radiusSq) continue;

    const dist = Math.sqrt(distSq);
    // Quadratic falloff: full weight at center, zero at edge
    const jawWeight = Math.max(0, 1 - (dist / radius) ** 2) * 0.6;
    if (jawWeight < 0.01) continue;

    _insertJawWeight(skinIdx, skinWt, i, jawBoneIndex, headBoneIndex, jawWeight);
    affected++;
  }

  // Mark attributes as needing GPU upload
  skinIdx.needsUpdate = true;
  skinWt.needsUpdate = true;

  return affected;
}

/**
 * Insert jaw weight into a vertex's 4-slot skin influences, reducing the
 * head bone weight proportionally and keeping the total normalized to 1.0.
 */
function _insertJawWeight(skinIdx, skinWt, vertexIndex, jawBoneIndex, headBoneIndex, jawWeight) {
  const slots = skinIdx.itemSize; // typically 4

  // Read current slots
  const indices = [];
  const weights = [];
  for (let s = 0; s < slots; s++) {
    indices.push(skinIdx.getComponent(vertexIndex, s));
    weights.push(skinWt.getComponent(vertexIndex, s));
  }

  // Check if jaw already assigned (shouldn't happen, but guard)
  for (let s = 0; s < slots; s++) {
    if (indices[s] === jawBoneIndex && weights[s] > 0) return;
  }

  // Find a free slot (weight ≈ 0) or the slot with minimum weight
  let targetSlot = -1;
  let minWeight = Infinity;
  let minSlot = 0;
  for (let s = 0; s < slots; s++) {
    if (weights[s] < 0.001) {
      targetSlot = s;
      break;
    }
    if (weights[s] < minWeight) {
      minWeight = weights[s];
      minSlot = s;
    }
  }
  if (targetSlot < 0) targetSlot = minSlot;

  // Reduce head bone weight proportionally to make room for jaw
  let headSlot = -1;
  for (let s = 0; s < slots; s++) {
    if (indices[s] === headBoneIndex && weights[s] > 0) {
      headSlot = s;
      break;
    }
  }

  const effectiveJawWeight = Math.min(jawWeight, headSlot >= 0 ? weights[headSlot] * 0.8 : jawWeight);

  if (headSlot >= 0) {
    weights[headSlot] -= effectiveJawWeight;
  }

  indices[targetSlot] = jawBoneIndex;
  weights[targetSlot] = effectiveJawWeight;

  // Normalize so sum = 1.0
  let total = 0;
  for (let s = 0; s < slots; s++) total += weights[s];
  if (total > 0) {
    for (let s = 0; s < slots; s++) weights[s] /= total;
  }

  // Write back
  for (let s = 0; s < slots; s++) {
    skinIdx.setComponent(vertexIndex, s, indices[s]);
    skinWt.setComponent(vertexIndex, s, weights[s]);
  }
}

// ── Main entry point ────────────────────────────────────────────────────────

/**
 * Create a synthetic jaw bone for an avatar that has no jaw bone and no mouth
 * blendshapes. The bone is added to the skeleton, skinning weights are assigned,
 * and the bone is returned for use by LipSyncController / resolveJawBones.
 *
 * @param {THREE.Object3D} model   the loaded avatar root
 * @param {import('./BoneMapper').BoneMapper} boneMapper
 * @returns {THREE.Bone|null}  the synthetic jaw bone, or null if not applicable
 */
export function injectSyntheticJaw(model, boneMapper) {
  const headBone = boneMapper?.get('head');
  if (!headBone) {
    if (_dbg()) console.log('[SyntheticJaw] no head bone found — skipping');
    return null;
  }

  // Find the first SkinnedMesh with a skeleton
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

  // Estimate mouth position from geometry
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

  // Add to skeleton
  const jawBoneIndex = _addBoneToSkeleton(skeleton, jawBone);

  // Compute influence radius: ~10% of head bbox height
  const headBbox = new THREE.Box3();
  const _v = new THREE.Vector3();
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
        _v.fromBufferAttribute(posAttr, i);
        skinnedMesh.localToWorld(_v);
        headBbox.expandByPoint(_v);
      }
    }
  }

  const headHeight = headBbox.isEmpty() ? 0.2 : (headBbox.max.y - headBbox.min.y);
  const radius = headHeight * 0.10;

  // Assign skin weights
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

  if (affectedCount === 0) {
    if (_dbg()) console.warn('[SyntheticJaw] no vertices affected — jaw may not visually move');
  }

  return jawBone;
}

export { SYNTHETIC_JAW_NAME };
