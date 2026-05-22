import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from '../components/ui/Header';
import LeftPanel from '../components/ui/LeftPanel';
import BottomNav from '../components/ui/BottomNav';
import OnboardingOverlay, { shouldShowOnboarding } from '../components/ui/OnboardingOverlay';
import WalkthroughTour, { shouldShowTour } from '../components/ui/WalkthroughTour';
import StoryBuilderPanel from '../components/ui/StoryBuilderPanel';
import TimelinePanel from '../components/ui/TimelinePanel';
import { useSceneStore, hadLocalAvatarOnInit } from '../store/useSceneStore';
import useAudio from '../hooks/useAudio';
import useTTS from '../hooks/useTTS';
import { useToast } from '../context/ToastContext';
import { getScene, getStory, saveScene, saveStory, uploadAudio } from '../api/sceneApi';

const SceneCanvas = lazy(() => import('../components/3d/SceneCanvas'));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function EditorPage() {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { addToast } = useToast();
  const sceneIdLoadedRef = useRef(false);

  const {
    avatarUrl, setAvatarUrl,
    transform, setTransform,
    posePreset, setPosePreset,
    speechText, setSpeechText,
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
  } = useSceneStore();

  const audio = useAudio();

  const tts = useTTS({
    onAudioReady: async (file) => {
      audio.loadFile(file);
      addToast('Voz gerada! Clique em Play para ouvir.', 'success');
      try {
        const url = await uploadAudio(file);
        useSceneStore.getState().setNarrativeAudioUrl(url);
      } catch {
        // Upload failure is non-critical — audio plays locally, just won't persist in the story viewer
      }
    },
    onVisemeReady: (text) => audio.generateVisemeTimelineFromText(text),
  });

  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding);
  const [showTour, setShowTour] = useState(shouldShowTour);
  const [mobilePanelTab, setMobilePanelTab] = useState(null);

  useEffect(() => {
    if (hadLocalAvatarOnInit()) {
      addToast('Avatar local removido após atualização. Carregue o arquivo GLB novamente.', 'info', 5000);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [isSaving, setIsSaving] = useState(false);
  const [isStorySaving, setIsStorySaving] = useState(false);
  const [error, setError] = useState('');

  // ── Autosave ────────────────────────────────────────────────
  const [autosaveStatus, setAutosaveStatus] = useState(null); // null | 'saving' | Date
  const autosaveTimerRef = useRef(null);

  useEffect(() => {
    // Only autosave when there is meaningful content to preserve
    const hasContent = Boolean(avatarUrl || speechText || sceneTitle);
    if (!hasContent) return;
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      setAutosaveStatus('saving');
      try {
        const result = await saveScene(buildScenePayload(currentSceneId || undefined));
        // Capture the generated sceneId on first save
        if (result?.sceneId && !currentSceneId) {
          useSceneStore.getState().setCurrentSceneId(result.sceneId);
        }
        setAutosaveStatus(new Date());
      } catch {
        setAutosaveStatus(null);
      }
    }, 3000);
    return () => clearTimeout(autosaveTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarUrl, speechText, sceneTitle, posePreset, transform, timelineBlocks, currentSceneId, narrativeAudioUrl]);

  const isStoryLinked = Boolean(currentStoryId);
  const arHref = avatarUrl ? `/ar?mode=surface&modelUrl=${encodeURIComponent(avatarUrl)}` : '/ar';

  // ── Load scene from ?sceneId= URL param ─────────────────────
  useEffect(() => {
    const sceneId = searchParams.get('sceneId') || '';
    if (!sceneId || sceneIdLoadedRef.current) return;
    sceneIdLoadedRef.current = true;

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
            rotationY: ((rot[1] ?? 0) * 180) / Math.PI,
            scale: scale[0] ?? 1,
          },
          speechText: narrative.text || '',
          narrativeAudioUrl: narrative.audioUrl || '',
        });
      })
      .catch(() => addToast('Cena não encontrada.', 'error'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Load story from URL ──────────────────────────────────────
  useEffect(() => {
    const routeStoryId = searchParams.get('storyId') || '';
    if (routeStoryId !== currentStoryId) setCurrentStoryId(routeStoryId);
    if (!routeStoryId) return;

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
        setSceneTitlesById({});
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
      addToast('Cena salva com sucesso!', 'success');
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
      setCurrentSceneId(sceneId);
      useSceneStore.getState().addStoryScene(sceneId);
      addToast('Cena adicionada à história!', 'success');
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
    addToast('Cena adicionada!', 'success');
    return true;
  };

  const handleSaveStory = async () => {
    if (!storyScenes.length) {
      addToast('Adicione pelo menos uma cena à história antes de salvar.', 'warning');
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
      addToast('História salva! O link de compartilhamento está disponível.', 'success');
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

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      {showOnboarding && (
        <OnboardingOverlay onDone={() => setShowOnboarding(false)} />
      )}
      <WalkthroughTour isOpen={showTour} onClose={() => setShowTour(false)} />
      <Header autosaveStatus={autosaveStatus} />
      {error && (
        <div className="shrink-0 bg-red-900/80 text-red-200 text-sm px-4 py-2 border-b border-red-700 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-300 hover:text-white text-lg leading-none">×</button>
        </div>
      )}
      <div className="shrink-0 border-b border-gray-800 bg-gray-950 px-4 py-2 flex items-center justify-end gap-2 md:hidden">
        <button
          onClick={() => setShowTour(true)}
          className="rounded-full border border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
        >
          ? Tour
        </button>
        <Link to={arHref} className="rounded-full bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600">
          {t('openSurfaceAr')}
        </Link>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          onAddCurrentSceneToStory={handleAddCurrentSceneToStory}
          onAddSceneIdToStory={handleAddSceneIdToStory}
          onSaveStory={handleSaveStory}
          onPublishStory={handlePublishStory}
          isStorySaving={isStorySaving}
          isStoryLinked={isStoryLinked}
          onSave={handleSave}
          isSaving={isSaving}
          audio={audio}
          tts={tts}
          mobilePanelTab={mobilePanelTab}
          onMobilePanelClose={() => setMobilePanelTab(null)}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="hidden md:flex shrink-0 items-center justify-end px-4 py-2 border-b border-gray-800 bg-gray-950 gap-2">
            <button
              onClick={() => setShowTour(true)}
              className="rounded-full border border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
              title="Iniciar tour guiado"
            >
              ? Tour
            </button>
            <Link data-tour="ar-btn" to={arHref} className="rounded-full bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600">
              {t('openSurfaceAr')}
            </Link>
          </div>
          <div className="flex-1 overflow-hidden" data-tour="scene-canvas">
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
              />
            </Suspense>
          </div>
          <TimelinePanel />
          <StoryBuilderPanel />
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
