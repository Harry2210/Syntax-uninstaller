import React from 'react';

interface StatusBadgeProps {
  status: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant }) => {
  let resolvedVariant = variant;
  const s = status.toLowerCase();

  if (!resolvedVariant) {
    if (s.includes('running') || s.includes('healthy') || s.includes('enabled') || s.includes('safe') || s.includes('ready')) {
      resolvedVariant = 'success';
    } else if (s.includes('manual') || s.includes('moderate') || s.includes('warning')) {
      resolvedVariant = 'warning';
    } else if (s.includes('stopped') || s.includes('disabled') || s.includes('danger') || s.includes('missing') || s.includes('advanced')) {
      resolvedVariant = 'danger';
    } else {
      resolvedVariant = 'info';
    }
  }

  const colorMap = {
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    danger: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    info: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    neutral: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorMap[resolvedVariant]}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
        resolvedVariant === 'success' ? 'bg-emerald-400' :
        resolvedVariant === 'warning' ? 'bg-amber-400' :
        resolvedVariant === 'danger' ? 'bg-rose-400' : 'bg-blue-400'
      }`} />
      {status}
    </span>
  );
};
