import React, { useEffect, useState } from 'react';
import { CleanCategory } from '../types';
import { api } from '../services/api';
import { Trash2, Search, CheckCircle2, RefreshCw, AlertTriangle, ShieldCheck, Sparkles, HardDrive, Zap } from 'lucide-react';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { ScanningRadar, LaserScanline } from '../components/common/ProcessAnimation';

interface JunkCleanerPageProps {
  categories: CleanCategory[];
  onRefresh: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const JunkCleanerPage: React.FC<JunkCleanerPageProps> = ({
  categories: initialCategories,
  onRefresh,
  onLogNotification,
}) => {
  const [categories, setCategories] = useState<CleanCategory[]>(initialCategories);
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // The parent loads scan results asynchronously (and again on refresh), so the
  // local copy has to follow the prop — previously it only read it once on mount
  // and kept showing stale/empty data.
  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  const toggleCategory = (id: string) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const fresh = await api.scanJunkFiles();
      setCategories(fresh);
      onLogNotification('Junk Scan Complete', `Scanned ${fresh.length} temporary file categories.`, 'info');
    } finally {
      setIsScanning(false);
    }
  };

  const handleClean = async () => {
    setShowConfirm(false);
    setIsCleaning(true);

    try {
      const allPaths = categories
        .filter((c) => c.selected)
        .flatMap((c) => c.target_paths);

      const [cleanedCount, freedBytes] = await api.cleanFiles(allPaths);
      onLogNotification(
        'Junk Cleanup Complete',
        `Successfully removed ${cleanedCount} temporary files, freeing ${(freedBytes / (1024 * 1024)).toFixed(1)} MB disk space.`,
        'success'
      );
      // Reset cleaned counts
      setCategories((prev) =>
        prev.map((c) => (c.selected ? { ...c, file_count: 0, total_size_bytes: 0, target_paths: [] } : c))
      );
      onRefresh();
    } catch (e: any) {
      onLogNotification('Cleanup Error', String(e), 'error');
    } finally {
      setIsCleaning(false);
    }
  };

  const selectedCount = categories.filter((c) => c.selected).length;
  const totalSelectedBytes = categories
    .filter((c) => c.selected)
    .reduce((acc, c) => acc + c.total_size_bytes, 0);

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-5xl">
      {/* Top Banner */}
      <div className="p-5 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
        <LaserScanline active={isScanning || isCleaning} />

        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-danger/15 text-danger rounded-2xl relative">
            <Trash2 className="w-6 h-6" />
            {isCleaning && <span className="absolute inset-0 rounded-2xl border-2 border-danger animate-ping" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Junk Files &amp; Cache Sweeper</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Identify and safely purge orphaned user temp files, Windows installers, and application crash dumps.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            disabled={isScanning || isCleaning}
            onClick={handleScan}
            className="flex items-center space-x-2 px-4 py-2 bg-surface hover:bg-surface-elevated border border-border text-xs font-semibold text-text-primary rounded-xl transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-primary' : ''}`} />
            <span>{isScanning ? 'Scanning Drives...' : 'Rescan Drives'}</span>
          </button>
          <button
            disabled={selectedCount === 0 || isCleaning || totalSelectedBytes === 0}
            onClick={() => setShowConfirm(true)}
            className="flex items-center space-x-2 px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 transition-all"
          >
            <Sparkles className={`w-4 h-4 ${isCleaning ? 'animate-spin' : ''}`} />
            <span>{isCleaning ? 'Cleaning Junk...' : `Clean Selected (${(totalSelectedBytes / (1024 * 1024)).toFixed(1)} MB)`}</span>
          </button>
        </div>
      </div>

      {/* Process Animation Banner when scanning */}
      {isScanning && (
        <div className="p-6 bg-card border border-primary/30 rounded-2xl shadow-xl">
          <ScanningRadar
            label="Scanning Windows File Systems for Clutter"
            sublabel="Checking AppData, LocalLow, Temp, CrashDumps, and Windows Error Reporting logs..."
          />
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-card border border-border rounded-xl">
          <span className="text-[10px] text-text-muted uppercase font-mono">Found Categories</span>
          <p className="text-xl font-bold text-text-primary mt-1">{categories.length} Categories</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl">
          <span className="text-[10px] text-text-muted uppercase font-mono">Reclaimable Storage</span>
          <p className="text-xl font-bold text-secondary mt-1">
            {(categories.reduce((acc, c) => acc + c.total_size_bytes, 0) / (1024 * 1024)).toFixed(1)} MB
          </p>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl">
          <span className="text-[10px] text-text-muted uppercase font-mono">Selected For Cleanup</span>
          <p className="text-xl font-bold text-primary mt-1">
            {(totalSelectedBytes / (1024 * 1024)).toFixed(1)} MB ({selectedCount} Selected)
          </p>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="space-y-3">
        {categories.map((cat) => (
          <div
            key={cat.id}
            onClick={() => toggleCategory(cat.id)}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              cat.selected
                ? 'bg-card border-primary/40 shadow-sm'
                : 'bg-card/50 border-border opacity-70 hover:opacity-100'
            }`}
          >
            <div className="flex items-center space-x-3.5">
              <input
                type="checkbox"
                checked={cat.selected}
                onChange={() => {}}
                className="rounded border-border text-primary focus:ring-0"
              />
              <div>
                <h4 className="text-xs font-bold text-text-primary">{cat.name}</h4>
                <p className="text-[11px] text-text-muted mt-0.5">{cat.description}</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold font-mono text-secondary">
                {(cat.total_size_bytes / (1024 * 1024)).toFixed(1)} MB
              </span>
              <span className="text-[10px] text-text-muted block font-mono">
                {cat.file_count} files
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Clean Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirm}
        title="Confirm Safe Junk Purge"
        message={`Permanently clean ${selectedCount} selected temporary file categories totaling ${(totalSelectedBytes / (1024 * 1024)).toFixed(1)} MB? This operation only purges safe caches, logs, and temp files.`}
        confirmLabel="Purge Clutter"
        isDanger={true}
        onConfirm={handleClean}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
};
