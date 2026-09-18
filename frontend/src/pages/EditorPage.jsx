import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import { normalizeAdvanceOn } from '../utils/sceneAdvance';
import { pickPreviewSource } from '../utils/scenePreview';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from '../components/ui/Header';
import LeftPanel from '../components/ui/LeftPanel';
import BottomNav from '../components/ui/BottomNav';
import Icon from '../components/ui/Icon';
import OnboardingOverlay, { shouldShowOnboarding } from '../components/ui/OnboardingOverlay';
import WalkthroughTour, { shouldShowTour } from '../components/ui/WalkthroughTour';
import StoryBuilderPanel from '../components/ui/StoryBuilderPanel';
import { useSceneStore, hadLocalAvatarOnInit } from '../store/useSceneStore';
import useAudio from '../hooks/useAudio';
import { useToast } from '../context/ToastContext';
import { getScene, getStory, saveScene, saveStory, publishStory, uploadAudio, deleteAudio } from '../api/sceneApi';

const SceneCanvas = lazy(() => import('../components/3d/SceneCanvas'));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function EditorPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { addToast } = useToast();
  // Tracks which sceneId was last loaded — string (not boolean) so navigating
  // between two scenes in the same session works correctly.
  const loadedSceneIdRef = useRef(null);
  // Tracks which storyId was already fetched from the DB this session. Editing a
  // scene navigates to /editor?sceneId=X&storyId=Y, which must NOT re-fetch and
  // overwrite the in-memory storyScenes (the user may have added scenes that
  // aren't persisted to the story yet) — that wiped the timeline on "Editar".
  const loadedStoryIdRef = useRef(null);
  const [sceneLoading, setSceneLoading] = useState(false);

  const {
    avatarUrl,
    transform,
    posePreset,
    vrmaUrl, setVrmaUrl,
    speechText,
    textDisplayMode, setTextDisplayMode,
    sceneTitle,
    storyTitle, setStoryTitle,
    storyDescription, setStoryDescription,
    storyScenes, setStoryScenes,
    sceneTitlesById, setSceneTitlesById,
    currentSceneId,
    currentStoryId, setCurrentStoryId,
    isStoryPublic, setIsStoryPublic,
    narrativeAudioUrl,
    buildScenePayload,
    timelineBlocks,
    animSpeed,
    animLoopOnce,
    vrmExpression,
  } = useSceneStore();

  // Persists newly generated/uploaded/recorded narration audio to Cloudinary,
  // points the scene's narrativeAudioUrl at it, and removes the previous
  // narration file (if any) so regenerating audio doesn't leave orphaned
  // uploads behind.
  const persistGeneratedAudio = async (blob) => {
    const previousUrl = useSceneStore.getState().narrativeAudioUrl;
    try {
      const url = await uploadAudio(blob);
      useSceneStore.getState().setNarrativeAudioUrl(url);
      if (previousUrl && previousUrl !== url) {
        deleteAudio(previousUrl).catch(() => {});
      }
    } catch {
      addToast(t('epAudioUploadFailed'), 'error');
    }
  };

  const audio = useAudio({ onAudioBlob: persistGeneratedAudio });

  // ── Run the scene, in place ───────────────────────────────────
  // Everything needed to play a scene is already on screen; what was missing
  // was something to start it from the top. Seeing it meant saving and opening
  // the viewer in another tab.
  const previewSource = pickPreviewSource({
    narrationAudioUrl: narrativeAudioUrl,
    speechText,
    webSpeechAvailable: typeof window !== 'undefined' && Boolean(window.speechSynthesis),
  });
  const isPreviewing = audio.isPlaying || audio.isSpeaking;

  const runScene = async () => {
    if (isPreviewing) {
      audio.stop();
      audio.stopWebSpeech();
      return;
    }
    if (previewSource === 'audio') {
      if (audio.audioUrl !== narrativeAudioUrl) audio.loadUrl(narrativeAudioUrl);
      audio.stop(); // rewind, so "run" always starts at the beginning
      await audio.play().catch(() => {});
      return;
    }
    if (previewSource === 'speech') audio.speakWithWebSpeech(speechText);
  };

  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding);
  const [showTour, setShowTour] = useState(() => !shouldShowOnboarding() && shouldShowTour());
  const [mobilePanelTab, setMobilePanelTab] = useState(null);
  // Names of animation clips embedded in the currently loaded avatar GLB,
  // surfaced by SceneCanvas so the panel can offer them for direct selection.
  const [avatarClips, setAvatarClips] = useState([]);
  const [jawApi, setJawApi] = useState(null);

  useEffect(() => {
    if (hadLocalAvatarOnInit()) {
      addToast(t('epLocalAvatarRemoved'), 'info', 5000);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [isAddingScene, setIsAddingScene] = useState(false);
  const [isStorySaving, setIsStorySaving] = useState(false);
  const [error, setError] = useState('');

  // ── Autosave ────────────────────────────────────────────────
  const [autosaveStatus, setAutosaveStatus] = useState(null); // null | 'saving' | Date
  // True while the current state differs from what's persisted (the 3s window
  // before autosave fires, or after a failed save) — surfaced as "Unsaved".
  const [isDirty, setIsDirty] = useState(false);
  const autosaveTimerRef = useRef(null);
  const pendingPayloadRef = useRef(null);
  // Signature (serialized payload) of the last state persisted to / loaded from
  // the server. Comparing against it tells real edits apart from the store
  // updates a scene load triggers, so opening a scene never flashes "Unsaved".
  const lastSavedSigRef = useRef(null);
  const autosaveEducatedRef = useRef(false);
  // updatedAt this editor is working from, sent with every save so the server
  // can tell us if another tab saved in the meantime instead of us quietly
  // overwriting it. Cleared on load; refreshed after each successful save.
  const baseUpdatedAtRef = useRef(null);
  // Set once a conflict is reported — autosave stops rather than fighting the
  // other tab and burying the user in toasts.
  const [saveConflict, setSaveConflict] = useState(false);

  useEffect(() => {
    // Only autosave when there is meaningful content to preserve
    const hasContent = Boolean(avatarUrl || speechText || sceneTitle);
    if (!hasContent) {
      pendingPayloadRef.current = null;
      return;
    }
    const payload = buildScenePayload(currentSceneId || undefined);
    const sig = JSON.stringify(payload);
    // Nothing actually changed vs the persisted/loaded state — stay "saved".
    if (sig === lastSavedSigRef.current) {
      pendingPayloadRef.current = null;
      setIsDirty(false);
      return;
    }
    if (saveConflict) {
      pendingPayloadRef.current = null;
      return;
    }
    pendingPayloadRef.current = payload;
    setIsDirty(true);
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      setAutosaveStatus('saving');
      try {
        const result = await saveScene({ ...payload, baseUpdatedAt: baseUpdatedAtRef.current });
        pendingPayloadRef.current = null;
        if (result?.sceneId && !currentSceneId) {
          useSceneStore.getState().setCurrentSceneId(result.sceneId);
        }
        const savedId = result?.sceneId || currentSceneId || undefined;
        lastSavedSigRef.current = JSON.stringify(
          useSceneStore.getState().buildScenePayload(savedId),
        );
        if (result?.updatedAt) baseUpdatedAtRef.current = result.updatedAt;
        setIsDirty(false);
        setAutosaveStatus(new Date());
        if (!autosaveEducatedRef.current) {
          autosaveEducatedRef.current = true;
          addToast(t('epAutosaveEducational'), 'info', 4000);
        }
      } catch (err) {
        setAutosaveStatus(null);
        const status = err?.response?.status;
        if (status === 409) {
          // Another tab (or device) saved this scene after we loaded it.
          // Keep what is on screen, stop writing, and let the user decide.
          setSaveConflict(true);
          setIsDirty(true);
          addToast(t('epSaveConflict'), 'warning', 12000);
        } else if (status === 401 || status === 403) {
          addToast(t('epAutosaveFailedAuth'), 'error', 7000);
        } else {
          addToast(t('epAutosaveFailed'), 'warning', 5000);
        }
      }
    }, 5000);
    return () => clearTimeout(autosaveTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarUrl, speechText, sceneTitle, posePreset, transform, timelineBlocks, currentSceneId, narrativeAudioUrl, textDisplayMode, animSpeed, animLoopOnce, vrmExpression, vrmaUrl, saveConflict]);

  // Flush a still-pending autosave when leaving the editor (e.g. clicking
  // "Minhas cenas" right after a change), so edits made within the 3s
  // debounce window aren't silently dropped.
  useEffect(() => () => {
    if (pendingPayloadRef.current) {
      // Sent with the base version like every other save. There is no component
      // left to report a conflict to, so it fails silently — but silently
      // declining to overwrite a newer save beats silently destroying it, and
      // in the ordinary single-tab case the versions match and this lands.
      saveScene({ ...pendingPayloadRef.current, baseUpdatedAt: baseUpdatedAtRef.current })
        .catch(() => {});
    }
  }, []);

  const isStoryLinked = Boolean(currentStoryId);
  // Route to the /ar mode menu (not straight to Surface AR) so the user can pick
  // a mode their device supports — Surface AR needs WebXR hit-test, which many
  // phones lack even when they report immersive-ar support.
  const arHref = avatarUrl ? `/ar?modelUrl=${encodeURIComponent(avatarUrl)}` : '/ar';

  // ── Load scene from ?sceneId= URL param ─────────────────────
  useEffect(() => {
    const sceneId = searchParams.get('sceneId') || '';
    if (!sceneId) return;
    if (loadedSceneIdRef.current === sceneId) return; // already loaded this scene
    loadedSceneIdRef.current = sceneId;

    // A different scene — nothing is in conflict yet, and there is no version
    // to base a save on until the fetch below returns one.
    setSaveConflict(false);
    baseUpdatedAtRef.current = null;

    // Stop and clear any audio/viseme timeline left over from the previous
    // scene — otherwise its generated narration keeps playing/lip-syncing
    // after switching to a different scene for editing.
    audio.reset();

    // Clear the store before fetching so autosave doesn't fire stale data from
    // the previous session while waiting for the network response.
    useSceneStore.setState({
      currentSceneId: sceneId,   // set immediately so autosave targets the right scene
      avatarUrl: '',
      speechText: '',
      sceneTitle: '',
      posePreset: 'idle',
      narrativeAudioUrl: '',
      textDisplayMode: 'bubble',
      // Reset with the rest: these used to survive here, so opening a second
      // scene inherited the previous one's playback settings.
      animSpeed: 1,
      animLoopOnce: false,
      vrmExpression: '',
      vrmaUrl: '',
    });

    setSceneLoading(true);
    getScene(sceneId)
      .then((data) => {
        if (!data) return;
        const avatar = data.content?.avatar || {};
        const narrative = data.content?.narrative || {};
        const pos = avatar.transform?.position || [0, 0, 0];
        const rot = avatar.transform?.rotation || [0, 0, 0];
        const scale = avatar.transform?.scale || [1, 1, 1];
        useSceneStore.setState({
          currentSceneId: data.sceneId,
          sceneTitle: data.metadata?.title || '',
          avatarUrl: avatar.modelUrl || '',
          posePreset: avatar.posePreset || 'idle',
          transform: {
            positionX: pos[0] ?? 0,
            positionY: pos[1] ?? 0,
            positionZ: pos[2] ?? 0,
            rotationX: ((rot[0] ?? 0) * 180) / Math.PI,
            rotationY: ((rot[1] ?? 0) * 180) / Math.PI,
            rotationZ: ((rot[2] ?? 0) * 180) / Math.PI,
            scale: scale[0] ?? 1,
          },
          speechText: narrative.text || '',
          narrativeAudioUrl: narrative.audioUrl || '',
          textDisplayMode: narrative.displayMode || 'bubble',
          animSpeed: Number(avatar.animSpeed) || 1,
          animLoopOnce: Boolean(avatar.animLoopOnce),
          vrmExpression: avatar.vrmExpression || '',
          vrmaUrl: avatar.vrmaUrl || '',
        });

        baseUpdatedAtRef.current = data.updatedAt || null;

        // The freshly loaded scene matches what's persisted — mark it clean so
        // the autosave effect doesn't flag it as unsaved right after opening.
        lastSavedSigRef.current = JSON.stringify(
          useSceneStore.getState().buildScenePayload(data.sceneId),
        );
        setIsDirty(false);
        setAutosaveStatus(null);

        // Load this scene's previously generated narration audio (if any) so
        // playback and lip sync reflect THIS scene, not whatever was loaded
        // before. The precise provider viseme timeline isn't persisted, so
        // fall back to the text-derived heuristic for lip sync.
        if (narrative.audioUrl) {
          audio.loadUrl(narrative.audioUrl);
          if (narrative.text) {
            audio.generateVisemeTimelineFromText(narrative.text);
          }
        }
      })
      .catch(() => addToast(t('epSceneNotFound'), 'error'))
      .finally(() => setSceneLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Load story from URL ──────────────────────────────────────
  useEffect(() => {
    const routeStoryId = searchParams.get('storyId') || '';
    // Captured before setCurrentStoryId below: whether the store was already
    // holding this same story, and scenes for it. "Concluir cena e adicionar à
    // história" only updates the store — nothing reaches the database until the
    // story is saved — so a remount (opening a scene from the scenes list, or a
    // reload) would otherwise overwrite those pending scenes with the database
    // copy that does not have them yet, and the user's work silently vanishes.
    const storeBefore = useSceneStore.getState();
    const hasPendingScenes =
      storeBefore.currentStoryId === routeStoryId && storeBefore.storyScenes.length > 0;

    if (routeStoryId !== currentStoryId) setCurrentStoryId(routeStoryId);
    if (!routeStoryId) return;
    // Only load each story from the DB once per mount. Without this, navigating
    // to edit a scene within the story re-fetches and clobbers any unsaved
    // scenes the user added to the timeline.
    if (loadedStoryIdRef.current === routeStoryId) return;
    loadedStoryIdRef.current = routeStoryId;

    getStory(routeStoryId)
      .then((data) => {
        setStoryTitle(data?.metadata?.title || '');
        setStoryDescription(data?.metadata?.description || '');
        setIsStoryPublic(Boolean(data?.isPublic));
        const scenes = Array.isArray(data?.scenes)
          ? [...data.scenes]
              .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
              .map((item) => ({
                sceneId: item?.sceneId || '',
                transitionText: item?.transitionText || '',
                durationSeconds: Number(item?.durationSeconds) || 0,
                advanceOn: normalizeAdvanceOn(item?.advanceOn),
                markerUrl: item?.markerUrl || '',
              }))
          : [];
        // Merge rather than replace: keep any scene the store already has for
        // this story that the database has not caught up with, appended after
        // the saved ones so the saved order still wins.
        if (hasPendingScenes) {
          const saved = new Set(scenes.map((s) => s.sceneId));
          const pending = storeBefore.storyScenes.filter(
            (s) => s.sceneId && !saved.has(s.sceneId),
          );
          setStoryScenes([...scenes, ...pending]);
        } else {
          setStoryScenes(scenes);
        }
        // Open the story's first scene for editing when entering a story
        // directly (no sceneId in the URL), so the editor isn't blank. The
        // scene-load effect picks up the added sceneId param.
        if (!searchParams.get('sceneId') && scenes[0]?.sceneId) {
          setSearchParams({ storyId: routeStoryId, sceneId: scenes[0].sceneId }, { replace: true });
        }
      })
      .catch((err) => setError(`${t('errorLoading')}: ${err.message}`));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, t]);

  // ── Load missing scene titles ────────────────────────────────
  useEffect(() => {
    const sceneIds = [...new Set(storyScenes.map((s) => s.sceneId).filter(Boolean))];
    const missing = sceneIds.filter((id) => !sceneTitlesById[id]);
    if (!missing.length) return;
    let active = true;
    Promise.all(
      missing.map(async (id) => {
        try { const s = await getScene(id); return [id, String(s?.metadata?.title || '').trim() || id]; }
        catch { return [id, id]; }
      })
    ).then((entries) => {
      if (!active) return;
      setSceneTitlesById((prev) => {
        const next = { ...prev };
        entries.forEach(([id, title]) => { next[id] = title; });
        return next;
      });
    });
    return () => { active = false; };
  }, [storyScenes, sceneTitlesById, setSceneTitlesById]);

  // ── Keep timeline in sync with live scene title edits ────────
  useEffect(() => {
    if (!currentSceneId) return;
    setSceneTitlesById((prev) => {
      const current = prev[currentSceneId];
      const next = sceneTitle?.trim() || '';
      if (current === next) return prev;
      return { ...prev, [currentSceneId]: next };
    });
  }, [currentSceneId, sceneTitle, setSceneTitlesById]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleAddCurrentSceneToStory = async () => {
    // Guard against double-click creating multiple blank entries
    if (isAddingScene) return;
    setIsAddingScene(true);
    setError('');
    try {
      const store = useSceneStore.getState();
      const existingId = store.currentSceneId;
      const hadAudio = !!store.narrativeAudioUrl;

      // 1. Save current scene in-place (update, never create a copy).
      //    Only bother if there is actual content worth preserving.
      if (existingId || store.avatarUrl || store.speechText || store.sceneTitle) {
        try {
          const result = await saveScene({
            ...buildScenePayload(existingId || undefined),
            baseUpdatedAt: baseUpdatedAtRef.current,
          });
          // Keep the autosave's base in step, or its next write would
          // conflict with this one — from the very same tab.
          if (result?.updatedAt) baseUpdatedAtRef.current = result.updatedAt;
          const savedId = result?.sceneId;
          // If this scene wasn't in the story yet, add it (first-time add).
          if (savedId && !store.storyScenes.some((s) => s.sceneId === savedId)) {
            store.addStoryScene(savedId);
            store.setSceneTitlesById({ [savedId]: store.sceneTitle?.trim() || '' });
          }
        } catch {
          // Best-effort — don't block new scene creation on a save failure.
        }
      }

      // 2. Generate a fresh UUID for the new blank scene, reset editor.
      //    Deliberately NOT added to storyScenes yet — it has no content and
      //    was never saved to the backend. Adding it here used to leave a
      //    phantom, unloadable scene reference in the story the moment this
      //    button was clicked once and the user stopped (e.g. a one-scene
      //    story): step 1's logic above already adds a scene correctly (only
      //    once it has real, saved content), and this new blank scene will
      //    go through that same path the next time this button is clicked.
      const newSceneId = crypto.randomUUID();
      // Chaining scenes within a story keeps the narrator — only the narration
      // for the finished scene is cleared.
      store.resetSceneForNew({ keepCharacter: true });
      store.setCurrentSceneId(newSceneId);

      // 3. Pre-mark as "loaded" so the scene-load effect doesn't try to GET
      //    this UUID from the server (it doesn't exist yet — first edit/autosave
      //    will create it via upsert).
      loadedSceneIdRef.current = newSceneId;

      // 4. Update URL so the address bar reflects the new scene and a refresh
      //    lands back here (once it's been saved at least once).
      const params = new URLSearchParams(searchParams);
      params.set('sceneId', newSceneId);
      setSearchParams(params, { replace: false });

      const n = useSceneStore.getState().storyScenes.length;
      addToast(t('epSceneAddedClear', { n }), 'success', 3000);
      if (!hadAudio) {
        addToast(t('epSceneNoAudioWarning'), 'warning', 5000);
      }
    } catch (err) {
      setError(`${t('errorSaving')}: ${err.message}`);
      addToast(`Erro: ${err.message}`, 'error');
    } finally {
      setIsAddingScene(false);
    }
  };

  const handleAddSceneIdToStory = (sceneId) => {
    setError('');
    const { storyScenes: scenes, addStoryScene } = useSceneStore.getState();
    if (!sceneId || !UUID_RE.test(sceneId)) {
      addToast(t('invalidSceneId'), 'warning');
      return false;
    }
    if (scenes.some((item) => item.sceneId === sceneId)) {
      addToast(t('sceneAlreadyInStory'), 'warning');
      return false;
    }
    addStoryScene(sceneId);
    addToast(t('epSceneAdded'), 'success');
    return true;
  };

  const handleSaveStory = async () => {
    if (!storyScenes.length) {
      addToast(t('epAddSceneFirst'), 'warning');
      return;
    }
    setIsStorySaving(true);
    setError('');
    try {
      const payload = {
        storyId: currentStoryId || undefined,
        metadata: {
          title: storyTitle || t('storyTitlePlaceholder'),
          description: storyDescription || '',
          language: 'en',
        },
        scenes: storyScenes.map((item, index) => ({
          sceneId: item.sceneId,
          order: index,
          transitionText: item.transitionText || '',
          durationSeconds: Number(item.durationSeconds) || 0,
          advanceOn: normalizeAdvanceOn(item.advanceOn),
          markerUrl: item.markerUrl || '',
        })),
      };
      const result = await saveStory(payload);
      const savedStoryId = result?.storyId || currentStoryId || '';
      if (savedStoryId && !currentStoryId) setCurrentStoryId(savedStoryId);
      addToast(t('epStorySaved'), 'success');
      return savedStoryId;
    } catch (err) {
      setError(`${t('errorSaving')}: ${err.message}`);
      addToast(`Erro ao salvar história: ${err.message}`, 'error');
      return '';
    } finally {
      setIsStorySaving(false);
    }
  };

  // Publishing always saves first, so the public link never shows stale
  // content relative to what's currently in the editor.
  const handlePublishStory = async () => {
    const storyId = await handleSaveStory();
    if (!storyId) return;
    try {
      await publishStory(storyId, true);
      setIsStoryPublic(true);
      addToast(t('epStoryPublished'), 'success');
    } catch (err) {
      // The server refuses to publish from an unconfirmed address; say what to
      // do about it rather than surfacing a bare 403.
      if (err?.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        addToast(t('publishNeedsVerify'), 'warning', 9000);
        return;
      }
      addToast(`${t('errorSaving')}: ${err.message}`, 'error');
    }
  };

  const handleUnpublishStory = async () => {
    if (!currentStoryId) return;
    try {
      await publishStory(currentStoryId, false);
      setIsStoryPublic(false);
      addToast(t('epStoryUnpublished'), 'info');
    } catch (err) {
      addToast(`${t('errorSaving')}: ${err.message}`, 'error');
    }
  };

  // Save status shown in the editor toolbar: unsaved (amber) → saving → saved.
  const savedTime = autosaveStatus instanceof Date
    ? autosaveStatus.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';
  const saveStatusEl = isDirty ? (
    <span className="flex items-center gap-1.5 text-sm font-medium text-amber-400 shrink-0">
      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
      {t('epUnsavedChanges')}
    </span>
  ) : autosaveStatus === 'saving' ? (
    <span className="flex items-center gap-1.5 text-sm text-gray-400 shrink-0">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
      {t('headerAutosaveSaving')}
    </span>
  ) : autosaveStatus instanceof Date ? (
    <span className="flex items-center gap-1.5 text-sm text-emerald-400/90 shrink-0">
      <Icon name="check" className="h-4 w-4" />
      {t('headerAutosaveSaved', { time: savedTime })}
    </span>
  ) : null;
  const saveStatusCompactEl = isDirty ? (
    <span title={t('epUnsavedChanges')} className="h-3 w-3 shrink-0 rounded-full bg-amber-400 animate-pulse" />
  ) : autosaveStatus === 'saving' ? (
    <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
  ) : autosaveStatus instanceof Date ? (
    <Icon name="check" className="h-4 w-4 shrink-0 text-emerald-400" />
  ) : null;

  return (
    <div className="flex flex-col h-dvh bg-gray-900 text-white overflow-hidden">
      {showOnboarding && (
        <OnboardingOverlay onDone={() => {
          setShowOnboarding(false);
          if (shouldShowTour()) setShowTour(true);
        }} />
      )}
      <WalkthroughTour isOpen={showTour} onClose={() => setShowTour(false)} />
      <Header />
      {error && (
        <div className="shrink-0 bg-red-900/80 text-red-200 text-sm px-4 py-2 border-b border-red-700 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-300 hover:text-white text-lg leading-none">×</button>
        </div>
      )}
      <div className="shrink-0 border-b border-gray-800 bg-gray-950 px-4 py-2 flex items-center justify-between gap-2 md:hidden">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon name="scene" className="w-4 h-4 text-cyan-500/70 shrink-0" />
          <span className="truncate text-sm font-medium text-gray-200">{sceneTitle?.trim() || t('epUntitledScene')}</span>
          {saveStatusCompactEl}
        </div>
        <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setShowTour(true)}
          className="rounded-full border border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
        >
          ? Tour
        </button>
        <Link to={arHref} className="rounded-full bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600 flex items-center gap-1">
          <Icon name="cube" className="w-3.5 h-3.5" />
          {t('viewerOpenAr')}
        </Link>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          onAddCurrentSceneToStory={handleAddCurrentSceneToStory}
          onAddSceneIdToStory={handleAddSceneIdToStory}
          onSaveStory={handleSaveStory}
          onPublishStory={handlePublishStory}
          onUnpublishStory={handleUnpublishStory}
          isStorySaving={isStorySaving}
          isStoryLinked={isStoryLinked}
          isStoryPublic={isStoryPublic}
          audio={audio}
          vrmaUrl={vrmaUrl}
          onLoadVrma={setVrmaUrl}
          textDisplayMode={textDisplayMode}
          onTextDisplayModeChange={setTextDisplayMode}
          mobilePanelTab={mobilePanelTab}
          onMobilePanelClose={() => setMobilePanelTab(null)}
          avatarClips={avatarClips}
          jawApi={jawApi}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="hidden md:flex shrink-0 items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-950">
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <Icon name="scene" className="w-4 h-4 text-cyan-500/70 shrink-0" />
              <span className="truncate text-sm font-medium text-gray-200" title={sceneTitle?.trim() || undefined}>
                {sceneTitle?.trim() || t('epUntitledScene')}
              </span>
            </div>
            {saveStatusEl}
            <div className="flex flex-1 items-center justify-end gap-2 shrink-0">
              <button
                onClick={() => setShowTour(true)}
                className="rounded-full border border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
                title="Iniciar tour guiado"
              >
                ? Tour
              </button>
              <Link data-tour="ar-btn" to={arHref} className="rounded-full bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600 flex items-center gap-1">
                <Icon name="cube" className="w-3.5 h-3.5" />
                {t('openSurfaceAr')}
              </Link>
            </div>
          </div>
          <div className="flex-1 overflow-hidden relative" data-tour="scene-canvas">
            {sceneLoading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-900/90 gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
                <p className="text-sm text-cyan-200 font-medium">Carregando cena…</p>
              </div>
            )}
            <Suspense fallback={
              <div className="flex h-full items-center justify-center bg-gray-900">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
                  <p className="text-sm text-cyan-200 font-medium">Preparando o palco 3D...</p>
                  <p className="text-xs text-gray-500">Isso pode levar alguns segundos</p>
                </div>
              </div>
            }>
              {/* A model nobody has tested can throw while rendering; keeping
                  that inside the canvas leaves the rest of the screen usable.
                  Keyed on the avatar, so loading another one tries again. */}
              <ErrorBoundary compact resetKey={avatarUrl}>
                <SceneCanvas
                  avatarUrl={avatarUrl}
                  transform={transform}
                  posePreset={posePreset}
                  speechText={speechText}
                  analyserRef={audio.analyserRef}
                  lipSyncConfig={audio.lipSyncConfig}
                  visemeTimeline={audio.visemeTimeline}
                  audioCurrentTime={audio.audioCurrentTime}
                  isSpeaking={audio.isSpeaking || audio.isPlaying}
                  vrmaUrl={vrmaUrl}
                  animSpeed={animSpeed}
                  animLoopOnce={animLoopOnce}
                  vrmExpression={vrmExpression}
                  textDisplayMode={textDisplayMode}
                  showRigTools
                  onAvatarClips={setAvatarClips}
                  onJawApi={setJawApi}
                />
              </ErrorBoundary>
            </Suspense>

            {/* Sits over the canvas rather than in a side panel, so it is
                reachable whichever tab is open, and on a phone too. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-20 md:bottom-4 flex justify-center px-4">
              <button
                onClick={runScene}
                disabled={previewSource === 'none'}
                title={previewSource === 'none' ? t('editorRunSceneEmpty') : undefined}
                className="pointer-events-auto flex items-center gap-2 rounded-full bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-cyan-700"
              >
                <Icon name={isPreviewing ? 'stop' : 'play'} className="h-4 w-4" />
                {isPreviewing ? t('editorRunSceneStop') : t('editorRunScene')}
              </button>
            </div>
          </div>
          <StoryBuilderPanel onAddScene={handleAddCurrentSceneToStory} isAddingScene={isAddingScene} />
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav
        activeTab={mobilePanelTab}
        onTabChange={(tab) => setMobilePanelTab((prev) => (prev === tab ? null : tab))}
      />
    </div>
  );
}
