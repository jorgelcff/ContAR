import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getScene } from '../api/sceneApi';
import Header from '../components/ui/Header';
import SceneCanvas from '../components/3d/SceneCanvas';

/**
 * ViewerPage — read-only scene viewer loaded by shared URL /scene/:id.
 * Fetches the scene from the backend, renders it in 3D, and auto-plays
 * the speech text via the Web Speech API.
 */
export default function ViewerPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const [scene, setScene] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const speechPlayedRef = useRef(false);
  const arHref = scene?.content?.avatar?.modelUrl
    ? `/ar?mode=surface&modelUrl=${encodeURIComponent(scene.content.avatar.modelUrl)}`
    : '/ar';

  // Derive transform object that SceneCanvas expects
  const transform = scene
    ? {
        positionX: scene.content.avatar.transform.position[0] ?? 0,
        positionY: scene.content.avatar.transform.position[1] ?? 0,
        positionZ: scene.content.avatar.transform.position[2] ?? 0,
        // rotation is stored in radians → convert to degrees for SceneCanvas
        rotationY: ((scene.content.avatar.transform.rotation[1] ?? 0) * 180) / Math.PI,
        scale: scene.content.avatar.transform.scale[0] ?? 1,
      }
    : null;

  // Load scene data
  useEffect(() => {
    getScene(id)
      .then((data) => { setScene(data); setLoading(false); })
      .catch((err) => { setError(`${t('errorLoading')}: ${err.message}`); setLoading(false); });
  }, [id, t]);

  // Auto-play speech with Web Speech API
  useEffect(() => {
    if (!scene || speechPlayedRef.current) return;
    const text = scene.content?.narrative?.text;
    if (!text) return;
    speechPlayedRef.current = true;

    const trySpeak = () => {
      if (!('speechSynthesis' in window)) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = i18n.language === 'pt' ? 'pt-BR' : 'en-US';
      window.speechSynthesis.speak(utterance);
    };

    // Delay slightly so the browser doesn't block autoplay
    const timer = setTimeout(trySpeak, 1500);
    return () => clearTimeout(timer);
  }, [scene, i18n.language]);

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-900 text-white">
        <Header />
        <div className="flex-1 flex items-center justify-center text-gray-400">
          {t('loadingScene')}
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
      <div className="shrink-0 px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">{scene?.metadata?.title || t('viewerTitle')}</h2>
          <Link
            to={arHref}
            className="rounded-full bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600"
          >
            {t('openSurfaceAr')}
          </Link>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <SceneCanvas
          avatarUrl={scene?.content?.avatar?.modelUrl}
          transform={transform}
          speechText={scene?.content?.narrative?.text}
        />
      </div>
    </div>
  );
}
