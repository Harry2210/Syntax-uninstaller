export type PageId =
  // Overview
  | 'dashboard'
  // Uninstallation
  | 'all-programs'
  | 'windows-apps'
  | 'forced-uninstall'
  | 'quick-uninstall'
  | 'multiple-uninstall'
  | 'hunter-mode'
  | 'traced-programs'
  | 'installation-monitor'
  | 'logs-database'
  // Management
  | 'startup-manager'
  | 'services-manager'
  | 'scheduled-tasks'
  | 'browser-extensions'
  | 'process-manager'
  | 'software-updater'
  | 'context-menu'
  // Cleanup
  | 'junk-cleaner'
  | 'space-analyzer'
  | 'windows-cleaner'
  | 'browser-cleaner'
  | 'office-cleaner'
  | 'evidence-remover'
  | 'secure-delete'
  | 'privacy-debloater'
  // Tools
  | 'toolbox'
  | 'windows-tools'
  | 'registry-tools'
  | 'backup-manager'
  | 'system-info'
  | 'file-unlocker'
  | 'system-report'
  // General
  | 'notifications'
  | 'help'
  | 'settings'
  | 'about';

export interface InstalledApp {
  id: string;
  name: string;
  publisher: string;
  version: string;
  install_date: string;
  install_location: string;
  estimated_size_kb: number;
  uninstall_string: string;
  quiet_uninstall_string: string;
  display_icon: string;
  registry_source: string;
  architecture: string;
  is_system_component: boolean;
  health_score: number;
  health_notes: string[];
  /** Set when the entry is a Windows Store / MSIX package rather than a registry app. */
  package_full_name?: string;
}

export interface WindowsApp {
  name: string;
  package_full_name: string;
  publisher: string;
  version: string;
  install_location: string;
  non_removable: boolean;
  display_icon?: string;
}

export interface LeftoverItem {
  id: string;
  path: string;
  item_type: 'RegistryKey' | 'RegistryValue' | 'Folder' | 'File';
  scan_level: 'Safe' | 'Moderate' | 'Advanced';
  confidence: number;
  size_bytes: number;
  reason: string;
  is_shared: boolean;
  eligible_for_deletion: boolean;
  selected: boolean;
}

export interface StartupItem {
  id: string;
  name: string;
  command: string;
  location: string;
  user_scope: string;
  enabled: boolean;
  file_exists: boolean;
  publisher?: string;
  impact?: string;
  item_type?: string;
}

export interface WinService {
  name: string;
  display_name: string;
  status: string;
  start_type: string;
}

export interface ScheduledTaskItem {
  name: string;
  path: string;
  state: string;
  author: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_usage: number;
  memory_mb: number;
  exe_path: string;
}

export interface BrowserExtension {
  id: string;
  name: string;
  version: string;
  browser: string;
  profile: string;
  enabled: boolean;
  path: string;
}

export interface CleanCategory {
  id: string;
  name: string;
  description: string;
  target_paths: string[];
  file_count: number;
  total_size_bytes: number;
  selected: boolean;
}

export interface WinTool {
  id: string;
  name: string;
  command: string;
  description: string;
  category: string;
  icon_name: string;
}

export interface DiskInfo {
  name: string;
  mount_point: string;
  total_space_bytes: number;
  available_space_bytes: number;
  file_system: string;
}

export interface SystemSpecs {
  os_name: string;
  os_version: string;
  computer_name: string;
  username: string;
  architecture: string;
  is_admin: boolean;
  cpu_name: string;
  cpu_cores: number;
  total_ram_mb: number;
  used_ram_mb: number;
  available_ram_mb: number;
  disks: DiskInfo[];
}

export interface BackupRecord {
  id: string;
  backup_type: string;
  target_name: string;
  file_path: string;
  size_bytes: number;
  created_at: string;
  notes: string;
}

export interface InstallationTrace {
  id: string;
  app_name: string;
  recorded_at: string;
  new_registry_keys: string[];
  new_files: string[];
  total_size_bytes: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

export interface DebloatItem {
  id: string;
  name: string;
  category: string;
  description: string;
  is_shielded: boolean;
  recommended: boolean;
  service_name?: string;
  impact?: 'Safe' | 'Optional' | 'Advanced';
}

export interface SoftwareUpdate {
  id: string;
  name: string;
  current_version: string;
  available_version: string;
  source: string;
}

/** `queued` → `running` → one of the terminal statuses. */
export type UpdateStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'already-current'
  | 'skipped';

export interface UpdateScan {
  engine_version: string;
  is_admin: boolean;
  updates: SoftwareUpdate[];
  warnings: string[];
  scanned_at: string;
}

export interface UpdateProgress {
  id: string;
  name: string;
  status: UpdateStatus;
  message: string;
  detail: string;
  index: number;
  total: number;
  requires_reboot: boolean;
}

export interface UpdateOutcome {
  id: string;
  name: string;
  status: UpdateStatus;
  message: string;
  new_version: string;
  logs: string[];
  requires_reboot: boolean;
  interactive_retry: boolean;
}

export interface UpdateSummary {
  succeeded: number;
  failed: number;
  already_current: number;
  skipped: number;
  reboot_required: boolean;
  outcomes: UpdateOutcome[];
}

export interface ContextMenuItem {
  id: string;
  name: string;
  menu_type: string;
  registry_path: string;
  clsid: string;
  enabled: boolean;
  is_system: boolean;
}

export interface LockingProcess {
  pid: number;
  name: string;
  exe_path: string;
}

export interface LockedFileStatus {
  path: string;
  exists: boolean;
  is_locked: boolean;
  is_scheduled_reboot: boolean;
  locking_processes: LockingProcess[];
}

export interface SpaceEntry {
  name: string;
  path: string;
  size_bytes: number;
  file_count: number;
  is_dir: boolean;
}

export interface SpaceCategory {
  name: string;
  size_bytes: number;
  file_count: number;
}

export interface SpaceReport {
  root: string;
  scanned_at: string;
  duration_ms: number;
  total_bytes: number;
  file_count: number;
  folder_count: number;
  inaccessible: number;
  truncated: boolean;
  top_folders: SpaceEntry[];
  top_files: SpaceEntry[];
  categories: SpaceCategory[];
}

export interface SpaceScanProgress {
  root: string;
  scanned_bytes: number;
  file_count: number;
  folder_count: number;
  current_path: string;
  elapsed_ms: number;
}
