import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSceneStore } from '../../store/useSceneStore';

export default function TimelinePanel() {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  
  const { 
    timelineBlocks, 
    timelineDuration, 
    addTimelineBlock, 
    updateTimelineBlock, 
    removeTimelineBlock,
    setTimelineDuration
  } = useSceneStore();

  const [collapsed, setCollapsed] = useState(false);
  const [draggingBlock, setDraggingBlock] = useState(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [initialStartSec, setInitialStartSec] = useState(0);

  // Separate blocks by tracks
  const actionBlocks = timelineBlocks.filter(b => b.type === 'action');
  const audioBlocks = timelineBlocks.filter(b => b.type === 'audio');

  const handleMouseDown = (e, block) => {
    e.stopPropagation();
    setDraggingBlock(block);
    setDragStartX(e.clientX);
    setInitialStartSec(block.startSec);
  };

  const handleMouseMove = (e) => {
    if (!draggingBlock || !containerRef.current) return;
    
    // Calculate visual delta map to seconds
    const dx = e.clientX - dragStartX;
    const containerWidth = containerRef.current.getBoundingClientRect().width;
    const secPerPixel = timelineDuration / containerWidth;
    
    let newStartSec = initialStartSec + (dx * secPerPixel);
    
    // Boundary checks & Snapping to 0
    if (newStartSec < 0) newStartSec = 0;
    
    const blockDuration = draggingBlock.endSec - draggingBlock.startSec;
    if (newStartSec + blockDuration > timelineDuration) {
      newStartSec = timelineDuration - blockDuration;
    }

    // Snapping logic: simple snap to closest action block start if it's an audio block
    if (draggingBlock.type === 'audio') {
      const snapThreshold = 0.25; // 0.25s
      for (const actionB of actionBlocks) {
        if (Math.abs(actionB.startSec - newStartSec) < snapThreshold) {
          newStartSec = actionB.startSec;
          break;
        }
      }
    }

    updateTimelineBlock(draggingBlock.id, { 
      startSec: newStartSec, 
      endSec: newStartSec + blockDuration 
    });
  };

  const handleMouseUp = () => {
    setDraggingBlock(null);
  };

  const toPercentage = (sec) => `${(sec / timelineDuration) * 100}%`;

  const addDummyBlock = (type) => {
    addTimelineBlock({
      type,
      startSec: 0,
      endSec: 2,
      ref: type === 'action' ? 'wave' : 'audio_1.mp3'
    });
  };

  return (
    <section className="shrink-0 border-t border-gray-700 bg-gray-900 flex flex-col"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="flex px-4 justify-between items-center bg-gray-800 py-1">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-widest hover:text-white transition-colors"
        >
          <span>{collapsed ? '▶' : '▼'}</span>
          📺 Timeline
          {!collapsed && <span className="text-[10px] text-gray-500 font-normal border border-gray-600 rounded px-1">{timelineDuration}s</span>}
        </button>
        <div className="flex gap-2">
          <button onClick={() => addDummyBlock('action')} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] px-2 py-1 rounded">
            + Action Track
          </button>
          <button onClick={() => addDummyBlock('audio')} className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] px-2 py-1 rounded">
            + Audio Track
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">Total Dur.</span>
            <input 
              type="number" min={5} max={180} 
              value={timelineDuration} 
              onChange={e => setTimelineDuration(Number(e.target.value))}
              className="bg-gray-700 text-white text-[10px] px-1 py-1 w-12 border border-gray-600"
            />
          </div>
        </div>
      </div>

      {!collapsed && <div className="flex-1 relative overflow-x-hidden select-none py-2" ref={containerRef}>
        {/* Helper grid & markers */}
        <div className="absolute top-0 bottom-0 left-4 right-4 border-l border-r border-gray-700 pointer-events-none">
          <div className="w-full h-full flex justify-between absolute">
            {[...Array(11)].map((_, i) => (
              <div key={i} className="h-full w-px bg-gray-800 relative">
                {i % 2 === 0 && <span className="absolute -top-4 -left-2 text-[10px] text-gray-500">{((i / 10) * timelineDuration).toFixed(0)}s</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="pl-4 pr-4 flex flex-col gap-2 relative z-10 py-4">
          
          {/* Action Track */}
          <div className="h-8 bg-gray-800/50 rounded relative border border-gray-700 flex items-center group">
            <div className="absolute left-1 text-[10px] uppercase text-gray-500 font-medium z-0">
              Actions
            </div>
            {actionBlocks.map(b => (
              <div 
                key={b.id}
                onMouseDown={(e) => handleMouseDown(e, b)}
                className={`absolute top-1 bottom-1 bg-indigo-500 text-white text-[10px] flex items-center justify-center rounded cursor-grab active:cursor-grabbing border border-indigo-400 shadow-md hover:brightness-110 ${draggingBlock?.id === b.id ? 'opacity-80 z-20' : 'z-10'}`}
                style={{ 
                  left: toPercentage(b.startSec), 
                  width: toPercentage(b.endSec - b.startSec)
                }}
              >
                {b.ref}
                <button 
                  onMouseDown={(e) => { e.stopPropagation(); removeTimelineBlock(b.id); }}
                  className="absolute -top-2 -right-2 bg-red-600 rounded-full w-4 h-4 text-white z-30 opacity-0 group-hover:opacity-100 items-center justify-center flex hover:scale-110"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          {/* Audio Track */}
          <div className="h-8 bg-gray-800/50 rounded relative border border-gray-700 flex items-center group">
            <div className="absolute left-1 text-[10px] uppercase text-gray-500 font-medium z-0">
              Audio
            </div>
            {audioBlocks.map(b => (
              <div 
                key={b.id}
                onMouseDown={(e) => handleMouseDown(e, b)}
                className={`absolute top-1 bottom-1 bg-emerald-500 text-slate-900 font-semibold text-[10px] flex gap-1 items-center justify-center rounded cursor-grab active:cursor-grabbing border border-emerald-400 shadow-md ${draggingBlock?.id === b.id ? 'opacity-80 z-20' : 'z-10'}`}
                style={{ 
                  left: toPercentage(b.startSec), 
                  width: toPercentage(b.endSec - b.startSec)
                }}
              >
                🎙️ {b.ref}
                <button 
                  onMouseDown={(e) => { e.stopPropagation(); removeTimelineBlock(b.id); }}
                  className="absolute -top-2 -right-2 bg-red-600 rounded-full w-4 h-4 text-white z-30 opacity-0 group-hover:opacity-100 items-center justify-center flex hover:scale-110"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

        </div>
      </div>}
    </section>
  );
}
