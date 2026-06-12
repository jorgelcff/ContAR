import { useCallback, useState } from 'react';
import { generateTTS } from '../api/sceneApi';

function base64ToBlob(base64, type = 'audio/mpeg') {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/**
 * useTTS — generates narration audio via the backend (which calls Azure
 * server-side, keeping the API keys off the client). Hands the MP3 File + text to
 * the caller for useAudio + viseme generation.
 *
 * Uses the shared `api` client (via generateTTS) so it hits the same backend as
 * the rest of the app — previously it used its own VITE_API_BASE env var with a
 * localhost fallback, which sent TTS requests to localhost in production.
 *
 * @param {Object} opts
 * @param {(file: File) => void} opts.onAudioReady   — MP3 File for useAudio.loadFile
 * @param {(text: string, visemeTimeline: Array|null) => void} opts.onVisemeReady
 *        — narration text plus the precise viseme timeline from the provider
 *          (null when unavailable, so the caller can fall back to text heuristics)
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
        const { audioBase64, visemeTimeline } = await generateTTS(trimmed, voiceId);
        if (!audioBase64) throw new Error('Resposta de TTS sem áudio.');

        const blob = base64ToBlob(audioBase64);
        const file = new File([blob], 'tts-output.mp3', { type: 'audio/mpeg' });

        onAudioReady?.(file);
        onVisemeReady?.(trimmed, Array.isArray(visemeTimeline) ? visemeTimeline : null);
      } catch (err) {
        setError(err?.response?.data?.error || err.message || 'Falha ao gerar voz.');
      } finally {
        setIsGenerating(false);
      }
    },
    [onAudioReady, onVisemeReady]
  );

  return { generate, isGenerating, error };
}
