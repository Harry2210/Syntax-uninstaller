import React, { useState } from 'react';
import { AlertTriangle, X, ShieldAlert } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  details?: string[];
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isDanger?: boolean;
  requireCheckbox?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  details = [],
  confirmText,
  confirmLabel,
  cancelText = 'Cancel',
  isDangerous,
  isDanger,
  requireCheckbox = false,
  onConfirm,
  onCancel,
}) => {
  const [confirmed, setConfirmed] = useState(false);
  const dangerous = Boolean(isDangerous || isDanger);
  const actionText = confirmLabel || confirmText || 'Proceed';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/50">
          <div className="flex items-center space-x-3">
            {dangerous ? (
              <div className="p-2 bg-danger/10 border border-danger/30 rounded-lg text-danger">
                <ShieldAlert className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 bg-warning/10 border border-warning/30 rounded-lg text-warning">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-text-muted hover:text-text-primary transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-xs leading-relaxed text-text-secondary">{message}</p>

          {details.length > 0 && (
            <div className="max-h-36 overflow-y-auto p-3 rounded-lg bg-surface border border-border text-xs font-mono text-text-primary space-y-1">
              {details.map((item, i) => (
                <div key={i} className="truncate text-text-secondary">
                  • {item}
                </div>
              ))}
            </div>
          )}

          {requireCheckbox && (
            <label className="flex items-center space-x-3 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-surface text-primary focus:ring-primary focus:ring-offset-0"
              />
              <span className="text-xs text-text-secondary font-medium">
                I understand this operation is irreversible and accept the system changes.
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-border bg-surface/30">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface rounded-lg border border-border transition-colors"
          >
            {cancelText}
          </button>
          <button
            disabled={requireCheckbox && !confirmed}
            onClick={() => {
              setConfirmed(false);
              onConfirm();
            }}
            className={`px-4 py-2 text-xs font-medium text-white rounded-lg transition-colors ${
              dangerous
                ? 'bg-danger hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed'
                : 'bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {actionText}
          </button>
        </div>
      </div>
    </div>
  );
};
