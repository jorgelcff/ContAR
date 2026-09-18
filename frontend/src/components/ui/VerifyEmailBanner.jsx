import React, { useEffect, useState } from 'react';
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
const RESEND_COOLDOWN_SECONDS = 60;

// Dismissing hides the banner for this visit, not forever. Confirming is what
// unlocks publishing, so an account that never confirms should meet the nudge
// again next time — but being unable to get rid of it while working is its own
// kind of rude. sessionStorage is exactly that boundary.
const DISMISSED_KEY = 'contar:verify-banner-dismissed';

export default function VerifyEmailBanner() {
  const { t } = useTranslation();
  const { isAuthenticated, emailVerified, resendVerificationEmail } = useAuth();
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  // Seconds before another attempt is offered. The server caps resends per
  // account, but nothing here stopped someone from hammering the button the
  // moment a send failed — and each attempt holds a request open while the
  // mail server is contacted. The countdown makes the wait visible instead of
  // handing out errors, and still lets a real retry through once it expires.
  const [cooldown, setCooldown] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  if (!isAuthenticated || emailVerified || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch { /* ignore */ }
  };

  const resend = async () => {
    if (state === 'sending' || cooldown > 0) return;
    setState('sending');
    try {
      await resendVerificationEmail();
      setState('sent');
    } catch {
      setState('error');
    } finally {
      // Whether it landed or not — a failure is the case that invites retrying.
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  };

  const waiting = cooldown > 0;

  return (
    <div
      data-testid="verify-email-banner"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-950/40 border-b border-amber-700/40 px-4 py-2 text-xs text-amber-100"
    >
      <span className="flex items-center gap-1.5">
        <Icon name="info" className="w-3.5 h-3.5 shrink-0" />
        {t('verifyBannerText')}
      </span>
      {state === 'sent' && <span className="text-emerald-300">{t('verifyBannerSent')}</span>}
      {state === 'error' && <span className="text-red-300">{t('verifyBannerError')}</span>}
      {/* Kept on screen even after a successful send: the message can land in
          spam, and the only way back used to be reloading the page. */}
      <button
        onClick={resend}
        disabled={state === 'sending' || waiting}
        className="rounded-md bg-amber-700 hover:bg-amber-600 disabled:opacity-60 disabled:hover:bg-amber-700 px-2.5 py-1 font-medium text-white transition-colors"
      >
        {state === 'sending'
          ? t('verifyBannerSending')
          : waiting
            ? t('verifyBannerCooldown', { seconds: cooldown })
            : t('verifyBannerResend')}
      </button>

      <button
        onClick={dismiss}
        aria-label={t('verifyBannerDismiss')}
        title={t('verifyBannerDismiss')}
        className="ml-1 rounded p-1 text-amber-200/70 transition-colors hover:bg-amber-900/40 hover:text-amber-100"
      >
        <Icon name="close" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
