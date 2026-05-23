/**
 * BoneMapper — detects the skeleton convention of a loaded avatar and exposes
 * bones under a normalised humanoid name set (VRM standard names).
 *
 * Detection order:
 *   1. VRM  — uses vrm.humanoid (exact, zero guessing)
 *   2. Mixamo  — "mixamorig:" / "mixamorig" prefix
 *   3. CC3  — "CC_Base_" prefix (Character Creator 3/4)
 *   4. Generic — broad regex patterns covering RPM, Meshy and other sources
 *
 * Standardised bone names (subset of VRM humanoid spec):
 *   hips · spine · chest · upperChest · neck · head · jaw
 *   leftShoulder  · leftUpperArm  · leftLowerArm  · leftHand
 *   rightShoulder · rightUpperArm · rightLowerArm · rightHand
 *   leftUpperLeg  · leftLowerLeg  · leftFoot
 *   rightUpperLeg · rightLowerLeg · rightFoot
 */

// All standard bone names this mapper resolves
export const STANDARD_BONES = [
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'jaw',
  'leftShoulder',  'leftUpperArm',  'leftLowerArm',  'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg',  'leftLowerLeg',  'leftFoot',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
];

// ── Convention-specific name tables ──────────────────────────────────────────

// Mixamo: strip "mixamorig:" or "mixamorig" prefix, then match lowercase
const MIXAMO_TABLE = {
  hips:          ['hips'],
  spine:         ['spine'],
  chest:         ['spine1'],
  upperChest:    ['spine2'],
  neck:          ['neck'],
  head:          ['head'],
  jaw:           ['jaw'],
  leftShoulder:  ['leftshoulder'],
  leftUpperArm:  ['leftarm'],
  leftLowerArm:  ['leftforearm'],
  leftHand:      ['lefthand'],
  rightShoulder: ['rightshoulder'],
  rightUpperArm: ['rightarm'],
  rightLowerArm: ['rightforearm'],
  rightHand:     ['righthand'],
  leftUpperLeg:  ['leftupleg'],
  leftLowerLeg:  ['leftleg'],
  leftFoot:      ['leftfoot'],
  rightUpperLeg: ['rightupleg'],
  rightLowerLeg: ['rightleg'],
  rightFoot:     ['rightfoot'],
};

// CC3 / Character Creator 3 & 4
const CC3_PATTERNS = {
  hips:          [/cc_base_hip$/i],
  spine:         [/cc_base_spine01$/i],
  chest:         [/cc_base_spine02$/i],
  neck:          [/cc_base_necktw01$|cc_base_neck$/i],
  head:          [/cc_base_head$/i],
  jaw:           [/cc_base_jawroot$/i],
  leftShoulder:  [/cc_base_l_clavicle$/i],
  leftUpperArm:  [/cc_base_l_upperarm$/i],
  leftLowerArm:  [/cc_base_l_forearm$/i],
  leftHand:      [/cc_base_l_hand$/i],
  rightShoulder: [/cc_base_r_clavicle$/i],
  rightUpperArm: [/cc_base_r_upperarm$/i],
  rightLowerArm: [/cc_base_r_forearm$/i],
  rightHand:     [/cc_base_r_hand$/i],
  leftUpperLeg:  [/cc_base_l_thigh$/i],
  leftLowerLeg:  [/cc_base_l_calf$/i],
  leftFoot:      [/cc_base_l_foot$/i],
  rightUpperLeg: [/cc_base_r_thigh$/i],
  rightLowerLeg: [/cc_base_r_calf$/i],
  rightFoot:     [/cc_base_r_foot$/i],
};

// Generic — covers Ready Player Me, Meshy.ai, and most other sources
const GENERIC_PATTERNS = {
  hips:          [/^hips?$/, /^pelvis$/, /^root$/],
  spine:         [/^spine$/, /^spine0?1$/],
  chest:         [/^spine0?2$/, /^chest$/, /^upperchest$/],
  neck:          [/^neck/],
  head:          [/^head$/],
  jaw:           [/^jaw/],
  leftShoulder:  [/left.*shoulder/, /shoulder.*\bl\b/, /l.*shoulder/],
  leftUpperArm:  [/^leftarm$/, /leftupperarm/, /upperarm.*\bl\b/, /\bl\b.*upperarm/],
  leftLowerArm:  [/leftforearm/, /lowerarm.*\bl\b/, /forearm.*\bl\b/],
  leftHand:      [/^lefthand$/, /hand.*\bl\b/],
  rightShoulder: [/right.*shoulder/, /shoulder.*\br\b/, /r.*shoulder/],
  rightUpperArm: [/^rightarm$/, /rightupperarm/, /upperarm.*\br\b/, /\br\b.*upperarm/],
  rightLowerArm: [/rightforearm/, /lowerarm.*\br\b/, /forearm.*\br\b/],
  rightHand:     [/^righthand$/, /hand.*\br\b/],
  leftUpperLeg:  [/leftupleg/, /left.*thigh/, /upperleg.*\bl\b/],
  leftLowerLeg:  [/^leftleg$/, /lowerleg.*\bl\b/, /shin.*\bl\b/, /calf.*\bl\b/],
  leftFoot:      [/leftfoot/, /foot.*\bl\b/],
  rightUpperLeg: [/rightupleg/, /right.*thigh/, /upperleg.*\br\b/],
  rightLowerLeg: [/^rightleg$/, /lowerleg.*\br\b/, /shin.*\br\b/, /calf.*\br\b/],
  rightFoot:     [/rightfoot/, /foot.*\br\b/],
};

// ── BoneMapper ────────────────────────────────────────────────────────────────

export class BoneMapper {
  constructor() {
    /** @type {Record<string, THREE.Bone>} */
    this._bones = {};
    /** @type {'vrm'|'mixamo'|'cc3'|'generic'|'none'} */
    this.source = 'none';
  }

  /** Returns the bone node for a standard name, or null if not found. */
  get(name) { return this._bones[name] ?? null; }

  /** True if the bone is mapped. */
  has(name) { return this._bones[name] != null; }

  /** Returns a copy of the full bones record. */
  toObject() { return { ...this._bones }; }

  /** How many standard bones were resolved. */
  get resolvedCount() { return Object.keys(this._bones).length; }

  /** Override or remove a single bone mapping. */
  set(name, bone) {
    if (bone != null) this._bones[name] = bone;
    else delete this._bones[name];
  }

  /** Shallow clone — same bone references, independent _bones record. */
  clone() {
    const copy = new BoneMapper();
    copy.source = this.source;
    copy._bones = { ...this._bones };
    return copy;
  }

  /**
   * Build a BoneMapper from a GLTF load result.
   * Tries VRM first, then falls back to convention detection on the scene.
   * @param {import('three/examples/jsm/loaders/GLTFLoader').GLTF} gltf
   * @returns {BoneMapper}
   */
  static fromGLTF(gltf) {
    const mapper = new BoneMapper();

    const vrm = gltf?.userData?.vrm;
    if (vrm?.humanoid) {
      mapper._fromVRM(vrm);
    } else {
      mapper._fromModel(gltf.scene);
    }

    return mapper;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _fromVRM(vrm) {
    this.source = 'vrm';
    const h = vrm.humanoid;

    for (const name of STANDARD_BONES) {
      // Use raw bone nodes — they are the actual Three.js Bone objects in the
      // scene graph and respond correctly to quaternion manipulation from
      // applyPosePreset / rotateBoneDeg. Normalized nodes are VRM-internal
      // virtual objects not reached by model.traverse(), so rest-pose snapshots
      // (ensureRestPoseSnapshot) would never capture them.
      const node = (h.getRawBoneNode?.(name)) ?? (h.getNormalizedBoneNode?.(name));
      if (node) this._bones[name] = node;
    }
  }

  _fromModel(model) {
    const bones = [];
    model.traverse((node) => { if (node.isBone) bones.push(node); });
    if (!bones.length) return;

    const names = bones.map((b) => b.name.toLowerCase());
    const hasMixamo = names.some((n) => n.startsWith('mixamorig'));
    const hasCC3    = names.some((n) => n.startsWith('cc_base'));

    // Avaturn and some other exporters use standard Mixamo bone names without
    // the "mixamorig" prefix (e.g. "Hips", "LeftArm", "LeftForeArm").
    // Detect this by checking for a characteristic subset of those names.
    const AVATURN_SIGNATURES = ['hips', 'leftarm', 'rightarm', 'leftforearm', 'rightforearm'];
    const hasAvaturnStyle = !hasMixamo && !hasCC3 &&
      AVATURN_SIGNATURES.every((sig) => names.some((n) => n === sig));

    if (hasMixamo || hasAvaturnStyle) this._fromMixamo(bones);
    else if (hasCC3)                  this._fromCC3(bones);
    else                              this._fromGeneric(bones);
  }

  _fromMixamo(bones) {
    this.source = 'mixamo';
    const stripPrefix = (name) =>
      name.toLowerCase().replace(/^mixamorig:?/, '');

    for (const [standard, targets] of Object.entries(MIXAMO_TABLE)) {
      for (const bone of bones) {
        if (targets.includes(stripPrefix(bone.name))) {
          this._bones[standard] = bone;
          break;
        }
      }
    }
  }

  _fromCC3(bones) {
    this.source = 'cc3';
    for (const [standard, patterns] of Object.entries(CC3_PATTERNS)) {
      const bone = this._matchFirst(bones, patterns);
      if (bone) this._bones[standard] = bone;
    }
  }

  _fromGeneric(bones) {
    this.source = 'generic';
    for (const [standard, patterns] of Object.entries(GENERIC_PATTERNS)) {
      const bone = this._matchFirst(bones, patterns);
      if (bone) this._bones[standard] = bone;
    }
  }

  _matchFirst(bones, patterns) {
    for (const bone of bones) {
      const n = bone.name.toLowerCase();
      if (patterns.some((p) => p.test(n))) return bone;
    }
    return null;
  }
}
