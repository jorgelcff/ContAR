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
  const [supported, setSupported] = useState(true);
  const [loadingModel, setLoadingModel] = useState(false);
  const [scale, setScale] = useState(1);
  const [lockPlacement, setLockPlacement] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const scaleLabel = `${Math.round(scale * 100)}%`;

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
    if (!container) return undefined;

    if (!navigator.xr) {
      setSupported(false);
      return undefined;
    }

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

function MarkerFrame({ modelUrl, markerUrl }) {
  const { t } = useTranslation();
  const iframeSrc = useMemo(
    () => buildQueryUrl('/ar-marker.html', { modelUrl, markerUrl }),
    [markerUrl, modelUrl]
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
  const [modelUrl, setModelUrl] = useState(searchParams.get('modelUrl') || '');
  const [markerUrl, setMarkerUrl] = useState(searchParams.get('markerUrl') || '');

  useEffect(() => {
    setModelUrl(searchParams.get('modelUrl') || '');
    setMarkerUrl(searchParams.get('markerUrl') || '');
  }, [searchParams]);

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
    return <MarkerFrame modelUrl={modelUrl} markerUrl={markerUrl} />;
  }

  return (
    <div className="flex flex-col h-screen bg-linear-to-b from-gray-950 via-slate-950 to-black text-white overflow-hidden">
      <Header />
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur-sm md:p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">{t('arTitle')}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{t('arDescription')}</h1>
          <p className="mt-3 max-w-2xl text-sm text-gray-300">
            Use o modo Superfície para ancorar o avatar em um plano com WebXR, ou o modo Marcador com um arquivo de padrão personalizado.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/30 p-4">
              <span className="text-sm font-medium text-gray-200">{t('modelUrl')}</span>
              <input
                type="text"
                value={modelUrl}
                onChange={(e) => setModelUrl(e.target.value)}
                placeholder="https://.../avatar.glb"
                className="rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </label>

            <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/30 p-4">
              <span className="text-sm font-medium text-gray-200">{t('markerUrl')}</span>
              <input
                type="text"
                value={markerUrl}
                onChange={(e) => setMarkerUrl(e.target.value)}
                placeholder="https://.../pattern-marker.patt"
                className="rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <Link
              to={surfaceHref}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-700 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-600"
            >
              {t('openSurfaceAr')}
            </Link>
            <Link
              to={markerHref}
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-gray-800 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
            >
              {t('openMarkerAr')}
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-950/30 p-4">
              <h3 className="font-semibold text-cyan-200">Surface AR</h3>
              <p className="mt-2 text-sm text-gray-300">
                Mova o celular até aparecer o alvo ciano, toque para posicionar o avatar — ele fica fixo na superfície.
              </p>
            </div>
            <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-950/30 p-4">
              <h3 className="font-semibold text-fuchsia-200">Marker AR</h3>
              <p className="mt-2 text-sm text-gray-300">
                Imprima um marcador personalizado e aponte a câmera — o avatar fica ancorado sobre o papel.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThreeJsFallbackScene({ modelUrl, onBack }) {
  const { t } = useTranslation();
  const [scale, setScale] = useState(1);

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
      <div className="shrink-0 border-b border-gray-800 bg-gray-900 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Three.js</h2>
          <p className="text-xs text-gray-400">{t('arFallback')}</p>
        </div>
        <button
          onClick={onBack}
          className="rounded-full bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600"
        >
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