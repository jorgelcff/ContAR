import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import Icon from './Icon';

/**
 * Nudges an unverified account to confirm its address.
 *
 * Registration issues a session immediately and nothing in the app has ever
 * consulted emailVerified, so confirming did nothing visible and most accounts
 * simply never did it. This makes the state visible and gives the one action
 * that resolves it.
 *
 * Deliberately a nudge rather than a wall: someone trying the app at a
 * conference stand cannot be left staring at "check your email" while the
 * message sits in a spam folder. What verification gates is publishing — see
 * where this banner is used.
 */
export default function VerifyEmailBanner() {
  const { t } = useTranslation();
  const { isAuthenticated, emailVerified, resendVerificationEmail } = useAuth();
  const [state, setState] = useState('idle'); // idle | sending | sent | error

  if (!isAuthenticated || emailVerified) return null;

  const resend = async () => {
    if (state === 'sending') return;
    setState('sending');
    try {
      await resendVerificationEmail();
      setState('sent');
    } catch {
      setState('error');
    }
  };

  return (
    <div
      data-testid="verify-email-banner"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-950/40 border-b border-amber-700/40 px-4 py-2 text-xs text-amber-100"
    >
      <span className="flex items-center gap-1.5">
        <Icon name="info" className="w-3.5 h-3.5 shrink-0" />
        {t('verifyBannerText')}
      </span>
      {state === 'sent' ? (
        <span className="text-emerald-300">{t('verifyBannerSent')}</span>
      ) : (
        <button
          onClick={resend}
          disabled={state === 'sending'}
          className="rounded-md bg-amber-700 hover:bg-amber-600 disabled:opacity-60 px-2.5 py-1 font-medium text-white transition-colors"
        >
          {state === 'sending' ? t('verifyBannerSending') : t('verifyBannerResend')}
        </button>
      )}
      {state === 'error' && <span className="text-red-300">{t('verifyBannerError')}</span>}
    </div>
  );
}
