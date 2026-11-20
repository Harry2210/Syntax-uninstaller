import React from 'react';
import { LucideIcon } from 'lucide-react';
import { CounterValue } from './CounterValue';

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  accent?: 'primary' | 'secondary' | 'info' | 'warning' | 'danger';
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  trendUp,
  accent = 'primary',
  onClick,
  className = '',
}) => {
  const accentBorderColors = {
    primary: 'border-l-primary group-hover:border-primary',
    secondary: 'border-l-secondary group-hover:border-secondary',
    info: 'border-l-info group-hover:border-info',
    warning: 'border-l-warning group-hover:border-warning',
    danger: 'border-l-danger group-hover:border-danger',
  };

  const hoverGlowStyles = {
    primary: 'group-hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5),0_0_20px_-3px_rgba(124,92,252,0.3)] group-hover:border-primary/40',
    secondary: 'group-hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5),0_0_20px_-3px_rgba(34,199,169,0.3)] group-hover:border-secondary/40',
    info: 'group-hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5),0_0_20px_-3px_rgba(77,163,255,0.3)] group-hover:border-info/40',
    warning: 'group-hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5),0_0_20px_-3px_rgba(245,185,66,0.3)] group-hover:border-warning/40',
    danger: 'group-hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5),0_0_20px_-3px_rgba(240,100,100,0.3)] group-hover:border-danger/40',
  };

  const iconColors = {
    primary: 'text-primary bg-primary/10 group-hover:bg-primary/20 group-hover:text-primary',
    secondary: 'text-secondary bg-secondary/10 group-hover:bg-secondary/20 group-hover:text-secondary',
    info: 'text-info bg-info/10 group-hover:bg-info/20 group-hover:text-info',
    warning: 'text-warning bg-warning/10 group-hover:bg-warning/20 group-hover:text-warning',
    danger: 'text-danger bg-danger/10 group-hover:bg-danger/20 group-hover:text-danger',
  };

  return (
    <div
      onClick={onClick}
      className={`group relative bg-card border border-border rounded-xl p-4 transition-all duration-200 ease-out hover:-translate-y-1 hover:bg-surface border-l-4 ${accentBorderColors[accent]} ${hoverGlowStyles[accent]} ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider truncate">{title}</p>
          <div className="flex items-baseline mt-2">
            <span className="text-2xl font-bold text-text-primary tracking-tight font-mono">
              <CounterValue value={value} duration={1100} />
            </span>
            {subValue && (
              <span className="ml-2 text-xs text-text-muted truncate">{subValue}</span>
            )}
          </div>
          {trend && (
            <p className={`text-xs mt-1 font-medium ${trendUp ? 'text-secondary' : 'text-danger'}`}>
              {trendUp ? '↑' : '↓'} {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconColors[accent]} transition-all duration-300 group-hover:scale-110 flex-shrink-0 shadow-sm`}>
          <Icon className="w-5 h-5 transition-transform duration-300 group-hover:rotate-3" />
        </div>
      </div>
    </div>
  );
};
