import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const TOUR_KEY = 'contar:tour-done';

function getSteps(t) {
  return [
    { id: 'welcome',       target: null,                           prefer: undefined, title: t('tourStep0Title'),  description: t('tourStep0Desc') },
    { id: 'canvas',        target: '[data-tour="scene-canvas"]',  prefer: 'left',    title: t('tourStep1Title'),  description: t('tourStep1Desc') },
    { id: 'left-panel',    target: '[data-tour="left-panel"]',    prefer: 'right',   title: t('tourStep2Title'),  description: t('tourStep2Desc') },
    { id: 'tabs',          target: '[data-tour="panel-tabs"]',    prefer: 'right',   title: t('tourStep3Title'),  description: t('tourStep3Desc') },
    { id: 'avatar-upload', target: '[data-tour="avatar-upload"]', prefer: 'right',   title: t('tourStep4Title'),  description: t('tourStep4Desc') },
    { id: 'pose',          target: '[data-tour="pose-selector"]', prefer: 'right',   title: t('tourStep5Title'),  description: t('tourStep5Desc') },
    { id: 'tab-fala',      target: '[data-tour="tab-fala"]',      prefer: 'right',   title: t('tourStep6Title'),  description: t('tourStep6Desc') },
    { id: 'tab-cena',      target: '[data-tour="tab-cena"]',      prefer: 'right',   title: t('tourStep7Title'),  description: t('tourStep7Desc') },
    { id: 'tab-historia',  target: '[data-tour="tab-historia"]',  prefer: 'right',   title: t('tourStep8Title'),  description: t('tourStep8Desc') },
    { id: 'ar-btn',        target: '[data-tour="ar-btn"]',        prefer: 'bottom',  title: t('tourStep9Title'),  description: t('tourStep9Desc') },
    { id: 'done',          target: null,                           prefer: undefined, title: t('tourStep10Title'), description: t('tourStep10Desc') },
  ];
}

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
  const { t } = useTranslation();
  const STEPS = getSteps(t);

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
          <span className="ml-auto text-[10px] text-gray-500">{t('tourProgress', { current: step + 1, total: STEPS.length })}</span>
        </div>

        <div>
          <p className="text-sm font-bold text-white leading-snug">{current.title}</p>
          <p className="mt-1 text-xs text-gray-300 leading-relaxed">{current.description}</p>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <button onClick={close} className="text-xs text-gray-500 hover:text-gray-300 transition-colors shrink-0">
            {t('tourSkip')}
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={prev}
                className="px-3 py-1.5 rounded-lg border border-gray-600 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
              >
                {t('tourPrev')}
              </button>
            )}
            <button
              onClick={next}
              className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors"
            >
              {step === STEPS.length - 1 ? t('tourStart') : t('tourNext')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
