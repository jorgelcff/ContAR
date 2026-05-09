import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import Header from '../components/ui/Header';
import SceneCanvas from '../components/3d/SceneCanvas';
import { useSceneStore } from '../store/useSceneStore';

function normalizeAvatarUrl(url) {
  if (typeof url !== 'string') return '';
  const value = url.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || /^data:/i.test(value) || /^blob:/i.test(value)) {
    return value;
  }
  return value;
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

function fitModelToGround(model) {
  if (!model) return;
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
  const maxDimension = Math.max(size.x, size.y, size.z);
  if (maxDimension > 0) {
    const baseScale = 1 / maxDimension;
    model.scale.setScalar(baseScale * 2.2);
  }
}

function buildQueryUrl(path, params) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return `${url.pathname}${url.search}${url.hash}`;
}

function SurfaceARScene({ modelUrl, onBack }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const buttonHostRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const reticleRef = useRef(null);
  const modelRootRef = useRef(null);
  const loaderRef = useRef(null);
  const controllerRef = useRef(null);
  const hitTestSourceRef = useRef(null);
  const referenceSpaceRef = useRef(null);
  const lockPlacementRef = useRef(true);
  const placedRef = useRef(false);
  const scaleRef = useRef(1);
  const [supported, setSupported] = useState(null); // null = checking
  const [loadingModel, setLoadingModel] = useState(false);
  const [scale, setScale] = useState(1);
  const [lockPlacement, setLockPlacement] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const scaleLabel = `${Math.round(scale * 100)}%`;

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
    if (modelRootRef.current) {
      modelRootRef.current.scale.setScalar(scale);
    }
  }, [scale]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || supported === null || !supported) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070c);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.01, 20);
    camera.position.set(0, 1.6, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
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

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
    gltfLoader.setCrossOrigin('anonymous');
    gltfLoader.register((parser) => new VRMLoaderPlugin(parser)); // VRM support
    loaderRef.current = gltfLoader;

    const controller = renderer.xr.getController(0);
    controller.addEventListener('select', () => {
      const target = modelRootRef.current;
      const reticleMesh = reticleRef.current;
      if (!target || !reticleMesh || !reticleMesh.visible) return;
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

      session.addEventListener('end', () => {
        hitTestSourceRequested = false;
        hitTestSourceRef.current = null;
        referenceSpaceRef.current = null;
        reticle.visible = false;
      });

      session.requestReferenceSpace('viewer').then((viewerSpace) => {
        session.requestHitTestSource({ space: viewerSpace }).then((source) => {
          hitTestSourceRef.current = source;
        });
      });

      session.requestReferenceSpace('local').then((space) => {
        referenceSpaceRef.current = space;
      });
    });

    renderer.setAnimationLoop((time, frame) => {
      if (frame && hitTestSourceRef.current && referenceSpaceRef.current) {
        const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current);
        if (hitTestResults.length > 0) {
          const pose = hitTestResults[0].getPose(referenceSpaceRef.current);
          reticle.visible = true;
          reticle.matrix.fromArray(pose.transform.matrix);
        } else {
          reticle.visible = false;
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

    const arButton = ARButton.createButton(renderer, {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: container },
    });
    arButton.className = `${arButton.className} !static !w-full`;
    if (buttonHostRef.current) {
      buttonHostRef.current.appendChild(arButton);
    }

    setStatus(t('tapToPlace'));

    return () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      if (controllerRef.current && sceneRef.current) {
        sceneRef.current.remove(controllerRef.current);
      }
      if (buttonHostRef.current) {
        buttonHostRef.current.innerHTML = '';
      }
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
  }, [t]);

  useEffect(() => {
    if (!loaderRef.current || !modelRootRef.current) return;
    const normalizedUrl = normalizeAvatarUrl(modelUrl);
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
  }, [modelUrl, t]);

  if (supported === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white flex-col gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
        <p className="text-sm text-gray-300">Verificando suporte AR...</p>
      </div>
    );
  }

  if (!supported) {
    return <ThreeJsFallbackScene modelUrl={modelUrl} onBack={onBack} />;
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="absolute inset-x-0 top-0 z-20">
        <Header />
      </div>

      <div className="absolute left-4 top-16 z-20 max-w-xs rounded-xl border border-white/10 bg-black/70 p-4 backdrop-blur-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{t('arTitle')}</p>
        <p className="mt-2 text-sm text-gray-200">{status || t('tapToPlace')}</p>
        {loadingModel && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent shrink-0" />
            <p className="text-xs text-cyan-300">Carregando personagem...</p>
          </div>
        )}
        {!loadingModel && error && (
          <p className="mt-1 text-xs text-red-400">{error}</p>
        )}
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-20 rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur-sm md:left-1/2 md:right-auto md:w-[520px] md:-translate-x-1/2">
        {/* Mobile-first controls: large touch targets */}
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-row md:items-center">
          <button
            onClick={onBack}
            className="min-h-12 rounded-xl border border-white/10 bg-gray-800 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 active:bg-gray-600"
          >
            ← {t('back')}
          </button>
          <button
            onClick={() => {
              placedRef.current = false;
              setStatus('Mova o celular para detectar superfície, depois toque para posicionar.');
              if (modelRootRef.current) modelRootRef.current.visible = false;
            }}
            className="min-h-12 rounded-xl border border-white/10 bg-gray-800 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 active:bg-gray-600"
          >
            🔄 {t('reset')}
          </button>
          <label className="col-span-2 flex items-center gap-3 rounded-xl border border-white/10 bg-gray-900 px-4 py-3 text-sm text-gray-200 cursor-pointer">
            <input
              type="checkbox"
              checked={lockPlacement}
              onChange={(e) => setLockPlacement(e.target.checked)}
              className="w-5 h-5 accent-cyan-400 cursor-pointer"
            />
            <span>{lockPlacement ? '🔒 Posição fixada' : '🔓 Mover avatar'}</span>
          </label>
        </div>

        <label className="mt-3 flex items-center gap-3 text-sm text-gray-200">
          <span className="shrink-0 w-14 text-right text-xs text-gray-400">{scaleLabel}</span>
          <input
            type="range" min="0.2" max="2.0" step="0.01" value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="flex-1 accent-cyan-400 cursor-pointer"
          />
          <span className="shrink-0 text-xs text-gray-400">{t('scale')}</span>
        </label>

        <div ref={buttonHostRef} className="mt-3 flex justify-center" />
      </div>
    </div>
  );
}

function MarkerFrame({ modelUrl, markerUrl, useHiro }) {
  const { t } = useTranslation();
  const iframeSrc = useMemo(
    () => buildQueryUrl('/ar-marker.html', { modelUrl, markerUrl, useHiro: useHiro ? '1' : '' }),
    [markerUrl, modelUrl, useHiro]
  );

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      <Header />
      <div className="border-b border-gray-800 bg-gray-900 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t('markerUrl')}</h2>
          <p className="text-xs text-gray-400">Use um arquivo de padrão personalizado e um modelo .glb.</p>
        </div>
        <Link
          to="/ar"
          className="rounded-full bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600"
        >
          {t('back')}
        </Link>
      </div>
      <div className="flex-1 overflow-hidden bg-black">
        <iframe title="Marker AR" src={iframeSrc} className="h-full w-full border-0" />
      </div>
    </div>
  );
}

export default function ARPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || '';
  const storedAvatarUrl = useSceneStore((s) => s.avatarUrl);

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

  // Re-resolve when store rehydrates or params change
  useEffect(() => {
    setModelUrl(resolveUrl(searchParams.get('modelUrl'), storedAvatarUrl));
    setMarkerUrl(searchParams.get('markerUrl') || '');
  }, [searchParams, storedAvatarUrl]);

  const isUsingStoredAvatar =
    storedAvatarUrl &&
    !storedAvatarUrl.startsWith('blob:') &&
    /^https?:\/\//i.test(storedAvatarUrl) &&
    !searchParams.get('modelUrl');

  const isBlobOnly =
    storedAvatarUrl?.startsWith('blob:') && !searchParams.get('modelUrl');

  const surfaceHref = useMemo(
    () => buildQueryUrl('/ar', { mode: 'surface', modelUrl }),
    [modelUrl]
  );
  const markerHref = useMemo(
    () => buildQueryUrl('/ar', { mode: 'marker', modelUrl, markerUrl }),
    [markerUrl, modelUrl]
  );

  if (mode === 'surface') {
    return <SurfaceARScene modelUrl={modelUrl} onBack={() => window.location.assign('/ar')} />;
  }

  if (mode === 'marker') {
    return (
      <MarkerFrame
        modelUrl={modelUrl}
        markerUrl={markerUrl}
        useHiro={searchParams.get('useHiro') === '1'}
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
  });

  return (
    <div className="flex flex-col h-screen bg-linear-to-b from-gray-950 via-slate-950 to-black text-white overflow-hidden">
      <Header />
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-3xl flex flex-col gap-5">

          {/* HTTPS warning */}
          {isHttp && (
            <div className="rounded-2xl border border-amber-600/50 bg-amber-950/40 px-4 py-3 flex gap-3 items-start">
              <span className="text-xl shrink-0">⚠️</span>
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
              <span className="text-xl shrink-0">✅</span>
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
              <span className="text-xl shrink-0">⚠️</span>
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
              <span className="text-xl shrink-0">ℹ️</span>
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
          <div className="grid gap-4 md:grid-cols-2">

            {/* Surface AR */}
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-5 flex flex-col gap-4">
              <div>
                <span className="text-2xl">🏠</span>
                <h2 className="mt-2 text-lg font-bold text-cyan-200">AR de Superfície</h2>
                <p className="mt-1 text-sm text-gray-300">
                  Ancora o avatar em uma mesa, chão ou parede usando WebXR. Toque para posicionar.
                </p>
              </div>
              <div className="rounded-xl bg-black/30 px-3 py-2 text-xs text-gray-400 space-y-1">
                <p className="font-semibold text-gray-300 mb-1">Requisitos:</p>
                <p>📱 Android com <strong className="text-white">Chrome 81+</strong> e ARCore</p>
                <p>🍎 iPhone/iPad com <strong className="text-white">Safari iOS 15+</strong></p>
                <p>🔒 Página em <strong className="text-white">HTTPS</strong> (ou localhost)</p>
              </div>
              <Link to={surfaceHref}
                className="mt-auto inline-flex items-center justify-center rounded-xl bg-cyan-700 hover:bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition-colors">
                {t('openSurfaceAr')} →
              </Link>
            </div>

            {/* Marker AR */}
            <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-950/20 p-5 flex flex-col gap-4">
              <div>
                <span className="text-2xl">🎯</span>
                <h2 className="mt-2 text-lg font-bold text-fuchsia-200">AR de Marcador</h2>
                <p className="mt-1 text-sm text-gray-300">
                  Aponte a câmera para um marcador impresso — o avatar aparece ancorado sobre ele.
                </p>
              </div>
              <div className="rounded-xl bg-black/30 px-3 py-2 text-xs text-gray-400 space-y-1">
                <p className="font-semibold text-gray-300 mb-1">Requisitos:</p>
                <p>📱 <strong className="text-white">Qualquer celular</strong> com câmera</p>
                <p>🌐 Chrome, Safari, Firefox</p>
                <p>🖨️ Marcador impresso (ou na tela)</p>
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
            <p className="text-sm font-semibold text-white mb-3">🎯 Como testar o Demo Hiro agora</p>
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

          {/* URL inputs */}
          <details className="rounded-2xl border border-white/5 bg-white/3">
            <summary className="px-5 py-4 text-sm font-medium text-gray-300 cursor-pointer hover:text-white">
              ⚙️ Configurações avançadas (URL do modelo e marcador)
            </summary>
            <div className="px-5 pb-5 pt-2 grid gap-4 md:grid-cols-2">
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
          </details>

        </div>
      </div>
    </div>
  );
}

function ThreeJsFallbackScene({ modelUrl, onBack }) {
  const { t } = useTranslation();
  const [scale, setScale] = useState(1);
  const hiroHref = buildQueryUrl('/ar', { mode: 'marker', modelUrl: modelUrl || '/default_model.glb', useHiro: '1' });

  const transform = useMemo(
    () => ({
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      rotationY: 0,
      scale,
    }),
    [scale]
  );

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      <Header />
      <div className="shrink-0 border-b border-gray-800 bg-gray-900 px-4 py-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <h2 className="font-semibold text-amber-300">AR não disponível neste dispositivo</h2>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            WebXR Surface AR requer Android Chrome + ARCore ou iOS Safari 15+. Mostrando visualização 3D normal.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Tente o <a href={hiroHref} className="text-fuchsia-400 hover:underline">Demo com Marcador Hiro</a> — funciona em qualquer celular.
          </p>
        </div>
        <button onClick={onBack}
          className="shrink-0 rounded-full bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600">
          {t('back')}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <SceneCanvas
          avatarUrl={modelUrl}
          transform={transform}
          posePreset="idle"
          speechText=""
        />
      </div>

      <div className="shrink-0 border-t border-gray-800 bg-gray-950/95 px-4 py-3 backdrop-blur-sm">
        <label className="flex items-center gap-2 text-sm text-gray-200">
          <span>{t('scale')}</span>
          <input
            type="range"
            min="0.2"
            max="2.0"
            step="0.01"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="flex-1 accent-cyan-400"
          />
          <span className="w-12 text-right">{`${Math.round(scale * 100)}%`}</span>
        </label>
      </div>
    </div>
  );
}