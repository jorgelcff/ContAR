import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { pingHealth } from '../../api/sceneApi';
import Icon from './Icon';

/**
 * Shown while the server is not answering but the session is intact.
 *
 * A host that suspends itself takes the better part of a minute to come back,
 * and the first person through the door pays for it. Before this, that cold
 * start read as "signed out": the token was deleted and they landed on the
 * login screen, having lost whatever they were doing.
 */
// Slow enough not to hammer, quick enough that nobody sits here wondering.
const POLL_MS = 10_000;

export default function ReconnectingScreen() {
  const { t } = useTranslation();
  const { retryConnection } = useAuth();

  // The point of this screen is not only to explain the wait — it is the
  // thing doing the waking. A suspended host comes back *because* requests
  // arrive, and the session check gives up after about fifty seconds, which a
  // cold start can outlast. So this keeps knocking.
  //
  // It knocks on /api/health rather than the session: no auth, no database,
  // outside every rate limiter, and during a cold start the database
  // connection may still be coming up while the process is already answering.
  // Once it replies, the real check runs once.
  useEffect(() => {
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        await pingHealth();
        if (!cancelled) retryConnection();
      } catch {
        // Still asleep. The request itself was the useful part.
      }
    }, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [retryConnection]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-gray-950 px-6 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
      <div>
        <h1 className="text-base font-semibold text-white">{t('reconnectingTitle')}</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-400">{t('reconnectingBody')}</p>
      </div>
      <button
        onClick={retryConnection}
        className="flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-600"
      >
        <Icon name="refresh" className="h-4 w-4" />
        {t('reconnectingRetry')}
      </button>
      {/* Said plainly, because the reassuring part is that nothing was lost. */}
      <p className="text-xs text-gray-500">{t('reconnectingStillSignedIn')}</p>
    </div>
  );
}
