import React, { useState } from 'react';
import { InstalledApp } from '../types';
import { api } from '../services/api';
import { CheckSquare, Search, Play, Pause, Trash2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { ApplicationIcon } from '../components/common/ApplicationIcon';

interface MultipleUninstallPageProps {
  apps: InstalledApp[];
  onRefresh: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

interface QueueItem {
  app: InstalledApp;
  status: 'pending' | 'processing' | 'completed' | 'error';
  leftoversRemoved: number;
}

export const MultipleUninstallPage: React.FC<MultipleUninstallPageProps> = ({
  apps,
  onRefresh,
  onLogNotification,
}) => {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeQueueIndex, setActiveQueueIndex] = useState(-1);

  const filtered = apps.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.publisher.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const startBatchRemoval = async () => {
    const selectedApps = apps.filter((a) => selectedIds.has(a.id));
    if (selectedApps.length === 0) return;

    const initialQueue: QueueItem[] = selectedApps.map((a) => ({
      app: a,
      status: 'pending',
      leftoversRemoved: 0,
    }));
    setQueue(initialQueue);
    setIsRunning(true);

    for (let i = 0; i < initialQueue.length; i++) {
      setActiveQueueIndex(i);
      setQueue((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'processing' } : item))
      );

      const target = initialQueue[i].app;
      try {
        // Run uninstaller sequentially
        await api.runUninstaller(target.quiet_uninstall_string || target.uninstall_string, true);
        const leftovers = await api.scanLeftovers(target.name, target.publisher, target.install_location, 'Safe');
        const [count] = await api.removeLeftovers(leftovers);

        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'completed', leftoversRemoved: count } : item
          )
        );
      } catch (e) {
        setQueue((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'error' } : item))
        );
      }
    }

    setIsRunning(false);
    setActiveQueueIndex(-1);
    setSelectedIds(new Set());
    onLogNotification(
      'Batch Removal Completed',
      `Processed ${selectedApps.length} applications sequentially.`,
      'success'
    );
    onRefresh();
  };

  return (
    <div className="space-y-4 pb-12 animate-fade-in max-w-5xl">
      {/* Top Banner and Queue Status */}
      <div className="bg-card border border-border p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/20 text-primary rounded-xl">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Batch Uninstallation Queue</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Select multiple programs to safely queue and uninstall them sequentially one after another.
            </p>
          </div>
        </div>

        <button
          disabled={selectedIds.size === 0 || isRunning}
          onClick={startBatchRemoval}
          className="flex items-center space-x-2 px-5 py-2.5 bg-danger hover:bg-rose-600 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Uninstall Queue ({selectedIds.size})</span>
        </button>
      </div>

      {/* Progress Queue Card if active */}
      {queue.length > 0 && (
        <div className="bg-surface/50 border border-border p-4 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Execution Progress ({queue.filter((q) => q.status === 'completed').length}/{queue.length})
          </h4>
          <div className="space-y-2">
            {queue.map((item, idx) => (
              <div
                key={item.app.id}
                className="flex items-center justify-between p-3 bg-card border border-border rounded-xl text-xs"
              >
                <div className="flex items-center space-x-3">
                  {item.status === 'pending' && <Clock className="w-4 h-4 text-text-muted" />}
                  {item.status === 'processing' && <span className="w-2 h-2 rounded-full bg-primary animate-ping" />}
                  {item.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-secondary" />}
                  {item.status === 'error' && <AlertCircle className="w-4 h-4 text-danger" />}
                  <ApplicationIcon name={item.app.name} publisher={item.app.publisher} iconPath={item.app.display_icon} size="sm" />
                  <span className="font-semibold text-text-primary">{item.app.name}</span>
                </div>
                <StatusBadge
                  status={item.status.toUpperCase()}
                  variant={item.status === 'completed' ? 'success' : item.status === 'processing' ? 'warning' : 'neutral'}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Program Selection Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-3 border-b border-border">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search programs to select for batch queue..."
              className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="divide-y divide-border max-h-96 overflow-y-auto">
          {filtered.map((app) => {
            const isSelected = selectedIds.has(app.id);
            return (
              <div
                key={app.id}
                onClick={() => !isRunning && toggleSelect(app.id)}
                className={`p-3 flex items-center justify-between hover:bg-surface/50 cursor-pointer text-xs transition-colors ${
                  isSelected ? 'bg-primary/10' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className="rounded border-border text-primary focus:ring-0"
                  />
                  <ApplicationIcon name={app.name} publisher={app.publisher} iconPath={app.display_icon} size="sm" />
                  <div>
                    <span className="font-semibold text-text-primary block">{app.name}</span>
                    <span className="text-[11px] text-text-muted">{app.publisher} • v{app.version}</span>
                  </div>
                </div>
                <span className="text-text-muted font-mono">
                  {app.estimated_size_kb > 0 ? `${(app.estimated_size_kb / 1024).toFixed(1)} MB` : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
