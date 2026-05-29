import React from 'react';
import Icon from './Icon';

const TABS = [
  { id: 'avatar',   label: 'Avatar',   icon: 'avatar' },
  { id: 'fala',     label: 'Fala',     icon: 'speech' },
  { id: 'cena',     label: 'Cena',     icon: 'scene' },
  { id: 'historia', label: 'História', icon: 'story' },
];

/**
 * BottomNav — mobile-only tab bar fixed at the bottom of the screen.
 * Tapping an active tab closes the drawer (passes null); tapping another opens it.
 */
export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-gray-900 border-t border-gray-700 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(isActive ? null : tab.id)}
            className={`relative flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors active:bg-gray-800 ${
              isActive ? 'text-cyan-400' : 'text-gray-500'
            }`}
          >
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-cyan-400 rounded-full" />
            )}
            <Icon
              name={tab.icon}
              className={`w-5 h-5 transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}
            />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
