import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import SpeechBubble from './SpeechBubble';

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
 *   posePreset  – idle | walk | run | dance | neutral | wave | hands_on_hips | salute | arms_crossed | t_pose
 *   speechText  – text to display in the speech bubble above the avatar's head
 */
export default function SceneCanvas({ avatarUrl, transform, posePreset, speechText }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const avatarRef = useRef(null);
  const mixerRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const animFrameRef = useRef(null);
  const idleClipRef = useRef(null);
  const avatarClipsRef = useRef([]);
  const posePresetRef = useRef(posePreset);
  const loaderRef = useRef(null);
  const activeAvatarLoadIdRef = useRef(0);

  // Expose renderer/camera to SpeechBubble via state once scene is ready
  const [renderCtx, setRenderCtx] = useState(null);
  const [avatarLoadError, setAvatarLoadError] = useState('');

  useEffect(() => {
    posePresetRef.current = posePreset;
  }, [posePreset]);

  /* ── Scene initialisation (once) ─────────────────────────────────── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
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

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
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
      new THREE.MeshStandardMaterial({ color: 0x2a2a3e, roughness: 0.8 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // HDR environment map
    new RGBELoader().load(
      '/brown_photostudio_01.hdr',
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
      },
      undefined,
      () => {} // silently ignore if not found
    );

    // Shared GLTF + DRACO loader
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(
      'https://www.gstatic.com/draco/versioned/decoders/1.5.6/'
    );
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
    gltfLoader.setCrossOrigin('anonymous');
    loaderRef.current = gltfLoader;

    // Pre-load idle animation clip
    gltfLoader.load(
      '/animation.glb',
      (gltf) => {
        if (gltf.animations?.length) {
          idleClipRef.current = gltf.animations[0];
          // Apply to already-loaded avatar if it arrived first
          if (avatarRef.current && mixerRef.current) {
            applyPosePreset(
              avatarRef.current,
              mixerRef.current,
              idleClipRef.current,
              avatarClipsRef.current,
              posePresetRef.current
            );
          }
        }
      },
      undefined,
      () => {}
    );

    // Render loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      mixerRef.current?.update(clockRef.current.getDelta());
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

    setRenderCtx({ renderer, camera });

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      controls.dispose();
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
        setAvatarLoadError('Avatar URL is empty or invalid.');
      });
      return;
    }

    // Remove old avatar
    if (avatarRef.current) {
      sceneRef.current.remove(avatarRef.current);
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      avatarRef.current = null;
      avatarClipsRef.current = [];
    }

    loaderRef.current.load(
      modelUrl,
      (gltf) => {
        if (cancelled || loadId !== activeAvatarLoadIdRef.current) {
          disposeObject3D(gltf.scene);
          return;
        }

        const model = gltf.scene;
        setAvatarLoadError('');

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

        // Set up animation mixer
        const mixer = new THREE.AnimationMixer(model);
        mixerRef.current = mixer;
        avatarClipsRef.current = Array.isArray(gltf.animations) ? gltf.animations : [];
        if (!idleClipRef.current && gltf.animations?.length) {
          idleClipRef.current = gltf.animations[0];
        }

        applyPosePreset(model, mixer, idleClipRef.current, avatarClipsRef.current, posePreset);
      },
      undefined,
      (err) => {
        if (cancelled || loadId !== activeAvatarLoadIdRef.current) {
          return;
        }
        console.error('GLTFLoader error:', err);
        const details = err?.message || err?.target?.statusText || 'Unknown load error';
        setAvatarLoadError(`Failed to load avatar model from URL: ${details}`);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [avatarUrl, posePreset]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Transform updates (live sliders) ────────────────────────────── */
  useEffect(() => {
    if (!avatarRef.current || !transform) return;
    applyTransform(avatarRef.current, transform);
  }, [transform]);

  useEffect(() => {
    if (!avatarRef.current) return;
    applyPosePreset(
      avatarRef.current,
      mixerRef.current,
      idleClipRef.current,
      avatarClipsRef.current,
      posePreset
    );
  }, [posePreset]);

  return (
    <div ref={containerRef} className="relative flex-1 w-full h-full overflow-hidden">
      {avatarLoadError && (
        <div className="absolute top-3 left-3 right-3 z-20 rounded-md border border-red-600 bg-red-950/90 px-3 py-2 text-xs text-red-200">
          {avatarLoadError}
        </div>
      )}
      {renderCtx && (
        <SpeechBubble
          text={speechText}
          avatarRef={avatarRef}
          camera={renderCtx.camera}
          renderer={renderCtx.renderer}
        />
      )}
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function applyTransform(model, t) {
  if (!model || !t) return;
  model.position.set(t.positionX ?? 0, t.positionY ?? 0, t.positionZ ?? 0);
  model.rotation.y = ((t.rotationY ?? 0) * Math.PI) / 180;
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

function applyPosePreset(model, mixer, idleClip, avatarClips, posePreset) {
  const normalized = String(posePreset || 'idle').toLowerCase();

  if (mixer) {
    mixer.stopAllAction();
  }

  ensureRestPoseSnapshot(model);
  resetToRestPose(model);

  const animatedPresets = ['idle', 'walk', 'run', 'dance'];
  if (animatedPresets.includes(normalized)) {
    if (mixer) {
      const clip = pickAnimationClip(normalized, idleClip, avatarClips);
      if (clip) {
        mixer.clipAction(clip).play();
      }
    }
    return;
  }

  if (normalized === 'wave') {
    applyWavePose(model);
  } else if (normalized === 'hands_on_hips') {
    applyHandsOnHipsPose(model);
  } else if (normalized === 'salute') {
    applySalutePose(model);
  } else if (normalized === 'arms_crossed') {
    applyArmsCrossedPose(model);
  } else if (normalized === 't_pose') {
    applyTPose(model);
  }

  model.updateMatrixWorld(true);
}

function pickAnimationClip(preset, idleClip, avatarClips = []) {
  const keywordsByPreset = {
    idle: [/idle/, /stand/],
    walk: [/walk/],
    run: [/run/, /jog/],
    dance: [/dance/],
  };

  const patterns = keywordsByPreset[preset] || [];
  const clips = Array.isArray(avatarClips) ? avatarClips : [];

  const fromAvatar = clips.find((clip) => {
    const name = String(clip?.name || '').toLowerCase();
    return patterns.some((re) => re.test(name));
  });
  if (fromAvatar) return fromAvatar;

  if (preset === 'idle' && idleClip) return idleClip;
  return null;
}

function ensureRestPoseSnapshot(model) {
  model.traverse((node) => {
    if (!node?.isBone) return;
    if (!node.userData.__restQuat) {
      node.userData.__restQuat = node.quaternion.clone();
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
    const name = String(node.name || '').toLowerCase();
    if (patterns.some((re) => re.test(name))) {
      result = node;
    }
  });

  return result;
}

function rotateBoneDeg(bone, x = 0, y = 0, z = 0) {
  if (!bone) return;
  bone.rotateX((x * Math.PI) / 180);
  bone.rotateY((y * Math.PI) / 180);
  bone.rotateZ((z * Math.PI) / 180);
}

function applyWavePose(model) {
  const rightUpperArm = findBone(model, [/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/]);
  const rightForeArm = findBone(model, [/rightforearm/, /r_forearm/, /lowerarm_r/, /mixamorigrightforearm/]);
  const rightHand = findBone(model, [/righthand/, /hand_r/, /mixamorigrighthand/]);

  rotateBoneDeg(rightUpperArm, -45, 0, -65);
  rotateBoneDeg(rightForeArm, -20, 0, -35);
  rotateBoneDeg(rightHand, 10, 0, -20);
}

function applyHandsOnHipsPose(model) {
  const leftUpperArm = findBone(model, [/leftarm/, /l_upperarm/, /upperarm_l/, /mixamorigleftarm/]);
  const rightUpperArm = findBone(model, [/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/]);
  const leftForeArm = findBone(model, [/leftforearm/, /l_forearm/, /lowerarm_l/, /mixamorigleftforearm/]);
  const rightForeArm = findBone(model, [/rightforearm/, /r_forearm/, /lowerarm_r/, /mixamorigrightforearm/]);

  rotateBoneDeg(leftUpperArm, 0, 0, 45);
  rotateBoneDeg(rightUpperArm, 0, 0, -45);
  rotateBoneDeg(leftForeArm, -30, 0, -30);
  rotateBoneDeg(rightForeArm, -30, 0, 30);
}

function applySalutePose(model) {
  const rightUpperArm = findBone(model, [/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/]);
  const rightForeArm = findBone(model, [/rightforearm/, /r_forearm/, /lowerarm_r/, /mixamorigrightforearm/]);
  const rightHand = findBone(model, [/righthand/, /hand_r/, /mixamorigrighthand/]);

  rotateBoneDeg(rightUpperArm, -35, 0, -40);
  rotateBoneDeg(rightForeArm, -70, 0, 20);
  rotateBoneDeg(rightHand, -10, 0, 25);
}

function applyArmsCrossedPose(model) {
  const leftUpperArm = findBone(model, [/leftarm/, /l_upperarm/, /upperarm_l/, /mixamorigleftarm/]);
  const rightUpperArm = findBone(model, [/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/]);
  const leftForeArm = findBone(model, [/leftforearm/, /l_forearm/, /lowerarm_l/, /mixamorigleftforearm/]);
  const rightForeArm = findBone(model, [/rightforearm/, /r_forearm/, /lowerarm_r/, /mixamorigrightforearm/]);

  rotateBoneDeg(leftUpperArm, 0, 0, 20);
  rotateBoneDeg(rightUpperArm, 0, 0, -20);
  rotateBoneDeg(leftForeArm, -70, 0, -35);
  rotateBoneDeg(rightForeArm, -70, 0, 35);
}

function applyTPose(model) {
  const leftUpperArm = findBone(model, [/leftarm/, /l_upperarm/, /upperarm_l/, /mixamorigleftarm/]);
  const rightUpperArm = findBone(model, [/rightarm/, /r_upperarm/, /upperarm_r/, /mixamorigrightarm/]);
  rotateBoneDeg(leftUpperArm, 0, 0, 90);
  rotateBoneDeg(rightUpperArm, 0, 0, -90);
}
