import React, { useEffect, useState } from 'react';
import { WinService } from '../types';
import { api } from '../services/api';
import { Sliders, Search, Play, Square, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

interface ServicesManagerPageProps {
  services: WinService[];
  onRefresh: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ServicesManagerPage: React.FC<ServicesManagerPageProps> = ({
  services,
  onRefresh,
  onLogNotification,
}) => {
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState<string>('all');
  const [activeServices, setActiveServices] = useState<WinService[]>(services);

  // Follow the parent's asynchronously loaded list instead of freezing the
  // snapshot taken at mount time.
  useEffect(() => {
    setActiveServices(services);
  }, [services]);

  const filtered = activeServices.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.display_name.toLowerCase().includes(search.toLowerCase());
    const matchesState =
      filterState === 'all' ||
      (filterState === 'running' && s.status === 'Running') ||
      (filterState === 'stopped' && s.status === 'Stopped');
    return matchesSearch && matchesState;
  });

  const handleServiceAction = async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
    try {
      await api.manageService(serviceName, action);
      setActiveServices((prev) =>
        prev.map((s) => {
          if (s.name === serviceName) {
            return {
              ...s,
              status: action === 'stop' ? 'Stopped' : 'Running',
            };
          }
          return s;
        })
      );
      onLogNotification(
        'Service Updated',
        `Successfully sent ${action} signal to service: ${serviceName}`,
        'success'
      );
    } catch (e: any) {
      onLogNotification('Service Error', String(e), 'error');
    }
  };

  return (
    <div className="space-y-4 pb-12 animate-fade-in max-w-5xl">
      <div className="p-4 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-secondary/20 text-secondary rounded-xl">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Windows Services Manager</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Inspect running system services, change startup types, and safely control background daemons.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs text-text-secondary">
          <span>Running: <strong className="text-secondary">{activeServices.filter((s) => s.status === 'Running').length}</strong></span>
          <span>•</span>
          <span>Total: <strong className="text-text-primary">{activeServices.length}</strong></span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services by name or display description..."
            className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilterState('all')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              filterState === 'all' ? 'bg-primary text-white border-primary' : 'bg-surface text-text-secondary border-border'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterState('running')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              filterState === 'running' ? 'bg-secondary text-background font-bold border-secondary' : 'bg-surface text-text-secondary border-border'
            }`}
          >
            Running
          </button>
          <button
            onClick={() => setFilterState('stopped')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              filterState === 'stopped' ? 'bg-surface-elevated text-text-primary border-border' : 'bg-surface text-text-secondary border-border'
            }`}
          >
            Stopped
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {filtered.map((service) => (
          <div
            key={service.name}
            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface/50 transition-colors text-xs"
          >
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-text-primary truncate">{service.display_name}</span>
                <span className="text-[10px] text-text-muted font-mono">({service.name})</span>
              </div>
              <p className="text-[11px] text-text-muted font-mono">
                Start Type: {service.start_type}
              </p>
            </div>

            <div className="flex items-center space-x-3 self-end sm:self-center">
              <StatusBadge status={service.status} variant={service.status === 'Running' ? 'success' : 'neutral'} />

              {service.status === 'Running' ? (
                <>
                  <button
                    onClick={() => handleServiceAction(service.name, 'restart')}
                    className="p-1.5 bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg border border-border"
                    title="Restart Service"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleServiceAction(service.name, 'stop')}
                    className="p-1.5 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 rounded-lg"
                    title="Stop Service"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleServiceAction(service.name, 'start')}
                  className="p-1.5 bg-secondary/15 hover:bg-secondary/25 text-secondary border border-secondary/30 rounded-lg"
                  title="Start Service"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
