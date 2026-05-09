import React, { useCallback, useEffect, useState } from 'react';

const TOUR_KEY = 'contar:tour-done';

const STEPS = [
  {
    id: 'welcome',
    target: null,
    title: 'Bem-vindo ao ContAR! 🎉',
    description:
      'Este é seu estúdio para criar narradores virtuais 3D interativos. Vamos fazer um tour rápido — menos de 2 minutos.',
  },
  {
    id: 'canvas',
    target: '[data-tour="scene-canvas"]',
    title: 'Palco 3D',
    description:
      'Aqui seu avatar é exibido em tempo real. Arraste para orbitar a câmera, scroll para dar zoom. O que você configura no painel reflete aqui instantaneamente.',
    prefer: 'left',
  },
  {
    id: 'left-panel',
    target: '[data-tour="left-panel"]',
    title: 'Painel de Criação',
    description:
      'Todo o controle da cena fica aqui. Está dividido em abas: Avatar, Fala, Cena e História.',
    prefer: 'right',
  },
  {
    id: 'tabs',
    target: '[data-tour="panel-tabs"]',
    title: 'Abas de Navegação',
    description:
      'Alterne entre as seções clicando nas abas. Cada uma trata de uma parte do fluxo de criação.',
    prefer: 'right',
  },
  {
    id: 'avatar-upload',
    target: '[data-tour="avatar-upload"]',
    title: 'Carregar Avatar',
    description:
      'Crie um avatar personalizado com o criador integrado, importe um arquivo GLB/VRM do seu computador, ou cole um link direto.',
    prefer: 'right',
  },
  {
    id: 'pose',
    target: '[data-tour="pose-selector"]',
    title: 'Pose do Narrador',
    description:
      'Escolha entre idle, palestrando, acenando, saudando e outras poses. Na pose "Speaker" o avatar faz gestos procedurais enquanto fala.',
    prefer: 'right',
  },
  {
    id: 'tab-fala',
    target: '[data-tour="tab-fala"]',
    title: 'Aba Fala',
    description:
      'Clique nesta aba para escrever o que o narrador vai dizer e gerar a voz com IA (TTS). Os lábios do avatar sincronizam automaticamente com o áudio.',
    prefer: 'right',
  },
  {
    id: 'tab-cena',
    target: '[data-tour="tab-cena"]',
    title: 'Aba Cena',
    description:
      'Dê um título e salve a configuração atual como uma cena. Uma história é composta por várias cenas em sequência.',
    prefer: 'right',
  },
  {
    id: 'tab-historia',
    target: '[data-tour="tab-historia"]',
    title: 'Aba História',
    description:
      'Organize suas cenas em uma história, publique e compartilhe o link com alunos ou colegas. Funciona em qualquer dispositivo.',
    prefer: 'right',
  },
  {
    id: 'ar-btn',
    target: '[data-tour="ar-btn"]',
    title: 'Realidade Aumentada',
    description:
      'Coloque seu narrador no mundo real pela câmera do celular — sem precisar instalar nenhum aplicativo.',
    prefer: 'bottom',
  },
  {
    id: 'done',
    target: null,
    title: 'Pronto para criar! ✨',
    description:
      'Você já conhece a interface. Comece carregando um avatar, escreva uma fala e salve a primeira cena. Clique no ícone ? ao lado de cada seção se tiver dúvidas.',
  },
];

export function shouldShowTour() {
  try { return !localStorage.getItem(TOUR_KEY); } catch { return false; }
}

function markDone() {
  try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* ignore */ }
}

const PAD = 14;
const TIP_W = 320;
const TIP_H = 200;

function computeTooltipStyle(spotlight, prefer, vw, vh) {
  if (!spotlight) {
    return {
      position: 'fixed',
      top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: Math.min(TIP_W, vw - 32),
    };
  }

  const { top, left, width, height } = spotlight;
  const styles = [];

  // prefer right
  if (prefer !== 'left' && left + width + PAD + TIP_W < vw) {
    styles.push({
      position: 'fixed',
      top: Math.max(16, Math.min(top + height / 2 - TIP_H / 2, vh - TIP_H - 16)),
      left: left + width + PAD,
      width: TIP_W,
    });
  }
  // prefer left
  if (!styles.length && left - PAD - TIP_W > 0) {
    styles.push({
      position: 'fixed',
      top: Math.max(16, Math.min(top + height / 2 - TIP_H / 2, vh - TIP_H - 16)),
      left: left - PAD - TIP_W,
      width: TIP_W,
    });
  }
  // below
  if (!styles.length && top + height + PAD + TIP_H < vh) {
    styles.push({
      position: 'fixed',
      top: top + height + PAD,
      left: Math.max(16, Math.min(left + width / 2 - TIP_W / 2, vw - TIP_W - 16)),
      width: TIP_W,
    });
  }
  // above
  if (!styles.length) {
    styles.push({
      position: 'fixed',
      bottom: vh - top + PAD,
      left: Math.max(16, Math.min(left + width / 2 - TIP_W / 2, vw - TIP_W - 16)),
      width: TIP_W,
    });
  }

  return styles[0];
}

export default function WalkthroughTour({ isOpen, onClose }) {
  const [step, setStep] = useState(0);
  const [spotlight, setSpotlight] = useState(null);
  const [dims, setDims] = useState({ vw: window.innerWidth, vh: window.innerHeight });

  const current = STEPS[step];

  const measure = useCallback(() => {
    setDims({ vw: window.innerWidth, vh: window.innerHeight });
    if (!current?.target) { setSpotlight(null); return; }
    const el = document.querySelector(current.target);
    if (!el) { setSpotlight(null); return; }
    const r = el.getBoundingClientRect();
    setSpotlight({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [current]);

  useEffect(() => {
    if (!isOpen) return;
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [isOpen, measure]);

  // Scroll target into view when step changes
  useEffect(() => {
    if (!isOpen || !current?.target) return;
    const el = document.querySelector(current.target);
    el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    const t = setTimeout(measure, 300);
    return () => clearTimeout(t);
  }, [isOpen, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => step < STEPS.length - 1 ? setStep((s) => s + 1) : close();
  const prev = () => step > 0 && setStep((s) => s - 1);
  const close = () => { markDone(); onClose?.(); };

  if (!isOpen) return null;

  const { vw, vh } = dims;
  const tipStyle = computeTooltipStyle(spotlight, current.prefer, vw, vh);

  return (
    <>
      {/* Dimmed overlay with spotlight hole */}
      <svg
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 9997, width: '100vw', height: '100vh' }}
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="none"
      >
        <defs>
          <mask id="tour-mask">
            <rect width={vw} height={vh} fill="white" />
            {spotlight && (
              <rect
                x={spotlight.left - PAD}
                y={spotlight.top - PAD}
                width={spotlight.width + PAD * 2}
                height={spotlight.height + PAD * 2}
                rx="10"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width={vw} height={vh} fill="rgba(0,0,0,0.72)" mask="url(#tour-mask)" />
      </svg>

      {/* Spotlight border glow */}
      {spotlight && (
        <div
          className="fixed pointer-events-none rounded-xl"
          style={{
            zIndex: 9998,
            top: spotlight.top - PAD,
            left: spotlight.left - PAD,
            width: spotlight.width + PAD * 2,
            height: spotlight.height + PAD * 2,
            boxShadow: '0 0 0 2px rgba(34,211,238,0.6), 0 0 24px 4px rgba(34,211,238,0.2)',
          }}
        />
      )}

      {/* Tooltip card */}
      <div style={{ ...tipStyle, zIndex: 9999 }} className="fixed rounded-2xl bg-gray-900 border border-cyan-700/60 shadow-2xl shadow-black/70 p-5 flex flex-col gap-3">
        {/* Progress dots */}
        <div className="flex gap-1.5 items-center">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-cyan-400' : 'w-1.5 bg-gray-600'}`}
            />
          ))}
          <span className="ml-auto text-[10px] text-gray-500">{step + 1}/{STEPS.length}</span>
        </div>

        <div>
          <p className="text-sm font-bold text-white leading-snug">{current.title}</p>
          <p className="mt-1 text-xs text-gray-300 leading-relaxed">{current.description}</p>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <button onClick={close} className="text-xs text-gray-500 hover:text-gray-300 transition-colors shrink-0">
            Pular tour
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={prev}
                className="px-3 py-1.5 rounded-lg border border-gray-600 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
              >
                ← Anterior
              </button>
            )}
            <button
              onClick={next}
              className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors"
            >
              {step === STEPS.length - 1 ? 'Começar! 🚀' : 'Próximo →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
