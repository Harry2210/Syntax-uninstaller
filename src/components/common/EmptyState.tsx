import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = Inbox,
  actionText,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-xl bg-card/40 my-4">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-primary to-secondary text-white mb-4 shadow-lg shadow-primary/25">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      <p className="text-xs text-text-secondary max-w-sm mt-1">{description}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-primary to-secondary hover:opacity-95 rounded-lg shadow-md shadow-primary/25 transition-all hover:scale-[1.02] active:scale-95"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
