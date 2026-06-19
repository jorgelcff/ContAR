import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
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
import useTTS from '../hooks/useTTS';
import { useToast } from '../context/ToastContext';
import { getScene, getStory, saveScene, saveStory, uploadAudio, deleteAudio } from '../api/sceneApi';

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
    avatarUrl, setAvatarUrl,
    transform, setTransform,
    posePreset, setPosePreset,
    speechText, setSpeechText,
    textDisplayMode, setTextDisplayMode,
    sceneTitle, setSceneTitle,
    storyTitle, setStoryTitle,
    storyDescription, setStoryDescription,
    storyScenes, setStoryScenes,
    sceneTitlesById, setSceneTitlesById,
    currentSceneId, setCurrentSceneId,
    currentStoryId, setCurrentStoryId,
    publishedStoryId, setPublishedStoryId,
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

  const tts = useTTS({
    onAudioReady: (file) => {
      audio.loadFile(file);
      addToast(t('epVoiceGenerated'), 'success');
    },
    // Prefer the provider's precise viseme timeline (Azure); fall
    // back to the text heuristic only when it isn't available.
    onVisemeReady: (text, visemeTimeline) => {
      if (!visemeTimeline || !audio.applyVisemeTimeline(visemeTimeline)) {
        audio.generateVisemeTimelineFromText(text);
      }
    },
  });

  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding);
  const [showTour, setShowTour] = useState(() => !shouldShowOnboarding() && shouldShowTour());
  const [mobilePanelTab, setMobilePanelTab] = useState(null);
  const [vrmaUrl, setVrmaUrl] = useState('');
  // Names of animation clips embedded in the currently loaded avatar GLB,
  // surfaced by SceneCanvas so the panel can offer them for direct selection.
  const [avatarClips, setAvatarClips] = useState([]);

  useEffect(() => {
    if (hadLocalAvatarOnInit()) {
      addToast(t('epLocalAvatarRemoved'), 'info', 5000);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [isSaving, setIsSaving] = useState(false);
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
    pendingPayloadRef.current = payload;
    setIsDirty(true);
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      setAutosaveStatus('saving');
      try {
        const result = await saveScene(payload);
        pendingPayloadRef.current = null;
        if (result?.sceneId && !currentSceneId) {
          useSceneStore.getState().setCurrentSceneId(result.sceneId);
        }
        const savedId = result?.sceneId || currentSceneId || undefined;
        lastSavedSigRef.current = JSON.stringify(
          useSceneStore.getState().buildScenePayload(savedId),
        );
        setIsDirty(false);
        setAutosaveStatus(new Date());
        if (!autosaveEducatedRef.current) {
          autosaveEducatedRef.current = true;
          addToast(t('epAutosaveEducational'), 'info', 4000);
        }
      } catch {
        setAutosaveStatus(null);
      }
    }, 5000);
    return () => clearTimeout(autosaveTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarUrl, speechText, sceneTitle, posePreset, transform, timelineBlocks, currentSceneId, narrativeAudioUrl, textDisplayMode]);

  // Flush a still-pending autosave when leaving the editor (e.g. clicking
  // "Minhas cenas" right after a change), so edits made within the 3s
  // debounce window aren't silently dropped.
  useEffect(() => () => {
    if (pendingPayloadRef.current) {
      saveScene(pendingPayloadRef.current).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        });

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
        const scenes = Array.isArray(data?.scenes)
          ? [...data.scenes]
              .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
              .map((item) => ({
                sceneId: item?.sceneId || '',
                transitionText: item?.transitionText || '',
                durationSeconds: Number(item?.durationSeconds) || 0,
              }))
          : [];
        setStoryScenes(scenes);
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

  // ── Handlers ─────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      const result = await saveScene(buildScenePayload(currentSceneId || undefined));
      if (result?.sceneId) setCurrentSceneId(result.sceneId);
      // Mark clean so the toolbar reflects the manual save (and autosave doesn't
      // re-fire a redundant save for the now-identical state).
      const savedId = result?.sceneId || currentSceneId || undefined;
      lastSavedSigRef.current = JSON.stringify(
        useSceneStore.getState().buildScenePayload(savedId),
      );
      pendingPayloadRef.current = null;
      setIsDirty(false);
      setAutosaveStatus(new Date());
      addToast(t('epSceneSaved'), 'success');
    } catch (err) {
      setError(`${t('errorSaving')}: ${err.message}`);
      addToast(`Erro ao salvar: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCurrentSceneToStory = async () => {
    setError('');
    try {
      const result = await saveScene(buildScenePayload(undefined));
      const sceneId = result?.sceneId;
      if (!sceneId) throw new Error('Missing sceneId in save response');
      const sceneCount = useSceneStore.getState().storyScenes.length;
      // Capture the title *before* clearing it so the story-builder card shows
      // the user-typed name instead of a truncated ID.
      const titleForCard = useSceneStore.getState().sceneTitle || '';
      useSceneStore.getState().addStoryScene(sceneId);
      if (titleForCard) {
        setSceneTitlesById({ [sceneId]: titleForCard });
      }
      // Detach from this scene: further edits/autosave should create a new
      // scene instead of overwriting the one we just added to the story.
      // Also clear the title so the next scene doesn't get saved with the
      // same name (which made it look like nothing new was created).
      setCurrentSceneId('');
      useSceneStore.getState().setSceneTitle('');
      addToast(t('epSceneAddedClear', { n: sceneCount + 1 }), 'success', 4000);
      if (!useSceneStore.getState().narrativeAudioUrl) {
        addToast(t('epSceneNoAudioWarning'), 'warning', 5000);
      }
    } catch (err) {
      setError(`${t('errorSaving')}: ${err.message}`);
      addToast(`Erro: ${err.message}`, 'error');
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
        })),
      };
      const result = await saveStory(payload);
      const savedStoryId = result?.storyId || '';
      setPublishedStoryId(savedStoryId);
      if (savedStoryId && !currentStoryId) setCurrentStoryId(savedStoryId);
      addToast(t('epStorySaved'), 'success');
    } catch (err) {
      setError(`${t('errorSaving')}: ${err.message}`);
      addToast(`Erro ao salvar história: ${err.message}`, 'error');
    } finally {
      setIsStorySaving(false);
    }
  };

  const handlePublishStory = async () => {
    await handleSaveStory();
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
        <Link to={arHref} className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 flex items-center gap-1">
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
          isStorySaving={isStorySaving}
          isStoryLinked={isStoryLinked}
          audio={audio}
          tts={tts}
          vrmaUrl={vrmaUrl}
          onLoadVrma={setVrmaUrl}
          textDisplayMode={textDisplayMode}
          onTextDisplayModeChange={setTextDisplayMode}
          mobilePanelTab={mobilePanelTab}
          onMobilePanelClose={() => setMobilePanelTab(null)}
          avatarClips={avatarClips}
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
              <Link data-tour="ar-btn" to={arHref} className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 flex items-center gap-1">
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
              <SceneCanvas
                avatarUrl={avatarUrl}
                transform={transform}
                posePreset={posePreset}
                speechText={speechText}
                analyserRef={audio.analyserRef}
                lipSyncConfig={audio.lipSyncConfig}
                visemeTimeline={audio.visemeTimeline}
                audioCurrentTime={audio.audioCurrentTime}
                vrmaUrl={vrmaUrl}
                animSpeed={animSpeed}
                animLoopOnce={animLoopOnce}
                vrmExpression={vrmExpression}
                textDisplayMode={textDisplayMode}
                onAvatarClips={setAvatarClips}
              />
            </Suspense>
          </div>
          <StoryBuilderPanel onAddScene={handleAddCurrentSceneToStory} />
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
