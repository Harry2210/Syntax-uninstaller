import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  delayMs?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'bottom',
  className = '',
  delayMs = 120,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(() => setIsVisible(true), delayMs);
  }, [clearTimer, delayMs]);

  const hide = useCallback(() => {
    clearTimer();
    setIsVisible(false);
  }, [clearTimer]);

  // BUGFIX: the pending show-timer was never cleared on unmount, so every
  // tooltip that mounted and unmounted quickly (list scrolling) leaked one
  // pending callback and could set state on an unmounted component.
  useEffect(() => clearTimer, [clearTimer]);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const initialMotion = {
    top: { opacity: 0, scale: 0.92, y: 4 },
    bottom: { opacity: 0, scale: 0.92, y: -4 },
    left: { opacity: 0, scale: 0.92, x: 4 },
    right: { opacity: 0, scale: 0.92, x: -4 },
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      // Keyboard users get the same hints as mouse users.
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}

      <AnimatePresence>
        {isVisible && content && (
          <motion.div
            initial={initialMotion[position]}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            role="tooltip"
            className={`absolute z-50 pointer-events-none select-none px-2.5 py-1 rounded-lg bg-card border border-border text-text-primary text-[11px] font-medium shadow-2xl backdrop-blur-md whitespace-nowrap flex items-center space-x-1.5 ${positionClasses[position]}`}
          >
            <span>{content}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
