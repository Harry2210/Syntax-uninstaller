import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Activity, Play, StopCircle, CheckCircle2, Shield, FolderOpen, Terminal, Clock, Cpu } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

interface InstallationMonitorPageProps {
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
  onNavigateToTraced?: () => void;
}

export const InstallationMonitorPage: React.FC<InstallationMonitorPageProps> = ({
  onLogNotification,
  onNavigateToTraced,
}) => {
  const [sessionState, setSessionState] = useState<'idle' | 'monitoring' | 'completed'>('idle');
  const [appName, setAppName] = useState('');
  const [installerPath, setInstallerPath] = useState('');
  const [liveStatus, setLiveStatus] = useState<any>(null);
  const [diffResult, setDiffResult] = useState<any>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Poll live status when active
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (sessionState === 'monitoring') {
      interval = setInterval(async () => {
        try {
          const status = await api.getLiveMonitorStatus();
          setLiveStatus(status);
        } catch {}
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionState]);

  const startMonitoring = async () => {
    if (!appName.trim() && !installerPath.trim()) return;
    setIsStarting(true);
    try {
      const derivedName = appName.trim() || installerPath.split('\\').pop()?.replace(/\.(exe|msi)$/i, '') || 'MonitoredApp';
      const status = await api.startLiveMonitor(installerPath.trim() || null, derivedName);
      setLiveStatus(status);
      setSessionState('monitoring');
      onLogNotification(
        'Live Monitoring Started',
        `Live real-time watcher active for ${derivedName}. Registry and filesystem modifications are being tracked.`,
        'info'
      );
    } catch (err: any) {
      onLogNotification('Monitor Error', String(err), 'error');
    } finally {
      setIsStarting(false);
    }
  };

  const finishMonitoring = async () => {
    setIsStopping(true);
    try {
      const trace = await api.stopLiveMonitor(appName.trim());
      setDiffResult(trace);
      setSessionState('completed');
      onLogNotification(
        'Installation Trace Recorded',
        `Successfully captured and saved trace for ${trace.app_name} into SQLite database (${trace.new_registry_keys.length} keys, ${trace.new_files.length} files).`,
        'success'
      );
    } catch (err: any) {
      onLogNotification('Trace Error', String(err), 'error');
    } finally {
      setIsStopping(false);
    }
  };

  const resetSession = () => {
    setSessionState('idle');
    setAppName('');
    setInstallerPath('');
    setLiveStatus(null);
    setDiffResult(null);
  };

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-4xl">
      {/* Top Banner */}
      <div className="p-5 bg-card border border-border rounded-2xl flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-primary/20 text-primary rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Real-Time Live Installation Monitor</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Watches filesystem and Windows Registry modifications in real time as installers run, recording clean reversal traces into the SQLite database.
            </p>
          </div>
        </div>

        <StatusBadge
          status={sessionState === 'monitoring' ? 'Live Watching Active' : sessionState === 'completed' ? 'Trace Persisted in SQLite' : 'Standby'}
          variant={sessionState === 'monitoring' ? 'warning' : sessionState === 'completed' ? 'success' : 'neutral'}
        />
      </div>

      {/* Mode Selection / Start Form */}
      {sessionState === 'idle' && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div>
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Start Real-Time Installation Tracking
            </h4>
            <p className="text-xs text-text-muted mt-1">
              Choose to either launch an installer directly or watch system-wide setup activities in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Target Application / Profile Name
              </label>
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="e.g. Adobe Photoshop, Blender, OBS Studio"
                className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Installer Executable Path (Optional)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={installerPath}
                  onChange={(e) => setInstallerPath(e.target.value)}
                  placeholder="e.g. C:\Downloads\Setup.exe"
                  className="flex-1 bg-surface border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-surface/50 border border-border rounded-xl flex items-center space-x-3 text-xs text-text-secondary">
            <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>
              <strong>Safe & Non-Intrusive:</strong> Uses native Windows real-time change notifications. No risky kernel drivers, zero risk of Blue Screens (BSOD), and 100% compliant with Windows security policies.
            </span>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              disabled={isStarting || (!appName.trim() && !installerPath.trim())}
              onClick={startMonitoring}
              className="flex items-center space-x-2 px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isStarting ? 'Initializing Watcher...' : 'Start Real-Time Live Watcher'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Live Active Monitoring View */}
      {sessionState === 'monitoring' && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center space-x-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <h4 className="text-sm font-bold text-text-primary">
                  Live Monitoring: {appName || liveStatus?.app_name || 'Active Session'}
                </h4>
                <p className="text-xs text-text-muted mt-0.5">
                  Real-time filesystem and registry hooks active. Run your setup installer now.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-xs font-mono">
              <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-surface rounded-lg border border-border text-emerald-400">
                <Clock className="w-3.5 h-3.5" />
                <span>Elapsed: {formatElapsed(liveStatus?.elapsed_seconds || 0)}</span>
              </div>
              {liveStatus?.installer_pid && (
                <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-surface rounded-lg border border-border text-primary">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>PID: {liveStatus.installer_pid} ({liveStatus.installer_running ? 'Running' : 'Exited'})</span>
                </div>
              )}
            </div>
          </div>

          {/* Real-time Streaming Events Log */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-text-secondary flex items-center space-x-1.5">
                <Terminal className="w-3.5 h-3.5 text-primary" />
                <span>Live Event Stream</span>
              </span>
              <span className="text-[11px] text-text-muted">Auto-scrolling realtime feed</span>
            </div>

            <div className="bg-surface/80 border border-border rounded-xl p-4 font-mono text-[11px] space-y-1.5 max-h-52 overflow-y-auto">
              {(liveStatus?.recent_events || [
                `[${new Date().toLocaleTimeString()}] Baseline snapshot initialized.`,
                `[${new Date().toLocaleTimeString()}] Real-time directory and registry watcher listening...`,
              ]).map((event: string, idx: number) => (
                <div key={idx} className="text-emerald-400/90 leading-relaxed">
                  {event}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              disabled={isStopping}
              onClick={finishMonitoring}
              className="flex items-center space-x-2 px-6 py-3 bg-secondary hover:bg-secondary-hover disabled:opacity-50 text-background rounded-xl text-xs font-bold shadow-lg transition-all hover:scale-105 active:scale-95"
            >
              <StopCircle className="w-4 h-4" />
              <span>{isStopping ? 'Analyzing & Saving Trace...' : 'Finish Installation & Save Trace'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Completed Results View */}
      {sessionState === 'completed' && diffResult && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5 animate-fade-in">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center space-x-2.5 text-secondary">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <div>
                <h4 className="text-sm font-bold text-text-primary">
                  Installation Trace Saved to SQLite: {diffResult.app_name}
                </h4>
                <p className="text-xs text-text-muted mt-0.5">
                  Recorded at {new Date(diffResult.recorded_at).toLocaleTimeString()} • Available in Traced Programs
                </p>
              </div>
            </div>

            <button
              onClick={resetSession}
              className="px-4 py-2 bg-surface hover:bg-surface-elevated text-xs font-medium text-text-secondary rounded-xl border border-border transition-all"
            >
              Start New Session
            </button>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-surface rounded-xl border border-border">
              <span className="text-text-muted text-[10px] uppercase font-mono">Registry Keys Recorded</span>
              <p className="text-text-primary font-bold text-lg mt-1">{diffResult.new_registry_keys.length}</p>
            </div>
            <div className="p-4 bg-surface rounded-xl border border-border">
              <span className="text-text-muted text-[10px] uppercase font-mono">Files & Folders Created</span>
              <p className="text-text-primary font-bold text-lg mt-1">{diffResult.new_files.length}</p>
            </div>
            <div className="p-4 bg-surface rounded-xl border border-border">
              <span className="text-text-muted text-[10px] uppercase font-mono">Total Monitored Size</span>
              <p className="text-emerald-400 font-bold text-lg mt-1">
                {(diffResult.total_size_bytes / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
          </div>

          {/* Keys list */}
          <div className="space-y-1.5 pt-2">
            <span className="text-xs font-semibold text-text-primary">Recorded Registry Modifications</span>
            <div className="p-3 bg-surface rounded-xl border border-border max-h-40 overflow-y-auto space-y-1 text-xs font-mono text-text-secondary">
              {diffResult.new_registry_keys.length === 0 ? (
                <div className="text-text-muted italic">No new persistent registry entries detected.</div>
              ) : (
                diffResult.new_registry_keys.map((k: string, i: number) => (
                  <div key={i} className="truncate text-emerald-400/80">• {k}</div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

