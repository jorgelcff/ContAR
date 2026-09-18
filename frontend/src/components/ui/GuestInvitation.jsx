import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGuest } from '../../auth/useGuest';
import Icon from './Icon';

/**
 * Shown the first time a guest reaches for something that needs an account.
 *
 * Deliberately not a wall in front of the editor: by the time this appears the
 * person has already changed the words and heard the character say them, so
 * the ask is about keeping what they made rather than a toll before they have
 * seen anything.
 */
export default function GuestInvitation() {
  const { t } = useTranslation();
  const { invitation, dismiss } = useGuest();
  if (!invitation) return null;

  const reasonKey = invitation === 'publish'
    ? 'guestInviteReasonPublish'
    : invitation === 'voice'
      ? 'guestInviteReasonVoice'
      : invitation === 'upload'
        ? 'guestInviteReasonUpload'
        : 'guestInviteReasonSave';

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={dismiss}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 px-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-gray-700 bg-gray-800 p-6 text-center"
      >
        <div>
          <h2 className="text-lg font-bold text-white">{t('guestInviteTitle')}</h2>
          <p className="mt-2 text-sm text-gray-400">{t(reasonKey)}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            to="/login?create=1"
            className="w-full rounded-xl bg-cyan-700 py-3 text-sm font-semibold text-white transition-colors hover:bg-cyan-600"
          >
            {t('guestInviteCreate')}
          </Link>
          <button
            onClick={dismiss}
            className="w-full rounded-xl border border-gray-600 py-3 text-sm text-gray-300 transition-colors hover:bg-gray-700"
          >
            {t('guestInviteKeepPlaying')}
          </button>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
          <Icon name="info" className="h-3.5 w-3.5 shrink-0" />
          {t('guestInviteNothingLost')}
        </p>
      </div>
    </div>
  );
}
