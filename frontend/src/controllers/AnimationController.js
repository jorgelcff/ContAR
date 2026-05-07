import * as THREE from 'three';

/**
 * AnimationController — manages Three.js AnimationMixer with smooth crossfade,
 * idle animation looping, and procedural micro-animations (blink, breathing,
 * idle sway, speaker gestures).
 */
export class AnimationController {
  constructor(model, clips = []) {
    this._model = model;
    this._mixer = new THREE.AnimationMixer(model);
    this._actions = new Map();
    this._currentAction = null;

    // ── Blink ────────────────────────────────────────────────
    this._blinkTimer = 0;
    this._blinkInterval = 2.5 + Math.random() * 4;
    this._blinkDuration = 0.1;
    this._blinkActive = false;
    this._blinkElapsed = 0;
    this._doubleBlink = false;   // flag: blink again shortly after
    this._doubleBlinkDelay = 0;
    this._blinkSetters = null;

    // ── Breathing ────────────────────────────────────────────
    this._breathTimer = 0;
    this._chestBone = undefined;
    this._shoulderBones = undefined; // { left, right }

    // ── Speaker gestures ─────────────────────────────────────
    this._proceduralMode = 'default';
    this._speakerTime = 0;
    this._speakerBones = undefined;

    this.addClips(clips);
  }

  get mixer() { return this._mixer; }

  addClips(clips = []) {
    for (const clip of clips) {
      if (!clip?.name) continue;
      const action = this._mixer.clipAction(clip);
      action.enabled = true;
      this._actions.set(clip.name.toLowerCase(), action);
    }
  }

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

  stopAll() {
    this._mixer.stopAllAction();
    this._currentAction = null;
  }

  setProceduralMode(mode = 'default') {
    const normalized = mode === 'speaker' ? 'speaker' : 'default';
    if (this._proceduralMode === normalized) return;
    if (this._proceduralMode === 'speaker') {
      this._resetSpeakerBones();
      this._speakerTime = 0;
    }
    this._proceduralMode = normalized;
    if (normalized === 'speaker') this._speakerBones = undefined;
  }

  update(delta) {
    this._mixer.update(delta);
    this._updateBlink(delta);
    this._updateBreathing(delta);
    this._updateSpeakerGestures(delta);
  }

  dispose() {
    this._mixer.stopAllAction();
    this._mixer.uncacheRoot(this._model);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _findAction(key) {
    if (this._actions.has(key)) return this._actions.get(key);
    for (const [name, action] of this._actions) {
      if (name.includes(key) || key.includes(name)) return action;
    }
    return null;
  }

  // ── Blink ─────────────────────────────────────────────────────────────────

  _updateBlink(delta) {
    const setters = this._getBlinkSetters();
    if (!setters.length) return;

    this._blinkTimer += delta;

    // Handle double-blink countdown
    if (this._doubleBlink) {
      this._doubleBlinkDelay -= delta;
      if (this._doubleBlinkDelay <= 0) {
        this._doubleBlink = false;
        this._blinkActive = true;
        this._blinkElapsed = 0;
      }
    }

    // Trigger new blink
    if (!this._blinkActive && !this._doubleBlink && this._blinkTimer >= this._blinkInterval) {
      this._blinkActive = true;
      this._blinkElapsed = 0;
      this._blinkTimer = 0;
      this._blinkInterval = 2.5 + Math.random() * 4;

      // 25% chance of a double blink
      if (Math.random() < 0.25) {
        this._doubleBlink = true;
        this._doubleBlinkDelay = 0.18 + Math.random() * 0.1;
      }
    }

    if (this._blinkActive) {
      this._blinkElapsed += delta;
      const t = this._blinkElapsed / this._blinkDuration;
      // Fast close, slow open (more natural than symmetric triangle)
      const closePhase = Math.min(1, t / 0.35);
      const openPhase = Math.max(0, (t - 0.35) / 0.65);
      const weight = closePhase < 1 ? closePhase : 1 - openPhase;
      for (const set of setters) set(Math.min(1, Math.max(0, weight)));
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
      for (const k of Object.keys(node.morphTargetDictionary).filter((n) => /blink/i.test(n))) {
        const idx = node.morphTargetDictionary[k];
        setters.push((v) => { node.morphTargetInfluences[idx] = v; });
      }
    });
    this._blinkSetters = setters;
    return setters;
  }

  // ── Breathing ─────────────────────────────────────────────────────────────

  _updateBreathing(delta) {
    // Only apply breathing when no clip animation is driving the skeleton.
    // During walk/run/dance/idle clips the mixer already animates the chest;
    // applying our own rotation on top fights the clip and looks wrong.
    if (this._currentAction !== null) return;

    if (this._chestBone === undefined) {
      let chest = null;
      this._model.traverse((node) => {
        if (!chest && node.isBone && /spine(?:0?[12])?|chest/i.test(String(node.name ?? ''))) {
          chest = node;
          // Capture rest quaternion so we can offset from it, not accumulate
          chest.userData.__breathBaseQuat = chest.quaternion.clone();
        }
      });
      this._chestBone = chest ?? null;
    }

    if (!this._chestBone) return;

    // Ensure base is captured (once per static-pose entry)
    if (!this._chestBone.userData.__breathBaseQuat) {
      this._chestBone.userData.__breathBaseQuat = this._chestBone.quaternion.clone();
    }

    this._breathTimer += delta;
    const t = this._breathTimer;

    // Asymmetric breath: two incommensurable frequencies (φ = golden ratio)
    const breathCycle = 0.22 * Math.PI; // ~12 breaths/min
    const breathRaw = Math.sin(t * breathCycle) * 0.7 + Math.sin(t * breathCycle * 1.618) * 0.3;
    const breathVal = Math.pow((breathRaw + 1) / 2, 1.6); // asymmetric ease

    // SET relative to captured rest — never accumulates
    const offset = new THREE.Quaternion().setFromEuler(
      new THREE.Euler((breathVal - 0.5) * 0.018, 0, 0)
    );
    this._chestBone.quaternion
      .copy(this._chestBone.userData.__breathBaseQuat)
      .multiply(offset);
  }

  // ── Speaker gestures ──────────────────────────────────────────────────────

  _updateSpeakerGestures(delta) {
    if (this._proceduralMode !== 'speaker') return;
    const bones = this._getSpeakerBones();
    if (!bones) return;

    this._speakerTime += delta;
    const t = this._speakerTime;

    // Helper: layered organic sine using golden ratio (φ) and silver ratio (δ)
    // φ = 1.618…  δ = 2.414…   These are incommensurable with each other and with 1.
    const φ = 1.6180339887;
    const δ = 2.4142135623;

    const organic = (base, a1 = 0.5, a2 = 0.35, a3 = 0.15, phase = 0) =>
      a1 * Math.sin(t * base + phase) +
      a2 * Math.sin(t * base * φ + phase * 1.3) +
      a3 * Math.sin(t * base * δ + phase * 0.7);

    const applyOffset = (entry, x = 0, y = 0, z = 0) => {
      if (!entry?.bone) return;
      const offset = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
      entry.bone.quaternion.copy(entry.baseQuat).multiply(offset);
    };

    // Head: nod + turn, asymmetric
    applyOffset(bones.head,
      organic(1.1, 0.020, 0.012, 0.008, 0.0),   // nod
      organic(0.7, 0.030, 0.020, 0.010, 0.5),   // turn
      organic(0.5, 0.010, 0.005, 0.005, 1.2)    // tilt
    );

    // Neck: follows head slightly, offset phase
    applyOffset(bones.neck,
      organic(0.9, 0.010, 0.006, 0.004, 0.3),
      organic(0.6, 0.018, 0.010, 0.006, 0.8),
      0
    );

    // Spine / torso sway — gives sense of weight and breath
    applyOffset(bones.spine,
      organic(0.4, 0.012, 0.007, 0.004, 1.5),
      organic(0.3, 0.008, 0.005, 0.002, 2.0),
      organic(0.35, 0.006, 0.003, 0.002, 0.4)
    );

    // Left arm — gestures slightly ahead of right
    applyOffset(bones.leftUpperArm,
      -0.14 + organic(1.1, 0.040, 0.025, 0.015, 0.0),
      0,
      0.24 + organic(0.85, 0.060, 0.035, 0.015, 0.3)
    );
    applyOffset(bones.leftForeArm,
      -0.30 + organic(1.4, 0.050, 0.030, 0.010, 0.6),
      organic(0.7, 0.015, 0.010, 0.005, 0.2),
      -0.06
    );

    // Right arm — slightly different rhythm (offset phase)
    applyOffset(bones.rightUpperArm,
      -0.12 + organic(1.1, 0.040, 0.025, 0.015, 1.4),
      0,
      -0.24 + organic(0.85, 0.060, 0.035, 0.015, 1.7)
    );
    applyOffset(bones.rightForeArm,
      -0.28 + organic(1.4, 0.050, 0.030, 0.010, 2.0),
      organic(0.7, 0.015, 0.010, 0.005, 1.8),
      0.06
    );

    // Wrist micro-rotation (expressiveness detail)
    applyOffset(bones.leftHand,
      0,
      organic(1.8, 0.020, 0.012, 0.006, 0.0),
      organic(2.1, 0.015, 0.010, 0.005, 0.5)
    );
    applyOffset(bones.rightHand,
      0,
      organic(1.8, 0.020, 0.012, 0.006, 2.3),
      organic(2.1, 0.015, 0.010, 0.005, 1.9)
    );
  }

  _getSpeakerBones() {
    if (this._speakerBones !== undefined) return this._speakerBones;

    const findBone = (patterns) => {
      let found = null;
      this._model.traverse((node) => {
        if (found || !node?.isBone) return;
        const name = String(node.name || '').toLowerCase();
        if (patterns.some((re) => re.test(name))) found = node;
      });
      return found;
    };

    const capture = (bone) => (bone ? { bone, baseQuat: bone.quaternion.clone() } : null);

    const bones = {
      head:          capture(findBone([/\bhead\b/, /mixamorighead/])),
      neck:          capture(findBone([/\bneck\b/, /mixamorigneck/])),
      spine:         capture(findBone([/spine(?:0?1)?$/, /mixamorigspine/])),
      leftUpperArm:  capture(findBone([/leftarm/, /l_upperarm/, /upperarm_l/, /mixamorigleftarm/])),
      rightUpperArm: capture(findBone([/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/])),
      leftForeArm:   capture(findBone([/leftforearm/, /l_forearm/, /lowerarm_l/, /mixamorigleftforearm/])),
      rightForeArm:  capture(findBone([/rightforearm/, /r_forearm/, /lowerarm_r/, /mixamorigrightforearm/])),
      leftHand:      capture(findBone([/lefthand/, /hand_l/, /mixamoriglefthand/])),
      rightHand:     capture(findBone([/righthand/, /hand_r/, /mixamorigrighthand/])),
    };

    this._speakerBones = Object.values(bones).some(Boolean) ? bones : null;
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
