import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * TransformControls — simplified sliders for position, rotation and scale.
 *
 * Props:
 *   transform        – current transform object
 *   onUpdate(key, v) – called on any change
 */
export default function TransformControls({ transform, onUpdate, onReset }) {
  const { t } = useTranslation();

  const slider = (label, key, min, max, step = 0.05) => (
    <div key={key} className="flex flex-col gap-1">
      <div className="flex justify-between items-center text-xs text-gray-400">
        <span>{label}</span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number(transform[key]).toFixed(2)}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onUpdate(key, Math.min(max, Math.max(min, v)));
          }}
          className="w-20 rounded bg-gray-800 border border-gray-600 text-white font-mono text-xs px-1.5 py-0.5 text-right focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={transform[key]}
        onChange={(e) => onUpdate(key, parseFloat(e.target.value))}
        className="w-full accent-blue-500 cursor-pointer"
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          {t('transform')}
        </p>
        {onReset && (
          <button
            onClick={onReset}
            className="text-[10px] text-gray-500 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-800"
          >
            Limpar
          </button>
        )}
      </div>
      {slider(t('positionX'), 'positionX', -5, 5)}
      {slider(t('positionY'), 'positionY', -2, 2)}
      {slider(t('positionZ'), 'positionZ', -5, 5)}
      {slider(t('rotationX'), 'rotationX', -180, 180, 1)}
      {slider(t('rotationY'), 'rotationY', -180, 180, 1)}
      {slider(t('rotationZ'), 'rotationZ', -180, 180, 1)}
      {slider(t('scale'), 'scale', 0.2, 3, 0.05)}
    </div>
  );
}
