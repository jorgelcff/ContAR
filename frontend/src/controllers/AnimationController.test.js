import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { AnimationController, attachSourceRestPose } from './AnimationController';
import { BoneMapper } from '../utils/BoneMapper';

/** A Mixamo-named skeleton; `rotate` lets it bind on a different convention. */
function buildRig(names, rotate = () => new THREE.Quaternion()) {
  const root = new THREE.Object3D();
  const bones = {};
  const add = (name, parentName, offset) => {
    if (!names.includes(name)) return;
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.copy(offset);
    bone.quaternion.copy(rotate(name));
    (bones[parentName] || root).add(bone);
    bones[name] = bone;
  };
  add('Hips', null, new THREE.Vector3(0, 1, 0));
  add('Spine', 'Hips', new THREE.Vector3(0, 0.2, 0));
  add('Neck', 'Spine', new THREE.Vector3(0, 0.3, 0));
  add('Head', 'Neck', new THREE.Vector3(0, 0.15, 0));
  for (const side of ['Left', 'Right']) {
    const d = side === 'Left' ? 1 : -1;
    add(`${side}Arm`, 'Spine', new THREE.Vector3(0.2 * d, 0.2, 0));
    add(`${side}ForeArm`, `${side}Arm`, new THREE.Vector3(0.25 * d, 0, 0));
    add(`${side}Hand`, `${side}ForeArm`, new THREE.Vector3(0.25 * d, 0, 0));
    add(`${side}UpLeg`, 'Hips', new THREE.Vector3(0.1 * d, -0.05, 0));
    add(`${side}Leg`, `${side}UpLeg`, new THREE.Vector3(0, -0.45, 0));
    add(`${side}Foot`, `${side}Leg`, new THREE.Vector3(0, -0.45, 0));
  }
  root.updateMatrixWorld(true);
  return root;
}

const FULL = [
  'Hips', 'Spine', 'Neck', 'Head',
  'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot',
];

/** A Mixamo-style clip, with the `Armature` wrapper those exports carry. */
function mixamoClip(boneNames) {
  const tracks = boneNames.map((name) => new THREE.QuaternionKeyframeTrack(
    `mixamorig:${name}.quaternion`,
    [0, 1],
    [0, 0, 0, 1, 0, 0.2, 0, 0.98],
  ));
  const clip = new THREE.AnimationClip('walk', 1, tracks);

  const sourceRoot = new THREE.Object3D();
  sourceRoot.name = 'Scene';
  const armature = new THREE.Object3D();
  armature.name = 'Armature';
  armature.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  sourceRoot.add(armature);
  const inner = buildRig(FULL);
  for (const child of [...inner.children]) armature.add(child);
  armature.traverse((n) => { if (n.isBone) n.name = `mixamorig:${n.name}`; });
  sourceRoot.updateMatrixWorld(true);

  return attachSourceRestPose(clip, sourceRoot);
}

const mapperFor = (root) => BoneMapper.fromGLTF({ scene: root });

// Rigs off the Mixamo convention take the world-space retarget path, which
// assumes a great deal about the skeleton it is handed. None of that was
// exercised before: real avatars arrive with bones missing, extra bones, and
// occasionally no usable skeleton at all.
const offConvention = (name) => {
  const q = new THREE.Quaternion();
  if (name.endsWith('UpLeg') || name.endsWith('Leg')) return q.setFromEuler(new THREE.Euler(2.2, 0.4, 0.3));
  if (name.endsWith('Arm')) return q.setFromEuler(new THREE.Euler(0, 0, 1.4));
  return q.setFromEuler(new THREE.Euler(1.6, 0.3, 0.2));
};

describe('AnimationController retargeting on degenerate rigs', () => {
  it('retargets a full off-convention rig without producing NaN', () => {
    const root = buildRig(FULL, offConvention);
    const clip = mixamoClip(FULL);
    const controller = new AnimationController(root, [], mapperFor(root));
    const out = controller._retargetClip(clip);

    // Confirms the rig is off-convention enough to take the world-space path
    // rather than the verbatim copy — otherwise the rest of this file would be
    // exercising nothing.
    const source = clip.tracks.find((t) => t.name.includes('LeftForeArm'));
    const retargeted = out.tracks.find((t) => t.name.includes('LeftForeArm'));
    expect(retargeted, 'the forearm track should survive').toBeTruthy();
    expect([...retargeted.values]).not.toEqual([...source.values]);

    for (const track of out.tracks) {
      for (const v of track.values) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('survives an avatar missing whole limbs', () => {
    const partial = FULL.filter((n) => !n.includes('Leg') && !n.includes('Foot'));
    const root = buildRig(partial, offConvention);
    const clip = mixamoClip(FULL); // the clip still animates the missing legs

    expect(() => new AnimationController(root, [clip], mapperFor(root))).not.toThrow();
    const controller = new AnimationController(root, [], mapperFor(root));
    const out = controller._retargetClip(clip);
    const names = out.tracks.map((t) => t.name.split('.')[0]);
    expect(names).not.toContain('LeftUpLeg');
    expect(names.length).toBeGreaterThan(0);
  });

  it('does not throw on a model with no bones at all', () => {
    const empty = new THREE.Object3D();
    const clip = mixamoClip(FULL);
    expect(() => new AnimationController(empty, [clip], mapperFor(empty))).not.toThrow();
  });

  it('handles a clip whose bones the avatar has never heard of', () => {
    const root = buildRig(FULL, offConvention);
    const clip = new THREE.AnimationClip('alien', 1, [
      new THREE.QuaternionKeyframeTrack('NotABone.quaternion', [0], [0, 0, 0, 1]),
    ]);
    const controller = new AnimationController(root, [], mapperFor(root));
    expect(() => controller._retargetClip(clip)).not.toThrow();
    expect(controller._retargetClip(clip).tracks).toHaveLength(0);
  });

  it('falls back cleanly when the clip carries no source rest pose', () => {
    // Clips loaded before attachSourceRestPose existed, or from a path that
    // does not call it, must still play rather than taking the full retarget
    // with nothing to compare against.
    const root = buildRig(FULL, offConvention);
    const clip = new THREE.AnimationClip('bare', 1, [
      new THREE.QuaternionKeyframeTrack('mixamorig:LeftArm.quaternion', [0], [0, 0, 0, 1]),
    ]);
    const controller = new AnimationController(root, [], mapperFor(root));
    const out = controller._retargetClip(clip);
    expect(out.tracks.length).toBeGreaterThan(0);
    for (const v of out.tracks[0].values) expect(Number.isFinite(v)).toBe(true);
  });
});
