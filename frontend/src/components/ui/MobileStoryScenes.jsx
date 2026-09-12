import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { useSceneStore } from '../../store/useSceneStore';

const DEFAULT_TITLES = new Set(['untitled scene', 'untitled', 'sem título', 'sem titulo']);

function resolveSceneTitle(sceneTitlesById, sceneId) {
  const raw = String(sceneTitlesById?.[sceneId] || '').trim();
  if (!raw || DEFAULT_TITLES.has(raw.toLowerCase())) {
    return sceneId.slice(0, 8);
  }
  return raw;
}

// Touch-friendly counterpart to StoryBuilderPanel (which is desktop-only —
// its reordering is drag-based, mouse-only). Reordering here is done with
// up/down buttons instead of drag, which also works with a single tap.
export default function MobileStoryScenes() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    storyScenes,
    sceneTitlesById,
    currentStoryId,
    currentSceneId,
    removeStoryScene,
    reorderStoryScenes,
  } = useSceneStore();
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(null);

  if (!storyScenes.length) return null;

  const handleEditScene = (sceneId) => {
    const params = new URLSearchParams({ sceneId });
    if (currentStoryId) params.set('storyId', currentStoryId);
    navigate(`/editor?${params.toString()}`);
  };

  return (
    <div data-testid="mobile-story-scenes" className="md:hidden flex flex-col gap-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('storyScenesTitle')}</p>
      <div className="flex flex-col gap-2">
        {storyScenes.map((item, index) => {
          const isPendingDelete = confirmDeleteIndex === index;
          const isActive = item.sceneId === currentSceneId;
          return (
            <div
              key={`${item.sceneId}-${index}`}
              className={`rounded-xl border p-2.5 flex flex-col gap-2 transition-colors ${
                isPendingDelete
                  ? 'border-red-600 bg-red-950/40'
                  : isActive
                    ? 'border-cyan-500 bg-cyan-950/30 ring-1 ring-cyan-500/30'
                    : 'border-gray-700 bg-gray-900/50'
              }`}
            >
              <div className="text-xs text-gray-200 font-medium truncate flex items-center gap-1.5">
                <span>#{index + 1} {resolveSceneTitle(sceneTitlesById, item.sceneId)}</span>
                {isActive && (
                  <span className="shrink-0 rounded bg-cyan-600/80 px-1.5 py-0.5 text-[10px] font-semibold text-white uppercase">
                    {t('storySceneEditing')}
                  </span>
                )}
              </div>

              {isPendingDelete ? (
                <div className="flex flex-col gap-2 py-1">
                  <p className="text-xs text-red-300 text-center">{t('removeSceneConfirm')}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { removeStoryScene(index); setConfirmDeleteIndex(null); }}
                      className="flex-1 py-1.5 rounded bg-red-600 hover:bg-red-500 text-xs text-white font-medium"
                    >
                      {t('removeBtn')}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteIndex(null)}
                      className="flex-1 py-1.5 rounded bg-gray-600 hover:bg-gray-500 text-xs text-white"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => reorderStoryScenes(index, index - 1)}
                    disabled={index === 0}
                    title={t('moveSceneUp')}
                    className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:pointer-events-none text-gray-200"
                  >
                    <Icon name="chevron-up" className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => reorderStoryScenes(index, index + 1)}
                    disabled={index === storyScenes.length - 1}
                    title={t('moveSceneDown')}
                    className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:pointer-events-none text-gray-200"
                  >
                    <Icon name="chevron-down" className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleEditScene(item.sceneId)}
                    title={t('editSceneTitle')}
                    className="ml-auto px-3 py-1.5 rounded bg-cyan-700 hover:bg-cyan-600 text-xs text-white flex items-center gap-1"
                  >
                    <Icon name="edit" className="w-3.5 h-3.5" /> {t('editSceneTitle')}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteIndex(index)}
                    title={t('removeFromStoryTitle')}
                    className="px-2 py-1.5 rounded bg-red-900 hover:bg-red-700 text-xs text-white"
                  >
                    <Icon name="close" className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
