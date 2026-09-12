import React, { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import { useTranslation } from 'react-i18next';

// VALID: Virtual Avatar Library for Inclusion and Diversity — University of
// Central Florida + Google Research. 210 fully rigged avatars covering the 7
// U.S. Census Bureau ethnicities, perceptually validated across 33 countries.
// MIT-licensed; this community fork hosts the original FBX set converted to
// GLB, served over CDN with CORS enabled — loads straight into GLTFLoader.
const VALID_BASE = 'https://cdn.jsdelivr.net/gh/c-frame/valid-avatars-glb';
const VALID_MANIFEST_URL = `${VALID_BASE}/avatars.json`;
const VALID_REPO_URL = 'https://github.com/google/valid-avatar-library';

const ETHNICITY_LABELS = {
  AIAN: 'American Indian / Alaskan Native',
  Asian: 'Asian',
  Black: 'Black',
  Hispanic: 'Hispanic',
  MENA: 'Middle Eastern / North African',
  NHPI: 'Native Hawaiian / Pacific Islander',
  White: 'White',
};

function resolveValidFields(item) {
  const thumbnail = item.image ? `${VALID_BASE}/${item.image}` : '';
  const modelUrl = item.model ? `${VALID_BASE}/${item.model}` : '';
  return { thumbnail, modelUrl, name: item.text || 'Avatar', ethnicity: item.ethnicity || '', gender: item.gender || '' };
}

export default function ValidAvatarGallery({ onSelect, onClose, fullHeight = false }) {
  const { t } = useTranslation();
  const [allAvatars, setAllAvatars] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [ethnicity, setEthnicity]   = useState('');
  const [gender, setGender]         = useState('');

  useEffect(() => {
    let active = true;
    fetch(VALID_MANIFEST_URL)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : Object.values(data || {});
        setAllAvatars(list.map(resolveValidFields).filter((a) => a.modelUrl));
      })
      .catch((err) => { if (active) setError('Não foi possível carregar a galeria VALID: ' + err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const ethnicities = useMemo(
    () => [...new Set(allAvatars.map((a) => a.ethnicity).filter(Boolean))],
    [allAvatars],
  );

  const filtered = useMemo(() => {
    return allAvatars
      .filter((a) => !ethnicity || a.ethnicity === ethnicity)
      .filter((a) => !gender || a.gender === gender)
      .slice(0, 48);
  }, [allAvatars, ethnicity, gender]);

  return (
    <div className={`flex flex-col gap-3 ${fullHeight ? 'h-full p-4 overflow-y-auto' : ''}`}>
      {!fullHeight && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-200">{t('validGalleryTitle')}</p>
            <p className="text-[10px] text-gray-500">{t('validGallerySubtitle')}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors"><Icon name="close" className="w-4 h-4" /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <select
          value={ethnicity}
          onChange={(e) => setEthnicity(e.target.value)}
          className="flex-1 rounded-lg bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 focus:outline-none focus:border-cyan-500"
        >
          <option value="">{t('validFilterAllEthnicities')}</option>
          {ethnicities.map((eth) => (
            <option key={eth} value={eth}>{ETHNICITY_LABELS[eth] || eth}</option>
          ))}
        </select>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className="w-28 rounded-lg bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 focus:outline-none focus:border-cyan-500"
        >
          <option value="">{t('validFilterAllGenders')}</option>
          <option value="M">{t('validFilterMale')}</option>
          <option value="F">{t('validFilterFemale')}</option>
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        </div>
      )}

      {error && !loading && (
        <p className="text-xs text-red-400 text-center py-4">{error}</p>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-4">{t('validNoResults')}</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className={`grid gap-2 pr-1 ${fullHeight ? 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6' : 'grid-cols-3 max-h-72 overflow-y-auto'}`}>
          {filtered.map((avatar, i) => (
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
                  loading="lazy"
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
        href={VALID_REPO_URL}
        target="_blank"
        rel="noreferrer"
        className="text-center text-xs text-cyan-400 hover:text-cyan-300"
      >
        {t('validCredit')} ↗
      </a>
    </div>
  );
}
