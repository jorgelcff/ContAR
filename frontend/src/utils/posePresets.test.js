import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applyPosePreset } from './posePresets';

/**
 * Builds a synthetic humanoid bound in a T-pose: arms straight out along X,
 * legs straight down.
 *
 * `boneRotation` lets the same *visual* skeleton be built with different local
 * bone axes — each bone gets the given rotation and its children's offsets are
 * counter-rotated, so world positions come out identical either way. That is
 * exactly how a Mixamo-convention rig and an FBX-converted one (VALID) differ,
 * and the poses are supposed to be indifferent to it.
 */
function buildRig(boneRotation = () => new THREE.Quaternion()) {
  const bones = {};
  const make = (name, parent, worldOffset) => {
    const bone = new THREE.Bone();
    bone.name = name;
    const q = boneRotation(name);
    bone.quaternion.copy(q);
    if (parent) {
      // Undo the parent's rotation so the child still lands where intended.
      const parentWorld = new THREE.Quaternion();
      parent.getWorldQuaternion(parentWorld);
      bone.position.copy(worldOffset.clone().applyQuaternion(parentWorld.clone().invert()));
      parent.add(bone);
    } else {
      bone.position.copy(worldOffset);
    }
    bone.updateMatrixWorld(true);
    bones[name] = bone;
    return bone;
  };

  const root = new THREE.Object3D();
  const hips = make('Hips', null, new THREE.Vector3(0, 1.0, 0));
  root.add(hips);
  hips.updateMatrixWorld(true);

  const spine = make('Spine', hips, new THREE.Vector3(0, 0.2, 0));
  const chest = make('Spine1', spine, new THREE.Vector3(0, 0.2, 0));
  const neck = make('Neck', chest, new THREE.Vector3(0, 0.2, 0));
  make('Head', neck, new THREE.Vector3(0, 0.15, 0));

  for (const side of ['Left', 'Right']) {
    const dir = side === 'Left' ? 1 : -1;
    const shoulder = make(`${side}Shoulder`, chest, new THREE.Vector3(0.05 * dir, 0.1, 0));
    const arm = make(`${side}Arm`, shoulder, new THREE.Vector3(0.15 * dir, 0, 0));
    const fore = make(`${side}ForeArm`, arm, new THREE.Vector3(0.25 * dir, 0, 0));
    make(`${side}Hand`, fore, new THREE.Vector3(0.25 * dir, 0, 0));

    const upLeg = make(`${side}UpLeg`, hips, new THREE.Vector3(0.1 * dir, -0.05, 0));
    const leg = make(`${side}Leg`, upLeg, new THREE.Vector3(0, -0.45, 0));
    make(`${side}Foot`, leg, new THREE.Vector3(0, -0.45, 0));
  }

  root.updateMatrixWorld(true);
  return { root, bones };
}

/** World-space direction from one bone to another, after the pose is applied. */
function direction(bones, from, to) {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  bones[from].getWorldPosition(a);
  bones[to].getWorldPosition(b);
  return b.sub(a).normalize();
}

function pose(rig, preset) {
  applyPosePreset(rig.root, null, null, [], preset, null, {});
  rig.root.updateMatrixWorld(true);
}

// A rig whose bones rest in a wholly different frame — the VALID case.
const twisted = () => {
  const q = new THREE.Quaternion();
  return (name) => {
    if (name === 'Hips') return q.clone().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    if (name.endsWith('Arm')) return q.clone().setFromEuler(new THREE.Euler(0, 0, Math.PI / 3));
    if (name.endsWith('UpLeg') || name.endsWith('Leg')) {
      return q.clone().setFromEuler(new THREE.Euler(Math.PI, 0.2, 0));
    }
    return q.clone().setFromEuler(new THREE.Euler(0.3, 0.2, 0.1));
  };
};

describe('static poses', () => {
  it('t_pose puts the arms straight out to the sides', () => {
    const rig = buildRig();
    pose(rig, 't_pose');
    expect(direction(rig.bones, 'LeftArm', 'LeftForeArm').x).toBeGreaterThan(0.98);
    expect(direction(rig.bones, 'RightArm', 'RightForeArm').x).toBeLessThan(-0.98);
  });

  it('neutral lets the arms hang down instead of leaving the bind T-pose', () => {
    // The exact defect that shipped: "neutral" had no branch at all, so it
    // rendered the untouched bind pose — a T-pose under the name "Neutra".
    const rig = buildRig();
    pose(rig, 'neutral');
    expect(direction(rig.bones, 'LeftArm', 'LeftForeArm').y).toBeLessThan(-0.9);
    expect(direction(rig.bones, 'RightArm', 'RightForeArm').y).toBeLessThan(-0.9);
  });

  it('hands_on_hips brings both hands below the shoulders and inward', () => {
    const rig = buildRig();
    const shoulderY = new THREE.Vector3();
    rig.bones.LeftArm.getWorldPosition(shoulderY);
    const restHand = new THREE.Vector3();
    rig.bones.LeftHand.getWorldPosition(restHand);

    pose(rig, 'hands_on_hips');
    const hand = new THREE.Vector3();
    rig.bones.LeftHand.getWorldPosition(hand);

    expect(hand.y).toBeLessThan(shoulderY.y);          // dropped from shoulder height
    expect(hand.x).toBeLessThan(restHand.x);           // pulled in toward the body
  });

  it('poses the same way regardless of how the rig binds its bones', () => {
    // The property aimBone exists for: two rigs with identical geometry but
    // different local bone axes must reach the same pose. Offsetting from the
    // rest pose (the old approach) could not do this.
    for (const preset of ['neutral', 't_pose', 'hands_on_hips', 'arms_crossed']) {
      const plain = buildRig();
      const odd = buildRig(twisted());
      pose(plain, preset);
      pose(odd, preset);

      for (const [from, to] of [['LeftArm', 'LeftForeArm'], ['RightArm', 'RightForeArm']]) {
        const a = direction(plain.bones, from, to);
        const b = direction(odd.bones, from, to);
        expect(a.angleTo(b), `${preset} ${from} differs between rigs`).toBeLessThan(0.05);
      }
    }
  });
});

describe('static poses on degenerate rigs', () => {
  it('does not throw when the rig has no bones at all', () => {
    const empty = new THREE.Object3D();
    expect(() => applyPosePreset(empty, null, null, [], 'neutral', null, {})).not.toThrow();
  });

  it('poses the arm it can find when the other one is missing', () => {
    const rig = buildRig();
    rig.bones.RightArm.removeFromParent();
    delete rig.bones.RightArm;

    expect(() => pose(rig, 'neutral')).not.toThrow();
    expect(direction(rig.bones, 'LeftArm', 'LeftForeArm').y).toBeLessThan(-0.9);
  });

  it('a zero-length segment does not corrupt the rest of the rig', () => {
    // A bone sitting exactly on its child has no direction to aim. What matters
    // is that the undefined case stays local: the other arm must still pose,
    // and nothing may come back NaN. (Three's normalize already returns a zero
    // vector rather than NaN here, so this pins the observable behaviour, not
    // the early return in aimBone.)
    const rig = buildRig();
    rig.bones.LeftForeArm.position.set(0, 0, 0);
    rig.root.updateMatrixWorld(true);

    pose(rig, 'neutral');

    const right = direction(rig.bones, 'RightArm', 'RightForeArm');
    expect(right.y, 'the intact arm should still hang down').toBeLessThan(-0.9);
    expect(Number.isFinite(right.x + right.y + right.z)).toBe(true);
    const q = rig.bones.LeftArm.quaternion;
    expect(Number.isFinite(q.x + q.y + q.z + q.w)).toBe(true);
  });

  it('survives a rig missing the whole spine chain', () => {
    const rig = buildRig();
    rig.bones.Neck.removeFromParent();
    expect(() => pose(rig, 'pray')).not.toThrow();
    expect(() => pose(rig, 'bow')).not.toThrow();
  });
});
