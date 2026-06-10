import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
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
    ? `/ar?mode=surface&modelUrl=${encodeURIComponent(scene.content.avatar.modelUrl)}`
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
      .catch((err) => { setError(`${t('errorLoading')}: ${err.message}`); setLoading(false); });
  }, [id, t]);

  // Load and play audio when scene data arrives
  useEffect(() => {
    if (!scene || audioLoadedRef.current) return;
    const audioUrl = scene.content?.narrative?.audioUrl;
    const text = scene.content?.narrative?.text;

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
      <div className="flex flex-col h-screen bg-gray-900 text-white">
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
      <div className="flex flex-col h-screen bg-gray-900 text-white">
        <Header />
        <div className="flex-1 flex items-center justify-center text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      <Header />
      <div className="shrink-0 px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between gap-3">
        <h2 className="font-medium">{scene?.metadata?.title || t('viewerTitle')}</h2>
        <div className="flex items-center gap-2">
          {audio.audioUrl && (
            <button
              onClick={() => audio.isPlaying ? audio.pause() : audio.play().catch(() => {})}
              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-xs font-semibold text-white transition-colors"
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
              <p className="text-sm text-cyan-200 font-medium">Preparando a cena...</p>
            </div>
          </div>
        }>
          <SceneCanvas
            avatarUrl={scene?.content?.avatar?.modelUrl}
            transform={transform}
            posePreset={scene?.content?.avatar?.posePreset || 'idle'}
            speechText={scene?.content?.narrative?.text}
            analyserRef={audio.analyserRef}
            lipSyncConfig={audio.lipSyncConfig}
            visemeTimeline={audio.visemeTimeline}
            audioCurrentTime={audio.audioCurrentTime}
          />
        </Suspense>
      </div>
    </div>
  );
}
