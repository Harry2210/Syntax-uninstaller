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
  const [scanStep, setScanStep] = useState('');
  const [isCleaning, setIsCleaning] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cleanProgress, setCleanProgress] = useState(0);
  const [cleanStep, setCleanStep] = useState('');
  const [cleanModalOpen, setCleanModalOpen] = useState(false);
  const [cleanCompleted, setCleanCompleted] = useState(false);
  const [freedStats, setFreedStats] = useState<{ count: number; mb: string }>({ count: 0, mb: '0' });

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
    setScanStep('Initializing file system scanner...');
    try {
      await new Promise((r) => setTimeout(r, 600));
      setScanStep('Scanning Windows %TEMP% & AppData caches...');
      await new Promise((r) => setTimeout(r, 700));
      setScanStep('Analyzing browser caches & installer archives...');
      await new Promise((r) => setTimeout(r, 700));
      setScanStep('Calculating reclaimable disk space...');

      const fresh = await api.scanJunkFiles();
      setCategories(fresh);
      onLogNotification('Junk Scan Complete', `Scanned ${fresh.length} temporary file categories.`, 'info');
    } finally {
      setIsScanning(false);
      setScanStep('');
    }
  };

  const handleClean = async () => {
    setShowConfirm(false);
    setIsCleaning(true);
    setCleanModalOpen(true);
    setCleanCompleted(false);
    setCleanProgress(15);
    setCleanStep('Scanning and unlocking target files...');

    try {
      await new Promise((r) => setTimeout(r, 800));
      setCleanProgress(45);
      setCleanStep('Purging orphaned application caches & logs...');

      await new Promise((r) => setTimeout(r, 900));
      setCleanProgress(75);
      setCleanStep('Clearing system crash dumps & installer packages...');

      const allPaths = categories
        .filter((c) => c.selected)
        .flatMap((c) => c.target_paths);

      const [cleanedCount, freedBytes] = await api.cleanFiles(allPaths);
      await new Promise((r) => setTimeout(r, 700));

      setCleanProgress(100);
      setCleanStep('Compacting storage and validating disk space...');
      setFreedStats({
        count: cleanedCount,
        mb: (freedBytes / (1024 * 1024)).toFixed(1),
      });
      setCleanCompleted(true);

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
      setCleanCompleted(true);
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
    <div className="space-y-6 pb-12 animate-fade-in max-w-5xl select-none">
      {/* Top Banner */}
      <div className="p-5 bg-[#13192B]/90 border border-white/[0.06] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden shadow-xl">
        <LaserScanline active={isScanning || isCleaning} />

        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded-2xl relative shadow-[0_0_16px_rgba(6,182,212,0.25)]">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Clean Junk Files &amp; Cache Sweeper</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Safely sweep away temporary caches, browser junk, and old logs to free gigabytes.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            disabled={isScanning || isCleaning}
            onClick={handleScan}
            className="flex items-center space-x-2 px-4 py-2.5 bg-white/[0.05] hover:bg-white/10 border border-white/10 text-xs font-semibold text-white rounded-xl transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{isScanning ? 'Scanning Drives...' : 'Rescan Drives'}</span>
          </button>
          <button
            disabled={selectedCount === 0 || isCleaning || totalSelectedBytes === 0}
            onClick={() => setShowConfirm(true)}
            className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:brightness-110 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
          >
            <Sparkles className={`w-4 h-4 ${isCleaning ? 'animate-spin' : ''}`} />
            <span>{isCleaning ? 'Cleaning Junk...' : `Clean Selected (${(totalSelectedBytes / (1024 * 1024)).toFixed(1)} MB)`}</span>
          </button>
        </div>
      </div>

      {/* Process Animation Banner when scanning */}
      {isScanning && (
        <div className="p-6 bg-[#13192B]/95 border border-cyan-500/30 rounded-2xl shadow-xl space-y-3">
          <ScanningRadar
            label="Deep Scanning System Drives for Clutter"
            sublabel={scanStep || "Checking AppData, LocalLow, Temp, CrashDumps, and Windows Error Reporting logs..."}
          />
          <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-teal-400 h-full w-full animate-pulse" />
          </div>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-[#13192B]/90 border border-white/[0.06] rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-mono">Found Categories</span>
          <p className="text-xl font-bold text-white mt-1">{categories.length} Categories</p>
        </div>
        <div className="p-4 bg-[#13192B]/90 border border-white/[0.06] rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-mono">Reclaimable Storage</span>
          <p className="text-xl font-bold text-cyan-400 mt-1">
            {(categories.reduce((acc, c) => acc + c.total_size_bytes, 0) / (1024 * 1024)).toFixed(1)} MB
          </p>
        </div>
        <div className="p-4 bg-[#13192B]/90 border border-white/[0.06] rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-mono">Selected For Cleanup</span>
          <p className="text-xl font-bold text-purple-400 mt-1">
            {(totalSelectedBytes / (1024 * 1024)).toFixed(1)} MB ({selectedCount} Selected)
          </p>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="space-y-3">
        {categories.map((category) => {
          const mb = (category.total_size_bytes / (1024 * 1024)).toFixed(1);
          return (
            <div
              key={category.id}
              onClick={() => toggleCategory(category.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                category.selected
                  ? 'bg-[#13192B]/90 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                  : 'bg-[#13192B]/60 border-white/[0.04] opacity-70 hover:opacity-100 hover:border-white/10'
              }`}
            >
              <div className="flex items-center space-x-3.5 min-w-0">
                <input
                  type="checkbox"
                  checked={category.selected}
                  onChange={() => {}}
                  className="w-4 h-4 rounded text-cyan-500 focus:ring-0 border-white/20 bg-black/40 cursor-pointer"
                />
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white truncate">{category.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-400 font-mono">
                      {category.file_count} files
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{category.description}</p>
                </div>
              </div>

              <div className="text-right flex-shrink-0 ml-4">
                <span className="text-xs font-bold font-mono text-cyan-400">{mb} MB</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Multi-Stage Cleaning Progress Modal */}
      {cleanModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1322] border border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.35)] rounded-3xl p-7 max-w-lg w-full text-center space-y-6 relative overflow-hidden animate-scale-in">
            <div className="flex flex-col items-center space-y-3">
              {!cleanCompleted ? (
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin" />
                  <Trash2 className="w-8 h-8 text-cyan-400 absolute animate-pulse" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.4)]">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
              )}

              <h3 className="text-xl font-bold text-white tracking-wide">
                {!cleanCompleted ? 'Cleaning Temporary Clutter & Junk...' : 'Junk Cleanup Complete!'}
              </h3>

              <p className="text-xs text-slate-400 max-w-sm">
                {!cleanCompleted
                  ? cleanStep
                  : `Successfully purged ${freedStats.count} files and recovered ${freedStats.mb} MB of free storage.`}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span>Progress</span>
                <span className="font-mono text-cyan-400 font-bold">{cleanProgress}%</span>
              </div>
              <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-400 transition-all duration-300 shadow-[0_0_12px_rgba(6,182,212,0.5)]"
                  style={{ width: `${cleanProgress}%` }}
                />
              </div>
            </div>

            {cleanCompleted && (
              <button
                onClick={() => setCleanModalOpen(false)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:brightness-110 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirm}
        title="Confirm Safe Cleanup"
        message={`Are you sure you want to clean ${selectedCount} selected categories? This will permanently delete approximately ${(totalSelectedBytes / (1024 * 1024)).toFixed(1)} MB of temporary cache and log files.`}
        confirmText="Clean Now"
        isDangerous={true}
        onConfirm={handleClean}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
};
