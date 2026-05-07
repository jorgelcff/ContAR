import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const FEATURES = [
  {
    icon: '🎭',
    title: 'Avatares 3D personalizados',
    desc: 'Crie seu personagem 3D em minutos — use uma selfie ou personalize do zero, gratuitamente.',
  },
  {
    icon: '🎙️',
    title: 'Voz gerada por IA',
    desc: 'Digite o texto e gere áudio com voz sintética. Os lábios do avatar se sincronizam automaticamente.',
  },
  {
    icon: '📖',
    title: 'Histórias em sequência',
    desc: 'Monte múltiplas cenas em ordem e compartilhe uma história completa com um link único.',
  },
  {
    icon: '📱',
    title: 'Realidade Aumentada',
    desc: 'Projete o avatar no mundo real pelo celular com WebXR — sem instalar nenhum app.',
  },
];

const STEPS = [
  { n: '1', icon: '👤', title: 'Crie seu avatar', desc: 'Use o criador de avatares integrado, personalize o rosto e a roupa e exporte para o editor.' },
  { n: '2', icon: '💬', title: 'Escreva a fala', desc: 'Digite o texto, gere a voz com IA e veja o avatar falar com lábios sincronizados.' },
  { n: '3', icon: '🚀', title: 'Compartilhe', desc: 'Salve a cena, monte a história e copie o link — qualquer pessoa consegue assistir.' },
];

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();

  const primaryHref = isAuthenticated ? '/stories' : '/login';
  const primaryLabel = isAuthenticated ? 'Ir para minhas histórias →' : 'Criar conta grátis';
  const secondaryHref = isAuthenticated ? '/editor' : '/login';
  const secondaryLabel = isAuthenticated ? 'Abrir editor' : 'Entrar';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* ── Navbar ────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-gray-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-white">ContAR</span>
          <div className="flex items-center gap-3">
            {!isLoading && (
              isAuthenticated ? (
                <Link to="/stories"
                  className="rounded-full bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition-colors">
                  Minhas histórias
                </Link>
              ) : (
                <>
                  <Link to="/login"
                    className="text-sm text-gray-300 hover:text-white transition-colors px-3 py-2">
                    Entrar
                  </Link>
                  <Link to="/login"
                    className="rounded-full bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition-colors">
                    Criar conta
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-5 pt-24 pb-20">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-medium text-cyan-300 mb-8">
          ✨ Sem código. Sem instalação.
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight max-w-3xl">
          Dê vida às suas histórias{' '}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-cyan-400 to-purple-400">
            com avatares 3D
          </span>
          {' '}que falam
        </h1>

        <p className="mt-6 text-lg text-gray-400 max-w-xl leading-relaxed">
          Crie personagens 3D, gere voz com IA, monte sequências de cenas e compartilhe com qualquer pessoa — tudo no navegador.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link to={primaryHref}
            className="inline-flex items-center justify-center rounded-2xl bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-blue-900/30 transition-all active:scale-95">
            {primaryLabel}
          </Link>
          <Link to={secondaryHref}
            className="inline-flex items-center justify-center rounded-2xl border-2 border-gray-700 hover:border-gray-500 px-8 py-4 text-base font-medium text-gray-300 hover:text-white transition-all active:scale-95">
            {secondaryLabel}
          </Link>
        </div>

        {/* Visual hint */}
        <div className="mt-16 grid grid-cols-3 gap-3 max-w-sm w-full">
          {['👤', '💬', '▶️'].map((icon, i) => (
            <div key={i}
              className="rounded-2xl border border-white/5 bg-white/3 backdrop-blur-sm py-6 flex flex-col items-center gap-2 text-2xl">
              {icon}
              <span className="text-[10px] text-gray-500 uppercase tracking-widest">
                {['Avatar', 'Fala', 'Play'][i]}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-cyan-400 mb-3">
            O que você pode fazer
          </p>
          <h2 className="text-center text-3xl font-bold mb-12">Tudo que você precisa, num só lugar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title}
                className="rounded-2xl border border-white/5 bg-gray-900 p-6 flex flex-col gap-3 hover:border-cyan-500/30 transition-colors">
                <span className="text-3xl">{f.icon}</span>
                <p className="font-semibold text-white">{f.title}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/5 bg-gray-900/40">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-purple-400 mb-3">
            Como funciona
          </p>
          <h2 className="text-center text-3xl font-bold mb-14">Pronto em 3 passos</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.n} className="flex flex-col items-center text-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-linear-to-br from-cyan-600 to-purple-700 flex items-center justify-center text-2xl shadow-lg shadow-purple-900/30">
                    {s.icon}
                  </div>
                  <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gray-950 border-2 border-cyan-500 text-[10px] font-bold text-cyan-400 flex items-center justify-center">
                    {s.n}
                  </span>
                </div>
                <p className="font-semibold text-lg">{s.title}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────────── */}
      <section className="py-24 px-5 border-t border-white/5 text-center">
        <div className="max-w-2xl mx-auto flex flex-col items-center gap-6">
          <span className="text-5xl">🎬</span>
          <h2 className="text-3xl font-bold">Pronto para começar?</h2>
          <p className="text-gray-400">Crie sua primeira cena em menos de 5 minutos — gratuitamente.</p>
          <Link to={primaryHref}
            className="inline-flex items-center justify-center rounded-2xl bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-10 py-4 text-base font-semibold text-white shadow-xl shadow-blue-900/30 transition-all active:scale-95">
            {primaryLabel}
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <span>© {new Date().getFullYear()} ContAR</span>
          <div className="flex gap-6">
            <Link to="/login" className="hover:text-gray-400 transition-colors">Entrar</Link>
            <Link to="/ar" className="hover:text-gray-400 transition-colors">AR</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
