import React, { useState, useEffect } from 'react';
import { LockedFileStatus } from '../types';
import { api } from '../services/api';
import {
  Unlock,
  Lock,
  RefreshCw,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileQuestion,
  Cpu,
  ShieldAlert,
  ArrowRight,
  Terminal,
} from 'lucide-react';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';

interface UnlockerPageProps {
  onRefresh?: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const UnlockerPage: React.FC<UnlockerPageProps> = ({
  onRefresh,
  onLogNotification,
}) => {
  const [targetPath, setTargetPath] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<LockedFileStatus | null>(null);
  const [pendingReboots, setPendingReboots] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRebootConfirm, setShowRebootConfirm] = useState(false);

  const loadPendingReboots = async () => {
    try {
      const list = await api.getPendingRebootDeletions();
      setPendingReboots(list);
    } catch (err) {
      console.error('Failed to load pending reboot operations:', err);
    }
  };

  useEffect(() => {
    loadPendingReboots();
  }, []);

  const handleInspect = async (pathToInspect?: string) => {
    const path = pathToInspect || targetPath.trim();
    if (!path) return;
    setIsInspecting(true);
    setStatus(null);
    try {
      const result = await api.inspectLockedPath(path);
      setStatus(result);
    } catch {
      onLogNotification('Error', 'Failed to inspect file locks.', 'error');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleUnlockAndDelete = async () => {
    if (!status) return;
    setShowDeleteConfirm(false);
    setIsProcessing(true);
    try {
      const result = await api.unlockAndDelete(status.path);
      onLogNotification('File Eradicated', result, 'success');
      setStatus(null);
      setTargetPath('');
      await loadPendingReboots();
      if (onRefresh) onRefresh();
    } catch {
      onLogNotification('Error', 'Failed to unlock and delete target.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScheduleReboot = async () => {
    if (!status) return;
    setShowRebootConfirm(false);
    setIsProcessing(true);
    try {
      const result = await api.scheduleRebootDeletion(status.path);
      onLogNotification('Reboot Deletion Scheduled', result, 'success');
      await loadPendingReboots();
      await handleInspect(status.path);
      if (onRefresh) onRefresh();
    } catch {
      onLogNotification('Error', 'Failed to register reboot deletion.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearReboots = async () => {
    try {
      await api.clearPendingRebootDeletions();
      setPendingReboots([]);
      onLogNotification('Pending Queue Cleared', 'PendingFileRenameOperations has been reset.', 'info');
    } catch {
      onLogNotification('Error', 'Failed to clear pending reboot operations.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-card via-card to-amber-500/10 border border-border rounded-2xl p-6 relative overflow-hidden shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                <Unlock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-primary tracking-tight">
                  Process Unlocker & Reboot Eraser
                </h1>
                <p className="text-xs text-text-muted">
                  Bypass "File in Use" errors • Terminate locking handles or queue kernel-level eradication on reboot
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Path Inspection Bar */}
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Paste absolute file or folder path (e.g. C:\Program Files\StuckApp\locked.dll)..."
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInspect()}
              className="w-full bg-surface/80 border border-border rounded-xl px-4 py-2.5 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-amber-400 transition-all"
            />
          </div>

          <button
            onClick={() => handleInspect()}
            disabled={!targetPath.trim() || isInspecting}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <Lock className={`w-3.5 h-3.5 ${isInspecting ? 'animate-spin' : ''}`} />
            <span>{isInspecting ? 'Inspecting Locks...' : 'Inspect Locks'}</span>
          </button>
        </div>
      </div>

      {/* Inspection Results Section */}
      {status && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
            <div>
              <span className="text-[11px] font-medium text-text-muted">Inspected Path:</span>
              <div className="text-xs font-mono font-bold text-text-primary break-all select-all mt-0.5">
                {status.path}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  status.is_locked
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-accent-secondary/15 text-accent-secondary border-accent-secondary/30'
                }`}
              >
                {status.is_locked ? 'File is Locked' : 'File is Unlocked'}
              </span>

              {status.is_scheduled_reboot && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/30 flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Reboot Scheduled</span>
                </span>
              )}
            </div>
          </div>

          {/* Locking Processes List */}
          <div>
            <h3 className="text-xs font-bold text-text-primary mb-3 flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-text-muted" />
              <span>Locking Processes ({status.locking_processes.length})</span>
            </h3>

            {status.locking_processes.length === 0 ? (
              <div className="bg-surface/50 rounded-xl p-4 text-center border border-border/60">
                <CheckCircle2 className="w-8 h-8 text-accent-secondary mx-auto mb-1.5" />
                <p className="text-xs font-medium text-text-primary">No active Windows process handles found locking this item.</p>
                <p className="text-[11px] text-text-muted mt-0.5">The file may be read-only or restricted by NTFS permissions.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {status.locking_processes.map((proc) => (
                  <div
                    key={proc.pid}
                    className="bg-surface border border-border rounded-xl p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-text-secondary text-xs font-mono">
                        {proc.pid}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-text-primary">{proc.name}</div>
                        <div className="text-[10px] font-mono text-text-muted break-all">
                          {proc.exe_path}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/20">
                      Active Lock
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isProcessing}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-red-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>Terminate Processes & Delete Now</span>
            </button>

            <button
              onClick={() => setShowRebootConfirm(true)}
              disabled={isProcessing || status.is_scheduled_reboot}
              className="flex items-center space-x-2 px-4 py-2 bg-surface hover:bg-surface/80 border border-border text-text-secondary hover:text-text-primary rounded-xl text-xs font-medium transition-all"
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>
                {status.is_scheduled_reboot ? 'Already Queued for Reboot' : 'Queue Deletion on Next Windows Reboot'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Pending Reboot Deletions Drawer */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Clock className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-sm font-bold text-text-primary">
                Pending Reboot Eradication Queue ({pendingReboots.length})
              </h2>
              <p className="text-[11px] text-text-muted">
                Files scheduled via Windows Session Manager <code className="font-mono text-text-secondary">PendingFileRenameOperations</code>
              </p>
            </div>
          </div>

          {pendingReboots.length > 0 && (
            <button
              onClick={handleClearReboots}
              className="px-3 py-1.5 bg-surface hover:bg-surface/80 border border-border text-xs text-text-muted hover:text-text-primary rounded-xl transition-all"
            >
              Clear Queue
            </button>
          )}
        </div>

        {pendingReboots.length === 0 ? (
          <div className="bg-surface/40 rounded-xl p-5 text-center border border-border/40">
            <CheckCircle2 className="w-6 h-6 text-accent-secondary mx-auto mb-1 opacity-70" />
            <p className="text-xs text-text-muted">No pending reboot operations registered in the Windows registry.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingReboots.map((item, idx) => (
              <div
                key={idx}
                className="bg-surface border border-border/70 rounded-xl px-4 py-2 text-xs font-mono text-text-secondary flex items-center justify-between select-all"
              >
                <span className="truncate mr-3">{item}</span>
                <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 flex-shrink-0 font-semibold">
                  Will Eradicate at Boot
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Immediate Unlock & Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        title="Force Unlock & Eradicate File?"
        message={`This will forcefully terminate all ${status?.locking_processes.length || 0} locking processes and immediately delete "${status?.path}". Ensure unsaved data in those processes is saved.`}
        confirmLabel="Force Kill & Eradicate"
        isDangerous={true}
        onConfirm={handleUnlockAndDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Reboot Scheduling Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showRebootConfirm}
        title="Schedule Kernel-Level Deletion on Reboot?"
        message={`Syntax Uninstaller will register "${status?.path}" with the Windows kernel Session Manager. The file will be cleanly eliminated before any Windows services or drivers load during the next restart.`}
        confirmLabel="Schedule for Reboot"
        onConfirm={handleScheduleReboot}
        onCancel={() => setShowRebootConfirm(false)}
      />
    </div>
  );
};
