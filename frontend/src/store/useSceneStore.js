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
  transform: { positionX: 0, positionY: 0, positionZ: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1 },
  posePreset: 'idle',
  animSpeed: 1,
  animLoopOnce: false,
  vrmExpression: '',
  // Custom .vrma animation for this scene. Lives here rather than in component
  // state so it is saved with the scene like every other avatar setting.
  vrmaUrl: '',
  setAvatarUrl: (url) => set({ avatarUrl: url }),
  setVrmaUrl: (url) => set({ vrmaUrl: url }),
  setTransform: (key, value) =>
    set((state) => ({ transform: { ...state.transform, [key]: value } })),
  setFullTransform: (t) => set({
    transform: { positionX: 0, positionY: 0, positionZ: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1, ...t },
  }),
  setPosePreset: (preset) => set({ posePreset: preset }),
  setAnimSpeed: (speed) => set({ animSpeed: Math.max(0.1, Math.min(4, Number(speed) || 1)) }),
  setAnimLoopOnce: (v) => set({ animLoopOnce: Boolean(v) }),
  setVrmExpression: (expr) => set({ vrmExpression: expr }),
});

const createSpeechSlice = (set, get) => ({
  // ── Narration, per language ─────────────────────────────────────────────
  // `narrations` is the authoritative store: every language the scene has,
  // each with its own text and its own recording. `speechText` and
  // `narrativeAudioUrl` stay as the working copy of whichever language is
  // being edited, so every control that already reads them — the speech
  // bubble, the audio panel, the preview — keeps working untouched.
  narrations: {},
  narrationLanguage: 'pt',  // which language the scene was authored in
  editingLanguage: 'pt',    // which one the Fala tab is pointed at right now

  speechText: '',
  narrativeAudioUrl: '',
  // How narration text is shown over the avatar: 'bubble' | 'subtitle' | 'none'.
  // Persisted per scene so the editor, story viewer and AR all render the same way.
  textDisplayMode: 'bubble',

  setSpeechText: (text) => set((state) => ({
    speechText: text,
    narrations: { ...state.narrations, [state.editingLanguage]: {
      ...(state.narrations[state.editingLanguage] || {}), text,
    } },
  })),
  setNarrativeAudioUrl: (url) => set((state) => ({
    narrativeAudioUrl: url,
    narrations: { ...state.narrations, [state.editingLanguage]: {
      ...(state.narrations[state.editingLanguage] || {}), audioUrl: url,
    } },
  })),
  setTextDisplayMode: (mode) => set({ textDisplayMode: mode }),
  clearSpeech: () => set((state) => ({
    speechText: '',
    narrativeAudioUrl: '',
    narrations: { ...state.narrations, [state.editingLanguage]: { text: '', audioUrl: '' } },
  })),

  /** Point the Fala tab at another language, loading whatever it already has. */
  setEditingLanguage: (language) => set((state) => {
    const entry = state.narrations[language] || {};
    return {
      editingLanguage: language,
      speechText: entry.text || '',
      narrativeAudioUrl: entry.audioUrl || '',
    };
  }),

  /** Which language the scene was authored in; the one everything falls back to. */
  setNarrationLanguage: (language) => set({ narrationLanguage: language }),

  /** Languages this scene actually has something in — drives the editor's chips. */
  filledNarrationLanguages: () => {
    const { narrations } = get();
    return Object.keys(narrations).filter((lang) => {
      const entry = narrations[lang] || {};
      return String(entry.text || '').trim() || String(entry.audioUrl || '').trim();
    });
  },
});

/**
 * Folds the per-language working set back into what the API stores: the
 * authored language as `text`/`audioUrl`, every other language under
 * `translations`. Languages with nothing in them are left out entirely — an
 * empty slot is one the editor happened to open, not a translation.
 */
function buildNarrative(state) {
  const { narrations, narrationLanguage, textDisplayMode } = state;
  const base = narrations[narrationLanguage] || {};
  const translations = {};

  for (const lang of Object.keys(narrations)) {
    if (lang === narrationLanguage) continue;
    const entry = narrations[lang] || {};
    const text = String(entry.text || '');
    const audioUrl = String(entry.audioUrl || '');
    if (!text.trim() && !audioUrl.trim()) continue;
    translations[lang] = { text, audioUrl };
  }

  return {
    text: String(base.text || ''),
    audioUrl: String(base.audioUrl || ''),
    language: narrationLanguage,
    translations,
    displayMode: textDisplayMode || 'bubble',
    bubbleStyle: { color: '#ffffff', fontSize: 14 },
  };
}

const createStorySlice = (set, get) => ({
  sceneTitle: '',
  storyTitle: '',
  storyDescription: '',
  storyScenes: [],
  sceneTitlesById: {},
  currentSceneId: '',
  currentStoryId: '',
  // Whether the current story is reachable via its public share link — set
  // from the server (loaded story / after a publish call), never assumed.
  isStoryPublic: false,
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
    storyScenes: [...state.storyScenes, { sceneId, transitionText, durationSeconds, markerUrl: '' }],
  })),
  /**
   * Puts a scene entry at a position rather than at the end — what duplicating
   * needs, since a copy belongs beside its original and not after everything.
   * Carries the whole entry, so the copy keeps the pacing and the marker the
   * original had.
   */
  insertStoryScene: (index, entry) => set((state) => {
    const next = [...state.storyScenes];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, {
      transitionText: '', durationSeconds: 8, markerUrl: '', ...entry,
    });
    return { storyScenes: next };
  }),
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
  setIsStoryPublic: (v) => set({ isStoryPublic: Boolean(v) }),

  // Clears the avatar/speech/scene fields left over from whatever was being
  // edited before, so "new scene" / "new story" entry points start from a
  // blank scene instead of inheriting the previous one (avatar, narration
  // text and audio, transform, etc). Story-level fields (title, description,
  // scene list) are intentionally left alone — callers reset those too when
  // starting a brand-new story.
  // `keepCharacter` carries the avatar and how it is staged (pose, placement,
  // animation settings) into the next scene, clearing only what is specific to
  // the scene being left behind. Chaining scenes in one story almost always
  // means the same narrator, so re-picking the avatar every time is busywork —
  // whereas starting a standalone scene should begin from nothing.
  resetSceneForNew: ({ keepCharacter = false } = {}) => set({
    ...(keepCharacter ? {} : {
      avatarUrl: '',
      transform: { positionX: 0, positionY: 0, positionZ: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1 },
      posePreset: 'idle',
      animSpeed: 1,
      animLoopOnce: false,
      vrmExpression: '',
      textDisplayMode: 'bubble',
    }),
    // Always cleared — these describe the scene that was just finished.
    speechText: '',
    narrativeAudioUrl: '',
    narrations: {},
    editingLanguage: get().narrationLanguage,
    sceneTitle: '',
    currentSceneId: '',
    timelineBlocks: [],
    timelineDuration: 10,
  }),

  buildScenePayload: (existingId) => {
    const { sceneTitle, avatarUrl, posePreset, transform, timelineBlocks, timelineDuration, animSpeed, animLoopOnce, vrmExpression, vrmaUrl } = get();
    return {
      sceneId: existingId !== undefined ? existingId : (get().currentSceneId || undefined),
      metadata: { title: sceneTitle || 'Untitled Scene', theme: '' },
      content: {
        avatar: {
          modelUrl: avatarUrl,
          posePreset,
          // How the pose actually plays. Without these a scene reopened (or
          // opened by a viewer) silently fell back to the defaults, no matter
          // what was set when it was authored.
          animSpeed,
          animLoopOnce,
          vrmExpression,
          // Blob URLs die with the page, so only a real uploaded URL is worth
          // persisting — see handleLoadVrma in EditorPage.
          vrmaUrl: sanitizeUrl(vrmaUrl),
          transform: {
            position: [transform.positionX, transform.positionY, transform.positionZ],
            rotation: [
              ((transform.rotationX ?? 0) * Math.PI) / 180,
              ((transform.rotationY ?? 0) * Math.PI) / 180,
              ((transform.rotationZ ?? 0) * Math.PI) / 180,
            ],
            scale: [transform.scale, transform.scale, transform.scale],
          },
        },
        narrative: buildNarrative(get()),
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
        // avatarUrl is intentionally excluded — scene data is always loaded from
        // the API via sceneId, and persisting it caused stale-state races on F5.
        posePreset: state.posePreset,
        transform: state.transform,
        speechText: state.speechText,
        narrativeAudioUrl: sanitizeUrl(state.narrativeAudioUrl),
        narrations: state.narrations,
        narrationLanguage: state.narrationLanguage,
        editingLanguage: state.editingLanguage,
        textDisplayMode: state.textDisplayMode,
        sceneTitle: state.sceneTitle,
        currentSceneId: state.currentSceneId,
        storyTitle: state.storyTitle,
        storyDescription: state.storyDescription,
        currentStoryId: state.currentStoryId,
        isStoryPublic: state.isStoryPublic,
        storyScenes: state.storyScenes,
        sceneTitlesById: state.sceneTitlesById,
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
