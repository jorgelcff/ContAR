import { create } from 'zustand';

const LAST_AVATAR_URL_KEY = 'avaturn:lastAvatarUrl';

function getInitialAvatarUrl() {
  try {
    return localStorage.getItem(LAST_AVATAR_URL_KEY) || '';
  } catch {
    return '';
  }
}

// Slices pattern
const createAvatarSlice = (set, get) => ({
  avatarUrl: getInitialAvatarUrl(),
  transform: {
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    rotationY: 0,
    scale: 1,
  },
  posePreset: 'idle',
  
  setAvatarUrl: (url) => {
    try {
      if (url) {
        localStorage.setItem(LAST_AVATAR_URL_KEY, url);
      } else {
        localStorage.removeItem(LAST_AVATAR_URL_KEY);
      }
    } catch {}
    set({ avatarUrl: url });
  },
  setTransform: (key, value) => 
    set((state) => ({ transform: { ...state.transform, [key]: value } })),
  setPosePreset: (preset) => set({ posePreset: preset }),
});

const createSpeechSlice = (set) => ({
  speechText: '',
  setSpeechText: (text) => set({ speechText: text }),
  clearSpeech: () => set({ speechText: '' }),
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

  setSceneTitle: (title) => set({ sceneTitle: title }),
  setStoryTitle: (title) => set({ storyTitle: title }),
  setStoryDescription: (desc) => set({ storyDescription: desc }),
  setStoryScenes: (scenesConfig) => set((state) => ({ 
    storyScenes: typeof scenesConfig === 'function' ? scenesConfig(state.storyScenes) : scenesConfig 
  })),
  addStoryScene: (sceneId, transitionText = '', durationSeconds = 8) => set((state) => ({
    storyScenes: [...state.storyScenes, { sceneId, transitionText, durationSeconds }]
  })),
  removeStoryScene: (index) => set((state) => ({
    storyScenes: state.storyScenes.filter((_, i) => i !== index)
  })),
  updateStoryScene: (index, key, value) => set((state) => ({
    storyScenes: state.storyScenes.map((item, i) => {
      if (i !== index) return item;
      if (key === 'durationSeconds') {
        return { ...item, durationSeconds: Math.max(0, Number(value) || 0) };
      }
      return { ...item, [key]: value };
    })
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
    sceneTitlesById: typeof titles === 'function' ? titles(state.sceneTitlesById) : { ...state.sceneTitlesById, ...titles }
  })),
  setCurrentSceneId: (id) => set({ currentSceneId: id }),
  setCurrentStoryId: (id) => set({ currentStoryId: id }),
  setPublishedStoryId: (id) => set({ publishedStoryId: id }),

  buildScenePayload: (existingId) => {
    const { sceneTitle, avatarUrl, posePreset, transform, speechText } = get();
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
          audioUrl: '', // This will be extended when we refactor audio
          bubbleStyle: { color: '#ffffff', fontSize: 14 },
        },
      },
    };
  }
});

export const useSceneStore = create((...args) => ({
  ...createAvatarSlice(...args),
  ...createSpeechSlice(...args),
  ...createStorySlice(...args),
}));
