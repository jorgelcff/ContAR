import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import Icon from './Icon';

/**
 * Shown while the server is not answering but the session is intact.
 *
 * A host that suspends itself takes the better part of a minute to come back,
 * and the first person through the door pays for it. Before this, that cold
 * start read as "signed out": the token was deleted and they landed on the
 * login screen, having lost whatever they were doing.
 */
export default function ReconnectingScreen() {
  const { t } = useTranslation();
  const { retryConnection } = useAuth();

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
