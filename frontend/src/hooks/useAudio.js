import { useEffect, useRef, useState } from 'react';
import { generateTTS } from '../api/sceneApi';

const DEFAULT_AUDIO_PROCESSING = {
  inputGain: 1.35,
  analyserSmoothing: 0.72,
  compressorThreshold: -24,
  compressorRatio: 3,
};

export const DEFAULT_LIP_SYNC_CONFIG = {
  amplitudeMultiplier: 18,
  noiseGate: 0.008,
  fullBandMix: 0.35,
  speechBandMix: 0.65,
  enableBandEnergy: true,
  visemeMode: 'timeline',
  timelineCrossfadeSec: 0.08,
  timelineMouthWeight: 0.72,
  timelineSpeechWeight: 0.28,
  enableJawFallback: true,
  jawFallbackStrength: 0.7,
  showBlendshapeDebug: false,
};

/**
 * useAudio — manages audio playback and real-time analysis for lip sync.
 *
 * Supports:
 *   - File upload (MP3, WAV, OGG, etc.)
 *   - Microphone recording via MediaRecorder
 *   - Real-time amplitude via Web Audio API AnalyserNode
 *
 * Returns:
 *   analyserRef    – ref to the AnalyserNode; read it in a render loop for amplitude data
 *   audioUrl       – object-URL of the current audio (file or recording)
 *   isPlaying      – whether audio is currently playing
 *   isRecording    – whether microphone recording is active
 *   loadFile       – (File) => void
 *   play           – () => void
 *   pause          – () => void
 *   stop           – () => void
 *   startRecording – () => Promise<void>
 *   stopRecording  – () => void
 *   error          – error string or ''
 */
export default function useAudio() {
  const [audioUrl, setAudioUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');
  const [audioMetrics, setAudioMetrics] = useState({
    rms: 0,
    speechBandEnergy: 0,
    peak: 0,
    level: 0,
    clipping: false,
  });
  const [audioProcessing, setAudioProcessing] = useState(DEFAULT_AUDIO_PROCESSING);
  const [lipSyncConfig, setLipSyncConfig] = useState(DEFAULT_LIP_SYNC_CONFIG);
  const [visemeTimeline, setVisemeTimeline] = useState([]);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const webSpeechTimerRef = useRef(null);

  // Web Audio refs
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const gainNodeRef = useRef(null);
  const compressorRef = useRef(null);
  const audioElRef = useRef(null);
  const sourceNodeRef = useRef(null);

  // Recording refs
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const micStreamRef = useRef(null);
  const micSourceRef = useRef(null);

  // Track the current URL in a ref so callbacks never go stale
  const audioUrlRef = useRef('');
  const meterFrameRef = useRef(null);
  const meterTimeDataRef = useRef(null);
  const meterFreqDataRef = useRef(null);
  const lastMeterCommitRef = useRef(0);

  // ── Private helpers ──────────────────────────────────────────────

  function getOrCreateContext() {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const gainNode = ctx.createGain();
      const compressor = ctx.createDynamicsCompressor();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = audioProcessing.analyserSmoothing;

      gainNode.gain.value = audioProcessing.inputGain;
      compressor.threshold.value = audioProcessing.compressorThreshold;
      compressor.ratio.value = audioProcessing.compressorRatio;

      gainNode.connect(compressor);
      compressor.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      gainNodeRef.current = gainNode;
      compressorRef.current = compressor;
      analyserRef.current = analyser;

      startMeters();
    }
    return audioCtxRef.current;
  }

  function setUrl(url) {
    audioUrlRef.current = url;
    setAudioUrl(url);
  }

  function revokeCurrentUrl() {
    if (audioUrlRef.current) {
      try { URL.revokeObjectURL(audioUrlRef.current); } catch { /* ignore */ }
    }
  }

  function teardownSource() {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch { /* ignore */ }
      sourceNodeRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
      audioElRef.current = null;
    }
  }

  function startMeters() {
    if (meterFrameRef.current) return;

    const tick = () => {
      meterFrameRef.current = window.requestAnimationFrame(tick);

      const analyser = analyserRef.current;
      if (!analyser) return;

      const now = performance.now();
      const binCount = analyser.frequencyBinCount;
      if (!meterTimeDataRef.current || meterTimeDataRef.current.length !== binCount) {
        meterTimeDataRef.current = new Uint8Array(binCount);
      }
      if (!meterFreqDataRef.current || meterFreqDataRef.current.length !== binCount) {
        meterFreqDataRef.current = new Uint8Array(binCount);
      }

      analyser.getByteTimeDomainData(meterTimeDataRef.current);
      analyser.getByteFrequencyData(meterFreqDataRef.current);

      let rmsSum = 0;
      let peak = 0;
      for (let i = 0; i < binCount; i++) {
        const normalized = (meterTimeDataRef.current[i] - 128) / 128;
        const abs = Math.abs(normalized);
        if (abs > peak) peak = abs;
        rmsSum += normalized * normalized;
      }
      const rms = Math.sqrt(rmsSum / binCount);

      const sampleRate = analyser.context.sampleRate || 48000;
      const hzPerBin = sampleRate / analyser.fftSize;
      const minHz = 300;
      const maxHz = 3000;
      const minBin = Math.max(0, Math.floor(minHz / hzPerBin));
      const maxBin = Math.min(binCount - 1, Math.ceil(maxHz / hzPerBin));
      let speechSum = 0;
      for (let i = minBin; i <= maxBin; i++) {
        speechSum += meterFreqDataRef.current[i] / 255;
      }
      const speechBandEnergy = speechSum / Math.max(1, maxBin - minBin + 1);

      const level = Math.min(1, Math.max(rms * 10, speechBandEnergy));
      const clipping = peak > 0.98;

      if (now - lastMeterCommitRef.current >= 80) {
        lastMeterCommitRef.current = now;
        setAudioMetrics({
          rms,
          speechBandEnergy,
          peak,
          level,
          clipping,
        });
        setAudioCurrentTime(audioElRef.current?.currentTime || 0);
      }
    };

    meterFrameRef.current = window.requestAnimationFrame(tick);
  }

  function applyAudioProcessingSettings(nextSettings) {
    const analyser = analyserRef.current;
    const gainNode = gainNodeRef.current;
    const compressor = compressorRef.current;

    if (analyser) {
      analyser.smoothingTimeConstant = nextSettings.analyserSmoothing;
    }
    if (gainNode) {
      gainNode.gain.value = nextSettings.inputGain;
    }
    if (compressor) {
      compressor.threshold.value = nextSettings.compressorThreshold;
      compressor.ratio.value = nextSettings.compressorRatio;
    }
  }

  function updateAudioProcessing(partial) {
    setAudioProcessing((prev) => {
      const next = { ...prev, ...partial };
      applyAudioProcessingSettings(next);
      return next;
    });
  }

  function updateLipSyncConfig(partial) {
    setLipSyncConfig((prev) => ({ ...prev, ...partial }));
  }

  async function loadVisemeTimeline(file) {
    if (!file) return;
    setError('');
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const normalized = normalizeVisemeTimelineToDuration(
        normalizeVisemeTimeline(parsed),
        audioDuration
      );
      if (!normalized.length) {
        throw new Error('No valid viseme cues found in JSON');
      }
      setVisemeTimeline(normalized);
    } catch (err) {
      setVisemeTimeline([]);
      setError(err?.message || 'Invalid viseme JSON');
    }
  }

  function clearVisemeTimeline() {
    setVisemeTimeline([]);
  }

  // Apply a precise viseme timeline supplied by the TTS provider (Azure)
  // as { start, end, value }[]. Set raw — the audioDuration effect re-normalizes
  // it once the freshly loaded clip's duration is known. Returns false if empty
  // so callers can fall back to the text heuristic.
  function applyVisemeTimeline(timeline) {
    if (!Array.isArray(timeline) || !timeline.length) return false;
    setVisemeTimeline(timeline);
    setLipSyncConfig((prev) => ({ ...prev, visemeMode: 'timeline' }));
    return true;
  }

  async function generateWithAzure(text, voiceId) {
    const src = String(text || '').trim();
    if (!src) { setError('Escreva um texto antes de gerar a fala.'); return; }

    setIsTTSLoading(true);
    setError('');
    try {
      // Backend returns { audioBase64, visemeTimeline } from Azure
      const { audioBase64, visemeTimeline: ttsTimeline } = await generateTTS(src, voiceId);

      // Base64 → Blob → object URL
      const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      teardownSource();
      revokeCurrentUrl();
      setIsPlaying(false);
      setAudioCurrentTime(0);
      setAudioDuration(0);
      setUrl(URL.createObjectURL(blob));

      if (Array.isArray(ttsTimeline) && ttsTimeline.length) {
        setVisemeTimeline(ttsTimeline);
        setLipSyncConfig((prev) => ({ ...prev, visemeMode: 'timeline' }));
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Falha ao gerar fala.');
    } finally {
      setIsTTSLoading(false);
    }
  }

  function speakWithWebSpeech(text, lang = 'pt-BR') {
    if (!window.speechSynthesis) {
      setError('Web Speech API não suportada neste navegador. Use Chrome ou Edge.');
      return;
    }
    const src = String(text || '').trim();
    if (!src) { setError('Escreva um texto antes de falar.'); return; }

    // Stop any current audio/speech
    window.speechSynthesis.cancel();
    if (webSpeechTimerRef.current) clearInterval(webSpeechTimerRef.current);
    setError('');
    setIsSpeaking(false);
    setAudioCurrentTime(0);

    // Generate text-based viseme timeline as lip sync approximation
    const timeline = normalizeVisemeTimelineToDuration(
      textToVisemeTimeline(src),
      null // keep natural timing
    );
    setVisemeTimeline(timeline);
    setLipSyncConfig((prev) => ({ ...prev, visemeMode: 'timeline' }));

    const utterance = new SpeechSynthesisUtterance(src);
    utterance.lang = lang;
    utterance.rate = 0.88;
    utterance.pitch = 1;

    // Pick a voice for the selected language
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang === lang)
      || voices.find((v) => v.lang.startsWith(lang.split('-')[0]))
      || null;
    if (match) utterance.voice = match;

    let startMs = null;
    utterance.onstart = () => {
      startMs = Date.now();
      setIsSpeaking(true);
      // Advance audioCurrentTime in real-time so the viseme timeline plays along
      webSpeechTimerRef.current = setInterval(() => {
        setAudioCurrentTime((Date.now() - startMs) / 1000);
      }, 40);
    };

    utterance.onend = () => {
      if (webSpeechTimerRef.current) clearInterval(webSpeechTimerRef.current);
      setIsSpeaking(false);
      setAudioCurrentTime(0);
    };

    utterance.onerror = (e) => {
      if (webSpeechTimerRef.current) clearInterval(webSpeechTimerRef.current);
      setIsSpeaking(false);
      if (e.error !== 'interrupted') setError(`Erro ao falar: ${e.error}`);
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopWebSpeech() {
    window.speechSynthesis?.cancel();
    if (webSpeechTimerRef.current) clearInterval(webSpeechTimerRef.current);
    setIsSpeaking(false);
    setAudioCurrentTime(0);
  }

  function generateVisemeTimelineFromText(text) {
    const source = String(text || '').trim();
    if (!source) {
      setError('Type a text first to generate visemes');
      return;
    }

    const generated = normalizeVisemeTimelineToDuration(
      textToVisemeTimeline(source),
      audioDuration
    );
    if (!generated.length) {
      setError('Could not generate visemes from text');
      return;
    }

    setError('');
    setVisemeTimeline(generated);
    setLipSyncConfig((prev) => ({ ...prev, visemeMode: 'timeline' }));
  }

  function teardownMic() {
    if (micSourceRef.current) {
      try { micSourceRef.current.disconnect(); } catch { /* ignore */ }
      micSourceRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
  }

  // ── Public API ───────────────────────────────────────────────────

  function loadFile(file) {
    if (!file) return;
    teardownSource();
    revokeCurrentUrl();
    setIsPlaying(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setError('');
    setUrl(URL.createObjectURL(file));
  }

  // Load audio directly from an external URL (no blob creation).
  // Used by StoryViewerPage to play narration stored on the server.
  function loadUrl(url) {
    if (!url) return;
    teardownSource();
    // Don't revoke — this is an external URL, not a blob we created
    setIsPlaying(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setError('');
    audioUrlRef.current = url;
    setAudioUrl(url);
  }

  async function play() {
    const url = audioUrlRef.current;
    if (!url) return;
    setError('');
    try {
      const ctx = getOrCreateContext();
      if (ctx.state === 'suspended') await ctx.resume();

      if (!audioElRef.current || audioElRef.current.src !== url) {
        teardownSource();

        const el = new Audio(url);
        el.crossOrigin = 'anonymous';
        el.addEventListener(
          'loadedmetadata',
          () => {
            const nextDuration = Number(el.duration) || 0;
            setAudioDuration(nextDuration);
          },
          { once: true }
        );
        audioElRef.current = el;

        const src = ctx.createMediaElementSource(el);
        src.connect(gainNodeRef.current);
        sourceNodeRef.current = src;

        el.addEventListener('ended', () => setIsPlaying(false), { once: true });
      }

      await audioElRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      setError(err?.message || 'Playback error');
    }
  }

  function pause() {
    audioElRef.current?.pause();
    setIsPlaying(false);
  }

  function stop() {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setAudioCurrentTime(0);
  }

  useEffect(() => {
    if (!Number.isFinite(audioDuration) || audioDuration <= 0) return;
    setVisemeTimeline((prev) => normalizeVisemeTimelineToDuration(prev, audioDuration));
  }, [audioDuration]);

  async function startRecording() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // Connect mic to analyser so lip sync works during recording too
      const ctx = getOrCreateContext();
      if (ctx.state === 'suspended') await ctx.resume();

      const micSrc = ctx.createMediaStreamSource(stream);
      // Intentionally disconnect analyser from the AudioContext destination while
      // recording.  Without this, the mic input would be routed to speakers,
      // causing an audible echo / feedback loop.  The analyser is reconnected
      // to destination once recording stops so playback works normally.
      try { analyserRef.current.disconnect(); } catch { /* ignore */ }
      micSrc.connect(gainNodeRef.current);
      micSourceRef.current = micSrc;

      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        teardownSource();
        teardownMic();
        revokeCurrentUrl();

        // Reconnect analyser → destination for playback
        try {
          analyserRef.current.connect(audioCtxRef.current.destination);
        } catch { /* ignore */ }

        setUrl(URL.createObjectURL(blob));
        setIsRecording(false);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      setError(err?.message || 'Microphone access denied');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }

  return {
    analyserRef,
    audioUrl,
    isPlaying,
    isRecording,
    isTTSLoading,
    isSpeaking,
    error,
    audioMetrics,
    audioProcessing,
    lipSyncConfig,
    visemeTimeline,
    audioCurrentTime,
    audioDuration,
    loadFile,
    loadUrl,
    loadVisemeTimeline,
    clearVisemeTimeline,
    applyVisemeTimeline,
    generateVisemeTimelineFromText,
    generateWithAzure,
    speakWithWebSpeech,
    stopWebSpeech,
    play,
    pause,
    stop,
    startRecording,
    stopRecording,
    updateAudioProcessing,
    updateLipSyncConfig,
  };
}

function normalizeVisemeTimeline(payload) {
  const cues = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.mouthCues)
      ? payload.mouthCues
      : [];

  return cues
    .map((cue) => {
      const start = Number(cue?.start);
      const end = Number(cue?.end);
      const value = String(cue?.value || cue?.viseme || '').trim().toUpperCase();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || !value) {
        return null;
      }
      return { start, end, value };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
}

function normalizeVisemeTimelineToDuration(cues, durationSec) {
  if (!Array.isArray(cues) || cues.length === 0) return [];

  const duration = Number(durationSec);
  if (!Number.isFinite(duration) || duration <= 0) {
    return cues;
  }

  const lastEnd = Number(cues[cues.length - 1]?.end || 0);
  if (!Number.isFinite(lastEnd) || lastEnd <= 0) {
    return cues;
  }

  // Skip tiny differences to avoid pointless state churn.
  if (Math.abs(lastEnd - duration) <= 0.03) {
    return cues;
  }

  const scale = duration / lastEnd;
  return cues.map((cue) => {
    const start = Math.max(0, cue.start * scale);
    const end = Math.max(start + 0.01, cue.end * scale);
    return { ...cue, start, end };
  });
}

function textToVisemeTimeline(input) {
  const text = String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const cues = [];
  let cursor = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1] || '';
    const cue = charToRhubarbCue(ch, next);
    if (!cue) continue;

    const duration = cueDuration(cue, ch);
    cues.push({ start: cursor, end: cursor + duration, value: cue });
    cursor += duration;
  }

  // Merge contiguous identical cues.
  const merged = [];
  cues.forEach((cue) => {
    const last = merged[merged.length - 1];
    if (last && last.value === cue.value && Math.abs(last.end - cue.start) < 1e-6) {
      last.end = cue.end;
    } else {
      merged.push({ ...cue });
    }
  });

  return merged;
}

function charToRhubarbCue(ch, next) {
  if (!ch) return null;
  if (/\s|[,.!?;:]/.test(ch)) return 'X';
  if (/[ae]/.test(ch)) return 'A';
  if (/[i]/.test(ch)) return 'C';
  if (/[o]/.test(ch)) return 'E';
  if (/[u]/.test(ch)) return 'F';
  if (/[bmp]/.test(ch)) return 'B';
  if (/[fv]/.test(ch)) return 'G';
  if (/[tdnlr]/.test(ch)) return 'D';
  if (/[szxj]/.test(ch)) return 'H';
  if (ch === 'c' && /[eiy]/.test(next)) return 'H';
  if (/[kgq]/.test(ch)) return 'A';
  if (ch === 'h') return 'X';
  return 'D';
}

function cueDuration(cue, ch) {
  if (cue === 'X') return /\s/.test(ch) ? 0.08 : 0.06;
  if (cue === 'B') return 0.075;
  if (cue === 'G' || cue === 'H') return 0.09;
  if (cue === 'C') return 0.11;
  if (cue === 'E' || cue === 'F') return 0.12;
  if (cue === 'A') return 0.13;
  return 0.1;
}

