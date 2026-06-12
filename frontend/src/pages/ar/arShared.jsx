/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { getPublicStory, getScene } from '../../api/sceneApi';
import { BoneMapper } from '../../utils/BoneMapper';
import { AnimationController } from '../../controllers/AnimationController';
import { applyPosePreset } from '../../utils/posePresets';

export const AR_SCALE_KEY = 'contar:ar-scale';
export const AR_SCALE_DEFAULT = 1.0;

export function readSavedScale() {
  const v = parseFloat(localStorage.getItem(AR_SCALE_KEY));
  return Number.isFinite(v) && v > 0 ? v : AR_SCALE_DEFAULT;
}

export function saveScale(v) {
  localStorage.setItem(AR_SCALE_KEY, String(v));
}

export function normalizeAvatarUrl(url) {
  if (typeof url !== 'string') return '';
  const value = url.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || /^data:/i.test(value) || /^blob:/i.test(value)) {
    return value;
  }
  return value;
}

export function disposeObject3D(object) {
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

export function fitModelToGround(model) {
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

// When playing a story, each scene can specify its own avatar — falls back
// to the page-level modelUrl (e.g. the user's saved avatar) outside of story
// mode or once the story's scenes have no avatar override.
export function resolveSceneAvatarUrl(story, storyId, fallbackUrl) {
  if (storyId && story.currentScene?.content?.avatar?.modelUrl) {
    return story.currentScene.content.avatar.modelUrl;
  }
  return fallbackUrl;
}

// Same idea for the pose: a story scene's pose preset overrides the page-level
// pose (and defaults to "idle" so AR matches the editor's default).
export function resolveScenePosePreset(story, storyId, fallback) {
  if (storyId && story.currentScene?.content?.avatar?.posePreset) {
    return story.currentScene.content.avatar.posePreset;
  }
  return fallback || 'idle';
}

// How narration text is shown ('bubble' | 'subtitle' | 'none'): a story scene's
// saved displayMode wins, else the page-level mode, defaulting to subtitle in AR
// (a bottom caption reads better over a camera feed than a floating bubble).
export function resolveSceneDisplayMode(story, storyId, fallback) {
  if (storyId && story.currentScene?.content?.narrative?.displayMode) {
    return story.currentScene.content.narrative.displayMode;
  }
  return fallback || 'subtitle';
}

// On-screen narration overlay for AR (the editor's 3D-tracked bubble can't be
// reused over a camera feed). 'subtitle' → bottom caption, 'bubble' → a speech
// bubble higher up, 'none' → nothing. Sits above the bottom control bar.
export function ARNarration({ mode, text }) {
  if (!text || mode === 'none') return null;

  if (mode === 'bubble') {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-48 z-20 flex justify-center px-4">
        <div className="relative max-w-xs rounded-2xl bg-white px-4 py-2.5 text-center text-sm font-medium text-gray-900 shadow-xl">
          {text}
          <span className="absolute -bottom-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-8 border-x-transparent border-t-8 border-t-white" />
        </div>
      </div>
    );
  }

  // subtitle (default)
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-44 z-20 flex justify-center px-4">
      <div className="max-w-lg rounded-lg bg-black/70 px-4 py-2 text-center text-sm font-medium text-white backdrop-blur-sm">
        {text}
      </div>
    </div>
  );
}

// Loads the shared animation manifest (walk/dance/run/speaker… clips) once and
// caches it across AR scenes. Mirrors SceneCanvas's manifest loading so AR
// animated poses look identical to the editor. Returns { preset: AnimationClip }.
let _arManifestPromise = null;
export function loadAnimationManifest(gltfLoader) {
  if (_arManifestPromise) return _arManifestPromise;
  const PRESETS = ['idle', 'walk', 'walk_circle', 'slow_run', 'run', 'dance', 'speaker'];
  _arManifestPromise = fetch('/animations/manifest.json')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((manifest) => {
      if (!Array.isArray(manifest?.animations)) return {};
      const external = {};
      return Promise.all(
        manifest.animations.map((anim) => new Promise((resolve) => {
          if (!anim.file) return resolve();
          gltfLoader.load(
            `/animations/${anim.file}`,
            (g) => {
              const clip = g.animations?.[0];
              if (!clip) return resolve();
              const preset = anim.preset || anim.name || '';
              clip.name = preset || clip.name || anim.file;
              const tags = Array.isArray(anim.tags) ? anim.tags : [];
              if (preset && !external[preset]) external[preset] = clip;
              for (const p of PRESETS) {
                if (!external[p] && tags.some((tag) => String(tag).toLowerCase().includes(p))) {
                  external[p] = clip;
                }
              }
              resolve();
            },
            undefined,
            () => resolve(), // skip missing/broken files
          );
        }))
      ).then(() => external);
    });
  return _arManifestPromise;
}

// Wraps an avatar's BoneMapper + AnimationController and applies pose presets,
// so an AR scene can animate/pose the avatar exactly like the editor 3D view.
// Host must call update(delta) each frame and dispose() on teardown.
export class ARPoseRig {
  constructor(gltf, model) {
    this.model = model;
    this.boneMapper = BoneMapper.fromGLTF(gltf);
    this.avatarClips = Array.isArray(gltf.animations) ? [...gltf.animations] : [];
    this.idleClip = this.avatarClips[0] || null;
    this.externalClips = {};
    this.controller = new AnimationController(model, this.avatarClips, this.boneMapper);
    this.preset = 'idle';
  }

  apply(preset) {
    this.preset = preset || 'idle';
    applyPosePreset(
      this.model,
      this.controller,
      this.idleClip,
      this.avatarClips,
      this.preset,
      this.boneMapper,
      this.externalClips,
    );
  }

  // Merge manifest clips so animated presets (walk/dance/…) resolve, then
  // re-apply the current pose in case it depended on a now-available clip.
  setExternalClips(external) {
    this.externalClips = external || {};
    const clips = Object.values(this.externalClips);
    for (const clip of clips) {
      if (!this.avatarClips.some((c) => c.name === clip.name)) this.avatarClips.push(clip);
    }
    if (clips.length) this.controller.addClips(clips);
    this.apply(this.preset);
  }

  update(delta) {
    this.controller?.update(delta);
  }

  dispose() {
    this.controller?.dispose?.();
    this.controller = null;
  }
}

export function buildQueryUrl(path, params) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return `${url.pathname}${url.search}${url.hash}`;
}

// Returns a GLTFLoader pre-configured with Draco compression + VRM support,
// matching the setup shared by every AR scene that loads avatar models.
export function createAvatarGLTFLoader() {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.setCrossOrigin('anonymous');
  gltfLoader.register((parser) => new VRMLoaderPlugin(parser)); // VRM support
  return gltfLoader;
}

// ── Story player hook ─────────────────────────────────────────────────────────
// Manages story state and an <audio> element (rendered by the host component).
// Host must render: <audio ref={story.audioRef} crossOrigin="anonymous" />
export function useARStory(storyId) {
  const audioRef = useRef(null);
  const [story, setStory] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [index, setIndex] = useState(0);
  const [currentScene, setCurrentScene] = useState(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyError, setStoryError] = useState('');

  // Reset/prime story state synchronously when storyId changes (avoids a
  // setState-in-effect cascade — the effect below only handles the fetch).
  const [prevStoryId, setPrevStoryId] = useState();
  if (storyId !== prevStoryId) {
    setPrevStoryId(storyId);
    if (!storyId) {
      setStory(null);
      setScenes([]);
      setCurrentScene(null);
    } else {
      setStoryLoading(true);
      setStoryError('');
    }
  }

  useEffect(() => {
    if (!storyId) return;
    let active = true;
    getPublicStory(storyId)
      .then((data) => {
        if (!active) return;
        setStory(data);
        const ordered = [...(data.scenes || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setScenes(ordered);
        setIndex(0);
        setHasStarted(false);
        setIsPlaying(false);
      })
      .catch((err) => { if (active) setStoryError(err?.response?.data?.error || 'Erro ao carregar história'); })
      .finally(() => { if (active) setStoryLoading(false); });
    return () => { active = false; };
  }, [storyId]);

  const sceneId = scenes[index]?.sceneId;
  const [prevSceneId, setPrevSceneId] = useState(sceneId);
  if (sceneId !== prevSceneId) {
    setPrevSceneId(sceneId);
    if (!sceneId) setCurrentScene(null);
  }

  useEffect(() => {
    if (!sceneId) return;
    let active = true;
    getScene(sceneId)
      .then((d) => { if (active) setCurrentScene(d); })
      .catch(() => { if (active) setCurrentScene(null); });
    return () => { active = false; };
  }, [sceneId]);

  // Load + play audio when scene changes (after start)
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !hasStarted) return;
    const audioUrl = currentScene?.content?.narrative?.audioUrl;
    if (audioUrl) {
      el.src = audioUrl;
      el.load();
      el.play().catch(() => {});
    } else {
      el.pause();
      el.src = '';
      // No audio — auto-advance after scene duration
      const dur = Math.max(2, Number(scenes[index]?.durationSeconds) || 5) * 1000;
      const tid = setTimeout(() => setIndex((i) => Math.min(i + 1, scenes.length - 1)), dur);
      return () => clearTimeout(tid);
    }
  }, [currentScene, hasStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance when audio ends
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => setIndex((i) => {
      const next = i + 1;
      if (next < scenes.length) return next;
      setIsPlaying(false);
      return i;
    });
    el.addEventListener('ended', onEnded);
    return () => el.removeEventListener('ended', onEnded);
  }, [scenes.length]);

  // start() must be called directly in a click handler to satisfy autoplay policy
  const start = (onUnlock) => {
    const el = audioRef.current;
    if (el) el.play().catch(() => {}); // unlock audio context
    if (onUnlock) onUnlock();
    setHasStarted(true);
    setIsPlaying(true);
  };

  const next = () => setIndex((i) => Math.min(i + 1, scenes.length - 1));
  const prev = () => setIndex((i) => Math.max(i - 1, 0));
  const togglePlay = () => {
    const el = audioRef.current;
    setIsPlaying((p) => {
      if (el) { p ? el.pause() : el.play().catch(() => {}); }
      return !p;
    });
  };

  return { story, scenes, currentScene, index, hasStarted, isPlaying, storyLoading, storyError, audioRef, start, next, prev, togglePlay };
}

// ── Story player overlay (shared UI across modes) ─────────────────────────────
export function StoryOverlay({ story, storyId, compact = false, onStart }) {
  const { t } = useTranslation();
  if (!storyId || !story.story) return null;

  if (!story.hasStarted) {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 backdrop-blur-sm">
        <div className="mx-6 w-full max-w-sm rounded-2xl border border-white/10 bg-black/90 p-6 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300 mb-2">{t('arStoryInAr')}</p>
          <h2 className="text-xl font-bold text-white mb-1">{story.story?.metadata?.title}</h2>
          <p className="text-sm text-gray-400 mb-5">{t('arScenesCount', { count: story.scenes.length })}</p>
          <button
            onClick={onStart}
            className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.98] text-white font-semibold transition-all"
          >
            ▶ {t('arStartStory')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${compact ? 'absolute top-16 left-3 right-3 z-25' : ''} rounded-xl border border-white/10 bg-black/80 px-3 py-2.5 backdrop-blur-sm`}>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-cyan-300 font-medium truncate max-w-[75%]">
          {story.currentScene?.content?.narrative?.text
            ? `"${story.currentScene.content.narrative.text.slice(0, 55)}…"`
            : story.story?.metadata?.title}
        </p>
        <p className="text-xs text-gray-500 shrink-0 ml-2">{story.index + 1}/{story.scenes.length}</p>
      </div>
      <div className="h-1 bg-gray-700 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-cyan-400 transition-all duration-300"
          style={{ width: `${((story.index) / Math.max(1, story.scenes.length - 1)) * 100}%` }}
        />
      </div>
      <div className="flex gap-2">
        <button onClick={story.prev} disabled={story.index === 0}
          className="flex-1 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs text-white disabled:opacity-40">◀</button>
        <button onClick={story.togglePlay}
          className="flex-1 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-xs text-white font-semibold">
          {story.isPlaying ? '‖' : '▶'}
        </button>
        <button onClick={story.next} disabled={story.index >= story.scenes.length - 1}
          className="flex-1 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs text-white disabled:opacity-40">▶▶</button>
      </div>
    </div>
  );
}
