import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteAccount } from '../../api/sceneApi';
import Icon from './Icon';

/**
 * Removing an account, from inside the app.
 *
 * There was no way to do this at all: erasing someone meant an administrator
 * running a script against the database. Under the LGPD that is not optional,
 * and for an app that asks strangers at an event for an email it is the least
 * it can offer back.
 *
 * Two gates rather than one. The confirmation is not a formality — it names
 * what goes — and the password is required because a session is enough to
 * change things, not to erase someone. A borrowed browser is exactly the case.
 */
export default function DeleteAccountSection() {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      await deleteAccount(password);
      // The account is gone; a full reload drops every trace of the session
      // from memory rather than leaving the app rendering a dead user.
      window.location.href = '/';
    } catch (err) {
      setError(
        err?.response?.status === 401
          ? t('accountDangerWrongPassword')
          : err?.response?.data?.error || t('accountDangerWrongPassword'),
      );
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-red-900/60 bg-red-950/20 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-red-300">
        {t('accountDangerTitle')}
      </h2>
      <p className="text-xs leading-relaxed text-gray-400">{t('accountDangerBody')}</p>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="self-start rounded-lg border border-red-700/70 px-3 py-2 text-xs font-medium text-red-300 transition-colors hover:bg-red-900/40"
        >
          {t('accountDangerButton')}
        </button>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2.5">
            <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <p className="text-xs font-semibold text-red-200">{t('accountDangerConfirmTitle')}</p>
              <p className="mt-0.5 text-xs text-gray-400">{t('accountDangerConfirmBody')}</p>
            </div>
          </div>

          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label={t('accountPasswordCurrent')}
            placeholder={t('accountPasswordCurrent')}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:outline-none"
          />

          {error && <p className="text-xs text-red-300">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || !password}
              className="rounded-lg bg-red-800 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {t('accountDangerConfirm')}
            </button>
            <button
              type="button"
              onClick={() => { setConfirming(false); setPassword(''); setError(''); }}
              className="rounded-lg border border-gray-600 px-3 py-2 text-xs text-gray-300 transition-colors hover:bg-gray-800"
            >
              {t('accountDangerCancel')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
