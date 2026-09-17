import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { AnimationController } from './AnimationController';

/**
 * A rig with the bone names the gesture layer looks for, bound in a T-pose.
 * The gestures run on the real controller — the point is to check that the new
 * styles move the character the way their names claim, not that a lookup table
 * has the right numbers in it.
 */
function buildRig() {
  const root = new THREE.Object3D();
  const bones = {};
  const make = (name, parent, offset) => {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.copy(offset);
    (parent || root).add(bone);
    bones[name] = bone;
    return bone;
  };

  const hips = make('Hips', null, new THREE.Vector3(0, 1, 0));
  const spine = make('Spine', hips, new THREE.Vector3(0, 0.2, 0));
  const chest = make('Spine1', spine, new THREE.Vector3(0, 0.2, 0));
  const neck = make('Neck', chest, new THREE.Vector3(0, 0.2, 0));
  make('Head', neck, new THREE.Vector3(0, 0.15, 0));
  for (const side of ['Left', 'Right']) {
    const dir = side === 'Left' ? 1 : -1;
    const arm = make(`${side}Arm`, chest, new THREE.Vector3(0.2 * dir, 0.1, 0));
    const fore = make(`${side}ForeArm`, arm, new THREE.Vector3(0.25 * dir, 0, 0));
    make(`${side}Hand`, fore, new THREE.Vector3(0.25 * dir, 0, 0));
  }
  root.updateMatrixWorld(true);
  return { root, bones };
}

/** Runs the gesture layer for a while and reports where the head ended up. */
function gesture(preset, seconds = 2) {
  const rig = buildRig();
  const controller = new AnimationController(rig.root, []);
  controller.setProceduralMode(preset);
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) controller.update(step);
  rig.root.updateMatrixWorld(true);

  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(
    rig.bones.Head.getWorldQuaternion(new THREE.Quaternion()),
  );
  return { rig, forward, controller };
}

describe('presenter gestures', () => {
  it('turns toward the side it is addressing, and the two sides are mirrors', () => {
    const left = gesture('speaker_left');
    const right = gesture('speaker_right');
    const ahead = gesture('speaker');

    // +X is the character's own left (that is where LeftArm sits).
    expect(left.forward.x, 'speaker_left should face the character-left').toBeGreaterThan(0.05);
    expect(right.forward.x, 'speaker_right should face the other way').toBeLessThan(-0.05);
    expect(Math.abs(ahead.forward.x), 'the neutral presenter should stay square').toBeLessThan(0.05);
  });

  it('gesticulates more broadly in the wide style than the neutral one', () => {
    // Sample the arm across a stretch of the cycle: a single instant could
    // catch either style at a crossing point and prove nothing.
    const spread = (preset) => {
      const rig = buildRig();
      const controller = new AnimationController(rig.root, []);
      controller.setProceduralMode(preset);
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < 240; i += 1) {
        controller.update(1 / 60);
        const v = rig.bones.LeftArm.quaternion.z;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
      return max - min;
    };
    expect(spread('speaker_wide')).toBeGreaterThan(spread('speaker'));
  });

  it('puts the bones back when switching styles, instead of compounding', () => {
    // Each style offsets from a captured base pose. Switching without a reset
    // would stack one set of offsets on the next.
    const rig = buildRig();
    const controller = new AnimationController(rig.root, []);
    const rest = rig.bones.LeftArm.quaternion.clone();

    for (const preset of ['speaker', 'speaker_left', 'speaker_wide', 'speaker_right']) {
      controller.setProceduralMode(preset);
      for (let i = 0; i < 60; i += 1) controller.update(1 / 60);
    }
    controller.setProceduralMode('default');

    expect(rig.bones.LeftArm.quaternion.angleTo(rest)).toBeLessThan(0.01);
  });

  it('does nothing at all outside presenter mode', () => {
    const rig = buildRig();
    const controller = new AnimationController(rig.root, []);
    const before = rig.bones.Head.quaternion.clone();
    controller.setProceduralMode('default');
    for (let i = 0; i < 120; i += 1) controller.update(1 / 60);
    expect(rig.bones.Head.quaternion.angleTo(before)).toBeLessThan(0.01);
  });
});
