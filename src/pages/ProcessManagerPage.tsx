import React, { useState } from 'react';
import { ProcessInfo } from '../types';
import { api } from '../services/api';
import { Cpu, Search, Trash2, Shield, FolderOpen, Power, RefreshCw, Activity, Zap, CheckCircle2 } from 'lucide-react';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { LaserScanline } from '../components/common/ProcessAnimation';

interface ProcessManagerPageProps {
  processes: ProcessInfo[];
  onRefresh: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ProcessManagerPage: React.FC<ProcessManagerPageProps> = ({
  processes,
  onRefresh,
  onLogNotification,
}) => {
  const [search, setSearch] = useState('');
  const [confirmProcess, setConfirmProcess] = useState<ProcessInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filtered = processes.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      String(p.pid).includes(search)
  );

  const totalRamMb = processes.reduce((acc, p) => acc + p.memory_mb, 0);
  const totalCpu = Math.min(100, processes.reduce((acc, p) => acc + p.cpu_usage, 0));

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleKill = async (proc: ProcessInfo) => {
    setConfirmProcess(null);
    try {
      await api.terminateProcess(proc.pid);
      onLogNotification('Process Terminated', `Successfully stopped ${proc.name} (PID ${proc.pid})`, 'warning');
      onRefresh();
    } catch (e: any) {
      onLogNotification('Termination Error', String(e), 'error');
    }
  };

  const isProtectedSystemProcess = (name: string) => {
    const protectedList = ['explorer.exe', 'system', 'smss.exe', 'csrss.exe', 'wininit.exe', 'services.exe', 'lsass.exe'];
    return protectedList.includes(name.toLowerCase());
  };

  return (
    <div className="space-y-5 pb-12 animate-fade-in max-w-5xl">
      {/* Top Real-time telemetry banner */}
      <div className="p-5 bg-card border border-border rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <LaserScanline active={isRefreshing} />

        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-warning/15 text-warning rounded-2xl relative">
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-secondary animate-ping" />
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-text-primary">Live Process Inspector</h3>
              <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] bg-secondary/15 text-secondary font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                <span>REAL-TIME</span>
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Live inspection of system memory footprints, CPU utilization, and safe execution termination.
            </p>
          </div>
        </div>

        {/* Live Metrics Mini-Dashboard */}
        <div className="flex items-center space-x-4">
          <div className="px-3.5 py-2 rounded-xl bg-surface/60 border border-border text-right min-w-[110px]">
            <span className="text-[10px] text-text-muted uppercase font-mono block">Active Threads</span>
            <span className="text-xs font-bold text-text-primary font-mono">{processes.length} Processes</span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-surface/60 border border-border text-right min-w-[120px]">
            <span className="text-[10px] text-text-muted uppercase font-mono block">Total Tracked RAM</span>
            <span className="text-xs font-bold text-secondary font-mono">{(totalRamMb / 1024).toFixed(2)} GB</span>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-3 py-2 bg-surface hover:bg-surface-elevated border border-border text-xs text-text-secondary hover:text-text-primary rounded-xl transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            <span>Poll Now</span>
          </button>
        </div>
      </div>

      {/* Filter and stats row */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter processes by name or PID..."
            className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary placeholder:text-text-muted/60"
          />
        </div>

        {/* Animated mini audio/activity visualizer bars */}
        <div className="hidden sm:flex items-center space-x-1 px-3 py-1.5 bg-surface/40 rounded-xl border border-border">
          <span className="text-[10px] text-text-muted mr-1.5 font-mono">ACTIVITY:</span>
          <div className="w-1 h-3 bg-secondary rounded-full animate-pulse" />
          <div className="w-1 h-5 bg-primary rounded-full animate-pulse delay-75" />
          <div className="w-1 h-2 bg-info rounded-full animate-pulse delay-150" />
          <div className="w-1 h-4 bg-secondary rounded-full animate-pulse delay-200" />
          <div className="w-1 h-3 bg-primary rounded-full animate-pulse delay-300" />
        </div>
      </div>

      {/* Process list */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border shadow-sm">
        {filtered.map((proc) => {
          const isProtected = isProtectedSystemProcess(proc.name);
          const memPercentage = Math.min(100, (proc.memory_mb / 1024) * 100);

          return (
            <div
              key={proc.pid}
              className="p-3.5 flex items-center justify-between hover:bg-surface/50 transition-colors text-xs group"
            >
              <div className="flex items-center space-x-3.5 min-w-0">
                {/* Live pulsing dot indicator */}
                <div className="relative flex items-center justify-center flex-shrink-0">
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  <span className="absolute w-3.5 h-3.5 rounded-full bg-secondary/30 animate-ping" />
                </div>

                <span className="w-12 font-mono text-[11px] text-text-muted flex-shrink-0">
                  PID {proc.pid}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-text-primary block truncate">{proc.name}</span>
                    {isProtected && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-surface border border-border text-text-muted font-mono">
                        Windows Core
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-text-muted font-mono truncate block max-w-sm mt-0.5">
                    {proc.exe_path || 'Windows Protected Execution Memory Space'}
                  </span>
                </div>
              </div>

              {/* Memory & CPU gauges with animated progress fill */}
              <div className="flex items-center space-x-6">
                <div className="w-28 text-right">
                  <div className="flex justify-between items-center text-[10px] font-mono text-text-muted mb-1">
                    <span>RAM</span>
                    <span className="font-semibold text-text-primary">{proc.memory_mb} MB</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-secondary to-primary rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(5, memPercentage)}%` }}
                    />
                  </div>
                </div>

                <div className="w-20 text-right">
                  <div className="flex justify-between items-center text-[10px] font-mono text-text-muted mb-1">
                    <span>CPU</span>
                    <span className="font-semibold text-text-primary">{proc.cpu_usage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        proc.cpu_usage > 15 ? 'bg-danger' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.max(3, Math.min(100, proc.cpu_usage * 2))}%` }}
                    />
                  </div>
                </div>

                {/* Kill / End Task button */}
                <div className="w-24 text-right">
                  {isProtected ? (
                    <span className="text-[11px] text-text-muted flex items-center justify-end space-x-1">
                      <Shield className="w-3.5 h-3.5 text-text-muted" />
                      <span>Protected</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmProcess(proc)}
                      className="px-2.5 py-1 text-[11px] rounded-lg bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 font-medium transition-colors opacity-90 group-hover:opacity-100 flex items-center space-x-1 ml-auto"
                    >
                      <Power className="w-3 h-3" />
                      <span>End Task</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(confirmProcess)}
        title="End Process Tree"
        message={`Terminate active process '${confirmProcess?.name}' (PID: ${confirmProcess?.pid})? Any unsaved data in this process will be lost.`}
        confirmLabel="Force End Task"
        isDanger={true}
        onConfirm={() => confirmProcess && handleKill(confirmProcess)}
        onCancel={() => setConfirmProcess(null)}
      />
    </div>
  );
};
