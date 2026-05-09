import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { forgotPassword } from '../api/sceneApi';

// view: 'login' | 'register' | 'forgot' | 'forgot-sent'
export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, login, register } = useAuth();

  const [view, setView]           = useState('login');
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) return <Navigate to="/stories" replace />;

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
      setError(err?.response?.data?.error || err.message || 'Falha na autenticação');
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
      setError(err?.response?.data?.error || 'Não foi possível enviar o email. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const titles = {
    login: 'Entrar',
    register: 'Criar conta',
    forgot: 'Recuperar senha',
    'forgot-sent': 'Email enviado',
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 flex flex-col gap-4">

        <div>
          <h1 className="text-xl font-bold">{titles[view]}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {view === 'login'        && 'Entre para acessar suas histórias e cenas.'}
            {view === 'register'     && 'Crie sua conta para começar a narrar.'}
            {view === 'forgot'       && 'Informe seu email para receber o link de redefinição.'}
            {view === 'forgot-sent'  && `Verifique a caixa de entrada de ${email}.`}
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-700 bg-red-950/80 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* ── Login / Register ─────────────────── */}
        {(view === 'login' || view === 'register') && (
          <form onSubmit={submit} className="flex flex-col gap-3">
            {view === 'register' && (
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Nome" autoComplete="name"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            )}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email" required autoComplete="email"
              className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha" required minLength={6} autoComplete={view === 'register' ? 'new-password' : 'current-password'}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button type="submit" disabled={submitting}
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {submitting ? 'Aguarde...' : view === 'register' ? 'Criar conta' : 'Entrar'}
            </button>
          </form>
        )}

        {/* ── Forgot password ──────────────────── */}
        {view === 'forgot' && (
          <form onSubmit={submitForgot} className="flex flex-col gap-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Seu email" required autoComplete="email"
              className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button type="submit" disabled={submitting}
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {submitting ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>
          </form>
        )}

        {/* ── Sent confirmation ────────────────── */}
        {view === 'forgot-sent' && (
          <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
            Link enviado! Verifique sua caixa de entrada e clique no link para criar uma nova senha.
            O link expira em 1 hora.
          </div>
        )}

        {/* ── Footer links ─────────────────────── */}
        <div className="flex flex-col gap-1.5 pt-1">
          {view === 'login' && (
            <>
              <button onClick={() => { setView('register'); setError(''); }}
                className="text-sm text-gray-300 hover:text-white transition-colors text-left">
                Não tem conta? Criar uma
              </button>
              <button onClick={() => { setView('forgot'); setError(''); }}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors text-left">
                Esqueci minha senha
              </button>
            </>
          )}
          {view === 'register' && (
            <button onClick={() => { setView('login'); setError(''); }}
              className="text-sm text-gray-300 hover:text-white transition-colors text-left">
              Já tem conta? Entrar
            </button>
          )}
          {(view === 'forgot' || view === 'forgot-sent') && (
            <button onClick={() => { setView('login'); setError(''); }}
              className="text-sm text-gray-300 hover:text-white transition-colors text-left">
              ← Voltar ao login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
