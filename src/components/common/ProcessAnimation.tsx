import React from 'react';
import { SearchCheck } from 'lucide-react';

interface ScanningRadarProps {
  label?: string;
  sublabel?: string;
  className?: string;
}

/**
 * Calm scan status panel.
 *
 * This used to be a rotating radar dish with pinging blips and a laser sweep.
 * Feedback during a scan should be quiet: a plain status line and, when the
 * caller knows it, a determinate progress bar. No looping motion.
 */
export const ScanningRadar: React.FC<ScanningRadarProps> = ({
  label = 'Scanning…',
  sublabel = 'Reading the registry and file system',
  className = '',
}) => {
  return (
    <div
      className={`flex items-center space-x-3 p-4 rounded-xl border border-border bg-surface/60 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary flex-shrink-0">
        <SearchCheck className="w-4 h-4" />
      </div>
      <div className="min-w-0 text-left">
        <p className="text-xs font-semibold text-text-primary truncate">{label}</p>
        <p className="text-[11px] text-text-muted truncate">{sublabel}</p>
      </div>
    </div>
  );
};

interface LaserScanlineProps {
  active: boolean;
}

/**
 * Intentionally renders nothing. The sweeping laser line across a panel was
 * pure decoration and made long operations feel busy.
 */
export const LaserScanline: React.FC<LaserScanlineProps> = () => null;

interface ProgressRingProps {
  progress: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 64,
  strokeWidth = 6,
  color = '#7C5CFC',
  label,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgb(var(--c-border) / 0.5)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs font-mono font-bold text-text-primary">{Math.round(progress)}%</span>
        {label && <span className="text-[9px] text-text-muted">{label}</span>}
      </div>
    </div>
  );
};
