import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * AvaturnEmbed — inline iframe that lets users build their avatar
 * on demo.avaturn.dev and captures the exported GLB URL.
 *
 * Props:
 *   onExport(url) – called when Avaturn exports a GLB
 *   onClose()     – called when the user dismisses the panel
 */
export default function AvaturnEmbed({ onExport, onClose }) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);

  // Listen for Avaturn postMessage export events
  React.useEffect(() => {
    function handleMessage(event) {
      // Avaturn sends { source: 'avaturn', eventName: 'v2.avatar.exported', data: { url } }
      if (event.data?.source === 'avaturn' && event.data?.eventName === 'v2.avatar.exported') {
        const url = event.data?.data?.url;
        if (url) onExport(url);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onExport]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-xl overflow-hidden border border-gray-600" style={{ height: 480 }}>
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-gray-400 text-sm">
            Loading Avaturn…
          </div>
        )}
        <iframe
          src="https://demo.avaturn.dev"
          title="Avaturn Avatar Creator"
          className="w-full h-full border-0"
          allow="camera; microphone"
          onLoad={() => setReady(true)}
        />
      </div>
      <button
        onClick={onClose}
        className="text-sm text-gray-400 hover:text-white transition-colors text-center"
      >
        {t('closeAvaturn')}
      </button>
    </div>
  );
}
