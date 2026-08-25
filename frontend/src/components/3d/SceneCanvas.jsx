import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import SpeechBubble from './SpeechBubble';
import { AnimationController } from '../../controllers/AnimationController';
import { LipSyncController } from '../../controllers/LipSyncController';
import { BoneMapper, STANDARD_BONES } from '../../utils/BoneMapper';
import { applyPosePreset, captureRestPoseSnapshot } from '../../utils/posePresets';
import { injectSyntheticJaw, repositionSyntheticJaw, createJawDebugVisuals, SYNTHETIC_JAW_NAME } from '../../utils/syntheticJaw';
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
  // Global ceiling on how wide the mouth opens (0–1). 1.0 = full ARKit gape
  // (looked exaggerated on TTS); ~0.7 keeps speech natural without going slack.
  mouthOpenScale: 0.7,
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

// Rhubarb mouth shape → viseme morph-group weights. Shared by the
// analyser-driven and the no-analyser (Web Speech) timeline lip sync paths.
const VISEME_GROUP_MAP = {
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

// Azure TTS viseme IDs (0–21) → ARKit blendshape names (Avaturn / ReadyPlayerMe).
// When the avatar has these blendshapes directly, we drive them instead of the
// heuristic groups, producing accurate lip sync with Azure TTS.
// Reference: https://learn.microsoft.com/azure/ai-services/speech-service/how-to-speech-synthesis-viseme
const AZURE_VISEME_TO_ARKIT = {
  0:  null,            // sil
  1:  'viseme_PP',     // p, b, m
  2:  'viseme_FF',     // f, v
  3:  'viseme_TH',     // th
  4:  'viseme_DD',     // t, d
  5:  'viseme_kk',     // k, g
  6:  'viseme_CH',     // tʃ, dʒ, ʃ
  7:  'viseme_SS',     // s, z
  8:  'viseme_nn',     // n, l
  9:  'viseme_RR',     // r
  10: 'viseme_aa',     // ɑ (father)
  11: 'viseme_aa',     // æ (cat)
  12: 'viseme_aa',     // ʌ (but)
  13: 'viseme_O',      // ɔ (all)
  14: 'viseme_U',      // ʊ (book)
  15: 'viseme_O',      // oʊ (no)
  16: 'viseme_U',      // uː (too)
  17: 'viseme_aa',     // aɪ (my)
  18: 'viseme_O',      // aʊ (cow)
  19: 'viseme_I',      // ɪ (it)
  20: 'viseme_E',      // eɪ (say)
  21: 'viseme_I',      // iː (see)
};

const MOUTH_OPEN_PATTERNS = [
  /jaw.*open/i,
  /mouth.*open/i,
  /^jawopen$/i,
  /^mouthopen$/i,
  /viseme.*(aa|ah|ao|oh|o)/i,
];

const MOUTH_FALLBACK_PATTERNS = [/jaw/i, /mouth/i, /lip/i, /viseme/i];

// Embedded clips that are clearly rig poses — per-hand finger poses
// (pinch_L, point_R, allGrip_L…) and eye/face micro-anims (idle_eyes, blink…) —
// rather than full-body animations. Hidden from the "model animations" list,
// which is meant for body animations the user can play on their own.
const RIG_POSE_CLIP_PATTERNS = [
  /_[lr]$/i,
  /grip|pinch|point|thumb|index|finger|fist|knuckle|palm|mrp|allopen|allgrip/i,
  /eye|blink|wink|brow|jaw|viseme|mouth|tongue|teeth|phoneme/i,
];

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
  /^__synthetic_jaw$/,
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
  textDisplayMode = "bubble",
  onAvatarClips,
  onJawApi,
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
  // Stable ref to the latest onAvatarClips callback so the avatarUrl-scoped
  // load effect can emit the model's embedded clip names without depending on
  // the callback identity (which would re-run the whole loader).
  const onAvatarClipsRef = useRef(onAvatarClips);
  const posePresetRef = useRef(posePreset);
  const transformRef = useRef(transform);
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
  const syntheticJawRef = useRef(null);
  const jawDebugVisualsRef = useRef(null);
  const [jawPlacementMode, setJawPlacementMode] = useState(false);
  const [jawOffset, setJawOffset] = useState({ x: 0, y: 0, z: 0 });
  const [jawRadius, setJawRadius] = useState(0.05);
  const [jawBaseWorldPos, setJawBaseWorldPos] = useState(null);
  const jawJitterPhaseRef = useRef(0);
  const onJawApiRef = useRef(onJawApi);
  onJawApiRef.current = onJawApi;
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
    if (
      vrmaUrl &&
      vrmRef.current &&
      animControllerRef.current &&
      vrmaLoaderRef.current
    ) {
      loadVRMAAnimation(
        vrmaUrl,
        vrmRef.current,
        animControllerRef.current,
        vrmaLoaderRef.current,
      );
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
  // Controls visibility of the bone-override panel for regular users
  const [showBoneMapperPanel, setShowBoneMapperPanel] = useState(false);

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
    onAvatarClipsRef.current = onAvatarClips;
  }, [onAvatarClips]);

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
    renderer.shadowMap.type = THREE.PCFShadowMap;
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
    new HDRLoader().load(
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
    fetch("/animations/manifest.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((manifest) => {
        if (!Array.isArray(manifest?.animations)) return;
        const PRESETS = [
          "idle",
          "walk",
          "walk_circle",
          "slow_run",
          "run",
          "dance",
          "speaker",
        ];
        manifest.animations.forEach((anim) => {
          if (!anim.file) return;
          gltfLoader.load(
            `/animations/${anim.file}`,
            (gltf) => {
              const clip = gltf.animations?.[0];
              if (!clip) return;
              const preset = anim.preset || anim.name || "";
              clip.name = preset || clip.name || anim.file;

              // ── externalClipsRef: used by applyPosePreset ──────────────────
              // Track whether this clip was the FIRST to fill the current-pose slot.
              // If it was, we restart the pose once. Subsequent clips for the same
              // preset (e.g. idle_alt also tagged "idle") must not trigger another restart.
              let filledCurrentPoseSlot = false;
              const tags = Array.isArray(anim.tags) ? anim.tags : [];
              if (preset && !externalClipsRef.current[preset]) {
                externalClipsRef.current[preset] = clip;
                if (preset === posePresetRef.current)
                  filledCurrentPoseSlot = true;
              }
              for (const p of PRESETS) {
                if (
                  !externalClipsRef.current[p] &&
                  tags.some((t) => String(t).toLowerCase().includes(p))
                ) {
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
      const hasArkitVisemes = avatarRef.current?.userData.__hasArkitVisemes ?? false;
      const pseudoJawRig = isPseudoJawRig(jawBones);
      const effectiveConfig = pseudoJawRig
        ? {
            ...mergedLipSyncConfig,
            ...NO_RIG_SAFE_PRESET,
          }
        : mergedLipSyncConfig;
      // No analyser (e.g. browser Web Speech, which speaks directly and never
      // routes through Web Audio): drive the mouth straight from the viseme
      // timeline so lip sync still plays. audioCurrentTime is advanced by the
      // Web Speech timer in useAudio.
      if (!analyser && effectiveConfig.visemeMode === "timeline" && hasMorphs && visemeTimelineRef.current.length) {
        const timelineBlend = getTimelineBlendState(
          visemeTimelineRef.current,
          audioCurrentTimeRef.current,
          Number(effectiveConfig.timelineCrossfadeSec) || 0.08,
        );
        lipSyncController.resetGroups();
        if (timelineBlend) {
          timelineBlend.forEach(({ cue, weight }) => {
            const visemeId = Number(cue?.value);
            if (hasArkitVisemes && !isNaN(visemeId)) {
              // Direct Azure ID → ARKit blendshape for Avaturn / ReadyPlayerMe
              const blendshape = AZURE_VISEME_TO_ARKIT[visemeId];
              if (blendshape) lipSyncController.setMorphValue(blendshape, THREE.MathUtils.clamp(0.85 * weight, 0, 1));
            } else {
              const blend = VISEME_GROUP_MAP[String(cue?.value || "").toUpperCase()];
              if (blend) {
                Object.entries(blend).forEach(([grp, w]) => {
                  lipSyncController.setGroupValue(grp, THREE.MathUtils.clamp(0.85 * weight * w, 0, 1));
                });
              }
            }
          });
        }
      } else if (analyser && (hasMorphs || jawBones.length > 0)) {
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
            // When audio is playing, guarantee a visible (but not gaping)
            // portion of the viseme shows.
            const ttsFloor = isAudioActive ? 0.3 : 0;
            const mouthScale = effectiveConfig.mouthOpenScale ?? 1;

            timelineBlend.forEach(({ cue, weight }) => {
              const cueIntensity = THREE.MathUtils.clamp(
                (ttsFloor + audioPresence * 0.6) * weight * mouthScale,
                0,
                1,
              );
              const visemeId = Number(cue?.value);
              if (hasArkitVisemes && !isNaN(visemeId)) {
                const blendshape = AZURE_VISEME_TO_ARKIT[visemeId];
                if (blendshape) lipSyncController.setMorphValue(blendshape, cueIntensity);
              } else {
                const blend = VISEME_GROUP_MAP[String(cue?.value || "").toUpperCase()];
                if (blend) {
                  Object.entries(blend).forEach(([grp, w]) => {
                    lipSyncController.setGroupValue(grp, cueIntensity * w);
                  });
                }
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
          const mouthScale = effectiveConfig.mouthOpenScale ?? 1;
          const openScaled = mouthOpen * mouthScale;

          lipSyncController.setGroupValue("aa", openScaled * vowelOpen);
          lipSyncController.setGroupValue(
            "oh",
            openScaled * THREE.MathUtils.clamp(lowBand / sumBands, 0, 1),
          );
          lipSyncController.setGroupValue("ee", openScaled * bright);
          lipSyncController.setGroupValue("fv", openScaled * bright * 0.65);
          lipSyncController.setGroupValue("mbp", (1 - mouthOpen) * 0.2);
        }

        // Visible baseline so the jaw always opens noticeably when audio is
        // playing, regardless of blendshape mapping — scaled by mouthOpenScale.
        if (hasMorphs) {
          lipSyncController.setGroupValue(
            "mouthOpen",
            mouthOpen * 0.45 * (effectiveConfig.mouthOpenScale ?? 1),
          );
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
          const jawOpen = THREE.MathUtils.clamp(
            (mouthOpen + jawJitter) * (effectiveConfig.mouthOpenScale ?? 1),
            0,
            1,
          );
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
          hasArkitVisemes,
          mouthTargetCount: lipSyncController?._mouthTargetCount ?? 0,
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
          hasArkitVisemes,
          mouthTargetCount: lipSyncController?._mouthTargetCount ?? 0,
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
    // When avatarUrl is cleared, actively remove the old model from the scene
    // so no "ghost" avatar remains visible from the previous session/scene.
    if (!avatarUrl) {
      if (avatarRef.current && sceneRef.current) {
        sceneRef.current.remove(avatarRef.current);
        disposeObject3D(avatarRef.current);
        animControllerRef.current?.dispose();
        animControllerRef.current = null;
        lipSyncControllerRef.current?.dispose();
        lipSyncControllerRef.current = null;
        avatarRef.current = null;
        vrmRef.current = null;
        avatarClipsRef.current = [];
        onAvatarClipsRef.current?.([]);
      }
      return;
    }
    if (!sceneRef.current || !loaderRef.current) return;
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
      onAvatarClipsRef.current?.([]);
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

        const maxAniso = rendererRef.current?.capabilities.getMaxAnisotropy() || 1;
        model.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            for (const mat of mats) {
              if (!mat) continue;
              for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
                if (mat[key]) mat[key].anisotropy = maxAniso;
              }
            }
          }
        });

        // Apply current transform
        applyTransform(model, transform, !!gltf.userData.vrm);

        sceneRef.current.add(model);
        avatarRef.current = model;

        // Build bone mapper (VRM → Mixamo → CC3 → Generic fallback)
        const boneMapper = BoneMapper.fromGLTF(gltf);
        boneMapperRef.current = boneMapper;

        // Set up LipSync controller
        lipSyncControllerRef.current?.dispose();
        const lipSyncController = new LipSyncController(model);
        lipSyncControllerRef.current = lipSyncController;

        // Detect ARKit blendshapes (Avaturn / ReadyPlayerMe) for direct Azure viseme mapping
        const allMorphNames = new Set(lipSyncController.getAll().map((t) => t.name));
        const hasArkitVisemes = AZURE_VISEME_TO_ARKIT[10] && allMorphNames.has(AZURE_VISEME_TO_ARKIT[10]);
        avatarRef.current.userData.__hasArkitVisemes = hasArkitVisemes;
        if (hasArkitVisemes && import.meta.env.DEV) {
          console.log('[SceneCanvas] ARKit visemes detected — using direct Azure→ARKit mapping');
        }

        // Inject a synthetic jaw bone for avatars with no mouth control
        syntheticJawRef.current = null;
        jawDebugVisualsRef.current?.dispose();
        jawDebugVisualsRef.current = null;
        setJawBaseWorldPos(null);
        setJawOffset({ x: 0, y: 0, z: 0 });
        if (!lipSyncController.hasMouth) {
          const result = injectSyntheticJaw(model, boneMapper);
          if (result) {
            syntheticJawRef.current = result.jawBone;
            lipSyncController._jawBone = result.jawBone;
            lipSyncController._jawRestQuat = result.jawBone.quaternion.clone();
            setJawRadius(result.radius);
            jawDebugVisualsRef.current = createJawDebugVisuals(
              sceneRef.current, result.jawBone, result.radius,
            );
            onJawApiRef.current?.({ hasSyntheticJaw: true, radius: result.radius });
          } else {
            onJawApiRef.current?.(null);
          }
        } else {
          onJawApiRef.current?.(null);
        }

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

        captureRestPoseSnapshot(model);

        // Set up animation controller (crossfade + procedural micro-animation).
        avatarClipsRef.current = Array.isArray(gltf.animations)
          ? gltf.animations
          : [];
        // Surface the model's own embedded clips (NOT the Mixamo extras merged
        // in below) so the editor can offer them for direct selection. We send
        // { name, index } so the panel selects by index — embedded clips are
        // first in avatarClipsRef, so the index is unambiguous even when several
        // clips share the same name (common in Mixamo exports → "mixamo.com").
        onAvatarClipsRef.current?.(
          (Array.isArray(gltf.animations) ? gltf.animations : [])
            .map((c, index) => ({ name: String(c?.name || "").trim(), index }))
            .filter((c) => c.name && !RIG_POSE_CLIP_PATTERNS.some((re) => re.test(c.name))),
        );
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
        if (boneMapper.source === "generic" && boneMapper.resolvedCount < 14) {
          const allBones = [];
          model.traverse((n) => {
            if (n?.isBone && n.name) allBones.push(n);
          });
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
              setBoneMapperInfo({
                source: boneMapper.source,
                resolvedCount: boneMapper.resolvedCount,
              });
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
    transformRef.current = transform;
    if (!avatarRef.current || !transform) return;
    const isVRM = !!vrmRef.current;
    applyTransform(avatarRef.current, transform, isVRM);
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
    // Switching pose can reset the model's position/rotation (e.g. leaving
    // walk_circle snaps back to its orbit center) — re-apply the configured
    // transform afterwards so scene transitions land on the right spot.
    if (transformRef.current) {
      applyTransform(avatarRef.current, transformRef.current, !!vrmRef.current);
    }
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
    ["happy", "sad", "angry", "surprised", "relaxed", "neutral"].forEach(
      (name) => {
        try {
          mgr.setValue(name, 0);
        } catch {
          /* ignore unsupported */
        }
      },
    );
    if (vrmExpression && vrmExpression !== "neutral") {
      try {
        mgr.setValue(vrmExpression, 1);
      } catch {
        /* ignore */
      }
    }
  }, [vrmExpression]);

  const handleAiMapBones = async () => {
    const model = avatarRef.current;
    const mapper = boneMapperRef.current;
    if (!model || !mapper) return;

    setAiMapState("loading");
    const allBones = [];
    model.traverse((n) => {
      if (n?.isBone && n.name) allBones.push(n);
    });

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
      mapper.source = "ai";

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
      setBoneMapperInfo({
        source: mapper.source,
        resolvedCount: mapper.resolvedCount,
      });
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

  // ── Expose jaw control API to parent ────────────────────────────────
  const jawRepositionHandler = useCallback((offset, radius) => {
    const model = avatarRef.current;
    const jawBone = syntheticJawRef.current;
    const boneMapper = boneMapperRef.current;
    const basePos = jawBaseWorldPos;
    if (!model || !jawBone || !boneMapper || !basePos) return;
    const newPos = basePos.clone().add(new THREE.Vector3(offset.x, offset.y, offset.z));
    const result = repositionSyntheticJaw(model, jawBone, newPos, boneMapper, radius);
    jawBone.updateWorldMatrix(true, false);
    const lipSync = lipSyncControllerRef.current;
    if (lipSync) lipSync._jawRestQuat = jawBone.quaternion.clone();
    jawBone.userData.__jawRestQuat = jawBone.quaternion.clone();
    jawDebugVisualsRef.current?.dispose();
    jawDebugVisualsRef.current = createJawDebugVisuals(sceneRef.current, jawBone, result.radius);
    const jawBones = resolveJawBones(model, manualJawBoneName, boneMapper);
    jawBonesRef.current = jawBones;
    return result;
  }, [jawBaseWorldPos, manualJawBoneName]);

  useEffect(() => {
    if (!syntheticJawRef.current) { onJawApiRef.current?.(null); return; }
    onJawApiRef.current?.({
      hasSyntheticJaw: true,
      jawPlacementMode,
      jawOffset,
      jawRadius,
      hasBasePos: !!jawBaseWorldPos,
      startPlacement: () => setJawPlacementMode(true),
      setOffset: (newOffset) => {
        setJawOffset(newOffset);
        jawRepositionHandler(newOffset, jawRadius);
      },
      setRadius: (newRadius) => {
        setJawRadius(newRadius);
        jawRepositionHandler(jawOffset, newRadius);
      },
    });
  }, [jawPlacementMode, jawOffset, jawRadius, jawBaseWorldPos, jawRepositionHandler]);

  // ── Jaw placement click handler ──────────────────────────────────────
  useEffect(() => {
    if (!jawPlacementMode) return;
    const container = containerRef.current;
    const camera = cameraRef.current;
    if (!container || !camera) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (e) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const model = avatarRef.current;
      if (!model) return;

      const meshes = [];
      model.traverse((n) => { if (n.isMesh) meshes.push(n); });
      const hits = raycaster.intersectObjects(meshes, false);
      if (!hits.length) return;

      const hitPoint = hits[0].point;
      const jawBone = syntheticJawRef.current;
      const boneMapper = boneMapperRef.current;
      if (!jawBone || !boneMapper) return;

      const { radius, affected } = repositionSyntheticJaw(
        model, jawBone, hitPoint, boneMapper,
      );

      // Store base position and reset sliders
      setJawBaseWorldPos(hitPoint.clone());
      setJawRadius(radius);
      setJawOffset({ x: 0, y: 0, z: 0 });

      // Update rest quat for lip sync
      jawBone.updateWorldMatrix(true, false);
      const lipSync = lipSyncControllerRef.current;
      if (lipSync) {
        lipSync._jawRestQuat = jawBone.quaternion.clone();
      }
      // Update jawBones ref for SceneCanvas animation loop
      jawBone.userData.__jawRestQuat = jawBone.quaternion.clone();

      // Rebuild debug visuals at new position
      jawDebugVisualsRef.current?.dispose();
      jawDebugVisualsRef.current = createJawDebugVisuals(
        sceneRef.current, jawBone, radius,
      );

      // Re-resolve jaw bones so the animation loop uses the repositioned bone
      const jawBones = resolveJawBones(model, manualJawBoneName, boneMapper);
      jawBonesRef.current = jawBones;

      setJawPlacementMode(false);
      if (import.meta.env.DEV) {
        console.log(`[SyntheticJaw] placed at [${hitPoint.toArray().map(n => n.toFixed(4)).join(', ')}], ${affected} vertices`);
      }
    };

    container.addEventListener('click', handleClick, { once: true });
    return () => container.removeEventListener('click', handleClick);
  }, [jawPlacementMode, manualJawBoneName]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full overflow-hidden"
      style={{ touchAction: "none", cursor: jawPlacementMode ? "crosshair" : undefined }}
    >
      {jawPlacementMode && (
        <div className="absolute inset-x-0 top-0 z-30 flex justify-center pointer-events-none">
          <div className="mt-4 rounded-lg bg-cyan-900/90 border border-cyan-400 px-6 py-3 text-sm text-cyan-100 shadow-lg animate-pulse">
            Clique na boca do avatar para posicionar a mandíbula
          </div>
        </div>
      )}
      {avatarLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-gray-900/75 pointer-events-none">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
              <span className="absolute inset-0 flex items-center justify-center text-cyan-400 select-none">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-7 h-7"
                >
                  <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 7a7 7 0 0 1 14 0" />
                </svg>
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
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 shrink-0 text-red-400"
          >
            <path d="M12 3 2 20h20L12 3Z" />
            <path d="M12 9v5m0 3h.01" />
          </svg>
          <div>
            <p className="font-medium">Não foi possível carregar o avatar</p>
            <p className="text-xs text-red-300/80 mt-0.5">{avatarLoadError}</p>
          </div>
        </div>
      )}
      {renderCtx && textDisplayMode === "bubble" && (
        <SpeechBubble
          text={speechText}
          avatarRef={avatarRef}
          camera={renderCtx.camera}
          renderer={renderCtx.renderer}
        />
      )}
      {textDisplayMode === "subtitle" && speechText && (
        // ar-dark: pins this caption to always-dark styling, matching the (also
        // theme-independent) 3D viewport behind it — see index.css's ar-dark rules.
        <div className="ar-dark absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none px-4 w-full max-w-2xl">
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
            {aiMapState === "loading"
              ? "Mapeando com IA..."
              : "Mapear ossos com IA"}
          </button>
          {aiMapState.startsWith("ok") && (
            <p className="mt-1 text-[11px] text-green-400">
              {aiMapState.split(":")[1]} ossos mapeados — pose reaplicada
            </p>
          )}
          {aiMapState === "error" && (
            <p className="mt-1 text-[11px] text-red-400">
              Erro ao chamar a API
            </p>
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
          {syntheticJawRef.current && (
            <button
              onClick={() => setJawPlacementMode(true)}
              className={`mt-2 w-full rounded border px-2 py-1 text-xs ${
                jawPlacementMode
                  ? "border-green-400 bg-green-900/60 text-green-100 animate-pulse"
                  : "border-cyan-600 bg-cyan-900/60 text-cyan-100 hover:bg-cyan-800/70"
              }`}
            >
              {jawPlacementMode
                ? "Clique na boca do avatar..."
                : "Posicionar mandíbula (clique no modelo)"}
            </button>
          )}
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
      {/* ── Bone mapper panel — accessible to all users without ?dev ── */}
      {!showDevTools && showBoneMapperPanel && boneCatalogSnapshot.length > 0 && (
        <div className="absolute left-3 bottom-3 z-20 w-72 max-h-[70vh] overflow-y-auto rounded-md border border-indigo-700/70 bg-gray-950/95 px-3 py-2 text-xs text-gray-100 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-indigo-300 uppercase tracking-wide text-[11px]">
              🦴 Mapeamento de Ossos
            </p>
            <button
              onClick={() => setShowBoneMapperPanel(false)}
              className="text-gray-500 hover:text-gray-200 text-base leading-none transition-colors"
              title="Fechar"
            >
              ×
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mb-2">
            Esqueleto detectado:{" "}
            <span className="text-indigo-300 font-medium">{boneMapperInfo.source}</span>
            {" "}({boneMapperInfo.resolvedCount} ossos mapeados automaticamente)
          </p>
          <p className="text-[11px] text-gray-500 mb-2">
            Se as poses estiverem incorretas, associe manualmente cada parte do corpo ao osso correto. "Auto" usa a detecção automática como fallback.
          </p>
          {STANDARD_BONES.map((standard) => (
            <div key={standard} className="flex items-center gap-1 mt-1">
              <span className="w-28 shrink-0 text-gray-400">
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
                className="flex-1 rounded border border-gray-700 bg-gray-900 px-1 py-0.5 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
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
              className="mt-3 w-full rounded border border-red-700 bg-red-950/60 px-2 py-1 text-xs text-red-300 hover:bg-red-900/60 transition-colors"
            >
              Restaurar detecção automática
            </button>
          )}
        </div>
      )}

      {/* Bone mapper toggle button — visible to all users when avatar has bones */}
      {!showDevTools && !showBoneMapperPanel && boneCatalogSnapshot.length > 0 && (
        <button
          onClick={() => setShowBoneMapperPanel(true)}
          className="absolute bottom-3 left-3 z-20 rounded-md border border-gray-600/60 bg-gray-900/80 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors backdrop-blur-sm"
          title="Configurar mapeamento de ossos (corrige poses incorretas)"
        >
          🦴 Ossos
        </button>
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
        console.warn("VRMA: nenhuma animação encontrada no arquivo");
        return;
      }
      const clip = createVRMAnimationClip(vrmAnimations[0], vrm);
      clip.name = "__vrma__";
      animController.play(clip, 0.4);
    },
    undefined,
    (err) => console.error("VRMA load error:", err),
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
  lines.push(
    `skeletonSource=${boneMapperInfo?.source ?? "unknown"}  resolvedBones=${boneMapperInfo?.resolvedCount ?? 0}`,
  );
  lines.push(`mode=${debugSnapshot.mode}`);
  lines.push(`analyserReady=${debugSnapshot.analyserReady}`);
  lines.push(`mouthTargets=${debugSnapshot.mouthTargetCount ?? 0}`);
  lines.push(`arkitVisemes=${debugSnapshot.hasArkitVisemes ? 'yes' : 'no'}`);
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

function applyTransform(model, t, isVRM = false) {
  if (!model || !t) return;
  model.position.set(t.positionX ?? 0, t.positionY ?? 0, t.positionZ ?? 0);

  // Characters from VRM standard face +Z.
  // To make them face the camera (which looks down -Z), we apply Math.PI (180deg) base rotation.
  const baseRotY = isVRM ? Math.PI : 0;

  model.rotation.set(
    ((t.rotationX ?? 0) * Math.PI) / 180,
    ((t.rotationY ?? 0) * Math.PI) / 180 + baseRotY,
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
