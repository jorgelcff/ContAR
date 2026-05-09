import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { forgotPassword } from '../api/sceneApi';

// ── Map backend/network errors to friendly PT messages ──────────────────────
function friendlyError(err, t) {
  const code   = err?.code || '';
  const status = err?.response?.status;
  const msg    = String(err?.response?.data?.error || err?.message || '').toLowerCase();

  if (code === 'ERR_NETWORK' || code === 'ERR_FAILED' || msg.includes('network') || msg.includes('failed to fetch')) {
    return 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.';
  }
  if (status === 503 || msg.includes('database unavailable')) {
    return 'Servidor temporariamente indisponível. Tente novamente em instantes.';
  }
  if (status === 401 || msg.includes('invalid credentials')) {
    return 'Email ou senha incorretos. Verifique os dados e tente novamente.';
  }
  if (status === 409 || msg.includes('already registered')) {
    return 'Este email já está cadastrado. Faça login ou use outro email.';
  }
  if (msg.includes('password must be at least')) {
    return 'A senha deve ter ao menos 6 caracteres.';
  }
  if (msg.includes('email and password are required')) {
    return 'Email e senha são obrigatórios.';
  }
  if (msg.includes('token inválido') || msg.includes('invalid or expired')) {
    return 'Link inválido ou expirado. Solicite um novo link de redefinição.';
  }

  // Return original message if not mapped (might already be in PT from backend)
  return err?.response?.data?.error || t('loginAuthError');
}

// ── Eye icons ────────────────────────────────────────────────────────────────
function EyeIcon({ open }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// ── Input field ───────────────────────────────────────────────────────────────
function Field({ type, value, onChange, placeholder, autoComplete, required, minLength, hasError, children }) {
  const [showPw, setShowPw] = useState(false);
  const isPw = type === 'password';
  const effectiveType = isPw ? (showPw ? 'text' : 'password') : type;

  return (
    <div className="relative">
      <input
        type={effectiveType}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className={`w-full rounded-xl bg-gray-800/80 border text-white text-sm px-4 py-3 pr-${isPw ? '10' : '4'} placeholder-gray-500 focus:outline-none transition-colors ${
          hasError
            ? 'border-red-500/70 focus:border-red-400'
            : 'border-gray-700 focus:border-cyan-500'
        }`}
      />
      {isPw && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPw((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
          aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}
        >
          <EyeIcon open={showPw} />
        </button>
      )}
      {children}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      <span>Aguarde…</span>
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { t }      = useTranslation();
  const navigate   = useNavigate();
  const { isAuthenticated, isLoading, login, register } = useAuth();

  const [view, setView]           = useState('login');
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState('');
  const [shake, setShake]         = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) return <Navigate to="/stories" replace />;

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const clearError = () => { if (error) setError(''); };

  const switchView = (v) => { setView(v); setError(''); setPassword(''); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (view === 'register') {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      navigate('/stories', { replace: true });
    } catch (err) {
      setError(friendlyError(err, t));
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  };

  const submitForgot = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setView('forgot-sent');
    } catch (err) {
      setError(friendlyError(err, t));
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  };

  const viewTitles    = { login: t('loginTitle'), register: t('registerTitle'), forgot: t('forgotTitle'), 'forgot-sent': t('forgotSentTitle') };
  const viewSubtitles = {
    login:        t('loginSubtitle'),
    register:     t('registerSubtitle'),
    forgot:       t('forgotSubtitle'),
    'forgot-sent': t('forgotSentSubtitle', { email }),
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-cyan-600/10 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full bg-purple-600/8 blur-3xl" />
      </div>

      {/* Card */}
      <div
        className={`relative w-full max-w-md rounded-2xl border border-white/8 bg-gray-900/95 backdrop-blur-sm shadow-2xl shadow-black/50 p-8 flex flex-col gap-5 transition-transform ${
          shake ? 'animate-[shake_0.4s_ease-in-out]' : ''
        }`}
        style={{ animation: shake ? 'shake 0.4s ease-in-out' : undefined }}
      >
        {/* Brand */}
        <div className="flex flex-col items-center gap-1 pb-2">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-3xl">🎬</span>
            <span className="text-2xl font-extrabold tracking-tight text-white group-hover:text-cyan-300 transition-colors">
              ContAR
            </span>
          </Link>
        </div>

        {/* Title + subtitle */}
        <div>
          <h1 className="text-xl font-bold text-white">{viewTitles[view]}</h1>
          <p className="text-sm text-gray-400 mt-1 leading-relaxed">{viewSubtitles[view]}</p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/60 px-4 py-3 text-sm text-red-200">
            <span className="text-base shrink-0 mt-px">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Login / Register form ─────────────────── */}
        {(view === 'login' || view === 'register') && (
          <form onSubmit={submit} className="flex flex-col gap-3">
            {view === 'register' && (
              <Field
                type="text" value={name}
                onChange={(e) => { setName(e.target.value); clearError(); }}
                placeholder={t('loginName')} autoComplete="name"
                hasError={false}
              />
            )}
            <Field
              type="email" value={email}
              onChange={(e) => { setEmail(e.target.value); clearError(); }}
              placeholder={t('loginEmail')} required autoComplete="email"
              hasError={!!error && view === 'login'}
            />
            <Field
              type="password" value={password}
              onChange={(e) => { setPassword(e.target.value); clearError(); }}
              placeholder={t('loginPassword')} required minLength={6}
              autoComplete={view === 'register' ? 'new-password' : 'current-password'}
              hasError={!!error}
            />

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 w-full py-3 rounded-xl bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-60 text-white text-sm font-semibold transition-all active:scale-[0.98] shadow-lg shadow-blue-900/30"
            >
              {submitting ? <Spinner /> : view === 'register' ? t('registerSubmit') : t('loginSubmit')}
            </button>
          </form>
        )}

        {/* ── Forgot password form ──────────────────── */}
        {view === 'forgot' && (
          <form onSubmit={submitForgot} className="flex flex-col gap-3">
            <Field
              type="email" value={email}
              onChange={(e) => { setEmail(e.target.value); clearError(); }}
              placeholder={t('loginEmail')} required autoComplete="email"
              hasError={!!error}
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-60 text-white text-sm font-semibold transition-all active:scale-[0.98]"
            >
              {submitting ? <Spinner /> : t('forgotSubmit')}
            </button>
          </form>
        )}

        {/* ── Sent confirmation ────────────────────── */}
        {view === 'forgot-sent' && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-700/40 bg-emerald-950/40 px-4 py-4">
            <span className="text-2xl shrink-0">✉️</span>
            <p className="text-sm text-emerald-200 leading-relaxed">{t('loginForgotSentMsg')}</p>
          </div>
        )}

        {/* ── Footer links ─────────────────────────── */}
        <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
          {view === 'login' && (
            <>
              <button onClick={() => switchView('register')}
                className="text-sm text-gray-300 hover:text-white transition-colors text-left py-1">
                {t('loginToggleToRegister')}
              </button>
              <button onClick={() => switchView('forgot')}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors text-left py-1">
                {t('loginForgotLink')}
              </button>
            </>
          )}
          {view === 'register' && (
            <button onClick={() => switchView('login')}
              className="text-sm text-gray-300 hover:text-white transition-colors text-left py-1">
              {t('loginToggleToLogin')}
            </button>
          )}
          {(view === 'forgot' || view === 'forgot-sent') && (
            <button onClick={() => switchView('login')}
              className="text-sm text-gray-300 hover:text-white transition-colors text-left py-1">
              {t('loginBackToLogin')}
            </button>
          )}
        </div>
      </div>

      {/* Shake keyframes via inline style tag */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-6px); }
          30%       { transform: translateX(6px); }
          45%       { transform: translateX(-4px); }
          60%       { transform: translateX(4px); }
          75%       { transform: translateX(-2px); }
          90%       { transform: translateX(2px); }
        }
      `}</style>
    </div>
  );
}
