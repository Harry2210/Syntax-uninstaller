import React, { useState } from 'react';
import { NotificationItem } from '../types';
import { Bell, Trash2, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

interface NotificationsPageProps {
  notifications: NotificationItem[];
  onClearAll: () => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  notifications,
  onClearAll,
}) => {
  return (
    <div className="space-y-4 pb-12 animate-fade-in max-w-4xl">
      <div className="p-4 bg-card border border-border rounded-2xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/20 text-primary rounded-xl">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Activity & Notification Center</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Persistent audit trail of uninstallation operations, file cleanups, and system alerts.
            </p>
          </div>
        </div>

        {notifications.length > 0 && (
          <button
            onClick={onClearAll}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-surface hover:bg-surface-elevated text-xs font-semibold text-text-secondary hover:text-text-primary rounded-xl border border-border transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            No notifications or activity logs recorded yet.
          </div>
        ) : (
          notifications.map((item) => (
            <div key={item.id} className="p-4 flex items-start space-x-3.5 text-xs hover:bg-surface/40 transition-colors">
              <div className="mt-0.5">
                {item.level === 'success' && <CheckCircle2 className="w-4 h-4 text-secondary" />}
                {item.level === 'warning' && <AlertTriangle className="w-4 h-4 text-warning" />}
                {item.level === 'error' && <AlertCircle className="w-4 h-4 text-danger" />}
                {item.level === 'info' && <Info className="w-4 h-4 text-info" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-text-primary">{item.title}</h4>
                  <span className="text-[10px] text-text-muted font-mono">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary mt-0.5">{item.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
