import React, { useState } from 'react';
import { Crosshair, Target, ShieldAlert, FolderOpen, Trash2, Power, Eye, Search, Zap, Cross } from 'lucide-react';
import { api } from '../services/api';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { ApplicationIcon } from '../components/common/ApplicationIcon';

interface HunterModePageProps {
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

interface DetectedWindow {
  title: string;
  processName: string;
  pid: number;
  exePath: string;
}

export const HunterModePage: React.FC<HunterModePageProps> = ({ onLogNotification }) => {
  const [isAiming, setIsAiming] = useState(false);
  const [target, setTarget] = useState<DetectedWindow | null>({
    title: 'Google Chrome — Active Workspace Window',
    processName: 'chrome.exe',
    pid: 14280,
    exePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const [confirmKill, setConfirmKill] = useState(false);

  const simulateAim = () => {
    setIsAiming(true);
    setTimeout(() => {
      setTarget({
        title: 'Visual Studio Code — Syntax Uninstaller',
        processName: 'Code.exe',
        pid: 9140,
        exePath: 'C:\\Program Files\\Microsoft VS Code\\Code.exe',
      });
      setIsAiming(false);
      onLogNotification('Target Locked', 'Identified active window: Visual Studio Code', 'info');
    }, 1200);
  };

  const handleKillProcess = async () => {
    if (!target) return;
    setConfirmKill(false);
    try {
      await api.terminateProcess(target.pid);
      onLogNotification('Process Terminated', `Killed PID ${target.pid} (${target.processName})`, 'warning');
      setTarget(null);
    } catch (e: any) {
      onLogNotification('Termination Failed', String(e), 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-4xl">
      {/* Banner */}
      <div className="p-5 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-secondary/15 text-secondary rounded-2xl relative">
            <Crosshair className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Syntax Hunter Mode</h3>
            <p className="text-xs text-text-muted mt-0.5 max-w-lg">
              Hover or lock target over any desktop window or system tray icon to identify its source binary, PID, and execute surgical uninstallation.
            </p>
          </div>
        </div>

        <button
          onClick={simulateAim}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg ${
            isAiming
              ? 'bg-primary text-white animate-pulse shadow-primary/30'
              : 'bg-secondary hover:bg-secondary-hover text-background'
          }`}
        >
          <Target className={`w-4 h-4 ${isAiming ? 'animate-spin' : ''}`} />
          <span>{isAiming ? 'Tracking Reticle Active...' : 'Engage Hunter Crosshair'}</span>
        </button>
      </div>

      {/* High-Tech HUD Animation Area */}
      <div className="p-8 bg-card border border-border rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
        {/* Ambient Grid Background */}
        <div className="absolute inset-0 bg-[radial-gradient(#283448_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

        {/* Reticle Graphics */}
        <div className="relative w-48 h-48 flex items-center justify-center">
          {/* Outer rotating HUD ring */}
          <div className="absolute inset-0 rounded-full border border-dashed border-primary/40 animate-hud-spin-cw" />
          {/* Inner counter-rotating ring */}
          <div className="absolute inset-4 rounded-full border border-secondary/30 border-t-secondary animate-hud-spin-ccw" />
          {/* Concentric pulse ring */}
          <div className={`absolute inset-8 rounded-full border border-primary/20 ${isAiming ? 'animate-ping' : ''}`} />

          {/* Crosshair lines */}
          <div className="absolute inset-x-0 top-1/2 h-px bg-secondary/40" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-secondary/40" />

          {/* Center Target Indicator */}
          <div className="relative z-10 flex flex-col items-center justify-center p-3 rounded-2xl bg-surface/80 backdrop-blur-md border border-border shadow-xl">
            {target ? (
              <ApplicationIcon name={target.processName} iconPath={target.exePath} size="lg" />
            ) : (
              <Target className="w-10 h-10 text-text-muted" />
            )}
          </div>
        </div>

        <p className="text-xs font-mono text-text-muted mt-4">
          {isAiming ? (
            <span className="text-secondary font-bold animate-pulse">ACQUIRING WINDOW HANDLE ON DESKTOP...</span>
          ) : target ? (
            <span className="text-text-primary font-semibold">TARGET LOCKED: {target.processName} (PID {target.pid})</span>
          ) : (
            <span>STANDBY — ENGAGE CROSSHAIR TO LOCK ON WINDOW</span>
          )}
        </p>
      </div>

      {/* Target Inspection Card */}
      {target && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center space-x-3">
              <ApplicationIcon name={target.processName} iconPath={target.exePath} size="md" />
              <div>
                <h4 className="text-sm font-bold text-text-primary">{target.title}</h4>
                <p className="text-[11px] text-text-muted font-mono">{target.processName}</p>
              </div>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-surface border border-border text-secondary font-bold">
              PID {target.pid}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-surface rounded-xl border border-border">
              <span className="text-text-muted text-[10px] uppercase font-mono">Process Executable</span>
              <p className="font-semibold text-text-primary mt-0.5 font-mono truncate">{target.exePath}</p>
            </div>
            <div className="p-3 bg-surface rounded-xl border border-border">
              <span className="text-text-muted text-[10px] uppercase font-mono">Process Status</span>
              <p className="font-semibold text-secondary mt-0.5 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                <span>Running in Foreground GUI Thread</span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-border">
            <button
              onClick={() => setConfirmKill(true)}
              className="px-4 py-2 bg-warning/15 hover:bg-warning/25 text-warning border border-warning/30 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Kill Window Process</span>
            </button>
            <button
              onClick={() => {
                onLogNotification('Uninstall Initiated', `Opening deep cleanup for ${target.processName}`, 'info');
              }}
              className="px-4 py-2 bg-danger hover:bg-danger/90 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-lg shadow-danger/20"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge &amp; Uninstall Source Program</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmKill}
        title="Terminate Window Process"
        message={`Force close active window process '${target?.processName}' (PID ${target?.pid})?`}
        confirmLabel="Terminate Window"
        isDanger={true}
        onConfirm={handleKillProcess}
        onCancel={() => setConfirmKill(false)}
      />
    </div>
  );
};
