import React from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';

const STEP_KEYS = [
  { key: 'avatar', labelKey: 'stepAvatar', icon: 'avatar' },
  { key: 'fala',   labelKey: 'stepFala',   icon: 'speech' },
  { key: 'audio',  labelKey: 'stepAudio',  icon: 'audio' },
  { key: 'salva',  labelKey: 'stepSalvo',  icon: 'save' },
];

export default function SceneProgressBar({ avatarUrl, speechText, audioUrl, sceneId, onTabChange }) {
  const { t } = useTranslation();
  const steps = STEP_KEYS.map((s) => ({ ...s, label: t(s.labelKey) }));

  const done = {
    avatar: Boolean(avatarUrl),
    fala:   Boolean(speechText),
    audio:  Boolean(audioUrl),
    salva:  Boolean(sceneId),
  };

  const TAB_BY_STEP = { avatar: 'avatar', fala: 'fala', audio: 'fala', salva: 'cena' };

  return (
    <div className="flex items-center px-3 py-2 border-b border-gray-700 bg-gray-850">
      {steps.map((step, i) => (
        <React.Fragment key={step.key}>
          <button
            onClick={() => onTabChange?.(TAB_BY_STEP[step.key])}
            title={done[step.key] ? `${step.label} — ${t('stepDone')}` : `${step.label} — ${t('stepPending')}`}
            className="flex flex-col items-center gap-0.5 flex-1 group"
          >
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full text-sm transition-all duration-300 ${
                done[step.key]
                  ? 'bg-cyan-500 text-white shadow-md shadow-cyan-900/40'
                  : 'bg-gray-700 text-gray-500 group-hover:bg-gray-600'
              }`}
            >
              {done[step.key] ? <Icon name="check" className="w-4 h-4" /> : <Icon name={step.icon} className="w-4 h-4" />}
            </span>
            <span className={`text-[10px] font-medium transition-colors ${done[step.key] ? 'text-cyan-400' : 'text-gray-500'}`}>
              {step.label}
            </span>
          </button>

          {i < steps.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1 rounded-full transition-all duration-500 ${
              done[steps[i].key] && done[steps[i + 1].key]
                ? 'bg-cyan-500'
                : done[steps[i].key]
                ? 'bg-linear-to-r from-cyan-500 to-gray-600'
                : 'bg-gray-700'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
