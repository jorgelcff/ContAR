import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * PublishModal — shown after a successful publish.
 * Displays the shareable URL with a copy-to-clipboard button.
 */
export default function PublishModal({ sceneId, onClose }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const url = `${window.location.origin}/scene/${sceneId}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('input');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 flex flex-col gap-4">
        <h2 className="text-white text-lg font-bold">{t('publishSuccess')}</h2>

        <div>
          <p className="text-xs text-gray-400 mb-1">{t('shareUrl')}</p>
          <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-2">
            <span className="text-blue-300 text-sm break-all flex-1">{url}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={copy}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            {copied ? t('copied') : t('copyLink')}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors text-center"
          >
            {t('openViewer')}
          </a>
        </div>

        <button
          onClick={onClose}
          className="text-sm text-gray-400 hover:text-white transition-colors text-center"
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
}
