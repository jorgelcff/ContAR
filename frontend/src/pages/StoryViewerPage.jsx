import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from '../components/ui/Header';
import { getPublicStory, getScene } from '../api/sceneApi';
import useAudio from '../hooks/useAudio';

const SceneCanvas = lazy(() => import('../components/3d/SceneCanvas'));

export default function StoryViewerPage() {
  const { id } = useParams();
  const { t }  = useTranslation();
  const audio  = useAudio();

  const [story, setStory]               = useState(null);
  const [storyScenes, setStoryScenes]   = useState([]);
  const [index, setIndex]               = useState(0);
  const [sceneData, setSceneData]       = useState(null);
  const [hasStarted, setHasStarted]     = useState(false); // user must click ▶ first
  const [isPlaying, setIsPlaying]       = useState(false);
  const [scale, setScale]               = useState(1);
  const [sceneProgress, setSceneProgress] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [fullscreen, setFullscreen]     = useState(false);

  const playbackBaseMsRef   = useRef(0);
  const playbackStartMsRef  = useRef(0);
  const progressFrameRef    = useRef(0);

  // ── Load story ────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    getPublicStory(id)
      .then((data) => {
        if (!active) return;
        setStory(data);
        const ordered = Array.isArray(data?.scenes)
          ? [...data.scenes].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
          : [];
        setStoryScenes(ordered);
        setIndex(0);
        setIsPlaying(false); // wait for user gesture
        setHasStarted(false);
        setScale(1);
        setSceneProgress(0);
        playbackBaseMsRef.current = 0;
        playbackStartMsRef.current = 0;
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.response?.data?.error || err.message || 'Failed to load story');
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [id]);

  // ── User starts the story (gesture → unlocks audio) ──────────
  const handleStart = () => {
    setHasStarted(true);
    setIsPlaying(true);
    // Call play() directly in the gesture handler to unlock the audio element
    // before any useEffect fires. If no src yet, the browser still marks
    // the element as "user-activated" so later play() calls succeed.
    audio.play().catch(() => {});
  };

  // ── Scene progress / auto-advance ─────────────────────────────
  useEffect(() => {
    if (loading || error || !storyScenes.length || !isPlaying) return;

    const durationSeconds = Math.max(1, Number(storyScenes[index]?.durationSeconds) || 8);
    const durationMs = durationSeconds * 1000;

    if (index >= storyScenes.length - 1) {
      setIsPlaying(false);
      setSceneProgress(100);
      return;
    }

    playbackStartMsRef.current = window.performance.now();

    const tick = (now) => {
      const progress = Math.min(
        100,
        ((playbackBaseMsRef.current + (now - playbackStartMsRef.current)) / durationMs) * 100
      );
      setSceneProgress(progress);

      if (progress < 100 && isPlaying) {
        progressFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      playbackBaseMsRef.current = 0;
      playbackStartMsRef.current = 0;
      setSceneProgress(100);
      setIndex((prev) => Math.min(prev + 1, storyScenes.length - 1));
    };

    progressFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (playbackStartMsRef.current) {
        playbackBaseMsRef.current += window.performance.now() - playbackStartMsRef.current;
        playbackStartMsRef.current = 0;
      }
      window.cancelAnimationFrame(progressFrameRef.current);
    };
  }, [error, index, isPlaying, loading, storyScenes]);

  useEffect(() => {
    if (!storyScenes.length) return;
    setSceneProgress(0);
    playbackBaseMsRef.current = 0;
    playbackStartMsRef.current = 0;
    window.cancelAnimationFrame(progressFrameRef.current);
  }, [index, storyScenes]);

  // ── Load current scene ────────────────────────────────────────
  const currentSceneId = storyScenes[index]?.sceneId || '';

  useEffect(() => {
    let active = true;
    if (!currentSceneId) { setSceneData(null); return; }
    getScene(currentSceneId)
      .then((data) => { if (active) setSceneData(data); })
      .catch(() => { if (active) setSceneData(null); });
    return () => { active = false; };
  }, [currentSceneId]);

  // ── Load audio when scene changes ─────────────────────────────
  useEffect(() => {
    const narrativeAudioUrl = sceneData?.content?.narrative?.audioUrl;
    const text = sceneData?.content?.narrative?.text || '';

    if (narrativeAudioUrl) {
      audio.loadUrl(narrativeAudioUrl);
      if (text) audio.generateVisemeTimelineFromText(text);
    } else {
      audio.stop();
      audio.clearVisemeTimeline();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneData]);

  // ── Sync play / pause with audio ──────────────────────────────
  // Only called after hasStarted — audio element already unlocked by handleStart()
  useEffect(() => {
    if (!hasStarted || !audio.audioUrl) return;
    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted, isPlaying, audio.audioUrl]);

  // Stop audio when leaving the page
  useEffect(() => () => { audio.stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Preload next scene's GLB ───────────────────────────────────
  const nextSceneId = storyScenes[index + 1]?.sceneId;
  useEffect(() => {
    if (!nextSceneId) return;
    let active = true;
    getScene(nextSceneId)
      .then((data) => {
        if (!active) return;
        const url = data?.content?.avatar?.modelUrl;
        if (url) fetch(url, { method: 'GET', mode: 'cors' }).catch(() => {});
      })
      .catch(() => {});
    return () => { active = false; };
  }, [nextSceneId]);

  // ── Derived values ────────────────────────────────────────────
  const transform = useMemo(() => {
    if (!sceneData?.content?.avatar?.transform) return null;
    const t = sceneData.content.avatar.transform;
    return {
      positionX: t.position?.[0] ?? 0,
      positionY: t.position?.[1] ?? 0,
      positionZ: t.position?.[2] ?? 0,
      rotationY: ((t.rotation?.[1] ?? 0) * 180) / Math.PI,
      scale: t.scale?.[0] ?? 1,
    };
  }, [sceneData]);

  const scaleLabel = `${Math.round(scale * 100)}%`;
  const arHref = `/ar?mode=surface&storyId=${id}${sceneData?.content?.avatar?.modelUrl ? `&modelUrl=${encodeURIComponent(sceneData.content.avatar.modelUrl)}` : ''}`;

  // First scene avatar for splash background hint
  const firstAvatarUrl = storyScenes[0] ? null : null; // reserved for future thumbnail

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      {!fullscreen && (
        <div className="hidden md:block shrink-0">
          <Header />
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex flex-col gap-4 p-6 animate-pulse">
          <div className="h-6 w-48 rounded bg-gray-700/60" />
          <div className="h-4 w-72 rounded bg-gray-700/40" />
          <div className="flex-1 rounded-xl bg-gray-800/60" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-red-400">{error}</div>
      ) : (
        <>
          {/* Top bar */}
          {!fullscreen && (
          <div className="shrink-0 border-b border-gray-700 bg-gray-800 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{story?.metadata?.title || t('appTitle')}</h2>
              {story?.metadata?.description && (
                <p className="text-xs text-gray-400">{story.metadata.description}</p>
              )}
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Link to={arHref}
                className="px-3 py-2 min-h-12 rounded bg-cyan-700 hover:bg-cyan-600 text-xs font-semibold flex items-center">
                {t('openSurfaceAr')}
              </Link>
              <button onClick={() => setIsPlaying((p) => !p)} disabled={!hasStarted}
                className="px-3 py-2 min-h-12 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-xs flex items-center">
                {isPlaying ? t('pause') : t('play')}
              </button>
              <button onClick={() => setIndex((p) => Math.max(0, p - 1))} disabled={index <= 0 || !hasStarted}
                className="px-3 py-2 min-h-12 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-xs flex items-center">
                {t('viewerPrev')}
              </button>
              <span className="text-xs text-gray-300">
                {storyScenes.length ? `${index + 1}/${storyScenes.length}` : '0/0'}
              </span>
              <button onClick={() => setIndex((p) => Math.min(storyScenes.length - 1, p + 1))}
                disabled={index >= storyScenes.length - 1 || !hasStarted}
                className="px-3 py-2 min-h-12 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-xs flex items-center">
                {t('viewerNext')}
              </button>
              <label className="flex items-center gap-2 rounded bg-gray-900/60 px-3 py-1.5 text-xs">
                <span className="text-gray-300">{t('scale')}</span>
                <input type="range" min="0.6" max="1.4" step="0.01" value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="w-28 accent-cyan-400" />
                <span className="w-11 text-right text-gray-200">{scaleLabel}</span>
              </label>
            </div>
          </div>
          )}

          {/* Canvas area */}
          <div className={`flex-1 overflow-hidden relative ${fullscreen ? '' : 'pb-24 md:pb-0'}`}>

            {/* ── Splash screen (shown until user clicks ▶) ── */}
            {!hasStarted && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-gray-950/95 backdrop-blur-sm px-6">
                <div className="flex flex-col items-center gap-6 text-center max-w-sm w-full">
                  <div>
                    <h1 className="text-2xl font-bold text-white leading-snug">
                      {story?.metadata?.title || t('appTitle')}
                    </h1>
                    {story?.metadata?.description && (
                      <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                        {story.metadata.description}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={handleStart}
                    className="w-24 h-24 rounded-full bg-cyan-600 hover:bg-cyan-500 active:scale-95 flex items-center justify-center transition-all duration-150 shadow-2xl shadow-cyan-900/60 hover:shadow-cyan-600/40 hover:scale-105"
                    aria-label={t('viewerStart')}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 ml-1 text-white">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>

                  <p className="text-xs text-gray-500">
                    {t('viewerSceneCount', { count: storyScenes.length })}
                    {' · '}
                    {t('viewerAudioNote')}
                  </p>
                </div>
              </div>
            )}

            {/* Desktop progress bar */}
            <div className="hidden md:flex absolute right-4 top-4 bottom-4 z-20 w-4 flex-col items-center justify-start">
              <div className="relative h-full w-1 rounded-full bg-white/15 overflow-hidden shadow-lg shadow-black/30">
                <div className="absolute left-0 top-0 w-full origin-top rounded-full bg-cyan-400 transition-transform duration-75"
                  style={{ transform: `scaleY(${sceneProgress / 100})` }} />
              </div>
              <div className="mt-2 rounded-full border border-cyan-300/70 bg-gray-950/80 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 shadow-lg shadow-black/30">
                {Math.round(sceneProgress)}%
              </div>
            </div>

            {/* Fullscreen toggle */}
            <button
              onClick={() => setFullscreen((v) => !v)}
              className="md:hidden absolute top-3 right-3 z-30 rounded-full bg-black/60 border border-white/20 w-10 h-10 flex items-center justify-center text-white text-lg backdrop-blur-sm active:bg-black/80"
              aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {fullscreen ? '✕' : '⛶'}
            </button>

            {/* Mobile controls */}
            {!fullscreen && (
            <div className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-gray-700 bg-gray-950/95 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Link to={arHref}
                  className="px-3 py-2 min-h-12 rounded bg-cyan-700 hover:bg-cyan-600 text-xs font-semibold flex items-center">
                  {t('ar')}
                </Link>
                {!hasStarted ? (
                  <button onClick={handleStart}
                    className="flex-1 px-4 py-2 min-h-12 rounded bg-cyan-600 hover:bg-cyan-500 text-sm font-bold flex items-center justify-center gap-2">
                    {t('viewerStart')}
                  </button>
                ) : (
                  <button onClick={() => setIsPlaying((p) => !p)}
                    className="px-4 py-2 min-h-12 flex-1 rounded bg-emerald-700 hover:bg-emerald-600 text-sm font-medium flex items-center justify-center">
                    {isPlaying ? t('pause') : t('play')}
                  </button>
                )}
                <button onClick={() => setIndex((p) => Math.max(0, p - 1))} disabled={index <= 0 || !hasStarted}
                  className="px-3 py-2 min-h-12 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-xs flex items-center">
                  {t('viewerPrev')}
                </button>
                <button onClick={() => setIndex((p) => Math.min(storyScenes.length - 1, p + 1))}
                  disabled={index >= storyScenes.length - 1 || !hasStarted}
                  className="px-3 py-2 min-h-12 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-xs flex items-center">
                  {t('viewerNext')}
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] font-semibold text-gray-300">{t('scale')}</span>
                <input type="range" min="0.6" max="1.4" step="0.01" value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="min-w-0 flex-1 accent-cyan-400" />
                <span className="w-11 text-right text-[10px] font-semibold text-gray-200">{scaleLabel}</span>
              </div>
              <div className="mt-3">
                <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden shadow-inner shadow-black/30">
                  <div className="h-full origin-left rounded-full bg-cyan-400 transition-transform duration-75"
                    style={{ transform: `scaleX(${sceneProgress / 100})` }} />
                </div>
                <div className="mt-1 text-[10px] font-semibold text-cyan-200 text-right">
                  {Math.round(sceneProgress)}%
                </div>
              </div>
            </div>
            )}

            {/* Scene canvas */}
            <div className="h-full w-full origin-center transition-transform duration-300"
              style={{ transform: `scale(${scale})` }}>
              {sceneData ? (
                <Suspense fallback={
                  <div className="flex h-full items-center justify-center bg-gray-900">
                    <div className="flex flex-col items-center gap-4">
                      <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
                      <p className="text-sm text-cyan-200 font-medium">{t('viewerPreparing')}</p>
                      <p className="text-xs text-gray-500">{t('viewerWait')}</p>
                    </div>
                  </div>
                }>
                  <SceneCanvas
                    avatarUrl={sceneData?.content?.avatar?.modelUrl}
                    transform={transform}
                    posePreset={sceneData?.content?.avatar?.posePreset || 'idle'}
                    speechText={sceneData?.content?.narrative?.text || ''}
                    analyserRef={audio.analyserRef}
                    lipSyncConfig={audio.lipSyncConfig}
                    visemeTimeline={audio.visemeTimeline}
                    audioCurrentTime={audio.audioCurrentTime}
                  />
                </Suspense>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  {t('viewerSceneNotFound')}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
