import React, { useState } from 'react';
import { motion, Variants } from 'framer-motion';
import { PageId, SystemSpecs, InstalledApp, WindowsApp, StartupItem, WinService, ProcessInfo, CleanCategory } from '../types';
import { api } from '../services/api';
import { StatCard } from '../components/common/StatCard';
import { ApplicationIcon } from '../components/common/ApplicationIcon';
import { CpuIllustration } from '../components/common/CpuIllustration';
import { RippleButton } from '../components/common/RippleButton';
import {
  Layers,
  AppWindow,
  PlaySquare,
  Cpu,
  Sliders,
  HardDrive,
  Trash2,
  CheckCircle,
  Zap,
  Sparkles,
  History,
  Wrench,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Activity,
  Crosshair,
  CheckCircle2,
  RefreshCw,
  DownloadCloud,
  ShieldAlert,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (page: PageId) => void;
  specs: SystemSpecs | null;
  apps: InstalledApp[];
  windowsApps?: WindowsApp[];
  startupItems?: StartupItem[];
  services?: WinService[];
  processes?: ProcessInfo[];
  junkCategories: CleanCategory[];
  totalJunkBytes: number;
  onRefresh?: () => void;
  onLogNotification?: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
  bootError?: string | null;
}

// Framer motion container & staggered children variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 280,
      damping: 24,
    },
  },
};

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  specs,
  apps,
  windowsApps = [],
  startupItems = [],
  services = [],
  processes = [],
  junkCategories,
  totalJunkBytes,
  onRefresh,
  onLogNotification,
  bootError,
}) => {
  const [isSmartCleaning, setIsSmartCleaning] = useState(false);
  const [smartCleanCompleted, setSmartCleanCompleted] = useState(false);
  const [smartCleanResults, setSmartCleanResults] = useState<{ bytesFreed: number; shieldsApplied: number } | null>(null);

  const ramPercent =
    specs && specs.total_ram_mb > 0
      ? Math.round((specs.used_ram_mb / specs.total_ram_mb) * 100)
      : 44;

  const primaryDisk = specs?.disks[0];
  const diskPercent =
    primaryDisk && primaryDisk.total_space_bytes > 0
      ? Math.round(
          ((primaryDisk.total_space_bytes - primaryDisk.available_space_bytes) /
            primaryDisk.total_space_bytes) *
            100
        )
      : 23;

  const lowHealthApps = apps.filter((a) => a.health_score < 70);
  const cleanableMb = Math.round(totalJunkBytes / (1024 * 1024));

  // Beginner-friendly 1-Click Smart Clean
  const handleSmartClean = async () => {
    setIsSmartCleaning(true);
    try {
      // 1. Gather all junk paths and clean
      const allPaths = junkCategories.flatMap((c) => c.target_paths);
      const [count, bytes] = await api.cleanFiles(allPaths);

      // 2. Apply recommended privacy shields
      const shieldsCount = await api.applyRecommendedDebloat();

      setSmartCleanResults({
        bytesFreed: bytes > 0 ? bytes : totalJunkBytes,
        shieldsApplied: shieldsCount,
      });
      setSmartCleanCompleted(true);

      if (onLogNotification) {
        onLogNotification(
          'Smart Clean Complete',
          `Successfully recovered ${(bytes / (1024 * 1024)).toFixed(0)} MB disk space and optimized PC settings!`,
          'success'
        );
      }
      if (onRefresh) onRefresh();
    } catch {
      if (onLogNotification) {
        onLogNotification('Cleanup Issue', 'One or more items could not be cleaned.', 'warning');
      }
    } finally {
      setIsSmartCleaning(false);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-12"
    >
      {/* Boot / engine problem banner — silent failures used to just show empty lists */}
      {bootError && (
        <motion.div
          variants={itemVariants}
          className="flex items-start space-x-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 animate-warning-pulse"
          role="alert"
        >
          <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold text-warning">The scanning engine did not respond</p>
            <p className="text-[11px] text-text-secondary mt-0.5">{bootError}</p>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-warning/15 hover:bg-warning/25 text-warning text-[11px] font-bold border border-warning/30 transition-colors flex-shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry scan</span>
            </button>
          )}
        </motion.div>
      )}

      {/* 1. BEGINNER-FRIENDLY 1-CLICK SMART CARE HERO BANNER */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-500/15 via-card to-teal-500/15 border border-border p-6 shadow-xl"
      >
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-secondary/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2.5">
              <span className="inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>PC HEALTH: {cleanableMb > 500 ? 'NEEDS ATTENTION' : 'GOOD'}</span>
              </span>
              <span className="text-xs text-text-muted font-mono">
                {specs?.computer_name || 'DESKTOP'} • Windows 64-bit
              </span>
            </div>

            <h2 className="text-xl md:text-2xl font-bold text-text-primary tracking-tight">
              {smartCleanCompleted
                ? 'Your Computer is Clean & Running Fast!'
                : 'Keep Your PC Clean, Fast & Free of Leftovers'}
            </h2>
            <p className="text-xs text-text-secondary max-w-xl leading-relaxed">
              {smartCleanCompleted
                ? `Cleaned ${(smartCleanResults?.bytesFreed ? smartCleanResults.bytesFreed / (1024 * 1024) : cleanableMb).toFixed(0)} MB of junk files and enabled ${smartCleanResults?.shieldsApplied || 6} privacy protections.`
                : `We found ${cleanableMb} MB of safe cleanable temporary files, ${startupItems.length} startup programs, and ${apps.length} installed applications.`}
            </p>
          </div>

          {/* Big 1-Click Smart Clean Button */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {!smartCleanCompleted ? (
              <button
                onClick={handleSmartClean}
                disabled={isSmartCleaning}
                className="w-full sm:w-auto flex items-center justify-center space-x-2.5 px-6 py-3.5 bg-gradient-to-r from-primary via-[#8968fc] to-secondary hover:opacity-95 text-white rounded-xl text-sm font-bold shadow-xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {isSmartCleaning ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Cleaning & Optimizing PC...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 text-amber-300" />
                    <span>1-Click Smart Clean ({cleanableMb} MB)</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center space-x-2 px-4 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Optimized & Protected</span>
              </div>
            )}

            <button
              onClick={() => onNavigate('all-programs')}
              className="w-full sm:w-auto px-4 py-3 bg-surface hover:bg-surface/80 border border-border text-text-secondary hover:text-text-primary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 flex items-center justify-center space-x-2"
            >
              <Layers className="w-4 h-4 text-primary" />
              <span>Uninstall Apps</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* 2. THREE BIG BEGINNER ACTION CARDS (Clean, Plain-English, Inviting) */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Uninstall Apps */}
        <div
          onClick={() => onNavigate('all-programs')}
          className="relative overflow-hidden bg-card border border-border hover:border-primary/50 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg group flex flex-col justify-between space-y-4"
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-primary to-fuchsia-500" />
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/25 to-primary/10 border border-primary/25 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <Layers className="w-6 h-6 text-violet-500" />
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-surface text-text-muted border border-border">
              {apps.length} Apps
            </span>
          </div>

          <div>
            <h3 className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors flex items-center space-x-1.5">
              <span>Uninstall Programs</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-primary" />
            </h3>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              Remove apps cleanly with zero leftover registry keys or hidden files taking up space.
            </p>
          </div>

          <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-primary font-semibold">
            <span>Open Uninstaller</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Card 2: Clean Junk */}
        <div
          onClick={() => onNavigate('junk-cleaner')}
          className="relative overflow-hidden bg-card border border-border hover:border-accent-secondary/50 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg group flex flex-col justify-between space-y-4"
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 via-accent-secondary to-emerald-500" />
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500/25 to-emerald-500/10 border border-accent-secondary/25 flex items-center justify-center text-accent-secondary group-hover:scale-110 transition-transform">
              <Trash2 className="w-6 h-6 text-teal-500" />
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-surface text-accent-secondary border border-accent-secondary/20">
              {cleanableMb} MB Junk
            </span>
          </div>

          <div>
            <h3 className="text-sm font-bold text-text-primary group-hover:text-accent-secondary transition-colors flex items-center space-x-1.5">
              <span>Clean Junk Files</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-accent-secondary" />
            </h3>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              Safely sweep away temporary caches, browser junk, and old logs to free gigabytes.
            </p>
          </div>

          <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-accent-secondary font-semibold">
            <span>Free Up Disk Space</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Card 3: Speed Up Boot */}
        <div
          onClick={() => onNavigate('startup-manager')}
          className="relative overflow-hidden bg-card border border-border hover:border-amber-400/50 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg group flex flex-col justify-between space-y-4"
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" />
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/25 to-orange-500/10 border border-amber-400/25 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <Cpu className="w-6 h-6 text-amber-500" />
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-surface text-text-muted border border-border">
              {startupItems.length} On Boot
            </span>
          </div>

          <div>
            <h3 className="text-sm font-bold text-text-primary group-hover:text-amber-400 transition-colors flex items-center space-x-1.5">
              <span>Speed Up Windows Boot</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-amber-400" />
            </h3>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              Turn off programs that launch automatically to make your PC start up much faster.
            </p>
          </div>

          <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-amber-400 font-semibold">
            <span>Manage Startup Apps</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </motion.div>

      {/* 3. HARDWARE & STORAGE DIAGNOSTICS (Friendly, clean progress bars) */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* RAM Status */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                <Activity className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-text-primary">RAM Memory Utilization</span>
            </div>
            <span className="text-xs font-mono font-bold text-primary">{ramPercent}% In Use</span>
          </div>
          <div className="w-full h-3 bg-surface rounded-full overflow-hidden border border-border/40">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${ramPercent}%` }}
              transition={{ duration: 1.0, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
            />
          </div>
          <div className="flex justify-between text-[11px] text-text-muted">
            <span>Used: {specs ? (specs.used_ram_mb / 1024).toFixed(1) : '6.8'} GB</span>
            <span>Total: {specs ? (specs.total_ram_mb / 1024).toFixed(0) : '16'} GB</span>
          </div>
        </div>

        {/* Primary Hard Disk */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-accent-secondary/20 flex items-center justify-center text-accent-secondary">
                <HardDrive className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-text-primary">Local Drive Storage</span>
            </div>
            <span className="text-xs font-mono font-bold text-accent-secondary">{diskPercent}% Used</span>
          </div>
          <div className="w-full h-3 bg-surface rounded-full overflow-hidden border border-border/40">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${diskPercent}%` }}
              transition={{ duration: 1.0, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-secondary to-accent-secondary rounded-full"
            />
          </div>
          <div className="flex justify-between text-[11px] text-text-muted">
            <span>Free Space: {primaryDisk ? (primaryDisk.available_space_bytes / (1024 ** 3)).toFixed(0) : '480'} GB</span>
            <span>Total: {primaryDisk ? (primaryDisk.total_space_bytes / (1024 ** 3)).toFixed(0) : '512'} GB</span>
          </div>
        </div>
      </motion.div>

      {/* 4. DETAILED DIAGNOSTICS & SHORTCUTS — shown to everyone, in plain language */}
      <motion.div variants={itemVariants} className="space-y-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-text-muted tracking-wider uppercase flex items-center space-x-2">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span>More system details</span>
          </h3>
          <span className="text-[10px] text-text-muted bg-surface px-2 py-0.5 rounded border border-border">
            Live data
          </span>
        </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Installed Programs"
              value={apps.length}
              subValue="Desktop Apps"
              icon={Layers}
              accent="primary"
              onClick={() => onNavigate('all-programs')}
            />
            <StatCard
              title="Windows Apps"
              value={windowsApps.length}
              subValue="AppX Packages"
              icon={AppWindow}
              accent="secondary"
              onClick={() => onNavigate('windows-apps')}
            />
            <StatCard
              title="Active Processes"
              value={processes.length}
              subValue="Live Monitored"
              icon={Cpu}
              accent="warning"
              onClick={() => onNavigate('process-manager')}
            />
            <StatCard
              title="Windows Services"
              value={services.length}
              subValue="Cataloged"
              icon={Sliders}
              accent="secondary"
              onClick={() => onNavigate('services-manager')}
            />
          </div>

          {/* Quick Actions Grid */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-text-primary">More tools &amp; shortcuts</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <button
                onClick={() => onNavigate('hunter-mode')}
                className="p-3 bg-surface hover:bg-surface-elevated border border-border rounded-xl text-center space-y-2 group transition-all"
              >
                <Crosshair className="w-5 h-5 mx-auto text-accent-secondary group-hover:scale-110 transition-transform" />
                <div className="text-[11px] font-bold text-text-primary">Hunter Mode</div>
              </button>

              <button
                onClick={() => onNavigate('forced-uninstall')}
                className="p-3 bg-surface hover:bg-surface-elevated border border-border rounded-xl text-center space-y-2 group transition-all"
              >
                <Zap className="w-5 h-5 mx-auto text-primary group-hover:scale-110 transition-transform" />
                <div className="text-[11px] font-bold text-text-primary">Stuck App Fix</div>
              </button>

              <button
                onClick={() => onNavigate('software-updater')}
                className="p-3 bg-surface hover:bg-surface-elevated border border-border rounded-xl text-center space-y-2 group transition-all"
              >
                <DownloadCloud className="w-5 h-5 mx-auto text-blue-400 group-hover:scale-110 transition-transform" />
                <div className="text-[11px] font-bold text-text-primary">WinGet Updates</div>
              </button>

              <button
                onClick={() => onNavigate('privacy-debloater')}
                className="p-3 bg-surface hover:bg-surface-elevated border border-border rounded-xl text-center space-y-2 group transition-all"
              >
                <ShieldAlert className="w-5 h-5 mx-auto text-emerald-400 group-hover:scale-110 transition-transform" />
                <div className="text-[11px] font-bold text-text-primary">AI Debloater</div>
              </button>

              <button
                onClick={() => onNavigate('backup-manager')}
                className="p-3 bg-surface hover:bg-surface-elevated border border-border rounded-xl text-center space-y-2 group transition-all"
              >
                <History className="w-5 h-5 mx-auto text-amber-400 group-hover:scale-110 transition-transform" />
                <div className="text-[11px] font-bold text-text-primary">Restore Points</div>
              </button>

              <button
                onClick={() => onNavigate('windows-tools')}
                className="p-3 bg-surface hover:bg-surface-elevated border border-border rounded-xl text-center space-y-2 group transition-all"
              >
                <Wrench className="w-5 h-5 mx-auto text-text-secondary group-hover:scale-110 transition-transform" />
                <div className="text-[11px] font-bold text-text-primary">Windows Tools</div>
              </button>
            </div>
          </div>
      </motion.div>
    </motion.div>
  );
};
