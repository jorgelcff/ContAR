import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AvaturnEmbed from './AvaturnEmbed';
import TransformControls from './TransformControls';

/**
 * LeftPanel — the editor's control sidebar.
 *
 * Props: (see EditorPage)
 */
export default function LeftPanel({
  avatarUrl,
  onAvatarUrlChange,
  onLoadAvatar,
  transform,
  onTransformUpdate,
  speechText,
  onAddSpeech,
  onClearSpeech,
  sceneTitle,
  onSceneTitleChange,
  onSave,
  onPublish,
  isSaving,
  isPublishing,
}) {
  const { t } = useTranslation();
  const [urlInput, setUrlInput] = useState(avatarUrl);
  const [speechInput, setSpeechInput] = useState(speechText);
  const [showAvaturn, setShowAvaturn] = useState(false);

  const handleLoad = () => {
    if (urlInput.trim()) onLoadAvatar(urlInput.trim());
  };

  const handleAvaturnExport = (url) => {
    setUrlInput(url);
    onLoadAvatar(url);
    setShowAvaturn(false);
  };

  const handleAddSpeech = () => {
    onAddSpeech(speechInput.trim());
  };

  return (
    <aside className="w-80 shrink-0 flex flex-col gap-4 p-4 bg-gray-800 overflow-y-auto border-r border-gray-700">

      {/* ── Avatar Section ─────────────────────────── */}
      <section className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Avatar</p>

        <button
          onClick={() => setShowAvaturn((v) => !v)}
          className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          {t('openAvaturn')}
        </button>

        {showAvaturn && (
          <AvaturnEmbed
            onExport={handleAvaturnExport}
            onClose={() => setShowAvaturn(false)}
          />
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              onAvatarUrlChange(e.target.value);
            }}
            placeholder={t('avatarUrl')}
            className="flex-1 min-w-0 rounded-lg bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleLoad}
            className="shrink-0 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
          >
            {t('loadAvatar')}
          </button>
        </div>
        {!avatarUrl && (
          <p className="text-xs text-gray-500">{t('noAvatarHint')}</p>
        )}
      </section>

      <hr className="border-gray-700" />

      {/* ── Transform Section ──────────────────────── */}
      <TransformControls transform={transform} onUpdate={onTransformUpdate} />

      <hr className="border-gray-700" />

      {/* ── Speech Section ─────────────────────────── */}
      <section className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          {t('speech')}
        </p>
        <textarea
          rows={3}
          value={speechInput}
          onChange={(e) => setSpeechInput(e.target.value)}
          placeholder={t('speechPlaceholder')}
          className="w-full rounded-lg bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
        />
        <div className="flex gap-2">
          <button
            onClick={handleAddSpeech}
            className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
          >
            {t('addSpeech')}
          </button>
          {speechText && (
            <button
              onClick={() => { setSpeechInput(''); onClearSpeech(); }}
              className="py-2 px-3 rounded-lg bg-gray-600 hover:bg-gray-500 text-white text-sm transition-colors"
            >
              {t('clearSpeech')}
            </button>
          )}
        </div>
      </section>

      <hr className="border-gray-700" />

      {/* ── Scene Section ──────────────────────────── */}
      <section className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Scene</p>
        <input
          type="text"
          value={sceneTitle}
          onChange={(e) => onSceneTitleChange(e.target.value)}
          placeholder={t('sceneTitlePlaceholder')}
          className="w-full rounded-lg bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 placeholder-gray-400 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={onSave}
          disabled={isSaving}
          className="w-full py-2 rounded-lg bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {isSaving ? t('saving') : t('saveScene')}
        </button>
        <button
          onClick={onPublish}
          disabled={isPublishing}
          className="w-full py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {isPublishing ? t('publishing') : t('publish')}
        </button>
      </section>
    </aside>
  );
}
