import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/sceneApi';
import { useTranslation } from 'react-i18next';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const [done, setDone]           = useState(false);

  if (!token) {
    return (
      <div className="min-h-dvh bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-700/50 bg-gray-900 p-6 text-center flex flex-col gap-4">
          <p className="text-red-300 font-medium">{t('resetPwInvalidToken')}</p>
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300 text-sm transition-colors">
            {t('resetPwRequestNew')}
          </Link>
        </div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError(t('resetPwMismatch')); return; }
    if (password.length < 6)  { setError(t('resetPwTooShort')); return; }
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.error || t('resetPwInvalidToken'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 flex flex-col gap-4">

        <div>
          <h1 className="text-xl font-bold">{t('resetPwTitle')}</h1>
          <p className="text-sm text-gray-400 mt-1">{t('resetPwSubtitle')}</p>
        </div>

        {error && (
          <div className="rounded-md border border-red-700 bg-red-950/80 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {done ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
              {t('resetPwSuccessMsg')}
            </div>
            <Link to="/login"
              className="w-full text-center py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
              {t('resetPwGoToLogin')}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={t('resetPwNewPw')} required minLength={6} autoComplete="new-password"
              className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder={t('resetPwConfirmPw')} required autoComplete="new-password"
              className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button type="submit" disabled={submitting}
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {submitting ? t('resetPwSubmitting') : t('resetPwSubmit')}
            </button>
          </form>
        )}

        <Link to="/login" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          {t('resetPwBackToLogin')}
        </Link>
      </div>
    </div>
  );
}
