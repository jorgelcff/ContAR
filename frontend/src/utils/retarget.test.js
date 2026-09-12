import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { retargetRotationTracks } from './retarget';

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

  it('returns null when there is nothing usable to retarget', () => {
    expect(retargetRotationTracks({
      tracks: [], sourceOf: identityMap, sourceRest: chain(euler(0, 0, 0), euler(0, 0, 0), euler(0, 0, 0)), targetRest: chain(euler(0, 0, 0), euler(0, 0, 0), euler(0, 0, 0)),
    })).toBeNull();
  });
});
