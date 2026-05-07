import React from 'react';

const STEPS = [
  { key: 'avatar',  label: 'Avatar',  icon: '👤' },
  { key: 'fala',    label: 'Fala',    icon: '💬' },
  { key: 'audio',   label: 'Áudio',   icon: '🔊' },
  { key: 'salva',   label: 'Salvo',   icon: '💾' },
];

export default function SceneProgressBar({ avatarUrl, speechText, audioUrl, sceneId, onTabChange }) {
  const done = {
    avatar: Boolean(avatarUrl),
    fala:   Boolean(speechText),
    audio:  Boolean(audioUrl),
    salva:  Boolean(sceneId),
  };

  const TAB_BY_STEP = { avatar: 'avatar', fala: 'fala', audio: 'fala', salva: 'cena' };

  return (
    <div className="flex items-center px-3 py-2 border-b border-gray-700 bg-gray-850">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.key}>
          <button
            onClick={() => onTabChange?.(TAB_BY_STEP[step.key])}
            title={done[step.key] ? `${step.label} — concluído` : `${step.label} — pendente`}
            className="flex flex-col items-center gap-0.5 flex-1 group"
          >
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full text-sm transition-all duration-300 ${
                done[step.key]
                  ? 'bg-cyan-500 text-white shadow-md shadow-cyan-900/40'
                  : 'bg-gray-700 text-gray-500 group-hover:bg-gray-600'
              }`}
            >
              {done[step.key] ? '✓' : step.icon}
            </span>
            <span className={`text-[10px] font-medium transition-colors ${done[step.key] ? 'text-cyan-400' : 'text-gray-500'}`}>
              {step.label}
            </span>
          </button>

          {i < STEPS.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1 rounded-full transition-all duration-500 ${
              done[STEPS[i].key] && done[STEPS[i + 1].key]
                ? 'bg-cyan-500'
                : done[STEPS[i].key]
                ? 'bg-linear-to-r from-cyan-500 to-gray-600'
                : 'bg-gray-700'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
