import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { pickNarration } from '../utils/narration';
import ViewerError from '../components/ui/ViewerError';
import { classifyViewerError } from '../utils/viewerError';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getScene } from '../api/sceneApi';
import Header from '../components/ui/Header';
import useAudio from '../hooks/useAudio';

const SceneCanvas = lazy(() => import('../components/3d/SceneCanvas'));

export default function ViewerPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const audio = useAudio();
  const [scene, setScene] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const audioLoadedRef = useRef(false);

  const arHref = scene?.content?.avatar?.modelUrl
    ? `/ar?mode=surface&modelUrl=${encodeURIComponent(scene.content.avatar.modelUrl)}&sceneId=${encodeURIComponent(id)}`
    : '/ar';

  const transform = scene
    ? {
        positionX: scene.content.avatar.transform.position[0] ?? 0,
        positionY: scene.content.avatar.transform.position[1] ?? 0,
        positionZ: scene.content.avatar.transform.position[2] ?? 0,
        rotationY: ((scene.content.avatar.transform.rotation[1] ?? 0) * 180) / Math.PI,
        scale: scene.content.avatar.transform.scale[0] ?? 1,
      }
    : null;

  useEffect(() => {
    getScene(id)
      .then((data) => { setScene(data); setLoading(false); })
      .catch((err) => { setError(classifyViewerError(err)); setLoading(false); });
  }, [id, t]);

  // Load and play audio when scene data arrives
  useEffect(() => {
    if (!scene || audioLoadedRef.current) return;
    // The visitor's own language decides, same as the story viewer — a shared
    // /scene/:id link is scanned by whoever walks past it too.
    const chosen = pickNarration(scene.content?.narrative, i18n.language);
    const audioUrl = chosen.audioUrl;
    const text = chosen.text;

    if (audioUrl) {
      audioLoadedRef.current = true;
      audio.loadUrl(audioUrl);
      if (text) audio.generateVisemeTimelineFromText(text);
      // Small delay so the browser doesn't block autoplay
      setTimeout(() => audio.play().catch(() => {}), 800);
    } else if (text && 'speechSynthesis' in window) {
      // Fallback to Web Speech API when no TTS audio was saved
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = i18n.language === 'pt' ? 'pt-BR' : 'en-US';
      setTimeout(() => window.speechSynthesis.speak(utterance), 1500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useEffect(() => () => { audio.stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex flex-col h-dvh bg-gray-900 text-white">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
          <p className="text-sm text-cyan-200">{t('loadingScene')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-dvh bg-gray-900 text-white">
        <Header />
        <ViewerError kind={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-gray-900 text-white overflow-hidden">
      <Header />
      <div className="shrink-0 px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between gap-3">
        <h2 className="font-medium">{scene?.metadata?.title || t('viewerTitle')}</h2>
        <div className="flex items-center gap-2">
          {audio.audioUrl && (
            <button
              onClick={() => audio.isPlaying ? audio.pause() : audio.play().catch(() => {})}
              className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs font-semibold text-white transition-colors"
            >
              {audio.isPlaying ? 'Pausar' : 'Play'}
            </button>
          )}
          <Link to={arHref}
            className="rounded-full bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600">
            {t('openSurfaceAr')}
          </Link>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={
          <div className="flex h-full items-center justify-center bg-gray-900">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
              <p className="text-sm text-cyan-200 font-medium">{t('preparingScene')}</p>
            </div>
          </div>
        }>
          {/* A model nobody has tested can throw while rendering; keeping
              that inside the canvas leaves the rest of the screen usable.
              Keyed on the avatar, so loading another one tries again. */}
          <ErrorBoundary compact resetKey={scene?.content?.avatar?.modelUrl}>
            <SceneCanvas
              avatarUrl={scene?.content?.avatar?.modelUrl}
              transform={transform}
              posePreset={scene?.content?.avatar?.posePreset || 'idle'}
              speechText={pickNarration(scene?.content?.narrative, i18n.language).text}
              sentenceTimeline={pickNarration(scene?.content?.narrative, i18n.language).sentenceTimeline}
              // Without these the viewer replayed the scene with default playback
              // settings — most visibly, narration always rendered as a bubble
              // even when the scene was authored with subtitles.
              textDisplayMode={scene?.content?.narrative?.displayMode || 'bubble'}
              vrmaUrl={scene?.content?.avatar?.vrmaUrl || ''}
              animSpeed={scene?.content?.avatar?.animSpeed ?? 1}
              animLoopOnce={Boolean(scene?.content?.avatar?.animLoopOnce)}
              vrmExpression={scene?.content?.avatar?.vrmExpression || ''}
              analyserRef={audio.analyserRef}
              lipSyncConfig={audio.lipSyncConfig}
              visemeTimeline={audio.visemeTimeline}
              audioCurrentTime={audio.audioCurrentTime}
              isSpeaking={audio.isSpeaking || audio.isPlaying}
            />
          </ErrorBoundary>
        </Suspense>
      </div>
    </div>
  );
}
