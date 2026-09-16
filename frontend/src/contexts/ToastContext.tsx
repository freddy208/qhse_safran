import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'error' | 'success' | 'warning';
interface Toast { id: number; type: ToastType; message: string; }

interface ToastCtx {
  error:   (msg: string) => void;
  success: (msg: string) => void;
  warning: (msg: string) => void;
}

const ToastContext = createContext<ToastCtx | null>(null);

let nextId = 0;

const BG: Record<ToastType, string> = {
  error:   '#dc2626',
  success: '#16a34a',
  warning: '#d97706',
};

const ICON: Record<ToastType, string> = {
  error:   '✕',
  success: '✓',
  warning: '⚠',
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      background: BG[toast.type], color: '#fff',
      padding: '12px 16px', borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      fontSize: 14, fontWeight: 500, maxWidth: 380,
      animation: 'fadeInRight 0.2s ease',
    }}>
      <span style={{ fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{ICON[toast.type]}</span>
      <span style={{ flex: 1, lineHeight: 1.45 }}>{toast.message}</span>
      <button onClick={onClose} style={{
        background: 'rgba(255,255,255,0.25)', border: 'none', color: '#fff',
        borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 12,
        flexShrink: 0, marginTop: 1,
      }}>✕</button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((type: ToastType, message: string) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => remove(id), 5000);
  }, []);

  const remove = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const ctx: ToastCtx = {
    error:   (msg) => add('error',   msg),
    success: (msg) => add('success', msg),
    warning: (msg) => add('warning', msg),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        display: 'flex', flexDirection: 'column', gap: 10,
        zIndex: 9999, pointerEvents: 'none',
      }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={t} onClose={() => remove(t.id)} />
          </div>
        ))}
      </div>
      <style>{`
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
