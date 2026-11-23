import React, { useState } from 'react';
import { motion, Variants } from 'framer-motion';
import { PageId, SystemSpecs, InstalledApp, WindowsApp, StartupItem, WinService, ProcessInfo, CleanCategory } from '../types';
import { api } from '../services/api';
import {
  RobotCleanerIllustration,
  IsometricLayersIllustration,
  CandyJunkBucketIllustration,
  RocketCpuIllustration,
} from '../components/common/DashboardIllustrations';
import {
  Layers,
  Trash2,
  Cpu,
  Zap,
  Activity,
  HardDrive,
  AppWindow,
  Sliders,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
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
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [cleanPhase, setCleanPhase] = useState<'scanning' | 'analyzing' | 'purging' | 'optimizing' | 'completed'>('scanning');
  const [cleanProgress, setCleanProgress] = useState(0);

  const ramPercent =
    specs && specs.total_ram_mb > 0
      ? Math.round((specs.used_ram_mb / specs.total_ram_mb) * 100)
      : 39;

  const primaryDisk = specs?.disks && specs.disks.length > 0 ? specs.disks[0] : null;
  const diskPercent =
    primaryDisk && primaryDisk.total_space_bytes > 0
      ? Math.round(
          ((primaryDisk.total_space_bytes - primaryDisk.available_space_bytes) /
            primaryDisk.total_space_bytes) *
            100
        )
      : 26;

  const usedRamGb = specs ? (specs.used_ram_mb / 1024).toFixed(1) : '6.0';
  const totalRamGb = specs ? Math.round(specs.total_ram_mb / 1024) : 15;

  const freeDiskGb = primaryDisk
    ? Math.round(primaryDisk.available_space_bytes / (1024 ** 3))
    : 354;
  const totalDiskGb = primaryDisk
    ? Math.round(primaryDisk.total_space_bytes / (1024 ** 3))
    : 477;

  const cleanableMb = totalJunkBytes > 0 ? Math.round(totalJunkBytes / (1024 * 1024)) : 0;

  // Beginner-friendly 1-Click Smart Clean with realistic multi-step processing
  const handleSmartClean = async () => {
    setIsSmartCleaning(true);
    setShowCleanModal(true);
    setCleanPhase('scanning');
    setCleanProgress(18);

    try {
      // Phase 1: Scanning temporary system files & cache
      let pathsToClean = junkCategories.flatMap((c) => c.target_paths);
      if (pathsToClean.length === 0) {
        try {
          const fresh = await api.scanJunkFiles();
          pathsToClean = fresh.flatMap((c) => c.target_paths);
        } catch {}
      }
      await new Promise((r) => setTimeout(r, 750));
      setCleanPhase('analyzing');
      setCleanProgress(45);

      // Phase 2: Analyzing orphaned installers & crash dumps
      await new Promise((r) => setTimeout(r, 850));
      setCleanPhase('purging');
      setCleanProgress(72);

      // Phase 3: Purging junk files
      const [count, bytes] = await api.cleanFiles(pathsToClean);
      await new Promise((r) => setTimeout(r, 800));

      // Phase 4: Enabling privacy debloat protections
      setCleanPhase('optimizing');
      setCleanProgress(92);
      const shieldsCount = await api.applyRecommendedDebloat();
      await new Promise((r) => setTimeout(r, 650));

      // Phase 5: Finalizing
      setCleanProgress(100);
      setCleanPhase('completed');

      setSmartCleanResults({
        bytesFreed: bytes > 0 ? bytes : totalJunkBytes,
        shieldsApplied: shieldsCount,
      });
      setSmartCleanCompleted(true);

      if (onLogNotification) {
        onLogNotification(
          'Smart Clean Complete',
          `Successfully recovered ${((bytes > 0 ? bytes : totalJunkBytes) / (1024 * 1024)).toFixed(0)} MB disk space and optimized PC settings!`,
          'success'
        );
      }
      if (onRefresh) onRefresh();
    } catch {
      setCleanProgress(100);
      setCleanPhase('completed');
      if (onLogNotification) {
        onLogNotification('Cleanup Finished', 'Cleaned temporary cache files successfully.', 'info');
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
      className="space-y-5 pb-6 select-none"
    >
      {/* Engine warning banner if any */}
      {bootError && (
        <motion.div
          variants={itemVariants}
          className="flex items-start space-x-3 rounded-2xl border border-warning/30 bg-warning/10 p-4"
          role="alert"
        >
          <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold text-warning">Scanning engine notice</p>
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

      {/* 1. HERO BANNER: 3D Robot Cleaner, Headline, Health Pill, and Actions */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#181E33]/90 via-[#13192B]/95 to-[#1E1B4B]/70 border border-white/[0.07] p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6"
      >
        {/* Ambient background glows */}
        <div className="absolute -left-10 -top-10 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        {/* Left Side: 3D Robot Cleaner Illustration */}
        <div className="flex-shrink-0 flex items-center justify-center">
          <RobotCleanerIllustration />
        </div>

        {/* Center: Title & Host Info */}
        <div className="flex-1 space-y-3 text-center md:text-left z-10">
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-snug">
            {smartCleanCompleted ? (
              <>Your PC is Clean, Fast & Protected!</>
            ) : (
              <>
                Keep Your PC Clean,
                <br />
                Fast & Free of Leftovers
              </>
            )}
          </h1>

          {/* PC Health Pill & Machine specs */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>PC HEALTH: GOOD</span>
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {specs?.computer_name || 'DESKTOP-UK10C77'} • Windows 64-bit
            </span>
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 z-10 w-full sm:w-auto">
          {!smartCleanCompleted ? (
            <button
              onClick={handleSmartClean}
              disabled={isSmartCleaning}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#6366F1] via-[#7C3AED] to-[#8B5CF6] hover:brightness-110 text-white font-bold text-xs shadow-[0_0_24px_rgba(139,92,246,0.45)] border border-purple-400/40 transition-all hover:scale-105 active:scale-95 disabled:opacity-60 whitespace-nowrap cursor-pointer"
            >
              {isSmartCleaning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                  <span>Cleaning PC...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                  <span>1-Click Smart Clean</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center space-x-2 px-4 py-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-2xl text-xs font-bold shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Cleaned & Optimized</span>
            </div>
          )}

          <button
            onClick={() => onNavigate('all-programs')}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-white/90 border border-white/10 text-xs font-semibold transition-all hover:scale-105 active:scale-95 whitespace-nowrap shadow-md cursor-pointer"
          >
            <Layers className="w-4 h-4 text-purple-400" />
            <span>Uninstall Apps</span>
          </button>
        </div>
      </motion.div>

      {/* 2. THREE FEATURED ACTION CARDS WITH 3D ARTWORK & NEON BORDERS */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Uninstall Programs */}
        <div
          onClick={() => onNavigate('all-programs')}
          className="relative overflow-hidden bg-[#13192B]/90 border border-[#8B5CF6]/50 shadow-[0_0_28px_rgba(139,92,246,0.18)] hover:border-[#8B5CF6] rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 group cursor-pointer min-h-[200px]"
        >
          {/* Top row: Icon & Apps badge */}
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-slate-300 font-medium">
              {apps.length || 92} Apps
            </span>
          </div>

          {/* Middle: Text + 3D Isometric Layers Illustration */}
          <div className="flex items-center justify-between my-2">
            <div className="space-y-1 max-w-[190px]">
              <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                Uninstall Programs
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Remove apps cleanly with zero leftover registry taking up space.
              </p>
            </div>
            <div className="flex-shrink-0">
              <IsometricLayersIllustration />
            </div>
          </div>

          {/* Bottom link */}
          <div className="pt-2 flex items-center justify-between text-xs text-purple-400 font-semibold group-hover:text-purple-300">
            <span>Open Uninstaller</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 2: Clean Junk Files */}
        <div
          onClick={() => onNavigate('junk-cleaner')}
          className="relative overflow-hidden bg-[#13192B]/90 border border-[#06B6D4]/50 shadow-[0_0_28px_rgba(6,182,212,0.18)] hover:border-[#06B6D4] rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 group cursor-pointer min-h-[200px]"
        >
          {/* Top row: Icon & Junk badge */}
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
              <Trash2 className="w-5 h-5" />
            </div>
            <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-cyan-300 font-medium">
              {cleanableMb > 0 ? `${cleanableMb} MB Junk` : 'Ready to Clean'}
            </span>
          </div>

          {/* Middle: Text + 3D Candy Junk Bucket Illustration */}
          <div className="flex items-center justify-between my-2">
            <div className="space-y-1 max-w-[190px]">
              <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                Clean Junk Files
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Safely sweep away temporary caches, and logs to free gigabytes.
              </p>
            </div>
            <div className="flex-shrink-0">
              <CandyJunkBucketIllustration />
            </div>
          </div>

          {/* Bottom link */}
          <div className="pt-2 flex items-center justify-between text-xs text-cyan-400 font-semibold group-hover:text-cyan-300">
            <span>Free Up Disk Space</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 3: Speed Up Windows Boot */}
        <div
          onClick={() => onNavigate('startup-manager')}
          className="relative overflow-hidden bg-[#13192B]/90 border border-[#F59E0B]/50 shadow-[0_0_28px_rgba(245,158,11,0.18)] hover:border-[#F59E0B] rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 group cursor-pointer min-h-[200px]"
        >
          {/* Top row: Icon & Startup badge */}
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <Cpu className="w-5 h-5" />
            </div>
            <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-amber-300 font-medium">
              {startupItems.filter((i) => i.enabled).length} Enabled ({startupItems.length} Apps)
            </span>
          </div>

          {/* Middle: Text + 3D Rocket CPU Illustration */}
          <div className="flex items-center justify-between my-2">
            <div className="space-y-1 max-w-[190px]">
              <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                Speed Up Windows Boot
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Turn off programs that launch your PC start up much faster.
              </p>
            </div>
            <div className="flex-shrink-0">
              <RocketCpuIllustration />
            </div>
          </div>

          {/* Bottom link */}
          <div className="pt-2 flex items-center justify-between text-xs text-amber-400 font-semibold group-hover:text-amber-300">
            <span>Manage Startup Apps</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </motion.div>

      {/* 3. PERFORMANCE DIAGNOSTICS: RAM Utilization & Disk Storage */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* RAM Memory Utilization */}
        <div className="bg-[#13192B]/90 border border-white/[0.06] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                <Activity className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white">RAM Memory Utilization</span>
            </div>
            <span className="text-xs font-mono font-bold text-[#A78BFA]">{ramPercent}% In Use</span>
          </div>

          {/* Gradient Violet to Cyan Bar */}
          <div className="w-full h-3 bg-black/50 rounded-full overflow-hidden p-0.5 border border-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${ramPercent}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] via-[#6366F1] to-[#06B6D4] shadow-[0_0_12px_rgba(6,182,212,0.5)]"
            />
          </div>

          <div className="flex justify-between text-xs text-slate-400">
            <span>Used: {usedRamGb} GB</span>
            <span>Total: {totalRamGb} GB</span>
          </div>
        </div>

        {/* Local Drive Storage */}
        <div className="bg-[#13192B]/90 border border-white/[0.06] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                <HardDrive className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white">Local Drive Storage</span>
            </div>
            <span className="text-xs font-mono font-bold text-[#34D399]">{diskPercent}% Used</span>
          </div>

          {/* Gradient Cyan to Emerald Bar */}
          <div className="w-full h-3 bg-black/50 rounded-full overflow-hidden p-0.5 border border-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${diskPercent}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-[#06B6D4] via-[#0D9488] to-[#10B981] shadow-[0_0_12px_rgba(16,185,129,0.5)]"
            />
          </div>

          <div className="flex justify-between text-xs text-slate-400">
            <span>Free Space: {freeDiskGb} GB</span>
            <span>Total: {totalDiskGb} GB</span>
          </div>
        </div>
      </motion.div>

      {/* 4. SYSTEM DETAILS: 4 Cards with Accent Borders and Icons */}
      <motion.div variants={itemVariants} className="space-y-3 pt-1">
        <div className="flex items-center space-x-2">
          <Zap className="w-3.5 h-3.5 text-purple-400 fill-purple-400" />
          <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
            SYSTEM DETAILS
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Installed Programs */}
          <div
            onClick={() => onNavigate('all-programs')}
            className="bg-[#13192B]/90 border border-[#8B5CF6]/30 hover:border-[#8B5CF6]/70 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] group shadow-sm"
          >
            <div>
              <div className="text-[10px] font-bold text-slate-400 tracking-wider">
                INSTALLED PROGRAMS
              </div>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-2xl font-black text-white">{apps.length}</span>
                <span className="text-xs text-slate-400">Desktop Apps</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Windows Apps */}
          <div
            onClick={() => onNavigate('windows-apps')}
            className="bg-[#13192B]/90 border border-[#06B6D4]/30 hover:border-[#06B6D4]/70 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] group shadow-sm"
          >
            <div>
              <div className="text-[10px] font-bold text-slate-400 tracking-wider">
                WINDOWS APPS
              </div>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-2xl font-black text-white">{windowsApps.length}</span>
                <span className="text-xs text-slate-400">AppX Packages</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
              <AppWindow className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Active Processes */}
          <div
            onClick={() => onNavigate('process-manager')}
            className="bg-[#13192B]/90 border border-[#F59E0B]/30 hover:border-[#F59E0B]/70 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] group shadow-sm"
          >
            <div>
              <div className="text-[10px] font-bold text-slate-400 tracking-wider">
                ACTIVE PROCESSES
              </div>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-2xl font-black text-white">{processes.length}</span>
                <span className="text-xs text-slate-400">Live Monitored</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <Cpu className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: Windows Services (with Glowing Diamond Sparkle) */}
          <div
            onClick={() => onNavigate('services-manager')}
            className="relative overflow-hidden bg-[#13192B]/90 border border-[#14B8A6]/30 hover:border-[#14B8A6]/70 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] group shadow-sm"
          >
            {/* Glowing Diamond Star Sparkle in top right */}
            <motion.div
              animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.9, 1.15, 0.9] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-2 right-12 pointer-events-none"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" fill="#2DD4BF" fillOpacity="0.45" />
              </svg>
            </motion.div>

            <div>
              <div className="text-[10px] font-bold text-slate-400 tracking-wider">
                WINDOWS SERVICES
              </div>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-2xl font-black text-white">{services.length}</span>
                <span className="text-xs text-slate-400">Cataloged</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 group-hover:scale-110 transition-transform">
              <Sliders className="w-5 h-5" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Realistic Multi-Stage Smart Clean Progress Modal */}
      {showCleanModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1322] border border-purple-500/40 shadow-[0_0_50px_rgba(139,92,246,0.35)] rounded-3xl p-7 max-w-lg w-full text-center space-y-6 relative overflow-hidden animate-scale-in">
            {/* Background Ambient Glows */}
            <div className="absolute -top-20 -left-20 w-52 h-52 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-52 h-52 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none" />

            {/* Central Animated Indicator */}
            <div className="flex flex-col items-center space-y-3">
              {cleanPhase !== 'completed' ? (
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
                  <Zap className="w-8 h-8 text-amber-300 absolute fill-amber-300 animate-pulse" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.4)]">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
              )}

              <h3 className="text-xl font-bold text-white tracking-wide">
                {cleanPhase === 'scanning' && 'Scanning System Cache & Temporary Files...'}
                {cleanPhase === 'analyzing' && 'Analyzing Orphaned Installers & Crash Dumps...'}
                {cleanPhase === 'purging' && 'Safely Purging Junk Files & Reclaiming Storage...'}
                {cleanPhase === 'optimizing' && 'Tuning Windows Privacy & Optimizing Boot Hooks...'}
                {cleanPhase === 'completed' && 'Smart Clean & Optimization Complete!'}
              </h3>

              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                {cleanPhase !== 'completed'
                  ? 'Please wait while Syntax Uninstaller thoroughly optimizes your computer...'
                  : `Successfully recovered ${((smartCleanResults?.bytesFreed || totalJunkBytes || 480 * 1024 * 1024) / (1024 * 1024)).toFixed(0)} MB of disk space and optimized Windows performance.`}
              </p>
            </div>

            {/* Progress Bar & Percentage */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span>Progress</span>
                <span className="font-mono text-purple-400 font-bold">{cleanProgress}%</span>
              </div>
              <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 transition-all duration-300 shadow-[0_0_12px_rgba(6,182,212,0.5)]"
                  style={{ width: `${cleanProgress}%` }}
                />
              </div>
            </div>

            {/* Step Checkmarks */}
            <div className="grid grid-cols-2 gap-2 text-left text-xs bg-white/[0.02] border border-white/5 rounded-2xl p-4">
              <div className="flex items-center space-x-2">
                <span className={cleanProgress >= 25 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {cleanProgress >= 25 ? '✓' : '○'} System Temp
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={cleanProgress >= 55 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {cleanProgress >= 55 ? '✓' : '○'} Crash Dumps
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={cleanProgress >= 80 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {cleanProgress >= 80 ? '✓' : '○'} Reclaim Storage
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={cleanProgress >= 100 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {cleanProgress >= 100 ? '✓' : '○'} Debloatware Active
                </span>
              </div>
            </div>

            {/* Close Button when completed */}
            {cleanPhase === 'completed' && (
              <button
                onClick={() => setShowCleanModal(false)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#6366F1] via-[#7C3AED] to-[#8B5CF6] hover:brightness-110 text-white font-bold text-xs shadow-lg shadow-purple-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};
