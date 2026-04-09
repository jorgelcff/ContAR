import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../components/ui/Header';
import LeftPanel from '../components/ui/LeftPanel';
import SceneCanvas from '../components/3d/SceneCanvas';
import PublishModal from '../components/ui/PublishModal';
import useScene from '../hooks/useScene';
import { saveScene } from '../api/sceneApi';

/**
 * EditorPage — main scene-building interface.
 * Left panel: controls. Right panel: live Three.js canvas.
 */
export default function EditorPage() {
  const { t } = useTranslation();
  const {
    avatarUrl, setAvatarUrl,
    transform, updateTransform,
    speechText, setSpeechText,
    sceneTitle, setSceneTitle,
    buildScenePayload,
  } = useScene();

  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState(null);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      await saveScene(buildScenePayload());
    } catch (err) {
      setError(`${t('errorSaving')}: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setError('');
    try {
      const result = await saveScene(buildScenePayload());
      setPublishedId(result.sceneId);
    } catch (err) {
      setError(`${t('errorSaving')}: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      <Header />
      {error && (
        <div className="shrink-0 bg-red-900/80 text-red-200 text-sm px-4 py-2 border-b border-red-700">
          {error}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          avatarUrl={avatarUrl}
          onAvatarUrlChange={setAvatarUrl}
          onLoadAvatar={setAvatarUrl}
          transform={transform}
          onTransformUpdate={updateTransform}
          speechText={speechText}
          onAddSpeech={setSpeechText}
          onClearSpeech={() => setSpeechText('')}
          sceneTitle={sceneTitle}
          onSceneTitleChange={setSceneTitle}
          onSave={handleSave}
          onPublish={handlePublish}
          isSaving={isSaving}
          isPublishing={isPublishing}
        />
        <SceneCanvas
          avatarUrl={avatarUrl}
          transform={transform}
          speechText={speechText}
        />
      </div>
      {publishedId && (
        <PublishModal sceneId={publishedId} onClose={() => setPublishedId(null)} />
      )}
    </div>
  );
}
