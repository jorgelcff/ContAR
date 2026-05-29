import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SCENE_TEMPLATES } from '../data/sceneTemplates';
import { useSceneStore } from '../store/useSceneStore';
import Icon from '../components/ui/Icon';

const ONBOARDING_KEY = 'avaturn:onboarding:done';

function applyTemplate(template, store) {
  store.setPosePreset(template.posePreset);
  store.setSceneTitle(template.sceneTitle);
  store.setSpeechText(template.speechText);
}

export default function WelcomePage() {
  const navigate = useNavigate();
  const [showTemplates, setShowTemplates] = useState(false);

  const handleNewScene = () => {
    navigate('/editor');
  };

  const handleUseTemplate = (template) => {
    applyTemplate(template, useSceneStore.getState());
    navigate('/editor');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center flex-1 px-6 pt-16 pb-8 text-center">
        <Icon name="theater" className="w-16 h-16 mb-6 text-cyan-400" />

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Bem-vindo ao{' '}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-cyan-400 to-purple-400">
            ContAR
          </span>
        </h1>

        <p className="text-gray-400 text-lg md:text-xl max-w-xl mb-10 leading-relaxed">
          Crie vídeos com personagens 3D que falam, se movem e contam histórias —
          sem precisar saber nada de tecnologia.
        </p>

        {/* ── CTAs principais ────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <button
            onClick={handleNewScene}
            className="flex-1 py-4 px-6 rounded-2xl bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-lg font-semibold shadow-lg shadow-blue-900/40 transition-all duration-200 active:scale-95"
          >
            <span className="inline-flex items-center gap-2"><Icon name="sparkles" className="w-5 h-5" /> Criar nova cena</span>
          </button>
          <button
            onClick={() => setShowTemplates((v) => !v)}
            className="flex-1 py-4 px-6 rounded-2xl border-2 border-gray-600 hover:border-gray-400 text-gray-200 hover:text-white text-lg font-semibold transition-all duration-200 active:scale-95"
          >
            <span className="inline-flex items-center gap-2"><Icon name="folder" className="w-5 h-5" /> Usar template</span>
          </button>
        </div>

        {/* ── Como funciona ──────────────────────────────── */}
        {!showTemplates && (
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl w-full text-left">
            {[
              { step: '1', icon: 'avatar', title: 'Escolha um avatar', desc: 'Crie seu personagem 3D gratuitamente com o criador integrado.' },
              { step: '2', icon: 'speech', title: 'Escreva a fala', desc: 'Digite o texto e gere a voz com um clique.' },
              { step: '3', icon: 'play', title: 'Pronto!', desc: 'Seu personagem fala com lábios sincronizados automaticamente.' },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} className="rounded-2xl bg-gray-800/60 border border-gray-700 p-5 flex flex-col gap-2">
                <Icon name={icon} className="w-6 h-6 text-cyan-400" />
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest">Passo {step}</p>
                <p className="font-semibold text-white">{title}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Templates ─────────────────────────────────────── */}
      {showTemplates && (
        <div className="px-6 pb-16">
          <h2 className="text-xl font-bold text-center mb-6 text-gray-200">
            Escolha um ponto de partida
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {SCENE_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => handleUseTemplate(tpl)}
                className={`rounded-2xl bg-linear-to-br ${tpl.color} border border-white/10 p-6 flex flex-col gap-3 text-left hover:scale-[1.03] hover:shadow-xl transition-all duration-200 active:scale-100`}
              >
                <Icon name={tpl.icon} className="w-9 h-9 text-white" />
                <div>
                  <p className="font-bold text-white text-lg">{tpl.name}</p>
                  <p className="text-sm text-white/70 mt-1 leading-relaxed">{tpl.description}</p>
                </div>
                <div className="mt-auto">
                  <span className={`inline-block text-xs font-semibold text-white px-3 py-1 rounded-full ${tpl.accent} bg-opacity-80`}>
                    Usar este template →
                  </span>
                </div>
              </button>
            ))}
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            Você ainda precisará adicionar seu avatar após entrar no editor.
          </p>
        </div>
      )}

    </div>
  );
}
