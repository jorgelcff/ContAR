import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AvaturnEmbed from './AvaturnEmbed';
import TransformControls from './TransformControls';
import AudioPanel from './AudioPanel';
import { listAvaturnAvatars } from '../../api/sceneApi';

const AVATURN_USER_ID_KEY = 'avaturn:userId';

/**
 * LeftPanel — the editor's control sidebar.
 *
 * Props: (see EditorPage)
 */
export default function LeftPanel({
  avatarUrl,
  onAvatarUrlChange,
  onLoadAvatar,
  transform,
  onTransformUpdate,
  posePreset,
  onPosePresetChange,
  speechText,
  onAddSpeech,
  onClearSpeech,
  sceneTitle,
  onSceneTitleChange,
  onAddCurrentSceneToStory,
  onAddSceneIdToStory,
  storyTitle,
  onStoryTitleChange,
  storyDescription,
  onStoryDescriptionChange,
  onSaveStory,
  onPublishStory,
  isStorySaving,
  isStoryLinked,
  linkedStoryId,
  publishedStoryId,
  onSave,
  isSaving,
  audio,
}) {
  const { t } = useTranslation();
  const [urlInput, setUrlInput] = useState(avatarUrl);
  const [speechInput, setSpeechInput] = useState(speechText);
  const [manualSceneId, setManualSceneId] = useState('');
  const [copiedStory, setCopiedStory] = useState(false);
  const [showAvaturn, setShowAvaturn] = useState(false);
  const [savedAvatars, setSavedAvatars] = useState([]);
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(false);
  const [avatarListError, setAvatarListError] = useState('');
  const [hasLoadedAvatars, setHasLoadedAvatars] = useState(false);

  useEffect(() => {
    setUrlInput(avatarUrl || '');
  }, [avatarUrl]);

  const handleLoad = () => {
    if (urlInput.trim()) onLoadAvatar(urlInput.trim());
  };

  const handleAvaturnExport = (url) => {
    setUrlInput(url);
    onAvatarUrlChange(url);
    onLoadAvatar(url);
    setShowAvaturn(false);
  };

  const handleAddSpeech = () => {
    onAddSpeech(speechInput.trim());
  };

  const storyIdForShare = linkedStoryId || publishedStoryId || '';
  const storyShareUrl = storyIdForShare
    ? `${window.location.origin}/story/${encodeURIComponent(storyIdForShare)}`
    : '';

  const copyStoryLink = async () => {
    if (!storyShareUrl) return;
    try {
      await navigator.clipboard.writeText(storyShareUrl);
      setCopiedStory(true);
      setTimeout(() => setCopiedStory(false), 1500);
    } catch {
      // ignore clipboard failures
    }
  };

  const handleLoadSavedAvatars = async () => {
    const configuredUserId = String(import.meta.env.VITE_AVATURN_USER_ID || '').trim();
    const avaturnUserId = localStorage.getItem(AVATURN_USER_ID_KEY) || configuredUserId || '';
    if (!avaturnUserId) {
      setAvatarListError(t('openAvaturnFirst'));
      setSavedAvatars([]);
      setHasLoadedAvatars(true);
      return;
    }

    setIsLoadingAvatars(true);
    setAvatarListError('');
    try {
      const data = await listAvaturnAvatars(avaturnUserId);
      const normalized = (data?.avatars || []).filter(
        (avatar) => avatar?.url || avatar?.modelUrl || avatar?.glbUrl
      );
      setSavedAvatars(normalized);
    } catch (err) {
      const apiError = err?.response?.data?.error;
      setAvatarListError(apiError || `${t('avatarListError')}.`);
      setSavedAvatars([]);
    } finally {
      setHasLoadedAvatars(true);
      setIsLoadingAvatars(false);
    }
  };

  const handleSelectSavedAvatar = (event) => {
    const selectedUrl = event.target.value;
    if (!selectedUrl) return;
    setUrlInput(selectedUrl);
    onAvatarUrlChange(selectedUrl);
    onLoadAvatar(selectedUrl);
  };

  return (
    <aside className="w-80 shrink-0 flex flex-col gap-4 p-4 bg-gray-800 overflow-y-auto border-r border-gray-700">

      {/* ── Avatar Section ─────────────────────────── */}
      <section className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Avatar</p>

        <button
          onClick={() => setShowAvaturn((v) => !v)}
          className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          {t('openAvaturn')}
        </button>

        <button
          onClick={handleLoadSavedAvatars}
          disabled={isLoadingAvatars || showAvaturn}
          className="w-full py-2 rounded-lg bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {isLoadingAvatars ? t('loadingAvatars') : t('loadMyAvatars')}
        </button>

        {savedAvatars.length > 0 && (
          <select
            onChange={handleSelectSavedAvatar}
            defaultValue=""
            className="w-full rounded-lg bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="" disabled>{t('chooseAvatar')}</option>
            {savedAvatars.map((avatar) => {
              const modelUrl = avatar?.url || avatar?.modelUrl || avatar?.glbUrl || '';
              const avatarId = avatar?.id || avatar?.avatarId || 'avatar';
              return (
                <option key={avatarId} value={modelUrl}>
                  {avatarId}
                </option>
              );
            })}
          </select>
        )}

        {hasLoadedAvatars && !isLoadingAvatars && !avatarListError && savedAvatars.length === 0 && (
          <p className="text-xs text-gray-500">{t('noSavedAvatars')}</p>
        )}

        {avatarListError && (
          <p className="text-xs text-red-400">{avatarListError}</p>
        )}

        {showAvaturn && (
          <AvaturnEmbed
            onExport={handleAvaturnExport}
            onClose={() => setShowAvaturn(false)}
          />
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              onAvatarUrlChange(e.target.value);
            }}
            placeholder={t('avatarUrl')}
            className="flex-1 min-w-0 rounded-lg bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleLoad}
            className="shrink-0 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
          >
            {t('loadAvatar')}
          </button>
        </div>
        {!avatarUrl && (
          <p className="text-xs text-gray-500">{t('noAvatarHint')}</p>
        )}
      </section>

      <hr className="border-gray-700" />

      {/* ── Transform Section ──────────────────────── */}
      <TransformControls transform={transform} onUpdate={onTransformUpdate} />

      <section className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{t('pose')}</p>
        <select
          value={posePreset}
          onChange={(e) => onPosePresetChange(e.target.value)}
          className="w-full rounded-lg bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 focus:outline-none focus:border-blue-500"
        >
          <option value="idle">{t('poseIdle')}</option>
          <option value="walk">{t('poseWalk')}</option>
          <option value="run">{t('poseRun')}</option>
          <option value="dance">{t('poseDance')}</option>
          <option value="neutral">{t('poseNeutral')}</option>
          <option value="wave">{t('poseWave')}</option>
          <option value="hands_on_hips">{t('poseHandsOnHips')}</option>
          <option value="salute">{t('poseSalute')}</option>
          <option value="arms_crossed">{t('poseArmsCrossed')}</option>
          <option value="t_pose">{t('poseTPose')}</option>
        </select>
      </section>

      <hr className="border-gray-700" />

      {/* ── Speech Section ─────────────────────────── */}
      <section className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          {t('speech')}
        </p>
        <textarea
          rows={3}
          value={speechInput}
          onChange={(e) => setSpeechInput(e.target.value)}
          placeholder={t('speechPlaceholder')}
          className="w-full rounded-lg bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
        />
        <div className="flex gap-2">
          <button
            onClick={handleAddSpeech}
            className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
          >
            {t('addSpeech')}
          </button>
          {speechText && (
            <button
              onClick={() => { setSpeechInput(''); onClearSpeech(); }}
              className="py-2 px-3 rounded-lg bg-gray-600 hover:bg-gray-500 text-white text-sm transition-colors"
            >
              {t('clearSpeech')}
            </button>
          )}
        </div>
      </section>

      <hr className="border-gray-700" />

      {/* ── Audio & Lip Sync Section ───────────────── */}
      {audio && (
        <AudioPanel
          audioUrl={audio.audioUrl}
          isPlaying={audio.isPlaying}
          isRecording={audio.isRecording}
          error={audio.error}
          audioMetrics={audio.audioMetrics}
          audioProcessing={audio.audioProcessing}
          lipSyncConfig={audio.lipSyncConfig}
          onLoadFile={audio.loadFile}
          onPlay={audio.play}
          onPause={audio.pause}
          onStop={audio.stop}
          onStartRec={audio.startRecording}
          onStopRec={audio.stopRecording}
          onAudioProcessingChange={audio.updateAudioProcessing}
          onLipSyncConfigChange={audio.updateLipSyncConfig}
        />
      )}

      <hr className="border-gray-700" />

      {/* ── Scene Section ──────────────────────────── */}
      <section className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Scene</p>
        <input
          type="text"
          value={sceneTitle}
          onChange={(e) => onSceneTitleChange(e.target.value)}
          placeholder={t('sceneTitlePlaceholder')}
          className="w-full rounded-lg bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={onSave}
          disabled={isSaving}
          className="w-full py-2 rounded-lg bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {isSaving ? t('saving') : t('saveScene')}
        </button>
        <button
          onClick={onAddCurrentSceneToStory}
          className="w-full py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium transition-colors"
        >
          {t('addCurrentSceneToStory')}
        </button>
      </section>

      <hr className="border-gray-700" />

      <section className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{t('story')}</p>

        {isStoryLinked ? (
          <div className="rounded-lg border border-emerald-700/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200 break-all">
            Story linked: {linkedStoryId}
          </div>
        ) : (
          <>
            <input
              type="text"
              value={storyTitle}
              onChange={(e) => onStoryTitleChange(e.target.value)}
              placeholder={t('storyTitlePlaceholder')}
              className="w-full rounded-lg bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <textarea
              rows={2}
              value={storyDescription}
              onChange={(e) => onStoryDescriptionChange(e.target.value)}
              placeholder={t('storyDescriptionPlaceholder')}
              className="w-full rounded-lg bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
            />
          </>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={manualSceneId}
            onChange={(e) => setManualSceneId(e.target.value)}
            placeholder={t('sceneId')}
            className="flex-1 min-w-0 rounded-lg bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => {
              const value = manualSceneId.trim();
              if (!value) return;
              onAddSceneIdToStory(value);
              setManualSceneId('');
            }}
            className="shrink-0 px-3 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-medium transition-colors"
          >
            {t('addSceneById')}
          </button>
        </div>

        <button
          onClick={onSaveStory}
          disabled={isStorySaving}
          className="w-full py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {isStorySaving ? t('savingStory') : isStoryLinked ? t('updateStory') : t('saveStory')}
        </button>

        <button
          onClick={onPublishStory}
          disabled={isStorySaving}
          className="w-full py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {t('publish')}
        </button>

        {storyShareUrl && (
          <>
            <div className="rounded bg-gray-900 px-2 py-1 text-xs text-blue-300 break-all">{storyShareUrl}</div>
            <button
              onClick={copyStoryLink}
              className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm"
            >
              {copiedStory ? t('copied') : t('copyLink')}
            </button>
          </>
        )}
      </section>
    </aside>
  );
}
