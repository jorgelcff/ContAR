import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import SpeechBubble from './SpeechBubble';
import { AnimationController } from '../../controllers/AnimationController';
import { LipSyncController } from '../../controllers/LipSyncController';
import { BoneMapper, STANDARD_BONES } from '../../utils/BoneMapper';
import { mapBones as mapBonesApi } from '../../api/sceneApi';

const BONE_LABELS = {
  hips: 'Quadril', spine: 'Coluna', chest: 'Tórax', upperChest: 'Tórax superior',
  neck: 'Pescoço', head: 'Cabeça', jaw: 'Mandíbula',
  leftShoulder: 'Ombro esq.', leftUpperArm: 'Braço esq.', leftLowerArm: 'Antebraço esq.', leftHand: 'Mão esq.',
  rightShoulder: 'Ombro dir.', rightUpperArm: 'Braço dir.', rightLowerArm: 'Antebraço dir.', rightHand: 'Mão dir.',
  leftUpperLeg: 'Coxa esq.', leftLowerLeg: 'Perna esq.', leftFoot: 'Pé esq.',
  rightUpperLeg: 'Coxa dir.', rightLowerLeg: 'Perna dir.', rightFoot: 'Pé dir.',
};

const DEFAULT_LIP_SYNC_CONFIG = {
  amplitudeMultiplier: 18,
  noiseGate: 0.008,
  adaptiveNoiseGate: true,
  noiseFloorMultiplier: 2.2,
  noiseFloorRiseSpeed: 1.8,
  noiseFloorFallSpeed: 0.8,
  fullBandMix: 0.35,
  speechBandMix: 0.65,
  enableBandEnergy: true,
  visemeMode: 'heuristic',
  timelineCrossfadeSec: 0.08,
  timelineMouthWeight: 0.72,
  timelineSpeechWeight: 0.28,
  enableJawFallback: true,
  jawFallbackStrength: 0.7,
  jawAttackSpeed: 22,
  jawReleaseSpeed: 12,
  jawMaxDeltaPerSecond: 4,
  enableJawMicroJitter: true,
  jawMicroJitterAmount: 0.045,
  jawMicroJitterSpeed: 7.5,
  showBlendshapeDebug: false,
};

const MOUTH_OPEN_PATTERNS = [
  /jaw.*open/i,
  /mouth.*open/i,
  /^jawopen$/i,
  /^mouthopen$/i,
  /viseme.*(aa|ah|ao|oh|o)/i,
];

const MOUTH_FALLBACK_PATTERNS = [/jaw/i, /mouth/i, /lip/i, /viseme/i];

const JAW_BONE_PATTERNS = [
  /jaw/i,
  /lower.?jaw/i,
  /jaw.?bone/i,
  /jaw.?joint/i,
  /jaw.?jnt/i,
  /mandible/i,
  /chin.?joint/i,
  /chin/i,
  /mixamorigjaw/i,
  /cc_base_jawroot/i,
  /head_jaw/i,
];

const VISEME_PATTERNS = {
  aa: [/viseme.*aa/i, /viseme.*ah/i, /mouthopen/i, /jawopen/i],
  oh: [/viseme.*oh/i, /viseme.*o/i, /mouthfunnel/i, /mouthpucker/i],
  ee: [/viseme.*ee/i, /viseme.*ih/i, /mouthsmile/i, /mouthstretch/i],
  fv: [/viseme.*ff/i, /viseme.*fv/i, /mouthrolllower/i],
  mbp: [/viseme.*pp/i, /viseme.*bb/i, /viseme.*mm/i, /mouthclose/i],
};

const NO_RIG_SAFE_PRESET = {
  amplitudeMultiplier: 10,
  noiseGate: 0.03,
  jawFallbackStrength: 0.14,
  jawAttackSpeed: 18,
  jawReleaseSpeed: 10,
  jawMaxDeltaPerSecond: 2.6,
  jawMicroJitterAmount: 0.02,
};

function normalizeAvatarUrl(url) {
  if (typeof url !== 'string') return '';

  const value = url.trim();
  if (!value) return '';

  // Keep already encoded HTTP(S) URLs untouched to avoid double-encoding.
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  // Data URLs may be returned by the SDK depending on export settings.
  if (/^data:/i.test(value)) {
    return value;
  }

  return value;
}

/**
 * SceneCanvas — Three.js scene wrapped in a React component.
 *
 * Props:
 *   avatarUrl   – GLB model URL to load (changes trigger a reload)
 *   transform   – { positionX, positionY, positionZ, rotationY (deg), scale }
 *   posePreset  – idle | walk | run | dance | speaker | neutral | wave | hands_on_hips | salute | arms_crossed | t_pose | think | point | bow | pray | shrug
 *   speechText  – text to display in the speech bubble above the avatar's head
 *   analyserRef – ref to a Web Audio API AnalyserNode used for real-time lip sync
 */
export default function SceneCanvas({
  avatarUrl,
  transform,
  posePreset,
  speechText,
  analyserRef,
  lipSyncConfig,
  visemeTimeline,
  audioCurrentTime,
  vrmaUrl,
  animSpeed,
  animLoopOnce,
  vrmExpression,
  textDisplayMode = 'bubble',
}) {
  // Enable Three.js resource cache so reloading the same GLB/HDR skips a round-trip.
  THREE.Cache.enabled = true;

  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const avatarRef = useRef(null);
  const animControllerRef = useRef(null);
  const lipSyncControllerRef = useRef(null);
  const clockRef = useRef(new THREE.Timer());
  const animFrameRef = useRef(null);
  const idleClipRef = useRef(null);
  const avatarClipsRef = useRef([]);
  const posePresetRef = useRef(posePreset);
  const loaderRef = useRef(null);
  const vrmaLoaderRef = useRef(null);
  const vrmRef = useRef(null);
  // Clips loaded from /animations/manifest.json, keyed by preset name
  const externalClipsRef = useRef({});
  const vrmaUrlRef = useRef(vrmaUrl || null);
  const boneMapperRef = useRef(null);
  const baseBoneMapperRef = useRef(null);
  const skeletonHelperRef = useRef(null);
  const activeAvatarLoadIdRef = useRef(0);
  const extraClipsRef = useRef([]);
  const isVisibleRef = useRef(true);
  const mouthMarkerRef = useRef(null);
  const mouthMarkerInfoRef = useRef({ source: "none", name: "" });

  // Lip-sync: discovered mouth morph targets on the current avatar
  const mouthMorphsRef = useRef([]);
  const faceBlendshapesRef = useRef([]);
  const visemeMorphGroupsRef = useRef({
    aa: [],
    oh: [],
    ee: [],
    fv: [],
    mbp: [],
  });
  const jawBonesRef = useRef([]);
  const blendshapeCatalogRef = useRef([]);
  const lipSyncTelemetryRef = useRef({
    mouthOpen: 0,
    rms: 0,
    speechBand: 0,
    mode: "idle",
    analyserReady: false,
    mouthTargetCount: 0,
    jawBoneCount: 0,
  });
  const lastDebugCommitAtRef = useRef(0);
  const jawSmoothedOpenRef = useRef(0);
  const adaptiveNoiseFloorRef = useRef(0.005);
  const jawJitterPhaseRef = useRef(0);
  // Reusable typed array for analyser reads (allocated once per fftSize)
  const lipSyncDataRef = useRef(null);
  const lipSyncFreqDataRef = useRef(null);
  const visemeTimelineRef = useRef(visemeTimeline || []);
  const audioCurrentTimeRef = useRef(audioCurrentTime || 0);
  // Mirror the analyserRef prop into a local ref so the render-loop closure
  // can always access the latest value without requiring scene reinitialisation.
  const analyserRefLocal = useRef(analyserRef);
  useEffect(() => {
    analyserRefLocal.current = analyserRef;
  }, [analyserRef]);
  useEffect(() => {
    visemeTimelineRef.current = Array.isArray(visemeTimeline)
      ? visemeTimeline
      : [];
  }, [visemeTimeline]);
  useEffect(() => {
    audioCurrentTimeRef.current = Number(audioCurrentTime) || 0;
  }, [audioCurrentTime]);

  // Apply a .vrma animation whenever the URL changes (or after VRM loads)
  useEffect(() => {
    vrmaUrlRef.current = vrmaUrl || null;
    if (vrmaUrl && vrmRef.current && animControllerRef.current && vrmaLoaderRef.current) {
      loadVRMAAnimation(vrmaUrl, vrmRef.current, animControllerRef.current, vrmaLoaderRef.current);
    }
  }, [vrmaUrl]);

  // Expose renderer/camera to SpeechBubble via state once scene is ready
  const [renderCtx, setRenderCtx] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState("");
  const [debugSnapshot, setDebugSnapshot] = useState({
    mouthOpen: 0,
    rms: 0,
    speechBand: 0,
    mode: "idle",
  });
  const [blendshapeSnapshot, setBlendshapeSnapshot] = useState([]);
  const [boneCatalogSnapshot, setBoneCatalogSnapshot] = useState([]);
  const [meshCatalogSnapshot, setMeshCatalogSnapshot] = useState([]);
  const [manualJawBoneName, setManualJawBoneName] = useState("");
  const [blendshapeMeshFilter, setBlendshapeMeshFilter] = useState("all");
  const [mouthMarkerInfo, setMouthMarkerInfo] = useState({
    source: "none",
    name: "",
  });
  const [rigCopyState, setRigCopyState] = useState("");
  const [aiMapState, setAiMapState] = useState(""); // '' | 'loading' | 'ok:N' | 'error'
  const [boneOverrides, setBoneOverrides] = useState({});
  const [boneMapperInfo, setBoneMapperInfo] = useState({
    source: "none",
    resolvedCount: 0,
  });

  const mergedLipSyncConfig = {
    ...DEFAULT_LIP_SYNC_CONFIG,
    ...(lipSyncConfig || {}),
  };

  // Dev tools only visible when ?dev is present in the URL
  const showDevTools = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).has("dev");
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    posePresetRef.current = posePreset;
  }, [posePreset]);

  useEffect(() => {
    if (!avatarRef.current) return;
    jawBonesRef.current = resolveJawBones(
      avatarRef.current,
      manualJawBoneName,
      boneMapperRef.current,
    );
  }, [manualJawBoneName]);

  // Bone override: rebuild effective BoneMapper and reapply pose
  useEffect(() => {
    const base = baseBoneMapperRef.current;
    const model = avatarRef.current;
    if (!base || !model) return;

    const effective = base.clone();
    const overrideEntries = Object.entries(boneOverrides);
    if (overrideEntries.length > 0) {
      model.traverse((node) => {
        if (!node?.isBone) return;
        for (const [standard, boneName] of overrideEntries) {
          if (boneName && node.name === boneName) effective.set(standard, node);
        }
      });
    }
    boneMapperRef.current = effective;

    if (animControllerRef.current) {
      animControllerRef.current._boneMapper = effective;
      animControllerRef.current._speakerBones = undefined;
      animControllerRef.current._chestBone = undefined;
      animControllerRef.current._hipsParentCorrection = undefined;
    }

    applyPosePreset(
      model,
      animControllerRef.current,
      idleClipRef.current,
      avatarClipsRef.current,
      posePresetRef.current,
      effective,
      externalClipsRef.current,
    );
  }, [boneOverrides]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Scene initialisation (once) ─────────────────────────────────── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Small debug marker used to indicate inferred mouth/jaw location.
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0xff9f1c,
        emissive: 0x442200,
        roughness: 0.3,
      }),
    );
    marker.visible = false;
    scene.add(marker);
    mouthMarkerRef.current = marker;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 1.6, 3.5);
    cameraRef.current = camera;

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.5;
    controls.maxDistance = 20;
    controlsRef.current = controls;

    // Lights
    const hemi = new THREE.HemisphereLight(0xffeeb1, 0x080820, 1);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(5, 10, 5);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 0.1;
    dir.shadow.camera.far = 50;
    dir.shadow.camera.left = -10;
    dir.shadow.camera.right = 10;
    dir.shadow.camera.top = 10;
    dir.shadow.camera.bottom = -10;
    scene.add(dir);

    // Ground plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x2a2a3e, roughness: 0.8 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // HDR environment map
    new RGBELoader().load(
      "/brown_photostudio_01.hdr",
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
      },
      undefined,
      () => {}, // silently ignore if not found
    );

    // Shared GLTF + DRACO loader
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(
      "https://www.gstatic.com/draco/versioned/decoders/1.5.6/",
    );
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
    gltfLoader.setCrossOrigin("anonymous");
    loaderRef.current = createAvatarLoader(dracoLoader);
    vrmaLoaderRef.current = createVRMALoader();

    // Pre-load legacy idle clip (kept for backwards compatibility)
    gltfLoader.load(
      "/animation.glb",
      (gltf) => {
        if (gltf.animations?.length) {
          idleClipRef.current = gltf.animations[0];
          if (avatarRef.current && animControllerRef.current) {
            animControllerRef.current.addClips([idleClipRef.current]);
            applyPosePreset(
              avatarRef.current,
              animControllerRef.current,
              idleClipRef.current,
              avatarClipsRef.current,
              posePresetRef.current,
              boneMapperRef.current,
              externalClipsRef.current,
            );
          }
        }
      },
      undefined,
      () => {},
    );

    // Load animation clips from /animations/manifest.json (single fetch, dual registration).
    // Each clip is registered in externalClipsRef (used by applyPosePreset) AND in
    // extraClipsRef (merged into avatarClipsRef when a new avatar loads).
    // applyPosePreset is only called when the newly loaded clip matches the CURRENT pose
    // — calling it for every clip would stopAll()+resetToRestPose() on every file arrival,
    // causing T-pose flashes for each of the 8 animation files in the manifest.
    fetch('/animations/manifest.json')
      .then((r) => r.ok ? r.json() : null)
      .catch(() => null)
      .then((manifest) => {
        if (!Array.isArray(manifest?.animations)) return;
        const PRESETS = ['idle', 'walk', 'walk_circle', 'slow_run', 'run', 'dance', 'speaker'];
        manifest.animations.forEach((anim) => {
          if (!anim.file) return;
          gltfLoader.load(
            `/animations/${anim.file}`,
            (gltf) => {
              const clip = gltf.animations?.[0];
              if (!clip) return;
              const preset = anim.preset || anim.name || '';
              clip.name = preset || clip.name || anim.file;

              // ── externalClipsRef: used by applyPosePreset ──────────────────
              // Track whether this clip was the FIRST to fill the current-pose slot.
              // If it was, we restart the pose once. Subsequent clips for the same
              // preset (e.g. idle_alt also tagged "idle") must not trigger another restart.
              let filledCurrentPoseSlot = false;
              const tags = Array.isArray(anim.tags) ? anim.tags : [];
              if (preset && !externalClipsRef.current[preset]) {
                externalClipsRef.current[preset] = clip;
                if (preset === posePresetRef.current) filledCurrentPoseSlot = true;
              }
              for (const p of PRESETS) {
                if (!externalClipsRef.current[p] && tags.some((t) => String(t).toLowerCase().includes(p))) {
                  externalClipsRef.current[p] = clip;
                  if (p === posePresetRef.current) filledCurrentPoseSlot = true;
                }
              }

              // ── extraClipsRef: available when the next avatar loads ────────
              if (!extraClipsRef.current.some((c) => c.name === clip.name)) {
                extraClipsRef.current = [...extraClipsRef.current, clip];
              }

              if (avatarRef.current && animControllerRef.current) {
                animControllerRef.current.addClips([clip]);
                avatarClipsRef.current = [...avatarClipsRef.current, clip];

                // Only restart the pose when this clip was the first to fill the
                // current-pose slot. Avoids stopAll()+resetToRestPose() storms when
                // multiple manifest files share the same preset tag.
                if (filledCurrentPoseSlot) {
                  applyPosePreset(
                    avatarRef.current,
                    animControllerRef.current,
                    idleClipRef.current,
                    avatarClipsRef.current,
                    posePresetRef.current,
                    boneMapperRef.current,
                    externalClipsRef.current,
                  );
                }
              }
            },
            undefined,
            () => {}, // silently skip missing files
          );
        });
      });

    // Render loop
    const animate = () => {
      if (!isVisibleRef.current) return;
      animFrameRef.current = requestAnimationFrame(animate);
      clockRef.current.update();
      const delta = clockRef.current.getDelta();
      animControllerRef.current?.update(delta);

      // ── Lip sync: voice-band aware analysis + viseme mapping ──
      const analyser = analyserRefLocal.current?.current;
      const lipSyncController = lipSyncControllerRef.current;
      const jawBones = jawBonesRef.current;
      const hasMorphs = lipSyncController?.hasTargets;
      const pseudoJawRig = isPseudoJawRig(jawBones);
      const effectiveConfig = pseudoJawRig
        ? {
            ...mergedLipSyncConfig,
            ...NO_RIG_SAFE_PRESET,
          }
        : mergedLipSyncConfig;
      if (analyser && (hasMorphs || jawBones.length > 0)) {
        const binCount = analyser.frequencyBinCount;
        if (
          !lipSyncDataRef.current ||
          lipSyncDataRef.current.length !== binCount
        ) {
          lipSyncDataRef.current = new Uint8Array(binCount);
        }
        if (
          !lipSyncFreqDataRef.current ||
          lipSyncFreqDataRef.current.length !== binCount
        ) {
          lipSyncFreqDataRef.current = new Uint8Array(binCount);
        }
        analyser.getByteTimeDomainData(lipSyncDataRef.current);
        analyser.getByteFrequencyData(lipSyncFreqDataRef.current);

        let sum = 0;
        for (let i = 0; i < binCount; i++) {
          const v = (lipSyncDataRef.current[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / binCount);

        const sampleRate = analyser.context.sampleRate || 48000;
        const hzPerBin = sampleRate / analyser.fftSize;
        const speechBand = averageRange(
          lipSyncFreqDataRef.current,
          hzPerBin,
          300,
          3000,
        );
        const lowBand = averageRange(
          lipSyncFreqDataRef.current,
          hzPerBin,
          200,
          700,
        );
        const midBand = averageRange(
          lipSyncFreqDataRef.current,
          hzPerBin,
          700,
          2400,
        );
        const highBand = averageRange(
          lipSyncFreqDataRef.current,
          hzPerBin,
          2400,
          5000,
        );

        const fullBandSource = rms;
        const speechBandSource = speechBand;
        const weightedEnergy = effectiveConfig.enableBandEnergy
          ? fullBandSource * effectiveConfig.fullBandMix +
            speechBandSource * effectiveConfig.speechBandMix
          : fullBandSource;

        const isLoudFrame = weightedEnergy > adaptiveNoiseFloorRef.current;
        const floorTrackingSpeed = isLoudFrame
          ? effectiveConfig.noiseFloorRiseSpeed
          : effectiveConfig.noiseFloorFallSpeed;
        adaptiveNoiseFloorRef.current = THREE.MathUtils.lerp(
          adaptiveNoiseFloorRef.current,
          weightedEnergy,
          THREE.MathUtils.clamp(floorTrackingSpeed * delta, 0, 1),
        );

        const adaptiveGate = effectiveConfig.adaptiveNoiseGate
          ? Math.max(
              effectiveConfig.noiseGate,
              adaptiveNoiseFloorRef.current *
                effectiveConfig.noiseFloorMultiplier,
            )
          : effectiveConfig.noiseGate;

        const amplified = weightedEnergy * effectiveConfig.amplitudeMultiplier;
        const gated =
          amplified <= adaptiveGate
            ? 0
            : (amplified - adaptiveGate) / Math.max(0.0001, 1 - adaptiveGate);
        const mouthTarget = THREE.MathUtils.clamp(gated, 0, 1);

        const prevOpen = jawSmoothedOpenRef.current;
        const smoothingSpeed =
          mouthTarget > prevOpen
            ? effectiveConfig.jawAttackSpeed
            : effectiveConfig.jawReleaseSpeed;
        const smoothedOpen = THREE.MathUtils.lerp(
          prevOpen,
          mouthTarget,
          THREE.MathUtils.clamp(smoothingSpeed * delta, 0, 1),
        );
        const maxDelta = effectiveConfig.jawMaxDeltaPerSecond * delta;
        jawSmoothedOpenRef.current = THREE.MathUtils.clamp(
          smoothedOpen,
          prevOpen - maxDelta,
          prevOpen + maxDelta,
        );
        const mouthOpen = THREE.MathUtils.clamp(
          jawSmoothedOpenRef.current,
          0,
          1,
        );

        if (effectiveConfig.visemeMode === "timeline" && hasMorphs) {
          const timelineCrossfadeSec =
            Number(effectiveConfig.timelineCrossfadeSec) || 0.08;
          const timelineBlend = getTimelineBlendState(
            visemeTimelineRef.current,
            audioCurrentTimeRef.current,
            timelineCrossfadeSec,
          );
          if (timelineBlend) {
            lipSyncController.resetGroups();

            // Audio presence gates silence but doesn't throttle the viseme intensity.
            // TTS audio is often low-volume after compression, so we use a low threshold
            // and let the viseme data be the primary driver of mouth shape.
            const audioPresence = THREE.MathUtils.clamp(
              mouthOpen * 2.5 + speechBand * 1.5,
              0,
              1,
            );
            const isAudioActive = audioPresence > 0.04;
            // When audio is playing, guarantee at least 40% of the viseme shows.
            const ttsFloor = isAudioActive ? 0.4 : 0;

            const VISEME_MAP = {
              A: { aa: 1.0 },
              B: { mbp: 1.0 },
              C: { ee: 0.95 },
              D: { ee: 0.75, aa: 0.35 },
              E: { aa: 0.9, oh: 0.25 },
              F: { oh: 1.0 },
              G: { fv: 1.0, ee: 0.45 },
              H: { ee: 0.5, aa: 0.45 },
              X: { mbp: 0.3 },
            };

            timelineBlend.forEach(({ cue, weight }) => {
              const cueIntensity = THREE.MathUtils.clamp(
                (ttsFloor + audioPresence * 0.6) * weight,
                0,
                1,
              );
              const blend = VISEME_MAP[String(cue?.value || "").toUpperCase()];
              if (blend) {
                Object.entries(blend).forEach(([grp, w]) => {
                  lipSyncController.setGroupValue(grp, cueIntensity * w);
                });
              }
            });
          } else {
            lipSyncController.resetGroups();
          }
        } else if (effectiveConfig.visemeMode === "heuristic" && hasMorphs) {
          const sumBands = Math.max(0.0001, lowBand + midBand + highBand);
          const vowelOpen = THREE.MathUtils.clamp(
            (lowBand + midBand) / sumBands,
            0,
            1,
          );
          const bright = THREE.MathUtils.clamp(highBand / sumBands, 0, 1);

          lipSyncController.setGroupValue("aa", mouthOpen * vowelOpen);
          lipSyncController.setGroupValue(
            "oh",
            mouthOpen * THREE.MathUtils.clamp(lowBand / sumBands, 0, 1),
          );
          lipSyncController.setGroupValue("ee", mouthOpen * bright);
          lipSyncController.setGroupValue("fv", mouthOpen * bright * 0.65);
          lipSyncController.setGroupValue("mbp", (1 - mouthOpen) * 0.2);
        }

        // Visible baseline: raised from 0.22 to 0.45 so the jaw always opens
        // noticeably when audio is playing, regardless of blendshape mapping.
        if (hasMorphs) {
          lipSyncController.setGroupValue("mouthOpen", mouthOpen * 0.45);
        }

        if (
          effectiveConfig.enableJawFallback &&
          !hasMorphs &&
          jawBones.length > 0
        ) {
          jawJitterPhaseRef.current +=
            delta * effectiveConfig.jawMicroJitterSpeed * Math.PI * 2;
          const jawJitter = effectiveConfig.enableJawMicroJitter
            ? Math.sin(jawJitterPhaseRef.current) *
              effectiveConfig.jawMicroJitterAmount *
              mouthOpen
            : 0;
          const jawOpen = THREE.MathUtils.clamp(mouthOpen + jawJitter, 0, 1);
          const jawAngleDeg = pseudoJawRig ? 6.5 : 18;
          const jawOpenAngle = THREE.MathUtils.degToRad(
            jawAngleDeg * effectiveConfig.jawFallbackStrength * jawOpen,
          );
          jawBones.forEach((bone, index) => {
            if (!bone?.userData?.__jawRestQuat) return;
            bone.quaternion.copy(bone.userData.__jawRestQuat);
            const factor = pseudoJawRig ? (index === 0 ? 1 : -0.45) : 1;
            bone.rotateX(jawOpenAngle * factor);
          });
        }

        lipSyncTelemetryRef.current = {
          mouthOpen,
          rms,
          speechBand,
          mode: `${effectiveConfig.visemeMode}${
            !hasMorphs && jawBones.length > 0
              ? pseudoJawRig
                ? " (pseudo-safe)"
                : " (jaw)"
              : ""
          }`,
          analyserReady: true,
          hasMorphs,
          jawBoneCount: jawBones.length,
        };
      } else {
        // No active audio — reset mouth morphs
        jawSmoothedOpenRef.current = THREE.MathUtils.lerp(
          jawSmoothedOpenRef.current,
          0,
          THREE.MathUtils.clamp(effectiveConfig.jawReleaseSpeed * delta, 0, 1),
        );

        lipSyncController?.resetAll();

        jawBones.forEach((bone) => {
          if (bone?.userData?.__jawRestQuat) {
            bone.quaternion.copy(bone.userData.__jawRestQuat);
          }
        });

        const hasAnalyser = Boolean(analyser);
        const hasRigTargets = hasMorphs || jawBones.length > 0;
        lipSyncTelemetryRef.current = {
          mouthOpen: 0,
          rms: 0,
          speechBand: 0,
          mode: !hasAnalyser
            ? "no-analyser"
            : !hasRigTargets
              ? "no-rig"
              : "idle",
          analyserReady: hasAnalyser,
          hasMorphs,
          jawBoneCount: jawBones.length,
        };
      }

      const now = performance.now();
      if (now - lastDebugCommitAtRef.current >= 220) {
        lastDebugCommitAtRef.current = now;
        updateMouthDebugMarker(
          mouthMarkerRef.current,
          jawBones,
          lipSyncController?._morphTargets || [],
          mouthMarkerInfoRef,
          pseudoJawRig,
        );
        setDebugSnapshot(lipSyncTelemetryRef.current);
        if (lipSyncController) {
          setBlendshapeSnapshot(lipSyncController.getAll());
        }
        setMouthMarkerInfo(mouthMarkerInfoRef.current);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Responsive resize
    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // Pause render loop while off-screen to reduce CPU/GPU pressure.
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = isVisibleRef.current;
        isVisibleRef.current = entry.isIntersecting;
        if (!wasVisible && entry.isIntersecting) {
          clockRef.current.update(); // reset accumulated time before resuming
          animate();
        }
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(container);

    setRenderCtx({ renderer, camera });

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      controls.dispose();
      animControllerRef.current?.dispose();
      animControllerRef.current = null;
      lipSyncControllerRef.current?.dispose();
      lipSyncControllerRef.current = null;
      mouthMarkerRef.current?.geometry?.dispose?.();
      mouthMarkerRef.current?.material?.dispose?.();
      mouthMarkerRef.current = null;
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      setRenderCtx(null);
    };
  }, []);

  /* ── Avatar loading (when URL changes) ───────────────────────────── */
  useEffect(() => {
    if (!avatarUrl || !sceneRef.current || !loaderRef.current) return;
    const modelUrl = normalizeAvatarUrl(avatarUrl);
    const loadId = ++activeAvatarLoadIdRef.current;
    let cancelled = false;

    if (!modelUrl) {
      Promise.resolve().then(() => {
        setAvatarLoadError("Avatar URL is empty or invalid.");
      });
      return;
    }

    // Remove old avatar
    if (avatarRef.current) {
      sceneRef.current.remove(avatarRef.current);
      animControllerRef.current?.dispose();
      animControllerRef.current = null;
      lipSyncControllerRef.current?.dispose();
      lipSyncControllerRef.current = null;
      avatarRef.current = null;
      vrmRef.current = null;
      avatarClipsRef.current = [];
      jawBonesRef.current = [];
      boneMapperRef.current = null;
      baseBoneMapperRef.current = null;
      if (skeletonHelperRef.current) {
        sceneRef.current.remove(skeletonHelperRef.current);
        skeletonHelperRef.current = null;
      }
      mouthMarkerInfoRef.current = { source: "none", name: "" };
      setMouthMarkerInfo({ source: "none", name: "" });
      if (mouthMarkerRef.current) {
        mouthMarkerRef.current.visible = false;
      }
    }

    setAvatarLoading(true);
    const avatarLoader = loaderRef.current;
    if (!avatarLoader) {
      setAvatarLoadError("Avatar loader is not ready yet.");
      setAvatarLoading(false);
      return;
    }

    avatarLoader.load(
      modelUrl,
      (gltf) => {
        if (cancelled || loadId !== activeAvatarLoadIdRef.current) {
          disposeObject3D(gltf.scene);
          return;
        }

        const model = gltf.scene;
        setAvatarLoadError("");
        setAvatarLoading(false);

        // Enable shadows on every mesh
        model.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });

        // Apply current transform
        applyTransform(model, transform);

        sceneRef.current.add(model);
        avatarRef.current = model;

        // Build bone mapper (VRM → Mixamo → CC3 → Generic fallback)
        const boneMapper = BoneMapper.fromGLTF(gltf);
        boneMapperRef.current = boneMapper;

        // Set up LipSync controller
        lipSyncControllerRef.current?.dispose();
        const lipSyncController = new LipSyncController(model);
        lipSyncControllerRef.current = lipSyncController;

        const jawBones = resolveJawBones(model, manualJawBoneName, boneMapper);

        const boneNames = [];
        const meshNames = [];
        model.traverse((node) => {
          if (node?.isBone) {
            const name = String(node.name || "").trim();
            if (name) boneNames.push(name);
          }
          if (node?.isMesh) {
            const name = String(node.name || "").trim();
            if (name) meshNames.push(name);
          }
        });
        setBoneCatalogSnapshot(boneNames);
        setMeshCatalogSnapshot(meshNames);
        setBoneMapperInfo({
          source: boneMapper.source,
          resolvedCount: boneMapper.resolvedCount,
        });
        baseBoneMapperRef.current = boneMapper;

        // Skeleton wireframe in dev mode
        if (showDevTools) {
          if (skeletonHelperRef.current) {
            sceneRef.current?.remove(skeletonHelperRef.current);
          }
          const helper = new THREE.SkeletonHelper(model);
          sceneRef.current.add(helper);
          skeletonHelperRef.current = helper;
        }

        jawBonesRef.current = jawBones;

        // Set up animation controller (crossfade + procedural micro-animation).
        avatarClipsRef.current = Array.isArray(gltf.animations)
          ? gltf.animations
          : [];
        if (!idleClipRef.current && gltf.animations?.length) {
          idleClipRef.current = gltf.animations[0];
        }
        // Merge extra pre-loaded clips (walk, run, dance) into avatarClipsRef
        const mergedClips = [
          ...avatarClipsRef.current,
          ...extraClipsRef.current.filter(
            (ec) => !avatarClipsRef.current.some((ac) => ac.name === ec.name),
          ),
        ];
        avatarClipsRef.current = mergedClips;

        const animController = new AnimationController(
          model,
          mergedClips,
          boneMapper,
        );
        if (idleClipRef.current) {
          animController.addClips([idleClipRef.current]);
        }
        animControllerRef.current = animController;

        // Store VRM instance (null for non-VRM GLB models like Avaturn)
        vrmRef.current = gltf.userData.vrm || null;

        applyPosePreset(
          model,
          animController,
          idleClipRef.current,
          avatarClipsRef.current,
          posePreset,
          boneMapper,
          externalClipsRef.current,
        );

        // Apply any .vrma animation that was set before this avatar finished loading
        if (vrmRef.current && vrmaUrlRef.current && vrmaLoaderRef.current) {
          loadVRMAAnimation(
            vrmaUrlRef.current,
            vrmRef.current,
            animController,
            vrmaLoaderRef.current,
          );
        }

        // AI bone enhancement — fires asynchronously for 'generic' skeletons that
        // resolved too few bones. Animation already plays with the sync mapping;
        // the AI response upgrades it in-place when it arrives.
        if (boneMapper.source === 'generic' && boneMapper.resolvedCount < 14) {
          const allBones = [];
          model.traverse((n) => { if (n?.isBone && n.name) allBones.push(n); });
          BoneMapper.enhanceWithAI(boneMapper, allBones, mapBonesApi)
            .then(() => {
              // Only apply if this avatar is still the active one
              if (cancelled || loadId !== activeAvatarLoadIdRef.current) return;
              boneMapperRef.current = boneMapper;
              baseBoneMapperRef.current = boneMapper;
              if (animControllerRef.current) {
                animControllerRef.current._boneMapper = boneMapper;
                animControllerRef.current._boneNameSet = null; // force rebuild
                animControllerRef.current._boneByName = null;
                animControllerRef.current._speakerBones = undefined;
                animControllerRef.current._chestBone = undefined;
                animControllerRef.current._hipsParentCorrection = undefined;
              }
              setBoneMapperInfo({ source: boneMapper.source, resolvedCount: boneMapper.resolvedCount });
              applyPosePreset(
                model,
                animControllerRef.current,
                idleClipRef.current,
                avatarClipsRef.current,
                posePresetRef.current,
                boneMapper,
                externalClipsRef.current,
              );
            })
            .catch(() => {});
        }
      },
      undefined,
      (err) => {
        if (cancelled || loadId !== activeAvatarLoadIdRef.current) {
          return;
        }
        console.error("Avatar loader error:", err);
        const details =
          err?.message || err?.target?.statusText || "Unknown load error";
        setAvatarLoadError(`Failed to load avatar model from URL: ${details}`);
        setAvatarLoading(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [avatarUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Transform updates (live sliders) ────────────────────────────── */
  useEffect(() => {
    if (!avatarRef.current || !transform) return;
    applyTransform(avatarRef.current, transform);
  }, [transform]);

  useEffect(() => {
    if (!avatarRef.current) return;
    applyPosePreset(
      avatarRef.current,
      animControllerRef.current,
      idleClipRef.current,
      avatarClipsRef.current,
      posePreset,
      boneMapperRef.current,
      externalClipsRef.current,
    );
  }, [posePreset]);

  // ── Animation speed ─────────────────────────────────────────
  useEffect(() => {
    animControllerRef.current?.setTimeScale(animSpeed ?? 1);
  }, [animSpeed]);

  // ── Animation loop mode ──────────────────────────────────────
  useEffect(() => {
    animControllerRef.current?.setLoopOnce(animLoopOnce ?? false);
  }, [animLoopOnce]);

  // ── VRM expression ───────────────────────────────────────────
  useEffect(() => {
    const vrm = vrmRef.current;
    if (!vrm?.expressionManager) return;
    const mgr = vrm.expressionManager;
    // Reset all known expressions first
    ['happy', 'sad', 'angry', 'surprised', 'relaxed', 'neutral'].forEach((name) => {
      try { mgr.setValue(name, 0); } catch { /* ignore unsupported */ }
    });
    if (vrmExpression && vrmExpression !== 'neutral') {
      try { mgr.setValue(vrmExpression, 1); } catch { /* ignore */ }
    }
  }, [vrmExpression]);

  const handleAiMapBones = async () => {
    const model = avatarRef.current;
    const mapper = boneMapperRef.current;
    if (!model || !mapper) return;

    setAiMapState("loading");
    const allBones = [];
    model.traverse((n) => { if (n?.isBone && n.name) allBones.push(n); });

    try {
      const boneNames = allBones.map((b) => b.name);
      const aiMapping = await mapBonesApi(boneNames);

      const byName = Object.fromEntries(allBones.map((b) => [b.name, b]));
      let added = 0;
      for (const [standard, boneName] of Object.entries(aiMapping)) {
        if (byName[boneName]) {
          mapper.set(standard, byName[boneName]);
          added++;
        }
      }
      mapper.source = 'ai';

      boneMapperRef.current = mapper;
      baseBoneMapperRef.current = mapper;
      if (animControllerRef.current) {
        animControllerRef.current._boneMapper = mapper;
        animControllerRef.current._boneNameSet = null;
        animControllerRef.current._boneByName = null;
        animControllerRef.current._speakerBones = undefined;
        animControllerRef.current._chestBone = undefined;
        animControllerRef.current._hipsParentCorrection = undefined;
      }
      setBoneMapperInfo({ source: mapper.source, resolvedCount: mapper.resolvedCount });
      applyPosePreset(
        model,
        animControllerRef.current,
        idleClipRef.current,
        avatarClipsRef.current,
        posePresetRef.current,
        mapper,
        externalClipsRef.current,
      );
      setAiMapState(`ok:${added}`);
      window.setTimeout(() => setAiMapState(""), 3000);
    } catch {
      setAiMapState("error");
      window.setTimeout(() => setAiMapState(""), 3000);
    }
  };

  const handleCopyRigReport = async () => {
    const report = buildRigReport({
      debugSnapshot,
      boneCatalogSnapshot,
      meshCatalogSnapshot,
      blendshapeSnapshot,
      manualJawBoneName,
      mouthMarkerInfo,
      boneMapperInfo,
      boneMapper: boneMapperRef.current,
    });
    try {
      await navigator.clipboard.writeText(report);
      setRigCopyState("Rig report copied");
      window.setTimeout(() => setRigCopyState(""), 1500);
    } catch {
      setRigCopyState("Failed to copy");
      window.setTimeout(() => setRigCopyState(""), 1500);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full overflow-hidden"
      style={{ touchAction: "none" }}
    >
      {avatarLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-gray-900/75 pointer-events-none">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
              <span className="absolute inset-0 flex items-center justify-center text-2xl select-none">
                👤
              </span>
            </div>
            <p className="text-sm text-cyan-200 font-medium">
              Carregando seu personagem...
            </p>
            <p className="text-xs text-gray-400">
              Isso pode levar alguns segundos
            </p>
          </div>
        </div>
      )}
      {avatarLoadError && (
        <div className="absolute top-3 left-3 right-3 z-20 rounded-xl border border-red-700/60 bg-red-950/90 px-4 py-3 text-sm text-red-200 flex items-start gap-2">
          <span className="shrink-0 text-base">⚠️</span>
          <div>
            <p className="font-medium">Não foi possível carregar o avatar</p>
            <p className="text-xs text-red-300/80 mt-0.5">{avatarLoadError}</p>
          </div>
        </div>
      )}
      {renderCtx && textDisplayMode === 'bubble' && (
        <SpeechBubble
          text={speechText}
          avatarRef={avatarRef}
          camera={renderCtx.camera}
          renderer={renderCtx.renderer}
        />
      )}
      {textDisplayMode === 'subtitle' && speechText && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none px-4 w-full max-w-2xl">
          <div className="bg-black/70 backdrop-blur-sm text-white text-base text-center font-medium leading-snug rounded-lg px-5 py-2.5 shadow-xl wrap-break-word">
            {speechText}
          </div>
        </div>
      )}
      {showDevTools && (
        <div className="absolute right-3 top-3 z-20 rounded-md border border-cyan-700/70 bg-cyan-950/75 px-3 py-2 text-xs text-cyan-100">
          <p className="font-semibold uppercase tracking-wide text-cyan-200">
            Lip Sync
          </p>
          <p>Open: {debugSnapshot.mouthOpen.toFixed(2)}</p>
          <p>RMS: {debugSnapshot.rms.toFixed(3)}</p>
          <p>Voice Band: {debugSnapshot.speechBand.toFixed(3)}</p>
          <p>Mode: {debugSnapshot.mode}</p>
          <p>Analyser: {debugSnapshot.analyserReady ? "ready" : "missing"}</p>
          <p>Mouth Targets: {debugSnapshot.mouthTargetCount || 0}</p>
          <p>Jaw Bones: {debugSnapshot.jawBoneCount || 0}</p>
          <p>
            Mouth Marker: {mouthMarkerInfo.source}
            {mouthMarkerInfo.name ? ` (${mouthMarkerInfo.name})` : ""}
          </p>
        </div>
      )}
      {showDevTools && (
        <div className="absolute left-3 top-3 bottom-3 z-20 w-96 overflow-y-auto rounded-md border border-amber-700/70 bg-amber-950/90 px-3 py-2 text-xs text-amber-100">
          <p className="font-semibold uppercase tracking-wide text-amber-200">
            Rig Debug
          </p>
          <p>
            Esqueleto detectado:{" "}
            <span className="font-bold text-amber-300">
              {boneMapperInfo.source}
            </span>{" "}
            ({boneMapperInfo.resolvedCount} padrões mapeados)
          </p>
          <p>
            Ossos totais: {boneCatalogSnapshot.length} · Meshes:{" "}
            {meshCatalogSnapshot.length}
          </p>
          <button
            onClick={handleCopyRigReport}
            className="mt-2 w-full rounded border border-amber-700 bg-amber-900/60 px-2 py-1 text-xs text-amber-100 hover:bg-amber-800/70"
          >
            Copy rig report
          </button>
          {rigCopyState && (
            <p className="mt-1 text-[11px] text-amber-300">{rigCopyState}</p>
          )}

          <button
            onClick={handleAiMapBones}
            disabled={aiMapState === "loading"}
            className="mt-2 w-full rounded border border-amber-600 bg-amber-800/60 px-2 py-1 text-xs text-amber-100 hover:bg-amber-700/70 disabled:opacity-50"
          >
            {aiMapState === "loading" ? "⏳ Mapeando com IA..." : "✨ Mapear ossos com IA"}
          </button>
          {aiMapState.startsWith("ok") && (
            <p className="mt-1 text-[11px] text-green-400">
              ✓ {aiMapState.split(":")[1]} ossos mapeados — pose reaplicada
            </p>
          )}
          {aiMapState === "error" && (
            <p className="mt-1 text-[11px] text-red-400">Erro ao chamar a API</p>
          )}

          <p className="mt-3 font-semibold text-amber-200">
            Calibrar mapeamento de ossos
          </p>
          <p className="text-[11px] text-amber-400 mb-1">
            Selecione qual osso do avatar corresponde a cada parte do corpo.
            "Auto" usa a detecção automática.
          </p>
          {STANDARD_BONES.map((standard) => (
            <div key={standard} className="flex items-center gap-1 mt-1">
              <span className="w-28 shrink-0 text-amber-300">
                {BONE_LABELS[standard] ?? standard}
              </span>
              <select
                value={boneOverrides[standard] ?? ""}
                onChange={(e) =>
                  setBoneOverrides((prev) => ({
                    ...prev,
                    [standard]: e.target.value,
                  }))
                }
                className="flex-1 rounded border border-amber-700 bg-amber-950 px-1 py-0.5 text-xs text-amber-100"
              >
                <option value="">Auto</option>
                {boneCatalogSnapshot.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {Object.values(boneOverrides).some(Boolean) && (
            <button
              onClick={() => setBoneOverrides({})}
              className="mt-2 w-full rounded border border-red-700 bg-red-950/60 px-2 py-1 text-xs text-red-200 hover:bg-red-900/60"
            >
              Limpar overrides (voltar ao automático)
            </button>
          )}

          <label className="mt-3 block text-amber-300">
            Override mandíbula
          </label>
          <select
            value={manualJawBoneName}
            onChange={(e) => setManualJawBoneName(e.target.value)}
            className="mt-1 w-full rounded border border-amber-700 bg-amber-950 px-2 py-1 text-xs text-amber-100"
          >
            <option value="">Auto detect jaw bone</option>
            {boneCatalogSnapshot.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] text-amber-300">
            Todos os ossos detectados
          </p>
          <ul className="max-h-20 overflow-y-auto rounded border border-amber-900/70 bg-amber-950/60 p-1">
            {boneCatalogSnapshot.slice(0, 40).map((name) => (
              <li key={name} className="truncate" title={name}>
                {name}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-amber-300">Detected meshes</p>
          <ul className="max-h-20 overflow-y-auto rounded border border-amber-900/70 bg-amber-950/60 p-1">
            {meshCatalogSnapshot.slice(0, 20).map((name) => (
              <li key={name} className="truncate" title={name}>
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {mergedLipSyncConfig.showBlendshapeDebug && (
        <div className="absolute right-3 bottom-3 z-20 w-80 max-h-72 overflow-y-auto rounded-md border border-slate-600 bg-slate-950/90 px-3 py-2 text-xs text-slate-100">
          <p className="mb-2 font-semibold uppercase tracking-wide text-slate-300">
            Blendshapes ({blendshapeSnapshot.length})
          </p>
          <label className="mb-2 block text-[11px] text-slate-400">
            Mesh filter
          </label>
          <select
            value={blendshapeMeshFilter}
            onChange={(e) => setBlendshapeMeshFilter(e.target.value)}
            className="mb-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
          >
            <option value="all">All meshes</option>
            {Array.from(
              new Set(blendshapeSnapshot.map((entry) => entry.meshName)),
            ).map((meshName) => (
              <option key={meshName} value={meshName}>
                {meshName}
              </option>
            ))}
          </select>
          {blendshapeSnapshot.length === 0 ? (
            <p className="text-slate-400">
              No morph targets found on this avatar.
            </p>
          ) : (
            <ul className="space-y-1">
              {blendshapeSnapshot
                .filter(
                  (entry) =>
                    blendshapeMeshFilter === "all" ||
                    entry.meshName === blendshapeMeshFilter,
                )
                .map((entry) => (
                  <li
                    key={entry.key}
                    className="flex items-center justify-between gap-2"
                  >
                    <span
                      className="truncate text-slate-300"
                      title={`${entry.meshName} :: ${entry.name}`}
                    >
                      {entry.name}
                    </span>
                    <span className="text-slate-400">
                      {entry.value.toFixed(2)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function createAvatarLoader(dracoLoader) {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  loader.setCrossOrigin("anonymous");
  loader.register((parser) => new VRMLoaderPlugin(parser));
  return loader;
}

function createVRMALoader() {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  return loader;
}

function loadVRMAAnimation(url, vrm, animController, vrmaLoader) {
  if (!url || !vrm || !animController || !vrmaLoader) return;
  vrmaLoader.load(
    url,
    (vrmaGltf) => {
      const vrmAnimations = vrmaGltf.userData.vrmAnimations;
      if (!Array.isArray(vrmAnimations) || !vrmAnimations.length) {
        console.warn('VRMA: nenhuma animação encontrada no arquivo');
        return;
      }
      const clip = createVRMAnimationClip(vrmAnimations[0], vrm);
      clip.name = '__vrma__';
      animController.play(clip, 0.4);
    },
    undefined,
    (err) => console.error('VRMA load error:', err),
  );
}

function getTimelineBlendState(cues, timeSec, crossfadeSec = 0.07) {
  if (!Array.isArray(cues) || !cues.length) return null;
  const time = Number(timeSec) || 0;

  const activeIndex = cues.findIndex(
    (cue) => time >= cue.start && time <= cue.end,
  );
  if (activeIndex === -1) return null;

  const activeCue = cues[activeIndex];
  const prevCue = activeIndex > 0 ? cues[activeIndex - 1] : null;
  const nextCue = activeIndex < cues.length - 1 ? cues[activeIndex + 1] : null;

  const blendItems = [{ cue: activeCue, weight: 1 }];

  if (prevCue) {
    const fromStart = time - activeCue.start;
    if (fromStart >= 0 && fromStart < crossfadeSec) {
      const t = THREE.MathUtils.clamp(
        fromStart / Math.max(0.0001, crossfadeSec),
        0,
        1,
      );
      blendItems[0].weight = t;
      blendItems.push({ cue: prevCue, weight: 1 - t });
    }
  }

  if (nextCue) {
    const toEnd = activeCue.end - time;
    if (toEnd >= 0 && toEnd < crossfadeSec) {
      const t = THREE.MathUtils.clamp(
        toEnd / Math.max(0.0001, crossfadeSec),
        0,
        1,
      );
      blendItems[0].weight = Math.min(blendItems[0].weight, t);
      blendItems.push({ cue: nextCue, weight: 1 - t });
    }
  }

  let total = 0;
  blendItems.forEach((item) => {
    item.weight = THREE.MathUtils.clamp(item.weight, 0, 1);
    total += item.weight;
  });

  if (total <= 0) return [{ cue: activeCue, weight: 1 }];
  return blendItems.map((item) => ({
    cue: item.cue,
    weight: item.weight / total,
  }));
}

function averageRange(freqData, hzPerBin, minHz, maxHz) {
  if (!freqData?.length || !hzPerBin) return 0;
  const minBin = Math.max(0, Math.floor(minHz / hzPerBin));
  const maxBin = Math.min(freqData.length - 1, Math.ceil(maxHz / hzPerBin));
  if (maxBin < minBin) return 0;

  let sum = 0;
  for (let i = minBin; i <= maxBin; i++) {
    sum += freqData[i] / 255;
  }
  return sum / Math.max(1, maxBin - minBin + 1);
}

function resolveJawBones(model, manualJawBoneName, boneMapper = null) {
  if (!model) return [];

  const selected = String(manualJawBoneName || "")
    .trim()
    .toLowerCase();

  // BoneMapper provides an exact jaw bone — use it unless the user overrides manually
  if (!selected && boneMapper?.has("jaw")) {
    const jaw = boneMapper.get("jaw");
    jaw.userData.__jawRestQuat = jaw.quaternion.clone();
    return [jaw];
  }

  const jawBones = [];
  model.traverse((node) => {
    if (!node?.isBone) return;
    const boneName = String(node.name || "").trim();
    if (!boneName) return;

    const normalized = boneName.toLowerCase();
    const matchesManual = selected && normalized === selected;
    const matchesAuto = JAW_BONE_PATTERNS.some((pattern) =>
      pattern.test(boneName),
    );
    if (!matchesManual && (!matchesAuto || selected)) {
      return;
    }

    node.userData.__jawRestQuat = node.quaternion.clone();
    jawBones.push(node);
  });

  if (jawBones.length === 0 && !selected) {
    const pseudo = [];
    model.traverse((node) => {
      if (!node?.isBone) return;
      const name = String(node.name || "")
        .trim()
        .toLowerCase();
      if (name === "head" || name === "neck") {
        node.userData.__jawRestQuat = node.quaternion.clone();
        pseudo.push(node);
      }
    });

    // Keep Head first so the primary marker and motion anchor stay consistent.
    pseudo.sort((a, b) => {
      const an = String(a.name || "").toLowerCase();
      const bn = String(b.name || "").toLowerCase();
      if (an === "head") return -1;
      if (bn === "head") return 1;
      return an.localeCompare(bn);
    });

    return pseudo;
  }

  return jawBones;
}

function isPseudoJawRig(jawBones) {
  if (!Array.isArray(jawBones) || !jawBones.length) return false;
  return jawBones.every((bone) => {
    const name = String(bone?.name || "").toLowerCase();
    return name === "head" || name === "neck";
  });
}

function updateMouthDebugMarker(
  marker,
  jawBones,
  morphs,
  markerInfoRef,
  pseudoJawRig,
) {
  if (!marker) return;

  if (jawBones.length > 0) {
    jawBones[0].getWorldPosition(marker.position);
    marker.visible = true;
    markerInfoRef.current = {
      source: pseudoJawRig ? "pseudo-jaw" : "jaw-bone",
      name: String(jawBones[0].name || ""),
    };
    return;
  }

  if (morphs.length > 0) {
    morphs[0].mesh.getWorldPosition(marker.position);
    marker.position.y -= 0.03;
    marker.visible = true;
    markerInfoRef.current = {
      source: "mouth-morph-mesh",
      name: String(morphs[0].mesh?.name || ""),
    };
    return;
  }

  marker.visible = false;
  markerInfoRef.current = { source: "none", name: "" };
}

function buildRigReport({
  debugSnapshot,
  boneCatalogSnapshot,
  meshCatalogSnapshot,
  blendshapeSnapshot,
  manualJawBoneName,
  mouthMarkerInfo,
  boneMapperInfo,
  boneMapper,
}) {
  const lines = [];
  lines.push("=== CONTАР RIG REPORT ===");
  lines.push(`skeletonSource=${boneMapperInfo?.source ?? "unknown"}  resolvedBones=${boneMapperInfo?.resolvedCount ?? 0}`);
  lines.push(`mode=${debugSnapshot.mode}`);
  lines.push(`analyserReady=${debugSnapshot.analyserReady}`);
  lines.push(`mouthTargets=${debugSnapshot.mouthTargetCount ?? 0}`);
  lines.push(`jawBones=${debugSnapshot.jawBoneCount ?? 0}`);
  lines.push(`manualJawBone=${manualJawBoneName || "(auto)"}`);
  lines.push(
    `mouthMarker=${mouthMarkerInfo.source}${mouthMarkerInfo.name ? `:${mouthMarkerInfo.name}` : ""}`,
  );
  lines.push(`bonesCount=${boneCatalogSnapshot.length}`);
  lines.push(`meshesCount=${meshCatalogSnapshot.length}`);
  lines.push(`blendshapeCount=${blendshapeSnapshot.length}`);

  // Bone mapping — standard → avatar bone name
  if (boneMapper && boneMapper.resolvedCount > 0) {
    lines.push("--- bone mapping ---");
    const mapped = boneMapper.toObject();
    for (const [standard, bone] of Object.entries(mapped)) {
      lines.push(`  ${standard.padEnd(16)} → ${bone?.name ?? "?"}`);
    }
  }

  lines.push("--- all bones ---");
  boneCatalogSnapshot.forEach((name) => lines.push(`  ${name}`));
  lines.push("--- meshes ---");
  meshCatalogSnapshot.forEach((name) => lines.push(`  ${name}`));
  lines.push("--- blendshapes ---");
  blendshapeSnapshot.forEach((item) => {
    const mesh = item.meshName || "(unknown mesh)";
    const name = item.name || `index:${item.index ?? "?"}`;
    lines.push(`  ${mesh}::${name}`);
  });
  return lines.join("\n");
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function applyTransform(model, t) {
  if (!model || !t) return;
  model.position.set(t.positionX ?? 0, t.positionY ?? 0, t.positionZ ?? 0);
  model.rotation.set(
    ((t.rotationX ?? 0) * Math.PI) / 180,
    ((t.rotationY ?? 0) * Math.PI) / 180,
    ((t.rotationZ ?? 0) * Math.PI) / 180,
  );
  model.scale.setScalar(t.scale ?? 1);
}

function disposeObject3D(object) {
  if (!object) return;

  object.traverse((node) => {
    if (!node?.isMesh) return;
    node.geometry?.dispose?.();

    const { material } = node;
    if (Array.isArray(material)) {
      material.forEach((mat) => mat?.dispose?.());
    } else {
      material?.dispose?.();
    }
  });
}

function applyPosePreset(
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
