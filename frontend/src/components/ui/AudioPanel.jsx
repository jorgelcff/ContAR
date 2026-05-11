import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Azure Neural voices (used when AZURE_SPEECH_KEY is configured on backend)
const VOICES = [
  { id: 'pt-BR-FranciscaNeural', label: 'Francisca — PT-BR feminina' },
  { id: 'pt-BR-AntonioNeural',   label: 'Antonio — PT-BR masculino' },
  { id: 'pt-BR-BrendaNeural',    label: 'Brenda — PT-BR feminina' },
  { id: 'pt-BR-DonatoNeural',    label: 'Donato — PT-BR masculino' },
  { id: 'en-US-JennyNeural',     label: 'Jenny — EN feminina' },
];

const WEB_SPEECH_LANGS = [
  { code: 'pt-BR', label: 'Português (BR)' },
  { code: 'pt-PT', label: 'Português (PT)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'es-ES', label: 'Español' },
];

export default function AudioPanel({
  speechText,
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
  onGenerateTTS,
  onSpeakWebSpeech,
  onStopWebSpeech,
  onLoadFile,
  onLoadVisemeFile,
  onClearVisemeTimeline,
  onGenerateVisemeFromText,
  onPlay,
  onPause,
  onStop,
  onStartRec,
  onStopRec,
  onAudioProcessingChange,
  onLipSyncConfigChange,
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const visemeInputRef = useRef(null);
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [selectedLang, setSelectedLang] = useState('pt-BR');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [visemeTextInput, setVisemeTextInput] = useState('');

  const hasSpeechText = !!String(speechText || '').trim();

  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
        {t('audio')}
      </p>

      {/* ── ElevenLabs TTS (primary) ───────────────────────────────── */}
      <div className="rounded-xl border border-violet-500/25 bg-violet-950/30 p-3 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">🎙️</span>
          <p className="text-xs font-semibold text-violet-200">Gerar fala com IA <span className="text-violet-400 font-normal">(Azure / ElevenLabs)</span></p>
        </div>

        {hasSpeechText ? (
          <p className="text-xs text-gray-400 bg-black/30 rounded-lg px-3 py-2 line-clamp-2 italic">
            "{speechText}"
          </p>
        ) : (
          <p className="text-xs text-amber-400/80">
            Escreva um texto no campo "Fala do narrador" para gerar a voz.
          </p>
        )}

        <select
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-400"
        >
          {VOICES.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>

        <button
          onClick={() => onGenerateTTS(speechText, selectedVoice)}
          disabled={isTTSLoading || !hasSpeechText}
          className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {isTTSLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Gerando…
            </>
          ) : (
            '✨ Gerar fala'
          )}
        </button>

        {!!visemeTimeline?.length && !isTTSLoading && (
          <p className="text-xs text-emerald-400 flex items-center gap-1.5">
            <span>✓</span>
            {visemeTimeline.length} visemes sincronizados com o áudio
          </p>
        )}
      </div>

      {/* ── Web Speech API (gratuito, sem API key) ────────────────── */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">🔊</span>
          <p className="text-xs font-semibold text-emerald-200">Voz do Navegador <span className="text-emerald-500 font-normal">(gratuito)</span></p>
        </div>

        {hasSpeechText ? (
          <p className="text-xs text-gray-400 bg-black/30 rounded-lg px-3 py-2 line-clamp-2 italic">
            "{speechText}"
          </p>
        ) : (
          <p className="text-xs text-amber-400/80">Escreva um texto no campo "Fala do narrador".</p>
        )}

        <select
          value={selectedLang}
          onChange={(e) => setSelectedLang(e.target.value)}
          className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        >
          {WEB_SPEECH_LANGS.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>

        {isSpeaking ? (
          <button
            onClick={onStopWebSpeech}
            className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            ⏹ Parar fala
          </button>
        ) : (
          <button
            onClick={() => onSpeakWebSpeech(speechText, selectedLang)}
            disabled={!hasSpeechText}
            className="w-full py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            🔊 Falar agora
          </button>
        )}

        <p className="text-xs text-gray-500">Usa a voz do browser — sem internet extra. Lip sync aproximado pelo texto.</p>
      </div>

      {/* ── Playback controls ─────────────────────────────────────── */}
      {audioUrl && (
        <div className="flex gap-2">
          <button
            onClick={isPlaying ? onPause : onPlay}
            disabled={isRecording}
            className="flex-1 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {isPlaying ? t('audioPause') : t('audioPlay')}
          </button>
          <button
            onClick={onStop}
            disabled={isRecording}
            className="px-3 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white text-sm transition-colors"
          >
            {t('audioStop')}
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* ── Upload / Record ───────────────────────────────────────── */}
      <div className="flex gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium transition-colors"
        >
          {t('audioUpload')}
        </button>
        <button
          onClick={isRecording ? onStopRec : onStartRec}
          className={`flex-1 py-2 rounded-lg text-white text-xs font-medium transition-colors ${
            isRecording
              ? 'bg-red-600 hover:bg-red-500 animate-pulse'
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          {isRecording ? t('audioStopRec') : t('audioStartRec')}
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept="audio/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onLoadFile(f); e.target.value = ''; }} className="hidden" />

      {/* ── Advanced settings (collapsible) ──────────────────────── */}
      <button
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors py-1"
      >
        <span className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
        Configurações avançadas
      </button>

      {showAdvanced && (
        <div className="flex flex-col gap-3">
          {/* Audio monitor */}
          <div className="rounded-md border border-cyan-700/50 bg-cyan-950/30 p-2 text-xs text-cyan-100">
            <p className="mb-1 font-semibold uppercase tracking-wide">Audio Monitor</p>
            <div className="h-2 rounded bg-cyan-950/80 overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all"
                style={{ width: `${Math.min(100, Math.round((audioMetrics?.level || 0) * 100))}%` }}
              />
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
              <span>RMS: {(audioMetrics?.rms || 0).toFixed(3)}</span>
              <span>Speech: {(audioMetrics?.speechBandEnergy || 0).toFixed(3)}</span>
              <span>Peak: {(audioMetrics?.peak || 0).toFixed(3)}</span>
              <span>{audioMetrics?.clipping ? 'Clipping!' : 'OK'}</span>
            </div>
          </div>

          {/* Viseme JSON upload */}
          <div className="flex gap-2">
            <button
              onClick={() => visemeInputRef.current?.click()}
              className="flex-1 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-medium transition-colors"
            >
              Importar Viseme JSON
            </button>
            {!!visemeTimeline?.length && (
              <button onClick={onClearVisemeTimeline} className="px-2.5 py-1.5 rounded-lg bg-gray-600 hover:bg-gray-500 text-white text-xs transition-colors">
                Limpar
              </button>
            )}
          </div>
          <input ref={visemeInputRef} type="file" accept=".json" onChange={(e) => { const f = e.target.files?.[0]; if (f) onLoadVisemeFile(f); e.target.value = ''; }} className="hidden" />

          {/* Text-to-visemes (manual / fallback) */}
          <div className="rounded-md border border-indigo-700/40 bg-indigo-950/20 p-2 text-xs text-indigo-100">
            <p className="mb-1 font-semibold uppercase tracking-wide">Texto → Visemes (local)</p>
            <textarea
              rows={2}
              value={visemeTextInput}
              onChange={(e) => setVisemeTextInput(e.target.value)}
              placeholder="Fallback sem API — timing estimado"
              className="mb-1.5 w-full rounded border border-indigo-700 bg-indigo-950/60 px-2 py-1 text-xs placeholder-indigo-400/60"
            />
            <button
              onClick={() => onGenerateVisemeFromText(visemeTextInput)}
              className="w-full rounded bg-indigo-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-600"
            >
              Gerar timeline local
            </button>
          </div>

          {/* Audio processing */}
          <div className="rounded-md border border-gray-700 bg-gray-900/60 p-2 text-xs text-gray-200">
            <p className="mb-2 font-semibold uppercase tracking-wide text-gray-300">Audio Processing</p>
            <label className="block mb-1">Gain: {Number(audioProcessing?.inputGain || 1).toFixed(2)}</label>
            <input type="range" min="0.5" max="3" step="0.05" value={audioProcessing?.inputGain || 1} onChange={(e) => onAudioProcessingChange({ inputGain: Number(e.target.value) })} className="w-full mb-2" />
            <label className="block mb-1">Smoothing: {Number(audioProcessing?.analyserSmoothing || 0).toFixed(2)}</label>
            <input type="range" min="0.2" max="0.95" step="0.01" value={audioProcessing?.analyserSmoothing || 0.72} onChange={(e) => onAudioProcessingChange({ analyserSmoothing: Number(e.target.value) })} className="w-full" />
          </div>

          {/* Lip sync tuning */}
          <div className="rounded-md border border-gray-700 bg-gray-900/60 p-2 text-xs text-gray-200">
            <p className="mb-2 font-semibold uppercase tracking-wide text-gray-300">Lip Sync Tuning</p>
            <label className="block mb-1">Amplitude: {Number(lipSyncConfig?.amplitudeMultiplier || 0).toFixed(1)}</label>
            <input type="range" min="4" max="24" step="0.5" value={lipSyncConfig?.amplitudeMultiplier || 12} onChange={(e) => onLipSyncConfigChange({ amplitudeMultiplier: Number(e.target.value) })} className="w-full mb-2" />
            <label className="block mb-1">Crossfade: {Math.round(Number(lipSyncConfig?.timelineCrossfadeSec || 0.08) * 1000)} ms</label>
            <input type="range" min="0.02" max="0.18" step="0.005" value={lipSyncConfig?.timelineCrossfadeSec || 0.08} onChange={(e) => onLipSyncConfigChange({ timelineCrossfadeSec: Number(e.target.value) })} className="w-full mb-2" />
            <label className="block mb-1">Mouth weight: {Number(lipSyncConfig?.timelineMouthWeight || 0.72).toFixed(2)}</label>
            <input type="range" min="0" max="1" step="0.01" value={lipSyncConfig?.timelineMouthWeight || 0.72} onChange={(e) => onLipSyncConfigChange({ timelineMouthWeight: Number(e.target.value) })} className="w-full mb-2" />
            <label className="block mb-1">Viseme mode</label>
            <select value={lipSyncConfig?.visemeMode || 'heuristic'} onChange={(e) => onLipSyncConfigChange({ visemeMode: e.target.value })} className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs">
              <option value="timeline">Timeline (sincronizado)</option>
              <option value="heuristic">Heurístico (amplitude)</option>
              <option value="amplitude">Só amplitude</option>
            </select>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">{t('audioLipSyncHint')}</p>
    </section>
  );
}
