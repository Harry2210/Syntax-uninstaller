import React, { useState } from 'react';
import { api } from '../services/api';
import { Activity, Play, StopCircle, CheckCircle2, ArrowRight, Shield, Save } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

interface InstallationMonitorPageProps {
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const InstallationMonitorPage: React.FC<InstallationMonitorPageProps> = ({
  onLogNotification,
}) => {
  const [sessionState, setSessionState] = useState<'idle' | 'monitoring' | 'completed'>('idle');
  const [appName, setAppName] = useState('');
  const [beforeSnapshot, setBeforeSnapshot] = useState<any>(null);
  const [diffResult, setDiffResult] = useState<any>(null);

  const startMonitoring = async () => {
    if (!appName.trim()) return;
    const snap = await api.takeMonitorSnapshot();
    setBeforeSnapshot(snap);
    setSessionState('monitoring');
    onLogNotification('Monitoring Started', `Pre-install snapshot taken for ${appName}. Run the installer now.`, 'info');
  };

  const finishMonitoring = async () => {
    if (!beforeSnapshot) return;
    const diff = await api.compareMonitorSnapshot(beforeSnapshot, appName);
    setDiffResult(diff);
    setSessionState('completed');
    onLogNotification('Snapshot Compared', `Captured modifications for ${appName}. Trace saved.`, 'success');
  };

  const resetSession = () => {
    setSessionState('idle');
    setAppName('');
    setBeforeSnapshot(null);
    setDiffResult(null);
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-4xl">
      <div className="p-5 bg-card border border-border rounded-2xl flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-primary/20 text-primary rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Real-time Installation Monitor</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Take before and after system snapshots to track exact registry keys, services, and directories created during setup.
            </p>
          </div>
        </div>

        <StatusBadge
          status={sessionState === 'monitoring' ? 'Recording Active' : sessionState === 'completed' ? 'Diff Generated' : 'Standby'}
          variant={sessionState === 'monitoring' ? 'warning' : sessionState === 'completed' ? 'success' : 'neutral'}
        />
      </div>

      {sessionState === 'idle' && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Start New Monitoring Session
          </h4>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Application Name or Installer Description
            </label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="e.g. VLC Media Player, Notepad++, Blender"
              className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          <button
            disabled={!appName.trim()}
            onClick={startMonitoring}
            className="flex items-center space-x-2 px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-lg shadow-primary/20 transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Capture Pre-Install Snapshot & Start</span>
          </button>
        </div>
      )}

      {sessionState === 'monitoring' && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-warning animate-ping" />
            <h4 className="text-sm font-bold text-text-primary">
              Monitoring Session Active for: {appName}
            </h4>
          </div>

          <div className="p-4 bg-surface rounded-xl border border-border text-xs text-text-secondary space-y-2">
            <p>1. Baseline snapshot captured successfully.</p>
            <p>2. Please launch your installer and finish the application installation now.</p>
            <p>3. When the installer finishes, click the button below to record the differences.</p>
          </div>

          <button
            onClick={finishMonitoring}
            className="flex items-center space-x-2 px-5 py-2.5 bg-secondary hover:bg-secondary-hover text-background rounded-xl text-xs font-bold shadow-lg transition-all"
          >
            <StopCircle className="w-4 h-4" />
            <span>Finish Installation & Generate Trace</span>
          </button>
        </div>
      )}

      {sessionState === 'completed' && diffResult && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center space-x-2.5 text-secondary">
              <CheckCircle2 className="w-5 h-5" />
              <h4 className="text-sm font-bold text-text-primary">
                Installation Trace Captured ({diffResult.app_name})
              </h4>
            </div>

            <button
              onClick={resetSession}
              className="px-3 py-1.5 bg-surface hover:bg-surface-elevated text-xs font-medium text-text-secondary rounded-lg border border-border"
            >
              Start New Trace
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-surface rounded-xl border border-border">
              <span className="text-text-muted text-[10px] uppercase font-mono">Registry Keys Created</span>
              <p className="text-text-primary font-bold text-base mt-1">{diffResult.new_registry_keys.length}</p>
            </div>
            <div className="p-3 bg-surface rounded-xl border border-border">
              <span className="text-text-muted text-[10px] uppercase font-mono">Files & Directories Added</span>
              <p className="text-text-primary font-bold text-base mt-1">{diffResult.new_files.length}</p>
            </div>
          </div>

          <div className="space-y-1.5 pt-2">
            <span className="text-xs font-semibold text-text-primary">Detected Registry Keys</span>
            <div className="p-3 bg-surface rounded-xl border border-border max-h-36 overflow-y-auto space-y-1 text-xs font-mono text-text-secondary">
              {diffResult.new_registry_keys.map((k: string, i: number) => (
                <div key={i} className="truncate">• {k}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
