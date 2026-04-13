import { useState, useCallback, useEffect } from 'react';

const DEFAULT_TRANSFORM = {
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotationY: 0,
  scale: 1,
};

const LAST_AVATAR_URL_KEY = 'avaturn:lastAvatarUrl';

function getInitialAvatarUrl() {
  try {
    return localStorage.getItem(LAST_AVATAR_URL_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Central state hook for the scene editor.
 * Keeps avatar URL, transform, speech text, and title in sync.
 */
export default function useScene() {
  const [avatarUrl, setAvatarUrl] = useState(getInitialAvatarUrl);
  const [transform, setTransform] = useState(DEFAULT_TRANSFORM);
  const [posePreset, setPosePreset] = useState('idle');
  const [speechText, setSpeechText] = useState('');
  const [sceneTitle, setSceneTitle] = useState('');

  useEffect(() => {
    try {
      if (avatarUrl) {
        localStorage.setItem(LAST_AVATAR_URL_KEY, avatarUrl);
      } else {
        localStorage.removeItem(LAST_AVATAR_URL_KEY);
      }
    } catch {
      // Ignore storage errors in restricted environments.
    }
  }, [avatarUrl]);

  const updateTransform = useCallback((key, value) => {
    setTransform((prev) => ({ ...prev, [key]: value }));
  }, []);

  const buildScenePayload = useCallback(
    (existingId) => ({
      sceneId: existingId || undefined,
      metadata: { title: sceneTitle || 'Untitled Scene', theme: '' },
      content: {
        avatar: {
          modelUrl: avatarUrl,
          posePreset,
          transform: {
            position: [transform.positionX, transform.positionY, transform.positionZ],
            rotation: [0, (transform.rotationY * Math.PI) / 180, 0],
            scale: [transform.scale, transform.scale, transform.scale],
          },
        },
        narrative: {
          text: speechText,
          audioUrl: '',
          bubbleStyle: { color: '#ffffff', fontSize: 14 },
        },
      },
    }),
    [avatarUrl, posePreset, transform, speechText, sceneTitle]
  );

  return {
    avatarUrl,
    setAvatarUrl,
    transform,
    updateTransform,
    posePreset,
    setPosePreset,
    speechText,
    setSpeechText,
    sceneTitle,
    setSceneTitle,
    buildScenePayload,
  };
}
