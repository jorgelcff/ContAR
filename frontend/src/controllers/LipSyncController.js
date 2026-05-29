/**
 * LipSyncController — discovers and drives morph targets (blendshapes) on an
 * avatar mesh for facial expression and lipsync control.
 *
 * This controller is intentionally decoupled from audio. External code (Web
 * Speech API, Azure TTS, ElevenLabs, etc.) is responsible for supplying viseme
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

    this._discover();
  }

  /** True if the avatar has at least one morph target. */
  get hasTargets() {
    return this._morphTargets.length > 0;
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
        
        Object.entries(VISEME_PATTERNS).forEach(([group, patterns]) => {
          if (patterns.some((pattern) => pattern.test(name))) {
            this._groupedTargets[group].push(entry);
          }
        });
      }
    });
  }
}
