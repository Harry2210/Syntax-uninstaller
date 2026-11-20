import React, { useEffect, useState } from 'react';
import { StartupItem } from '../types';
import { PlaySquare, Search, Power, Trash2, FolderOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { ApplicationIcon } from '../components/common/ApplicationIcon';

interface StartupManagerPageProps {
  items: StartupItem[];
  onRefresh: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const StartupManagerPage: React.FC<StartupManagerPageProps> = ({
  items,
  onRefresh,
  onLogNotification,
}) => {
  const [search, setSearch] = useState('');
  const [startupItems, setStartupItems] = useState<StartupItem[]>(items);

  useEffect(() => {
    setStartupItems(items);
  }, [items]);

  const filtered = startupItems.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.command.toLowerCase().includes(search.toLowerCase())
  );

  const toggleItem = (id: string) => {
    setStartupItems((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          const nextState = !i.enabled;
          onLogNotification(
            'Startup Item Toggled',
            `${i.name} was ${nextState ? 'enabled' : 'disabled'} for Windows startup.`,
            'info'
          );
          return { ...i, enabled: nextState };
        }
        return i;
      })
    );
  };

  return (
    <div className="space-y-4 pb-12 animate-fade-in max-w-5xl">
      <div className="p-4 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-info/20 text-info rounded-xl">
            <PlaySquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Windows Startup Applications</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Manage programs and services configured to launch automatically when Windows boots.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs text-text-secondary">
          <span>Enabled: <strong className="text-secondary">{startupItems.filter((i) => i.enabled).length}</strong></span>
          <span>•</span>
          <span>Disabled: <strong className="text-text-muted">{startupItems.filter((i) => !i.enabled).length}</strong></span>
        </div>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search startup entries..."
          className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
        />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="p-4 flex items-center justify-between hover:bg-surface/50 transition-colors text-xs"
          >
            <div className="flex items-center space-x-3.5 min-w-0">
              <button
                onClick={() => toggleItem(item.id)}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                  item.enabled ? 'bg-secondary' : 'bg-surface border border-border'
                }`}
                title={item.enabled ? 'Click to disable' : 'Click to enable'}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                    item.enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>

              <ApplicationIcon name={item.name} iconPath={item.command} size="sm" />

              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-text-primary truncate">{item.name}</span>
                  {!item.file_exists && (
                    <span className="flex items-center space-x-1 text-[10px] text-danger font-semibold bg-danger/10 px-1.5 py-0.2 rounded border border-danger/20">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Missing File</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-text-muted font-mono truncate max-w-md mt-0.5">
                  {item.command}
                </p>
                <span className="text-[10px] text-text-muted font-mono">
                  Location: {item.location} ({item.user_scope})
                </span>
              </div>
            </div>

            <StatusBadge
              status={item.enabled ? 'Enabled' : 'Disabled'}
              variant={item.enabled ? 'success' : 'neutral'}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
