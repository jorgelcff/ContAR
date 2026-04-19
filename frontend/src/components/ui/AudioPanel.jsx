import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * AudioPanel — controls for audio upload, microphone recording,
 * and playback. Intended for the editor's left sidebar.
 *
 * Props:
 *   audioUrl      – current audio URL ('' if none)
 *   isPlaying     – boolean
 *   isRecording   – boolean
 *   error         – error string ('' if none)
 *   onLoadFile    – (File) => void
 *   onPlay        – () => void
 *   onPause       – () => void
 *   onStop        – () => void
 *   onStartRec    – () => void
 *   onStopRec     – () => void
 */
export default function AudioPanel({
  audioUrl,
  isPlaying,
  isRecording,
  error,
  audioMetrics,
  audioProcessing,
  lipSyncConfig,
  onLoadFile,
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

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onLoadFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
        {t('audio')}
      </p>

      {/* File upload */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full py-2 rounded-lg bg-violet-700 hover:bg-violet-600 text-white text-sm font-medium transition-colors"
      >
        {t('audioUpload')}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Microphone recording */}
      <button
        onClick={isRecording ? onStopRec : onStartRec}
        className={`w-full py-2 rounded-lg text-white text-sm font-medium transition-colors ${
          isRecording
            ? 'bg-red-600 hover:bg-red-500 animate-pulse'
            : 'bg-pink-700 hover:bg-pink-600'
        }`}
      >
        {isRecording ? t('audioStopRec') : t('audioStartRec')}
      </button>

      {/* Playback controls – only shown when audio is available */}
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

      {audioUrl && (
        <p className="text-xs text-gray-400 truncate">
          {t('audioReady')}
        </p>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

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
          <span>{audioMetrics?.clipping ? 'Clipping detected' : 'No clipping'}</span>
        </div>
      </div>

      <div className="rounded-md border border-gray-700 bg-gray-900/60 p-2 text-xs text-gray-200">
        <p className="mb-2 font-semibold uppercase tracking-wide text-gray-300">Audio Processing</p>

        <label className="block mb-1">Input gain: {Number(audioProcessing?.inputGain || 1).toFixed(2)}</label>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.05"
          value={audioProcessing?.inputGain || 1}
          onChange={(e) => onAudioProcessingChange({ inputGain: Number(e.target.value) })}
          className="w-full mb-2"
        />

        <label className="block mb-1">Analyser smoothing: {Number(audioProcessing?.analyserSmoothing || 0).toFixed(2)}</label>
        <input
          type="range"
          min="0.2"
          max="0.95"
          step="0.01"
          value={audioProcessing?.analyserSmoothing || 0.72}
          onChange={(e) => onAudioProcessingChange({ analyserSmoothing: Number(e.target.value) })}
          className="w-full mb-2"
        />

        <label className="block mb-1">Compressor threshold: {Math.round(audioProcessing?.compressorThreshold || -24)} dB</label>
        <input
          type="range"
          min="-60"
          max="-6"
          step="1"
          value={audioProcessing?.compressorThreshold || -24}
          onChange={(e) => onAudioProcessingChange({ compressorThreshold: Number(e.target.value) })}
          className="w-full mb-2"
        />

        <label className="block mb-1">Compressor ratio: {Number(audioProcessing?.compressorRatio || 3).toFixed(1)}:1</label>
        <input
          type="range"
          min="1"
          max="10"
          step="0.5"
          value={audioProcessing?.compressorRatio || 3}
          onChange={(e) => onAudioProcessingChange({ compressorRatio: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      <div className="rounded-md border border-gray-700 bg-gray-900/60 p-2 text-xs text-gray-200">
        <p className="mb-2 font-semibold uppercase tracking-wide text-gray-300">Lip Sync Tuning</p>

        <label className="block mb-1">Amplitude multiplier: {Number(lipSyncConfig?.amplitudeMultiplier || 0).toFixed(1)}</label>
        <input
          type="range"
          min="4"
          max="24"
          step="0.5"
          value={lipSyncConfig?.amplitudeMultiplier || 12}
          onChange={(e) => onLipSyncConfigChange({ amplitudeMultiplier: Number(e.target.value) })}
          className="w-full mb-2"
        />

        <label className="block mb-1">Noise gate: {Number(lipSyncConfig?.noiseGate || 0).toFixed(3)}</label>
        <input
          type="range"
          min="0"
          max="0.2"
          step="0.002"
          value={lipSyncConfig?.noiseGate || 0.02}
          onChange={(e) => onLipSyncConfigChange({ noiseGate: Number(e.target.value) })}
          className="w-full mb-2"
        />

        <label className="block mb-1">Speech-band weight: {Number(lipSyncConfig?.speechBandMix || 0).toFixed(2)}</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={lipSyncConfig?.speechBandMix || 0.65}
          onChange={(e) => {
            const speechBandMix = Number(e.target.value);
            onLipSyncConfigChange({ speechBandMix, fullBandMix: Number((1 - speechBandMix).toFixed(2)) });
          }}
          className="w-full mb-2"
        />

        <label className="block mb-1">Jaw fallback strength: {Number(lipSyncConfig?.jawFallbackStrength || 0).toFixed(2)}</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.02"
          value={lipSyncConfig?.jawFallbackStrength || 0.7}
          onChange={(e) => onLipSyncConfigChange({ jawFallbackStrength: Number(e.target.value) })}
          className="w-full mb-2"
        />

        <div className="space-y-1">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(lipSyncConfig?.enableBandEnergy)}
              onChange={(e) => onLipSyncConfigChange({ enableBandEnergy: e.target.checked })}
            />
            Enable speech-band analysis
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(lipSyncConfig?.enableJawFallback)}
              onChange={(e) => onLipSyncConfigChange({ enableJawFallback: e.target.checked })}
            />
            Enable jaw-bone fallback
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(lipSyncConfig?.showBlendshapeDebug)}
              onChange={(e) => onLipSyncConfigChange({ showBlendshapeDebug: e.target.checked })}
            />
            Show full blendshape list
          </label>
        </div>

        <label className="block mt-2 mb-1">Viseme mode</label>
        <select
          value={lipSyncConfig?.visemeMode || 'heuristic'}
          onChange={(e) => onLipSyncConfigChange({ visemeMode: e.target.value })}
          className="w-full rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs"
        >
          <option value="heuristic">Heuristic visemes</option>
          <option value="amplitude">Amplitude only</option>
        </select>
      </div>

      <p className="text-xs text-gray-500">{t('audioLipSyncHint')}</p>
    </section>
  );
}
