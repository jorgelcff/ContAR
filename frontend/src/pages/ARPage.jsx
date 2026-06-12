import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import Header from '../components/ui/Header';
import SceneCanvas from '../components/3d/SceneCanvas';
import { useSceneStore } from '../store/useSceneStore';
import { LipSyncController } from '../controllers/LipSyncController';
import { getPublicStory, getScene } from '../api/sceneApi';
import useAudio from '../hooks/useAudio';
import PseudoARScene from './ar/PseudoARScene';
import {
  StoryOverlay,
  buildQueryUrl,
  createAvatarGLTFLoader,
  disposeObject3D,
  fitModelToGround,
  normalizeAvatarUrl,
  readSavedScale,
  resolveSceneAvatarUrl,
  saveScale,
  useARStory,
} from './ar/arShared';

function SurfaceARScene({ modelUrl, initialScale = 1, storyId, narrativeAudioUrl, narrativeText, onBack }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const reticleRef = useRef(null);
  const modelRootRef = useRef(null);
  const loaderRef = useRef(null);
  const controllerRef = useRef(null);
  const hitTestSourceRef = useRef(null);
  const referenceSpaceRef = useRef(null);
  const xrSessionRef = useRef(null);
  const lockPlacementRef = useRef(true);
  const placedRef = useRef(false);
  // True when the session started without hit-test: there's no surface reticle,
  // so the avatar is anchored in front of the camera using the WebXR viewer pose.
  const noHitTestRef = useRef(false);
  const scaleRef = useRef(initialScale);
  // Lip sync
  const lipSyncRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const lipSyncDataRef = useRef(null);
  const webAudioInitRef = useRef(false);
  const [supported, setSupported] = useState(null);
  const [arActive, setArActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [scale, setScale] = useState(initialScale);
  const [lockPlacement, setLockPlacement] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [hitTestUnsupported, setHitTestUnsupported] = useState(false);
  const scaleLabel = `${Math.round(scale * 100)}%`;
  const [speechPlaying, setSpeechPlaying] = useState(false);
  const story = useARStory(storyId);
  const effectiveModelUrl = resolveSceneAvatarUrl(story, storyId, modelUrl);
  const pseudoHref = useMemo(
    () => buildQueryUrl('/ar', { mode: 'pseudo', modelUrl, scale: initialScale, storyId: storyId || undefined }),
    [modelUrl, initialScale, storyId]
  );

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
      // AudioContext can start (or remain) suspended on Android — without
      // resuming it here, audio.play() advances silently with no sound.
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch { /* audio context blocked or already connected */ }
  };

  // Toggle playback of the narration saved in the editor (non-story mode).
  // Reuses the hidden <audio> element from useARStory and the same
  // AudioContext/analyser used for story lip sync.
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

  // Must be called directly from a click handler — requestSession requires
  // transient user activation. three.js's ARButton swallows rejections from
  // this call silently, which left the page on a transparent black canvas
  // with no feedback when the session failed to start (e.g. hit-test
  // unsupported, camera permission denied).
  const startArSession = async () => {
    const renderer = rendererRef.current;
    const container = containerRef.current;
    if (!renderer || !container || starting || arActive) return;
    setStarting(true);
    setError('');
    setHitTestUnsupported(false);

    const requestSession = (requireHitTest) =>
      navigator.xr.requestSession('immersive-ar', {
        ...(requireHitTest ? { requiredFeatures: ['hit-test'] } : {}),
        optionalFeatures: ['hit-test', 'dom-overlay'],
        domOverlay: { root: container },
      });

    try {
      let session;
      try {
        session = await requestSession(true);
        noHitTestRef.current = false;
      } catch (e) {
        // navigator.xr.isSessionSupported('immersive-ar') only checks the base
        // session — it can return true even when this device's WebXR/ARCore
        // build lacks the hit-test feature. Rather than failing, retry without
        // requiring hit-test: we still get camera passthrough + 6DOF positional
        // tracking and just anchor the avatar in front of the camera (no surface
        // detection / reticle).
        if (e?.name === 'NotSupportedError') {
          session = await requestSession(false);
          noHitTestRef.current = true;
        } else {
          throw e;
        }
      }
      renderer.xr.setReferenceSpaceType('local');
      await renderer.xr.setSession(session);
    } catch (err) {
      console.error('Failed to start AR session', err);
      if (err?.name === 'NotAllowedError') {
        setError('Permissão de câmera negada. Toque no ícone de cadeado/informações na barra de endereço, ative "Câmera" para este site e tente novamente.');
      } else if (err?.name === 'NotSupportedError') {
        setHitTestUnsupported(true);
        setError('Este dispositivo não suporta sessões de Realidade Aumentada (WebXR). Use a AR Imersiva, que funciona neste aparelho.');
      } else {
        setError(`Não foi possível iniciar a sessão AR: ${err?.message || err?.name || 'erro desconhecido'}`);
      }
    } finally {
      setStarting(false);
    }
  };

  const stopArSession = () => {
    xrSessionRef.current?.end?.().catch(() => {});
  };

  // No-hit-test fallback: anchor the avatar ~1.6m in front of the camera using
  // the live WebXR viewer pose (camera.matrixWorld), facing the user, with its
  // feet roughly at floor level (~1.6m below eye height).
  const placeInFrontOfCamera = () => {
    const camera = cameraRef.current;
    const target = modelRootRef.current;
    if (!camera || !target) return;
    const camPos = new THREE.Vector3();
    const camQuat = new THREE.Quaternion();
    camera.matrixWorld.decompose(camPos, camQuat, new THREE.Vector3());
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    target.position.set(
      camPos.x + forward.x * 1.6,
      camPos.y - 1.6,
      camPos.z + forward.z * 1.6
    );
    target.rotation.set(0, Math.atan2(camPos.x - target.position.x, camPos.z - target.position.z), 0);
    target.scale.setScalar(scaleRef.current);
    target.visible = true;
  };

  // Async WebXR support check — avoids false negatives on browsers
  // that have navigator.xr but don't actually support immersive-ar.
  useEffect(() => {
    if (!navigator?.xr) { setSupported(false); return; }
    let active = true;
    navigator.xr.isSessionSupported('immersive-ar')
      .then((ok) => { if (active) setSupported(ok); })
      .catch(() => { if (active) setSupported(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    lockPlacementRef.current = lockPlacement;
  }, [lockPlacement]);

  useEffect(() => {
    scaleRef.current = scale;
    saveScale(scale);
    if (modelRootRef.current) {
      modelRootRef.current.scale.setScalar(scale);
    }
  }, [scale]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || supported === null || !supported) return undefined;

    // Keep the scene background transparent — an opaque background color
    // would paint over the camera passthrough during the AR session,
    // making everything look like a black screen. The container div has
    // its own dark background for the pre-AR preview.
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.01, 20);
    camera.position.set(0, 1.6, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    // Default clear alpha is 1 (opaque) even with alpha:true — without this,
    // every frame paints an opaque black background that hides the AR camera
    // passthrough behind it, leaving only WebGL-rendered objects (e.g. the
    // reticle) visible against black.
    renderer.setClearColor(0x000000, 0);
    renderer.xr.enabled = true;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x333344, 1.4);
    scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 1.4);
    directional.position.set(2, 4, 1);
    scene.add(directional);

    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.12, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
    reticleRef.current = reticle;

    const modelRoot = new THREE.Group();
    modelRoot.visible = false;
    modelRoot.scale.setScalar(scaleRef.current);
    scene.add(modelRoot);
    modelRootRef.current = modelRoot;

    loaderRef.current = createAvatarGLTFLoader();

    const controller = renderer.xr.getController(0);
    controller.addEventListener('select', () => {
      const target = modelRootRef.current;
      if (!target) return;

      // No-hit-test mode: each tap re-anchors the avatar in front of the camera.
      if (noHitTestRef.current) {
        placeInFrontOfCamera();
        placedRef.current = true;
        setStatus('Avatar posicionado à sua frente. Toque para reposicionar.');
        return;
      }

      const reticleMesh = reticleRef.current;
      if (!reticleMesh || !reticleMesh.visible) return;
      if (lockPlacementRef.current && placedRef.current) return;

      target.visible = true;
      target.position.setFromMatrixPosition(reticleMesh.matrix);
      target.quaternion.setFromRotationMatrix(reticleMesh.matrix);
      target.scale.setScalar(scaleRef.current);
      placedRef.current = true;
      setStatus('Modelo fixado na superfície.');
    });
    scene.add(controller);
    controllerRef.current = controller;

    let hitTestSourceRequested = false;

    renderer.xr.addEventListener('sessionstart', () => {
      const session = renderer.xr.getSession();
      if (!session || hitTestSourceRequested) return;
      hitTestSourceRequested = true;
      xrSessionRef.current = session;
      placedRef.current = false;
      setArActive(true);
      setStatus(noHitTestRef.current
        ? 'Toque na tela para posicionar o avatar à sua frente.'
        : 'Mova o celular para detectar superfície, depois toque para posicionar.');

      session.addEventListener('end', () => {
        hitTestSourceRequested = false;
        hitTestSourceRef.current = null;
        referenceSpaceRef.current = null;
        xrSessionRef.current = null;
        reticle.visible = false;
        setArActive(false);
      });

      // Only the surface-detection path needs a hit-test source.
      if (!noHitTestRef.current) {
        session.requestReferenceSpace('viewer').then((viewerSpace) => {
          session.requestHitTestSource({ space: viewerSpace }).then((source) => {
            hitTestSourceRef.current = source;
          });
        }).catch((err) => {
          console.error('AR hit-test source request failed', err);
          setError('Não foi possível ativar a detecção de superfície (hit-test).');
        });
      }

      session.requestReferenceSpace('local').then((space) => {
        referenceSpaceRef.current = space;
      });
    });

    renderer.setAnimationLoop((time, frame) => {
      if (frame && !noHitTestRef.current && hitTestSourceRef.current && referenceSpaceRef.current) {
        const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current);
        if (hitTestResults.length > 0) {
          const pose = hitTestResults[0].getPose(referenceSpaceRef.current);
          reticle.visible = true;
          reticle.matrix.fromArray(pose.transform.matrix);
        } else {
          reticle.visible = false;
        }
      }

      // No-hit-test mode: auto-anchor in front of the camera on the first frame
      // after the model has loaded, so the user sees the avatar without tapping.
      if (noHitTestRef.current && !placedRef.current && modelRootRef.current?.children.length) {
        placeInFrontOfCamera();
        placedRef.current = true;
      }

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

    setStatus(t('tapToPlace'));

    return () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      if (controllerRef.current && sceneRef.current) {
        sceneRef.current.remove(controllerRef.current);
      }
      xrSessionRef.current?.end?.().catch(() => {});
      xrSessionRef.current = null;
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      disposeObject3D(modelRootRef.current);
      hitTestSourceRef.current?.cancel?.();
      hitTestSourceRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      modelRootRef.current = null;
      loaderRef.current = null;
      reticleRef.current = null;
    };
  }, [t, supported]);

  useEffect(() => {
    if (!loaderRef.current || !modelRootRef.current) return;
    const normalizedUrl = normalizeAvatarUrl(effectiveModelUrl);
    if (!normalizedUrl) {
      setError('');
      setLoadingModel(false);
      modelRootRef.current.visible = false;
      return;
    }

    setLoadingModel(true);
    setError('');
    placedRef.current = false;
    modelRootRef.current.visible = false;

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
        // Init lip sync for this model
        if (lipSyncRef.current) lipSyncRef.current.dispose();
        lipSyncRef.current = new LipSyncController(model);
        setLoadingModel(false);
        setStatus('Mova o celular para detectar superfície, depois toque para posicionar.');
      },
      undefined,
      (err) => {
        console.error('AR model load failed', err);
        setLoadingModel(false);
        setError(err?.message || 'Failed to load model');
      }
    );
  }, [effectiveModelUrl, t]);

  if (supported === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white flex-col gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
        <p className="text-sm text-gray-300">Verificando suporte AR...</p>
      </div>
    );
  }

  if (!supported) {
    return (
      <ThreeJsFallbackScene
        modelUrl={modelUrl}
        storyId={storyId}
        narrativeAudioUrl={narrativeAudioUrl}
        narrativeText={narrativeText}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white">
      {/* Hidden audio element for story playback */}
      <audio ref={story.audioRef} crossOrigin="anonymous" preload="auto" className="hidden" />

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
          // Single tap: unlock narration audio AND start the WebXR session.
          // Both must happen synchronously in this click handler — AR session
          // start requires transient user activation.
          story.start(initWebAudio);
          startArSession();
        }}
      />

      {/* Status panel (only shown when no story or story not started) */}
      {(!storyId || !story.hasStarted) && (
        <div className="absolute left-4 right-4 top-16 z-20 max-w-xs rounded-xl border border-white/10 bg-black/70 p-4 backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{t('arTitle')}</p>
          <p className="mt-2 text-sm text-gray-200">{status || t('tapToPlace')}</p>
          {loadingModel && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent shrink-0" />
              <p className="text-xs text-cyan-300">Carregando personagem...</p>
            </div>
          )}
          {!loadingModel && error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        </div>
      )}

      <div className="absolute bottom-4 left-4 right-4 z-20 rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur-sm md:left-1/2 md:right-auto md:w-130 md:-translate-x-1/2">
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-row md:items-center">
          <button onClick={onBack}
            className="min-h-12 rounded-xl border border-white/10 bg-gray-800 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 active:bg-gray-600">
            ← {t('back')}
          </button>
          <button
            onClick={() => {
              placedRef.current = false;
              setStatus('Mova o celular para detectar superfície, depois toque para posicionar.');
              if (modelRootRef.current) modelRootRef.current.visible = false;
            }}
            className="min-h-12 rounded-xl border border-white/10 bg-gray-800 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 active:bg-gray-600">
            {t('reset')}
          </button>
          <label className="col-span-2 flex items-center gap-3 rounded-xl border border-white/10 bg-gray-900 px-4 py-3 text-sm text-gray-200 cursor-pointer">
            <input type="checkbox" checked={lockPlacement} onChange={(e) => setLockPlacement(e.target.checked)} className="w-5 h-5 accent-cyan-400 cursor-pointer" />
            <span>{lockPlacement ? 'Posição fixada' : 'Mover avatar'}</span>
          </label>
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

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        {hitTestUnsupported && (
          <Link to={pseudoHref}
            className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-emerald-700 hover:bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors">
            {t('openPseudoAr')} →
          </Link>
        )}

        <button
          onClick={arActive ? stopArSession : startArSession}
          disabled={starting}
          className="mt-3 w-full min-h-12 rounded-xl bg-cyan-700 hover:bg-cyan-600 active:bg-cyan-800 px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-60">
          {starting ? 'Iniciando AR…' : arActive ? 'Encerrar AR' : 'Iniciar AR'}
        </button>
      </div>
    </div>
  );
}

function MarkerFrame({ modelUrl, markerUrl, useHiro, initialScale = 1, storyId }) {
  const { t } = useTranslation();
  const { audioRef, ...story } = useARStory(storyId);

  const iframeSrc = useMemo(
    () => buildQueryUrl('/ar-marker.html', { modelUrl, markerUrl, useHiro: useHiro ? '1' : '', scale: initialScale }),
    [markerUrl, modelUrl, useHiro, initialScale]
  );

  return (
    <div className="relative flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      {/* Hidden audio element — plays story narration from React (not inside iframe) */}
      <audio ref={audioRef} crossOrigin="anonymous" preload="auto" className="hidden" />

      <Header />
      <div className="border-b border-gray-800 bg-gray-900 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{storyId ? story.story?.metadata?.title || 'Carregando…' : t('markerUrl')}</h2>
          <p className="text-xs text-gray-400">
            {storyId ? `${story.scenes.length} cenas` : 'Use um arquivo de padrão personalizado e um modelo .glb.'}
          </p>
        </div>
        <Link to="/ar" className="rounded-full bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600">
          {t('back')}
        </Link>
      </div>

      <div className="flex-1 overflow-hidden bg-black relative">
        <iframe title="Marker AR" src={iframeSrc} allow="camera; microphone" className="h-full w-full border-0" />

        {/* Story splash overlay */}
        <StoryOverlay story={story} storyId={storyId} onStart={() => story.start()} />
      </div>

      {/* Story controls bar (shown after start) */}
      {storyId && story.hasStarted && (
        <div className="shrink-0 border-t border-gray-800 bg-gray-900/95 px-4 py-3">
          <StoryOverlay story={story} storyId={storyId} />
        </div>
      )}
    </div>
  );
}

export default function ARPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || '';
  const storedAvatarUrl = useSceneStore((s) => s.avatarUrl);
  const storedNarrativeAudioUrl = useSceneStore((s) => s.narrativeAudioUrl);
  const storedSpeechText = useSceneStore((s) => s.speechText);

  // Resolve effective URL: query param → stored avatar (HTTP only) → default
  const resolveUrl = (param, stored) => {
    if (param) return param;
    if (stored && !stored.startsWith('blob:') && /^https?:\/\//i.test(stored)) return stored;
    return '/default_model.glb';
  };

  const [modelUrl, setModelUrl] = useState(
    () => resolveUrl(searchParams.get('modelUrl'), storedAvatarUrl)
  );
  const [markerUrl, setMarkerUrl] = useState(searchParams.get('markerUrl') || '');
  const [initialScale, setInitialScale] = useState(readSavedScale);
  const [storyId, setStoryId] = useState(searchParams.get('storyId') || '');
  // null = checking, true/false = WebXR immersive-ar support result
  // (no navigator.xr at all means AR is definitely unsupported, no need to check)
  const [surfaceArSupported, setSurfaceArSupported] = useState(() => (navigator?.xr ? null : false));

  // Re-resolve synchronously when the store rehydrates or params change —
  // avoids a setState-in-effect cascade for this derived-state sync.
  const syncKey = `${searchParams.toString()}|${storedAvatarUrl}`;
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey);
  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
    setModelUrl(resolveUrl(searchParams.get('modelUrl'), storedAvatarUrl));
    setMarkerUrl(searchParams.get('markerUrl') || '');
    setStoryId(searchParams.get('storyId') || '');
  }

  // iOS Safari has no navigator.xr at all — detect this upfront so the
  // "Abrir AR de Superfície" button can be disabled instead of leading
  // to the 3D fallback (which looks like a broken/blocked AR mode).
  useEffect(() => {
    if (!navigator?.xr) return;
    let active = true;
    navigator.xr.isSessionSupported('immersive-ar')
      .then((ok) => { if (active) setSurfaceArSupported(ok); })
      .catch(() => { if (active) setSurfaceArSupported(false); });
    return () => { active = false; };
  }, []);

  const handleScaleChange = (v) => {
    setInitialScale(v);
    saveScale(v);
  };

  const isUsingStoredAvatar =
    storedAvatarUrl &&
    !storedAvatarUrl.startsWith('blob:') &&
    /^https?:\/\//i.test(storedAvatarUrl) &&
    !searchParams.get('modelUrl');

  const isBlobOnly =
    storedAvatarUrl?.startsWith('blob:') && !searchParams.get('modelUrl');

  const surfaceHref = useMemo(
    () => buildQueryUrl('/ar', { mode: 'surface', modelUrl, scale: initialScale, storyId: storyId || undefined }),
    [modelUrl, initialScale, storyId]
  );
  const pseudoHref = useMemo(
    () => buildQueryUrl('/ar', { mode: 'pseudo', modelUrl, scale: initialScale, storyId: storyId || undefined }),
    [modelUrl, initialScale, storyId]
  );
  const markerHref = useMemo(
    () => buildQueryUrl('/ar', { mode: 'marker', modelUrl, markerUrl, scale: initialScale, storyId: storyId || undefined }),
    [markerUrl, modelUrl, initialScale, storyId]
  );

  if (mode === 'surface') {
    const scaleParam = parseFloat(searchParams.get('scale'));
    const startScale = Number.isFinite(scaleParam) && scaleParam > 0 ? scaleParam : readSavedScale();
    return (
      <SurfaceARScene
        modelUrl={modelUrl}
        initialScale={startScale}
        storyId={searchParams.get('storyId') || ''}
        narrativeAudioUrl={storedNarrativeAudioUrl}
        narrativeText={storedSpeechText}
        onBack={() => window.location.assign('/ar')}
      />
    );
  }

  if (mode === 'pseudo') {
    const scaleParam = parseFloat(searchParams.get('scale'));
    const startScale = Number.isFinite(scaleParam) && scaleParam > 0 ? scaleParam : readSavedScale();
    return (
      <PseudoARScene
        modelUrl={modelUrl}
        initialScale={startScale}
        storyId={searchParams.get('storyId') || ''}
        narrativeAudioUrl={storedNarrativeAudioUrl}
        onBack={() => window.location.assign('/ar')}
      />
    );
  }

  if (mode === 'marker') {
    const scaleParam = parseFloat(searchParams.get('scale'));
    const startScale = Number.isFinite(scaleParam) && scaleParam > 0 ? scaleParam : readSavedScale();
    return (
      <MarkerFrame
        modelUrl={modelUrl}
        markerUrl={markerUrl}
        useHiro={searchParams.get('useHiro') === '1'}
        initialScale={startScale}
        storyId={searchParams.get('storyId') || ''}
      />
    );
  }

  const isHttp = typeof window !== 'undefined'
    && window.location.protocol !== 'https:'
    && window.location.hostname !== 'localhost'
    && window.location.hostname !== '127.0.0.1';

  const hiroHref = buildQueryUrl('/ar', {
    mode: 'marker',
    modelUrl,
    useHiro: '1',
    scale: initialScale,
    storyId: storyId || undefined,
  });

  return (
    <div className="flex flex-col h-screen bg-linear-to-b from-gray-950 via-slate-950 to-black text-white overflow-hidden">
      <Header />
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-3xl flex flex-col gap-5">

          {/* HTTPS warning */}
          {isHttp && (
            <div className="rounded-2xl border border-amber-600/50 bg-amber-950/40 px-4 py-3 flex gap-3 items-start">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0 text-amber-400 mt-0.5"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg>
              <div>
                <p className="text-sm font-semibold text-amber-300">HTTPS necessário para AR</p>
                <p className="text-xs text-amber-200/70 mt-0.5">
                  O WebXR e o acesso à câmera exigem HTTPS em produção. Acesse via <strong>https://</strong> ou teste localmente em <strong>localhost</strong>.
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">{t('arTitle')}</p>
            <h1 className="mt-2 text-2xl font-bold md:text-3xl">Experimente o avatar em Realidade Aumentada</h1>
          </div>

          {/* Avatar source banner */}
          {isUsingStoredAvatar ? (
            <div className="rounded-2xl border border-emerald-600/30 bg-emerald-950/30 px-4 py-3 flex items-center gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0 text-emerald-400"><path d="M20 6 9 17l-5-5"/></svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-300">Usando seu avatar salvo</p>
                <p className="text-xs text-emerald-200/60 mt-0.5 truncate">{storedAvatarUrl}</p>
              </div>
              <Link to="/editor" className="shrink-0 text-xs text-emerald-400 hover:text-emerald-300 underline">
                Trocar
              </Link>
            </div>
          ) : isBlobOnly ? (
            <div className="rounded-2xl border border-amber-600/40 bg-amber-950/30 px-4 py-3 flex items-center gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0 text-amber-400"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-300">Avatar local detectado</p>
                <p className="text-xs text-amber-200/60 mt-0.5">
                  Seu avatar foi carregado localmente e não pode ser usado no AR. Salve a cena no editor para gerar uma URL permanente.
                </p>
              </div>
              <Link to="/editor" className="shrink-0 text-xs text-amber-400 hover:text-amber-300 underline">
                Editor
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3 flex items-center gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0 text-blue-400"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
              <div className="flex-1">
                <p className="text-sm text-gray-300">Usando avatar padrão de demonstração</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Configure um avatar no editor e salve a cena para usá-lo aqui automaticamente.
                </p>
              </div>
              <Link to="/editor" className="shrink-0 text-xs text-cyan-400 hover:text-cyan-300 underline">
                Abrir editor
              </Link>
            </div>
          )}

          {/* Mode cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

            {/* Surface AR */}
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-5 flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-bold text-cyan-200">AR de Superfície</h2>
                <p className="mt-1 text-sm text-gray-300">
                  Ancora o avatar em uma mesa, chão ou parede usando WebXR. Toque para posicionar.
                </p>
              </div>
              <div className="rounded-xl bg-black/30 px-3 py-2 text-xs text-gray-400 space-y-1">
                <p className="font-semibold text-gray-300 mb-1">Requisitos:</p>
                <p>Android com <strong className="text-white">Chrome 81+</strong> e ARCore</p>
                <p>Página em <strong className="text-white">HTTPS</strong> (ou localhost)</p>
                <p className="text-amber-400">iPhone/iPad: não suportado (use o AR Imersiva ao lado)</p>
              </div>
              {surfaceArSupported === false ? (
                <div className="mt-auto rounded-xl border border-amber-600/30 bg-amber-950/20 px-4 py-3 text-center text-sm font-medium text-amber-300">
                  {t('iosRecommendPseudoAr')}
                </div>
              ) : (
                <Link to={surfaceHref}
                  className="mt-auto inline-flex items-center justify-center rounded-xl bg-cyan-700 hover:bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition-colors">
                  {t('openSurfaceAr')} →
                </Link>
              )}
            </div>

            {/* Pseudo AR (markerless, camera + gyroscope) */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-bold text-emerald-200">AR Imersiva</h2>
                <p className="mt-1 text-sm text-gray-300">
                  {t('pseudoArDescription')}
                </p>
              </div>
              <div className="rounded-xl bg-black/30 px-3 py-2 text-xs text-gray-400 space-y-1">
                <p className="font-semibold text-gray-300 mb-1">Requisitos:</p>
                <p><strong className="text-white">iPhone ou Android</strong> com câmera</p>
                <p>Sensores de movimento (giroscópio)</p>
                <p>Página em <strong className="text-white">HTTPS</strong> (ou localhost)</p>
              </div>
              <Link to={pseudoHref}
                className="mt-auto inline-flex items-center justify-center rounded-xl bg-emerald-700 hover:bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors">
                {t('openPseudoAr')} →
              </Link>
            </div>

            {/* Marker AR */}
            <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-950/20 p-5 flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-bold text-fuchsia-200">AR de Marcador</h2>
                <p className="mt-1 text-sm text-gray-300">
                  Aponte a câmera para um marcador impresso — o avatar aparece ancorado sobre ele.
                </p>
              </div>
              <div className="rounded-xl bg-black/30 px-3 py-2 text-xs text-gray-400 space-y-1">
                <p className="font-semibold text-gray-300 mb-1">Requisitos:</p>
                <p><strong className="text-white">Qualquer celular</strong> com câmera</p>
                <p>Chrome, Safari, Firefox</p>
                <p>Marcador impresso (ou na tela)</p>
              </div>
              <div className="mt-auto flex flex-col gap-2">
                <Link to={hiroHref}
                  className="inline-flex items-center justify-center rounded-xl bg-fuchsia-700 hover:bg-fuchsia-600 px-4 py-3 text-sm font-semibold text-white transition-colors">
                  ▶ Demo com Marcador Hiro
                </Link>
                <Link to={markerHref}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-gray-800 hover:bg-gray-700 px-4 py-2 text-xs font-medium text-gray-300 transition-colors">
                  Usar marcador personalizado
                </Link>
              </div>
            </div>
          </div>

          {/* Demo instructions */}
          <div className="rounded-2xl border border-white/5 bg-white/3 p-5">
            <p className="text-sm font-semibold text-white mb-3">Como testar o Demo Hiro agora</p>
            <ol className="space-y-2 text-sm text-gray-300">
              <li className="flex gap-2"><span className="text-fuchsia-400 font-bold shrink-0">1.</span> Abra esta página no celular</li>
              <li className="flex gap-2"><span className="text-fuchsia-400 font-bold shrink-0">2.</span> Imprima ou exiba na tela outro dispositivo o marcador Hiro:
                <a href="https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/hiro.png"
                  target="_blank" rel="noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 underline ml-1">
                  ver marcador Hiro ↗
                </a>
              </li>
              <li className="flex gap-2"><span className="text-fuchsia-400 font-bold shrink-0">3.</span> Clique em "Demo com Marcador Hiro" e aponte a câmera para o marcador</li>
              <li className="flex gap-2"><span className="text-fuchsia-400 font-bold shrink-0">4.</span> O avatar aparece sobre o papel!</li>
            </ol>
          </div>

          {/* Scale pre-config + URL inputs */}
          <details className="rounded-2xl border border-white/5 bg-white/3">
            <summary className="px-5 py-4 text-sm font-medium text-gray-300 cursor-pointer hover:text-white">
              Configurações avançadas
            </summary>
            <div className="px-5 pb-5 pt-2 flex flex-col gap-4">

              {/* Scale slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-200">Tamanho inicial do avatar</span>
                  <span className="text-sm font-bold text-cyan-300 tabular-nums w-14 text-right">
                    {Math.round(initialScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.05"
                  value={initialScale}
                  onChange={(e) => handleScaleChange(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>10%</span>
                  <span>100%</span>
                  <span>300%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Valor salvo automaticamente — aplicado ao abrir qualquer modo AR.
                </p>
              </div>

              {/* Story selector */}
              <div className="border-t border-white/5 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-200">História para reproduzir em AR</span>
                  <Link to="/stories" className="text-xs text-cyan-400 hover:text-cyan-300">
                    Ver minhas histórias ↗
                  </Link>
                </div>
                <input
                  type="text"
                  value={storyId}
                  onChange={(e) => setStoryId(e.target.value.trim())}
                  placeholder="Cole aqui o ID da história (ex: 6abc...)"
                  className="w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
                {storyId && (
                  <p className="text-xs text-emerald-400 mt-1.5">
                    História configurada — os botões acima já incluem o ID.
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Na página de histórias, copie o ID da URL: /story/<strong>ID</strong>
                </p>
              </div>

              <div className="border-t border-white/5 pt-4 grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-gray-400">{t('modelUrl')}</span>
                  <input type="text" value={modelUrl} onChange={(e) => setModelUrl(e.target.value)}
                    placeholder="https://.../avatar.glb"
                    className="rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400" />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-gray-400">{t('markerUrl')}</span>
                  <input type="text" value={markerUrl} onChange={(e) => setMarkerUrl(e.target.value)}
                    placeholder="https://.../pattern.patt"
                    className="rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400" />
                </label>
              </div>
            </div>
          </details>

        </div>
      </div>
    </div>
  );
}

function ThreeJsFallbackScene({ modelUrl, storyId, narrativeAudioUrl, narrativeText, onBack }) {
  const { t } = useTranslation();
  const audio = useAudio();
  const [scale, setScale] = useState(1);
  const [scenes, setScenes] = useState([]);
  const [index, setIndex] = useState(0);
  const [currentScene, setCurrentScene] = useState(null);
  const [storyMeta, setStoryMeta] = useState(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [prevAudioPlaying, setPrevAudioPlaying] = useState(false);

  const hiroHref = buildQueryUrl('/ar', { mode: 'marker', modelUrl: modelUrl || '/default_model.glb', useHiro: '1' });

  // Fetch story
  useEffect(() => {
    if (!storyId) return;
    getPublicStory(storyId).then((data) => {
      setStoryMeta(data);
      const ordered = [...(data.scenes || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setScenes(ordered);
      setIndex(0);
    }).catch(() => {});
  }, [storyId]);

  // Fetch current scene
  const sceneId = scenes[index]?.sceneId;
  const [prevSceneId, setPrevSceneId] = useState(sceneId);
  if (sceneId !== prevSceneId) {
    setPrevSceneId(sceneId);
    if (!sceneId) setCurrentScene(null);
  }

  useEffect(() => {
    if (!sceneId) return;
    let active = true;
    getScene(sceneId).then((d) => { if (active) setCurrentScene(d); }).catch(() => {});
    return () => { active = false; };
  }, [sceneId]);

  // Load audio + viseme timeline when scene changes
  useEffect(() => {
    if (!storyId) return;
    const audioUrl = currentScene?.content?.narrative?.audioUrl;
    const text = currentScene?.content?.narrative?.text || '';
    if (audioUrl) {
      audio.loadUrl(audioUrl);
      if (text) audio.generateVisemeTimelineFromText(text);
    } else {
      audio.stop();
      audio.clearVisemeTimeline();
    }
  }, [currentScene]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the narration saved in the editor (non-story mode). Playback is
  // started by the user via the "Tocar fala" button, not automatically.
  useEffect(() => {
    if (storyId || !narrativeAudioUrl) return;
    audio.loadUrl(narrativeAudioUrl);
    if (narrativeText) audio.generateVisemeTimelineFromText(narrativeText);
  }, [storyId, narrativeAudioUrl, narrativeText]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync play/pause
  useEffect(() => {
    if (!hasStarted || !audio.audioUrl) return;
    if (isPlaying) audio.play().catch(() => {});
    else audio.pause();
  }, [hasStarted, isPlaying, audio.audioUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance: audio went from playing → stopped at end
  if (audio.isPlaying !== prevAudioPlaying) {
    const ended = hasStarted && prevAudioPlaying && !audio.isPlaying
      && audio.audioDuration > 0
      && Math.abs(audio.audioCurrentTime - audio.audioDuration) < 0.5;
    setPrevAudioPlaying(audio.isPlaying);
    if (ended) {
      if (index < scenes.length - 1) setIndex(index + 1);
      else setIsPlaying(false);
    }
  }

  const handleStart = () => {
    audio.play().catch(() => {}); // unlock audio in gesture handler
    setHasStarted(true);
    setIsPlaying(true);
  };

  const avatarUrl = currentScene?.content?.avatar?.modelUrl || modelUrl;
  const posePreset = currentScene?.content?.avatar?.posePreset || 'idle';
  const speechText = currentScene?.content?.narrative?.text || (!storyId ? narrativeText : '') || '';

  const toggleNarration = () => {
    if (audio.isPlaying) audio.pause();
    else audio.play().catch(() => {});
  };

  const transform = useMemo(() => ({ positionX: 0, positionY: 0, positionZ: 0, rotationY: 0, scale }), [scale]);

  return (
    <div className="relative flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      <Header />
      <div className="shrink-0 border-b border-gray-800 bg-gray-900 px-4 py-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 text-amber-400"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg>
            <h2 className="font-semibold text-amber-300">AR não disponível neste dispositivo</h2>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">AR de superfície (WebXR) requer Android com Chrome+ARCore — o iOS Safari não suporta esse modo. Mostrando 3D normal.</p>
          {!storyId && (
            <p className="text-xs text-gray-500 mt-1">
              Tente o <a href={hiroHref} className="text-fuchsia-400 hover:underline">Demo com Marcador Hiro</a> — funciona em qualquer celular.
            </p>
          )}
        </div>
        <button onClick={onBack} className="shrink-0 rounded-full bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600">
          {t('back')}
        </button>
      </div>

      {/* Story splash */}
      {storyId && !hasStarted && storyMeta && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-6 w-full max-w-sm rounded-2xl border border-white/10 bg-black/90 p-6 text-center">
            <p className="text-xs uppercase tracking-widest text-cyan-300 mb-2">História</p>
            <h2 className="text-xl font-bold text-white mb-1">{storyMeta?.metadata?.title}</h2>
            <p className="text-sm text-gray-400 mb-5">{scenes.length} cenas</p>
            <button onClick={handleStart}
              className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold">
              ▶ Iniciar história
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <SceneCanvas
          avatarUrl={avatarUrl}
          transform={transform}
          posePreset={posePreset}
          speechText={speechText}
          visemeTimeline={audio.visemeTimeline}
          audioCurrentTime={audio.audioCurrentTime}
          lipSyncConfig={audio.lipSyncConfig}
        />
      </div>

      {/* Story controls */}
      {storyId && hasStarted && (
        <div className="shrink-0 border-t border-gray-800 bg-gray-900/95 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-cyan-300 truncate max-w-[70%]">{speechText.slice(0, 60) || storyMeta?.metadata?.title}</p>
            <p className="text-xs text-gray-500">{index + 1}/{scenes.length}</p>
          </div>
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-cyan-400" style={{ width: `${(index / Math.max(1, scenes.length - 1)) * 100}%` }} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}
              className="flex-1 py-2 rounded-lg bg-gray-700 text-xs text-white disabled:opacity-40">◀</button>
            <button onClick={() => setIsPlaying((p) => !p)}
              className="flex-1 py-2 rounded-lg bg-cyan-700 text-xs text-white font-semibold">
              {isPlaying ? '‖' : '▶'}
            </button>
            <button onClick={() => setIndex((i) => Math.min(scenes.length - 1, i + 1))} disabled={index >= scenes.length - 1}
              className="flex-1 py-2 rounded-lg bg-gray-700 text-xs text-white disabled:opacity-40">▶▶</button>
          </div>
        </div>
      )}

      {/* Editor narration playback (non-story mode) */}
      {!storyId && narrativeAudioUrl && (
        <div className="shrink-0 border-t border-gray-800 bg-gray-900/95 px-4 py-3">
          <button
            onClick={toggleNarration}
            className="w-full py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-sm font-semibold text-white transition-colors">
            {audio.isPlaying ? '⏸ Pausar fala' : '▶ Tocar fala'}
          </button>
        </div>
      )}

      {/* Scale control */}
      <div className="shrink-0 border-t border-gray-800 bg-gray-950/95 px-4 py-3 backdrop-blur-sm">
        <label className="flex items-center gap-2 text-sm text-gray-200">
          <span>{t('scale')}</span>
          <input type="range" min="0.2" max="2.0" step="0.01" value={scale}
            onChange={(e) => setScale(Number(e.target.value))} className="flex-1 accent-cyan-400" />
          <span className="w-12 text-right">{`${Math.round(scale * 100)}%`}</span>
        </label>
      </div>
    </div>
  );
}