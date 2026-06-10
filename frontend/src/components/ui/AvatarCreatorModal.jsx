import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import AvaturnEmbed from './AvaturnEmbed';
import AvatarGallery from './AvatarGallery';
import CharacterStudioEmbed from './CharacterStudioEmbed';
import Icon from './Icon';

const CREATORS = {
  avaturn:         { label: 'Criar Avatar — Avaturn',    icon: 'avatar' },
  characterstudio: { label: 'CharacterStudio',           icon: 'palette' },
  gallery:         { label: 'Galeria de Avatares (CC0)', icon: 'folder' },
};

export default function AvatarCreatorModal({ creator, onExport, onClose }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!creator) return null;

  const meta = CREATORS[creator] ?? { label: creator, icon: 'avatar' };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex flex-col w-full h-full sm:h-[92vh] sm:max-w-5xl bg-gray-900 sm:rounded-2xl overflow-hidden shadow-2xl border border-white/10">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <Icon name={meta.icon} className="w-4 h-4 text-gray-300" />
            <p className="text-sm font-semibold text-gray-100">{meta.label}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-700 transition-colors flex items-center gap-1"
          >
            <Icon name="close" className="w-4 h-4" /> Fechar
          </button>
        </div>

        {/* Content — fills remaining space */}
        <div className="flex-1 overflow-hidden">
          {creator === 'avaturn' && (
            <AvaturnEmbed
              onExport={(url) => { onExport(url); onClose(); }}
              onClose={onClose}
              fullHeight
            />
          )}

          {creator === 'characterstudio' && (
            <CharacterStudioEmbed
              onExport={(url) => { onExport(url); onClose(); }}
              onClose={onClose}
              fullHeight
            />
          )}

          {creator === 'gallery' && (
            <AvatarGallery
              onSelect={(url) => { onExport(url); onClose(); }}
              onClose={onClose}
              fullHeight
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
