import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from '../components/ui/Header';
import LeftPanel from '../components/ui/LeftPanel';
import OnboardingOverlay, { shouldShowOnboarding } from '../components/ui/OnboardingOverlay';
import StoryBuilderPanel from '../components/ui/StoryBuilderPanel';
import TimelinePanel from '../components/ui/TimelinePanel';
import { useSceneStore } from '../store/useSceneStore';
import useAudio from '../hooks/useAudio';
import useTTS from '../hooks/useTTS';
import { getScene, getStory, saveScene, saveStory } from '../api/sceneApi';

const SceneCanvas = lazy(() => import('../components/3d/SceneCanvas'));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * EditorPage — main scene-building interface.
 * Left panel: controls. Right panel: live Three.js canvas.
 */
export default function EditorPage() {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
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
    buildScenePayload,
  } = useSceneStore();

  const audio = useAudio();

  const tts = useTTS({
    onAudioReady: (file) => audio.loadFile(file),
    onVisemeReady: (text) => audio.generateVisemeTimelineFromText(text),
  });

  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding);
  const [isSaving, setIsSaving] = useState(false);
  const [isStorySaving, setIsStorySaving] = useState(false);
  const [error, setError] = useState('');

  const isStoryLinked = Boolean(currentStoryId);
  const arHref = avatarUrl ? `/ar?mode=surface&modelUrl=${encodeURIComponent(avatarUrl)}` : '/ar';

  useEffect(() => {
    const routeStoryId = searchParams.get('storyId') || '';
    if (routeStoryId !== currentStoryId) {
      setCurrentStoryId(routeStoryId);
    }

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
      .catch((err) => {
        setError(`${t('errorLoading')}: ${err.message}`);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, t]);

  useEffect(() => {
    const sceneIds = [...new Set(storyScenes.map((item) => item.sceneId).filter(Boolean))];
    const missing = sceneIds.filter((id) => !sceneTitlesById[id]);
    if (!missing.length) return;

    let active = true;

    Promise.all(
      missing.map(async (id) => {
        try {
          const scene = await getScene(id);
          const title = String(scene?.metadata?.title || '').trim();
          return [id, title || id];
        } catch {
          return [id, id];
        }
      })
    ).then((entries) => {
      if (!active) return;
      setSceneTitlesById((prev) => {
        const next = { ...prev };
        entries.forEach(([id, title]) => {
          next[id] = title;
        });
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [storyScenes, sceneTitlesById, setSceneTitlesById]);

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      const result = await saveScene(buildScenePayload(currentSceneId || undefined));
      if (result?.sceneId) {
        setCurrentSceneId(result.sceneId);
      }
    } catch (err) {
      setError(`${t('errorSaving')}: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCurrentSceneToStory = async () => {
    setError('');
    try {
      // Always create a NEW scene when adding to a story sequence.
      const result = await saveScene(buildScenePayload(undefined));
      const sceneId = result?.sceneId;
      if (!sceneId) throw new Error('Missing sceneId in save response');
      setCurrentSceneId(sceneId);
      useSceneStore.getState().addStoryScene(sceneId);
    } catch (err) {
      setError(`${t('errorSaving')}: ${err.message}`);
    }
  };

  const handleAddSceneIdToStory = (sceneId) => {
    setError('');
    const { storyScenes, addStoryScene } = useSceneStore.getState();
    if (!sceneId || !UUID_RE.test(sceneId)) {
      setError(t('invalidSceneId'));
      return false;
    }
    if (storyScenes.some((item) => item.sceneId === sceneId)) {
      setError(t('sceneAlreadyInStory'));
      return false;
    }
    addStoryScene(sceneId);
    return true;
  };

  const handleSaveStory = async () => {
    if (!storyScenes.length) {
      setError(t('noStoryScenes'));
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
      if (savedStoryId && !currentStoryId) {
        setCurrentStoryId(savedStoryId);
      }
    } catch (err) {
      setError(`${t('errorSaving')}: ${err.message}`);
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
      <Header />
      {error && (
        <div className="shrink-0 bg-red-900/80 text-red-200 text-sm px-4 py-2 border-b border-red-700">
          {error}
        </div>
      )}
      <div className="shrink-0 border-b border-gray-800 bg-gray-950 px-4 py-2 flex items-center justify-end gap-2 md:hidden">
        <Link
          to={arHref}
          className="rounded-full bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600"
        >
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
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="hidden md:flex shrink-0 items-center justify-end px-4 py-2 border-b border-gray-800 bg-gray-950">
            <Link
              to={arHref}
              className="rounded-full bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600"
            >
              {t('openSurfaceAr')}
            </Link>
          </div>
          <div className="flex-1 overflow-hidden">
            <Suspense fallback={
              <div className="flex h-full items-center justify-center bg-gray-900">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
                  <p className="text-xs text-cyan-200">Loading scene viewer…</p>
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
    </div>
  );
}
