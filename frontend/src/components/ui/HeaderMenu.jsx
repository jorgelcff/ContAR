import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';

/**
 * The navigation, on a phone.
 *
 * Scenes, Stories, AR and Account were marked `hidden sm:inline-flex` and
 * nothing took their place below 640px — so on a phone, anywhere outside the
 * editor, there was no way to reach any of them. The header kept the language
 * picker and the logout button and quietly dropped the app.
 *
 * This is only mounted under that breakpoint; the desktop row is untouched.
 */
export default function HeaderMenu({ items }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!items.length) return null;

  return (
    <div ref={wrapperRef} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('headerMenu')}
        title={t('headerMenu')}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-gray-200 transition-colors hover:bg-gray-600"
      >
        <Icon name={open ? 'close' : 'list'} className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 flex w-44 flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-800 shadow-xl"
        >
          {items.map(({ to, label, icon, active }) => (
            <Link
              key={to}
              to={to}
              role="menuitem"
              // Closing on navigation matters: the panel covers the page it
              // just moved to otherwise.
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                active ? 'bg-cyan-700 text-white' : 'text-gray-200 hover:bg-gray-700'
              }`}
            >
              {icon && <Icon name={icon} className="h-4 w-4 shrink-0" />}
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
