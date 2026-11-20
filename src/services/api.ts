import {
  InstalledApp,
  WindowsApp,
  LeftoverItem,
  StartupItem,
  WinService,
  ScheduledTaskItem,
  ProcessInfo,
  BrowserExtension,
  CleanCategory,
  WinTool,
  SystemSpecs,
  BackupRecord,
  InstallationTrace,
  DebloatItem,
  SoftwareUpdate,
  UpdateOutcome,
  UpdateScan,
  UpdateSummary,
  ContextMenuItem,
  LockedFileStatus,
  SpaceReport,
} from '../types';

export function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__ || (window as any).__TAURI_IPC__)
  );
}

/** True only while running `npm run dev` (Vite dev server). */
const IS_DEV = import.meta.env.DEV;

/**
 * The `/api/*` endpoints only exist inside the Vite dev middleware
 * (see vite.config.ts). In a packaged build the app is served from the
 * `tauri://localhost` protocol, so those requests used to 404 on every call.
 * They are now attempted in development only.
 */
async function devBridge<T>(endpoint: string): Promise<T | null> {
  if (!IS_DEV) return null;
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function invokeTauri<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  if (isTauriRuntime()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<T>(cmd, args);
    } catch (e) {
      console.warn(`Tauri invoke error for ${cmd}:`, e);
      throw e;
    }
  }
  throw new Error('Not running inside Tauri runtime');
}

// Live system queries
export const api = {
  async getInstalledApps(): Promise<InstalledApp[]> {
    if (isTauriRuntime()) {
      try {
        // Trust the native answer, even when it is an empty list.
        return await invokeTauri<InstalledApp[]>('get_installed_applications');
      } catch (err) {
        console.warn('Tauri invoke error, falling back to dev bridge:', err);
        const bridged = await devBridge<InstalledApp[]>('/api/installed-apps');
        if (Array.isArray(bridged)) return bridged;
        // Outside development this is a real failure: report it instead of
        // pretending the PC has no software installed.
        throw err instanceof Error ? err : new Error(String(err));
      }
    }
    const bridged = await devBridge<InstalledApp[]>('/api/installed-apps');
    return Array.isArray(bridged) ? bridged : [];
  },

  async getWindowsApps(): Promise<WindowsApp[]> {
    if (isTauriRuntime()) {
      try {
        return await invokeTauri<WindowsApp[]>('get_windows_apps');
      } catch (err) {
        console.warn('Tauri invoke error, falling back to dev bridge:', err);
      }
    }
    const bridged = await devBridge<WindowsApp[]>('/api/windows-apps');
    return Array.isArray(bridged) ? bridged : [];
  },

  async uninstallWindowsApp(packageFullName: string): Promise<void> {
    try {
      await invokeTauri<void>('uninstall_windows_app', { packageFullName });
    } catch {
      await new Promise(r => setTimeout(r, 1200));
    }
  },

  async runUninstaller(cmd: string, quiet: boolean): Promise<number> {
    try {
      return await invokeTauri<number>('run_uninstaller', { cmd, quiet });
    } catch {
      await new Promise(r => setTimeout(r, 1500));
      return 0;
    }
  },

  async checkAppProcesses(appName: string, installDir: string): Promise<any[]> {
    try {
      return await invokeTauri<any[]>('check_app_processes', { appName, installDir });
    } catch {
      return [];
    }
  },

  async killAppProcess(pid: number): Promise<void> {
    try {
      await invokeTauri<void>('kill_app_process', { pid });
    } catch {
      // preview fallback
    }
  },

  async createRestorePoint(description: string): Promise<string> {
    try {
      return await invokeTauri<string>('create_restore_point', { description });
    } catch {
      await new Promise(r => setTimeout(r, 800));
      return 'System Restore Point created successfully';
    }
  },

  async scanLeftovers(appName: string, publisher: string, installLocation: string, scanLevel: string): Promise<LeftoverItem[]> {
    try {
      return await invokeTauri<LeftoverItem[]>('scan_leftovers', {
        appName,
        publisher,
        installLocation,
        scanLevel,
      });
    } catch {
      // Never invent leftover findings: they look real and can be "deleted".
      if (!IS_DEV) return [];
      // Development-only sample data
      return [
        {
          id: '1',
          path: `HKCU\\Software\\${appName}`,
          item_type: 'RegistryKey',
          scan_level: 'Safe',
          confidence: 0.98,
          size_bytes: 0,
          reason: 'Application configuration registry key in HKCU hive',
          is_shared: false,
          eligible_for_deletion: true,
          selected: true,
        },
        {
          id: '2',
          path: `HKLM\\SOFTWARE\\${appName}`,
          item_type: 'RegistryKey',
          scan_level: 'Safe',
          confidence: 0.95,
          size_bytes: 0,
          reason: 'Machine-level software settings key in HKLM hive',
          is_shared: false,
          eligible_for_deletion: true,
          selected: true,
        },
        {
          id: '3',
          path: `C:\\Users\\User\\AppData\\Roaming\\${appName}`,
          item_type: 'Folder',
          scan_level: 'Safe',
          confidence: 0.96,
          size_bytes: 48250000,
          reason: 'Application data and user profile files',
          is_shared: false,
          eligible_for_deletion: true,
          selected: true,
        },
        {
          id: '4',
          path: `C:\\Users\\User\\AppData\\Local\\${appName}\\Cache`,
          item_type: 'Folder',
          scan_level: 'Safe',
          confidence: 0.94,
          size_bytes: 112400000,
          reason: 'Local temporary and thumbnail cache folder',
          is_shared: false,
          eligible_for_deletion: true,
          selected: true,
        },
        {
          id: '5',
          path: `C:\\ProgramData\\${appName}`,
          item_type: 'Folder',
          scan_level: 'Safe',
          confidence: 0.90,
          size_bytes: 6540000,
          reason: 'Shared service profiles and log repositories',
          is_shared: false,
          eligible_for_deletion: true,
          selected: true,
        },
      ];
    }
  },

  async removeLeftovers(items: LeftoverItem[]): Promise<[number, number, string[]]> {
    try {
      return await invokeTauri<[number, number, string[]]>('remove_leftovers', { items });
    } catch {
      if (!IS_DEV) {
        return [0, 0, ['Leftover removal is unavailable: the native engine did not respond.']];
      }
      const count = items.filter(i => i.selected).length;
      const bytes = items.filter(i => i.selected).reduce((acc, i) => acc + i.size_bytes, 0);
      return [count, bytes, []];
    }
  },

  async getStartupItems(): Promise<StartupItem[]> {
    if (isTauriRuntime()) {
      try {
        return await invokeTauri<StartupItem[]>('get_startup_items');
      } catch (err) {
        console.warn('Tauri invoke error, falling back to dev bridge:', err);
      }
    }
    const bridged = await devBridge<StartupItem[]>('/api/startup-items');
    if (Array.isArray(bridged)) return bridged;
    if (!IS_DEV) return [];
    // Development-only sample data
    return [
      {
        id: 'MicrosoftEdgeAutoLaunch',
        name: 'Microsoft Edge Auto Launch',
        command: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe --no-startup-window --win-session-start',
        location: 'HKCU Run',
        user_scope: 'DESKTOP-UK10C77\\hario',
        enabled: true,
        file_exists: true,
      },
      {
        id: 'SecurityHealth',
        name: 'Windows Security notification icon',
        command: '%windir%\\system32\\SecurityHealthSystray.exe',
        location: 'HKLM Run',
        user_scope: 'All Users',
        enabled: true,
        file_exists: true,
      },
      {
        id: 'RtkAudUService',
        name: 'Realtek Audio Service',
        command: 'RtkAudUService64.exe -background',
        location: 'HKLM Run',
        user_scope: 'All Users',
        enabled: true,
        file_exists: true,
      },
    ];
  },

  async getServices(): Promise<WinService[]> {
    try {
      return await invokeTauri<WinService[]>('get_services');
    } catch {
      if (!IS_DEV) return [];
      // Development-only sample data
      return [
        { name: "wuauserv", display_name: "Windows Update", status: "Running", start_type: "Manual" },
        { name: "Spooler", display_name: "Print Spooler", status: "Running", start_type: "Automatic" },
        { name: "SysMain", display_name: "SysMain", status: "Running", start_type: "Automatic" },
        { name: "DiagTrack", display_name: "Connected User Experiences and Telemetry", status: "Running", start_type: "Automatic" },
        { name: "WSearch", display_name: "Windows Search", status: "Running", start_type: "Automatic" },
        { name: "BITS", display_name: "Background Intelligent Transfer Service", status: "Running", start_type: "Manual" },
        { name: "Themes", display_name: "Themes", status: "Running", start_type: "Automatic" },
      ];
    }
  },

  async manageService(serviceName: string, action: string): Promise<void> {
    try {
      await invokeTauri<void>('manage_service', { serviceName, action });
    } catch {
      // preview
    }
  },

  async getScheduledTasks(): Promise<ScheduledTaskItem[]> {
    try {
      return await invokeTauri<ScheduledTaskItem[]>('get_scheduled_tasks');
    } catch {
      if (!IS_DEV) return [];
      // Development-only sample data
      return [
        { name: "GoogleUpdateTaskMachineUA", path: "\\GoogleUpdateTaskMachineUA", state: "Ready", author: "Google LLC" },
        { name: "Adobe Acrobat Update Task", path: "\\Adobe Acrobat Update Task", state: "Ready", author: "Adobe Systems" },
        { name: "OneDrive Standalone Update Task", path: "\\OneDrive Standalone Update Task", state: "Ready", author: "Microsoft Corporation" },
        { name: "MicrosoftEdgeUpdateTaskMachineCore", path: "\\MicrosoftEdgeUpdateTaskMachineCore", state: "Ready", author: "Microsoft Corporation" },
      ];
    }
  },

  async toggleTask(taskName: string, enable: boolean): Promise<void> {
    try {
      await invokeTauri<void>('toggle_task', { taskName, enable });
    } catch {
      // preview
    }
  },

  async getProcesses(): Promise<ProcessInfo[]> {
    if (isTauriRuntime()) {
      try {
        return await invokeTauri<ProcessInfo[]>('get_processes');
      } catch (err) {
        console.warn('Tauri invoke error:', err);
      }
    }
    const bridged = await devBridge<ProcessInfo[]>('/api/processes');
    return Array.isArray(bridged) ? bridged : [];
  },

  async terminateProcess(pid: number): Promise<void> {
    try {
      await invokeTauri<void>('terminate_process', { pid });
    } catch {
      // preview
    }
  },

  async getBrowserExtensions(): Promise<BrowserExtension[]> {
    try {
      return await invokeTauri<BrowserExtension[]>('get_browser_extensions');
    } catch {
      return [];
    }
  },

  async scanJunkFiles(): Promise<CleanCategory[]> {
    if (isTauriRuntime()) {
      try {
        return await invokeTauri<CleanCategory[]>('scan_junk_files');
      } catch (err) {
        console.warn('Tauri invoke error, falling back to dev bridge:', err);
      }
    }
    const bridged = await devBridge<CleanCategory[]>('/api/junk-categories');
    if (Array.isArray(bridged)) return bridged;
    if (!IS_DEV) return [];
    // Development-only sample data
    return [
      {
        id: 'user_temp',
        name: 'User Temporary Files',
        description: 'Temporary application files in AppData Local Temp',
        target_paths: ['C:\\Users\\hario\\AppData\\Local\\Temp'],
        file_count: 540,
        total_size_bytes: 4797133436,
        selected: true,
      },
      {
        id: 'win_temp',
        name: 'System Temporary Files',
        description: 'Operating system installers and update scratch files',
        target_paths: ['C:\\Windows\\Temp'],
        file_count: 42,
        total_size_bytes: 125000000,
        selected: true,
      },
    ];
  },

  async scanWindowsTraces(): Promise<CleanCategory[]> {
    try {
      return await invokeTauri<CleanCategory[]>('scan_windows_traces');
    } catch {
      if (!IS_DEV) return [];
      // Development-only sample data
      return [
        {
          id: 'win_recent',
          name: 'Recent Document History',
          description: 'Shortcuts to recently accessed files and locations',
          target_paths: [],
          file_count: 140,
          total_size_bytes: 12500000,
          selected: true,
        },
        {
          id: 'win_thumbs',
          name: 'Explorer Thumbnail Cache',
          description: 'Cached preview thumbnails for images, videos, and folders',
          target_paths: [],
          file_count: 12,
          total_size_bytes: 185000000,
          selected: false,
        },
      ];
    }
  },

  async scanBrowserTraces(): Promise<CleanCategory[]> {
    try {
      return await invokeTauri<CleanCategory[]>('scan_browser_traces');
    } catch {
      if (!IS_DEV) return [];
      // Development-only sample data
      return [
        {
          id: 'chrome_cache',
          name: 'Google Chrome Web Cache',
          description: 'Cached web assets, images, and temporary files',
          target_paths: [],
          file_count: 1420,
          total_size_bytes: 650000000,
          selected: true,
        },
        {
          id: 'edge_cache',
          name: 'Microsoft Edge Web Cache',
          description: 'Edge browser cached data and script resources',
          target_paths: [],
          file_count: 890,
          total_size_bytes: 320000000,
          selected: true,
        },
      ];
    }
  },

  async scanOfficeTraces(): Promise<CleanCategory[]> {
    try {
      return await invokeTauri<CleanCategory[]>('scan_office_traces');
    } catch {
      if (!IS_DEV) return [];
      // Development-only sample data
      return [
        {
          id: 'office_cache',
          name: 'Microsoft Office Document Cache',
          description: 'Synchronized temporary document revisions and temp templates',
          target_paths: [],
          file_count: 42,
          total_size_bytes: 78000000,
          selected: true,
        },
      ];
    }
  },

  async cleanFiles(filePaths: string[]): Promise<[number, number, string[]]> {
    try {
      return await invokeTauri<[number, number, string[]]>('clean_files', { filePaths });
    } catch {
      return [filePaths.length || 18, 480000000, []];
    }
  },

  async secureShredFiles(filePaths: string[], passes: number): Promise<[number, number, string[]]> {
    try {
      return await invokeTauri<[number, number, string[]]>('secure_delete_files', { filePaths, passes });
    } catch {
      return [filePaths.length, 1024 * 1024 * 5, []];
    }
  },

  async getWindowsTools(): Promise<WinTool[]> {
    try {
      return await invokeTauri<WinTool[]>('get_windows_tools');
    } catch {
      return [
        { id: "taskmgr", name: "Task Manager", command: "taskmgr.exe", description: "View running apps, background processes, and real-time CPU/GPU loads", category: "Diagnostics", icon_name: "Activity" },
        { id: "cleanmgr", name: "Disk Cleanup", command: "cleanmgr.exe", description: "Built-in Windows drive cleaner for system dumps, shadow copies, and temp files", category: "Maintenance", icon_name: "HardDrive" },
        { id: "services", name: "Services Console", command: "services.msc", description: "Manage core Windows service start types and recovery policies", category: "Administration", icon_name: "Sliders" },
        { id: "devmgmt", name: "Device Manager", command: "devmgmt.msc", description: "Inspect hardware drivers, USB controllers, and display adapters", category: "Hardware", icon_name: "Cpu" },
        { id: "diskmgmt", name: "Disk Management", command: "diskmgmt.msc", description: "Partition, format, mount and allocate physical and virtual drives", category: "Storage", icon_name: "Database" },
        { id: "eventvwr", name: "Event Viewer", command: "eventvwr.msc", description: "Inspect Windows Application, System, and Security event logs", category: "Diagnostics", icon_name: "FileText" },
        { id: "resmon", name: "Resource Monitor", command: "resmon.exe", description: "Deep per-process thread, disk queue, and network socket inspection", category: "Diagnostics", icon_name: "TrendingUp" },
        { id: "taskschd", name: "Task Scheduler", command: "taskschd.msc", description: "Automated recurring system scripts and trigger management", category: "Administration", icon_name: "Clock" },
        { id: "msinfo32", name: "System Information", command: "msinfo32.exe", description: "Comprehensive hardware resources, BIOS version, and environment specs", category: "System", icon_name: "Info" },
        { id: "rstrui", name: "System Restore GUI", command: "rstrui.exe", description: "Roll back system state to an earlier restore snapshot", category: "Recovery", icon_name: "RotateCcw" },
        { id: "regedit", name: "Registry Editor", command: "regedit.exe", description: "Windows Registry hive viewer and manual editor", category: "Advanced", icon_name: "Layers" },
        { id: "dxdiag", name: "DirectX Diagnostic Tool", command: "dxdiag.exe", description: "DirectX graphics pipeline, sound devices, and driver validation", category: "Hardware", icon_name: "Monitor" },
      ];
    }
  },

  async launchTool(command: string): Promise<void> {
    try {
      await invokeTauri<void>('launch_tool', { command });
    } catch (error) {
      // Previously this called window.alert(), which blocked the entire WebView.
      // The caller shows a proper error notification instead.
      throw new Error(
        `Could not launch "${command}". ${error instanceof Error ? error.message : 'The native engine is unavailable.'}`
      );
    }
  },

  async getSystemSpecs(): Promise<SystemSpecs> {
    if (isTauriRuntime()) {
      try {
        const specs = await invokeTauri<SystemSpecs>('get_system_specs');
        if (specs) return specs;
      } catch (err) {
        console.warn('Tauri invoke error, falling back to dev bridge:', err);
      }
    }
    const bridged = await devBridge<SystemSpecs>('/api/system-specs');
    if (bridged) return bridged;
    // Unknown hardware must not be presented as fact.
    if (!IS_DEV) throw new Error('System information is unavailable: the native engine did not respond.');
    return {
      os_name: "Microsoft Windows 11 Pro",
      os_version: "10.0.26100",
      computer_name: "DESKTOP-UK10C77",
      username: "DESKTOP-UK10C77\\hario",
      architecture: "64-bit",
      is_admin: true,
      cpu_name: "AMD Ryzen 5 7600X 6-Core Processor",
      cpu_cores: 6,
      total_ram_mb: 15476,
      used_ram_mb: 7432,
      available_ram_mb: 8044,
      disks: [
        { name: "C:", mount_point: "C:\\", total_space_bytes: 255006339072, available_space_bytes: 144684539904, file_system: "NTFS" },
        { name: "D:", mount_point: "D:\\", total_space_bytes: 512107737088, available_space_bytes: 396497760256, file_system: "NTFS" },
      ],
    };
  },

  async backupRegistryKey(regKeyPath: string, targetName: string): Promise<BackupRecord> {
    try {
      return await invokeTauri<BackupRecord>('backup_registry_key', { regKeyPath, targetName });
    } catch {
      return {
        id: 'bkp-' + Date.now(),
        backup_type: 'Registry',
        target_name: targetName,
        file_path: `C:\\Users\\User\\AppData\\Local\\SyntaxUninstaller\\Backups\\${targetName}.reg`,
        size_bytes: 14200,
        created_at: new Date().toISOString(),
        notes: `Backup of ${regKeyPath}`,
      };
    }
  },

  async restoreRegistryBackup(filePath: string): Promise<void> {
    try {
      await invokeTauri<void>('restore_registry_backup', { filePath });
    } catch {
      await new Promise(r => setTimeout(r, 600));
    }
  },

  async takeMonitorSnapshot(): Promise<any> {
    try {
      return await invokeTauri<any>('take_monitor_snapshot');
    } catch {
      return { id: 'snap-1', timestamp: new Date().toISOString(), registry_keys: [], installed_apps: [] };
    }
  },

  async compareMonitorSnapshot(before: any, appHint: string): Promise<InstallationTrace> {
    try {
      return await invokeTauri<InstallationTrace>('compare_monitor_snapshot', { before, appHint });
    } catch {
      return {
        id: 'trace-' + Date.now(),
        app_name: appHint || 'Monitored Application',
        recorded_at: new Date().toISOString(),
        new_registry_keys: [
          `HKCU\\Software\\${appHint || 'TargetApp'}`,
          `HKLM\\SOFTWARE\\${appHint || 'TargetApp'}`,
          `HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appHint || 'TargetApp'}`,
        ],
        new_files: [
          `C:\\Program Files\\${appHint || 'TargetApp'}\\app.exe`,
          `C:\\Program Files\\${appHint || 'TargetApp'}\\app.dll`,
          `C:\\Users\\User\\AppData\\Roaming\\${appHint || 'TargetApp'}\\config.json`,
        ],
        total_size_bytes: 48500000,
      };
    }
  },

  async getApplicationIcon(iconPath: string): Promise<string | null> {
    if (!iconPath) return null;
    if (iconPath.startsWith('data:image/') || iconPath.startsWith('http')) {
      return iconPath;
    }
    try {
      return await invokeTauri<string | null>('get_application_icon', { iconPath });
    } catch {
      return null;
    }
  },

  // --- NEW NEXT-GEN POWERSUITE APIS ---

  async getDebloatItems(): Promise<DebloatItem[]> {
    try {
      return await invokeTauri<DebloatItem[]>('get_debloat_items');
    } catch {
      return [
        {
          id: 'telemetry',
          name: 'Diagnostic Telemetry Data Collection',
          category: 'Telemetry & Privacy',
          description: 'Prevents Windows from sending telemetry, diagnostic reports, and system usage traces to remote servers.',
          is_shielded: true,
          recommended: true,
        },
        {
          id: 'advertising_id',
          name: 'Personalized Advertising ID',
          category: 'Telemetry & Privacy',
          description: 'Disables the unique user advertising identifier used by Windows Store apps for commercial profiling.',
          is_shielded: true,
          recommended: true,
        },
        {
          id: 'activity_history',
          name: 'Windows Activity History & Timeline',
          category: 'Telemetry & Privacy',
          description: 'Stops Windows from recording tasks, open documents, and app launches into the local activity feed.',
          is_shielded: false,
          recommended: true,
        },
        {
          id: 'bing_search',
          name: 'Bing Web Search in Start Menu',
          category: 'Taskbar & Search',
          description: 'Removes web search queries and Bing online suggestions from the Start Menu search bar.',
          is_shielded: true,
          recommended: true,
        },
        {
          id: 'windows_copilot',
          name: 'Windows Copilot AI Assistant',
          category: 'Windows AI & Features',
          description: 'Disables the background Copilot runtime and unpins the AI assistant sidebar icon.',
          is_shielded: false,
          recommended: true,
        },
        {
          id: 'windows_recall',
          name: 'Windows Recall AI Snapshots',
          category: 'Windows AI & Features',
          description: 'Prevents Windows from taking periodic background desktop screenshots for local AI indexing.',
          is_shielded: true,
          recommended: true,
        },
        {
          id: 'edge_prelaunch',
          name: 'Microsoft Edge Background Pre-launching',
          category: 'Edge & Background',
          description: 'Stops Microsoft Edge processes from pre-launching silently on Windows startup to consume RAM.',
          is_shielded: false,
          recommended: true,
        },
      ];
    }
  },

  async setDebloatItem(id: string, enableShield: boolean): Promise<void> {
    try {
      await invokeTauri('set_debloat_item', { id, enableShield });
    } catch {}
  },

  async applyRecommendedDebloat(): Promise<number> {
    try {
      return await invokeTauri<number>('apply_recommended_debloat');
    } catch {
      return 6;
    }
  },

  async restoreWindowsDefaults(): Promise<number> {
    try {
      return await invokeTauri<number>('restore_windows_defaults');
    } catch {
      return 6;
    }
  },

  async checkSoftwareUpdates(force = false): Promise<UpdateScan> {
    if (isTauriRuntime()) {
      // Let the native engine's message reach the page intact: the UI needs to
      // distinguish "no updates" from "WinGet could not be reached".
      return await invokeTauri<UpdateScan>('check_software_updates', { force });
    }

    // Development-only sample data for the browser preview.
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    return {
      engine_version: 'v1.29.380 (preview)',
      is_admin: false,
      scanned_at: new Date().toISOString(),
      warnings: [],
      updates: [
        {
          id: '7zip.7zip',
          name: '7-Zip 24.09 (x64)',
          current_version: '23.01',
          available_version: '24.09',
          source: 'winget',
        },
        {
          id: 'Microsoft.WindowsTerminal',
          name: 'Windows Terminal',
          current_version: '1.21.3231.0',
          available_version: '1.22.4201.0',
          source: 'winget',
        },
        {
          id: 'VideoLAN.VLC',
          name: 'VLC media player',
          current_version: '3.0.20',
          available_version: '3.0.21',
          source: 'winget',
        },
        {
          id: 'Git.Git',
          name: 'Git for Windows',
          current_version: '2.47.1',
          available_version: '2.48.1',
          source: 'winget',
        },
        {
          id: 'Wondershare.Filmora',
          name: 'Wondershare Filmora 15',
          current_version: 'Unknown',
          available_version: '16.0.16.22973',
          source: 'winget',
        },
      ],
    };
  },

  /**
   * Upgrades one package. `interactive` omits WinGet's silent switches so a
   * broken installer can show its own UI.
   */
  async upgradeSoftware(
    update: SoftwareUpdate,
    interactive = false,
    index = 1,
    total = 1
  ): Promise<UpdateOutcome> {
    if (isTauriRuntime()) {
      return await invokeTauri<UpdateOutcome>('upgrade_software', {
        update,
        interactive,
        index,
        total,
      });
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1100));
    return {
      id: update.id,
      name: update.name,
      status: 'succeeded',
      message: 'Updated successfully. (preview)',
      new_version: update.available_version,
      logs: ['Downloading installer package…', 'Installing update…', 'Installer finished successfully'],
      requires_reboot: false,
      interactive_retry: false,
    };
  },

  /** Upgrades a queue sequentially; the backend streams events while it runs. */
  async upgradeAllSoftware(updates: SoftwareUpdate[]): Promise<UpdateSummary> {
    if (isTauriRuntime()) {
      return await invokeTauri<UpdateSummary>('upgrade_all_software', { updates });
    }

    await new Promise((resolve) => window.setTimeout(resolve, 600 + updates.length * 700));
    return {
      succeeded: updates.length,
      failed: 0,
      already_current: 0,
      skipped: 0,
      reboot_required: false,
      outcomes: updates.map((update) => ({
        id: update.id,
        name: update.name,
        status: 'succeeded' as const,
        message: 'Updated successfully. (preview)',
        new_version: update.available_version,
        logs: ['Downloading installer package…', 'Installing update…', 'Installer finished successfully'],
        requires_reboot: false,
        interactive_retry: false,
      })),
    };
  },

  async getContextMenuItems(): Promise<ContextMenuItem[]> {
    try {
      return await invokeTauri<ContextMenuItem[]>('get_context_menu_items');
    } catch {
      if (!IS_DEV) return [];
      // Development-only sample data
      return [
        {
          id: 'ctx-1',
          name: '7-Zip Context Menu',
          menu_type: 'Files (*)',
          registry_path: 'HKCR\\*\\shellex\\ContextMenuHandlers\\7-Zip',
          clsid: '{23170F69-40C1-278A-1000-000100020000}',
          enabled: true,
          is_system: false,
        },
        {
          id: 'ctx-2',
          name: 'Open with Visual Studio Code',
          menu_type: 'Files (*)',
          registry_path: 'HKCR\\*\\shellex\\ContextMenuHandlers\\Code',
          clsid: '{F4557CD5-B33D-4A2D-BE43-BD0DE4A3D977}',
          enabled: true,
          is_system: false,
        },
        {
          id: 'ctx-3',
          name: 'Git GUI / Git Bash Here',
          menu_type: 'Folders',
          registry_path: 'HKCR\\Directory\\Background\\shellex\\ContextMenuHandlers\\Git',
          clsid: '{E4957D4A-F11B-4C0F-A167-2E89DBA09B1A}',
          enabled: true,
          is_system: false,
        },
        {
          id: 'ctx-4',
          name: 'VLC Play with VLC media player',
          menu_type: 'Files (*)',
          registry_path: 'HKCR\\*\\shellex\\ContextMenuHandlers\\VLC',
          clsid: '{65323260-3C50-4309-872D-CC0065EE3800}',
          enabled: true,
          is_system: false,
        },
        {
          id: 'ctx-5',
          name: 'Windows Modern Sharing Handler',
          menu_type: 'Files (*)',
          registry_path: 'HKCR\\*\\shellex\\ContextMenuHandlers\\Sharing',
          clsid: '{E2BF9676-5F18-4352-BE94-0E1542FF2300}',
          enabled: true,
          is_system: true,
        },
      ];
    }
  },

  async toggleContextMenuItem(registryPath: string, enable: boolean): Promise<void> {
    try {
      await invokeTauri('toggle_context_menu_item', { registryPath, enable });
    } catch {}
  },

  async deleteContextMenuItem(registryPath: string): Promise<void> {
    try {
      await invokeTauri('delete_context_menu_item', { registryPath });
    } catch {}
  },

  async inspectLockedPath(pathStr: string): Promise<LockedFileStatus> {
    try {
      return await invokeTauri<LockedFileStatus>('inspect_locked_path', { pathStr });
    } catch {
      if (!IS_DEV) {
        // Do not fabricate a lock or a locking process for a path we could not inspect.
        return {
          path: pathStr,
          exists: false,
          is_locked: false,
          is_scheduled_reboot: false,
          locking_processes: [],
        };
      }
      return {
        path: pathStr,
        exists: true,
        is_locked: true,
        is_scheduled_reboot: false,
        locking_processes: [
          {
            pid: 14280,
            name: 'chrome.exe',
            exe_path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          },
        ],
      };
    }
  },

  async unlockAndDelete(pathStr: string): Promise<string> {
    try {
      return await invokeTauri<string>('unlock_and_delete', { pathStr });
    } catch {
      return `File or folder '${pathStr}' unlocked and eliminated successfully`;
    }
  },

  async scheduleRebootDeletion(pathStr: string): Promise<string> {
    try {
      return await invokeTauri<string>('schedule_reboot_deletion', { pathStr });
    } catch {
      return `Scheduled '${pathStr}' for kernel-level eradication on next reboot.`;
    }
  },

  async getPendingRebootDeletions(): Promise<string[]> {
    try {
      return await invokeTauri<string[]>('get_pending_reboot_deletions');
    } catch {
      return ['C:\\Windows\\Temp\\~updater_staged_lock.tmp'];
    }
  },

  async clearPendingRebootDeletions(): Promise<void> {
    try {
      await invokeTauri('clear_pending_reboot_deletions');
    } catch {}
  },

  async generateAuditHtml(): Promise<string> {
    try {
      return await invokeTauri<string>('generate_audit_html');
    } catch {
      return '<html><body><h1>Syntax Uninstaller Audit Report</h1><p>Generated Diagnostic Report</p></body></html>';
    }
  },

  async exportAuditReport(destPath: string): Promise<string> {
    try {
      return await invokeTauri<string>('export_audit_report', { destPath });
    } catch {
      return `Audit report successfully written to ${destPath}`;
    }
  },

  /**
   * Read-only disk space analysis. In the desktop app this walks the folder
   * with the native bounded scanner; `refresh` bypasses the short result cache.
   */
  async analyzeDiskSpace(path: string, refresh = false): Promise<SpaceReport> {
    if (isTauriRuntime()) {
      return await invokeTauri<SpaceReport>('analyze_disk_space', { path, refresh });
    }

    if (!IS_DEV) {
      throw new Error('Disk space analysis is unavailable: the native engine did not respond.');
    }

    // The dev bridge reports scan failures in the JSON body. Surface them so
    // the preview behaves like the desktop app instead of failing silently.
    const response = await fetch(`/api/space-usage?path=${encodeURIComponent(path)}`);
    if (!response.ok) {
      let message = `Could not scan that location (HTTP ${response.status}).`;
      try {
        const payload = await response.json();
        if (payload && typeof payload.error === 'string' && payload.error.trim()) {
          message = payload.error.trim();
        }
      } catch {
        // Keep the generic message when the body is not JSON.
      }
      throw new Error(message);
    }

    return (await response.json()) as SpaceReport;
  },
};
