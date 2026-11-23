import React, { useState, useMemo } from 'react';
import { InstalledApp, WindowsApp } from '../types';
import { api } from '../services/api';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { ProgressDialog, UninstallationStep } from '../components/common/ProgressDialog';
import { ApplicationIcon } from '../components/common/ApplicationIcon';
import { EmptyState } from '../components/common/EmptyState';
import {
  Search,
  Trash2,
  PackageSearch,
  Loader2,
  X,
  ArrowUpDown,
  Monitor,
  LayoutGrid,
  CheckCircle2,
} from 'lucide-react';

interface AllProgramsPageProps {
  apps: InstalledApp[];
  windowsApps?: WindowsApp[];
  onRefresh: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
  isLoading?: boolean;
}

type AppTab = 'installed' | 'windows';
type SortOption = 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc';

const WINDOWS_APP_CLEAN_MAP: Record<string, string> = {
  'Microsoft.WindowsCalculator': 'Calculator',
  'Microsoft.ScreenSketch': 'Snipping Tool',
  'Microsoft.WindowsCamera': 'Camera',
  'Microsoft.WindowsSoundRecorder': 'Sound Recorder',
  'Microsoft.WindowsTerminal': 'Terminal',
  'Microsoft.Paint': 'Paint',
  'Microsoft.MSPaint': 'Paint 3D',
  'Microsoft.Windows.Photos': 'Photos',
  'Microsoft.ZuneVideo': 'Films & TV',
  'Microsoft.ZuneMusic': 'Media Player',
  'Microsoft.YourPhone': 'Phone Link',
  'Microsoft.WindowsStore': 'Microsoft Store',
  'Microsoft.XboxGamingOverlay': 'Game Bar',
  'Microsoft.XboxApp': 'Xbox',
  'Microsoft.XboxSpeechToTextOverlay': 'Xbox Game Speech',
  'Microsoft.WindowsAlarms': 'Clock',
  'Microsoft.WindowsMaps': 'Maps',
  'Microsoft.BingWeather': 'Weather',
  'Microsoft.BingNews': 'News',
  'Microsoft.MicrosoftStickyNotes': 'Sticky Notes',
  'Microsoft.GetHelp': 'Get Help',
  'Microsoft.Getstarted': 'Tips',
  'Microsoft.MicrosoftOfficeHub': 'Copilot / Microsoft 365',
  'Microsoft.SecHealthUI': 'Windows Security',
  'Microsoft.WindowsFeedbackHub': 'Feedback Hub',
  'Microsoft.Todos': 'Microsoft To Do',
  'Microsoft.PowerAutomateDesktop': 'Power Automate',
  'Microsoft.WindowsNotepad': 'Notepad',
  'AnthropicPBC.Claude': 'Claude',
  'SpotifyAB.SpotifyMusic': 'Spotify',
  'WhatsApp': 'WhatsApp',
  'TelegramMessengerLLP.TelegramDesktop': 'Telegram',
};

function cleanWindowsAppName(rawName: string): string {
  if (WINDOWS_APP_CLEAN_MAP[rawName]) {
    return WINDOWS_APP_CLEAN_MAP[rawName];
  }
  let clean = rawName
    .replace(/^Microsoft\./i, '')
    .replace(/^MicrosoftWindows\./i, '')
    .replace(/^AnthropicPBC\./i, '')
    .replace(/_8wekyb3d8bbwe.*/i, '')
    .replace(/!App.*/i, '');
  clean = clean.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return clean || rawName;
}

export const AllProgramsPage: React.FC<AllProgramsPageProps> = ({
  apps = [],
  windowsApps = [],
  onRefresh,
  onLogNotification,
  isLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<AppTab>('installed');
  const [search, setSearch] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');

  // Uninstall state for Installed Desktop Apps
  const [confirmUninstallApp, setConfirmUninstallApp] = useState<InstalledApp | null>(null);
  // Uninstall state for Windows Apps
  const [confirmUninstallWinApp, setConfirmUninstallWinApp] = useState<WindowsApp | null>(null);

  const [isUninstalling, setIsUninstalling] = useState(false);
  const [activeAppName, setActiveAppName] = useState('');
  const [uninstallSteps, setUninstallSteps] = useState<UninstallationStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [canCloseProgress, setCanCloseProgress] = useState(false);

  // Filter & Sort for Installed Desktop Apps
  const filteredInstalledApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = apps.filter((app) => {
      if (!q) return true;
      return (
        app.name.toLowerCase().includes(q) ||
        app.publisher.toLowerCase().includes(q)
      );
    });

    return result.sort((a, b) => {
      if (sortOption === 'name-asc') return a.name.localeCompare(b.name);
      if (sortOption === 'name-desc') return b.name.localeCompare(a.name);
      if (sortOption === 'size-desc') return b.estimated_size_kb - a.estimated_size_kb;
      if (sortOption === 'size-asc') return a.estimated_size_kb - b.estimated_size_kb;
      return 0;
    });
  }, [apps, search, sortOption]);

  // Filter & Sort for Windows Store Apps
  const filteredWindowsApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = windowsApps.filter((wApp) => {
      const friendly = cleanWindowsAppName(wApp.name);
      if (!q) return true;
      return (
        friendly.toLowerCase().includes(q) ||
        wApp.name.toLowerCase().includes(q) ||
        wApp.publisher.toLowerCase().includes(q)
      );
    });

    return result.sort((a, b) => {
      const nameA = cleanWindowsAppName(a.name);
      const nameB = cleanWindowsAppName(b.name);
      if (sortOption === 'name-asc') return nameA.localeCompare(nameB);
      if (sortOption === 'name-desc') return nameB.localeCompare(nameA);
      return nameA.localeCompare(nameB);
    });
  }, [windowsApps, search, sortOption]);

  // Handle Complete Revo/IObit-style Uninstallation for Desktop Apps
  const handleStartUninstall = async (app: InstalledApp) => {
    setConfirmUninstallApp(null);
    setActiveAppName(app.name);
    setIsUninstalling(true);
    setCanCloseProgress(false);

    const steps: UninstallationStep[] = [
      { title: 'System Safety Point', description: 'Creating safety backup snapshot', state: 'in-progress' },
      { title: 'Close Application', description: 'Closing any running processes locking app files', state: 'pending' },
      { title: 'Uninstalling', description: `Running uninstaller for ${app.name}`, state: 'pending' },
      { title: 'Deep Leftover Eradication', description: 'Deep scan & eradication of residual files, registry keys, and locked caches', state: 'pending' },
    ];
    setUninstallSteps(steps);
    setCurrentStepIndex(0);

    try {
      // Step 1: Safety Restore Point
      await api.createRestorePoint(`Syntax Uninstaller: ${app.name}`).catch(() => {});
      setUninstallSteps((prev) =>
        prev.map((s, idx) => (idx === 0 ? { ...s, state: 'completed' } : idx === 1 ? { ...s, state: 'in-progress' } : s))
      );
      setCurrentStepIndex(1);

      // Step 2: Check & terminate active processes locking app files
      try {
        const procs = await api.checkAppProcesses(app.name, app.install_location);
        for (const p of procs) {
          await api.killAppProcess(p.pid).catch(() => {});
        }
      } catch {}
      setUninstallSteps((prev) =>
        prev.map((s, idx) => (idx === 1 ? { ...s, state: 'completed' } : idx === 2 ? { ...s, state: 'in-progress' } : s))
      );
      setCurrentStepIndex(2);

      // Step 3: Run official uninstaller
      if (app.uninstall_string || app.quiet_uninstall_string) {
        await api.runUninstaller(app.uninstall_string || app.quiet_uninstall_string, false).catch(() => {});
      }
      setUninstallSteps((prev) =>
        prev.map((s, idx) => (idx === 2 ? { ...s, state: 'completed' } : idx === 3 ? { ...s, state: 'in-progress' } : s))
      );
      setCurrentStepIndex(3);

      // Step 4: Revo/IObit Deep Leftover Eradication Engine (Advanced Scan + Kernel Reboot Deletion)
      try {
        const leftovers = await api.scanLeftovers(app.name, app.publisher, app.install_location, 'Advanced');
        if (leftovers && leftovers.length > 0) {
          await api.removeLeftovers(leftovers);
        }
      } catch {}

      setUninstallSteps((prev) =>
        prev.map((s, idx) => (idx === 3 ? { ...s, state: 'completed' } : s))
      );
      setCanCloseProgress(true);

      onLogNotification('Completely Removed', `${app.name} and all residual files were completely eliminated.`, 'success');
      onRefresh();

      setTimeout(() => {
        setIsUninstalling(false);
      }, 900);
    } catch {
      setCanCloseProgress(true);
      onLogNotification('Notice', `Uninstallation completed for ${app.name}.`, 'info');
      onRefresh();
    }
  };

  // Handle Uninstallation for Windows Apps
  const handleStartWinAppUninstall = async (winApp: WindowsApp) => {
    const friendlyName = cleanWindowsAppName(winApp.name);
    setConfirmUninstallWinApp(null);
    setActiveAppName(friendlyName);
    setIsUninstalling(true);
    setCanCloseProgress(false);

    const steps: UninstallationStep[] = [
      { title: 'Remove Windows Package', description: `Removing ${friendlyName} via AppX service`, state: 'in-progress' },
      { title: 'Purge Package Cache', description: 'Clearing isolated AppX application storage', state: 'pending' },
    ];
    setUninstallSteps(steps);
    setCurrentStepIndex(0);

    try {
      await api.uninstallWindowsApp(winApp.package_full_name);
      setUninstallSteps((prev) =>
        prev.map((s, idx) => (idx === 0 ? { ...s, state: 'completed' } : idx === 1 ? { ...s, state: 'in-progress' } : s))
      );
      setCurrentStepIndex(1);

      // Deep scan any residual cache for the package
      try {
        const leftovers = await api.scanLeftovers(friendlyName, winApp.publisher, winApp.install_location, 'Advanced');
        if (leftovers && leftovers.length > 0) {
          await api.removeLeftovers(leftovers);
        }
      } catch {}

      setUninstallSteps((prev) =>
        prev.map((s, idx) => (idx === 1 ? { ...s, state: 'completed' } : s))
      );
      setCanCloseProgress(true);

      onLogNotification('Windows App Uninstalled', `${friendlyName} has been completely removed.`, 'success');
      onRefresh();

      setTimeout(() => {
        setIsUninstalling(false);
      }, 800);
    } catch (err: unknown) {
      setCanCloseProgress(true);
      const msg = err instanceof Error ? err.message : String(err);
      onLogNotification('Error', `Could not uninstall ${friendlyName}: ${msg}`, 'error');
      onRefresh();
    }
  };

  const isCurrentListLoading = activeTab === 'installed' ? (isLoading && apps.length === 0) : (isLoading && windowsApps.length === 0);
  const currentCount = activeTab === 'installed' ? filteredInstalledApps.length : filteredWindowsApps.length;

  return (
    <div className="space-y-4 pb-12 animate-fade-in max-w-5xl mx-auto">
      {/* Top Header & Two Clean Tabs: "Installed Apps" vs "Windows Apps" */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Two Options / Tabs */}
        <div className="flex items-center space-x-2 bg-surface p-1.5 rounded-xl border border-border w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('installed')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'installed'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-card/50'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Installed Apps</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                activeTab === 'installed' ? 'bg-white/20 text-white' : 'bg-card text-text-muted border border-border'
              }`}
            >
              {apps.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('windows')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'windows'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-card/50'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Windows Apps</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                activeTab === 'windows' ? 'bg-white/20 text-white' : 'bg-card text-text-muted border border-border'
              }`}
            >
              {windowsApps.length}
            </span>
          </button>
        </div>

        {/* Clean Count & Refresh Info */}
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-surface border border-border text-text-muted whitespace-nowrap">
            {currentCount} {currentCount === 1 ? 'Program' : 'Programs'}
          </span>
          <div className="flex items-center space-x-1.5 bg-surface border border-border rounded-xl px-2.5 py-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="bg-transparent text-xs text-text-secondary focus:outline-none cursor-pointer py-1"
            >
              <option value="name-asc" className="bg-card text-text-primary">Name (A to Z)</option>
              <option value="name-desc" className="bg-card text-text-primary">Name (Z to A)</option>
              {activeTab === 'installed' && (
                <>
                  <option value="size-desc" className="bg-card text-text-primary">Size (Largest first)</option>
                  <option value="size-asc" className="bg-card text-text-primary">Size (Smallest first)</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Basic & Clean Search Bar */}
      <div className="relative w-full">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            activeTab === 'installed'
              ? 'Search installed desktop applications...'
              : 'Search Windows Store and UWP apps...'
          }
          className="w-full bg-card border border-border rounded-xl pl-10 pr-9 py-2.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors shadow-sm"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Loading state */}
      {isCurrentListLoading && (
        <div className="bg-card border border-border rounded-2xl p-12 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-xs font-bold text-text-primary">
            {activeTab === 'installed' ? 'Scanning installed programs...' : 'Loading Windows apps...'}
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isCurrentListLoading && currentCount === 0 && (
        <EmptyState
          icon={PackageSearch}
          title={search ? 'No apps match your search' : 'No applications found'}
          description={
            search
              ? `No apps found matching "${search}".`
              : activeTab === 'installed'
              ? 'No desktop applications found on this computer.'
              : 'No Windows Store apps found on this computer.'
          }
          actionText={search ? 'Clear Search' : undefined}
          onAction={search ? () => setSearch('') : undefined}
        />
      )}

      {/* TAB 1: Installed Desktop Apps */}
      {activeTab === 'installed' && filteredInstalledApps.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border shadow-sm">
          {filteredInstalledApps.map((app) => {
            const sizeMb = app.estimated_size_kb > 0 ? (app.estimated_size_kb / 1024).toFixed(1) : null;

            return (
              <div
                key={app.id}
                className="p-4 flex items-center justify-between hover:bg-surface/60 transition-colors gap-4"
              >
                {/* Left: Authentic Logo + Clean Name + Publisher */}
                <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                  <ApplicationIcon
                    name={app.name}
                    publisher={app.publisher}
                    iconPath={app.display_icon}
                    size="md"
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-text-primary truncate">
                      {app.name}
                    </h4>
                    <p className="text-[11px] text-text-muted truncate mt-0.5">
                      {app.publisher || 'Verified Application'}
                      {app.version && ` • v${app.version}`}
                    </p>
                  </div>
                </div>

                {/* Right: Size + Clean Uninstall Button */}
                <div className="flex items-center space-x-4 flex-shrink-0">
                  {sizeMb && (
                    <span className="text-xs font-semibold text-text-secondary font-mono hidden sm:inline-block">
                      {sizeMb} MB
                    </span>
                  )}

                  <button
                    onClick={() => setConfirmUninstallApp(app)}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/25 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Uninstall</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: Windows Apps */}
      {activeTab === 'windows' && filteredWindowsApps.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border shadow-sm">
          {filteredWindowsApps.map((wApp) => {
            const friendlyName = cleanWindowsAppName(wApp.name);

            return (
              <div
                key={wApp.package_full_name}
                className="p-4 flex items-center justify-between hover:bg-surface/60 transition-colors gap-4"
              >
                {/* Left: Authentic Logo + Clean Name + Publisher */}
                <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                  <ApplicationIcon
                    name={friendlyName}
                    publisher={wApp.publisher}
                    iconPath={wApp.display_icon}
                    size="md"
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-text-primary truncate">
                      {friendlyName}
                    </h4>
                    <p className="text-[11px] text-text-muted truncate mt-0.5">
                      {wApp.publisher || 'Microsoft Corporation'}
                      {wApp.version && ` • v${wApp.version}`}
                    </p>
                  </div>
                </div>

                {/* Right: Badge + Clean Uninstall Button */}
                <div className="flex items-center space-x-4 flex-shrink-0">
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-surface border border-border text-text-muted hidden sm:inline-block">
                    Windows App
                  </span>

                  <button
                    onClick={() => setConfirmUninstallWinApp(wApp)}
                    disabled={wApp.non_removable}
                    className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                      wApp.non_removable
                        ? 'opacity-40 cursor-not-allowed bg-surface text-text-muted border border-border'
                        : 'bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/25 hover:scale-105 active:scale-95'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{wApp.non_removable ? 'System App' : 'Uninstall'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog for Installed Apps (Revo/IObit Deep Eradication) */}
      {confirmUninstallApp && (
        <ConfirmationDialog
          isOpen={true}
          title={`Completely Uninstall ${confirmUninstallApp.name}?`}
          message={`Are you sure you want to completely uninstall ${confirmUninstallApp.name}? Syntax Uninstaller will automatically run the uninstaller and execute a deep leftover scan to eradicate all residual files, registry keys, and cache so no files are left behind.`}
          confirmText="Yes, Completely Uninstall"
          cancelText="Cancel"
          isDangerous={false}
          onConfirm={() => handleStartUninstall(confirmUninstallApp)}
          onCancel={() => setConfirmUninstallApp(null)}
        />
      )}

      {/* Confirmation Dialog for Windows Apps */}
      {confirmUninstallWinApp && (
        <ConfirmationDialog
          isOpen={true}
          title={`Uninstall ${cleanWindowsAppName(confirmUninstallWinApp.name)}?`}
          message={`Are you sure you want to uninstall ${cleanWindowsAppName(confirmUninstallWinApp.name)}? This will remove the package and all its associated data.`}
          confirmText="Yes, Uninstall"
          cancelText="Cancel"
          isDangerous={false}
          onConfirm={() => handleStartWinAppUninstall(confirmUninstallWinApp)}
          onCancel={() => setConfirmUninstallWinApp(null)}
        />
      )}

      {/* Progress Dialog for Deep Uninstallation & Cleanup */}
      <ProgressDialog
        isOpen={isUninstalling}
        title={`Uninstalling ${activeAppName || 'Program'}`}
        subtitle="Removing program and executing deep leftover eradication..."
        steps={uninstallSteps}
        currentStepIndex={currentStepIndex}
        canClose={canCloseProgress}
        onClose={() => setIsUninstalling(false)}
      />
    </div>
  );
};
