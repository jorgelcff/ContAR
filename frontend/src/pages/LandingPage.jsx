import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import Icon from '../components/ui/Icon';

// ── Static data factories ───────────────────────────────────────────────────

function getFeatures(t) {
  return [
    {
      icon: 'theater',
      title: t('landingFeature1Title'),
      color: 'from-cyan-500/20 to-cyan-500/5',
      border: 'border-cyan-500/20',
      desc: t('landingFeature1Desc'),
    },
    {
      icon: 'audio',
      title: t('landingFeature2Title'),
      color: 'from-purple-500/20 to-purple-500/5',
      border: 'border-purple-500/20',
      desc: t('landingFeature2Desc'),
    },
    {
      icon: 'story',
      title: t('landingFeature3Title'),
      color: 'from-blue-500/20 to-blue-500/5',
      border: 'border-blue-500/20',
      desc: t('landingFeature3Desc'),
    },
    {
      icon: 'monitor',
      title: t('landingFeature4Title'),
      color: 'from-emerald-500/20 to-emerald-500/5',
      border: 'border-emerald-500/20',
      desc: t('landingFeature4Desc'),
    },
  ];
}

function getAudiences(t) {
  return [
    {
      icon: 'graduation',
      title: t('landingAudience1Title'),
      desc: t('landingAudience1Desc'),
    },
    {
      icon: 'palette',
      title: t('landingAudience2Title'),
      desc: t('landingAudience2Desc'),
    },
    {
      icon: 'sparkles',
      title: t('landingAudience3Title'),
      desc: t('landingAudience3Desc'),
    },
  ];
}

function getSteps(t) {
  return [
    {
      n: '1', icon: 'avatar',
      title: t('landingStep1Title'),
      desc: t('landingStep1Desc'),
    },
    {
      n: '2', icon: 'speech',
      title: t('landingStep2Title'),
      desc: t('landingStep2Desc'),
    },
    {
      n: '3', icon: 'rocket',
      title: t('landingStep3Title'),
      desc: t('landingStep3Desc'),
    },
  ];
}

// ── Animated counter ───────────────────────────────────────────────────────

function Counter({ target, suffix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started.current) return;
      started.current = true;
      const duration = 1200;
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - start) / duration);
        setCount(Math.round(p * target));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

// ── Product preview mockup ────────────────────────────────────────────────

function ProductPreview() {
  return (
    <div className="relative w-full max-w-2xl mx-auto mt-14 px-4">
      {/* Glow behind */}
      <div className="absolute inset-0 rounded-3xl bg-cyan-500/10 blur-3xl scale-110 pointer-events-none" />

      {/* Browser chrome */}
      <div className="relative rounded-2xl border border-white/10 bg-gray-900 shadow-2xl shadow-black/60 overflow-hidden">
        {/* Browser bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/80 border-b border-white/5">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <div className="flex-1 mx-4 rounded-full bg-gray-700/60 px-3 py-1 text-[10px] text-gray-500 text-center">
            avaturn-threejs-1.onrender.com/story/...
          </div>
        </div>

        {/* Viewer mockup */}
        <div className="relative bg-gray-950 aspect-video flex items-center justify-center overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-linear-to-b from-gray-900 to-gray-950" />

          {/* Fake ground plane */}
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-linear-to-t from-gray-800/30 to-transparent" />

          {/* Avatar silhouette */}
          <div className="relative z-10 flex flex-col items-center gap-2">
            {/* Head */}
            <div className="w-14 h-14 rounded-full bg-linear-to-b from-cyan-400/40 to-blue-500/30 border border-cyan-400/30 shadow-lg shadow-cyan-900/50 flex items-center justify-center text-3xl">
              <Icon name="avatar" className="w-8 h-8 text-cyan-300" />
            </div>
            {/* Body */}
            <div className="w-10 h-16 rounded-t-xl bg-linear-to-b from-cyan-600/30 to-blue-700/20 border border-cyan-500/20" />
          </div>

          {/* Speech bubble — illustrative demo content, kept as-is */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-gray-900/90 border border-white/10 rounded-xl px-4 py-2 text-xs text-gray-200 shadow-lg max-w-50 text-center">
            <span className="italic">"Bem-vindo à nossa aula interativa!"</span>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-900/90" />
          </div>

          {/* Controls bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-gray-900/95 border-t border-white/5 px-4 py-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-700/80 flex items-center justify-center text-xs">▶</div>
            <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="w-2/5 h-full bg-cyan-400 rounded-full" />
            </div>
            <span className="text-[10px] text-gray-500">2/3</span>
            <div className="w-7 h-7 rounded bg-cyan-700/80 flex items-center justify-center text-[10px] text-white font-bold">AR</div>
          </div>

          {/* Floating badge — illustrative demo content, kept as-is */}
          <div className="absolute top-3 right-3 rounded-full bg-purple-600/80 px-2 py-0.5 text-[10px] text-white font-semibold backdrop-blur-sm">
            <span className="inline-flex items-center gap-1"><Icon name="audio" className="w-3 h-3" /> Ao vivo</span>
          </div>
        </div>
      </div>

      {/* Labels below */}
      <div className="flex justify-center gap-6 mt-4">
        {['Avatar 3D', 'Voz com IA', 'Lip Sync'].map((label) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();

  const primaryHref  = isAuthenticated ? '/stories' : '/login';
  const primaryLabel = isAuthenticated ? t('landingCtaPrimaryAuth') : t('landingCtaPrimary');

  const AUDIENCES = getAudiences(t);
  const FEATURES  = getFeatures(t);
  const STEPS     = getSteps(t);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* ── Navbar ──────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-gray-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="scene" className="w-5 h-5 text-cyan-400" />
            <span className="text-lg font-bold tracking-tight text-white">ContAR</span>
          </div>
          <div className="flex items-center gap-3">
            {!isLoading && (
              isAuthenticated ? (
                <Link to="/stories"
                  className="rounded-full bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition-colors">
                  {t('landingNavMyStories')}
                </Link>
              ) : (
                <>
                  <Link to="/login"
                    className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-2 hidden sm:inline">
                    {t('landingNavEnter')}
                  </Link>
                  <Link to="/login"
                    className="rounded-full bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition-colors">
                    {t('landingNavCreate')}
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center text-center px-5 pt-20 pb-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-medium text-cyan-300 mb-8">
          {t('landingHeroBadge')}
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight max-w-3xl">
          {t('landingHeroTitle')}{' '}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-cyan-400 to-purple-400">
            {t('landingHeroTitleHighlight')}
          </span>
          {' '}{t('landingHeroTitleSuffix')}
        </h1>

        <p className="mt-6 text-lg text-gray-400 max-w-xl leading-relaxed">
          {t('landingHeroSubtitle')}
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link to={primaryHref}
            className="inline-flex items-center justify-center rounded-2xl bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-blue-900/30 transition-all active:scale-95">
            {primaryLabel}
          </Link>
          {!isAuthenticated && (
            <Link to="/login"
              className="inline-flex items-center justify-center rounded-2xl border-2 border-gray-700 hover:border-cyan-500/50 px-8 py-4 text-base font-medium text-gray-300 hover:text-white transition-all active:scale-95">
              {t('landingCtaSecondary')}
            </Link>
          )}
        </div>

        {/* Product mockup */}
        <ProductPreview />
      </section>

      {/* ── Stats ───────────────────────────────────────────────── */}
      <section className="py-12 px-5 border-y border-white/5 bg-white/2">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-6 text-center">
          {[
            { value: 3,   suffix: ' min',  label: t('landingStatsMinLabel') },
            { value: 100, suffix: '%',     label: t('landingStatsBrowserLabel') },
            { value: 0,   suffix: ' apps', label: t('landingStatsAppsLabel') },
          ].map(({ value, suffix, label }) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="text-3xl sm:text-4xl font-extrabold text-cyan-400">
                <Counter target={value} suffix={suffix} />
              </span>
              <span className="text-xs text-gray-500 leading-snug">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Para quem é ─────────────────────────────────────────── */}
      <section className="py-20 px-5 border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-purple-400 mb-3">
            {t('landingAudienceLabel')}
          </p>
          <h2 className="text-center text-3xl font-bold mb-12">{t('landingAudienceTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {AUDIENCES.map((a) => (
              <div key={a.title}
                className="rounded-2xl border border-white/5 bg-gray-900/60 p-6 flex flex-col gap-3 hover:border-purple-500/30 transition-colors">
                <Icon name={a.icon} className="w-8 h-8 text-cyan-300" />
                <p className="font-semibold text-white text-lg">{a.title}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-b border-white/5 bg-gray-900/30">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-cyan-400 mb-3">
            {t('landingFeaturesLabel')}
          </p>
          <h2 className="text-center text-3xl font-bold mb-12">{t('landingFeaturesTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title}
                className={`rounded-2xl border ${f.border} bg-linear-to-b ${f.color} p-6 flex flex-col gap-3 hover:scale-[1.02] transition-transform`}>
                <Icon name={f.icon} className="w-7 h-7 text-cyan-300" />
                <p className="font-semibold text-white">{f.title}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section className="py-20 px-5 border-b border-white/5">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-cyan-400 mb-3">
            {t('landingStepsLabel')}
          </p>
          <h2 className="text-center text-3xl font-bold mb-14">{t('landingStepsTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex flex-col items-center text-center gap-4">
                {/* Connector line (desktop only) */}
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-linear-to-br from-cyan-600 to-purple-700 flex items-center justify-center text-2xl shadow-lg shadow-purple-900/30">
                    <Icon name={s.icon} className="w-8 h-8" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gray-950 border-2 border-cyan-500 text-[10px] font-bold text-cyan-400 flex items-center justify-center">
                    {s.n}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 left-full w-full h-px bg-linear-to-r from-cyan-500/40 to-purple-500/20 -translate-y-1/2 translate-x-2" />
                  )}
                </div>
                <p className="font-semibold text-lg">{s.title}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof / TCC context ──────────────────────────── */}
      <section className="py-16 px-5 border-b border-white/5 bg-white/2">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-gray-900 px-6 py-4">
            <Icon name="graduation" className="w-8 h-8 text-cyan-300" />
            <div className="text-left">
              <p className="text-sm font-semibold text-white">{t('landingSocialBadgeTitle')}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('landingSocialBadgeDesc')}
              </p>
            </div>
          </div>
          <blockquote className="max-w-lg text-gray-400 text-sm italic leading-relaxed border-l-2 border-cyan-500/40 pl-4 text-left">
            {t('landingSocialQuote')}
          </blockquote>
        </div>
      </section>

      {/* ── CTA final ───────────────────────────────────────────── */}
      <section className="py-24 px-5 text-center">
        <div className="max-w-2xl mx-auto flex flex-col items-center gap-6">
          <Icon name="scene" className="w-12 h-12 text-cyan-400" />
          <h2 className="text-3xl font-bold">{t('landingCtaFinalTitle')}</h2>
          <p className="text-gray-400 max-w-md leading-relaxed">
            {t('landingCtaFinalSubtitle')}
          </p>
          <Link to={primaryHref}
            className="inline-flex items-center justify-center rounded-2xl bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-10 py-4 text-base font-semibold text-white shadow-xl shadow-blue-900/30 transition-all active:scale-95">
            {primaryLabel}
          </Link>
          {!isAuthenticated && (
            <p className="text-xs text-gray-600">
              {t('landingAlreadyHaveAccount')}{' '}
              <Link to="/login" className="text-gray-400 hover:text-white transition-colors underline underline-offset-2">
                {t('landingEnterLink')}
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
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
