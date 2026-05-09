import { useCallback, useState } from 'react';
import { AUTH_TOKEN_KEY } from '../api/sceneApi';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

/**
 * useTTS — calls POST /api/tts/generate and hands the audio blob + text
 * to the caller so they can load it into useAudio and generate visemes.
 *
 * @param {Object} opts
 * @param {(file: File) => void} opts.onAudioReady   — receives MP3 File for useAudio.loadFile
 * @param {(text: string) => void} opts.onVisemeReady — receives text for generateVisemeTimelineFromText
 */
export default function useTTS({ onAudioReady, onVisemeReady } = {}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const generate = useCallback(
    async (text, voiceId) => {
      const trimmed = String(text || '').trim();
      if (!trimmed) {
        setError('Digite um texto antes de gerar a voz.');
        return;
      }

      setIsGenerating(true);
      setError('');

      try {
        const token = localStorage.getItem(AUTH_TOKEN_KEY) || '';
        const res = await fetch(`${API_BASE}/api/tts/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ text: trimmed, voiceId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Erro TTS: ${res.status}`);
        }

        const blob = await res.blob();
        const file = new File([blob], 'tts-output.mp3', { type: 'audio/mpeg' });

        onAudioReady?.(file);
        onVisemeReady?.(trimmed);
      } catch (err) {
        setError(err.message || 'Falha ao gerar voz.');
      } finally {
        setIsGenerating(false);
      }
    },
    [onAudioReady, onVisemeReady]
  );

  return { generate, isGenerating, error };
}
