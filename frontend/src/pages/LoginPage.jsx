import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/stories" replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (isRegister) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      navigate('/stories', { replace: true });
    } catch (err) {
      const apiError = err?.response?.data?.error;
      setError(apiError || err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 flex flex-col gap-4">
        <h1 className="text-xl font-bold">{isRegister ? 'Create account' : 'Login'}</h1>
        <p className="text-sm text-gray-400">Start by creating stories, then build scenes for each one.</p>

        {error && <div className="rounded-md border border-red-700 bg-red-950/80 px-3 py-2 text-sm text-red-200">{error}</div>}

        <form onSubmit={submit} className="flex flex-col gap-3">
          {isRegister && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            minLength={6}
            required
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {submitting ? 'Please wait...' : isRegister ? 'Create account' : 'Login'}
          </button>
        </form>

        <button
          onClick={() => setIsRegister((v) => !v)}
          className="text-sm text-gray-300 hover:text-white transition-colors"
        >
          {isRegister ? 'Already have an account? Login' : 'No account? Create one'}
        </button>
      </div>
    </div>
  );
}
