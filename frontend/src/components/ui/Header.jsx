import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import useTheme from '../../context/useTheme';
import HelpModal from './HelpModal';
import Icon from './Icon';

/** Top navigation bar with title and language/theme toggles. */
export default function Header() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [showHelp, setShowHelp] = useState(false);
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');
  const themeIcon =
    theme === "dark" ? "moon" : theme === "light" ? "sun" : "monitor";
  const themeLabel =
    theme === "dark"
      ? t("themeDark")
      : theme === "light"
        ? t("themeLight")
        : t("themeSystem");
  const languageLabel =
    {
      pt: t("langPt"),
      en: t("langEn"),
      es: t("langEs"),
      fr: t("langFr"),
    }[i18n.language] || t("langPt");
  const cycleTheme = () => {
    const nextTheme =
      { system: "light", light: "dark", dark: "system" }[theme] || "system";
    setTheme(nextTheme);
  };

  return (
    <>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 shrink-0">
        <Link
          to={isAuthenticated ? "/stories" : "/login"}
          className="text-white font-bold text-lg tracking-tight"
        >
          {t("appTitle")}
        </Link>
        <div className="flex items-center flex-wrap justify-end gap-2">
          {isAuthenticated && (
            <>
              <Link
                to="/scenes"
                className={`text-xs font-medium px-3 py-1 rounded-full transition-colors hidden sm:inline-flex ${isActive("/scenes") ? "bg-cyan-700 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-200"}`}
              >
                {t("headerScenes")}
              </Link>
              <Link
                to="/stories"
                className={`text-xs font-medium px-3 py-1 rounded-full transition-colors hidden sm:inline-flex ${isActive("/stories") ? "bg-cyan-700 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-200"}`}
              >
                {t("headerStories")}
              </Link>
            </>
          )}
          <Link
            to="/ar"
            className={`text-xs font-medium px-3 py-1 rounded-full transition-colors hidden sm:inline-flex items-center gap-1 ${isActive("/ar") ? "bg-indigo-500 text-white ring-2 ring-indigo-400/50" : "bg-indigo-600 hover:bg-indigo-500 text-white"}`}
          >
            <Icon name="cube" className="w-3.5 h-3.5" />
            {t("ar")}
          </Link>
          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            aria-label={languageLabel}
            title={languageLabel}
            className="h-8 min-w-16 text-sm font-medium px-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors cursor-pointer border-0 outline-none"
          >
            <option value="pt">🇧🇷 PT</option>
            <option value="en">🇺🇸 EN</option>
            <option value="es">🇪🇸 ES</option>
            <option value="fr">🇫🇷 FR</option>
          </select>
          <button
            type="button"
            onClick={cycleTheme}
            title={themeLabel}
            aria-label={themeLabel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-gray-200 transition-colors hover:bg-gray-600"
          >
            <Icon name={themeIcon} className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowHelp(true)}
            title={t("helpTitle")}
            className="text-xs font-medium px-3 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
          >
            <Icon
              name="sparkles"
              className="w-3.5 h-3.5 inline-block mr-1 align-middle"
            />
            {t("headerTour")}
          </button>
          {isAuthenticated && (
            <>
              <Link
                to="/account"
                className="text-xs font-medium px-3 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors hidden sm:inline-flex"
              >
                {t("headerAccount")}
              </Link>
              <button
                onClick={logout}
                className="text-xs font-medium px-3 py-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
              >
                {t("headerLogout")}
              </button>
            </>
          )}
        </div>
      </header>
    </>
  );
}
