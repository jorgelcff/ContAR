import React, { useEffect, useRef, useState } from 'react';

export default function Tooltip({ text, children, position = 'top' }) {
  const posClass = position === 'bottom'
    ? 'top-full mt-2 bottom-auto'
    : 'bottom-full mb-2 top-auto';

  return (
    <div className="relative group inline-flex items-center">
      {children}
      <div
        className={`absolute left-1/2 -translate-x-1/2 ${posClass} w-max max-w-[220px] px-2.5 py-1.5
          bg-gray-950 border border-gray-700 text-xs text-gray-200 rounded-lg leading-snug text-center
          opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-xl`}
      >
        {text}
        <span
          className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
            position === 'bottom'
              ? 'bottom-full border-b-gray-950'
              : 'top-full border-t-gray-950'
          }`}
        />
      </div>
    </div>
  );
}

/**
 * Small `?` icon — shows tooltip on hover (desktop) and on click (mobile).
 * Closes when clicking outside.
 */
export function TooltipIcon({ text, position = 'top' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

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
          className={`absolute left-1/2 -translate-x-1/2 ${posClass} w-max max-w-55 px-2.5 py-1.5
            bg-gray-950 border border-cyan-800/60 text-xs text-gray-200 rounded-lg leading-snug text-center
            shadow-xl z-50`}
        >
          {text}
        </div>
      )}
    </div>
  );
}
