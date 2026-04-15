/**
 * LipSyncController — discovers and drives morph targets (blendshapes) on an
 * avatar mesh for facial expression and lipsync control.
 *
 * This controller is intentionally decoupled from audio. External code (Web
 * Speech API, Azure TTS, ElevenLabs, etc.) is responsible for supplying viseme
 * frames; this controller only applies them to the mesh.
 *
 * Viseme names follow the ARKit / Ready Player Me convention:
 *   viseme_sil, viseme_PP, viseme_FF, viseme_TH, viseme_DD,
 *   viseme_kk, viseme_CH, viseme_SS, viseme_nn, viseme_RR,
 *   viseme_aa, viseme_E, viseme_I, viseme_O, viseme_U,
 *   mouthOpen, jawOpen …
 *
 * Usage:
 *   const lipsync = new LipSyncController(avatarModel);
 *   if (lipsync.hasTargets) {
 *     // set a single value
 *     lipsync.setMorphValue('viseme_aa', 0.8);
 *     // apply a full viseme frame from a TTS provider
 *     lipsync.setVisemeFrame({ viseme_aa: 0.8, viseme_E: 0.1 });
 *     // get all morph targets for a debug UI
 *     const targets = lipsync.getAll();
 *   }
 */
export class LipSyncController {
  constructor(model) {
    this._model = model;
    /** @type {Array<{ name: string, mesh: THREE.Mesh, index: number }>} */
    this._morphTargets = [];
    /** @type {Array<{ name: string, mesh: THREE.Mesh, index: number }>} viseme-related subset */
    this._visemeTargets = [];
    /** @type {Record<string, number>} current logical value per name */
    this._currentValues = {};

    this._discover();
  }

  /** True if the avatar has at least one morph target. */
  get hasTargets() {
    return this._morphTargets.length > 0;
  }

  /**
   * Returns all discovered morph targets as an array of { name, value } objects.
   * Multiple meshes may share the same name; the returned list contains unique names.
   * @returns {{ name: string, value: number }[]}
   */
  getAll() {
    const seen = new Set();
    return this._morphTargets
      .filter(({ name }) => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      .map(({ name }) => ({ name, value: this._currentValues[name] ?? 0 }));
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

  /** Release resources (resets morph targets). */
  dispose() {
    this.resetAll();
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
      }
    });
  }
}
