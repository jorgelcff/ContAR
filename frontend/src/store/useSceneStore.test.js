import { describe, it, expect, afterEach } from 'vitest';
import { useSceneStore } from './useSceneStore';

// Zustand stores are module-level singletons — snapshot the pristine state
// once so every test can restore it, instead of tests leaking into each other.
const initialState = useSceneStore.getState();

afterEach(() => {
  useSceneStore.setState(initialState, true);
  localStorage.clear();
});

describe('story scene list', () => {
  it('addStoryScene appends with sane defaults', () => {
    useSceneStore.getState().addStoryScene('scene-1');
    const { storyScenes } = useSceneStore.getState();

    expect(storyScenes).toHaveLength(1);
    expect(storyScenes[0]).toMatchObject({
      sceneId: 'scene-1',
      transitionText: '',
      durationSeconds: 8,
      markerUrl: '',
    });
  });

  it('updateStoryScene edits only the targeted index', () => {
    const store = useSceneStore.getState();
    store.addStoryScene('scene-1');
    store.addStoryScene('scene-2');

    useSceneStore.getState().updateStoryScene(1, 'transitionText', 'Meanwhile...');
    const { storyScenes } = useSceneStore.getState();

    expect(storyScenes[0].transitionText).toBe('');
    expect(storyScenes[1].transitionText).toBe('Meanwhile...');
  });

  it('updateStoryScene clamps durationSeconds to a non-negative number', () => {
    useSceneStore.getState().addStoryScene('scene-1');
    useSceneStore.getState().updateStoryScene(0, 'durationSeconds', -5);
    expect(useSceneStore.getState().storyScenes[0].durationSeconds).toBe(0);

    useSceneStore.getState().updateStoryScene(0, 'durationSeconds', 'not-a-number');
    expect(useSceneStore.getState().storyScenes[0].durationSeconds).toBe(0);

    useSceneStore.getState().updateStoryScene(0, 'durationSeconds', 12);
    expect(useSceneStore.getState().storyScenes[0].durationSeconds).toBe(12);
  });

  it('removeStoryScene drops the item at the given index', () => {
    const store = useSceneStore.getState();
    store.addStoryScene('scene-1');
    store.addStoryScene('scene-2');
    store.removeStoryScene(0);

    const { storyScenes } = useSceneStore.getState();
    expect(storyScenes).toHaveLength(1);
    expect(storyScenes[0].sceneId).toBe('scene-2');
  });

  it('reorderStoryScenes moves an item from one position to another', () => {
    const store = useSceneStore.getState();
    store.addStoryScene('a');
    store.addStoryScene('b');
    store.addStoryScene('c');

    useSceneStore.getState().reorderStoryScenes(0, 2);
    const ids = useSceneStore.getState().storyScenes.map((s) => s.sceneId);
    expect(ids).toEqual(['b', 'c', 'a']);
  });

  it('reorderStoryScenes ignores out-of-range indices instead of corrupting the list', () => {
    const store = useSceneStore.getState();
    store.addStoryScene('a');
    store.addStoryScene('b');

    useSceneStore.getState().reorderStoryScenes(0, 5);
    const ids = useSceneStore.getState().storyScenes.map((s) => s.sceneId);
    expect(ids).toEqual(['a', 'b']);
  });
});

describe('resetSceneForNew', () => {
  it('clears avatar/speech fields but preserves story-level fields', () => {
    const store = useSceneStore.getState();
    store.setAvatarUrl('https://example.com/avatar.glb');
    store.setSpeechText('Hello there');
    store.setSceneTitle('My Scene');
    store.setStoryTitle('My Story');
    store.addStoryScene('scene-1');

    useSceneStore.getState().resetSceneForNew();
    const state = useSceneStore.getState();

    expect(state.avatarUrl).toBe('');
    expect(state.speechText).toBe('');
    expect(state.sceneTitle).toBe('');
    // Story-level fields are intentionally untouched by a per-scene reset.
    expect(state.storyTitle).toBe('My Story');
    expect(state.storyScenes).toHaveLength(1);
  });
});

describe('buildScenePayload', () => {
  it('converts transform rotation from degrees to radians', () => {
    useSceneStore.getState().setFullTransform({ rotationY: 90 });
    const payload = useSceneStore.getState().buildScenePayload();

    expect(payload.content.avatar.transform.rotation[1]).toBeCloseTo(Math.PI / 2, 5);
  });

  it('defaults an empty scene title to "Untitled Scene"', () => {
    const payload = useSceneStore.getState().buildScenePayload();
    expect(payload.metadata.title).toBe('Untitled Scene');
  });

  it('uses the explicit sceneId argument over currentSceneId when provided', () => {
    useSceneStore.getState().setCurrentSceneId('current-id');
    const payload = useSceneStore.getState().buildScenePayload('explicit-id');
    expect(payload.sceneId).toBe('explicit-id');
  });

  it('falls back to currentSceneId when no argument is given', () => {
    useSceneStore.getState().setCurrentSceneId('current-id');
    const payload = useSceneStore.getState().buildScenePayload();
    expect(payload.sceneId).toBe('current-id');
  });
});
