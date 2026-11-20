import React from 'react';
import { CheckCircle2, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { ProgressRing } from './ProcessAnimation';

export type StepState = 'pending' | 'in-progress' | 'completed' | 'error';

export interface UninstallationStep {
  title: string;
  description: string;
  state: StepState;
}

interface ProgressDialogProps {
  isOpen: boolean;
  title: string;
  subtitle: string;
  steps: UninstallationStep[];
  currentStepIndex: number;
  onClose?: () => void;
  canClose?: boolean;
}

export const ProgressDialog: React.FC<ProgressDialogProps> = ({
  isOpen,
  title,
  subtitle,
  steps,
  currentStepIndex,
  onClose,
  canClose = false,
}) => {
  if (!isOpen) return null;

  const completedSteps = steps.filter((s) => s.state === 'completed').length;
  const progressPercent = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Animated Top Shimmer Accent */}
        <div className="h-1 w-full bg-surface relative overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary via-secondary to-primary transition-all duration-300 relative"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute inset-0 bg-white/30 animate-shimmer-wave" />
          </div>
        </div>

        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-surface/40 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary tracking-wide flex items-center space-x-2">
              <span>{title}</span>
            </h3>
            <p className="text-xs text-text-secondary mt-1">{subtitle}</p>
          </div>
          <ProgressRing progress={progressPercent} size={48} strokeWidth={4} />
        </div>

        {/* Steps */}
        <div className="p-6 space-y-3.5 max-h-[60vh] overflow-y-auto">
          {steps.map((step, idx) => {
            const isCurrent = idx === currentStepIndex;
            return (
              <div
                key={idx}
                className={`flex items-start space-x-3.5 p-3.5 rounded-xl border transition-all duration-200 relative overflow-hidden ${
                  isCurrent
                    ? 'bg-primary/10 border-primary/50 shadow-md shadow-primary/5'
                    : step.state === 'completed'
                    ? 'bg-surface/30 border-secondary/20 text-text-muted'
                    : 'bg-transparent border-transparent opacity-50'
                }`}
              >
                {/* Active step pulsing highlight */}
                {isCurrent && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary animate-pulse" />
                )}

                <div className="mt-0.5 relative flex-shrink-0">
                  {step.state === 'in-progress' && (
                    <div className="relative flex items-center justify-center">
                      <span className="absolute w-6 h-6 rounded-full bg-primary/20 animate-ping" />
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    </div>
                  )}
                  {step.state === 'completed' && (
                    <CheckCircle2 className="w-5 h-5 text-secondary" />
                  )}
                  {step.state === 'error' && (
                    <AlertCircle className="w-5 h-5 text-danger" />
                  )}
                  {step.state === 'pending' && (
                    <div className="w-5 h-5 rounded-full border border-border flex items-center justify-center text-[10px] text-text-muted font-mono">
                      {idx + 1}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p
                      className={`text-xs font-medium ${
                        isCurrent
                          ? 'text-text-primary font-bold'
                          : step.state === 'completed'
                          ? 'text-text-secondary'
                          : 'text-text-muted'
                      }`}
                    >
                      {step.title}
                    </p>
                    {isCurrent && (
                      <span className="text-[10px] text-primary font-mono font-semibold px-2 py-0.5 rounded bg-primary/10 border border-primary/20 animate-pulse">
                        Active Process
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5 truncate">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {canClose && onClose && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface/30">
            <span className="text-xs text-secondary flex items-center space-x-1.5 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>Safe operation finalized</span>
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl transition-all shadow-md"
            >
              Done &amp; Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
