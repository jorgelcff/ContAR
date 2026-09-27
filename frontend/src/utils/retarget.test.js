import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { retargetRotationTracks, bodyFrame } from './retarget';

// Keyframes are stored in Float32Array, and angleTo()'s acos() amplifies that
// rounding near dot≈1 by a square root: a ~6e-8 component error surfaces as
// ~3e-4 rad. So compare at 1e-3 rad (0.06°) — far below anything visible, but
// above the floor the storage format imposes.
const TOLERANCE = 1e-3;

const euler = (x, y, z) =>
  new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(x),
    THREE.MathUtils.degToRad(y),
    THREE.MathUtils.degToRad(z),
  ));

/** A three-bone chain: root → middle → tip. */
function chain(rootQ, midQ, tipQ) {
  return new Map([
    ['root', { quaternion: rootQ, parent: null }],
    ['mid', { quaternion: midQ, parent: 'root' }],
    ['tip', { quaternion: tipQ, parent: 'mid' }],
  ]);
}

function track(name, times, quats) {
  const values = new Float32Array(quats.length * 4);
  quats.forEach((q, i) => q.toArray(values, i * 4));
  return { name, times: Float32Array.from(times), values };
}

const identityMap = new Map([['root', 'root'], ['mid', 'mid'], ['tip', 'tip']]);

/** World rotation of `name`, walking the chain and applying `locals`. */
function worldOf(rest, locals, name) {
  const out = new THREE.Quaternion();
  const stack = [];
  for (let n = name; n; n = rest.get(n).parent) stack.unshift(n);
  for (const n of stack) out.multiply(locals.get(n) ?? rest.get(n).quaternion);
  return out;
}

describe('retargetRotationTracks', () => {
  it('reproduces the source exactly when both skeletons share a rest pose', () => {
    // The guarantee that protects rigs already matching the Mixamo convention:
    // identical rest poses must round-trip the animation untouched.
    const rest = () => chain(euler(10, 0, 0), euler(0, 20, 0), euler(0, 0, 30));
    const animated = [euler(10, 0, 0), euler(45, 0, 0)];

    const result = retargetRotationTracks({
      tracks: [track('mid', [0, 1], animated)],
      sourceOf: identityMap,
      sourceRest: rest(),
      targetRest: rest(),
    });

    expect(result).toHaveLength(1);
    animated.forEach((expected, frame) => {
      const got = new THREE.Quaternion().fromArray(result[0].values, frame * 4);
      expect(got.angleTo(expected)).toBeLessThan(TOLERANCE);
    });
  });

  it('preserves world-space motion when the target rests differently', () => {
    // The VALID case: same hierarchy, bones resting in a different frame. The
    // retargeted clip must reproduce the source's world rotation, not its
    // local quaternion.
    const sourceRest = chain(euler(0, 0, 0), euler(0, 0, 0), euler(0, 0, 0));
    const targetRest = chain(euler(-90, 0, 0), euler(0, 0, 125), euler(30, 0, 0));

    const sourceLocals = new Map([['mid', euler(0, 40, 0)]]);
    const result = retargetRotationTracks({
      tracks: [track('mid', [0], [sourceLocals.get('mid')])],
      sourceOf: identityMap,
      sourceRest,
      targetRest,
    });

    const targetLocals = new Map([
      ['mid', new THREE.Quaternion().fromArray(result[0].values, 0)],
    ]);

    // Source world delta from its rest == target world delta from its rest.
    const sourceDelta = worldOf(sourceRest, sourceLocals, 'mid')
      .multiply(worldOf(sourceRest, new Map(), 'mid').invert());
    const targetDelta = worldOf(targetRest, targetLocals, 'mid')
      .multiply(worldOf(targetRest, new Map(), 'mid').invert());

    expect(targetDelta.angleTo(sourceDelta)).toBeLessThan(TOLERANCE);
    // And it is genuinely different from copying the source value verbatim.
    expect(targetLocals.get('mid').angleTo(sourceLocals.get('mid'))).toBeGreaterThan(0.1);
  });

  it('keeps unanimated children at their own rest pose', () => {
    // A bone the source never animates must stay at the target's rest rotation,
    // just riding along with its animated parent.
    const sourceRest = chain(euler(0, 0, 0), euler(0, 0, 0), euler(0, 0, 0));
    const targetRest = chain(euler(-90, 0, 0), euler(0, 0, 125), euler(30, 0, 0));

    const result = retargetRotationTracks({
      tracks: [track('mid', [0], [euler(0, 40, 0)]), track('tip', [0], [euler(0, 0, 0)])],
      sourceOf: identityMap,
      sourceRest,
      targetRest,
    });

    const tip = result.find((t) => t.name === 'tip');
    const got = new THREE.Quaternion().fromArray(tip.values, 0);
    expect(got.angleTo(targetRest.get('tip').quaternion)).toBeLessThan(TOLERANCE);
  });

  it('skips a track whose bone is missing from the target rig', () => {
    // Rigs in the wild are not complete: a mapped bone can simply not exist on
    // the avatar. That track must be left as authored rather than throwing or
    // writing garbage into the others.
    const sourceRest = chain(euler(0, 0, 0), euler(0, 0, 0), euler(0, 0, 0));
    const targetRest = new Map([
      ['root', { quaternion: euler(-90, 0, 0), parent: null }],
      ['mid', { quaternion: euler(0, 0, 125), parent: 'root' }],
      // 'tip' deliberately absent
    ]);
    const animated = euler(0, 40, 0);

    const result = retargetRotationTracks({
      tracks: [track('mid', [0], [animated]), track('tip', [0], [animated])],
      sourceOf: identityMap,
      sourceRest,
      targetRest,
    });

    expect(result).toHaveLength(2);
    const mid = new THREE.Quaternion().fromArray(result.find((t) => t.name === 'mid').values, 0);
    expect(Number.isFinite(mid.x + mid.y + mid.z + mid.w)).toBe(true);
  });

  it('ignores a track the source skeleton knows nothing about', () => {
    const rest = () => chain(euler(0, 0, 0), euler(0, 0, 0), euler(0, 0, 0));
    const result = retargetRotationTracks({
      tracks: [track('mid', [0], [euler(0, 40, 0)]), track('ghost', [0], [euler(0, 10, 0)])],
      sourceOf: new Map([...identityMap, ['ghost', 'ghost']]),
      sourceRest: rest(),
      targetRest: rest(),
    });
    expect(result).toHaveLength(2);
    // The unknown bone stays finite rather than poisoning the output.
    const ghost = new THREE.Quaternion().fromArray(result.find((t) => t.name === 'ghost').values, 0);
    expect(Number.isFinite(ghost.x + ghost.y + ghost.z + ghost.w)).toBe(true);
  });

  it('does not hang on a hierarchy that references a missing parent', () => {
    // A broken export can leave a bone pointing at a parent that was stripped.
    const broken = new Map([
      ['root', { quaternion: euler(0, 0, 0), parent: 'GONE' }],
      ['mid', { quaternion: euler(0, 0, 0), parent: 'root' }],
      ['tip', { quaternion: euler(0, 0, 0), parent: 'mid' }],
    ]);
    const result = retargetRotationTracks({
      tracks: [track('mid', [0], [euler(0, 40, 0)])],
      sourceOf: identityMap,
      sourceRest: broken,
      targetRest: chain(euler(0, 0, 0), euler(0, 0, 0), euler(0, 0, 0)),
    });
    expect(result).toHaveLength(1);
    const q = new THREE.Quaternion().fromArray(result[0].values, 0);
    expect(Number.isFinite(q.x + q.y + q.z + q.w)).toBe(true);
  });

  it('returns null when there is nothing usable to retarget', () => {
    expect(retargetRotationTracks({
      tracks: [], sourceOf: identityMap, sourceRest: chain(euler(0, 0, 0), euler(0, 0, 0), euler(0, 0, 0)), targetRest: chain(euler(0, 0, 0), euler(0, 0, 0), euler(0, 0, 0)),
    })).toBeNull();
  });
});

describe('bodyFrame', () => {
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  // A character standing up +Y facing +Z has its right hip at −X.
  const facingPlusZ = {
    hips: v(0, 1, 0), head: v(0, 1.7, 0), leftUpLeg: v(0.1, 0.95, 0), rightUpLeg: v(-0.1, 0.95, 0),
  };

  it('is the identity for a character standing up and facing +Z', () => {
    expect(bodyFrame(facingPlusZ).angleTo(new THREE.Quaternion())).toBeLessThan(TOLERANCE);
  });

  it('is a half turn about up for a character facing −Z', () => {
    // run.glb's case: the same body, turned round.
    const turned = bodyFrame({
      hips: v(0, 1, 0), head: v(0, 1.7, 0), leftUpLeg: v(-0.1, 0.95, 0), rightUpLeg: v(0.1, 0.95, 0),
    });
    const halfTurn = new THREE.Quaternion().setFromAxisAngle(v(0, 1, 0), Math.PI);
    expect(turned.angleTo(halfTurn)).toBeLessThan(TOLERANCE);
  });

  it('refuses joints that do not define an orientation', () => {
    expect(bodyFrame({})).toBeNull();
    expect(bodyFrame({ ...facingPlusZ, head: v(0, 1, 0) })).toBeNull();
  });
});

describe('retargeting between characters that face different ways', () => {
  // Pitching a leg forward is a rotation about the character's own lateral
  // axis. For a +Z-facing body that axis is world X; for a −Z-facing one it is
  // world −X — so the same world rotation swings the two legs in opposite
  // directions relative to each body.
  const rest = () => new Map([['leg', { quaternion: new THREE.Quaternion(), parent: null }]]);
  const legForward = (facing) => euler(-30 * facing, 0, 0);
  const plusZ = new THREE.Quaternion();
  const minusZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const run = (frames) => retargetRotationTracks({
    tracks: [track('leg', [0], [legForward(-1)])],   // source faces −Z: forward pitch is +X
    sourceOf: new Map([['leg', 'leg']]),
    sourceRest: rest(),
    targetRest: rest(),
    ...frames,
  });
  const got = (result) => new THREE.Quaternion().fromArray(result[0].values, 0);

  it('without frames, copies the world rotation — and swings the leg backwards', () => {
    // The bug, pinned: this is what run.glb did to the avatar.
    expect(got(run({})).angleTo(legForward(-1))).toBeLessThan(TOLERANCE);
    expect(got(run({})).angleTo(legForward(1))).toBeGreaterThan(0.5);
  });

  it('with frames, swings the leg forward for the target too', () => {
    const result = run({ sourceFrame: minusZ, targetFrame: plusZ });
    expect(got(result).angleTo(legForward(1))).toBeLessThan(TOLERANCE);
  });

  it('changes nothing when both characters already face the same way', () => {
    const same = retargetRotationTracks({
      tracks: [track('leg', [0], [legForward(1)])],
      sourceOf: new Map([['leg', 'leg']]),
      sourceRest: rest(),
      targetRest: rest(),
      sourceFrame: plusZ,
      targetFrame: plusZ,
    });
    expect(got(same).angleTo(legForward(1))).toBeLessThan(TOLERANCE);
  });
});
