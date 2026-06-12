import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import Header from '../../components/ui/Header';
import { LipSyncController } from '../../controllers/LipSyncController';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';
import {
  ARPoseRig,
  StoryOverlay,
  createAvatarGLTFLoader,
  disposeObject3D,
  fitModelToGround,
  loadAnimationManifest,
  normalizeAvatarUrl,
  resolveSceneAvatarUrl,
  resolveScenePosePreset,
  saveScale,
  useARStory,
} from './arShared';

const PLACEMENT_DISTANCE = 1.8;
const CAMERA_HEIGHT = 1.6;

// "Pseudo-AR" / Magic Window: overlays the avatar scene on the live camera
// feed and drives the virtual camera's rotation from the device gyroscope, so
// the avatar appears anchored as the user pans the phone. No marker and no
// WebXR session required — works on iOS Safari and Android Chrome alike.
export default function PseudoARScene({ modelUrl, initialScale = 1, storyId, narrativeAudioUrl, posePreset, onBack }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const modelRootRef = useRef(null);
  const loaderRef = useRef(null);
  const streamRef = useRef(null);
  const scaleRef = useRef(initialScale);
  // Pose / animation rig (matches the editor's poses & animation clips)
  const poseRigRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const effectivePoseRef = useRef('idle');
  // Lip sync
  const lipSyncRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const lipSyncDataRef = useRef(null);
  const webAudioInitRef = useRef(false);
  const deviceOrientation = useDeviceOrientation();

  const [arActive, setArActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [scale, setScale] = useState(initialScale);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const scaleLabel = `${Math.round(scale * 100)}%`;
  const [speechPlaying, setSpeechPlaying] = useState(false);
  const story = useARStory(storyId);

  const cameraSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const effectiveModelUrl = resolveSceneAvatarUrl(story, storyId, modelUrl);
  const effectivePosePreset = resolveScenePosePreset(story, storyId, posePreset);
  effectivePoseRef.current = effectivePosePreset;

  // Set up Web Audio API once (must be called in a user-gesture handler)
  const initWebAudio = () => {
    if (webAudioInitRef.current || !story.audioRef.current) return;
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const src = ctx.createMediaElementSource(story.audioRef.current);
      src.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      webAudioInitRef.current = true;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch { /* audio context blocked or already connected */ }
  };

  // Toggle playback of the narration saved in the editor (non-story mode).
  const toggleSpeech = () => {
    const el = story.audioRef.current;
    if (!el || !narrativeAudioUrl) return;
    if (speechPlaying) {
      el.pause();
      setSpeechPlaying(false);
      return;
    }
    initWebAudio();
    if (el.src !== narrativeAudioUrl) {
      el.src = narrativeAudioUrl;
      el.load();
    }
    el.play().catch(() => {});
    setSpeechPlaying(true);
  };

  useEffect(() => {
    const el = story.audioRef.current;
    if (!el) return;
    const onEnded = () => setSpeechPlaying(false);
    el.addEventListener('ended', onEnded);
    return () => el.removeEventListener('ended', onEnded);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-anchors the avatar in front of wherever the camera is currently facing.
  const placeInFront = () => {
    const camera = cameraRef.current;
    const modelRoot = modelRootRef.current;
    if (!camera || !modelRoot) return;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    modelRoot.position.set(
      camera.position.x + forward.x * PLACEMENT_DISTANCE,
      camera.position.y - CAMERA_HEIGHT,
      camera.position.z + forward.z * PLACEMENT_DISTANCE
    );
    modelRoot.rotation.y = Math.atan2(
      camera.position.x - modelRoot.position.x,
      camera.position.z - modelRoot.position.z
    );
    modelRoot.visible = true;
  };

  const resetPosition = () => {
    placeInFront();
  };

  // Must run directly inside the "Start AR" tap: getUserMedia and
  // DeviceOrientationEvent.requestPermission() both require transient user
  // activation on iOS Safari.
  const startPseudoAr = async () => {
    if (starting || arActive) return;
    setStarting(true);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      const permission = await deviceOrientation.requestPermission();
      if (permission === 'granted') {
        deviceOrientation.start((quaternion) => {
          cameraRef.current?.quaternion.copy(quaternion);
        });
      } else {
        setStatus(t('pseudoArOrientationUnsupported'));
      }

      placeInFront();
      setArActive(true);
      if (permission === 'granted') setStatus(t('pseudoArDriftHint'));
    } catch (err) {
      console.error('Failed to start Pseudo AR', err);
      if (err?.name === 'NotAllowedError') {
        setError(t('pseudoArCameraError'));
      } else {
        setError(`Não foi possível acessar a câmera: ${err?.message || err?.name || 'erro desconhecido'}`);
      }
    } finally {
      setStarting(false);
    }
  };

  const stopPseudoAr = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    deviceOrientation.stop();
    if (cameraRef.current) cameraRef.current.quaternion.identity();
    if (modelRootRef.current) modelRootRef.current.visible = false;
    setArActive(false);
    setStatus('');
  };

  useEffect(() => {
    scaleRef.current = scale;
    saveScale(scale);
    if (modelRootRef.current) {
      modelRootRef.current.scale.setScalar(scale);
    }
  }, [scale]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    // Transparent scene/renderer — the live camera <video> behind the canvas
    // shows through, same trick used for WebXR passthrough in SurfaceARScene.
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.01, 20);
    camera.position.set(0, CAMERA_HEIGHT, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x333344, 1.4);
    scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 1.4);
    directional.position.set(2, 4, 1);
    scene.add(directional);

    const modelRoot = new THREE.Group();
    modelRoot.visible = false;
    modelRoot.scale.setScalar(scaleRef.current);
    scene.add(modelRoot);
    modelRootRef.current = modelRoot;

    loaderRef.current = createAvatarGLTFLoader();

    renderer.setAnimationLoop(() => {
      // Drive pose animations (idle/walk/dance/…) + blink/breathing each frame.
      poseRigRef.current?.update(clockRef.current.getDelta());

      // Heuristic lip sync driven by audio analyser
      if (analyserRef.current && lipSyncRef.current?.hasTargets) {
        const binCount = analyserRef.current.frequencyBinCount;
        if (!lipSyncDataRef.current || lipSyncDataRef.current.length !== binCount) {
          lipSyncDataRef.current = new Uint8Array(binCount);
        }
        analyserRef.current.getByteTimeDomainData(lipSyncDataRef.current);
        let sum = 0;
        for (let i = 0; i < binCount; i++) {
          const v = (lipSyncDataRef.current[i] - 128) / 128;
          sum += v * v;
        }
        const mouthOpen = Math.min(1, Math.sqrt(sum / binCount) * 14);
        if (mouthOpen > 0.04) {
          lipSyncRef.current.setGroupValue('aa', mouthOpen * 0.9);
          lipSyncRef.current.setGroupValue('mouthOpen', mouthOpen * 0.45);
        } else {
          lipSyncRef.current.resetGroups();
        }
      }

      renderer.render(scene, camera);
    });

    const resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    setStatus(t('pseudoArStatusReady'));

    return () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      deviceOrientation.stop();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      poseRigRef.current?.dispose();
      poseRigRef.current = null;
      disposeObject3D(modelRootRef.current);
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      modelRootRef.current = null;
      loaderRef.current = null;
    };
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loaderRef.current || !modelRootRef.current) return;
    const normalizedUrl = normalizeAvatarUrl(effectiveModelUrl);
    if (!normalizedUrl) {
      setError('');
      setLoadingModel(false);
      return;
    }

    setLoadingModel(true);
    setError('');

    while (modelRootRef.current.children.length) {
      const child = modelRootRef.current.children.pop();
      if (child) {
        modelRootRef.current.remove(child);
        disposeObject3D(child);
      }
    }

    loaderRef.current.load(
      normalizedUrl,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
        fitModelToGround(model);
        modelRootRef.current.add(model);
        modelRootRef.current.scale.setScalar(scaleRef.current);
        if (lipSyncRef.current) lipSyncRef.current.dispose();
        lipSyncRef.current = new LipSyncController(model);

        // Pose/animation rig — apply the scene's pose, then load shared
        // animation clips and re-apply (so walk/dance/etc. animate).
        poseRigRef.current?.dispose();
        const rig = new ARPoseRig(gltf, model);
        poseRigRef.current = rig;
        rig.apply(effectivePoseRef.current);
        loadAnimationManifest(loaderRef.current)
          .then((clips) => { if (poseRigRef.current === rig) rig.setExternalClips(clips); })
          .catch(() => {});

        setLoadingModel(false);
      },
      undefined,
      (err) => {
        console.error('Pseudo AR model load failed', err);
        setLoadingModel(false);
        setError(err?.message || 'Failed to load model');
      }
    );
  }, [effectiveModelUrl]);

  // Re-apply the pose when the scene's pose changes without the model changing
  // (e.g. advancing to a story scene that reuses the same avatar).
  useEffect(() => {
    poseRigRef.current?.apply(effectivePosePreset);
  }, [effectivePosePreset]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white">
      {/* Hidden audio element for story playback */}
      <audio ref={story.audioRef} crossOrigin="anonymous" preload="auto" className="hidden" />

      {/* Live camera feed background */}
      <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />

      {/* Transparent Three.js canvas on top of the camera feed */}
      <div ref={containerRef} className="absolute inset-0" />

      <div className="absolute inset-x-0 top-0 z-20">
        <Header />
      </div>

      {/* Story splash / controls */}
      <StoryOverlay
        story={story}
        storyId={storyId}
        compact
        onStart={() => {
          story.start(initWebAudio);
          startPseudoAr();
        }}
      />

      {/* Status panel (only shown when no story or story not started) */}
      {(!storyId || !story.hasStarted) && (
        <div className="absolute left-4 right-4 top-16 z-20 max-w-xs rounded-xl border border-white/10 bg-black/70 p-4 backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{t('arTitle')}</p>
          <p className="mt-2 text-sm text-gray-200">{status || t('pseudoArStatusReady')}</p>
          {loadingModel && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent shrink-0" />
              <p className="text-xs text-cyan-300">Carregando personagem...</p>
            </div>
          )}
          {!loadingModel && error && <p className="mt-1 text-xs text-red-400">{error}</p>}
          {!cameraSupported && (
            <p className="mt-1 text-xs text-amber-400">{t('pseudoArCameraError')}</p>
          )}
        </div>
      )}

      <div className="absolute bottom-4 left-4 right-4 z-20 rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur-sm md:left-1/2 md:right-auto md:w-130 md:-translate-x-1/2">
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-row md:items-center">
          <button onClick={onBack}
            className="min-h-12 rounded-xl border border-white/10 bg-gray-800 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 active:bg-gray-600">
            ← {t('back')}
          </button>
          <button
            onClick={resetPosition}
            disabled={!arActive}
            className="min-h-12 rounded-xl border border-white/10 bg-gray-800 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 active:bg-gray-600 disabled:opacity-40">
            {t('pseudoArResetPosition')}
          </button>
          {!storyId && narrativeAudioUrl && (
            <button
              onClick={toggleSpeech}
              className="col-span-2 min-h-12 rounded-xl border border-white/10 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 px-4 py-3 text-sm font-semibold text-white transition-colors">
              {speechPlaying ? '⏸ Pausar fala' : '▶ Tocar fala'}
            </button>
          )}
        </div>

        <label className="mt-3 flex items-center gap-3 text-sm text-gray-200">
          <span className="shrink-0 w-14 text-right text-xs text-gray-400">{scaleLabel}</span>
          <input type="range" min="0.2" max="2.0" step="0.01" value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="flex-1 accent-cyan-400 cursor-pointer" />
          <span className="shrink-0 text-xs text-gray-400">{t('scale')}</span>
        </label>

        {arActive && <p className="mt-2 text-xs text-gray-400">{t('pseudoArDriftHint')}</p>}
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <button
          onClick={arActive ? stopPseudoAr : startPseudoAr}
          disabled={starting || !cameraSupported}
          className="mt-3 w-full min-h-12 rounded-xl bg-cyan-700 hover:bg-cyan-600 active:bg-cyan-800 px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-60">
          {starting ? '...' : arActive ? t('pseudoArStop') : t('pseudoArStart')}
        </button>
      </div>
    </div>
  );
}
