import React, { useState } from 'react';
import { BackupRecord } from '../types';
import { api } from '../services/api';
import { History, ShieldCheck, Download, RotateCcw, Trash2, Plus, Clock, FileCode } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';

interface BackupManagerPageProps {
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const BackupManagerPage: React.FC<BackupManagerPageProps> = ({ onLogNotification }) => {
  const [backups, setBackups] = useState<BackupRecord[]>([
    {
      id: 'bkp-1',
      backup_type: 'Registry',
      target_name: 'Visual Studio Code Pre-Uninstall Backup',
      file_path: 'C:\\Users\\User\\AppData\\Local\\SyntaxUninstaller\\Backups\\VSCode_20260114.reg',
      size_bytes: 48200,
      created_at: '2026-01-14T10:29:45Z',
      notes: 'Automated pre-uninstallation registry hive snapshot',
    },
    {
      id: 'bkp-2',
      backup_type: 'RestorePoint',
      target_name: 'Syntax Uninstaller Baseline Restore Point',
      file_path: 'Windows Volume Shadow Copy Snapshot',
      size_bytes: 524000000,
      created_at: '2026-01-28T14:12:00Z',
      notes: 'System state checkpoint created via Checkpoint-Computer',
    },
    {
      id: 'bkp-3',
      backup_type: 'Registry',
      target_name: 'Discord User Run & Hive Backup',
      file_path: 'C:\\Users\\User\\AppData\\Local\\SyntaxUninstaller\\Backups\\Discord_20260128.reg',
      size_bytes: 14200,
      created_at: '2026-01-28T14:14:10Z',
      notes: 'Pre-uninstall registry backup',
    },
  ]);

  const [confirmRestore, setConfirmRestore] = useState<BackupRecord | null>(null);

  const handleRestore = async (bkp: BackupRecord) => {
    setConfirmRestore(null);
    try {
      await api.restoreRegistryBackup(bkp.file_path);
      onLogNotification('Restore Completed', `Successfully restored backup: ${bkp.target_name}`, 'success');
    } catch (e: any) {
      onLogNotification('Restore Error', String(e), 'error');
    }
  };

  const handleCreateRestorePoint = async () => {
    try {
      const msg = await api.createRestorePoint('Syntax Uninstaller Manual Checkpoint');
      onLogNotification('System Restore Point Created', msg, 'success');
    } catch (e: any) {
      onLogNotification('Restore Point Error', String(e), 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-5xl">
      <div className="p-5 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-secondary/15 text-secondary rounded-2xl">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Backup & Recovery Center</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Review automatically archived Registry snapshots, configuration backups, and Windows System Restore points.
            </p>
          </div>
        </div>

        <button
          onClick={handleCreateRestorePoint}
          className="flex items-center space-x-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create System Restore Point</span>
        </button>
      </div>

      {/* Backups List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {backups.map((bkp) => (
          <div
            key={bkp.id}
            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface/50 transition-colors text-xs"
          >
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-text-primary truncate">{bkp.target_name}</span>
                <StatusBadge status={bkp.backup_type} variant="info" />
              </div>
              <p className="text-[11px] text-text-muted font-mono truncate max-w-lg">
                {bkp.file_path}
              </p>
              <p className="text-[10px] text-text-secondary">
                {new Date(bkp.created_at).toLocaleString()} • {(bkp.size_bytes / 1024).toFixed(0)} KB • {bkp.notes}
              </p>
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-center">
              <button
                onClick={() => setConfirmRestore(bkp)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-secondary/15 hover:bg-secondary/25 text-secondary border border-secondary/30 rounded-xl text-xs font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirmRestore && (
        <ConfirmationDialog
          isOpen={true}
          title={`Restore ${confirmRestore.target_name}`}
          message={`Are you sure you want to restore this ${confirmRestore.backup_type} backup? This will rewrite the registry entries back into Windows.`}
          confirmText="Confirm Restoration"
          cancelText="Cancel"
          onConfirm={() => handleRestore(confirmRestore)}
          onCancel={() => setConfirmRestore(null)}
        />
      )}
    </div>
  );
};
