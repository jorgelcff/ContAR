import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import useTheme from '../../context/useTheme';
import HelpModal from './HelpModal';
import Icon from './Icon';

/** Top navigation bar with title, language toggle and autosave indicator. */
export default function Header({ autosaveStatus }) {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [showHelp, setShowHelp] = useState(false);

  const autosaveLabel = autosaveStatus === 'saving'
    ? t('headerAutosaveSaving')
    : autosaveStatus instanceof Date
      ? t('headerAutosaveSaved', { time: autosaveStatus.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) })
      : null;

  return (
    <>
    {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
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
              {t('headerScenes')}
            </Link>
            <Link to="/stories" className="text-xs font-medium px-3 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors hidden sm:inline-flex">
              {t('headerStories')}
            </Link>
          </>
        )}
        <Link
          to="/ar"
          className="text-xs font-medium px-3 py-1 rounded-full bg-cyan-700 hover:bg-cyan-600 text-white transition-colors"
        >
          {t('ar')}
        </Link>
        <select
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="text-xs font-medium px-2 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors cursor-pointer border-0 outline-none"
        >
          <option value="pt">{t('langPt')}</option>
          <option value="en">{t('langEn')}</option>
          <option value="es">{t('langEs')}</option>
          <option value="fr">{t('langFr')}</option>
        </select>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          title={t('themeTitle')}
          className="text-xs font-medium px-2 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors cursor-pointer border-0 outline-none"
        >
          <option value="dark">{t('themeDark')}</option>
          <option value="light">{t('themeLight')}</option>
          <option value="system">{t('themeSystem')}</option>
        </select>
        <button
          onClick={() => setShowHelp(true)}
          title={t('helpTitle')}
          className="text-xs font-medium px-3 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
        >
          <Icon name="sparkles" className="w-3.5 h-3.5 inline-block mr-1 align-middle" />
          {t('headerTour')}
        </button>
        {isAuthenticated && (
          <>
            <Link to="/account"
              className="text-xs font-medium px-3 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors hidden sm:inline-flex">
              {t('headerAccount')}
            </Link>
            <button onClick={logout}
              className="text-xs font-medium px-3 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors">
              {t('headerLogout')}
            </button>
          </>
        )}
      </div>
    </header>
    </>
  );
}
