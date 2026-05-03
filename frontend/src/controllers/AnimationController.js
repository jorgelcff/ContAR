import * as THREE from 'three';

/**
 * AnimationController — manages Three.js AnimationMixer with smooth crossfade,
 * idle animation looping, and procedural micro-animations (blink, breathing).
 *
 * Usage:
 *   const ctrl = new AnimationController(model, clips);
 *   // every frame:
 *   ctrl.update(delta);
 *   // switch animation with crossfade:
 *   ctrl.play('idle', 0.4);
 */
export class AnimationController {
  constructor(model, clips = []) {
    this._model = model;
    this._mixer = new THREE.AnimationMixer(model);
    /** @type {Map<string, THREE.AnimationAction>} */
    this._actions = new Map();
    this._currentAction = null;

    // Procedural blink
    this._blinkTimer = 0;
    this._blinkInterval = 3 + Math.random() * 4; // 3–7 s
    this._blinkDuration = 0.12; // seconds for one blink
    this._blinkActive = false;
    this._blinkElapsed = 0;
    /** @type {Array<(v: number) => void> | null} cached setters, null = not discovered yet */
    this._blinkSetters = null;

    // Procedural breathing
    this._breathTimer = 0;
    /** @type {THREE.Bone | null | undefined} undefined = not searched yet */
    this._chestBone = undefined;

    // Procedural speaker gestures for storytelling scenes
    this._proceduralMode = 'default';
    this._speakerTime = 0;
    /** @type {Record<string, { bone: THREE.Bone, baseQuat: THREE.Quaternion }> | null | undefined} */
    this._speakerBones = undefined;

    this.addClips(clips);
  }

  get mixer() {
    return this._mixer;
  }

  /**
   * Register additional animation clips (e.g. from a separate .glb).
   * @param {THREE.AnimationClip[]} clips
   */
  addClips(clips = []) {
    for (const clip of clips) {
      if (!clip?.name) continue;
      const action = this._mixer.clipAction(clip);
      action.enabled = true;
      this._actions.set(clip.name.toLowerCase(), action);
    }
  }

  /**
   * Play a clip by name or clip reference, crossfading from the current action.
   * @param {string|THREE.AnimationClip} clipOrName
   * @param {number} fadeDuration  seconds (default 0.4)
   * @returns {boolean} true if the clip was found and started
   */
  play(clipOrName, fadeDuration = 0.4) {
    let action;

    if (clipOrName instanceof THREE.AnimationClip) {
      action = this._mixer.clipAction(clipOrName);
      action.enabled = true;
      this._actions.set(clipOrName.name.toLowerCase(), action);
    } else {
      action = this._findAction(String(clipOrName ?? '').toLowerCase());
    }

    if (!action) return false;
    if (action === this._currentAction) return true;

    action.reset();
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);

    if (this._currentAction) {
      this._currentAction.crossFadeTo(action, fadeDuration, true);
    } else {
      action.fadeIn(fadeDuration);
    }

    action.play();
    this._currentAction = action;
    return true;
  }

  /** Stop all active actions immediately. */
  stopAll() {
    this._mixer.stopAllAction();
    this._currentAction = null;
  }

  /**
   * Set procedural behavior profile.
   * @param {'default'|'speaker'} mode
   */
  setProceduralMode(mode = 'default') {
    const normalized = mode === 'speaker' ? 'speaker' : 'default';
    if (this._proceduralMode === normalized) return;

    if (this._proceduralMode === 'speaker') {
      this._resetSpeakerBones();
      this._speakerTime = 0;
    }

    this._proceduralMode = normalized;
    if (normalized === 'speaker') {
      this._speakerBones = undefined;
    }
  }

  /**
   * Must be called every rendered frame with the elapsed delta time.
   * @param {number} delta  seconds since last frame
   */
  update(delta) {
    this._mixer.update(delta);
    this._updateBlink(delta);
    this._updateBreathing(delta);
    this._updateSpeakerGestures(delta);
  }

  /** Release mixer resources. */
  dispose() {
    this._mixer.stopAllAction();
    this._mixer.uncacheRoot(this._model);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  _findAction(key) {
    if (this._actions.has(key)) return this._actions.get(key);
    // Partial match: key is a substring of a stored name, or vice-versa
    for (const [name, action] of this._actions) {
      if (name.includes(key) || key.includes(name)) return action;
    }
    return null;
  }

  _updateBlink(delta) {
    const setters = this._getBlinkSetters();
    if (!setters.length) return;

    this._blinkTimer += delta;

    if (!this._blinkActive && this._blinkTimer >= this._blinkInterval) {
      this._blinkActive = true;
      this._blinkElapsed = 0;
      this._blinkTimer = 0;
      this._blinkInterval = 3 + Math.random() * 4;
    }

    if (this._blinkActive) {
      this._blinkElapsed += delta;
      const t = this._blinkElapsed / this._blinkDuration;
      // Triangle envelope: 0 → 1 → 0
      const weight = Math.max(0, 1 - Math.abs(t * 2 - 1));
      for (const set of setters) set(Math.min(1, weight));

      if (this._blinkElapsed >= this._blinkDuration) {
        for (const set of setters) set(0);
        this._blinkActive = false;
      }
    }
  }

  _getBlinkSetters() {
    if (this._blinkSetters !== null) return this._blinkSetters;

    const setters = [];
    this._model.traverse((node) => {
      if (!node.isMesh || !node.morphTargetDictionary) return;
      const keys = Object.keys(node.morphTargetDictionary);
      for (const k of keys.filter((n) => /blink/i.test(n))) {
        const idx = node.morphTargetDictionary[k];
        setters.push((v) => {
          node.morphTargetInfluences[idx] = v;
        });
      }
    });

    this._blinkSetters = setters;
    return setters;
  }

  _updateBreathing(delta) {
    // Lazy search for a chest / spine bone
    if (this._chestBone === undefined) {
      let found = null;
      this._model.traverse((node) => {
        if (found || !node.isBone) return;
        const name = String(node.name ?? '').toLowerCase();
        if (/spine(?:0?1)|chest/i.test(name)) found = node;
      });
      this._chestBone = found; // may be null if not found
    }

    if (!this._chestBone) return;

    this._breathTimer += delta;
    // ~12 breaths/min, very subtle (±0.004 rad)
    this._chestBone.rotation.x = Math.sin(this._breathTimer * 0.2 * Math.PI) * 0.004;
  }

  _updateSpeakerGestures(delta) {
    if (this._proceduralMode !== 'speaker') return;

    const bones = this._getSpeakerBones();
    if (!bones) return;

    this._speakerTime += delta;
    const t = this._speakerTime;

    const applyOffset = (entry, x = 0, y = 0, z = 0) => {
      if (!entry?.bone) return;
      const offset = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
      entry.bone.quaternion.copy(entry.baseQuat).multiply(offset);
    };

    applyOffset(bones.head, Math.sin(t * 2.1) * 0.02, Math.sin(t * 1.2) * 0.05, 0);
    applyOffset(bones.neck, 0, Math.sin(t * 0.9 + 0.5) * 0.025, 0);

    applyOffset(
      bones.leftUpperArm,
      -0.12 + Math.sin(t * 2.2 + 0.2) * 0.05,
      0,
      0.28 + Math.sin(t * 1.7) * 0.07
    );
    applyOffset(
      bones.rightUpperArm,
      -0.1 + Math.sin(t * 2.2 + 1.2) * 0.05,
      0,
      -0.28 + Math.sin(t * 1.7 + 1.1) * 0.07
    );
    applyOffset(bones.leftForeArm, -0.35 + Math.sin(t * 2.8 + 0.8) * 0.08, 0, -0.08);
    applyOffset(bones.rightForeArm, -0.35 + Math.sin(t * 2.8 + 1.9) * 0.08, 0, 0.08);
  }

  _getSpeakerBones() {
    if (this._speakerBones !== undefined) return this._speakerBones;

    const findBone = (patterns) => {
      let found = null;
      this._model.traverse((node) => {
        if (found || !node?.isBone) return;
        const name = String(node.name || '').toLowerCase();
        if (patterns.some((re) => re.test(name))) {
          found = node;
        }
      });
      return found;
    };

    const capture = (bone) => (bone ? { bone, baseQuat: bone.quaternion.clone() } : null);

    const bones = {
      head: capture(findBone([/head/, /mixamorighead/])),
      neck: capture(findBone([/neck/, /mixamorigneck/])),
      leftUpperArm: capture(findBone([/leftarm/, /l_upperarm/, /upperarm_l/, /mixamorigleftarm/])),
      rightUpperArm: capture(findBone([/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/])),
      leftForeArm: capture(findBone([/leftforearm/, /l_forearm/, /lowerarm_l/, /mixamorigleftforearm/])),
      rightForeArm: capture(findBone([/rightforearm/, /r_forearm/, /lowerarm_r/, /mixamorigrightforearm/])),
    };

    const hasAnyBone = Object.values(bones).some(Boolean);
    this._speakerBones = hasAnyBone ? bones : null;
    return this._speakerBones;
  }

  _resetSpeakerBones() {
    if (!this._speakerBones) return;
    Object.values(this._speakerBones).forEach((entry) => {
      if (!entry?.bone || !entry?.baseQuat) return;
      entry.bone.quaternion.copy(entry.baseQuat);
    });
  }
}
