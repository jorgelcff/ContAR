import React from 'react';

const ICONS = {
  avatar: <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 7a7 7 0 0 1 14 0" />,
  speech: (
    <>
      <path d="M6 7h12" />
      <path d="M6 11h8" />
      <path d="M6 15h6" />
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4l-4 4v-4H6a2 2 0 0 1-2-2Z" />
    </>
  ),
  scene: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M7 6 5 3m5 3L8 3m5 3-2-3m5 3-2-3m5 3-2-3" />
    </>
  ),
  story: (
    <>
      <path d="M5 4a2 2 0 0 1 2-2h12v18H7a2 2 0 0 0-2 2z" />
      <path d="M5 4a2 2 0 0 0-2 2v16h16" />
    </>
  ),
  audio: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18 6a8 8 0 0 1 0 12" />
    </>
  ),
  save: (
    <>
      <path d="M4 4h13l3 3v13H4z" />
      <path d="M8 4v6h8V4M8 20v-6h8v6" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 10v6m4-6v6" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 9v5m0 3h.01" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  theater: (
    <>
      <path d="M4 5h16v14H4z" />
      <path d="M4 9h16M8 5v4m8-4v4m-8 6h.01m4 0h.01m4 0h.01" />
    </>
  ),
  palette: <path d="M12 3a9 9 0 1 0 0 18h1a3 3 0 0 0 0-6h-1a2 2 0 0 1 0-4h2a4 4 0 0 0 0-8z" />,
  folder: (
    <>
      <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m10 8 6 4-6 4z" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3v4m0 10v4M3 12h4m10 0h4" />
      <path d="m6.5 6.5 2 2m7 7 2 2M17.5 6.5l-2 2m-7 7-2 2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />,
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8m-4-4v4" />
    </>
  ),
  graduation: (
    <>
      <path d="m2 9 10-5 10 5-10 5z" />
      <path d="M6 11v4c0 1.5 2.7 3 6 3s6-1.5 6-3v-4" />
    </>
  ),
  rocket: (
    <>
      <path d="M5 19c1-3 3-5 6-6 1-3 3-5 6-6-1 3-3 5-6 6-1 3-3 5-6 6z" />
      <circle cx="14" cy="10" r="1.5" />
    </>
  ),
};

export default function Icon({ name, className = 'w-5 h-5', strokeWidth = 1.8, title }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {ICONS[name] || ICONS.scene}
    </svg>
  );
}
