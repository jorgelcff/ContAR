import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { useTranslation } from 'react-i18next';

const OSA_BASE = 'https://raw.githubusercontent.com/ToxSam/open-source-avatars/main/data';
const COLLECTIONS_URL = `${OSA_BASE}/projects.json`;

function resolveAvatarFields(item) {
  const thumbnail =
    item.thumbnail_url || item.thumbnail || item.image_url || item.image ||
    item.preview_url || item.preview || item.pfp_url || item.pfp || '';
  const modelUrl =
    item.vrm_url || item.glb_url || item.model_url || item.model_file_url ||
    item.url || item.file_url || '';
  const name = item.name || item.id || 'Avatar';
  return { thumbnail, modelUrl, name };
}

export default function AvatarGallery({ onSelect, onClose, fullHeight = false }) {
  const { t } = useTranslation();
  const [avatars, setAvatars]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [collection, setCollection] = useState('');
  const [collections, setCollections] = useState([]);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Load collection list, then first collection's avatars
  useEffect(() => {
    setLoading(true);
    setError('');

    fetch(COLLECTIONS_URL)
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted.current) return;
        const list = Array.isArray(data) ? data : Object.values(data);
        const public_ = list.filter((c) => c.is_public !== false && c.avatar_data_file);
        setCollections(public_);
        if (public_.length > 0) {
          setCollection(public_[0].id || public_[0].name || '');
          return fetch(`${OSA_BASE}/${public_[0].avatar_data_file}`);
        }
        throw new Error('No public collections found');
      })
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted.current) return;
        const list = Array.isArray(data) ? data : (data.avatars || data.items || Object.values(data));
        const parsed = list.slice(0, 24).map(resolveAvatarFields).filter((a) => a.modelUrl);
        setAvatars(parsed);
      })
      .catch((err) => {
        if (isMounted.current) setError('Não foi possível carregar a galeria: ' + err.message);
      })
      .finally(() => { if (isMounted.current) setLoading(false); });
  }, []);

  const handleCollectionChange = (colId) => {
    const col = collections.find((c) => (c.id || c.name) === colId);
    if (!col?.avatar_data_file) return;
    setCollection(colId);
    setLoading(true);
    setAvatars([]);
    fetch(`${OSA_BASE}/${col.avatar_data_file}`)
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted.current) return;
        const list = Array.isArray(data) ? data : (data.avatars || data.items || Object.values(data));
        const parsed = list.slice(0, 24).map(resolveAvatarFields).filter((a) => a.modelUrl);
        setAvatars(parsed);
      })
      .catch((err) => { if (isMounted.current) setError(err.message); })
      .finally(() => { if (isMounted.current) setLoading(false); });
  };

  return (
    <div className={`flex flex-col gap-3 ${fullHeight ? 'h-full p-4 overflow-y-auto' : ''}`}>
      {/* Header — hidden in fullHeight mode */}
      {!fullHeight && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-200">{t('galleryTitle')}</p>
            <p className="text-[10px] text-gray-500">{t('gallerySubtitle')}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors"><Icon name="close" className="w-4 h-4" /></button>
        </div>
      )}

      {/* Collection selector */}
      {collections.length > 1 && (
        <select
          value={collection}
          onChange={(e) => handleCollectionChange(e.target.value)}
          className="w-full rounded-lg bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 focus:outline-none"
        >
          {collections.map((c) => (
            <option key={c.id || c.name} value={c.id || c.name}>
              {c.name || c.id}
            </option>
          ))}
        </select>
      )}

      {/* Grid */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        </div>
      )}

      {error && !loading && (
        <p className="text-xs text-red-400 text-center py-4">{error}</p>
      )}

      {!loading && !error && avatars.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-4">
          Nenhum avatar com URL de modelo encontrado nesta coleção.
        </p>
      )}

      {!loading && avatars.length > 0 && (
        <div className={`grid gap-2 pr-1 ${fullHeight ? 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6' : 'grid-cols-3 max-h-72 overflow-y-auto'}`}>
          {avatars.map((avatar, i) => (
            <button
              key={i}
              onClick={() => onSelect(avatar.modelUrl)}
              title={avatar.name}
              className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-cyan-400/60 transition-all bg-gray-800"
            >
              {avatar.thumbnail ? (
                <img
                  src={avatar.thumbnail}
                  alt={avatar.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500"><Icon name="avatar" className="w-8 h-8" /></div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[9px] text-white truncate">{avatar.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <a
        href="https://www.opensourceavatars.com"
        target="_blank"
        rel="noreferrer"
        className="text-center text-xs text-cyan-400 hover:text-cyan-300"
      >
        Ver mais avatares ↗
      </a>
    </div>
  );
}
