import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSceneStore } from '../../store/useSceneStore';

export default function StoryBuilderPanel() {
  const { t } = useTranslation();
  const { 
    storyScenes, 
    sceneTitlesById,
    updateStoryScene,
    removeStoryScene,
    reorderStoryScenes
  } = useSceneStore();
  const dragIndexRef = useRef(-1);

  return (
    <section className="shrink-0 border-t border-gray-700 bg-gray-900/80 p-4">
      <div className="rounded-xl border border-gray-700 bg-gray-800/70 p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Scenes in Story</p>

        {storyScenes.length === 0 && (
          <p className="text-xs text-gray-500">{t('noStoryScenes')}</p>
        )}

        <div className="flex gap-3 overflow-x-auto pb-1">
          {storyScenes.map((item, index) => (
            <div
              key={`${item.sceneId}-${index}`}
              className="w-72 min-w-72 rounded-lg border border-gray-700 bg-gray-900/50 p-2 flex flex-col gap-2"
              draggable
              onDragStart={() => {
                dragIndexRef.current = index;
              }}
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
              <div className="text-xs text-gray-200 break-words font-medium">
                #{index + 1} {sceneTitlesById?.[item.sceneId] || item.sceneId}
              </div>
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
                  className="w-24 rounded bg-gray-700 border border-gray-600 text-white text-xs px-2 py-1 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => removeStoryScene(index)}
                  className="ml-auto px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-xs text-white"
                >
                  X
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
