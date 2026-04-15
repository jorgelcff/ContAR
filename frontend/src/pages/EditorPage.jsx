import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from '../components/ui/Header';
import LeftPanel from '../components/ui/LeftPanel';
import SceneCanvas from '../components/3d/SceneCanvas';
import StoryBuilderPanel from '../components/ui/StoryBuilderPanel';
import useScene from '../hooks/useScene';
import { getScene, getStory, saveScene, saveStory } from '../api/sceneApi';

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
    transform, updateTransform,
    posePreset, setPosePreset,
    speechText, setSpeechText,
    sceneTitle, setSceneTitle,
    audioUrl, setAudioUrl,
    morphOverrides, setMorphOverride,
    buildScenePayload,
  } = useScene();

  const [audioIsPlaying, setAudioIsPlaying] = useState(false);
  const [morphTargets, setMorphTargets] = useState([]);

  const [isSaving, setIsSaving] = useState(false);
  const [currentSceneId, setCurrentSceneId] = useState('');
  const [currentStoryId, setCurrentStoryId] = useState(searchParams.get('storyId') || '');
  const [storyTitle, setStoryTitle] = useState('');
  const [storyDescription, setStoryDescription] = useState('');
  const [storyScenes, setStoryScenes] = useState([]);
  const [sceneTitlesById, setSceneTitlesById] = useState({});
  const [isStorySaving, setIsStorySaving] = useState(false);
  const [publishedStoryId, setPublishedStoryId] = useState('');
  const [error, setError] = useState('');

  const isStoryLinked = Boolean(currentStoryId);
  const arHref = avatarUrl ? `/ar?mode=surface&modelUrl=${encodeURIComponent(avatarUrl)}` : '/ar';

  useEffect(() => {
    const routeStoryId = searchParams.get('storyId') || '';
    setCurrentStoryId(routeStoryId);

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
  }, [storyScenes, sceneTitlesById]);

  const addSceneIdToStory = (sceneId) => {
    if (!sceneId || !UUID_RE.test(sceneId)) {
      setError(t('invalidSceneId'));
      return false;
    }

    if (storyScenes.some((item) => item.sceneId === sceneId)) {
      setError(t('sceneAlreadyInStory'));
      return false;
    }

    setStoryScenes((prev) => [
      ...prev,
      { sceneId, transitionText: '', durationSeconds: 8 },
    ]);
    return true;
  };

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
      addSceneIdToStory(sceneId);
    } catch (err) {
      setError(`${t('errorSaving')}: ${err.message}`);
    }
  };

  const handleAddSceneIdToStory = (sceneId) => {
    setError('');
    addSceneIdToStory(sceneId);
  };

  const handleRemoveStoryScene = (index) => {
    setStoryScenes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveStoryScene = (index, direction) => {
    setStoryScenes((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };

  const handleReorderStoryScenes = (from, to) => {
    setStoryScenes((prev) => {
      if (from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleStorySceneChange = (index, key, value) => {
    setStoryScenes((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (key === 'durationSeconds') {
          return { ...item, durationSeconds: Math.max(0, Number(value) || 0) };
        }
        return { ...item, [key]: value };
      })
    );
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
          avatarUrl={avatarUrl}
          onAvatarUrlChange={setAvatarUrl}
          onLoadAvatar={setAvatarUrl}
          transform={transform}
          onTransformUpdate={updateTransform}
          posePreset={posePreset}
          onPosePresetChange={setPosePreset}
          speechText={speechText}
          onAddSpeech={setSpeechText}
          onClearSpeech={() => setSpeechText('')}
          sceneTitle={sceneTitle}
          onSceneTitleChange={setSceneTitle}
          onAddCurrentSceneToStory={handleAddCurrentSceneToStory}
          onAddSceneIdToStory={handleAddSceneIdToStory}
          storyTitle={storyTitle}
          onStoryTitleChange={setStoryTitle}
          storyDescription={storyDescription}
          onStoryDescriptionChange={setStoryDescription}
          onSaveStory={handleSaveStory}
          onPublishStory={handlePublishStory}
          isStorySaving={isStorySaving}
          isStoryLinked={isStoryLinked}
          linkedStoryId={currentStoryId}
          publishedStoryId={publishedStoryId}
          onSave={handleSave}
          isSaving={isSaving}
          audioUrl={audioUrl}
          onAudioUrlChange={setAudioUrl}
          audioIsPlaying={audioIsPlaying}
          onAudioPlayPause={() => setAudioIsPlaying((v) => !v)}
          morphTargets={morphTargets}
          morphOverrides={morphOverrides}
          onMorphOverrideChange={setMorphOverride}
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
            <SceneCanvas
              avatarUrl={avatarUrl}
              transform={transform}
              posePreset={posePreset}
              speechText={speechText}
              audioUrl={audioUrl}
              audioIsPlaying={audioIsPlaying}
              morphOverrides={morphOverrides}
              onMorphTargetsDiscovered={setMorphTargets}
            />
          </div>
          <StoryBuilderPanel
            storyScenes={storyScenes}
            sceneTitlesById={sceneTitlesById}
            onStorySceneChange={handleStorySceneChange}
            onRemoveStoryScene={handleRemoveStoryScene}
            onReorderStoryScenes={handleReorderStoryScenes}
          />
        </div>
      </div>
    </div>
  );
}
