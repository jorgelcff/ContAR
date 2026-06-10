import React, { createContext, useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext(null);

const CheckIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0"><path d="M20 6 9 17l-5-5"/></svg>;
const XIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0"><path d="M18 6 6 18M6 6l12 12"/></svg>;
const InfoIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>;
const WarnIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg>;

const TYPE = {
  success: { bar: 'bg-emerald-400', Icon: CheckIcon, iconCls: 'text-emerald-400', text: 'text-emerald-100', bg: 'bg-gray-900 border-emerald-700/60' },
  error:   { bar: 'bg-red-400',     Icon: XIcon,     iconCls: 'text-red-400',     text: 'text-red-100',     bg: 'bg-gray-900 border-red-700/60'     },
  info:    { bar: 'bg-blue-400',    Icon: InfoIcon,  iconCls: 'text-blue-400',    text: 'text-blue-100',    bg: 'bg-gray-900 border-blue-700/60'    },
  warning: { bar: 'bg-amber-400',   Icon: WarnIcon,  iconCls: 'text-amber-400',   text: 'text-amber-100',   bg: 'bg-gray-900 border-amber-700/60'   },
};

function ToastItem({ toast, onRemove }) {
  const s = TYPE[toast.type] || TYPE.info;
  return (
    <div
      role="alert"
      className={`relative flex items-start gap-3 w-80 rounded-xl border shadow-2xl px-4 py-3 overflow-hidden ${s.bg}`}
      style={{ animation: 'toast-in 0.22s ease-out' }}
    >
      {/* coloured progress bar */}
      <div
        className={`absolute bottom-0 left-0 h-0.5 ${s.bar}`}
        style={{ width: '100%', animation: `toast-bar ${toast.duration}ms linear forwards` }}
      />
      <span className={`mt-0.5 ${s.iconCls}`}><s.Icon /></span>
      <p className={`flex-1 text-sm leading-snug ${s.text}`}>{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 text-gray-500 hover:text-gray-300 text-lg leading-none transition-colors"
        aria-label="Fechar"
      >
        ×
      </button>
    </div>
  );
}

function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;
  return createPortal(
    <>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(100%); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes toast-bar {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={onRemove} />
          </div>
        ))}
      </div>
    </>,
    document.body
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return ctx;
}
