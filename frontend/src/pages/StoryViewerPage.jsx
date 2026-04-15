import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from '../components/ui/Header';
import SceneCanvas from '../components/3d/SceneCanvas';
import { getPublicStory, getScene } from '../api/sceneApi';

export default function StoryViewerPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [story, setStory] = useState(null);
  const [storyScenes, setStoryScenes] = useState([]);
  const [index, setIndex] = useState(0);
  const [sceneData, setSceneData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [scale, setScale] = useState(1);
  const [sceneProgress, setSceneProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const playbackBaseMsRef = React.useRef(0);
  const playbackStartMsRef = React.useRef(0);
  const progressFrameRef = React.useRef(0);

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
        setIsPlaying(true);
        setScale(1);
        setSceneProgress(0);
        playbackBaseMsRef.current = 0;
        playbackStartMsRef.current = 0;
      })
      .catch((err) => {
        if (!active) return;
        const apiError = err?.response?.data?.error;
        setError(apiError || err.message || 'Failed to load story');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

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

  const currentSceneId = storyScenes[index]?.sceneId || '';
  const currentMarkerUrl = storyScenes[index]?.markerUrl || '';

  useEffect(() => {
    let active = true;
    if (!currentSceneId) {
      setSceneData(null);
      return;
    }

    getScene(currentSceneId)
      .then((data) => {
        if (!active) return;
        setSceneData(data);
      })
      .catch(() => {
        if (!active) return;
        setSceneData(null);
      });

    return () => {
      active = false;
    };
  }, [currentSceneId]);

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

  const progressHeight = `${sceneProgress}%`;
  const scaleLabel = `${Math.round(scale * 100)}%`;
  const arHref = sceneData?.content?.avatar?.modelUrl
    ? `/ar?mode=surface&modelUrl=${encodeURIComponent(sceneData.content.avatar.modelUrl)}`
    : '/ar';

  function buildArMarkerHref() {
    const modelUrl = sceneData?.content?.avatar?.modelUrl;
    if (!modelUrl) return '/ar?mode=marker';
    const base = `/ar?mode=marker&modelUrl=${encodeURIComponent(modelUrl)}`;
    return currentMarkerUrl ? `${base}&markerUrl=${encodeURIComponent(currentMarkerUrl)}` : base;
  }
  const arMarkerHref = buildArMarkerHref();

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      <Header />

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">Loading story...</div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-red-400">{error}</div>
      ) : (
        <>
          <div className="shrink-0 border-b border-gray-700 bg-gray-800 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{story?.metadata?.title || 'Story'}</h2>
              {story?.metadata?.description && (
                <p className="text-xs text-gray-400">{story.metadata.description}</p>
              )}
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Link
                to={arHref}
                className="px-3 py-1.5 rounded bg-cyan-700 hover:bg-cyan-600 text-xs font-semibold"
              >
                {t('openSurfaceAr')}
              </Link>
              <Link
                to={arMarkerHref}
                className="px-3 py-1.5 rounded bg-fuchsia-700 hover:bg-fuchsia-600 text-xs font-semibold"
              >
                {t('openMarkerAr')}
              </Link>
              <button
                onClick={() => setIsPlaying((prev) => !prev)}
                className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-xs"
              >
                {isPlaying ? t('pause') : t('play')}
              </button>
              <button
                onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
                disabled={index <= 0}
                className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-xs"
              >
                Prev
              </button>
              <span className="text-xs text-gray-300">{storyScenes.length ? `${index + 1}/${storyScenes.length}` : '0/0'}</span>
              <button
                onClick={() => setIndex((prev) => Math.min(storyScenes.length - 1, prev + 1))}
                disabled={index >= storyScenes.length - 1}
                className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-xs"
              >
                Next
              </button>
              <label className="flex items-center gap-2 rounded bg-gray-900/60 px-3 py-1.5 text-xs">
                <span className="text-gray-300">{t('scale')}</span>
                <input
                  type="range"
                  min="0.6"
                  max="1.4"
                  step="0.01"
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="w-28 accent-cyan-400"
                />
                <span className="w-11 text-right text-gray-200">{scaleLabel}</span>
              </label>
            </div>
          </div>

          <div className="flex-1 overflow-hidden pb-24 md:pb-0">
            <div className="relative h-full w-full">
              <div className="hidden md:flex absolute right-4 top-4 bottom-4 z-20 w-4 flex-col items-center justify-start">
                <div className="relative h-full w-1 rounded-full bg-white/15 overflow-hidden shadow-lg shadow-black/30">
                  <div
                    className="absolute left-0 top-0 w-full origin-top rounded-full bg-cyan-400 transition-transform duration-75"
                    style={{ transform: `scaleY(${sceneProgress / 100})` }}
                  />
                </div>
                <div className="mt-2 rounded-full border border-cyan-300/70 bg-gray-950/80 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 shadow-lg shadow-black/30">
                  {Math.round(sceneProgress)}%
                </div>
              </div>

              <div className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-gray-700 bg-gray-950/95 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <Link
                    to={arHref}
                    className="px-3 py-2 rounded bg-cyan-700 hover:bg-cyan-600 text-xs font-semibold"
                  >
                    AR
                  </Link>
                  <Link
                    to={arMarkerHref}
                    className="px-3 py-2 rounded bg-fuchsia-700 hover:bg-fuchsia-600 text-xs font-semibold"
                  >
                    Marker AR
                  </Link>
                  <button
                    onClick={() => setIsPlaying((prev) => !prev)}
                    className="px-3 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-xs"
                  >
                    {isPlaying ? t('pause') : t('play')}
                  </button>
                  <button
                    onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
                    disabled={index <= 0}
                    className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-xs"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setIndex((prev) => Math.min(storyScenes.length - 1, prev + 1))}
                    disabled={index >= storyScenes.length - 1}
                    className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-xs"
                  >
                    Next
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-gray-300">{t('scale')}</span>
                  <input
                    type="range"
                    min="0.6"
                    max="1.4"
                    step="0.01"
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                    className="min-w-0 flex-1 accent-cyan-400"
                  />
                  <span className="w-11 text-right text-[10px] font-semibold text-gray-200">{scaleLabel}</span>
                </div>

                <div className="mt-3">
                  <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden shadow-inner shadow-black/30">
                    <div
                      className="h-full origin-left rounded-full bg-cyan-400 transition-transform duration-75"
                      style={{ transform: `scaleX(${sceneProgress / 100})` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] font-semibold text-cyan-200 text-right">
                    {Math.round(sceneProgress)}%
                  </div>
                </div>
              </div>

              <div
                className="h-full w-full origin-center transition-transform duration-300"
                style={{ transform: `scale(${scale})` }}
              >
                {sceneData ? (
                  <SceneCanvas
                    avatarUrl={sceneData?.content?.avatar?.modelUrl}
                    transform={transform}
                    posePreset={sceneData?.content?.avatar?.posePreset || 'idle'}
                    speechText={sceneData?.content?.narrative?.text || ''}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">Scene not found.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
