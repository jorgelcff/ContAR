import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function usePortalPosition(anchorRef, visible, position = 'top') {
  const [style, setStyle] = useState({ top: 0, left: 0, opacity: 0 });

  const recalc = useCallback(() => {
    const el = anchorRef.current;
    if (!el || !visible) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let top, left;
    left = rect.left + rect.width / 2;
    if (position === 'bottom') {
      top = rect.bottom + 8;
    } else {
      top = rect.top - 8;
    }
    setStyle({
      position: 'fixed',
      top,
      left,
      transform: position === 'bottom' ? 'translateX(-50%)' : 'translate(-50%, -100%)',
      opacity: 1,
    });
  }, [anchorRef, visible, position]);

  useEffect(() => {
    if (!visible) { setStyle(s => ({ ...s, opacity: 0 })); return; }
    requestAnimationFrame(recalc);
  }, [visible, recalc]);

  return style;
}

export default function Tooltip({ text, children, position = 'top' }) {
  const anchorRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const portalStyle = usePortalPosition(anchorRef, hovered, position);

  return (
    <div
      ref={anchorRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      {createPortal(
        <div
          style={portalStyle}
          className={`w-max max-w-55 px-2.5 py-1.5
            bg-gray-950 border border-gray-700 text-xs text-gray-200 rounded-lg leading-snug text-center
            pointer-events-none transition-opacity duration-150 z-[9999] shadow-xl ${hovered ? 'opacity-100' : 'opacity-0'}`}
        >
          {text}
        </div>,
        document.body,
      )}
    </div>
  );
}

export function TooltipIcon({ text, position = 'top' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const anchorRef = useRef(null);
  const portalStyle = usePortalPosition(anchorRef, open, position);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center ml-1 shrink-0">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-4 h-4 rounded-full bg-gray-600 hover:bg-gray-500 text-gray-300 text-[10px] font-bold cursor-help transition-colors flex items-center justify-center"
        aria-label="Ajuda"
      >
        ?
      </button>
      {open && createPortal(
        <div
          style={portalStyle}
          className={`w-max max-w-55 px-2.5 py-1.5
            bg-gray-950 border border-cyan-800/60 text-xs text-gray-200 rounded-lg leading-snug text-center
            shadow-xl z-[9999]`}
        >
          {text}
        </div>,
        document.body,
      )}
    </div>
  );
}
