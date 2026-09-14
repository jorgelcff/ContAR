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
  const raw = String(posePreset || "idle");

  // Direct selection of an animation embedded in the model: "clip:<exact name>".
  // Names are matched case-sensitively (they can contain dots/parens, e.g.
  // "IdleV4.2(maya_head)"), bypassing the keyword heuristic below.
  if (raw.startsWith("clip:")) {
    const ref = raw.slice(5).trim();
    if (animationController) {
      animationController.setProceduralMode("default");
      animationController.stopAll();
    }
    ensureRestPoseSnapshot(model);
    resetToRestPose(model);
    const clips = Array.isArray(avatarClips) ? avatarClips : [];
    // "clip:<index>" (preferred — unambiguous even with duplicate clip names)
    // or "clip:<name>" (legacy/saved scenes). avatarClips lists the model's
    // embedded clips first, so the index lines up with the panel's list.
    const clip = /^\d+$/.test(ref)
      ? clips[Number(ref)] || null
      : clips.find((c) => String(c?.name || "").trim() === ref) || null;
    if (animationController && clip) {
      // Play the model's native clip as-authored (no Mixamo retargeting), so
      // partial clips (hand/eye poses) don't get their tracks misrouted onto
      // the spine/hips and tip the character over.
      animationController.play(clip, 0.35, { retarget: false });
    } else if (animationController) {
      // Clip not found (e.g. avatar changed) — fall back to idle, never T-pose.
      const fallbackIdle = externalClips.idle || idleClip;
      if (fallbackIdle) animationController.play(fallbackIdle, 0.35);
    }
    model.updateMatrixWorld(true);
    return;
  }

  const normalized = raw.toLowerCase();

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

  if (normalized === "neutral") {
    // Previously unhandled, which left the avatar in its bind pose — arms
    // straight out, i.e. a T-pose under the name "Neutra".
    relaxArms(model, getArmChain(model, boneMapper));
  } else if (normalized === "speaker") {
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

export function captureRestPoseSnapshot(model) {
  model.updateMatrixWorld(true);
  model.traverse((node) => {
    if (!node?.isBone) return;
    node.userData.__restQuat = node.quaternion.clone();
    node.userData.__restWorldQuat = new THREE.Quaternion();
    node.getWorldQuaternion(node.userData.__restWorldQuat);
  });
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

const _aimFrom = new THREE.Vector3();
const _aimPivot = new THREE.Vector3();
const _aimTo = new THREE.Vector3();
const _aimDelta = new THREE.Quaternion();
const _aimParent = new THREE.Quaternion();
const _aimParentInv = new THREE.Quaternion();
const _aimModel = new THREE.Quaternion();

/**
 * Points the segment from `bone` to `childBone` along `dir`, wherever the bone
 * happens to rest.
 *
 * rotateBoneDeg() applies a fixed offset *relative to the rest pose*, which
 * only lands where intended if every avatar rests the same way. They don't:
 * these rigs bind in a T-pose (arms already horizontal), so offsets authored
 * against an arms-down rest overshoot — that is why "t_pose" raised the arms
 * overhead and "hands_on_hips" barely moved them. Aiming at an absolute
 * direction instead is rig-agnostic: the result is the same pose whether the
 * avatar binds in a T-pose, an A-pose or with its arms down.
 *
 * `dir` is given in the model's own frame, so the pose is unaffected by how
 * the model is rotated in the scene.
 */
function aimBone(model, bone, childBone, dir) {
  if (!bone || !childBone) return;

  bone.updateWorldMatrix(true, false);
  childBone.updateWorldMatrix(true, false);
  _aimFrom
    .setFromMatrixPosition(childBone.matrixWorld)
    .sub(_aimPivot.setFromMatrixPosition(bone.matrixWorld));
  if (_aimFrom.lengthSq() < 1e-12) return;
  _aimFrom.normalize();

  model.getWorldQuaternion(_aimModel);
  _aimTo.copy(dir).normalize().applyQuaternion(_aimModel);

  // Shortest-arc rotation in world space, conjugated into the bone's parent
  // frame so it can be stored as a local rotation:
  //   q_local' = W_parent⁻¹ · delta · W_parent · q_local
  _aimDelta.setFromUnitVectors(_aimFrom, _aimTo);
  if (bone.parent) bone.parent.getWorldQuaternion(_aimParent);
  else _aimParent.identity();
  _aimParentInv.copy(_aimParent).invert();
  bone.quaternion.premultiply(
    _aimParentInv.multiply(_aimDelta).multiply(_aimParent),
  );

  // Children read their parent's world matrix on the next aim, so refresh now.
  bone.updateMatrixWorld(true);
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

/**
 * Lets an arm hang naturally at the side.
 *
 * Every rig here binds in a T-pose, so an arm a pose does not explicitly place
 * stays sticking straight out — which is why "neutral" looked like a T-pose and
 * why the idle arm in "wave" or "point" stuck out sideways.
 */
function relaxArm(model, arms, side) {
  const out = side === 'left' ? 1 : -1;
  aimBone(model, arms[`${side}UpperArm`], arms[`${side}ForeArm`],
    new THREE.Vector3(0.18 * out, -0.98, 0));
  aimBone(model, arms[`${side}ForeArm`], arms[`${side}Hand`],
    new THREE.Vector3(0.13 * out, -0.96, 0.14));
}

function relaxArms(model, arms) {
  relaxArm(model, arms, 'left');
  relaxArm(model, arms, 'right');
}

/** Both arm chains, resolved once — shoulder → elbow → hand on each side. */
function getArmChain(model, boneMapper) {
  return {
    leftUpperArm:  getBone(model, boneMapper, 'leftUpperArm',  [/leftarm/, /l_upperarm/, /upperarm_l/, /mixamorigleftarm/]),
    leftForeArm:   getBone(model, boneMapper, 'leftLowerArm',  [/leftforearm/, /l_forearm/, /lowerarm_l/, /mixamorigleftforearm/]),
    leftHand:      getBone(model, boneMapper, 'leftHand',      [/lefthand/, /hand_l/, /mixamoriglefthand/]),
    rightUpperArm: getBone(model, boneMapper, 'rightUpperArm', [/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/]),
    rightForeArm:  getBone(model, boneMapper, 'rightLowerArm', [/rightforearm/, /r_forearm/, /lowerarm_r/, /mixamorigrightforearm/]),
    rightHand:     getBone(model, boneMapper, 'rightHand',     [/righthand/, /hand_r/, /mixamorigrighthand/]),
  };
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

  const arms = getArmChain(model, boneMapper);
  relaxArm(model, arms, 'left');
  // Upper arm out and up, forearm raised so the hand sits beside the head.
  aimBone(model, arms.rightUpperArm, arms.rightForeArm, new THREE.Vector3(-0.72, 0.66, -0.22));
  aimBone(model, arms.rightForeArm, arms.rightHand, new THREE.Vector3(-0.30, 0.94, -0.16));

  // Spread fingers for wave
  applyFingerPose(model, 'right', 'spread');
}

function applySpeakerPose(model, boneMapper = null) {
  const spine         = getBone(model, boneMapper, 'spine',         [/spine(?:0?1)?/, /chest/, /mixamorigspine/]);
  const neck          = getBone(model, boneMapper, 'neck',          [/neck/, /mixamorigneck/]);

  rotateBoneDeg(spine, -4, 0, 0);
  rotateBoneDeg(neck, 2, 0, 0);

  const arms = getArmChain(model, boneMapper);
  // Open, ready-to-gesture stance: arms down but held a little away from the
  // body, forearms angled forward. The animation controller layers its speaker
  // gestures on top of this.
  aimBone(model, arms.leftUpperArm, arms.leftForeArm, new THREE.Vector3(0.30, -0.94, -0.16));
  aimBone(model, arms.leftForeArm, arms.leftHand, new THREE.Vector3(0.34, -0.50, -0.80));
  aimBone(model, arms.rightUpperArm, arms.rightForeArm, new THREE.Vector3(-0.30, -0.94, -0.16));
  aimBone(model, arms.rightForeArm, arms.rightHand, new THREE.Vector3(-0.34, -0.50, -0.80));
}

function applyHandsOnHipsPose(model, boneMapper = null) {
  const arms = getArmChain(model, boneMapper);
  // Elbows out and back, forearms angling down and in so the hands land on the
  // waist. The model faces -Z, so -Z is forward and +X is its left.
  aimBone(model, arms.leftUpperArm, arms.leftForeArm, new THREE.Vector3(0.62, -0.72, 0.31));
  aimBone(model, arms.leftForeArm, arms.leftHand, new THREE.Vector3(-0.52, -0.72, -0.46));
  aimBone(model, arms.rightUpperArm, arms.rightForeArm, new THREE.Vector3(-0.62, -0.72, 0.31));
  aimBone(model, arms.rightForeArm, arms.rightHand, new THREE.Vector3(0.52, -0.72, -0.46));
}

function applySalutePose(model, boneMapper = null) {

  const arms = getArmChain(model, boneMapper);
  relaxArm(model, arms, 'left');
  // Elbow out at shoulder height, forearm angled up and inward to the brow.
  aimBone(model, arms.rightUpperArm, arms.rightForeArm, new THREE.Vector3(-0.82, 0.16, -0.55));
  aimBone(model, arms.rightForeArm, arms.rightHand, new THREE.Vector3(0.52, 0.74, -0.42));

  // Flat hand for salute — fingers extended and together
  applyFingerPose(model, 'right', 'flat');
}

function applyArmsCrossedPose(model, boneMapper = null) {
  const arms = getArmChain(model, boneMapper);
  // Upper arms hang close to the body and slightly forward; forearms run almost
  // horizontally across the chest, each toward the opposite shoulder.
  aimBone(model, arms.leftUpperArm, arms.leftForeArm, new THREE.Vector3(0.26, -0.93, -0.26));
  aimBone(model, arms.leftForeArm, arms.leftHand, new THREE.Vector3(-0.90, 0.16, -0.40));
  aimBone(model, arms.rightUpperArm, arms.rightForeArm, new THREE.Vector3(-0.26, -0.93, -0.26));
  aimBone(model, arms.rightForeArm, arms.rightHand, new THREE.Vector3(0.90, 0.16, -0.40));
}

function applyTPose(model, boneMapper = null) {
  const arms = getArmChain(model, boneMapper);
  // Straight out to the sides, level with the shoulders — the definition of a
  // T-pose, reached by aiming rather than by offsetting from the rest pose.
  aimBone(model, arms.leftUpperArm, arms.leftForeArm, new THREE.Vector3(1, 0, 0));
  aimBone(model, arms.leftForeArm, arms.leftHand, new THREE.Vector3(1, 0, 0));
  aimBone(model, arms.rightUpperArm, arms.rightForeArm, new THREE.Vector3(-1, 0, 0));
  aimBone(model, arms.rightForeArm, arms.rightHand, new THREE.Vector3(-1, 0, 0));
}

function applyThinkPose(model, boneMapper = null) {
  const neck          = getBone(model, boneMapper, 'neck',          [/neck/, /mixamorigneck/]);

  rotateBoneDeg(neck, 0, 8, 6);
  const arms = getArmChain(model, boneMapper);
  // Right hand to the chin; left arm tucked across the waist under the elbow.
  aimBone(model, arms.rightUpperArm, arms.rightForeArm, new THREE.Vector3(-0.34, -0.90, -0.28));
  aimBone(model, arms.rightForeArm, arms.rightHand, new THREE.Vector3(0.26, 0.84, -0.48));
  aimBone(model, arms.leftUpperArm, arms.leftForeArm, new THREE.Vector3(0.24, -0.95, -0.20));
  aimBone(model, arms.leftForeArm, arms.leftHand, new THREE.Vector3(-0.88, 0.22, -0.42));
}

function applyPointPose(model, boneMapper = null) {
  const spine         = getBone(model, boneMapper, 'spine',         [/spine(?:0?1)?/, /chest/, /mixamorigspine/]);

  rotateBoneDeg(spine, -5, 12, 0);
  const arms = getArmChain(model, boneMapper);
  relaxArm(model, arms, 'left');
  // Whole arm extended forward and slightly across the body.
  aimBone(model, arms.rightUpperArm, arms.rightForeArm, new THREE.Vector3(-0.26, -0.22, -0.94));
  aimBone(model, arms.rightForeArm, arms.rightHand, new THREE.Vector3(-0.12, -0.06, -0.99));

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

  // Without this the arms stay out sideways through the whole bow.
  relaxArms(model, getArmChain(model, boneMapper));
}

function applyPrayPose(model, boneMapper = null) {
  const spine         = getBone(model, boneMapper, 'spine',         [/spine(?:0?1)?/, /chest/, /mixamorigspine/]);
  const neck          = getBone(model, boneMapper, 'neck',          [/neck/, /mixamorigneck/]);

  rotateBoneDeg(spine, -8, 0, 0);
  rotateBoneDeg(neck, 10, 0, 0);

  const arms = getArmChain(model, boneMapper);
  // Upper arms tucked in at the sides, forearms angled up and inward so both
  // hands meet in front of the chest.
  aimBone(model, arms.leftUpperArm, arms.leftForeArm, new THREE.Vector3(0.22, -0.94, -0.26));
  aimBone(model, arms.leftForeArm, arms.leftHand, new THREE.Vector3(-0.34, 0.74, -0.58));
  aimBone(model, arms.rightUpperArm, arms.rightForeArm, new THREE.Vector3(-0.22, -0.94, -0.26));
  aimBone(model, arms.rightForeArm, arms.rightHand, new THREE.Vector3(0.34, 0.74, -0.58));

  // Fingers pressed together and extended upward for prayer
  applyFingerPose(model, 'left', 'pray');
  applyFingerPose(model, 'right', 'pray');
}

function applyShrugPose(model, boneMapper = null) {
  const neck          = getBone(model, boneMapper, 'neck',          [/neck/, /mixamorigneck/]);

  rotateBoneDeg(neck, 5, 0, 0);

  const arms = getArmChain(model, boneMapper);
  // Upper arms hang but angle out from the body; forearms turn forward and out
  // with the palms rolling up — the "who knows?" silhouette.
  aimBone(model, arms.leftUpperArm, arms.leftForeArm, new THREE.Vector3(0.46, -0.87, 0.16));
  aimBone(model, arms.leftForeArm, arms.leftHand, new THREE.Vector3(0.62, 0.16, -0.77));
  aimBone(model, arms.rightUpperArm, arms.rightForeArm, new THREE.Vector3(-0.46, -0.87, 0.16));
  aimBone(model, arms.rightForeArm, arms.rightHand, new THREE.Vector3(-0.62, 0.16, -0.77));
}
