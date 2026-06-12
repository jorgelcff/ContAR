/**
 * LipSyncController — discovers and drives morph targets (blendshapes) on an
 * avatar mesh for facial expression and lipsync control.
 *
 * This controller is intentionally decoupled from audio. External code (Web
 * Speech API, Azure TTS, etc.) is responsible for supplying viseme
 * frames; this controller only applies them to the mesh.
 */
import * as THREE from 'three';

const VISEME_PATTERNS = {
  aa: [/viseme.*aa/i, /viseme.*ah/i, /mouthopen/i, /jawopen/i],
  oh: [/viseme.*oh/i, /viseme.*o/i, /mouthfunnel/i, /mouthpucker/i],
  ee: [/viseme.*ee/i, /viseme.*ih/i, /mouthsmile/i, /mouthstretch/i],
  fv: [/viseme.*ff/i, /viseme.*fv/i, /mouthrolllower/i],
  mbp: [/viseme.*pp/i, /viseme.*bb/i, /viseme.*mm/i, /mouthclose/i],
  mouthOpen: [/jaw.*open/i, /mouth.*open/i, /^jawopen$/i, /^mouthopen$/i, /viseme.*(aa|ah|ao|oh|o)/i],
};

// Bone names that represent the jaw across rig conventions (VRM, Mixamo, CC3,
// Avaturn/ReadyPlayerMe). Used for the no-morph-target fallback.
const JAW_BONE_PATTERNS = [
  /^jaw$/i, /jaw_?root/i, /lower_?jaw/i, /^c_jaw/i, /j_bip_c_jaw/i, /cc_base_jawroot/i, /\bjaw\b/i,
];
// Max jaw-open rotation (radians) when value = 1.
const JAW_MAX_ANGLE = 0.32;

export class LipSyncController {
  constructor(model) {
    this._model = model;
    /** @type {Array<{ name: string, mesh: THREE.Mesh, index: number }>} */
    this._morphTargets = [];
    /** @type {Array<{ name: string, mesh: THREE.Mesh, index: number }>} viseme-related subset */
    this._visemeTargets = [];
    /** @type {Record<string, Array<{ name: string, mesh: THREE.Mesh, index: number }>>} */
    this._groupedTargets = { aa: [], oh: [], ee: [], fv: [], mbp: [], mouthOpen: [] };
    /** @type {Record<string, number>} current logical value per name */
    this._currentValues = {};
    /** @type {THREE.Bone|null} jaw bone used when there are no mouth morphs */
    this._jawBone = null;
    this._jawRestQuat = null;
    this._jawOpenQuat = new THREE.Quaternion();
    this._jawTmpQuat = new THREE.Quaternion();

    this._discover();
    this._discoverJawBone();
  }

  /** True if the avatar has at least one morph target. */
  get hasTargets() {
    return this._morphTargets.length > 0;
  }

  /** True if lipsync can be driven at all — via mouth morphs OR a jaw bone. */
  get hasMouth() {
    return this._mouthTargetCount > 0 || !!this._jawBone;
  }

  get _mouthTargetCount() {
    return this._groupedTargets.aa.length + this._groupedTargets.mouthOpen.length;
  }

  /**
   * Open the mouth by a normalized amount (0–1), using mouth morph targets when
   * present, otherwise rotating the jaw bone. This is the unified entry point
   * for amplitude-driven lipsync so morph-less Avaturn avatars still move.
   * @param {number} value 0–1
   */
  setMouthOpen(value) {
    const v = Math.max(0, Math.min(1, value));
    if (this._mouthTargetCount > 0) {
      this.setGroupValue('aa', v * 0.9);
      this.setGroupValue('mouthOpen', v * 0.45);
      return;
    }
    if (this._jawBone && this._jawRestQuat) {
      // Rotate the jaw open around its local X axis (chin drops down).
      this._jawOpenQuat.setFromAxisAngle({ x: 1, y: 0, z: 0 }, v * JAW_MAX_ANGLE);
      this._jawBone.quaternion.copy(this._jawRestQuat).multiply(this._jawOpenQuat);
    }
  }

  /** Close the mouth / reset lipsync to neutral (morphs or jaw). */
  resetMouth() {
    if (this._mouthTargetCount > 0) {
      this.resetGroups();
    } else if (this._jawBone && this._jawRestQuat) {
      this._jawBone.quaternion.copy(this._jawRestQuat);
    }
  }

  /**
   * Returns all discovered morph targets as an array of { name, meshName, value } objects.
   * Multiple meshes may share the same name; the returned list contains unique names
   * (first mesh that has the name wins for meshName).
   * @returns {{ name: string, meshName: string, value: number }[]}
   */
  getAll() {
    const seen = new Set();
    return this._morphTargets
      .filter(({ name }) => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      .map(({ name, mesh }) => ({
        name,
        meshName: mesh?.name || '',
        value: this._currentValues[name] ?? 0,
      }));
  }

  /**
   * Returns only viseme-related morph targets (unique names).
   * @returns {{ name: string, value: number }[]}
   */
  getVisemes() {
    const seen = new Set();
    return this._visemeTargets
      .filter(({ name }) => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      .map(({ name }) => ({ name, value: this._currentValues[name] ?? 0 }));
  }

  /**
   * Set a morph target value by name (applied to all meshes that have it).
   * @param {string} name   morph target / blendshape name
   * @param {number} value  0–1
   */
  setMorphValue(name, value) {
    const clamped = Math.max(0, Math.min(1, value));
    for (const entry of this._morphTargets) {
      if (entry.name === name) {
        entry.mesh.morphTargetInfluences[entry.index] = clamped;
      }
    }
    this._currentValues[name] = clamped;
  }

  /**
   * Apply a viseme frame from an external TTS provider.
   * Pass a map of morphTargetName → weight (0–1).
   * Targets not present in the map are left unchanged.
   * @param {Record<string, number>} visemeMap
   */
  setVisemeFrame(visemeMap) {
    for (const [name, value] of Object.entries(visemeMap)) {
      this.setMorphValue(name, value);
    }
  }

  /** Reset all morph targets to 0 (neutral expression). */
  resetAll() {
    for (const { name } of this._morphTargets) {
      this.setMorphValue(name, 0);
    }
  }

  /**
   * Apply heuristic viseme groups
   */
  setGroupValue(groupName, value) {
    const clamped = Math.max(0, Math.min(1, value));
    const targets = this._groupedTargets[groupName];
    if (!targets) return;

    for (const entry of targets) {
      entry.mesh.morphTargetInfluences[entry.index] = clamped;
      this._currentValues[entry.name] = clamped;
    }
  }

  resetGroups() {
    Object.keys(this._groupedTargets).forEach(group => this.setGroupValue(group, 0));
  }

  /**
   * Get specific group info (for checking how many targets it matched)
   */
  getGroupTargets(groupName) {
    return this._groupedTargets[groupName] || [];
  }

  /** Release resources (resets morph targets and jaw). */
  dispose() {
    this.resetAll();
    this.resetMouth();
  }

  /** Find a jaw bone for the no-morph fallback and snapshot its rest pose. */
  _discoverJawBone() {
    // Only needed when the avatar lacks mouth-open morph targets.
    if (this._mouthTargetCount > 0) return;
    let best = null;
    this._model.traverse((node) => {
      if (best || !node.isBone) return;
      const name = String(node.name || '');
      if (JAW_BONE_PATTERNS.some((re) => re.test(name))) best = node;
    });
    if (best) {
      this._jawBone = best;
      this._jawRestQuat = best.quaternion.clone();
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _discover() {
    /** Viseme / mouth-related pattern (ARKit + common variations). */
    const VISEME_RE = /viseme|mouthopen|mouthclose|jawopen|lip|cheek|tongue/i;

    this._model.traverse((node) => {
      if (!node.isMesh || !node.morphTargetDictionary) return;

      const dict = node.morphTargetDictionary;
      for (const [name, index] of Object.entries(dict)) {
        const entry = { name, mesh: node, index };
        this._morphTargets.push(entry);

        // Set initial value from current mesh state
        if (!(name in this._currentValues)) {
          this._currentValues[name] = node.morphTargetInfluences[index] ?? 0;
        }

        if (VISEME_RE.test(name)) {
          this._visemeTargets.push(entry);
        }
        
        Object.entries(VISEME_PATTERNS).forEach(([group, patterns]) => {
          if (patterns.some((pattern) => pattern.test(name))) {
            this._groupedTargets[group].push(entry);
          }
        });
      }
    });
  }
}
