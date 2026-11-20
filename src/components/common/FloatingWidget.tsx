import React, { useState } from 'react';
import { PageId, SystemSpecs } from '../../types';
import {
  Crosshair,
  Trash2,
  Cpu,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  Zap,
  Activity,
} from 'lucide-react';

interface FloatingWidgetProps {
  specs: SystemSpecs | null;
  onNavigate: (page: PageId) => void;
  onQuickClean?: () => void;
}

export const FloatingWidget: React.FC<FloatingWidgetProps> = ({
  specs,
  onNavigate,
  onQuickClean,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const ramUsedGb = specs ? (specs.used_ram_mb / 1024).toFixed(1) : '6.8';
  const ramTotalGb = specs ? (specs.total_ram_mb / 1024).toFixed(0) : '16';
  const ramPercent = specs && specs.total_ram_mb > 0
    ? Math.round((specs.used_ram_mb / specs.total_ram_mb) * 100)
    : 44;

  return (
    <div className="fixed bottom-6 right-6 z-50 select-none">
      {!isOpen ? (
        /* Collapsed Floating Pill */
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2.5 px-3.5 py-2 bg-card/90 hover:bg-card border border-primary/30 hover:border-primary/60 rounded-full shadow-2xl backdrop-blur-xl transition-all duration-300 hover:scale-105 group"
          title="Open Syntax Pro Mini Barometer"
        >
          <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary group-hover:rotate-12 transition-transform">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex items-center space-x-2 text-xs font-semibold">
            <span className="text-text-secondary">RAM</span>
            <span className="text-accent-secondary font-mono">{ramPercent}%</span>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-accent-secondary animate-pulse" />
        </button>
      ) : (
        /* Expanded Floating Card */
        <div className="w-72 bg-card/95 border border-primary/30 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl animate-scale-in">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-text-primary tracking-tight">
                Syntax Desktop Barometer
              </span>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-text-muted hover:text-text-primary rounded-lg transition-colors"
                title="Minimize widget"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsDismissed(true)}
                className="p-1 text-text-muted hover:text-red-400 rounded-lg transition-colors"
                title="Dismiss widget"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Real-time Hardware Metrics */}
          <div className="py-3 space-y-3">
            <div>
              <div className="flex justify-between text-[11px] font-medium text-text-muted mb-1">
                <span>RAM Usage</span>
                <span className="text-accent-secondary font-mono font-bold">
                  {ramUsedGb} GB / {ramTotalGb} GB ({ramPercent}%)
                </span>
              </div>
              <div className="w-full bg-surface h-2 rounded-full overflow-hidden border border-border/40">
                <div
                  className="bg-gradient-to-r from-primary to-accent-secondary h-full rounded-full transition-all duration-500"
                  style={{ width: `${ramPercent}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-medium text-text-muted mb-1">
                <span>CPU Active</span>
                <span className="text-primary font-mono font-bold">
                  {specs?.cpu_name ? specs.cpu_name.slice(0, 18) : 'Multi-Core Active'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
            <button
              onClick={() => {
                onNavigate('hunter-mode');
                setIsOpen(false);
              }}
              className="flex items-center justify-center space-x-1.5 px-2.5 py-1.5 bg-surface hover:bg-surface/80 border border-border rounded-xl text-[11px] font-semibold text-text-primary transition-all hover:border-accent-secondary/40"
            >
              <Crosshair className="w-3.5 h-3.5 text-accent-secondary" />
              <span>Hunter Mode</span>
            </button>

            <button
              onClick={() => {
                onNavigate('junk-cleaner');
                setIsOpen(false);
              }}
              className="flex items-center justify-center space-x-1.5 px-2.5 py-1.5 bg-surface hover:bg-surface/80 border border-border rounded-xl text-[11px] font-semibold text-text-primary transition-all hover:border-red-400/40"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Clean Junk</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
