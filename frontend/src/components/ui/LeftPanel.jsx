import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AvatarCreatorModal from './AvatarCreatorModal';
import TransformControls from './TransformControls';
import AudioPanel from './AudioPanel';
import SceneProgressBar from './SceneProgressBar';
import Icon from './Icon';
import StoryQrModal from './StoryQrModal';
import MobileStoryScenes from './MobileStoryScenes';
import { TooltipIcon } from './Tooltip';
import { useSceneStore } from '../../store/useSceneStore';
import { listAvaturnAvatars, uploadModel } from '../../api/sceneApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../auth/AuthContext';

const AVATURN_USER_ID_KEY = 'avaturn:userId';

const AVATAR_CREATORS = [
  { id: 'avaturn',         labelKey: 'acAvaturn',         icon: 'avatar' },
  { id: 'characterstudio', labelKey: 'acCharacterStudio', icon: 'palette' },
  { id: 'gallery',         labelKey: 'acGallery',         icon: 'folder' },
  { id: 'valid',           labelKey: 'acValid',           icon: 'avatar' },
];

const TAB_DEFS = [
  { id: 'avatar',   labelKey: 'tabAvatar',   icon: 'avatar' },
  { id: 'fala',     labelKey: 'tabFala',     icon: 'speech' },
  { id: 'cena',     labelKey: 'tabCena',     icon: 'scene' },
  { id: 'historia', labelKey: 'tabHistoria', icon: 'story' },
];

// Animations the user has uploaded before, so a story that reuses one does not
// mean uploading the same file per scene. Kept on the device: the upload
// endpoint has no listing, and this covers the case that actually hurts —
// building several scenes in a row.
// The four the interface speaks; the backend drops anything else.
const NARRATION_LANGUAGES = [
  { code: 'pt', label: 'PT' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
];

const VRMA_RECENTS_KEY = 'contar:vrma-recents';

export default function LeftPanel({
  onAddCurrentSceneToStory,
  onAddSceneIdToStory,
  onSaveStory,
  onPublishStory,
  onUnpublishStory,
  isStorySaving,
  isStoryLinked,
  isStoryPublic,
  audio,
  vrmaUrl,
  onLoadVrma,
  mobilePanelTab,
  onMobilePanelClose,
  textDisplayMode = 'bubble',
  onTextDisplayModeChange,
  avatarClips = [],
  jawApi,
}) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { user } = useAuth();
  const TABS = TAB_DEFS.map((tab) => ({ ...tab, label: t(tab.labelKey) }));
  const CREATORS = AVATAR_CREATORS.map((c) => ({ ...c, label: t(c.labelKey) }));

  const {
    avatarUrl, setAvatarUrl,
    transform, setTransform, setFullTransform,
    posePreset, setPosePreset,
    speechText, setSpeechText,
    narrationLanguage, editingLanguage, setEditingLanguage, filledNarrationLanguages,
    lipsyncCapability,
    sceneTitle, setSceneTitle,
    storyTitle, setStoryTitle,
    storyDescription, setStoryDescription,
    currentSceneId,
    currentStoryId: linkedStoryId,
    animSpeed, setAnimSpeed,
    animLoopOnce, setAnimLoopOnce,
    vrmExpression, setVrmExpression,
  } = useSceneStore();

  const DEFAULT_TRANSFORM = { positionX: 0, positionY: 0, positionZ: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1 };
  // Per-pose transform memory: keyed by pose name, values are transform objects.
  // Initialized with the current pose's transform so an existing scene's settings aren't lost.
  const [transformByPose, setTransformByPose] = useState(() => ({ [posePreset]: { ...transform } }));

  const handlePoseChange = (newPose) => {
    setTransformByPose((prev) => ({ ...prev, [posePreset]: { ...transform } }));
    setFullTransform(transformByPose[newPose] ?? DEFAULT_TRANSFORM);
    setPosePreset(newPose);
  };

  const handleResetTransform = () => {
    setTransformByPose((prev) => ({ ...prev, [posePreset]: DEFAULT_TRANSFORM }));
    setFullTransform(DEFAULT_TRANSFORM);
  };

  const handleNewScene = () => {
    if (!window.confirm(t('lpNewSceneConfirm'))) return;
    audio?.stop?.();
    setSpeechInput('');
    setTransformByPose({ idle: DEFAULT_TRANSFORM });
    const hasStory = useSceneStore.getState().storyScenes.length > 0;
    const keepAvatarUrl = hasStory ? avatarUrl : '';
    setUrlInput(keepAvatarUrl);
    useSceneStore.setState({
      currentSceneId: '',
      avatarUrl: keepAvatarUrl,
      speechText: '',
      sceneTitle: '',
      posePreset: 'idle',
      narrativeAudioUrl: '',
      transform: DEFAULT_TRANSFORM,
      timelineBlocks: [],
    });
  };

  const [activeTab, setActiveTab] = useState('avatar');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sync desktop tab when mobile nav changes
  useEffect(() => {
    if (mobilePanelTab) setActiveTab(mobilePanelTab);
  }, [mobilePanelTab]);

  // Avatar tab state
  const [urlInput, setUrlInput] = useState(avatarUrl);
  const [showCreatorModal, setShowCreatorModal]             = useState(false);
  const [selectedCreator, setSelectedCreator]     = useState('avaturn');
  const [savedAvatars, setSavedAvatars] = useState([]);
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(false);
  const [avatarListError, setAvatarListError] = useState('');
  const [hasLoadedAvatars, setHasLoadedAvatars] = useState(false);
  const [isUploadingGlb, setIsUploadingGlb] = useState(false);
  const localGlbInputRef = useRef(null);
  const localBlobUrlRef = useRef('');
  const vrmaInputRef = useRef(null);
  const vrmaBlobUrlRef = useRef('');

  // Fala tab state
  const [speechInput, setSpeechInput] = useState(speechText);
  // Which languages already have something recorded or written, so the picker
  // can show at a glance what is still missing.
  const filledLanguages = filledNarrationLanguages();

  // História tab state
  const [manualSceneId, setManualSceneId] = useState('');
  const [copiedStory, setCopiedStory] = useState(false);
  const [showStoryQr, setShowStoryQr] = useState(false);

  useEffect(() => { setUrlInput(avatarUrl || ''); }, [avatarUrl]);
  // Keep the speech input in sync with the store — e.g. when a scene is loaded
  // for editing, its narration text should appear in the field, ready to edit.
  // Also on a language change: without it, switching languages left whatever
  // was in the box still sitting there, so the Portuguese draft looked like it
  // had become the English one.
  useEffect(() => { setSpeechInput(speechText || ''); }, [speechText, editingLanguage]);

  useEffect(() => () => {
    if (localBlobUrlRef.current) {
      const activeBlobUrl = localBlobUrlRef.current;
      const currentAvatarUrl = useSceneStore.getState().avatarUrl;
      if (currentAvatarUrl !== activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl);
        localBlobUrlRef.current = '';
      }
    }
    if (vrmaBlobUrlRef.current) {
      URL.revokeObjectURL(vrmaBlobUrlRef.current);
      vrmaBlobUrlRef.current = '';
    }
  }, []);

  // ── Avatar handlers ────────────────────────────────────────
  const handleLoad = () => { if (urlInput.trim()) setAvatarUrl(urlInput.trim()); };

  const handleAvaturnExport = (url) => {
    const bust = url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
    setUrlInput(url);
    setAvatarUrl(bust);
    setShowCreatorModal(false);
  };

  const handleLoadSavedAvatars = async () => {
    const configuredUserId = String(import.meta.env.VITE_AVATURN_USER_ID || '').trim();
    // Prefer the id linked to the ContAR account — it follows the user across
    // devices/browsers. Fall back to this browser's local copy, then the
    // shared dev/test id from env, for anonymous or pre-migration sessions.
    const avaturnUserId = user?.avaturnUserId || localStorage.getItem(AVATURN_USER_ID_KEY) || configuredUserId || '';
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
    // Prevent a second upload while one is already in flight
    if (isUploadingGlb) return;
    const lower = file.name.toLowerCase();
    const valid = lower.endsWith('.glb') || lower.endsWith('.vrm')
      || file.type === 'model/gltf-binary' || file.type === 'model/vrm'
      || file.type === 'application/octet-stream';
    if (!valid) { e.target.value = ''; return; }
    e.target.value = '';

    // Validate size before uploading (Cloudinary free plan: 10 MB)
    const MAX_MODEL_MB = 10;
    if (file.size > MAX_MODEL_MB * 1024 * 1024) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      addToast(t('lpModelTooLarge', { size: sizeMB, max: MAX_MODEL_MB }), 'error', 8000);
      return;
    }

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
      // Warn if the returned URL is localhost (backend BACKEND_URL env var not configured)
      if (/localhost|127\.0\.0\.1/.test(serverUrl)) {
        addToast('Avatar salvo localmente. Configure BACKEND_URL no servidor para persistência em produção.', 'warning', 8000);
      } else {
        addToast(t('epAvatarSaved'), 'success');
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 413) {
        addToast(t('lpModelTooLarge', { size: (file.size / 1024 / 1024).toFixed(1), max: MAX_MODEL_MB }), 'error', 8000);
      } else if (status === 401 || status === 403) {
        addToast(t('lpModelUploadAuth'), 'error', 6000);
      } else if (status === 429) {
        addToast(t('lpModelUploadRateLimit'), 'warning', 6000);
      } else {
        addToast(t('lpModelUploadFailed'), 'warning', 6000);
      }
    } finally {
      setIsUploadingGlb(false);
    }
  };

  const [vrmaRecents, setVrmaRecents] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(VRMA_RECENTS_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter((r) => r?.url && r?.name).slice(0, 5) : [];
    } catch { return []; }
  });

  const rememberVrma = (name, url) => {
    // Blob URLs die with the page, so only a real uploaded one is worth keeping.
    if (!url || url.startsWith('blob:')) return;
    setVrmaRecents((prev) => {
      const next = [{ name, url }, ...prev.filter((r) => r.url !== url)].slice(0, 5);
      try { localStorage.setItem(VRMA_RECENTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const handleVrmaChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    // Preview from a blob straight away, then swap in the uploaded URL. Without
    // the upload the animation only existed for the life of the page, so a
    // scene saved with a custom .vrma reopened without it.
    if (vrmaBlobUrlRef.current) URL.revokeObjectURL(vrmaBlobUrlRef.current);
    const blobUrl = URL.createObjectURL(file);
    vrmaBlobUrlRef.current = blobUrl;
    onLoadVrma?.(blobUrl);

    try {
      const serverUrl = await uploadModel(file);
      URL.revokeObjectURL(blobUrl);
      vrmaBlobUrlRef.current = '';
      onLoadVrma?.(serverUrl);
      rememberVrma(file.name.replace(/\.vrma$/i, ''), serverUrl);
    } catch (err) {
      // Keep the blob so the animation still plays this session, but say so —
      // it will not survive a reload.
      const status = err?.response?.status;
      addToast(
        status === 413 ? t('lpModelTooLarge', { size: (file.size / 1024 / 1024).toFixed(1), max: 10 })
          : t('lpVrmaUploadFailed'),
        'warning',
        6000,
      );
    }
  };

  const handleClearVrma = () => {
    if (vrmaBlobUrlRef.current) {
      URL.revokeObjectURL(vrmaBlobUrlRef.current);
      vrmaBlobUrlRef.current = '';
    }
    onLoadVrma?.('');
  };

  // ── Speech handlers ─────────────────────────────────────────
  const handleAddSpeech = () => setSpeechText(speechInput.trim());
  const handleClearSpeech = () => { setSpeechInput(''); setSpeechText(''); };

  // ── Story handlers ──────────────────────────────────────────
  const storyShareUrl = linkedStoryId
    ? `${window.location.origin}/story/${encodeURIComponent(linkedStoryId)}`
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
                : 'text-gray-400 hover:text-gray-300 border-b-2 border-transparent'
            }`}
          >
            <Icon name={tab.icon} className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* ══ AVATAR TAB ══════════════════════════════════════ */}
        {activeTab === 'avatar' && (
          <>
            {/* Creator picker */}
            <div className="grid grid-cols-2 gap-1.5">
              {CREATORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCreator(c.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 px-2 text-xs font-medium transition-all ${
                    selectedCreator === c.id
                      ? 'border-cyan-500/60 bg-cyan-500/15 text-white'
                      : 'border-white/8 bg-gray-800 text-gray-400 hover:text-gray-200 hover:border-white/15'
                  }`}
                >
                  <Icon name={c.icon} className="w-3.5 h-3.5" /> {c.label}
                </button>
              ))}
            </div>

            <button
              data-tour="avatar-upload"
              onClick={() => setShowCreatorModal((v) => !v)}
              className="w-full py-3 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-semibold transition-colors"
            >
              {avatarUrl ? t('editAvatar') : t('openAvatarCreator')}
            </button>

            {/* File upload + my avatars row */}
            <div className="flex gap-2">
              <button
                onClick={handleLoadSavedAvatars}
                disabled={isLoadingAvatars || showCreatorModal}
                className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs font-medium transition-colors"
              >
                {isLoadingAvatars ? t('loadingAvatars') : t('loadMyAvatars')}
              </button>
              <button
                onClick={handlePickLocalGlb}
                disabled={isUploadingGlb}
                className="flex-1 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 disabled:opacity-60 text-white text-xs font-medium transition-colors"
              >
                {isUploadingGlb ? t('uploading') : 'GLB / VRM'}
              </button>
            </div>

            <input ref={localGlbInputRef} type="file" accept=".glb,.vrm,model/gltf-binary,model/vrm" onChange={handleLocalGlbChange} className="hidden" />

            {savedAvatars.length > 0 && (
              <select onChange={handleSelectSavedAvatar} defaultValue=""
                className="w-full rounded-xl bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 focus:outline-none focus:border-cyan-500">
                <option value="" disabled>{t('chooseAvatar')}</option>
                {savedAvatars.map((a) => {
                  const url = a?.url || a?.modelUrl || a?.glbUrl || '';
                  const id = a?.id || a?.avatarId || 'avatar';
                  return <option key={id} value={url}>{id}</option>;
                })}
              </select>
            )}
            {hasLoadedAvatars && !isLoadingAvatars && !avatarListError && savedAvatars.length === 0 && (
              <p className="text-xs text-gray-400">{t('noSavedAvatars')}</p>
            )}
            {avatarListError && <p className="text-xs text-red-400">{avatarListError}</p>}

            {/* Opens in a full-screen modal (Avaturn's SDK needs a sizable container) */}
            {showCreatorModal && (
              <AvatarCreatorModal
                creator={selectedCreator}
                onExport={handleAvaturnExport}
                onClose={() => setShowCreatorModal(false)}
              />
            )}

            <div className="flex gap-2">
              <input type="text" value={urlInput}
                onChange={(e) => { setUrlInput(e.target.value); setAvatarUrl(e.target.value); }}
                placeholder={t('avatarUrl')}
                className="flex-1 min-w-0 rounded-xl bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-cyan-500"
              />
              <button onClick={handleLoad}
                className="shrink-0 px-3 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-medium transition-colors">
                {t('loadAvatar')}
              </button>
            </div>

            {/* VRM Animation (.vrma) */}
            {onLoadVrma && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('lpVrmAnimation')}</p>
                  <TooltipIcon text={t('lpVrmaTooltip')} />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => vrmaInputRef.current?.click()}
                    className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1"
                  >
                    <Icon name="upload" className="w-3.5 h-3.5" /> {t('lpLoadVrma')}
                  </button>
                  {vrmaUrl && (
                    <button
                      onClick={handleClearVrma}
                      className="px-3 py-2 rounded-xl bg-gray-600 hover:bg-gray-500 text-white text-xs transition-colors"
                      title={t('lpRemoveVrmAnim')}
                    >
                      <Icon name="close" className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <input
                  ref={vrmaInputRef}
                  type="file"
                  accept=".vrma"
                  onChange={handleVrmaChange}
                  className="hidden"
                />
                {vrmaRecents.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('lpVrmaRecent')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {vrmaRecents.map((item) => (
                        <button
                          key={item.url}
                          onClick={() => onLoadVrma?.(item.url)}
                          title={item.name}
                          className={`max-w-full truncate rounded-lg px-2.5 py-1 text-[11px] transition-colors ${
                            vrmaUrl === item.url
                              ? 'bg-cyan-700 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {vrmaUrl ? (
                  <p className="text-xs text-emerald-400 flex items-center gap-1">
                    <Icon name="check" className="w-3.5 h-3.5" /> {t('lpVrmAnimApplied')}
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400">
                    {t('lpDownloadVrmaAt')}{' '}
                    <a href="https://hub.vroid.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline underline-offset-2">hub.vroid.com</a>
                    {' '}→ Animations
                  </p>
                )}
              </div>
            )}

            {/* Pose */}
            <div data-tour="pose-selector" className="flex flex-col gap-2">
              <div className="flex items-center gap-1">
                <p id="pose-selector-label" className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pose</p>
                <TooltipIcon text={t('lpPoseTooltip')} />
              </div>
              {/* Named by the heading above it: a <p> sitting next to a select
                  looks like a label and is tied to nothing. */}
              <select
                aria-labelledby="pose-selector-label"
                value={posePreset} onChange={(e) => handlePoseChange(e.target.value)}
                className="w-full rounded-xl bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 focus:outline-none focus:border-cyan-500">
                {/* When a model's embedded animation is active, posePreset is
                    "clip:<name>", which matches none of the options below — the
                    browser would then show the first option (idle), making it
                    look like idle was selected. This hidden, matching option
                    keeps the dropdown reflecting the active model animation. */}
                {String(posePreset).startsWith('clip:') && (
                  <option value={posePreset} hidden>
                    {t('lpModelAnimations')}: {avatarClips.find((c) => `clip:${c.index}` === posePreset)?.name || String(posePreset).slice(5)}
                  </option>
                )}
                <optgroup label="Animadas">
                  <option value="idle">{t('poseIdle')}</option>
                  <option value="walk">{t('poseWalk')}</option>
                  <option value="walk_circle">{t('poseWalkCircle')}</option>
                  <option value="slow_run">{t('poseSlowRun')}</option>
                  <option value="run">{t('poseRun')}</option>
                  <option value="dance">{t('poseDance')}</option>
                  <option value="speaker">{t('poseSpeaker')}</option>
                  <option value="speaker_wide">{t('poseSpeakerWide')}</option>
                  <option value="speaker_left">{t('poseSpeakerLeft')}</option>
                  <option value="speaker_right">{t('poseSpeakerRight')}</option>
                </optgroup>
                <optgroup label="Estáticas">
                  <option value="neutral">{t('poseNeutral')}</option>
                  <option value="wave">{t('poseWave')}</option>
                  <option value="hands_on_hips">{t('poseHandsOnHips')}</option>
                  <option value="salute">{t('poseSalute')}</option>
                  <option value="arms_crossed">{t('poseArmsCrossed')}</option>
                  <option value="think">{t('poseThink')}</option>
                  <option value="point">{t('posePoint')}</option>
                  <option value="bow">{t('poseBow')}</option>
                  <option value="pray">{t('posePray')}</option>
                  <option value="shrug">{t('poseShrug')}</option>
                  <option value="t_pose">{t('poseTPose')}</option>
                </optgroup>
              </select>
            </div>

            {/* Model's own embedded animations — selectable directly, in
                addition to the Mixamo-based poses above. */}
            {avatarClips.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('lpModelAnimations')}</p>
                  <TooltipIcon text={t('lpModelAnimationsTooltip')} />
                </div>
                <div className="flex flex-col gap-1.5">
                  {avatarClips.map(({ name, index }) => {
                    const value = `clip:${index}`;
                    const active = posePreset === value;
                    return (
                      <button
                        key={index}
                        onClick={() => handlePoseChange(value)}
                        title={name}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                          active
                            ? 'bg-cyan-700 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        <Icon name="play" className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Animation speed + loop */}
            {(['idle','walk','walk_circle','slow_run','run','dance','speaker'].includes(posePreset) || String(posePreset).startsWith('clip:')) && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('lpAnimation')}</p>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-400 w-16 shrink-0">{t('lpSpeed')}</label>
                  <input
                    type="range"
                    min="0.1" max="3" step="0.05"
                    aria-label={t('lpSpeed')}
                    value={animSpeed ?? 1}
                    onChange={(e) => setAnimSpeed(parseFloat(e.target.value))}
                    className="flex-1 accent-cyan-400"
                  />
                  <span className="text-xs text-cyan-300 w-10 text-right">{(animSpeed ?? 1).toFixed(2)}×</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={animLoopOnce ?? false}
                    onChange={(e) => setAnimLoopOnce(e.target.checked)}
                    className="accent-cyan-400"
                  />
                  <span className="text-xs text-gray-300">{t('lpPlayOnce')}</span>
                </label>
              </div>
            )}

            {/* VRM Expressions — only shown for .vrm avatars */}
            {avatarUrl && /\.vrm(\?|$)/i.test(avatarUrl) && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('lpExpressionVrm')}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { value: '',          label: t('lpExprNeutral') },
                  { value: 'happy',     label: t('lpExprHappy') },
                  { value: 'sad',       label: t('lpExprSad') },
                  { value: 'angry',     label: t('lpExprAngry') },
                  { value: 'surprised', label: t('lpExprSurprised') },
                  { value: 'relaxed',   label: t('lpExprRelaxed') },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setVrmExpression(value)}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      (vrmExpression ?? '') === value
                        ? 'bg-cyan-700 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Advanced controls toggle */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center justify-between flex-1 text-xs text-gray-400 hover:text-gray-200 py-1 transition-colors"
              >
                <span className="flex items-center gap-1"><Icon name="settings" className="w-3.5 h-3.5" /> {t('lpAdvancedSettings')}</span>
                <span>{showAdvanced ? '▲' : '▼'}</span>
              </button>
              <TooltipIcon text={t('lpAdvancedSettingsHelp')} />
            </div>
            {showAdvanced && (
              <div className="border border-gray-700 rounded-xl p-3">
                <TransformControls transform={transform} onUpdate={setTransform} onReset={handleResetTransform} />
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
              <p className="text-xs text-gray-400">{t('lpSpeechHint')}</p>

              {/* Which language this narration is for. One scene can carry the
                  same line in several, each with its own recording, so a QR
                  code left at a poster serves whoever scans it. The text and
                  audio controls below always act on the language picked here. */}
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-gray-400">{t('lpNarrationLanguage')}</p>
                <div className="flex flex-wrap gap-1">
                  {NARRATION_LANGUAGES.map(({ code, label }) => {
                    const filled = filledLanguages.includes(code);
                    const active = editingLanguage === code;
                    return (
                      <button
                        key={code}
                        onClick={() => {
                          // Keep what is in the box before moving on — losing
                          // a typed line to a language switch is not a thing
                          // anyone would expect.
                          if (speechInput !== speechText) setSpeechText(speechInput);
                          setEditingLanguage(code);
                        }}
                        title={code === narrationLanguage ? t('lpNarrationOriginal') : undefined}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] transition-colors ${
                          active ? 'bg-cyan-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {label}
                        {code === narrationLanguage && <span aria-hidden className="opacity-70">★</span>}
                        {filled && !active && <Icon name="check" className="h-3 w-3 text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-400">
                  {editingLanguage === narrationLanguage
                    ? t('lpNarrationOriginalHint')
                    : t('lpNarrationTranslationHint')}
                </p>
              </div>

              <textarea
                rows={4}
                value={speechInput}
                onChange={(e) => setSpeechInput(e.target.value)}
                placeholder={t('speechPlaceholder')}
                className="w-full rounded-xl bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-cyan-500 resize-none"
              />
              <div className="flex gap-2">
                <button onClick={handleAddSpeech}
                  className="flex-1 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-medium transition-colors">
                  {t('addSpeech')}
                </button>
                {speechText && (
                  <button onClick={handleClearSpeech}
                    className="py-2 px-3 rounded-xl bg-gray-600 hover:bg-gray-500 text-white text-sm transition-colors">
                    {t('clearSpeech')}
                  </button>
                )}
              </div>

              {/* Text display mode toggle */}
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-gray-400">{t('lpShowTextAs')}</p>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { value: 'bubble',   label: t('displayBubble') },
                    { value: 'subtitle', label: t('displaySubtitle') },
                    { value: 'none',     label: t('displayNone') },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => onTextDisplayModeChange?.(value)}
                      className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        textDisplayMode === value
                          ? 'bg-cyan-700 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lip sync intensity slider */}
              {audio && (() => {
                const amp = audio.lipSyncConfig?.amplitudeMultiplier ?? 18;
                // Map amplitudeMultiplier [6..33] → slider [1..10]
                const sliderVal = Math.min(10, Math.max(1, Math.round((amp - 6) / 3) + 1));
                const label = sliderVal <= 3 ? t('lpIntensitySoft') : sliderVal <= 7 ? t('lpIntensityNormal') : t('lpIntensityIntense');
                const labelColor = sliderVal <= 3 ? 'text-blue-400' : sliderVal <= 7 ? 'text-cyan-400' : 'text-orange-400';
                return (
                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-gray-400 flex items-center gap-1"><Icon name="volume" className="w-3.5 h-3.5" /> {t('lpSpeechIntensity')}</span>
                        <TooltipIcon text={t('lpLipSyncIntensityTooltip')} />
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
                      aria-label={t('lpSpeechIntensity')}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 select-none">
                      <span>{t('lpIntensitySoft')}</span><span>{t('lpIntensityNormal')}</span><span>{t('lpIntensityIntense')}</span>
                    </div>
                  </div>
                );
              })()}
              {jawApi?.hasSyntheticJaw && (
                <div className="border border-cyan-700/40 rounded-xl p-3 space-y-2 bg-cyan-950/30">
                  <p className="text-xs font-semibold text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                    <Icon name="settings" className="w-3.5 h-3.5" />
                    {t('lpJawConfig')}
                  </p>
                  <p className="text-[11px] text-gray-400">{t('lpJawConfigHelp')}</p>
                  <button
                    onClick={() => jawApi.startPlacement()}
                    className={`w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                      jawApi.jawPlacementMode
                        ? 'bg-cyan-500 text-white animate-pulse'
                        : 'bg-cyan-800 hover:bg-cyan-700 text-cyan-100'
                    }`}
                  >
                    {jawApi.jawPlacementMode ? t('lpJawClickModel') : t('lpJawPlace')}
                  </button>
                  {jawApi.hasBasePos && (
                    <>
                      {['x', 'y', 'z'].map((key) => (
                        <label key={key} className="flex items-center gap-1.5 text-xs text-gray-300">
                          <span className="w-14 shrink-0 font-medium">{t('lpJawAdjust')} {key.toUpperCase()}</span>
                          <input
                            type="range" min={-0.1} max={0.1} step={0.001}
                            value={jawApi.jawOffset[key]}
                            onChange={(e) => jawApi.setOffset({ ...jawApi.jawOffset, [key]: parseFloat(e.target.value) })}
                            className="flex-1 accent-cyan-400"
                          />
                          <span className="w-12 text-right font-mono text-[10px] text-cyan-300">{jawApi.jawOffset[key].toFixed(3)}</span>
                        </label>
                      ))}
                      <label className="flex items-center gap-1.5 text-xs text-gray-300">
                        <span className="w-14 shrink-0 font-medium">{t('lpJawRadius')}</span>
                        <input
                          type="range" min={0.01} max={0.2} step={0.005}
                          value={jawApi.jawRadius}
                          onChange={(e) => jawApi.setRadius(parseFloat(e.target.value))}
                          className="flex-1 accent-cyan-400"
                        />
                        <span className="w-12 text-right font-mono text-[10px] text-cyan-300">{jawApi.jawRadius.toFixed(3)}</span>
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>

            {audio && (
              <AudioPanel
                lipsyncCapability={lipsyncCapability}
                speechText={speechText}
                audioUrl={audio.audioUrl}
                isPlaying={audio.isPlaying}
                isRecording={audio.isRecording}
                isTTSLoading={audio.isTTSLoading}
                error={audio.error}
                audioMetrics={audio.audioMetrics}
                lipSyncConfig={audio.lipSyncConfig}
                visemeTimeline={audio.visemeTimeline}
                isSpeaking={audio.isSpeaking}
                onGenerateTTS={audio.generateWithAzure}
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
                onLipSyncConfigChange={audio.updateLipSyncConfig}
              />
            )}
          </>
        )}

        {/* ══ CENA TAB ════════════════════════════════════════ */}
        {activeTab === 'cena' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('lpSceneTab')}</p>

            {/* Active scene indicator */}
            {currentSceneId && (
              <div className="rounded-xl border border-cyan-700/40 bg-cyan-950/30 px-3 py-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                <span className="text-xs text-cyan-200 truncate">
                  {t('lpEditingScene', { name: sceneTitle || currentSceneId.slice(0, 8) })}
                </span>
              </div>
            )}

            <input
              type="text"
              value={sceneTitle}
              onChange={(e) => setSceneTitle(e.target.value)}
              placeholder={t('sceneTitlePlaceholder')}
              className="w-full rounded-xl bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-cyan-500"
            />

            <button onClick={onAddCurrentSceneToStory}
              title={t('lpAddSceneToStoryTooltip')}
              className="w-full py-3 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1.5">
              <Icon name="check" className="w-4 h-4" />
              {t('lpFinishAndAddScene')}
            </button>

            <button onClick={handleNewScene}
              title={t('lpNewSceneTooltip')}
              className="w-full py-2 rounded-xl border border-gray-600 hover:bg-gray-700 text-gray-200 text-sm font-medium transition-colors flex items-center justify-center gap-1.5">
              <Icon name="plus" className="w-4 h-4" />
              {t('lpNewScene')}
            </button>

            {currentSceneId && (
              <>
                <a
                  href={`/scene/${encodeURIComponent(currentSceneId)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <Icon name="eye" className="w-4 h-4" /> {t('lpPreviewScene')}
                </a>
                <div className="rounded-xl bg-gray-700/50 border border-gray-600 px-3 py-2">
                  <p className="text-[10px] text-gray-400 mb-0.5">{t('lpSceneIdLabel')}</p>
                  <p className="text-xs text-cyan-300 font-mono break-all">{currentSceneId}</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ HISTÓRIA TAB ════════════════════════════════════ */}
        {activeTab === 'historia' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('story')}</p>

            {isStoryLinked && (
              <div className={`rounded-xl border px-3 py-2 text-xs break-all flex items-center gap-1.5 ${
                isStoryPublic
                  ? 'border-emerald-700/40 bg-emerald-950/30 text-emerald-200'
                  : 'border-gray-600 bg-gray-700/40 text-gray-300'
              }`}>
                <Icon name={isStoryPublic ? 'unlock' : 'lock'} className="w-3.5 h-3.5 shrink-0" />
                {isStoryPublic ? t('lpStoryPublicBadge') : t('lpStoryLinked', { id: linkedStoryId.slice(0, 8) })}
              </div>
            )}
            <input type="text" value={storyTitle} onChange={(e) => setStoryTitle(e.target.value)}
              placeholder={t('storyTitlePlaceholder')}
              className="w-full rounded-xl bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-cyan-500"
            />
            <textarea rows={2} value={storyDescription} onChange={(e) => setStoryDescription(e.target.value)}
              placeholder={t('storyDescriptionPlaceholder')}
              className="w-full rounded-xl bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-cyan-500 resize-none"
            />

            <div className="flex gap-2">
              <input type="text" value={manualSceneId} onChange={(e) => setManualSceneId(e.target.value)}
                placeholder={t('sceneId')}
                className="flex-1 min-w-0 rounded-xl bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-cyan-500"
              />
              <button onClick={() => { const v = manualSceneId.trim(); if (!v) return; onAddSceneIdToStory(v); setManualSceneId(''); }}
                className="shrink-0 px-3 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium transition-colors">
                {t('addSceneById')}
              </button>
            </div>

            <MobileStoryScenes />

            <button onClick={onSaveStory} disabled={isStorySaving}
              className="w-full py-3 rounded-xl bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
              {isStorySaving ? t('savingStory') : <span className="flex items-center justify-center gap-1.5"><Icon name="edit" className="w-4 h-4" />{isStoryLinked ? t('updateStory') : t('saveStory')}</span>}
            </button>

            {isStoryPublic ? (
              <div className="flex gap-2">
                <div className="flex-1 rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-3 py-3 text-sm font-semibold text-emerald-200 flex items-center justify-center gap-1.5">
                  <Icon name="check" className="w-4 h-4" /> {t('lpPublished')}
                </div>
                <button onClick={onUnpublishStory} disabled={isStorySaving}
                  title={t('lpUnpublishTooltip')}
                  className="px-3 py-3 rounded-xl border border-gray-600 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors">
                  {t('lpUnpublish')}
                </button>
              </div>
            ) : (
              <button onClick={onPublishStory} disabled={isStorySaving}
                title={t('lpPublishTooltip')}
                className="w-full py-3 rounded-xl bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1.5">
                <Icon name="rocket" className="w-4 h-4" /> {t('publish')}
              </button>
            )}

            {/* Not gated on publishing. Publishing decides who *else* can open
                the link; it has no business standing between the author and a
                look at what they just built — least of all when the only other
                way to watch a story is to point a phone camera at something. */}
            {storyShareUrl && (
              <>
                <a
                  href={storyShareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                    isStoryPublic
                      ? 'bg-cyan-700 hover:bg-cyan-600 text-white'
                      : 'border border-gray-600 hover:bg-gray-700 text-gray-200'
                  }`}
                >
                  <Icon name="eye" className="w-4 h-4" /> {t('lpPreviewStory')}
                </a>
                {!isStoryPublic && (
                  <p className="text-[11px] text-gray-400 leading-snug">{t('lpPreviewStoryPrivate')}</p>
                )}
              </>
            )}

            {isStoryPublic && storyShareUrl && (
              <>
                <div className="rounded-xl bg-gray-900 px-3 py-2 text-xs text-cyan-300 break-all">{storyShareUrl}</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={copyStoryLink}
                    className="py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors flex items-center justify-center gap-1.5">
                    {copiedStory
                      ? <><Icon name="check" className="w-4 h-4 text-emerald-400" /> {t('lpCopied')}</>
                      : <><Icon name="link" className="w-4 h-4" /> {t('lpCopyLink')}</>
                    }
                  </button>
                  <button onClick={() => setShowStoryQr(true)}
                    className="py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors flex items-center justify-center gap-1.5">
                    <Icon name="qrcode" className="w-4 h-4" /> {t('qrButton')}
                  </button>
                </div>
              </>
            )}

            {showStoryQr && storyShareUrl && (
              <StoryQrModal
                url={storyShareUrl}
                title={storyTitle}
                onClose={() => setShowStoryQr(false)}
              />
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
