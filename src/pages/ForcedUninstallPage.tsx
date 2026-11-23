import React, { useState } from 'react';
import { api } from '../services/api';
import { LeftoverItem } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import {
  Zap,
  FolderSearch,
  Search,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Trash2,
  HardDrive,
  FileCode,
} from 'lucide-react';

interface ForcedUninstallPageProps {
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ForcedUninstallPage: React.FC<ForcedUninstallPageProps> = ({
  onLogNotification,
}) => {
  const [targetName, setTargetName] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [scanLevel, setScanLevel] = useState<'Safe' | 'Moderate' | 'Advanced' | 'Aggressive'>('Moderate');
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [findings, setFindings] = useState<LeftoverItem[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetName.trim() && !targetPath.trim()) return;

    setIsScanning(true);
    setHasScanned(false);

    try {
      const results = await api.scanLeftovers(
        targetName.trim() || 'CustomApp',
        '',
        targetPath.trim(),
        scanLevel
      );
      setFindings(results);
      setHasScanned(true);
    } catch (err: any) {
      onLogNotification('Scan Error', String(err), 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handlePurge = async () => {
    setShowConfirm(false);
    setIsRemoving(true);
    try {
      // 1. Automatic safety backup (best-effort)
      await api.backupRegistryKey(`HKCU\\Software\\${targetName || 'Custom'}`, targetName || 'ForcedBackup').catch(() => {});

      // 2. Remove approved items
      const [count, bytes] = await api.removeLeftovers(findings);
      onLogNotification(
        'Forced Purge Successful',
        `Safely eradicated ${count} verified items associated with ${targetName}, reclaiming ${(bytes / (1024 * 1024)).toFixed(1)} MB.`,
        'success'
      );
      setFindings([]);
      setHasScanned(false);
      setTargetName('');
      setTargetPath('');
    } catch (err: any) {
      onLogNotification('Purge Failed', String(err), 'error');
    } finally {
      setIsRemoving(false);
    }
  };

  const selectedCount = findings.filter((f) => f.selected).length;
  const totalBytes = findings.filter((f) => f.selected).reduce((acc, f) => acc + f.size_bytes, 0);

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-5xl">
      {/* Informational Warning Banner */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start space-x-3.5">
        <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl mt-0.5">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="text-xs space-y-1">
          <h4 className="font-bold text-amber-300">Targeted Forced Uninstallation & Deep Sweep</h4>
          <p className="text-text-secondary leading-relaxed">
            Use this tool when an application has a corrupt, missing, or broken uninstaller. Provide the application name or its root directory. Syntax Uninstaller performs a multi-signal scan across Registry hives, AppData, and ProgramData.
          </p>
          <p className="text-amber-400/90 font-medium">
            Protected Windows directories (e.g., C:\Windows, System32) are strictly protected against modification.
          </p>
        </div>
      </div>

      {/* Target Input Form */}
      <form onSubmit={handleScan} className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-5">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center space-x-2">
          <Zap className="w-4 h-4 text-primary" />
          <span>Identify Target Application</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Exact or Known Program Name
            </label>
            <input
              type="text"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              placeholder="e.g. BrokenProgram, Discord, Toolbar"
              className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Known Installation Directory or Executable (Optional)
            </label>
            <input
              type="text"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="e.g. C:\Program Files\BrokenProgram"
              className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:outline-none focus:border-primary font-mono"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-center space-x-2 text-xs flex-wrap gap-y-1">
            <span className="text-text-muted font-medium">Scan Thoroughness:</span>
            {(['Safe', 'Moderate', 'Advanced', 'Aggressive'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setScanLevel(level)}
                className={`px-3 py-1 rounded-lg border text-xs font-semibold transition-all ${
                  scanLevel === level
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-surface text-text-secondary border-border hover:text-text-primary'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={isScanning || (!targetName.trim() && !targetPath.trim())}
            className="flex items-center justify-center space-x-2 px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-primary/20 transition-all"
          >
            <Search className="w-4 h-4" />
            <span>{isScanning ? 'Deep Scanning...' : 'Scan for Associated Traces'}</span>
          </button>
        </div>
      </form>

      {/* Results View */}
      {hasScanned && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary">
                Discovered Traces ({findings.length} items)
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Total size: {(totalBytes / (1024 * 1024)).toFixed(1)} MB • {selectedCount} selected for purge
              </p>
            </div>

            <button
              disabled={selectedCount === 0 || isRemoving}
              onClick={() => setShowConfirm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-danger hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>Purge Selected Items</span>
            </button>
          </div>

          {findings.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-xs">
              No matching files or Registry entries discovered under the selected scan criteria.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {findings.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3 bg-surface border border-border rounded-xl flex items-start space-x-3 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={(e) => {
                      const next = [...findings];
                      next[idx].selected = e.target.checked;
                      setFindings(next);
                    }}
                    className="mt-1 rounded border-border text-primary focus:ring-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 truncate max-w-lg">
                        <span className="font-semibold font-mono text-text-primary truncate">
                          {item.path}
                        </span>
                        {item.reason.includes('SQLite Database') && (
                          <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded uppercase tracking-wider">
                            DB Verified
                          </span>
                        )}
                        {item.scan_level === 'Aggressive' && (
                          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded uppercase tracking-wider">
                            Aggressive
                          </span>
                        )}
                      </div>
                      <StatusBadge status={item.item_type} variant={item.item_type === 'RegistryKey' ? 'info' : 'success'} />
                    </div>
                    <p className="text-[11px] text-text-secondary mt-1">{item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirm}
        title="Confirm Forced Purge"
        message={`You are about to irreversibly remove ${selectedCount} files and Registry entries associated with ${targetName}. Syntax Uninstaller will automatically export a safety Registry backup prior to deletion.`}
        details={findings.filter((f) => f.selected).map((f) => f.path)}
        confirmText="Confirm & Permanently Remove"
        cancelText="Abort"
        isDangerous={true}
        requireCheckbox={true}
        onConfirm={handlePurge}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
};
