import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../api/sceneApi';
import { useAuth } from '../auth/AuthContext';

export default function VerifyEmailPage() {
  const [searchParams]  = useSearchParams();
  const { refreshUser } = useAuth();
  const token           = searchParams.get('token') || '';

  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Token não encontrado no link.'); return; }

    verifyEmail(token)
      .then((data) => {
        setStatus('success');
        setMessage(data?.message || 'Email confirmado!');
        refreshUser?.(); // atualiza AuthContext para remover o banner
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err?.response?.data?.error || 'Token inválido ou já utilizado.');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-8 flex flex-col items-center gap-5 text-center">

        {status === 'verifying' && (
          <>
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
            <p className="text-gray-300">Confirmando seu email...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <span className="text-5xl">✅</span>
            <div>
              <h2 className="text-lg font-bold text-white">Email confirmado!</h2>
              <p className="text-sm text-gray-400 mt-1">{message}</p>
            </div>
            <Link to="/stories"
              className="px-6 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-semibold transition-colors">
              Ir para minhas histórias
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <span className="text-5xl">❌</span>
            <div>
              <h2 className="text-lg font-bold text-red-300">Falha na confirmação</h2>
              <p className="text-sm text-gray-400 mt-1">{message}</p>
            </div>
            <Link to="/login"
              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
              Voltar ao login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
