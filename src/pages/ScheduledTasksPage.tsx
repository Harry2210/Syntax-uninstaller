import React, { useEffect, useState } from 'react';
import { ScheduledTaskItem } from '../types';
import { api } from '../services/api';
import { Clock, Search, Play, Power, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

interface ScheduledTasksPageProps {
  tasks: ScheduledTaskItem[];
  onRefresh: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ScheduledTasksPage: React.FC<ScheduledTasksPageProps> = ({
  tasks,
  onRefresh,
  onLogNotification,
}) => {
  const [search, setSearch] = useState('');
  const [activeTasks, setActiveTasks] = useState<ScheduledTaskItem[]>(tasks);

  useEffect(() => {
    setActiveTasks(tasks);
  }, [tasks]);

  const filtered = activeTasks.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.author.toLowerCase().includes(search.toLowerCase())
  );

  const toggleTask = async (taskName: string, currentEnabled: boolean) => {
    try {
      await api.toggleTask(taskName, !currentEnabled);
      setActiveTasks((prev) =>
        prev.map((t) => (t.name === taskName ? { ...t, state: currentEnabled ? 'Disabled' : 'Ready' } : t))
      );
      onLogNotification(
        'Task State Changed',
        `Task ${taskName} was ${currentEnabled ? 'disabled' : 'enabled'}.`,
        'info'
      );
    } catch (e: any) {
      onLogNotification('Task Error', String(e), 'error');
    }
  };

  return (
    <div className="space-y-4 pb-12 animate-fade-in max-w-5xl">
      <div className="p-4 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/20 text-primary rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Scheduled Tasks Inventory</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Discover and control recurring updater, sync, and maintenance jobs configured in Windows Task Scheduler.
            </p>
          </div>
        </div>

        <span className="text-xs text-text-secondary font-mono">
          Tasks: <strong className="text-text-primary">{activeTasks.length}</strong>
        </span>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search scheduled tasks by name or author..."
          className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
        />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {filtered.map((task) => {
          const isReady = task.state === 'Ready';
          return (
            <div
              key={task.name}
              className="p-4 flex items-center justify-between hover:bg-surface/50 transition-colors text-xs"
            >
              <div className="min-w-0 space-y-0.5">
                <span className="font-bold text-text-primary truncate block">{task.name}</span>
                <p className="text-[11px] text-text-muted font-mono">{task.path} • {task.author}</p>
              </div>

              <div className="flex items-center space-x-3">
                <StatusBadge status={task.state} variant={isReady ? 'success' : 'neutral'} />
                <button
                  onClick={() => toggleTask(task.name, isReady)}
                  className={`px-3 py-1 rounded-lg border text-xs font-medium transition-colors ${
                    isReady
                      ? 'bg-danger/10 hover:bg-danger/20 text-danger border-danger/30'
                      : 'bg-secondary/15 hover:bg-secondary/25 text-secondary border-secondary/30'
                  }`}
                >
                  {isReady ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
