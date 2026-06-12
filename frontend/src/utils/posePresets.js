/* Pose + animation presets, extracted from SceneCanvas so both the editor
 * 3D view and the AR scenes apply identical poses/animations to avatars.
 * These are pure functions over a THREE model + BoneMapper — no React. */
import * as THREE from 'three';

export function applyPosePreset(
  model,
  animationController,
  idleClip,
  avatarClips,
  posePreset,
  boneMapper = null,
  externalClips = {},
) {
  const normalized = String(posePreset || "idle").toLowerCase();

  if (animationController) {
    animationController.setProceduralMode(
      normalized === "speaker" ? "speaker" : "default",
    );
    animationController.stopAll();
  }

  ensureRestPoseSnapshot(model);
  resetToRestPose(model);

  const animatedPresets = ["idle", "walk", "walk_circle", "slow_run", "run", "dance", "speaker"];
  if (animatedPresets.includes(normalized)) {
    if (animationController) {
      const clip = pickAnimationClip(normalized, idleClip, avatarClips, externalClips);
      if (clip) {
        animationController.play(clip, 0.35);
        model.updateMatrixWorld(true);
        return;
      }
    }

    if (normalized !== "speaker") {
      model.updateMatrixWorld(true);
      return;
    }
  }

  if (normalized === "speaker") {
    applySpeakerPose(model, boneMapper);
  } else if (normalized === "wave") {
    applyWavePose(model, boneMapper);
  } else if (normalized === "hands_on_hips") {
    applyHandsOnHipsPose(model, boneMapper);
  } else if (normalized === "salute") {
    applySalutePose(model, boneMapper);
  } else if (normalized === "arms_crossed") {
    applyArmsCrossedPose(model, boneMapper);
  } else if (normalized === "t_pose") {
    applyTPose(model, boneMapper);
  } else if (normalized === "think") {
    applyThinkPose(model, boneMapper);
  } else if (normalized === "point") {
    applyPointPose(model, boneMapper);
  } else if (normalized === "bow") {
    applyBowPose(model, boneMapper);
  } else if (normalized === "pray") {
    applyPrayPose(model, boneMapper);
  } else if (normalized === "shrug") {
    applyShrugPose(model, boneMapper);
  }

  model.updateMatrixWorld(true);
}

function pickAnimationClip(preset, idleClip, avatarClips = [], externalClips = {}) {
  const keywordsByPreset = {
    idle:        [/idle/, /stand/],
    walk:        [/^walk$/],
    walk_circle: [/walk.?circle/, /circle.?walk/],
    slow_run:    [/slow.?run/, /slow.?jog/],
    run:         [/^run$/],
    dance:       [/dance/],
    speaker:     [/speak/, /talk/, /narrat/, /present/, /explain/, /lecture/],
  };

  const patterns = keywordsByPreset[preset] || [];
  const clips = Array.isArray(avatarClips) ? avatarClips : [];

  // 1. Avatar's own embedded clips (highest priority — rig-matched)
  const fromAvatar = clips.find((clip) => {
    const name = String(clip?.name || "").toLowerCase();
    return patterns.some((re) => re.test(name));
  });
  if (fromAvatar) return fromAvatar;

  // 2. External manifest clip for this exact preset
  if (externalClips[preset]) return externalClips[preset];

  // 3. Any external clip whose name matches the preset keywords
  for (const [, clip] of Object.entries(externalClips)) {
    const name = String(clip?.name || "").toLowerCase();
    if (patterns.some((re) => re.test(name))) return clip;
  }

  // 4. Fallback: use idle (external or legacy) so we never show a T-pose
  const fallbackIdle = externalClips.idle || idleClip;
  if (fallbackIdle) return fallbackIdle;

  return null;
}

function ensureRestPoseSnapshot(model) {
  model.updateMatrixWorld(true);
  model.traverse((node) => {
    if (!node?.isBone) return;
    if (!node.userData.__restQuat) {
      node.userData.__restQuat = node.quaternion.clone();
      node.userData.__restWorldQuat = new THREE.Quaternion();
      node.getWorldQuaternion(node.userData.__restWorldQuat);
    }
  });
}

function resetToRestPose(model) {
  model.traverse((node) => {
    if (!node?.isBone || !node.userData.__restQuat) return;
    node.quaternion.copy(node.userData.__restQuat);
  });
}

function findBone(model, patterns) {
  let result = null;

  model.traverse((node) => {
    if (result || !node?.isBone) return;
    const name = String(node.name || "").toLowerCase();
    if (patterns.some((re) => re.test(name))) {
      result = node;
    }
  });

  return result;
}

function getBone(model, boneMapper, standardName, patterns) {
  return boneMapper?.get(standardName) ?? findBone(model, patterns);
}

function rotateBoneDeg(bone, x = 0, y = 0, z = 0) {
  if (!bone) return;
  // A abstração definitiva: converter offsets do Mixamo (World Aligned em T-pose)
  // para o sistema de coordenadas local real do osso exportado (Avaturn, CC3, etc)
  const qMixamo = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      (x * Math.PI) / 180,
      (y * Math.PI) / 180,
      (z * Math.PI) / 180,
      "XYZ",
    ),
  );

  // Cache safeguard (garantido no ensureRestPoseSnapshot, mas checkamos)
  if (!bone.userData.__restWorldQuat) {
    bone.userData.__restWorldQuat = new THREE.Quaternion();
    bone.getWorldQuaternion(bone.userData.__restWorldQuat);
  }

  const Q_restWorld = bone.userData.__restWorldQuat;
  const Q_restWorldInv = Q_restWorld.clone().invert();

  // Conjuga a rotação Mixamo pelas coordenadas mundiais do osso
  const qLocal = Q_restWorldInv.multiply(qMixamo).multiply(Q_restWorld);

  // Aplica cumulativamente (nossas poses estáticas chamam isso na restPose resetada)
  bone.quaternion.multiply(qLocal);
}

/**
 * applyFingerPose — rotate finger phalanges on the given hand.
 *
 * side:  'left' | 'right'
 * shape: 'point'  — index extended, others curled
 *        'spread' — all fingers extended & fanned out (wave)
 *        'flat'   — all fingers straight together (salute)
 *        'pray'   — all fingers straight, slightly adducted inward
 *        'fist'   — all fingers curled (default curl)
 *
 * Supports VRM (J_Bip_[L/R]_Index1 …), Mixamo (LeftHandIndex1 …),
 * and CC3/generic (CC_Base_L_Index1 …) naming conventions.
 */
function applyFingerPose(model, side, shape) {
  const S = side === 'left' ? 'L' : 'R';
  const sLong = side === 'left' ? 'Left' : 'Right';
  const sign = side === 'left' ? 1 : -1; // abduction sign flips per side

  // Finger names in order: [index, middle, ring, pinky, thumb]
  const FINGER_DEFS = [
    {
      key: 'index',
      vrm:    [`J_Bip_${S}_Index1`,   `J_Bip_${S}_Index2`,   `J_Bip_${S}_Index3`],
      mixamo: [`${sLong}HandIndex1`,  `${sLong}HandIndex2`,  `${sLong}HandIndex3`],
      cc3:    [`CC_Base_${S}_Index1`, `CC_Base_${S}_Index2`, `CC_Base_${S}_Index3`],
    },
    {
      key: 'middle',
      vrm:    [`J_Bip_${S}_Middle1`,   `J_Bip_${S}_Middle2`,   `J_Bip_${S}_Middle3`],
      mixamo: [`${sLong}HandMiddle1`,  `${sLong}HandMiddle2`,  `${sLong}HandMiddle3`],
      cc3:    [`CC_Base_${S}_Mid1`,    `CC_Base_${S}_Mid2`,    `CC_Base_${S}_Mid3`],
    },
    {
      key: 'ring',
      vrm:    [`J_Bip_${S}_Ring1`,   `J_Bip_${S}_Ring2`,   `J_Bip_${S}_Ring3`],
      mixamo: [`${sLong}HandRing1`,  `${sLong}HandRing2`,  `${sLong}HandRing3`],
      cc3:    [`CC_Base_${S}_Ring1`, `CC_Base_${S}_Ring2`, `CC_Base_${S}_Ring3`],
    },
    {
      key: 'pinky',
      vrm:    [`J_Bip_${S}_Little1`,   `J_Bip_${S}_Little2`,   `J_Bip_${S}_Little3`],
      mixamo: [`${sLong}HandPinky1`,   `${sLong}HandPinky2`,   `${sLong}HandPinky3`],
      cc3:    [`CC_Base_${S}_Pinky1`,  `CC_Base_${S}_Pinky2`,  `CC_Base_${S}_Pinky3`],
    },
    {
      key: 'thumb',
      vrm:    [`J_Bip_${S}_Thumb1`,   `J_Bip_${S}_Thumb2`,   `J_Bip_${S}_Thumb3`],
      mixamo: [`${sLong}HandThumb1`,  `${sLong}HandThumb2`,  `${sLong}HandThumb3`],
      cc3:    [`CC_Base_${S}_Thumb1`, `CC_Base_${S}_Thumb2`, `CC_Base_${S}_Thumb3`],
    },
  ];

  // Build a lookup map: boneName (lowercase) → THREE.Bone
  const boneByName = {};
  model.traverse((node) => {
    if (node?.isBone && node.name) {
      boneByName[node.name.toLowerCase()] = node;
    }
  });

  const resolvePhalanges = (def) => {
    // Try each naming convention in order
    const sets = [def.vrm, def.mixamo, def.cc3];
    for (const names of sets) {
      const bones = names.map((n) => boneByName[n.toLowerCase()] || null);
      if (bones.some(Boolean)) return bones; // use this convention if any phalanx found
    }
    return [null, null, null];
  };

  // Rotation presets: [prox, mid, distal] in degrees (flexion = positive X)
  const SHAPES = {
    // index straight, others curled
    point: {
      index:  [0,   0,  0],
      middle: [60,  60, 40],
      ring:   [65,  65, 45],
      pinky:  [70,  70, 50],
      thumb:  [20,  10,  0],
    },
    // all fingers extended and slightly spread (abduction on prox)
    spread: {
      index:  [0, 0, 0],
      middle: [0, 0, 0],
      ring:   [0, 0, 0],
      pinky:  [0, 0, 0],
      thumb:  [0, 0, 0],
      // abduction applied separately below
      abduct: true,
    },
    // all straight, fingers close together
    flat: {
      index:  [0, 0, 0],
      middle: [0, 0, 0],
      ring:   [0, 0, 0],
      pinky:  [0, 0, 0],
      thumb:  [10, 5, 0],
    },
    // fingers straight, slightly pressed inward
    pray: {
      index:  [5,  0, 0],
      middle: [5,  0, 0],
      ring:   [5,  0, 0],
      pinky:  [10, 0, 0],
      thumb:  [15, 5, 0],
    },
    // full fist
    fist: {
      index:  [70, 70, 50],
      middle: [70, 70, 50],
      ring:   [70, 70, 50],
      pinky:  [75, 75, 55],
      thumb:  [40, 30, 20],
    },
  };

  const preset = SHAPES[shape] || SHAPES.fist;

  for (const def of FINGER_DEFS) {
    const [prox, mid, distal] = resolvePhalanges(def);
    const [rx1, rx2, rx3] = preset[def.key] || [0, 0, 0];

    if (prox) rotateBoneDeg(prox,   rx1, 0, 0);
    if (mid)  rotateBoneDeg(mid,    rx2, 0, 0);
    if (distal) rotateBoneDeg(distal, rx3, 0, 0);

    // For spread: abduct (fan out) the proximal phalanges
    if (preset.abduct && prox) {
      const ABDUCT = { index: 12, middle: 4, ring: -4, pinky: -12, thumb: 20 };
      const abductDeg = (ABDUCT[def.key] || 0) * sign;
      rotateBoneDeg(prox, 0, 0, abductDeg);
    }
  }
}

function applyWavePose(model, boneMapper = null) {
  const rightUpperArm = getBone(model, boneMapper, 'rightUpperArm', [/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/]);
  const rightForeArm  = getBone(model, boneMapper, 'rightLowerArm', [/rightforearm/, /r_forearm/, /lowerarm_r/, /mixamorigrightforearm/]);
  const rightHand     = getBone(model, boneMapper, 'rightHand',     [/righthand/, /hand_r/, /mixamorigrighthand/]);

  rotateBoneDeg(rightUpperArm, -45, 0, -65);
  rotateBoneDeg(rightForeArm, -20, 0, -35);
  rotateBoneDeg(rightHand, 10, 0, -20);

  // Spread fingers for wave
  applyFingerPose(model, 'right', 'spread');
}

function applySpeakerPose(model, boneMapper = null) {
  const spine         = getBone(model, boneMapper, 'spine',         [/spine(?:0?1)?/, /chest/, /mixamorigspine/]);
  const neck          = getBone(model, boneMapper, 'neck',          [/neck/, /mixamorigneck/]);
  const leftUpperArm  = getBone(model, boneMapper, 'leftUpperArm',  [/leftarm/, /l_upperarm/, /upperarm_l/, /mixamorigleftarm/]);
  const rightUpperArm = getBone(model, boneMapper, 'rightUpperArm', [/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/]);
  const leftForeArm   = getBone(model, boneMapper, 'leftLowerArm',  [/leftforearm/, /l_forearm/, /lowerarm_l/, /mixamorigleftforearm/]);
  const rightForeArm  = getBone(model, boneMapper, 'rightLowerArm', [/rightforearm/, /r_forearm/, /lowerarm_r/, /mixamorigrightforearm/]);

  rotateBoneDeg(spine, -4, 0, 0);
  rotateBoneDeg(neck, 2, 0, 0);
  rotateBoneDeg(leftUpperArm, -18, 0, 15);
  rotateBoneDeg(rightUpperArm, -18, 0, -15);
  rotateBoneDeg(leftForeArm, -38, 0, -10);
  rotateBoneDeg(rightForeArm, -38, 0, 10);
}

function applyHandsOnHipsPose(model, boneMapper = null) {
  const leftUpperArm  = getBone(model, boneMapper, 'leftUpperArm',  [/leftarm/, /l_upperarm/, /upperarm_l/, /mixamorigleftarm/]);
  const rightUpperArm = getBone(model, boneMapper, 'rightUpperArm', [/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/]);
  const leftForeArm   = getBone(model, boneMapper, 'leftLowerArm',  [/leftforearm/, /l_forearm/, /lowerarm_l/, /mixamorigleftforearm/]);
  const rightForeArm  = getBone(model, boneMapper, 'rightLowerArm', [/rightforearm/, /r_forearm/, /lowerarm_r/, /mixamorigrightforearm/]);

  rotateBoneDeg(leftUpperArm, 0, 0, 45);
  rotateBoneDeg(rightUpperArm, 0, 0, -45);
  rotateBoneDeg(leftForeArm, -30, 0, -30);
  rotateBoneDeg(rightForeArm, -30, 0, 30);
}

function applySalutePose(model, boneMapper = null) {
  const rightUpperArm = getBone(model, boneMapper, 'rightUpperArm', [/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/]);
  const rightForeArm  = getBone(model, boneMapper, 'rightLowerArm', [/rightforearm/, /r_forearm/, /lowerarm_r/, /mixamorigrightforearm/]);
  const rightHand     = getBone(model, boneMapper, 'rightHand',     [/righthand/, /hand_r/, /mixamorigrighthand/]);

  rotateBoneDeg(rightUpperArm, -35, 0, -40);
  rotateBoneDeg(rightForeArm, -70, 0, 20);
  rotateBoneDeg(rightHand, -10, 0, 25);

  // Flat hand for salute — fingers extended and together
  applyFingerPose(model, 'right', 'flat');
}

function applyArmsCrossedPose(model, boneMapper = null) {
  const leftUpperArm  = getBone(model, boneMapper, 'leftUpperArm',  [/leftarm/, /l_upperarm/, /upperarm_l/, /mixamorigleftarm/]);
  const rightUpperArm = getBone(model, boneMapper, 'rightUpperArm', [/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/]);
  const leftForeArm   = getBone(model, boneMapper, 'leftLowerArm',  [/leftforearm/, /l_forearm/, /lowerarm_l/, /mixamorigleftforearm/]);
  const rightForeArm  = getBone(model, boneMapper, 'rightLowerArm', [/rightforearm/, /r_forearm/, /lowerarm_r/, /mixamorigrightforearm/]);

  rotateBoneDeg(leftUpperArm, 0, 0, 20);
  rotateBoneDeg(rightUpperArm, 0, 0, -20);
  rotateBoneDeg(leftForeArm, -70, 0, -35);
  rotateBoneDeg(rightForeArm, -70, 0, 35);
}

function applyTPose(model, boneMapper = null) {
  const leftUpperArm  = getBone(model, boneMapper, 'leftUpperArm',  [/leftarm/, /l_upperarm/, /upperarm_l/, /mixamorigleftarm/]);
  const rightUpperArm = getBone(model, boneMapper, 'rightUpperArm', [/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/]);
  rotateBoneDeg(leftUpperArm, 0, 0, 90);
  rotateBoneDeg(rightUpperArm, 0, 0, -90);
}

function applyThinkPose(model, boneMapper = null) {
  const neck          = getBone(model, boneMapper, 'neck',          [/neck/, /mixamorigneck/]);
  const rightUpperArm = getBone(model, boneMapper, 'rightUpperArm', [/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/]);
  const rightForeArm  = getBone(model, boneMapper, 'rightLowerArm', [/rightforearm/, /r_forearm/, /lowerarm_r/, /mixamorigrightforearm/]);
  const rightHand     = getBone(model, boneMapper, 'rightHand',     [/righthand/, /hand_r/, /mixamorigrighthand/]);
  const leftUpperArm  = getBone(model, boneMapper, 'leftUpperArm',  [/leftarm/, /l_upperarm/, /upperarm_l/, /mixamorigleftarm/]);
  const leftForeArm   = getBone(model, boneMapper, 'leftLowerArm',  [/leftforearm/, /l_forearm/, /lowerarm_l/, /mixamorigleftforearm/]);

  rotateBoneDeg(neck, 0, 8, 6);
  rotateBoneDeg(rightUpperArm, -30, 0, -28);
  rotateBoneDeg(rightForeArm, -65, 0, 12);
  rotateBoneDeg(rightHand, 5, 0, 8);
  rotateBoneDeg(leftUpperArm, -12, 0, 22);
  rotateBoneDeg(leftForeArm, -55, 0, -8);
}

function applyPointPose(model, boneMapper = null) {
  const spine         = getBone(model, boneMapper, 'spine',         [/spine(?:0?1)?/, /chest/, /mixamorigspine/]);
  const rightUpperArm = getBone(model, boneMapper, 'rightUpperArm', [/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/]);
  const rightForeArm  = getBone(model, boneMapper, 'rightLowerArm', [/rightforearm/, /r_forearm/, /lowerarm_r/, /mixamorigrightforearm/]);
  const rightHand     = getBone(model, boneMapper, 'rightHand',     [/righthand/, /hand_r/, /mixamorigrighthand/]);
  const leftUpperArm  = getBone(model, boneMapper, 'leftUpperArm',  [/leftarm/, /l_upperarm/, /upperarm_l/, /mixamorigleftarm/]);
  const leftForeArm   = getBone(model, boneMapper, 'leftLowerArm',  [/leftforearm/, /l_forearm/, /lowerarm_l/, /mixamorigleftforearm/]);

  rotateBoneDeg(spine, -5, 12, 0);
  rotateBoneDeg(rightUpperArm, -35, 0, -45);
  rotateBoneDeg(rightForeArm, -55, 0, 18);
  rotateBoneDeg(rightHand, -10, 0, 0);
  rotateBoneDeg(leftUpperArm, -8, 0, 22);
  rotateBoneDeg(leftForeArm, -25, 0, -8);

  // Index extended, other fingers curled
  applyFingerPose(model, 'right', 'point');
}

function applyBowPose(model, boneMapper = null) {
  const hips  = getBone(model, boneMapper, 'hips',  [/hips?/, /pelvis/, /mixamorigHips/i]);
  const spine = getBone(model, boneMapper, 'spine',  [/spine(?:0?1)?/, /mixamorigspine/]);
  const chest = getBone(model, boneMapper, 'chest',  [/chest/, /spine_?2/, /mixamorigspine1/]);
  const neck  = getBone(model, boneMapper, 'neck',   [/neck/, /mixamorigneck/]);

  rotateBoneDeg(hips, 25, 0, 0);
  rotateBoneDeg(spine, 20, 0, 0);
  rotateBoneDeg(chest, 15, 0, 0);
  rotateBoneDeg(neck, -15, 0, 0);
}

function applyPrayPose(model, boneMapper = null) {
  const spine         = getBone(model, boneMapper, 'spine',         [/spine(?:0?1)?/, /chest/, /mixamorigspine/]);
  const neck          = getBone(model, boneMapper, 'neck',          [/neck/, /mixamorigneck/]);
  const leftUpperArm  = getBone(model, boneMapper, 'leftUpperArm',  [/leftarm/, /l_upperarm/, /upperarm_l/, /mixamorigleftarm/]);
  const rightUpperArm = getBone(model, boneMapper, 'rightUpperArm', [/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/]);
  const leftForeArm   = getBone(model, boneMapper, 'leftLowerArm',  [/leftforearm/, /l_forearm/, /lowerarm_l/, /mixamorigleftforearm/]);
  const rightForeArm  = getBone(model, boneMapper, 'rightLowerArm', [/rightforearm/, /r_forearm/, /lowerarm_r/, /mixamorigrightforearm/]);

  rotateBoneDeg(spine, -8, 0, 0);
  rotateBoneDeg(neck, 10, 0, 0);
  rotateBoneDeg(leftUpperArm, -55, 0, -12);
  rotateBoneDeg(rightUpperArm, -55, 0, 12);
  rotateBoneDeg(leftForeArm, -60, 0, 18);
  rotateBoneDeg(rightForeArm, -60, 0, -18);

  // Fingers pressed together and extended upward for prayer
  applyFingerPose(model, 'left', 'pray');
  applyFingerPose(model, 'right', 'pray');
}

function applyShrugPose(model, boneMapper = null) {
  const neck          = getBone(model, boneMapper, 'neck',          [/neck/, /mixamorigneck/]);
  const leftUpperArm  = getBone(model, boneMapper, 'leftUpperArm',  [/leftarm/, /l_upperarm/, /upperarm_l/, /mixamorigleftarm/]);
  const rightUpperArm = getBone(model, boneMapper, 'rightUpperArm', [/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/]);
  const leftForeArm   = getBone(model, boneMapper, 'leftLowerArm',  [/leftforearm/, /l_forearm/, /lowerarm_l/, /mixamorigleftforearm/]);
  const rightForeArm  = getBone(model, boneMapper, 'rightLowerArm', [/rightforearm/, /r_forearm/, /lowerarm_r/, /mixamorigrightforearm/]);

  rotateBoneDeg(neck, 5, 0, 0);
  rotateBoneDeg(leftUpperArm, -20, 0, 62);
  rotateBoneDeg(rightUpperArm, -20, 0, -62);
  rotateBoneDeg(leftForeArm, -40, 0, -22);
  rotateBoneDeg(rightForeArm, -40, 0, 22);
}
