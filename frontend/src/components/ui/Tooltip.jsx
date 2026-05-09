import React from 'react';

/**
 * Tooltip — wraps any child and shows a text hint on hover (desktop).
 * Usage: <Tooltip text="Explica algo">…children…</Tooltip>
 */
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

/** Small circular `?` icon that shows a tooltip on hover. */
export function TooltipIcon({ text, position }) {
  return (
    <Tooltip text={text} position={position}>
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-600 hover:bg-gray-500 text-gray-300 text-[10px] font-bold cursor-help transition-colors ml-1 shrink-0">
        ?
      </span>
    </Tooltip>
  );
}
