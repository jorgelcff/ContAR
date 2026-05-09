import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const STORE_KEY = 'contar:scene-store';
const LEGACY_AVATAR_KEY = 'avaturn:lastAvatarUrl';

let _hadLocalAvatarOnInit = false;
export function hadLocalAvatarOnInit() {
  const had = _hadLocalAvatarOnInit;
  _hadLocalAvatarOnInit = false;
  return had;
}

function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('blob:')) return '';
  return url;
}

const createAvatarSlice = (set) => ({
  avatarUrl: '',
  transform: { positionX: 0, positionY: 0, positionZ: 0, rotationY: 0, scale: 1 },
  posePreset: 'idle',
  setAvatarUrl: (url) => set({ avatarUrl: url }),
  setTransform: (key, value) =>
    set((state) => ({ transform: { ...state.transform, [key]: value } })),
  setPosePreset: (preset) => set({ posePreset: preset }),
});

const createSpeechSlice = (set) => ({
  speechText: '',
  narrativeAudioUrl: '',
  setSpeechText: (text) => set({ speechText: text }),
  setNarrativeAudioUrl: (url) => set({ narrativeAudioUrl: url }),
  clearSpeech: () => set({ speechText: '', narrativeAudioUrl: '' }),
});

const createStorySlice = (set, get) => ({
  sceneTitle: '',
  storyTitle: '',
  storyDescription: '',
  storyScenes: [],
  sceneTitlesById: {},
  currentSceneId: '',
  currentStoryId: '',
  publishedStoryId: '',
  timelineBlocks: [],
  timelineDuration: 10,

  setSceneTitle: (title) => set({ sceneTitle: title }),
  setStoryTitle: (title) => set({ storyTitle: title }),
  setStoryDescription: (desc) => set({ storyDescription: desc }),

  addTimelineBlock: (block) => set((state) => {
    const newBlock = {
      id: crypto.randomUUID(),
      type: block.type || 'action',
      startSec: block.startSec ?? 0,
      endSec: block.endSec ?? 2,
      ref: block.ref || '',
      ...block,
    };
    return { timelineBlocks: [...state.timelineBlocks, newBlock] };
  }),
  updateTimelineBlock: (id, updates) => set((state) => ({
    timelineBlocks: state.timelineBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
  })),
  removeTimelineBlock: (id) => set((state) => ({
    timelineBlocks: state.timelineBlocks.filter((b) => b.id !== id),
  })),
  setTimelineDuration: (duration) => set({ timelineDuration: Math.max(1, duration) }),

  setStoryScenes: (scenesConfig) => set((state) => ({
    storyScenes: typeof scenesConfig === 'function' ? scenesConfig(state.storyScenes) : scenesConfig,
  })),
  addStoryScene: (sceneId, transitionText = '', durationSeconds = 8) => set((state) => ({
    storyScenes: [...state.storyScenes, { sceneId, transitionText, durationSeconds }],
  })),
  removeStoryScene: (index) => set((state) => ({
    storyScenes: state.storyScenes.filter((_, i) => i !== index),
  })),
  updateStoryScene: (index, key, value) => set((state) => ({
    storyScenes: state.storyScenes.map((item, i) => {
      if (i !== index) return item;
      if (key === 'durationSeconds') return { ...item, durationSeconds: Math.max(0, Number(value) || 0) };
      return { ...item, [key]: value };
    }),
  })),
  reorderStoryScenes: (from, to) => set((state) => {
    const prev = state.storyScenes;
    if (from < 0 || to < 0 || from >= prev.length || to >= prev.length) return { storyScenes: prev };
    const next = [...prev];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return { storyScenes: next };
  }),
  setSceneTitlesById: (titles) => set((state) => ({
    sceneTitlesById: typeof titles === 'function' ? titles(state.sceneTitlesById) : { ...state.sceneTitlesById, ...titles },
  })),
  setCurrentSceneId: (id) => set({ currentSceneId: id }),
  setCurrentStoryId: (id) => set({ currentStoryId: id }),
  setPublishedStoryId: (id) => set({ publishedStoryId: id }),

  buildScenePayload: (existingId) => {
    const { sceneTitle, avatarUrl, posePreset, transform, speechText, narrativeAudioUrl, timelineBlocks, timelineDuration } = get();
    return {
      sceneId: existingId !== undefined ? existingId : (get().currentSceneId || undefined),
      metadata: { title: sceneTitle || 'Untitled Scene', theme: '' },
      content: {
        avatar: {
          modelUrl: avatarUrl,
          posePreset,
          transform: {
            position: [transform.positionX, transform.positionY, transform.positionZ],
            rotation: [0, (transform.rotationY * Math.PI) / 180, 0],
            scale: [transform.scale, transform.scale, transform.scale],
          },
        },
        narrative: {
          text: speechText,
          audioUrl: narrativeAudioUrl || '',
          bubbleStyle: { color: '#ffffff', fontSize: 14 },
        },
        timeline: {
          duration: timelineDuration,
          blocks: timelineBlocks,
        },
      },
    };
  },
});

export const useSceneStore = create(
  persist(
    (...args) => ({
      ...createAvatarSlice(...args),
      ...createSpeechSlice(...args),
      ...createStorySlice(...args),
    }),
    {
      name: STORE_KEY,
      partialize: (state) => ({
        avatarUrl: sanitizeUrl(state.avatarUrl),
        posePreset: state.posePreset,
        transform: state.transform,
        speechText: state.speechText,
        narrativeAudioUrl: sanitizeUrl(state.narrativeAudioUrl),
        sceneTitle: state.sceneTitle,
        currentSceneId: state.currentSceneId,
        storyTitle: state.storyTitle,
        storyDescription: state.storyDescription,
        currentStoryId: state.currentStoryId,
        storyScenes: state.storyScenes,
        timelineBlocks: state.timelineBlocks,
        timelineDuration: state.timelineDuration,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Discard any blob URL that somehow got persisted
        if (state.avatarUrl?.startsWith('blob:')) {
          state.avatarUrl = '';
          _hadLocalAvatarOnInit = true;
        }

        // Migrate from old localStorage key (one-time)
        try {
          const legacy = localStorage.getItem(LEGACY_AVATAR_KEY) || '';
          if (legacy && !legacy.startsWith('blob:') && !state.avatarUrl) {
            state.avatarUrl = legacy;
          }
          localStorage.removeItem(LEGACY_AVATAR_KEY);
        } catch { /* ignore */ }
      },
    }
  )
);
