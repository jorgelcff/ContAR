import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { TooltipIcon } from './Tooltip';

const PROVIDERS = [
  { id: 'azure',      labelKey: 'apProviderAzureLabel',     descKey: 'apProviderAzureDesc',     icon: 'sparkles' },
  { id: 'webspeech',  labelKey: 'apProviderWebspeechLabel', descKey: 'apProviderWebspeechDesc', icon: 'volume' },
];

const AZURE_VOICES = [
  { id: 'pt-BR-FranciscaNeural', label: 'Francisca — PT-BR feminina' },
  { id: 'pt-BR-AntonioNeural',   label: 'Antonio — PT-BR masculino' },
  { id: 'pt-BR-BrendaNeural',    label: 'Brenda — PT-BR feminina' },
  { id: 'pt-BR-DonatoNeural',    label: 'Donato — PT-BR masculino' },
  { id: 'en-US-JennyNeural',     label: 'Jenny — EN feminina' },
];

const WEB_LANGS = [
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
  const fileInputRef   = useRef(null);
  const visemeInputRef = useRef(null);
  const [provider, setProvider]       = useState('azure');
  const [selectedVoice, setSelectedVoice] = useState(AZURE_VOICES[0].id);
  const [selectedLang, setSelectedLang]   = useState('pt-BR');
  const [showAdvanced, setShowAdvanced]   = useState(false);
  const [visemeTextInput, setVisemeTextInput] = useState(speechText || '');
  // Keep the lip-sync-from-text box pre-filled with the narrator's text — if the
  // user records/uploads audio that matches it, they can sync with one tap
  // without retyping anything.
  const [syncedSpeechText, setSyncedSpeechText] = useState(speechText || '');
  if ((speechText || '') !== syncedSpeechText) {
    setSyncedSpeechText(speechText || '');
    setVisemeTextInput(speechText || '');
  }

  const hasSpeechText = !!String(speechText || '').trim();
  const isGenerating  = isTTSLoading || isSpeaking;
  const hasAudio      = !!audioUrl;
  const hasVisemes    = !!visemeTimeline?.length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <Icon name="audio" className="w-4 h-4 text-gray-300" />
        <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          {t('audio')}
        </p>
        <TooltipIcon text={t('apOverviewHelp')} />
      </div>

      {/* ── Provider selector ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-1.5">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => setProvider(p.id)}
            className={`flex flex-col items-center gap-1 rounded-xl border py-2 px-2 text-center transition-all ${
              provider === p.id
                ? 'border-violet-500/60 bg-violet-500/15 text-white'
                : 'border-white/8 bg-gray-800 text-gray-400 hover:text-gray-200 hover:border-white/15'
            }`}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <Icon name={p.icon} className="w-3.5 h-3.5" /> {t(p.labelKey)}
            </span>
            <span className="text-[10px] text-gray-500 leading-tight">{t(p.descKey)}</span>
          </button>
        ))}
      </div>

      {/* ── Generation area ───────────────────────────────────── */}
      <div className="rounded-xl border border-white/8 bg-gray-800/60 p-3 flex flex-col gap-2.5">

        {/* Text preview */}
        {hasSpeechText ? (
          <p className="text-xs text-gray-400 bg-black/30 rounded-lg px-3 py-2 line-clamp-2 italic">
            "{speechText}"
          </p>
        ) : (
          <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
            <Icon name="warning" className="w-3.5 h-3.5" /> {t('apWriteTextFirst')}
          </p>
        )}

        {/* Azure: voice selector */}
        {provider === 'azure' && (
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-400"
          >
            {AZURE_VOICES.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        )}

        {/* Web Speech: language selector */}
        {provider === 'webspeech' && (
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          >
            {WEB_LANGS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        )}

        {/* Generate button */}
        {provider === 'azure' && (
          <button
            onClick={() => onGenerateTTS(speechText, selectedVoice)}
            disabled={isTTSLoading || !hasSpeechText}
            className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {isTTSLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('apGenerating')}
              </>
            ) : <span className="flex items-center gap-1.5"><Icon name="sparkles" className="w-4 h-4" /> {t('apGenerateSpeech')}</span>}
          </button>
        )}

        {provider === 'webspeech' && (
          isSpeaking ? (
            <button
              onClick={onStopWebSpeech}
              className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Icon name="stop" className="w-4 h-4" /> {t('apStopSpeech')}
            </button>
          ) : (
            <button
              onClick={() => onSpeakWebSpeech(speechText, selectedLang)}
              disabled={!hasSpeechText}
              className="w-full py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              <span className="flex items-center justify-center gap-1.5"><Icon name="volume" className="w-4 h-4" /> {t('apSpeakNow')}</span>
            </button>
          )
        )}

        {/* Status feedback */}
        {!!visemeTimeline?.length && !isGenerating && provider === 'azure' && (
          <p className="text-xs text-emerald-400 flex items-center gap-1.5">
            <Icon name="check" className="w-3.5 h-3.5" /> {t('apVisemesSynced', { count: visemeTimeline.length })}
          </p>
        )}
        {provider === 'webspeech' && !isSpeaking && (
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <Icon name="info" className="w-3.5 h-3.5" /> {t('apLipsyncApprox')}
          </p>
        )}
      </div>

      {/* ── Playback ──────────────────────────────────────────── */}
      {hasAudio && (
        <div className="flex gap-2">
          <button
            onClick={isPlaying ? onPause : onPlay}
            disabled={isRecording}
            className="flex-1 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <Icon name={isPlaying ? 'pause' : 'play'} className="w-4 h-4" />
            {isPlaying ? t('audioPause') : t('audioPlay')}
          </button>
          <button
            onClick={onStop}
            disabled={isRecording}
            className="px-3 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white text-sm transition-colors flex items-center justify-center gap-1.5"
          >
            <Icon name="stop" className="w-4 h-4" />
            {t('audioStop')}
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <Icon name="warning" className="w-3.5 h-3.5 shrink-0" /> {error}
        </p>
      )}

      {/* ── Upload / Record ───────────────────────────────────── */}
      <div className="rounded-xl border border-white/8 bg-gray-800/60 p-3 flex flex-col gap-2.5">
        <p className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
          <Icon name="upload" className="w-3.5 h-3.5" /> {t('apUseOwnAudio')}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <Icon name="upload" className="w-3.5 h-3.5" /> {t('audioUpload')}
          </button>
          <button
            onClick={isRecording ? onStopRec : onStartRec}
            className={`flex-1 py-2 rounded-lg text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              isRecording ? 'bg-red-600 hover:bg-red-500 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <Icon name="microphone" className="w-3.5 h-3.5" /> {isRecording ? t('audioStopRec') : t('audioStartRec')}
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="audio/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onLoadFile(f); e.target.value = ''; }} className="hidden" />

        {/* Lip sync for uploaded/recorded audio: estimate visemes from text */}
        {hasAudio && (
          <div className="rounded-lg border border-indigo-700/40 bg-indigo-950/20 p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Icon name="waveform" className="w-3.5 h-3.5 text-indigo-300" />
              <p className="text-xs font-semibold text-indigo-200">{t('apVisemeByText')}</p>
              <TooltipIcon text={t('apVisemeByTextHelp')} />
            </div>
            <textarea
              rows={2}
              value={visemeTextInput}
              onChange={(e) => setVisemeTextInput(e.target.value)}
              placeholder={t('apEstimatedTiming')}
              className="w-full rounded border border-indigo-700 bg-indigo-950/60 px-2 py-1 text-xs text-indigo-100 placeholder-indigo-400/60"
            />
            <div className="flex gap-2">
              <button
                onClick={() => onGenerateVisemeFromText(visemeTextInput)}
                disabled={!visemeTextInput.trim()}
                className="flex-1 rounded-lg bg-indigo-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                <Icon name="sparkles" className="w-3.5 h-3.5" /> {t('apGenLocalTimeline')}
              </button>
              {hasVisemes && (
                <button onClick={onClearVisemeTimeline} className="px-2.5 py-1.5 rounded-lg bg-gray-600 hover:bg-gray-500 text-white text-xs transition-colors">
                  {t('apClear')}
                </button>
              )}
            </div>
            {hasVisemes && (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                <Icon name="check" className="w-3.5 h-3.5" /> {t('apVisemesSynced', { count: visemeTimeline.length })}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Advanced (collapsible) ────────────────────────────── */}
      <button
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors py-1"
      >
        <Icon name="chevron-right" className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
        <Icon name="settings" className="w-3.5 h-3.5" />
        {t('arAdvancedSettings')}
      </button>

      {showAdvanced && (
        <div className="flex flex-col gap-3">
          {/* Audio monitor */}
          <div className="rounded-md border border-cyan-700/50 bg-cyan-950/30 p-2 text-xs text-cyan-100">
            <p className="mb-1 font-semibold uppercase tracking-wide flex items-center gap-1.5">
              <Icon name="monitor" className="w-3.5 h-3.5" /> {t('apMonitor')}
            </p>
            <div className="h-2 rounded bg-cyan-950/80 overflow-hidden">
              <div className="h-full bg-cyan-400 transition-all" style={{ width: `${Math.min(100, Math.round((audioMetrics?.level || 0) * 100))}%` }} />
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-2 text-[11px]">
              <span>RMS: {(audioMetrics?.rms || 0).toFixed(3)}</span>
              <span>{audioMetrics?.clipping ? t('apClipping') : 'OK'}</span>
            </div>
          </div>

          {/* Viseme JSON import */}
          <div className="flex gap-2">
            <button onClick={() => visemeInputRef.current?.click()} className="flex-1 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
              <Icon name="upload" className="w-3.5 h-3.5" /> {t('apImportVisemeJson')}
            </button>
          </div>
          <input ref={visemeInputRef} type="file" accept=".json" onChange={(e) => { const f = e.target.files?.[0]; if (f) onLoadVisemeFile(f); e.target.value = ''; }} className="hidden" />

          {/* Lip sync tuning */}
          <div className="rounded-md border border-gray-700 bg-gray-900/60 p-2 text-xs text-gray-200">
            <p className="mb-2 font-semibold uppercase tracking-wide text-gray-300 flex items-center gap-1.5">
              <Icon name="settings" className="w-3.5 h-3.5" /> {t('apLipSync')}
            </p>
            <label className="block mb-1">Crossfade: {Math.round(Number(lipSyncConfig?.timelineCrossfadeSec || 0.08) * 1000)} ms</label>
            <input type="range" min="0.02" max="0.18" step="0.005" value={lipSyncConfig?.timelineCrossfadeSec || 0.08} onChange={(e) => onLipSyncConfigChange({ timelineCrossfadeSec: Number(e.target.value) })} className="w-full mb-2" />
            <label className="block mb-1">{t('apVisemeMode')}</label>
            <select value={lipSyncConfig?.visemeMode || 'heuristic'} onChange={(e) => onLipSyncConfigChange({ visemeMode: e.target.value })} className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs">
              <option value="timeline">{t('apTimelineSync')}</option>
              <option value="heuristic">{t('apHeuristic')}</option>
              <option value="amplitude">{t('apAmplitudeOnly')}</option>
            </select>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 flex items-center gap-1.5">
        <Icon name="info" className="w-3.5 h-3.5 shrink-0" /> {t('audioLipSyncHint')}
      </p>
    </section>
  );
}
