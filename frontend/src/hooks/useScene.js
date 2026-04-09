import { useState, useCallback } from 'react';

const DEFAULT_TRANSFORM = {
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotationY: 0,
  scale: 1,
};

/**
 * Central state hook for the scene editor.
 * Keeps avatar URL, transform, speech text, and title in sync.
 */
export default function useScene() {
  const [avatarUrl, setAvatarUrl] = useState('');
  const [transform, setTransform] = useState(DEFAULT_TRANSFORM);
  const [speechText, setSpeechText] = useState('');
  const [sceneTitle, setSceneTitle] = useState('');

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
    [avatarUrl, transform, speechText, sceneTitle]
  );

  return {
    avatarUrl,
    setAvatarUrl,
    transform,
    updateTransform,
    speechText,
    setSpeechText,
    sceneTitle,
    setSceneTitle,
    buildScenePayload,
  };
}
