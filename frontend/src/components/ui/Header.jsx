import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import HelpModal from './HelpModal';

function EmailVerificationBanner({ onResend }) {
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    setLoading(true);
    try { await onResend(); setSent(true); } catch { setSent(true); }
    finally { setLoading(false); }
  };

  return (
    <div className="shrink-0 bg-amber-900/80 border-b border-amber-700/60 px-4 py-2 flex items-center justify-between gap-3 text-xs text-amber-200">
      <span>⚠️ Confirme seu email para garantir o acesso à conta.</span>
      {sent ? (
        <span className="text-amber-300 font-medium">Email enviado!</span>
      ) : (
        <button
          onClick={handleResend}
          disabled={loading}
          className="shrink-0 px-3 py-1 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-medium transition-colors"
        >
          {loading ? 'Enviando...' : 'Reenviar email'}
        </button>
      )}
    </div>
  );
}

/** Top navigation bar with title, language toggle and autosave indicator. */
export default function Header({ autosaveStatus }) {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, emailVerified, logout, resendVerificationEmail } = useAuth();
  const [showHelp, setShowHelp] = useState(false);
  const toggleLang = () => i18n.changeLanguage(i18n.language === 'en' ? 'pt' : 'en');

  const autosaveLabel = autosaveStatus === 'saving'
    ? '⏳ Salvando...'
    : autosaveStatus instanceof Date
      ? `✅ Salvo às ${autosaveStatus.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      : null;

  return (
    <>
    {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    {isAuthenticated && !emailVerified && (
      <EmailVerificationBanner onResend={resendVerificationEmail} />
    )}
    <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 shrink-0">
      <Link to={isAuthenticated ? '/stories' : '/login'} className="text-white font-bold text-lg tracking-tight">
        {t('appTitle')}
      </Link>
      <div className="flex items-center gap-3">
        {autosaveLabel && (
          <span className="text-xs text-gray-400 hidden sm:inline transition-all duration-300">
            {autosaveLabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {isAuthenticated && (
          <>
            <Link to="/scenes" className="text-xs font-medium px-3 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors hidden sm:inline-flex">
              Cenas
            </Link>
            <Link to="/stories" className="text-xs font-medium px-3 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors hidden sm:inline-flex">
              Histórias
            </Link>
          </>
        )}
        <Link
          to="/ar"
          className="text-xs font-medium px-3 py-1 rounded-full bg-cyan-700 hover:bg-cyan-600 text-white transition-colors"
        >
          {t('ar')}
        </Link>
        <button
          onClick={toggleLang}
          className="text-xs font-medium px-3 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
        >
          {i18n.language === 'en' ? '🇧🇷 PT' : '🇺🇸 EN'}
        </button>
        <button
          onClick={() => setShowHelp(true)}
          title="Ajuda"
          className="text-xs font-medium px-3 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
        >
          ❓ Ajuda
        </button>
        {isAuthenticated && (
          <>
            <Link to="/account"
              className="text-xs font-medium px-3 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors hidden sm:inline-flex">
              Conta
            </Link>
            <button onClick={logout}
              className="text-xs font-medium px-3 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors">
              Sair
            </button>
          </>
        )}
      </div>
    </header>
    </>
  );
}
