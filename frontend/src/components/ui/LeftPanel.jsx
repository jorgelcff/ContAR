import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AvaturnEmbed from './AvaturnEmbed';
import TransformControls from './TransformControls';
import AudioPanel from './AudioPanel';
import SceneProgressBar from './SceneProgressBar';
import { TooltipIcon } from './Tooltip';
import { useSceneStore } from '../../store/useSceneStore';
import { listAvaturnAvatars, uploadModel } from '../../api/sceneApi';
import { useToast } from '../../context/ToastContext';

const AVATURN_USER_ID_KEY = 'avaturn:userId';

const TABS = [
  { id: 'avatar',   label: 'Avatar',   icon: '👤' },
  { id: 'fala',     label: 'Fala',     icon: '💬' },
  { id: 'cena',     label: 'Cena',     icon: '🎬' },
  { id: 'historia', label: 'História', icon: '📖' },
];

export default function LeftPanel({
  onAddCurrentSceneToStory,
  onAddSceneIdToStory,
  onSaveStory,
  onPublishStory,
  isStorySaving,
  isStoryLinked,
  onSave,
  isSaving,
  audio,
  tts,
  mobilePanelTab,
  onMobilePanelClose,
}) {
  const { t } = useTranslation();
  const { addToast } = useToast();

  const {
    avatarUrl, setAvatarUrl,
    transform, setTransform,
    posePreset, setPosePreset,
    speechText, setSpeechText,
    sceneTitle, setSceneTitle,
    storyTitle, setStoryTitle,
    storyDescription, setStoryDescription,
    currentSceneId,
    currentStoryId: linkedStoryId,
    publishedStoryId,
  } = useSceneStore();

  const [activeTab, setActiveTab] = useState('avatar');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sync desktop tab when mobile nav changes
  useEffect(() => {
    if (mobilePanelTab) setActiveTab(mobilePanelTab);
  }, [mobilePanelTab]);

  // Avatar tab state
  const [urlInput, setUrlInput] = useState(avatarUrl);
  const [showAvaturn, setShowAvaturn] = useState(false);
  const [savedAvatars, setSavedAvatars] = useState([]);
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(false);
  const [avatarListError, setAvatarListError] = useState('');
  const [hasLoadedAvatars, setHasLoadedAvatars] = useState(false);
  const [isUploadingGlb, setIsUploadingGlb] = useState(false);
  const localGlbInputRef = useRef(null);
  const localBlobUrlRef = useRef('');

  // Fala tab state
  const [speechInput, setSpeechInput] = useState(speechText);

  // História tab state
  const [manualSceneId, setManualSceneId] = useState('');
  const [copiedStory, setCopiedStory] = useState(false);

  useEffect(() => { setUrlInput(avatarUrl || ''); }, [avatarUrl]);

  useEffect(() => () => {
    if (!localBlobUrlRef.current) return;
    const activeBlobUrl = localBlobUrlRef.current;
    const currentAvatarUrl = useSceneStore.getState().avatarUrl;
    if (currentAvatarUrl !== activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl);
      localBlobUrlRef.current = '';
    }
  }, []);

  // ── Avatar handlers ────────────────────────────────────────
  const handleLoad = () => { if (urlInput.trim()) setAvatarUrl(urlInput.trim()); };

  const handleAvaturnExport = (url) => {
    setUrlInput(url);
    setAvatarUrl(url);
    setShowAvaturn(false);
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
      setSavedAvatars((data?.avatars || []).filter((a) => a?.url || a?.modelUrl || a?.glbUrl));
    } catch (err) {
      setAvatarListError(err?.response?.data?.error || t('avatarListError'));
      setSavedAvatars([]);
    } finally {
      setHasLoadedAvatars(true);
      setIsLoadingAvatars(false);
    }
  };

  const handleSelectSavedAvatar = (e) => {
    const url = e.target.value;
    if (!url) return;
    setUrlInput(url);
    setAvatarUrl(url);
  };

  const handlePickLocalGlb = () => localGlbInputRef.current?.click();

  const handleLocalGlbChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    const valid = lower.endsWith('.glb') || lower.endsWith('.vrm')
      || file.type === 'model/gltf-binary' || file.type === 'model/vrm'
      || file.type === 'application/octet-stream';
    if (!valid) { e.target.value = ''; return; }
    e.target.value = '';

    // Preview immediately with blob URL
    if (localBlobUrlRef.current) URL.revokeObjectURL(localBlobUrlRef.current);
    const blobUrl = URL.createObjectURL(file);
    localBlobUrlRef.current = blobUrl;
    setUrlInput(blobUrl);
    setAvatarUrl(blobUrl);

    // Upload to server so URL persists across sessions
    setIsUploadingGlb(true);
    try {
      const serverUrl = await uploadModel(file);
      URL.revokeObjectURL(blobUrl);
      localBlobUrlRef.current = '';
      setUrlInput(serverUrl);
      setAvatarUrl(serverUrl);
      addToast('Avatar salvo no servidor — não será perdido ao recarregar.', 'success');
    } catch {
      addToast('Avatar carregado localmente. Será perdido ao recarregar a página.', 'warning', 6000);
    } finally {
      setIsUploadingGlb(false);
    }
  };

  // ── Speech handlers ─────────────────────────────────────────
  const handleAddSpeech = () => setSpeechText(speechInput.trim());
  const handleClearSpeech = () => { setSpeechInput(''); setSpeechText(''); };

  // ── Story handlers ──────────────────────────────────────────
  const storyIdForShare = linkedStoryId || publishedStoryId || '';
  const storyShareUrl = storyIdForShare
    ? `${window.location.origin}/story/${encodeURIComponent(storyIdForShare)}`
    : '';

  const copyStoryLink = async () => {
    if (!storyShareUrl) return;
    try { await navigator.clipboard.writeText(storyShareUrl); } catch { /* ignore */ }
    setCopiedStory(true);
    setTimeout(() => setCopiedStory(false), 1500);
  };

  // ── Shared inner content ─────────────────────────────────────
  const innerContent = (
    <>
      {/* Progress bar */}
      <SceneProgressBar
        avatarUrl={avatarUrl}
        speechText={speechText}
        audioUrl={audio?.audioUrl}
        sceneId={currentSceneId}
        onTabChange={setActiveTab}
      />

      {/* Tab navigation */}
      <div data-tour="panel-tabs" className="flex shrink-0 border-b border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            data-tour={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 text-[11px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-gray-750'
                : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent'
            }`}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* ══ AVATAR TAB ══════════════════════════════════════ */}
        {activeTab === 'avatar' && (
          <>
            <button
              data-tour="avatar-upload"
              onClick={() => setShowAvaturn((v) => !v)}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
            >
              {t('openAvaturn')}
            </button>

            <div className="flex gap-2">
              <button
                onClick={handleLoadSavedAvatars}
                disabled={isLoadingAvatars || showAvaturn}
                className="flex-1 py-2 rounded-xl bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
              >
                {isLoadingAvatars ? t('loadingAvatars') : t('loadMyAvatars')}
              </button>
              <button
                onClick={handlePickLocalGlb}
                disabled={isUploadingGlb}
                className="flex-1 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-medium transition-colors"
              >
                {isUploadingGlb ? '⏳ Enviando...' : 'GLB / VRM'}
              </button>
            </div>

            <input ref={localGlbInputRef} type="file" accept=".glb,.vrm,model/gltf-binary,model/vrm" onChange={handleLocalGlbChange} className="hidden" />

            {savedAvatars.length > 0 && (
              <select onChange={handleSelectSavedAvatar} defaultValue=""
                className="w-full rounded-xl bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 focus:outline-none focus:border-blue-500">
                <option value="" disabled>{t('chooseAvatar')}</option>
                {savedAvatars.map((a) => {
                  const url = a?.url || a?.modelUrl || a?.glbUrl || '';
                  const id = a?.id || a?.avatarId || 'avatar';
                  return <option key={id} value={url}>{id}</option>;
                })}
              </select>
            )}
            {hasLoadedAvatars && !isLoadingAvatars && !avatarListError && savedAvatars.length === 0 && (
              <p className="text-xs text-gray-500">{t('noSavedAvatars')}</p>
            )}
            {avatarListError && <p className="text-xs text-red-400">{avatarListError}</p>}

            {showAvaturn && <AvaturnEmbed onExport={handleAvaturnExport} onClose={() => setShowAvaturn(false)} />}

            <div className="flex gap-2">
              <input type="text" value={urlInput}
                onChange={(e) => { setUrlInput(e.target.value); setAvatarUrl(e.target.value); }}
                placeholder={t('avatarUrl')}
                className="flex-1 min-w-0 rounded-xl bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
              <button onClick={handleLoad}
                className="shrink-0 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors">
                {t('loadAvatar')}
              </button>
            </div>

            {/* Pose */}
            <div data-tour="pose-selector" className="flex flex-col gap-2">
              <div className="flex items-center gap-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pose</p>
                <TooltipIcon text="Define a animação base do avatar: idle (parado), wave (acenando), speaker (palestrando) e outros." />
              </div>
              <select value={posePreset} onChange={(e) => setPosePreset(e.target.value)}
                className="w-full rounded-xl bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 focus:outline-none focus:border-blue-500">
                <option value="idle">{t('poseIdle')}</option>
                <option value="walk">{t('poseWalk')}</option>
                <option value="run">{t('poseRun')}</option>
                <option value="dance">{t('poseDance')}</option>
                <option value="speaker">{t('poseSpeaker')}</option>
                <option value="neutral">{t('poseNeutral')}</option>
                <option value="wave">{t('poseWave')}</option>
                <option value="hands_on_hips">{t('poseHandsOnHips')}</option>
                <option value="salute">{t('poseSalute')}</option>
                <option value="arms_crossed">{t('poseArmsCrossed')}</option>
                <option value="t_pose">{t('poseTPose')}</option>
              </select>
            </div>

            {/* Advanced controls toggle */}
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center justify-between w-full text-xs text-gray-400 hover:text-gray-200 py-1 transition-colors"
            >
              <span>⚙️ Configurações avançadas</span>
              <span>{showAdvanced ? '▲' : '▼'}</span>
            </button>
            {showAdvanced && (
              <div className="border border-gray-700 rounded-xl p-3">
                <TransformControls transform={transform} onUpdate={setTransform} />
              </div>
            )}
          </>
        )}

        {/* ══ FALA TAB ════════════════════════════════════════ */}
        {activeTab === 'fala' && (
          <>
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {t('speech')}
              </p>
              <textarea
                rows={4}
                value={speechInput}
                onChange={(e) => setSpeechInput(e.target.value)}
                placeholder={t('speechPlaceholder')}
                className="w-full rounded-xl bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
              />
              <div className="flex gap-2">
                <button onClick={handleAddSpeech}
                  className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors">
                  {t('addSpeech')}
                </button>
                {speechText && (
                  <button onClick={handleClearSpeech}
                    className="py-2 px-3 rounded-xl bg-gray-600 hover:bg-gray-500 text-white text-sm transition-colors">
                    {t('clearSpeech')}
                  </button>
                )}
              </div>

              {tts && (
                <>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => tts.generate(speechInput)}
                      disabled={tts.isGenerating || !speechInput.trim()}
                      className="flex-1 py-3 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-all shadow-md shadow-purple-900/30"
                    >
                      {tts.isGenerating ? '⏳ Gerando voz...' : '🎙️ Gerar Voz (TTS)'}
                    </button>
                    <TooltipIcon text="Converte o texto acima em áudio com voz sintética e sincroniza os lábios do avatar automaticamente." />
                  </div>
                  {tts.error && <p className="text-xs text-red-400">{tts.error}</p>}
                </>
              )}

              {/* Lip sync intensity slider */}
              {audio && (() => {
                const amp = audio.lipSyncConfig?.amplitudeMultiplier ?? 18;
                // Map amplitudeMultiplier [6..33] → slider [1..10]
                const sliderVal = Math.min(10, Math.max(1, Math.round((amp - 6) / 3) + 1));
                const label = sliderVal <= 3 ? 'Suave' : sliderVal <= 7 ? 'Normal' : 'Intensa';
                const labelColor = sliderVal <= 3 ? 'text-blue-400' : sliderVal <= 7 ? 'text-cyan-400' : 'text-orange-400';
                return (
                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-gray-400">🔊 Intensidade da fala</span>
                        <TooltipIcon text="Controla o quanto a boca do avatar se move. Aumente se os lábios parecerem parados." />
                      </div>
                      <span className={`text-xs font-semibold ${labelColor}`}>{label}</span>
                    </div>
                    <input
                      type="range" min="1" max="10" step="1"
                      value={sliderVal}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        audio.updateLipSyncConfig({ amplitudeMultiplier: 6 + (v - 1) * 3 });
                      }}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600 select-none">
                      <span>Suave</span><span>Normal</span><span>Intensa</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {audio && (
              <AudioPanel
                speechText={speechText}
                audioUrl={audio.audioUrl}
                isPlaying={audio.isPlaying}
                isRecording={audio.isRecording}
                isTTSLoading={audio.isTTSLoading}
                error={audio.error}
                audioMetrics={audio.audioMetrics}
                audioProcessing={audio.audioProcessing}
                lipSyncConfig={audio.lipSyncConfig}
                visemeTimeline={audio.visemeTimeline}
                isSpeaking={audio.isSpeaking}
                onGenerateTTS={audio.generateWithElevenLabs}
                onSpeakWebSpeech={audio.speakWithWebSpeech}
                onStopWebSpeech={audio.stopWebSpeech}
                onLoadFile={audio.loadFile}
                onLoadVisemeFile={audio.loadVisemeTimeline}
                onClearVisemeTimeline={audio.clearVisemeTimeline}
                onGenerateVisemeFromText={audio.generateVisemeTimelineFromText}
                onPlay={audio.play}
                onPause={audio.pause}
                onStop={audio.stop}
                onStartRec={audio.startRecording}
                onStopRec={audio.stopRecording}
                onAudioProcessingChange={audio.updateAudioProcessing}
                onLipSyncConfigChange={audio.updateLipSyncConfig}
              />
            )}
          </>
        )}

        {/* ══ CENA TAB ════════════════════════════════════════ */}
        {activeTab === 'cena' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cena</p>
            <input
              type="text"
              value={sceneTitle}
              onChange={(e) => setSceneTitle(e.target.value)}
              placeholder={t('sceneTitlePlaceholder')}
              className="w-full rounded-xl bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <button onClick={onSave} disabled={isSaving}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
              {isSaving ? t('saving') : `💾 ${t('saveScene')}`}
            </button>
            <button onClick={onAddCurrentSceneToStory}
              className="w-full py-2 rounded-xl bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium transition-colors">
              {t('addCurrentSceneToStory')}
            </button>

            {currentSceneId && (
              <div className="rounded-xl bg-gray-700/50 border border-gray-600 px-3 py-2">
                <p className="text-[10px] text-gray-400 mb-0.5">ID da cena</p>
                <p className="text-xs text-cyan-300 font-mono break-all">{currentSceneId}</p>
              </div>
            )}
          </div>
        )}

        {/* ══ HISTÓRIA TAB ════════════════════════════════════ */}
        {activeTab === 'historia' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('story')}</p>

            {isStoryLinked ? (
              <div className="rounded-xl border border-emerald-700/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200 break-all">
                História vinculada: {linkedStoryId}
              </div>
            ) : (
              <>
                <input type="text" value={storyTitle} onChange={(e) => setStoryTitle(e.target.value)}
                  placeholder={t('storyTitlePlaceholder')}
                  className="w-full rounded-xl bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                <textarea rows={2} value={storyDescription} onChange={(e) => setStoryDescription(e.target.value)}
                  placeholder={t('storyDescriptionPlaceholder')}
                  className="w-full rounded-xl bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
                />
              </>
            )}

            <div className="flex gap-2">
              <input type="text" value={manualSceneId} onChange={(e) => setManualSceneId(e.target.value)}
                placeholder={t('sceneId')}
                className="flex-1 min-w-0 rounded-xl bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
              <button onClick={() => { const v = manualSceneId.trim(); if (!v) return; onAddSceneIdToStory(v); setManualSceneId(''); }}
                className="shrink-0 px-3 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-medium transition-colors">
                {t('addSceneById')}
              </button>
            </div>

            <button onClick={onSaveStory} disabled={isStorySaving}
              className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
              {isStorySaving ? t('savingStory') : isStoryLinked ? `📝 ${t('updateStory')}` : `📝 ${t('saveStory')}`}
            </button>
            <button onClick={onPublishStory} disabled={isStorySaving}
              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
              🚀 {t('publish')}
            </button>

            {storyShareUrl && (
              <>
                <div className="rounded-xl bg-gray-900 px-3 py-2 text-xs text-blue-300 break-all">{storyShareUrl}</div>
                <button onClick={copyStoryLink}
                  className="w-full py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors">
                  {copiedStory ? '✅ Copiado!' : '🔗 Copiar link'}
                </button>
              </>
            )}
          </div>
        )}

      </div>
    </>
  );

  // ── Render: sidebar (desktop) + drawer (mobile) ──────────────
  return (
    <>
      {/* Desktop sidebar */}
      <aside data-tour="left-panel" className="hidden md:flex md:w-80 md:shrink-0 md:flex-col bg-gray-800 border-r border-gray-700 overflow-hidden">
        {innerContent}
      </aside>

      {/* Mobile drawer */}
      {mobilePanelTab && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={onMobilePanelClose}
          />
          <div className="fixed bottom-16 left-0 right-0 z-50 md:hidden bg-gray-800 rounded-t-2xl flex flex-col overflow-hidden shadow-2xl"
            style={{ maxHeight: '78vh' }}
          >
            {/* drag handle */}
            <button onClick={onMobilePanelClose} className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-gray-600 rounded-full" />
            </button>
            {innerContent}
          </div>
        </>
      )}
    </>
  );
}
