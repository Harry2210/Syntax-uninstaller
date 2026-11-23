import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  PageId,
  InstalledApp,
  WindowsApp,
  StartupItem,
  WinService,
  ScheduledTaskItem,
  ProcessInfo,
  BrowserExtension,
  CleanCategory,
  SystemSpecs,
  NotificationItem,
} from './types';
import { api } from './services/api';
import { Sidebar } from './components/layout/Sidebar';
import { TitleBar } from './components/layout/TitleBar';
import { FloatingWidget } from './components/common/FloatingWidget';
import { PageSkeleton } from './components/common/PageSkeleton';
import { ToastStack, ToastItem } from './components/common/ToastStack';
import { CommandPalette } from './components/common/CommandPalette';
import { OnboardingModal } from './components/common/OnboardingModal';
import { AppUpdateModal } from './components/common/AppUpdateModal';
import { AppUpdateManifest, checkAppUpdate } from './services/appUpdater';
import { Sparkles, Download, X } from 'lucide-react';
import {
  AppSettings,
  ResolvedTheme,
  applyAppearance,
  loadSettings,
  saveSettings,
  watchSystemTheme,
} from './services/preferences';
import { windowsAppToInstalledApp } from './services/appMerge';

/*
 * PERFORMANCE: every page is now its own JavaScript chunk.
 * Previously all 36 pages (+ their icons and charts) were bundled into one
 * script that had to be parsed before anything appeared on screen.
 * Vite splits them automatically thanks to these dynamic imports.
 */
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const AllProgramsPage = lazy(() => import('./pages/AllProgramsPage').then((m) => ({ default: m.AllProgramsPage })));
const WindowsAppsPage = lazy(() => import('./pages/WindowsAppsPage').then((m) => ({ default: m.WindowsAppsPage })));
const ForcedUninstallPage = lazy(() => import('./pages/ForcedUninstallPage').then((m) => ({ default: m.ForcedUninstallPage })));
const QuickUninstallPage = lazy(() => import('./pages/QuickUninstallPage').then((m) => ({ default: m.QuickUninstallPage })));
const MultipleUninstallPage = lazy(() => import('./pages/MultipleUninstallPage').then((m) => ({ default: m.MultipleUninstallPage })));
const HunterModePage = lazy(() => import('./pages/HunterModePage').then((m) => ({ default: m.HunterModePage })));
const TracedProgramsPage = lazy(() => import('./pages/TracedProgramsPage').then((m) => ({ default: m.TracedProgramsPage })));
const InstallationMonitorPage = lazy(() => import('./pages/InstallationMonitorPage').then((m) => ({ default: m.InstallationMonitorPage })));
const LogsDatabasePage = lazy(() => import('./pages/LogsDatabasePage').then((m) => ({ default: m.LogsDatabasePage })));
const StartupManagerPage = lazy(() => import('./pages/StartupManagerPage').then((m) => ({ default: m.StartupManagerPage })));
const ServicesManagerPage = lazy(() => import('./pages/ServicesManagerPage').then((m) => ({ default: m.ServicesManagerPage })));
const ScheduledTasksPage = lazy(() => import('./pages/ScheduledTasksPage').then((m) => ({ default: m.ScheduledTasksPage })));
const BrowserExtensionsPage = lazy(() => import('./pages/BrowserExtensionsPage').then((m) => ({ default: m.BrowserExtensionsPage })));
const ProcessManagerPage = lazy(() => import('./pages/ProcessManagerPage').then((m) => ({ default: m.ProcessManagerPage })));
const SoftwareUpdaterPage = lazy(() => import('./pages/SoftwareUpdaterPage').then((m) => ({ default: m.SoftwareUpdaterPage })));
const ContextMenuPage = lazy(() => import('./pages/ContextMenuPage').then((m) => ({ default: m.ContextMenuPage })));
const JunkCleanerPage = lazy(() => import('./pages/JunkCleanerPage').then((m) => ({ default: m.JunkCleanerPage })));
const SpaceAnalyzerPage = lazy(() => import('./pages/SpaceAnalyzerPage').then((m) => ({ default: m.SpaceAnalyzerPage })));
const WindowsCleanerPage = lazy(() => import('./pages/WindowsCleanerPage').then((m) => ({ default: m.WindowsCleanerPage })));
const PrivacyDebloaterPage = lazy(() => import('./pages/PrivacyDebloaterPage').then((m) => ({ default: m.PrivacyDebloaterPage })));
const BrowserCleanerPage = lazy(() => import('./pages/BrowserCleanerPage').then((m) => ({ default: m.BrowserCleanerPage })));
const OfficeCleanerPage = lazy(() => import('./pages/OfficeCleanerPage').then((m) => ({ default: m.OfficeCleanerPage })));
const EvidenceRemoverPage = lazy(() => import('./pages/EvidenceRemoverPage').then((m) => ({ default: m.EvidenceRemoverPage })));
const SecureDeletePage = lazy(() => import('./pages/SecureDeletePage').then((m) => ({ default: m.SecureDeletePage })));
const WindowsToolsPage = lazy(() => import('./pages/WindowsToolsPage').then((m) => ({ default: m.WindowsToolsPage })));
const ToolboxPage = lazy(() => import('./pages/ToolboxPage').then((m) => ({ default: m.ToolboxPage })));
const UnlockerPage = lazy(() => import('./pages/UnlockerPage').then((m) => ({ default: m.UnlockerPage })));
const SystemReportPage = lazy(() => import('./pages/SystemReportPage').then((m) => ({ default: m.SystemReportPage })));
const RegistryToolsPage = lazy(() => import('./pages/RegistryToolsPage').then((m) => ({ default: m.RegistryToolsPage })));
const BackupManagerPage = lazy(() => import('./pages/BackupManagerPage').then((m) => ({ default: m.BackupManagerPage })));
const SystemInfoPage = lazy(() => import('./pages/SystemInfoPage').then((m) => ({ default: m.SystemInfoPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));

const ONBOARDING_KEY = 'syntax_onboarding_done';
const TOAST_LIFETIME_MS = 5200;

/** Runs `cb` once the browser has a free moment, so heavy scans never block typing. */
function whenIdle(cb: () => void): number {
  const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
  if (typeof w.requestIdleCallback === 'function') {
    return w.requestIdleCallback(cb, { timeout: 1500 });
  }
  return window.setTimeout(cb, 320);
}

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<AppUpdateManifest | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [hasDismissedUpdateBanner, setHasDismissedUpdateBanner] = useState(false);

  // Check for new Syntax Uninstaller updates on application launch via GitHub Gist
  useEffect(() => {
    let mounted = true;
    const checkForUpdatesOnBoot = async () => {
      try {
        const res = await checkAppUpdate();
        if (mounted && res.hasUpdate && res.manifest) {
          setAvailableUpdate(res.manifest);
          setIsUpdateModalOpen(true);
        }
      } catch {}
    };

    const t = window.setTimeout(checkForUpdatesOnBoot, 1200);
    return () => {
      mounted = false;
      window.clearTimeout(t);
    };
  }, []);

  const mainRef = useRef<HTMLElement>(null);
  const toastTimers = useRef<Map<string, number>>(new Map());
  const prefersReducedMotion = useReducedMotion();

  // One single interface — the old Beginner/Pro mode flag is gone for good.
  useEffect(() => {
    localStorage.removeItem('syntax_simple_mode');
  }, []);

  // Appearance: dark / light / match Windows, plus optional high contrast.
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');

  useEffect(() => {
    setResolvedTheme(applyAppearance(settings));
    saveSettings(settings);
  }, [settings]);

  // Follow Windows when "Match Windows" is selected.
  useEffect(() => {
    if (settings.theme !== 'system') return;
    return watchSystemTheme(() => setResolvedTheme(applyAppearance(settings)));
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  // Core application data states
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [windowsApps, setWindowsApps] = useState<WindowsApp[]>([]);
  const [startupItems, setStartupItems] = useState<StartupItem[]>([]);
  const [services, setServices] = useState<WinService[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTaskItem[]>([]);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [extensions, setExtensions] = useState<BrowserExtension[]>([]);
  const [junkCategories, setJunkCategories] = useState<CleanCategory[]>([]);
  const [specs, setSpecs] = useState<SystemSpecs | null>(null);

  // Notification center
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-boot',
      title: 'Syntax Engine Initialized',
      message: 'System scanning engine active. Memory and Registry protections online.',
      level: 'info',
      timestamp: new Date().toISOString(),
      read: false,
    },
  ]);

  // Transient toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      toastTimers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /**
   * Every page reports operations through this callback. It feeds both the
   * persistent Notification Center and a transient toast, so the result of an
   * action is always visible. Identity is stable so it is safe in effect deps.
   */
  const addNotification = useCallback(
    (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => {
      const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: NotificationItem = {
        id,
        title,
        message,
        level,
        timestamp: new Date().toISOString(),
        read: false,
      };
      setNotifications((prev) => [item, ...prev].slice(0, 250));

      setToasts((prev) => [...prev.slice(-2), { id, title, message, level }]);
      const timer = window.setTimeout(() => {
        toastTimers.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_LIFETIME_MS);
      toastTimers.current.set(id, timer);
    },
    []
  );

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => (prev.some((n) => !n.read) ? prev.map((n) => ({ ...n, read: true })) : prev));
  }, []);

  // Clear any pending toast timers on unmount
  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  /** Fast, high-visibility data: apps + hardware + processes. */
  const loadPrimaryData = useCallback(async () => {
    setIsLoadingApps(true);
    try {
      const [specsRes, appsRes, processesRes] = await Promise.allSettled([
        api.getSystemSpecs(),
        api.getInstalledApps(),
        api.getProcesses(),
      ]);

      if (specsRes.status === 'fulfilled') setSpecs(specsRes.value);
      if (appsRes.status === 'fulfilled') setApps(appsRes.value);
      if (processesRes.status === 'fulfilled') setProcesses(processesRes.value);

      // Surface a real problem instead of silently showing an empty app
      if (appsRes.status === 'rejected') {
        setBootError('The native scanning engine did not respond. Some lists may be empty.');
      } else {
        setBootError(null);
      }
    } finally {
      setIsLoadingApps(false);
    }
  }, []);

  /** Slower scans (PowerShell / registry) are deferred until the UI is idle. */
  const loadBackgroundData = useCallback(async () => {
    const results = await Promise.allSettled([
      api.getWindowsApps(),
      api.getStartupItems(),
      api.getServices(),
      api.getScheduledTasks(),
      api.getBrowserExtensions(),
    ]);

    if (results[0].status === 'fulfilled') setWindowsApps(results[0].value);
    if (results[1].status === 'fulfilled') setStartupItems(results[1].value);
    if (results[2].status === 'fulfilled') setServices(results[2].value);
    if (results[3].status === 'fulfilled') setScheduledTasks(results[3].value);
    if (results[4].status === 'fulfilled') setExtensions(results[4].value);
  }, []);

  const loadAllData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadPrimaryData(), loadBackgroundData()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadPrimaryData, loadBackgroundData]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await loadPrimaryData();
      if (cancelled) return;
      whenIdle(() => {
        if (!cancelled) loadBackgroundData();
      });
    };

    boot();
    return () => {
      cancelled = true;
    };
  }, [loadPrimaryData, loadBackgroundData]);

  // First-run tour, shown after the first paint so it never blocks startup.
  useEffect(() => {
    if (localStorage.getItem(ONBOARDING_KEY) !== 'true') {
      const timer = window.setTimeout(() => setIsOnboardingOpen(true), 700);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const closeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsOnboardingOpen(false);
  }, []);

  const navigate = useCallback((page: PageId) => {
    setCurrentPage(page);
    mainRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Mark the activity feed read when the user opens it.
  useEffect(() => {
    if (currentPage === 'notifications') markAllNotificationsRead();
  }, [currentPage, markAllNotificationsRead]);

  // Global shortcuts: Ctrl/Cmd+K opens search, Ctrl/Cmd+R re-scans the PC.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifier = event.ctrlKey || event.metaKey;
      if (!isModifier) return;

      const key = event.key.toLowerCase();
      if (key === 'k') {
        event.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
      if (key === 'r') {
        // Do not hijack Ctrl+R while the user is typing in a search field.
        const target = event.target as HTMLElement | null;
        const isTyping =
          !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        if (isTyping) return;
        // In the desktop shell there is no browser page to reload; make the
        // documented shortcut actually refresh the scan instead.
        event.preventDefault();
        loadAllData();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loadAllData]);

  const totalJunkBytes = useMemo(
    () => junkCategories.reduce((acc, c) => acc + c.total_size_bytes, 0),
    [junkCategories]
  );

  /**
   * Registry apps + Windows Store (MSIX) packages in a single list, so modern
   * apps such as Claude appear in the Uninstaller instead of only on the
   * Windows Apps page.
   */
  const allApps = useMemo(
    () =>
      [...apps, ...windowsApps.map(windowsAppToInstalledApp)].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [apps, windowsApps]
  );
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const pageTransition = prefersReducedMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <DashboardPage
            onNavigate={navigate}
            specs={specs}
            apps={allApps}
            windowsApps={windowsApps}
            startupItems={startupItems}
            services={services}
            processes={processes}
            junkCategories={junkCategories}
            totalJunkBytes={totalJunkBytes}
            onRefresh={loadAllData}
            onLogNotification={addNotification}
            bootError={bootError}
          />
        );
      case 'all-programs':
        return (
          <AllProgramsPage
            apps={apps}
            windowsApps={windowsApps}
            onRefresh={loadAllData}
            onLogNotification={addNotification}
            isLoading={isLoadingApps}
          />
        );
      case 'windows-apps':
        return <WindowsAppsPage apps={windowsApps} onRefresh={loadAllData} onLogNotification={addNotification} />;
      case 'forced-uninstall':
        return <ForcedUninstallPage onLogNotification={addNotification} />;
      case 'quick-uninstall':
        return <QuickUninstallPage apps={apps} onRefresh={loadAllData} onLogNotification={addNotification} />;
      case 'multiple-uninstall':
        return <MultipleUninstallPage apps={apps} onRefresh={loadAllData} onLogNotification={addNotification} />;
      case 'hunter-mode':
        return <HunterModePage onLogNotification={addNotification} />;
      case 'traced-programs':
        return <TracedProgramsPage onLogNotification={addNotification} />;
      case 'installation-monitor':
        return <InstallationMonitorPage onLogNotification={addNotification} />;
      case 'logs-database':
        return <LogsDatabasePage onLogNotification={addNotification} />;
      case 'startup-manager':
        return <StartupManagerPage items={startupItems} onRefresh={loadAllData} onLogNotification={addNotification} />;
      case 'software-updater':
        return <SoftwareUpdaterPage onRefresh={loadAllData} onLogNotification={addNotification} />;
      case 'context-menu':
        return <ContextMenuPage onRefresh={loadAllData} onLogNotification={addNotification} />;
      case 'services-manager':
        return <ServicesManagerPage services={services} onRefresh={loadAllData} onLogNotification={addNotification} />;
      case 'scheduled-tasks':
        return <ScheduledTasksPage tasks={scheduledTasks} onRefresh={loadAllData} onLogNotification={addNotification} />;
      case 'browser-extensions':
        return <BrowserExtensionsPage extensions={extensions} onRefresh={loadAllData} onLogNotification={addNotification} />;
      case 'process-manager':
        return <ProcessManagerPage processes={processes} onRefresh={loadAllData} onLogNotification={addNotification} />;
      case 'junk-cleaner':
        return <JunkCleanerPage categories={junkCategories} onRefresh={loadAllData} onLogNotification={addNotification} />;
      case 'space-analyzer':
        return <SpaceAnalyzerPage specs={specs} onLogNotification={addNotification} />;
      case 'windows-cleaner':
        return <WindowsCleanerPage onRefresh={loadAllData} onLogNotification={addNotification} />;
      case 'privacy-debloater':
        return <PrivacyDebloaterPage onRefresh={loadAllData} onLogNotification={addNotification} />;
      case 'browser-cleaner':
        return <BrowserCleanerPage onRefresh={loadAllData} onLogNotification={addNotification} />;
      case 'office-cleaner':
        return <OfficeCleanerPage onRefresh={loadAllData} onLogNotification={addNotification} />;
      case 'evidence-remover':
        return <EvidenceRemoverPage onLogNotification={addNotification} />;
      case 'secure-delete':
        return <SecureDeletePage onLogNotification={addNotification} />;
      case 'toolbox':
        return <ToolboxPage onNavigate={navigate} />;
      case 'windows-tools':
        return <WindowsToolsPage onLogNotification={addNotification} />;
      case 'file-unlocker':
        return <UnlockerPage onRefresh={loadAllData} onLogNotification={addNotification} />;
      case 'system-report':
        return <SystemReportPage onLogNotification={addNotification} />;
      case 'registry-tools':
        return <RegistryToolsPage onLogNotification={addNotification} />;
      case 'backup-manager':
        return <BackupManagerPage onLogNotification={addNotification} />;
      case 'system-info':
        return <SystemInfoPage specs={specs} />;
      case 'notifications':
        return <NotificationsPage notifications={notifications} onClearAll={clearNotifications} />;
      case 'help':
        return <AboutPage />;
      case 'settings':
        return (
          <SettingsPage
            settings={settings}
            onChange={updateSettings}
            onLogNotification={addNotification}
          />
        );
      case 'about':
        return <AboutPage />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0A0E1A] text-text-primary antialiased font-sans select-none relative">
      {/* Sleek Custom Windows 11 TitleBar */}
      <TitleBar
        availableUpdate={availableUpdate}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
      />

      {/* Main App Canvas */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <Sidebar
          currentPage={currentPage}
          onSelectPage={navigate}
          unreadNotificationsCount={unreadCount}
        />

        {/* Large Rounded Dark Glass Container matching reference screenshot */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto m-2 mr-3 mb-2.5 p-6 rounded-3xl bg-[#0D1322]/95 border border-white/[0.06] shadow-2xl relative"
        >
          {/* Top Banner when a new update is found via GitHub Gist */}
          {availableUpdate && !hasDismissedUpdateBanner && (
            <div className="mb-5 p-3.5 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs animate-fade-in shadow-xl shadow-emerald-500/5 relative z-20">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl flex-shrink-0">
                  <Sparkles className="w-4 h-4 animate-spin-slow" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="font-bold text-white tracking-wide">
                      Syntax Uninstaller v{availableUpdate.version} is now available!
                    </p>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      New Release
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {availableUpdate.name || 'A newer version with enhancements and fixes is ready for download.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                  onClick={() => setIsUpdateModalOpen(true)}
                  className="flex items-center space-x-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl shadow-md shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Update Now</span>
                </button>
                <button
                  onClick={() => setHasDismissedUpdateBanner(true)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Dismiss banner"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <motion.div
            key={currentPage}
            initial={pageTransition.initial}
            animate={pageTransition.animate}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <Suspense fallback={<PageSkeleton />}>{renderCurrentPage()}</Suspense>
          </motion.div>
        </main>
      </div>

      <FloatingWidget specs={specs} onNavigate={navigate} />

      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onNavigate={navigate}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={closeOnboarding}
      />

      <AppUpdateModal
        isOpen={isUpdateModalOpen}
        manifest={availableUpdate}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
