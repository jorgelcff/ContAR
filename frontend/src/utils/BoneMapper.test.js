import { describe, it, expect, beforeEach } from 'vitest';
import { BoneMapper, STANDARD_BONES } from './BoneMapper';

// BoneMapper only reads `.isBone`, `.name`, and traverses via a scene's
// `.traverse(cb)` — a lightweight fake avoids pulling in real Three.js objects.
function fakeBone(name) {
  return { isBone: true, name };
}

function fakeScene(names) {
  const bones = names.map(fakeBone);
  return {
    traverse(cb) {
      bones.forEach(cb);
    },
  };
}

function fakeGltf(names, vrmHumanoid) {
  return {
    scene: fakeScene(names),
    userData: vrmHumanoid ? { vrm: { humanoid: vrmHumanoid } } : {},
  };
}

describe('BoneMapper.fromGLTF — rig detection', () => {
  it('detects Mixamo rigs by the "mixamorig" prefix', () => {
    const gltf = fakeGltf([
      'mixamorigHips', 'mixamorigSpine', 'mixamorigSpine1', 'mixamorigNeck',
      'mixamorigHead', 'mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigLeftHand',
    ]);
    const mapper = BoneMapper.fromGLTF(gltf);

    expect(mapper.source).toBe('mixamo');
    expect(mapper.get('hips').name).toBe('mixamorigHips');
    expect(mapper.get('leftUpperArm').name).toBe('mixamorigLeftArm');
    expect(mapper.get('leftLowerArm').name).toBe('mixamorigLeftForeArm');
  });

  it('detects CC3/CC4 rigs by the "CC_Base_" prefix', () => {
    const gltf = fakeGltf([
      'CC_Base_Hip', 'CC_Base_Spine01', 'CC_Base_Head',
      'CC_Base_L_Upperarm', 'CC_Base_R_Upperarm',
    ]);
    const mapper = BoneMapper.fromGLTF(gltf);

    expect(mapper.source).toBe('cc3');
    expect(mapper.get('hips').name).toBe('CC_Base_Hip');
    expect(mapper.get('leftUpperArm').name).toBe('CC_Base_L_Upperarm');
  });

  it('detects Avaturn-style rigs (plain Mixamo names, no prefix)', () => {
    // Signature check requires Hips + all four arm bones with exact names.
    const gltf = fakeGltf(['Hips', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'Head']);
    const mapper = BoneMapper.fromGLTF(gltf);

    expect(mapper.source).toBe('mixamo');
    expect(mapper.get('hips').name).toBe('Hips');
  });

  it('falls back to generic pattern matching for unrecognized naming (e.g. Ready Player Me)', () => {
    const gltf = fakeGltf(['Hips', 'Spine', 'Spine1', 'Neck', 'Head', 'LeftUpLeg', 'RightUpLeg']);
    const mapper = BoneMapper.fromGLTF(gltf);

    expect(mapper.source).toBe('generic');
    expect(mapper.get('hips').name).toBe('Hips');
    expect(mapper.get('leftUpperLeg').name).toBe('LeftUpLeg');
  });

  it('never maps a scene "Root" bone to hips (would collapse the skeleton)', () => {
    // Regression test for the documented gotcha in BoneMapper.js: mapping a
    // Blender/Unreal-style scene-root bone as the pelvis drives the whole
    // rig from the hip track and makes the character collapse upward.
    const gltf = fakeGltf(['Root', 'Hips', 'Spine']);
    const mapper = BoneMapper.fromGLTF(gltf);

    expect(mapper.get('hips').name).toBe('Hips');
    expect(mapper.get('hips').name).not.toBe('Root');
  });

  it('prefers VRM humanoid bone resolution when vrm data is present', () => {
    const hipsBone = fakeBone('J_Bip_C_Hips');
    const humanoid = {
      getRawBoneNode: (standardName) => (standardName === 'hips' ? hipsBone : null),
    };
    const gltf = fakeGltf(['J_Bip_C_Hips'], humanoid);
    const mapper = BoneMapper.fromGLTF(gltf);

    expect(mapper.source).toBe('vrm');
    expect(mapper.get('hips')).toBe(hipsBone);
  });

  it('returns an empty, "none"-sourced mapper when the model has no bones at all', () => {
    const gltf = fakeGltf([]);
    const mapper = BoneMapper.fromGLTF(gltf);

    expect(mapper.source).toBe('none');
    expect(mapper.resolvedCount).toBe(0);
  });
});

describe('BoneMapper instance API', () => {
  let mapper;

  beforeEach(() => {
    mapper = new BoneMapper();
  });

  it('get() returns null for an unmapped bone', () => {
    expect(mapper.get('hips')).toBeNull();
    expect(mapper.has('hips')).toBe(false);
  });

  it('set() adds a bone, and set(name, null) removes it', () => {
    const bone = fakeBone('hip_bone');
    mapper.set('hips', bone);
    expect(mapper.has('hips')).toBe(true);
    expect(mapper.resolvedCount).toBe(1);

    mapper.set('hips', null);
    expect(mapper.has('hips')).toBe(false);
    expect(mapper.resolvedCount).toBe(0);
  });

  it('clone() copies bone references into an independent record', () => {
    const bone = fakeBone('hip_bone');
    mapper.set('hips', bone);
    mapper.source = 'generic';

    const copy = mapper.clone();
    expect(copy.get('hips')).toBe(bone); // same reference
    expect(copy.source).toBe('generic');

    copy.set('hips', null);
    expect(mapper.has('hips')).toBe(true); // original untouched
  });

  it('STANDARD_BONES covers both arms, both legs, spine chain, and jaw', () => {
    expect(STANDARD_BONES).toContain('jaw');
    expect(STANDARD_BONES).toContain('leftHand');
    expect(STANDARD_BONES).toContain('rightFoot');
  });
});
