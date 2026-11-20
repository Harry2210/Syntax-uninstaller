import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
}

interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const LEVEL_STYLES: Record<
  ToastItem['level'],
  { accent: string; icon: React.ReactNode; ring: string }
> = {
  success: {
    accent: 'text-secondary',
    ring: 'border-secondary/40',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  warning: {
    accent: 'text-warning',
    ring: 'border-warning/40',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  error: {
    accent: 'text-danger',
    ring: 'border-danger/40',
    icon: <AlertCircle className="w-4 h-4" />,
  },
  info: {
    accent: 'text-info',
    ring: 'border-info/40',
    icon: <Info className="w-4 h-4" />,
  },
};

/**
 * Global, non-blocking feedback. Every operation reported through
 * `addNotification` also surfaces here, so beginners always see whether the
 * thing they clicked actually worked.
 */
export const ToastStack: React.FC<ToastStackProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      className="fixed top-20 right-6 z-[80] flex flex-col space-y-2 w-[min(360px,calc(100vw-3rem))] pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const style = LEVEL_STYLES[toast.level];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto flex items-start space-x-3 p-3.5 rounded-xl bg-card/95 backdrop-blur-md border ${style.ring} shadow-card`}
            >
              <div className={`mt-0.5 ${style.accent}`}>{style.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-text-primary truncate">{toast.title}</p>
                <p className="text-[11px] text-text-secondary leading-snug mt-0.5 line-clamp-3">
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                className="p-1 -m-1 text-text-muted hover:text-text-primary rounded-md transition-colors"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
