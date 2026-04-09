import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import SpeechBubble from './SpeechBubble';

/**
 * SceneCanvas — Three.js scene wrapped in a React component.
 *
 * Props:
 *   avatarUrl   – GLB model URL to load (changes trigger a reload)
 *   transform   – { positionX, positionY, positionZ, rotationY (deg), scale }
 *   speechText  – text to display in the speech bubble above the avatar's head
 */
export default function SceneCanvas({ avatarUrl, transform, speechText }) {
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
  const loaderRef = useRef(null);

  // Expose renderer/camera to SpeechBubble via state once scene is ready
  const [renderCtx, setRenderCtx] = useState(null);

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
    loaderRef.current = gltfLoader;

    // Pre-load idle animation clip
    gltfLoader.load(
      '/animation.glb',
      (gltf) => {
        if (gltf.animations?.length) {
          idleClipRef.current = gltf.animations[0];
          // Apply to already-loaded avatar if it arrived first
          if (avatarRef.current && mixerRef.current) {
            mixerRef.current.clipAction(idleClipRef.current).play();
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Avatar loading (when URL changes) ───────────────────────────── */
  useEffect(() => {
    if (!avatarUrl || !sceneRef.current || !loaderRef.current) return;

    // Remove old avatar
    if (avatarRef.current) {
      sceneRef.current.remove(avatarRef.current);
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      avatarRef.current = null;
    }

    loaderRef.current.load(
      avatarUrl,
      (gltf) => {
        const model = gltf.scene;

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

        if (idleClipRef.current) {
          mixer.clipAction(idleClipRef.current).play();
        } else if (gltf.animations?.length) {
          mixer.clipAction(gltf.animations[0]).play();
        }
      },
      undefined,
      (err) => console.error('GLTFLoader error:', err)
    );
  }, [avatarUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Transform updates (live sliders) ────────────────────────────── */
  useEffect(() => {
    if (!avatarRef.current || !transform) return;
    applyTransform(avatarRef.current, transform);
  }, [transform]);

  return (
    <div ref={containerRef} className="relative flex-1 w-full h-full overflow-hidden">
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
