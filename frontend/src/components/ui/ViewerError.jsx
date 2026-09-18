import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { NOT_FOUND, OFFLINE, SERVER } from '../../utils/viewerError';
import Icon from './Icon';

/**
 * What a visitor gets when a story will not load.
 *
 * Someone reaches this by scanning a code off a poster, so the worst thing to
 * do is leave them holding a red sentence in a language they may not read.
 * Every case gets a way forward — and the way forward that matters most is the
 * demo, because they came here to see something and can still see it.
 */
export default function ViewerError({ kind = NOT_FOUND, onRetry }) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  const copy = {
    [NOT_FOUND]: { icon: 'info', title: t('viewerGoneTitle'), body: t('viewerGoneBody') },
    [OFFLINE]: { icon: 'warning', title: t('viewerOfflineTitle'), body: t('viewerOfflineBody') },
    [SERVER]: { icon: 'warning', title: t('viewerServerTitle'), body: t('viewerServerBody') },
  }[kind] || { icon: 'info', title: t('viewerGoneTitle'), body: t('viewerGoneBody') };

  const retryable = kind !== NOT_FOUND;

  return (
    <div className="flex flex-1 items-center justify-center bg-gray-900 px-6 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <Icon name={copy.icon} className={`h-8 w-8 ${kind === NOT_FOUND ? 'text-cyan-400' : 'text-amber-400'}`} />

        <div>
          <h1 className="text-lg font-bold text-white">{copy.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">{copy.body}</p>
        </div>

        <div className="flex w-full flex-col gap-2">
          {retryable && onRetry && (
            <button
              onClick={onRetry}
              className="w-full rounded-xl bg-cyan-700 py-3 text-sm font-semibold text-white transition-colors hover:bg-cyan-600"
            >
              {t('viewerTryAgain')}
            </button>
          )}

          {/* The point of this screen. They came to see a 3D narrator; the
              link failed, but the thing itself is one tap away. */}
          <Link
            to="/experimentar"
            className={`w-full rounded-xl py-3 text-sm font-semibold transition-colors ${
              retryable
                ? 'border border-gray-600 text-gray-200 hover:bg-gray-800'
                : 'bg-cyan-700 text-white hover:bg-cyan-600'
            }`}
          >
            {t('viewerTryTheDemo')}
          </Link>

          <Link
            to="/"
            className="w-full rounded-xl border border-gray-600 py-3 text-sm text-gray-300 transition-colors hover:bg-gray-800"
          >
            {t('viewerWhatIsThis')}
          </Link>
        </div>

        {/* Only for someone signed in: an unpublished story is the likeliest
            reason an author lands here, and it is a different fix entirely. */}
        {isAuthenticated && kind === NOT_FOUND && (
          <p className="border-t border-gray-800 pt-4 text-xs text-gray-500">
            {t('viewerMaybeUnpublished')}{' '}
            <Link to="/stories" className="font-medium text-cyan-300 underline-offset-4 hover:underline">
              {t('viewerOpenMyStories')}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
