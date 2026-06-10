import React, { useRef, useState } from 'react';
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

export default function StoryBuilderPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    storyScenes,
    sceneTitlesById,
    currentStoryId,
    updateStoryScene,
    removeStoryScene,
    reorderStoryScenes
  } = useSceneStore();
  const dragIndexRef = useRef(-1);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(null);

  const handleEditScene = (sceneId) => {
    const params = new URLSearchParams({ sceneId });
    if (currentStoryId) params.set('storyId', currentStoryId);
    navigate(`/editor?${params.toString()}`);
  };

  const handleDeleteClick = (index) => setConfirmDeleteIndex(index);
  const handleDeleteConfirm = () => {
    if (confirmDeleteIndex !== null) removeStoryScene(confirmDeleteIndex);
    setConfirmDeleteIndex(null);
  };
  const handleDeleteCancel = () => setConfirmDeleteIndex(null);

  return (
    <section className="shrink-0 border-t border-gray-700 bg-gray-900/80 p-4">
      <div className="rounded-xl border border-gray-700 bg-gray-800/70 p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Scenes in Story</p>

        {storyScenes.length === 0 && (
          <p className="text-xs text-gray-500">{t('noStoryScenes')}</p>
        )}

        <div className="flex gap-3 overflow-x-auto pb-1">
          {storyScenes.map((item, index) => {
            const isPendingDelete = confirmDeleteIndex === index;
            return (
              <div
                key={`${item.sceneId}-${index}`}
                className={`w-72 min-w-72 rounded-lg border p-2 flex flex-col gap-2 transition-colors ${
                  isPendingDelete
                    ? 'border-red-600 bg-red-950/40'
                    : 'border-gray-700 bg-gray-900/50'
                }`}
                draggable={!isPendingDelete}
                onDragStart={() => { dragIndexRef.current = index; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragIndexRef.current;
                  const to = index;
                  if (from < 0 || from === to) return;
                  reorderStoryScenes(from, to);
                  dragIndexRef.current = -1;
                }}
              >
                <div className="text-xs text-gray-200 font-medium truncate">
                  #{index + 1} {resolveSceneTitle(sceneTitlesById, item.sceneId)}
                </div>

                {isPendingDelete ? (
                  <div className="flex flex-col gap-2 py-1">
                    <p className="text-xs text-red-300 text-center">Remover esta cena da história?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteConfirm}
                        className="flex-1 py-1.5 rounded bg-red-600 hover:bg-red-500 text-xs text-white font-medium"
                      >
                        Remover
                      </button>
                      <button
                        onClick={handleDeleteCancel}
                        className="flex-1 py-1.5 rounded bg-gray-600 hover:bg-gray-500 text-xs text-white"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={item.transitionText}
                      onChange={(e) => updateStoryScene(index, 'transitionText', e.target.value)}
                      placeholder={t('transitionText')}
                      className="w-full rounded bg-gray-700 border border-gray-600 text-white text-xs px-2 py-1 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min={0}
                        value={item.durationSeconds}
                        onChange={(e) => updateStoryScene(index, 'durationSeconds', e.target.value)}
                        placeholder={t('durationSeconds')}
                        className="w-20 rounded bg-gray-700 border border-gray-600 text-white text-xs px-2 py-1 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => handleEditScene(item.sceneId)}
                        className="ml-auto px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-xs text-white"
                        title="Editar esta cena"
                      >
                        <Icon name="edit" className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(index)}
                        className="px-2 py-1 rounded bg-red-900 hover:bg-red-700 text-xs text-white"
                        title="Remover da história"
                      >
                        <Icon name="close" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
