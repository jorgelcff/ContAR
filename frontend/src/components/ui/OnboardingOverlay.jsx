import React, { useState } from 'react';

const ONBOARDING_KEY = 'avaturn:onboarding:done';

const STEPS = [
  {
    icon: '👤',
    title: 'Primeiro, escolha um avatar',
    description:
      'Clique em "Abrir Avaturn" no painel à esquerda para criar ou escolher seu personagem 3D. Você pode usar uma selfie para gerar um avatar parecido com você!',
    hint: 'Painel esquerdo → aba Avatar → "Abrir Avaturn"',
    hintIcon: '👈',
  },
  {
    icon: '💬',
    title: 'Escreva o que o avatar vai dizer',
    description:
      'No painel à esquerda, clique na aba "Fala" e digite o texto no campo de texto. Em seguida, clique em "Gerar Voz (TTS)" — a voz é criada automaticamente!',
    hint: 'Painel esquerdo → aba Fala → "Gerar Voz (TTS)"',
    hintIcon: '👈',
  },
  {
    icon: '▶️',
    title: 'Veja a mágica acontecer!',
    description:
      'Clique no botão Play na seção de Áudio para ouvir seu personagem falar com os lábios sincronizados. Quando estiver pronto, salve e compartilhe sua cena!',
    hint: 'Painel esquerdo → Áudio → botão Play',
    hintIcon: '👈',
  },
];

export default function OnboardingOverlay({ onDone }) {
  const [step, setStep] = useState(0);

  const finish = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    onDone?.();
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-md bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl p-8 flex flex-col gap-6">

        {/* Pular */}
        <button
          onClick={finish}
          className="absolute top-5 right-5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Pular →
        </button>

        {/* Ícone e título */}
        <div className="flex flex-col items-center text-center gap-3">
          <span className="text-6xl leading-none">{current.icon}</span>
          <h2 className="text-xl font-bold text-white">{current.title}</h2>
          <p className="text-gray-400 text-sm leading-relaxed">{current.description}</p>
        </div>

        {/* Dica de onde clicar */}
        <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-4 py-3 border border-gray-700">
          <span className="text-lg">{current.hintIcon}</span>
          <span className="text-xs text-cyan-300 font-medium">{current.hint}</span>
        </div>

        {/* Indicadores de passo */}
        <div className="flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-6 bg-cyan-400'
                  : i < step
                  ? 'w-2 bg-cyan-700'
                  : 'w-2 bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Botões */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 py-3 rounded-xl border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white text-sm font-medium transition-all"
            >
              ← Anterior
            </button>
          )}
          <button
            onClick={next}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold transition-all active:scale-95 shadow-lg shadow-blue-900/30"
          >
            {isLast ? '🚀 Começar!' : 'Próximo →'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function shouldShowOnboarding() {
  return !localStorage.getItem(ONBOARDING_KEY);
}
