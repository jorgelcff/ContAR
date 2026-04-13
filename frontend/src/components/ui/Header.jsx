import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

/** Top navigation bar with title and language toggle. */
export default function Header() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, logout } = useAuth();
  const toggleLang = () => i18n.changeLanguage(i18n.language === 'en' ? 'pt' : 'en');

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 shrink-0">
      <Link to={isAuthenticated ? '/stories' : '/login'} className="text-white font-bold text-lg tracking-tight">
        {t('appTitle')}
      </Link>
      <div className="flex items-center gap-2">
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
        {isAuthenticated && (
          <button
            onClick={logout}
            className="text-xs font-medium px-3 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
          >
            Logout
          </button>
        )}
      </div>
    </header>
  );
}
