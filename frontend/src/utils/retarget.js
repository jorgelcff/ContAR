import * as THREE from 'three';

/**
 * Hierarchical rotation retargeting between two skeletons.
 *
 * A Mixamo clip stores, for each bone, a rotation *relative to that bone's own
 * rest orientation in Mixamo's rig*. Copying those quaternions onto another
 * skeleton only works while both rigs rest the same way — true for Avaturn and
 * Ready Player Me, false for FBX-converted libraries (VALID, many CC0 packs),
 * whose bones rest 90–180° away. Copied verbatim, the character folds up.
 *
 * The fix is to transfer the *world-space* rotation each bone undergoes,
 * rather than its raw local value. For every bone b and time t:
 *
 *   D[b](t) = WS[b](t) · WSrest[b]⁻¹        world delta the source performs
 *   WT[b](t) = D[b](t) · WTrest[b]          same delta, from the target's rest
 *   qt[b](t) = WT[parent(b)](t)⁻¹ · WT[b](t)   back to a local rotation
 *
 * evaluated parents-first so WT[parent] is always known. When both skeletons
 * rest identically this collapses to qt == qs exactly, so a rig that already
 * matches the source is reproduced bit for bit.
 *
 * Only rotations are handled: position tracks are dropped upstream (they encode
 * the source's bone lengths) and scale tracks fight the bind pose.
 */

/**
 * The orientation of a character's body — which way is up and which way it
 * faces — as a rotation from a canonical frame (+Y up, +Z forward).
 *
 * World-space transfer (below) assumes the two skeletons stand the same way
 * round. Most Mixamo exports do, but not all: the bundled run.glb was
 * re-exported through another tool and its character faces −Z while every
 * other clip and the avatar face +Z. A world delta that swings the source's
 * leg toward *its* front then swings the avatar's leg toward *its* back — the
 * run played with the thighs reaching backwards and the torso leaning back,
 * which reads as hands and feet on the wrong sides.
 *
 * Built from joint positions rather than bone rotations, because rotations are
 * exactly what differ between conventions; the body's shape does not.
 *
 * @param {object} p  world-space joint positions (THREE.Vector3)
 * @param {THREE.Vector3} p.hips
 * @param {THREE.Vector3} p.head
 * @param {THREE.Vector3} p.leftUpLeg
 * @param {THREE.Vector3} p.rightUpLeg
 * @returns {THREE.Quaternion|null}  null when the joints do not define a frame
 */
export function bodyFrame({ hips, head, leftUpLeg, rightUpLeg } = {}) {
  if (!hips || !head || !leftUpLeg || !rightUpLeg) return null;
  const up = new THREE.Vector3().subVectors(head, hips);
  if (up.lengthSq() < 1e-10) return null;
  up.normalize();
  // Toward the character's own right, flattened against up.
  const right = new THREE.Vector3().subVectors(rightUpLeg, leftUpLeg);
  right.addScaledVector(up, -right.dot(up));
  if (right.lengthSq() < 1e-10) return null;
  right.normalize();
  const forward = new THREE.Vector3().crossVectors(up, right).normalize();
  // Columns are where the canonical axes land: +X is the character's left
  // (so that X, Y, Z stay right-handed), +Y up, +Z forward.
  const left = right.clone().negate();
  const basis = new THREE.Matrix4().makeBasis(left, up, forward);
  return new THREE.Quaternion().setFromRotationMatrix(basis);
}

/** Orders node names so every parent precedes its children. */
function topoOrder(nodes) {
  const order = [];
  const done = new Set();
  const walk = (name) => {
    if (done.has(name)) return;
    const node = nodes.get(name);
    if (!node) return;
    done.add(name); // marked before recursing: guards against malformed cycles
    if (node.parent && nodes.has(node.parent)) {
      done.delete(name);
      walk(node.parent);
      done.add(name);
    }
    order.push(name);
  };
  for (const name of nodes.keys()) walk(name);
  return order;
}

/** Accumulates local rotations down the hierarchy into world rotations. */
function worldRotations(nodes, order, localOf, out = new Map()) {
  out.clear();
  for (const name of order) {
    const parent = nodes.get(name).parent;
    const world = out.get(name) || new THREE.Quaternion();
    const parentWorld = parent ? out.get(parent) : null;
    if (parentWorld) world.copy(parentWorld).multiply(localOf(name));
    else world.copy(localOf(name));
    out.set(name, world);
  }
  return out;
}

const _sa = new THREE.Quaternion();
const _sb = new THREE.Quaternion();

/** Samples a quaternion track at time t (slerp between the bracketing keys). */
function sampleQuaternion(times, values, t, out) {
  const n = times.length;
  if (n === 0) return out.identity();
  if (t <= times[0]) return out.fromArray(values, 0);
  if (t >= times[n - 1]) return out.fromArray(values, (n - 1) * 4);

  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid;
  }
  const span = times[hi] - times[lo];
  const alpha = span > 0 ? (t - times[lo]) / span : 0;
  _sa.fromArray(values, lo * 4);
  _sb.fromArray(values, hi * 4);
  return out.copy(_sa).slerp(_sb, alpha);
}

/**
 * @param {object} args
 * @param {Array<{name: string, times: ArrayLike<number>, values: ArrayLike<number>}>} args.tracks
 *   Quaternion tracks, already renamed to target bone names.
 * @param {Map<string, string>} args.sourceOf  target bone name → source bone name.
 * @param {Map<string, {quaternion: THREE.Quaternion, parent: string|null}>} args.sourceRest
 * @param {Map<string, {quaternion: THREE.Quaternion, parent: string|null}>} args.targetRest
 * @param {THREE.Quaternion|null} [args.sourceFrame]  bodyFrame() of the source,
 *   in the same space its rest rotations accumulate into.
 * @param {THREE.Quaternion|null} [args.targetFrame]  likewise for the target.
 *   With both given, each world delta is re-expressed from the source's body
 *   orientation into the target's; without them the two are assumed to match,
 *   which is the previous behaviour exactly.
 * @returns {Array<{name: string, times: Float32Array, values: Float32Array}>|null}
 *   Retargeted tracks, or null when the inputs don't describe a usable pair.
 */
export function retargetRotationTracks({
  tracks, sourceOf, sourceRest, targetRest, sourceFrame = null, targetFrame = null,
}) {
  if (!tracks?.length || !sourceOf?.size || !sourceRest?.size || !targetRest?.size) return null;

  // Union of every track's sample times — tracks may disagree on keyframe times.
  const timeSet = new Set();
  for (const track of tracks) for (let i = 0; i < track.times.length; i++) timeSet.add(track.times[i]);
  const times = Float32Array.from([...timeSet].sort((a, b) => a - b));
  if (!times.length) return null;

  const sourceOrder = topoOrder(sourceRest);
  const targetOrder = topoOrder(targetRest);

  const sourceRestLocal = (name) => sourceRest.get(name).quaternion;
  const targetRestLocal = (name) => targetRest.get(name).quaternion;
  const sourceWorldRest = worldRotations(sourceRest, sourceOrder, sourceRestLocal);
  const targetWorldRest = worldRotations(targetRest, targetOrder, targetRestLocal);

  // Animated source bones, keyed by source name.
  const trackBySource = new Map();
  for (const track of tracks) {
    const source = sourceOf.get(track.name);
    if (source && sourceRest.has(source)) trackBySource.set(source, track);
  }
  if (!trackBySource.size) return null;

  const out = tracks.map((track) => ({
    name: track.name,
    times,
    values: new Float32Array(times.length * 4),
  }));

  const sourceLocal = new Map();
  for (const name of sourceOrder) sourceLocal.set(name, new THREE.Quaternion());
  const sourceWorld = new Map();
  const targetWorld = new Map();
  const targetLocal = new Map();
  for (const name of targetOrder) targetLocal.set(name, new THREE.Quaternion());

  const delta = new THREE.Quaternion();
  const inverse = new THREE.Quaternion();

  // A = targetFrame · sourceFrame⁻¹ carries a direction from the source's body
  // orientation into the target's; a world delta D is carried as A·D·A⁻¹.
  const align = sourceFrame && targetFrame
    ? new THREE.Quaternion().copy(targetFrame).multiply(sourceFrame.clone().invert())
    : null;
  const alignInverse = align ? align.clone().invert() : null;

  for (let f = 0; f < times.length; f++) {
    const t = times[f];

    // Source pose at t: animated bones from their track, the rest at bind pose.
    for (const name of sourceOrder) {
      const local = sourceLocal.get(name);
      const track = trackBySource.get(name);
      if (track) sampleQuaternion(track.times, track.values, t, local);
      else local.copy(sourceRest.get(name).quaternion);
    }
    worldRotations(sourceRest, sourceOrder, (n) => sourceLocal.get(n), sourceWorld);

    // Target pose: mapped bones inherit the source's world delta, others rest.
    targetWorld.clear();
    for (const name of targetOrder) {
      const parent = targetRest.get(name).parent;
      const parentWorld = parent ? targetWorld.get(parent) : null;
      const local = targetLocal.get(name);
      const source = sourceOf.get(name);

      if (source && sourceWorld.has(source)) {
        delta.copy(sourceWorld.get(source)).multiply(inverse.copy(sourceWorldRest.get(source)).invert());
        if (align) delta.premultiply(align).multiply(alignInverse);
        const world = delta.multiply(targetWorldRest.get(name));
        if (parentWorld) local.copy(inverse.copy(parentWorld).invert()).multiply(world);
        else local.copy(world);
        targetWorld.set(name, world.clone());
      } else {
        local.copy(targetRest.get(name).quaternion);
        const world = parentWorld
          ? new THREE.Quaternion().copy(parentWorld).multiply(local)
          : local.clone();
        targetWorld.set(name, world);
      }
    }

    for (const track of out) {
      const local = targetLocal.get(track.name);
      if (!local) continue;
      const i = f * 4;
      track.values[i] = local.x;
      track.values[i + 1] = local.y;
      track.values[i + 2] = local.z;
      track.values[i + 3] = local.w;
    }
  }

  return out;
}
