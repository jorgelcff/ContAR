import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import Icon from '../components/ui/Icon';

function getFeatures(t) {
  return [
    { icon: 'theater', title: t('landingFeature1Title'), desc: t('landingFeature1Desc') },
    { icon: 'audio', title: t('landingFeature2Title'), desc: t('landingFeature2Desc') },
    { icon: 'story', title: t('landingFeature3Title'), desc: t('landingFeature3Desc') },
    { icon: 'monitor', title: t('landingFeature4Title'), desc: t('landingFeature4Desc') },
  ];
}

function getCaseSteps(t) {
  return [
    t('landingCaseStep1'),
    t('landingCaseStep2'),
    t('landingCaseStep3'),
  ];
}

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();

  const primaryHref = isAuthenticated ? '/stories' : '/login';
  const primaryLabel = isAuthenticated ? t('landingCtaPrimaryAuth') : t('landingCtaPrimary');

  const FEATURES = getFeatures(t);
  const CASE_STEPS = getCaseSteps(t);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-gray-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="scene" className="w-5 h-5 text-cyan-400" />
            <span className="text-lg font-bold tracking-tight text-white">ContAR</span>
          </div>
          <div className="flex items-center gap-3">
            {!isLoading && (
              isAuthenticated ? (
                <Link
                  to="/stories"
                  className="rounded-full bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
                >
                  {t('landingNavMyStories')}
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-2 hidden sm:inline"
                  >
                    {t('landingNavEnter')}
                  </Link>
                  <Link
                    to="/login"
                    className="rounded-full bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
                  >
                    {t('landingNavCreate')}
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </nav>

      <section className="px-5 pt-18 pb-12 border-b border-white/5">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm text-cyan-300 font-medium">{t('landingHeroBadge')}</p>
          <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            {t('landingHeroTitle')} <span className="text-cyan-400">{t('landingHeroTitleHighlight')}</span> {t('landingHeroTitleSuffix')}
          </h1>
          <p className="mt-5 text-lg text-gray-300 max-w-3xl leading-relaxed">{t('landingHeroSubtitle')}</p>

          <ul className="mt-6 space-y-2 text-sm text-gray-400">
            <li>• {t('landingHeroPoint1')}</li>
            <li>• {t('landingHeroPoint2')}</li>
            <li>• {t('landingHeroPoint3')}</li>
          </ul>

          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Link
              to={primaryHref}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-600 hover:bg-cyan-500 px-7 py-3 text-base font-semibold text-white transition-colors"
            >
              {primaryLabel}
            </Link>
            {!isAuthenticated && (
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-xl border border-gray-700 hover:border-gray-500 px-7 py-3 text-base font-medium text-gray-300 hover:text-white transition-colors"
              >
                {t('landingCtaSecondary')}
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="py-14 px-5 border-b border-white/5">
        <div className="max-w-4xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">{t('landingCaseLabel')}</p>
          <h2 className="mt-3 text-2xl font-bold">{t('landingCaseTitle')}</h2>
          <p className="mt-3 text-gray-300 leading-relaxed">{t('landingCaseDescription')}</p>

          <ol className="mt-6 space-y-3 text-sm text-gray-300">
            {CASE_STEPS.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-semibold">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <p className="mt-5 text-sm text-cyan-200">{t('landingCaseResult')}</p>
        </div>
      </section>

      <section className="py-16 px-5 border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-8">{t('landingFeaturesTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-white/10 bg-gray-900/40 p-5">
                <Icon name={feature.icon} className="w-6 h-6 text-cyan-300" />
                <p className="mt-3 font-semibold text-white">{feature.title}</p>
                <p className="mt-1 text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-5 border-b border-white/5 bg-gray-900/25">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">{t('landingCurrentScopeTitle')}</p>
            <ul className="mt-4 space-y-2 text-sm text-gray-300">
              <li>• {t('landingCurrentScopeItem1')}</li>
              <li>• {t('landingCurrentScopeItem2')}</li>
              <li>• {t('landingCurrentScopeItem3')}</li>
            </ul>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">{t('landingRoadmapTitle')}</p>
            <ul className="mt-4 space-y-2 text-sm text-gray-300">
              <li>• {t('landingRoadmapItem1')}</li>
              <li>• {t('landingRoadmapItem2')}</li>
              <li>• {t('landingRoadmapItem3')}</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="py-20 px-5 text-center">
        <div className="max-w-2xl mx-auto flex flex-col items-center gap-5">
          <Icon name="scene" className="w-10 h-10 text-cyan-400" />
          <h2 className="text-3xl font-bold">{t('landingCtaFinalTitle')}</h2>
          <p className="text-gray-300">{t('landingCtaFinalSubtitle')}</p>
          <Link
            to={primaryHref}
            className="inline-flex items-center justify-center rounded-xl bg-cyan-600 hover:bg-cyan-500 px-8 py-3 text-base font-semibold text-white transition-colors"
          >
            {primaryLabel}
          </Link>
          {!isAuthenticated && (
            <p className="text-xs text-gray-500">
              {t('landingAlreadyHaveAccount')}{' '}
              <Link to="/login" className="text-gray-300 hover:text-white transition-colors underline underline-offset-2">
                {t('landingEnterLink')}
              </Link>
            </p>
          )}
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <Icon name="scene" className="w-4 h-4" />
            <span className="font-semibold text-gray-500">ContAR</span>
            <span>· © {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <Link to="/login" className="hover:text-gray-400 transition-colors">{t('landingFooterEnter')}</Link>
            <Link to="/ar" className="hover:text-gray-400 transition-colors">{t('landingFooterAr')}</Link>
            <Link to="/login" className="hover:text-gray-400 transition-colors">{t('landingFooterCreate')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
