import React, { useCallback, useEffect, useRef, useState } from 'react';

function useClampedPosition(tooltipRef, visible) {
  const [style, setStyle] = useState({ left: '50%', transform: 'translateX(-50%)' });

  const recalc = useCallback(() => {
    const el = tooltipRef.current;
    if (!el || !visible) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    if (rect.left < pad) {
      setStyle({ left: 0, transform: `translateX(${pad - rect.left}px)` });
    } else if (rect.right > window.innerWidth - pad) {
      setStyle({ left: 0, transform: `translateX(${window.innerWidth - pad - rect.right}px)` });
    } else {
      setStyle({ left: '50%', transform: 'translateX(-50%)' });
    }
  }, [tooltipRef, visible]);

  useEffect(() => {
    if (!visible) {
      setStyle({ left: '50%', transform: 'translateX(-50%)' });
      return;
    }
    requestAnimationFrame(recalc);
  }, [visible, recalc]);

  return style;
}

export default function Tooltip({ text, children, position = 'top' }) {
  const tooltipRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const posClass = position === 'bottom'
    ? 'top-full mt-2 bottom-auto'
    : 'bottom-full mb-2 top-auto';
  const clamped = useClampedPosition(tooltipRef, hovered);

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      <div
        ref={tooltipRef}
        style={clamped}
        className={`absolute ${posClass} w-max max-w-55 px-2.5 py-1.5
          bg-gray-950 border border-gray-700 text-xs text-gray-200 rounded-lg leading-snug text-center
          pointer-events-none transition-opacity duration-150 z-50 shadow-xl ${hovered ? 'opacity-100' : 'opacity-0'}`}
      >
        {text}
      </div>
    </div>
  );
}

export function TooltipIcon({ text, position = 'top' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const tooltipRef = useRef(null);
  const clamped = useClampedPosition(tooltipRef, open);

  const posClass = position === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2';

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center ml-1 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-4 h-4 rounded-full bg-gray-600 hover:bg-gray-500 text-gray-300 text-[10px] font-bold cursor-help transition-colors flex items-center justify-center"
        aria-label="Ajuda"
      >
        ?
      </button>
      {open && (
        <div
          ref={tooltipRef}
          style={clamped}
          className={`absolute ${posClass} w-max max-w-55 px-2.5 py-1.5
            bg-gray-950 border border-cyan-800/60 text-xs text-gray-200 rounded-lg leading-snug text-center
            shadow-xl z-50`}
        >
          {text}
        </div>
      )}
    </div>
  );
}
