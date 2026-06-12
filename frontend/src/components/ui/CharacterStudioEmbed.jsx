import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';

const STUDIO_URL = 'https://studio.m3org.com/';

export default function CharacterStudioEmbed({ onExport, onClose, fullHeight = false }) {
  const { t } = useTranslation();
  const iframeRef  = useRef(null);
  const fileRef    = useRef(null);
  const [exported, setExported] = useState(false);
  const [tab, setTab]           = useState('studio'); // 'studio' | 'upload'

  // Listen for postMessage export from CharacterStudio
  useEffect(() => {
    const handleMessage = (event) => {
      if (!event.data) return;
      const d = event.data;

      // CharacterStudio may send { type: 'export', url: '...' } or similar
      const url =
        d.url ||
        d.modelUrl ||
        d.glbUrl ||
        d.vrmUrl ||
        (d.type === 'export' && d.data?.url) ||
        null;

      if (url && typeof url === 'string' && /\.(glb|vrm)/i.test(url)) {
        setExported(true);
        onExport(url);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onExport]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    onExport(blobUrl);
    e.target.value = '';
  };

  return (
    <div className={`flex flex-col gap-2 ${fullHeight ? 'h-full p-3' : ''}`}>
      {/* Header — hidden in fullHeight mode (modal already has a header) */}
      {!fullHeight && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-200">CharacterStudio</p>
            <p className="text-[10px] text-gray-500">{t('csOpenSource')}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors"><Icon name="close" className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tab toggle */}
      <div className="flex gap-1 rounded-xl bg-gray-800 p-1 shrink-0">
        {[
          { id: 'studio', label: 'Editor' },
          { id: 'upload', label: t('csTabImport') },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
              tab === item.id ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'studio' && (
        <div className={`flex flex-col gap-2 ${fullHeight ? 'flex-1 min-h-0' : ''}`}>
          {/* iframe — fills remaining height in fullHeight mode */}
          <div
            className="rounded-xl overflow-hidden border border-white/10 bg-black"
            style={fullHeight ? { flex: 1, minHeight: 0 } : { height: 420 }}
          >
            <iframe
              ref={iframeRef}
              src={STUDIO_URL}
              title="CharacterStudio"
              className="w-full h-full border-0"
              allow="camera; microphone; fullscreen"
            />
          </div>

          {exported ? (
            <p className="text-xs text-emerald-400 text-center shrink-0 flex items-center justify-center gap-1">
              <Icon name="check" className="w-3.5 h-3.5" /> {t('csExported')}
            </p>
          ) : (
            <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200 shrink-0">
              <p className="font-semibold mb-1">{t('csHowToExport')}</p>
              <ol className="space-y-0.5 text-amber-200/80">
                <li>1. {t('csStep1')}</li>
                <li>2. {t('csStep2Pre')} <strong>Export</strong> {t('csStep2Post')}</li>
                <li>3. {t('csStep3Pre')} <strong>{t('csStep3Tab')}</strong> {t('csStep3Post')}</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {tab === 'upload' && (
        <div className="flex flex-col gap-3 py-2">
          <p className="text-xs text-gray-400">
            Exporte seu avatar do CharacterStudio e carregue o arquivo VRM ou GLB aqui:
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-6 rounded-xl border-2 border-dashed border-gray-600 hover:border-cyan-500 text-gray-400 hover:text-cyan-300 text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="upload" className="w-5 h-5" /> Clique para selecionar VRM / GLB
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".glb,.vrm"
            onChange={handleFileUpload}
            className="hidden"
          />
          <p className="text-[10px] text-gray-600 text-center">
            O arquivo é carregado localmente — use "GLB / VRM" no painel principal para enviar ao servidor.
          </p>
        </div>
      )}
    </div>
  );
}
