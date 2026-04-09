import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * TransformControls — simplified sliders for position, rotation and scale.
 *
 * Props:
 *   transform        – current transform object
 *   onUpdate(key, v) – called on any change
 */
export default function TransformControls({ transform, onUpdate }) {
  const { t } = useTranslation();

  const slider = (label, key, min, max, step = 0.05) => (
    <div key={key} className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="font-mono">{Number(transform[key]).toFixed(2)}</span>
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
      <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
        {t('transform')}
      </p>
      {slider(t('positionX'), 'positionX', -5, 5)}
      {slider(t('positionY'), 'positionY', -2, 2)}
      {slider(t('positionZ'), 'positionZ', -5, 5)}
      {slider(t('rotationY'), 'rotationY', -180, 180, 1)}
      {slider(t('scale'), 'scale', 0.2, 3, 0.05)}
    </div>
  );
}
