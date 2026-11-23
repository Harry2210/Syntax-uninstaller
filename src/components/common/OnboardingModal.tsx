import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles,
  ShieldCheck,
  Layers,
  Trash2,
  Zap,
  ArrowRight,
  ArrowLeft,
  X,
  MousePointerClick,
  Command,
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Slide {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: React.ReactNode;
}

/**
 * First-run walkthrough. Stored in localStorage so it appears exactly once.
 */
export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (isOpen) setIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, 3));
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const slides: Slide[] = [
    {
      icon: <Sparkles className="w-6 h-6" />,
      eyebrow: 'Welcome',
      title: 'Your PC, clean and fast — without the guesswork.',
      body: (
        <div className="space-y-3">
          <p>
            Syntax Uninstaller removes programs <span className="text-text-primary font-semibold">completely</span> —
            including the registry keys, leftover folders and startup entries that normal uninstallers leave behind.
          </p>
          <p>
            Every action is reversible: the app creates a restore point and a Registry backup{' '}
            <span className="text-text-primary font-semibold">before</span> it touches anything.
          </p>
        </div>
      ),
    },
    {
      icon: <MousePointerClick className="w-6 h-6" />,
      eyebrow: 'Finding your way',
      title: 'Six everyday buttons — and every other tool one click away.',
      body: (
        <div className="space-y-3">
          <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5">
            <p className="text-emerald-400 font-bold text-xs mb-1">Everyday care</p>
            <p className="text-[11px]">
              Smart Care, Uninstall Apps, Clean Junk Files, Speed Up PC, Update Software and Debloatware — each
              labelled with what it actually does.
            </p>
          </div>
          <div className="p-3 rounded-xl border border-primary/25 bg-primary/5">
            <p className="text-primary font-bold text-xs mb-1">All tools</p>
            <p className="text-[11px]">
              One searchable page holds everything else — batch uninstall, Hunter Mode, services, registry tools,
              backups. You can also press <span className="font-mono text-text-primary">Ctrl + K</span> anywhere.
            </p>
          </div>
        </div>
      ),
    },
    {
      icon: <Layers className="w-6 h-6" />,
      eyebrow: 'Everyday jobs',
      title: 'Three routines cover 90% of PC maintenance.',
      body: (
        <div className="space-y-2.5">
          <div className="flex items-start space-x-3">
            <div className="p-1.5 rounded-lg bg-primary/15 text-primary mt-0.5">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <p>
              <span className="text-text-primary font-semibold">Uninstall Apps</span> — remove software and let the
              leftover scanner find what it left behind.
            </p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="p-1.5 rounded-lg bg-secondary/15 text-secondary mt-0.5">
              <Trash2 className="w-3.5 h-3.5" />
            </div>
            <p>
              <span className="text-text-primary font-semibold">Clean Junk Files</span> — sweep temp caches to free
              disk space safely.
            </p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="p-1.5 rounded-lg bg-amber-400/15 text-amber-300 mt-0.5">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <p>
              <span className="text-text-primary font-semibold">Speed Up PC</span> — turn off unnecessary startup
              programs so Windows boots faster.
            </p>
          </div>
        </div>
      ),
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      eyebrow: 'Safety net',
      title: 'You always stay in control.',
      body: (
        <div className="space-y-3">
          <ul className="space-y-2">
            <li className="flex items-start space-x-2">
              <ShieldCheck className="w-3.5 h-3.5 text-secondary mt-0.5 flex-shrink-0" />
              <span>System folders like System32 and drive roots are hard-blocked from deletion.</span>
            </li>
            <li className="flex items-start space-x-2">
              <ShieldCheck className="w-3.5 h-3.5 text-secondary mt-0.5 flex-shrink-0" />
              <span>Destructive actions ask for confirmation and log an undo-ready backup.</span>
            </li>
            <li className="flex items-start space-x-2">
              <ShieldCheck className="w-3.5 h-3.5 text-secondary mt-0.5 flex-shrink-0" />
              <span>Everything you run is recorded in the Notification Center.</span>
            </li>
          </ul>

          <div className="flex items-center space-x-2 p-2.5 rounded-xl border border-border bg-surface/60">
            <Command className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-[11px]">
              Pro tip: press <span className="font-mono text-text-primary">Ctrl + K</span> anywhere to jump straight to
              any tool.
            </span>
          </div>
        </div>
      ),
    },
  ];

  const slide = slides[index];
  const isLast = index === slides.length - 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Welcome tour"
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg rounded-2xl border border-border bg-sidebar shadow-2xl overflow-hidden"
          >
            <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-primary/20 via-transparent to-secondary/10">
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
                aria-label="Close tour"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30">
                  {slide.icon}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary/90">
                  {slide.eyebrow}
                </span>
              </div>

              <h2 className="mt-3 text-base font-bold text-text-primary leading-snug">{slide.title}</h2>
            </div>

            <div className="px-6 py-5 text-[12px] text-text-secondary leading-relaxed min-h-[188px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                >
                  {slide.body}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="px-6 pb-5 flex items-center justify-between border-t border-border/60 pt-4">
              <div className="flex items-center space-x-1.5">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    aria-label={`Go to step ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index ? 'w-6 bg-primary' : 'w-1.5 bg-border hover:bg-text-muted'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center space-x-2">
                {index > 0 && (
                  <button
                    onClick={() => setIndex((i) => i - 1)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-text-secondary hover:text-text-primary hover:bg-surface border border-border transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Back</span>
                  </button>
                )}

                {isLast ? (
                  <button
                    onClick={onClose}
                    className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-[11px] font-bold bg-primary hover:bg-primary-hover text-white shadow-glow-primary transition-all hover:scale-[1.03] active:scale-95"
                  >
                    <span>Start using Syntax</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ) : (
                  <button
                    onClick={() => setIndex((i) => i + 1)}
                    className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-[11px] font-bold bg-primary hover:bg-primary-hover text-white shadow-glow-primary transition-all hover:scale-[1.03] active:scale-95"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
