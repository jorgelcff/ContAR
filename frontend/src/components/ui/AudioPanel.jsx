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
  onLoadFile,
  onPlay,
  onPause,
  onStop,
  onStartRec,
  onStopRec,
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

      <p className="text-xs text-gray-500">{t('audioLipSyncHint')}</p>
    </section>
  );
}
