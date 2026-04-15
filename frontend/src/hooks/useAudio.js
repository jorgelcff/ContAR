import { useState, useRef } from 'react';

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

  // Web Audio refs
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const audioElRef = useRef(null);
  const sourceNodeRef = useRef(null);

  // Recording refs
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const micStreamRef = useRef(null);
  const micSourceRef = useRef(null);

  // Track the current URL in a ref so callbacks never go stale
  const audioUrlRef = useRef('');

  // ── Private helpers ──────────────────────────────────────────────

  function getOrCreateContext() {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
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
    setError('');
    setUrl(URL.createObjectURL(file));
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
        audioElRef.current = el;

        const src = ctx.createMediaElementSource(el);
        src.connect(analyserRef.current);
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
  }

  async function startRecording() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // Connect mic to analyser so lip sync works during recording too
      const ctx = getOrCreateContext();
      if (ctx.state === 'suspended') await ctx.resume();

      const micSrc = ctx.createMediaStreamSource(stream);
      // Disconnect analyser from destination to avoid mic feedback in speakers
      try { analyserRef.current.disconnect(); } catch { /* ignore */ }
      micSrc.connect(analyserRef.current);
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
    error,
    loadFile,
    play,
    pause,
    stop,
    startRecording,
    stopRecording,
  };
}

