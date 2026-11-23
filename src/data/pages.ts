import { PageId } from '../types';

/**
 * Single source of truth for page titles, descriptions and search keywords.
 * Used by:
 *  - The Header (title / subtitle / breadcrumb)
 *  - The Ctrl+K command palette (fuzzy search)
 *  - The in-app Help & Guide page
 */
export interface PageMeta {
  title: string;
  subtitle: string;
  /** Extra words a beginner might type when searching (synonyms, slang, tasks) */
  keywords: string[];
}

export const PAGE_META: Record<PageId, PageMeta> = {
  dashboard: {
    title: 'Smart Care & Dashboard',
    subtitle: '1-click PC cleanup, real-time performance, and health status',
    keywords: ['home', 'start', 'overview', 'scan', 'health', 'speed', 'clean', 'smart care'],
  },
  'all-programs': {
    title: 'Installed Applications',
    subtitle: 'Simple, clean app uninstallation with automatic leftover cleanup',
    keywords: ['uninstall', 'remove app', 'programs', 'software list', 'delete app'],
  },
  'windows-apps': {
    title: 'Windows Built-in Apps',
    subtitle: 'Inspect, reset, and safely remove pre-installed Microsoft Store apps',
    keywords: ['store', 'uwp', 'appx', 'msix', 'microsoft store', 'built in apps'],
  },
  'forced-uninstall': {
    title: "Fix Programs That Won't Uninstall",
    subtitle: 'Remove broken or corrupted apps whose normal uninstaller is missing or fails',
    keywords: ['force', 'broken', 'stuck', 'stubborn', 'repair', 'purge', 'cannot uninstall', 'wont uninstall'],
  },
  'quick-uninstall': {
    title: 'Quick Silent Uninstall',
    subtitle: 'One-click automated removal with immediate leftover analysis',
    keywords: ['silent', 'fast', 'quick', 'automatic', 'one click'],
  },
  'multiple-uninstall': {
    title: 'Batch Multi-Uninstall',
    subtitle: 'Sequential automated queue processing for multiple applications',
    keywords: ['batch', 'queue', 'many', 'bulk', 'several apps'],
  },
  'hunter-mode': {
    title: 'Hunter Mode Crosshair',
    subtitle: 'Target any desktop window on screen to instantly identify and remove its source program',
    keywords: ['crosshair', 'target', 'which app', 'identify', 'window', 'drag'],
  },
  'traced-programs': {
    title: 'Traced Programs',
    subtitle: 'Manage recorded setup logs and inspect filesystem and registry snapshots',
    keywords: ['trace', 'snapshot', 'recorded', 'revert', 'undo install'],
  },
  'installation-monitor': {
    title: 'Installation Monitor',
    subtitle: 'Take before/after system snapshots during software installation',
    keywords: ['monitor', 'watch install', 'before after', 'snapshot'],
  },
  'logs-database': {
    title: 'Removal Logs Database',
    subtitle: 'Knowledge base with detection rules and silent flags for popular software',
    keywords: ['logs', 'database', 'history', 'knowledge', 'signatures'],
  },
  'startup-manager': {
    title: 'Startup Speed Optimizer',
    subtitle: 'Stop apps from starting automatically to make your PC boot faster',
    keywords: ['startup', 'boot', 'slow boot', 'autostart', 'login items', 'speed up'],
  },
  'services-manager': {
    title: 'Windows Services Manager',
    subtitle: 'Control background services, change start types, and identify third-party services',
    keywords: ['service', 'background', 'daemon', 'start type', 'windows service'],
  },
  'scheduled-tasks': {
    title: 'Scheduled Tasks Inventory',
    subtitle: 'View, enable, or disable background tasks scheduled in Windows Task Scheduler',
    keywords: ['schedule', 'task scheduler', 'automation', 'cron', 'recurring'],
  },
  'browser-extensions': {
    title: 'Browser Extensions Manager',
    subtitle: 'Audit and inspect extensions installed in Chrome, Edge, and Firefox profiles',
    keywords: ['extension', 'addon', 'chrome', 'edge', 'firefox', 'plugin'],
  },
  'process-manager': {
    title: 'Running Apps & Processes',
    subtitle: 'See what is running right now, how much memory and CPU it uses, and close it if needed',
    keywords: ['process', 'task manager', 'cpu', 'ram', 'kill', 'running', 'close app', 'not responding'],
  },
  'software-updater': {
    title: 'Software Updater',
    subtitle: 'Detect outdated software and apply 1-click silent background patches',
    keywords: ['update', 'upgrade', 'outdated', 'winget', 'patches', 'new version'],
  },
  'context-menu': {
    title: 'Right-Click Menu Cleaner',
    subtitle: 'Declutter right-click menus in File Explorer and remove unwanted shortcuts',
    keywords: ['context menu', 'right click', 'shell', 'explorer menu', 'clutter'],
  },
  'junk-cleaner': {
    title: 'Junk Files Cleaner',
    subtitle: 'Safely sweep temporary files, crash dumps, and disk clutter to free space',
    keywords: ['junk', 'temp', 'disk space', 'free space', 'cache', 'cleanup'],
  },
  'space-analyzer': {
    title: 'Disk Space Map',
    subtitle: 'See what is really using your drive, folder by folder, without deleting anything',
    keywords: [
      'disk',
      'space',
      'storage',
      'large files',
      'what is using my disk',
      'drive full',
      'folder sizes',
      'space map',
    ],
  },
  'windows-cleaner': {
    title: 'Windows Privacy Cleaner',
    subtitle: 'Clean recent document histories, explorer caches, and system traces',
    keywords: ['privacy', 'recent files', 'history', 'thumbnails', 'traces'],
  },
  'privacy-debloater': {
    title: 'Windows Debloatware',
    subtitle: 'Disconnect unwanted background services, silence telemetry, and block AI bloat',
    keywords: ['debloat', 'debloatware', 'privacy', 'telemetry', 'services', 'tracking', 'copilot', 'recall', 'ads', 'wersvc', 'xbox'],
  },
  'browser-cleaner': {
    title: 'Browser Data Cleaner',
    subtitle: 'Clean web caches, temporary assets, and history from supported browsers',
    keywords: ['browser', 'cache', 'cookies', 'history', 'chrome', 'edge', 'firefox'],
  },
  'office-cleaner': {
    title: 'Microsoft Office Cleaner',
    subtitle: 'Clear Office document caches, recent templates, and synchronizer temporary files',
    keywords: ['office', 'word', 'excel', 'document cache', 'templates'],
  },
  'evidence-remover': {
    title: 'Deleted-File Wiper',
    subtitle: 'Overwrite empty disk space so deleted files can no longer be recovered',
    keywords: ['evidence', 'wipe', 'forensic', 'free space', 'shred', 'privacy', 'recover deleted'],
  },
  'secure-delete': {
    title: 'Secure File Shredder',
    subtitle: 'Irreversibly overwrite and shred sensitive files and folders beyond standard recovery',
    keywords: ['shred', 'secure delete', 'destroy', 'wipe file', 'dod', 'irreversible'],
  },
  toolbox: {
    title: 'All Tools',
    subtitle: 'Every tool in one searchable list, grouped by what it does',
    keywords: ['tools', 'all tools', 'index', 'directory', 'everything', 'menu', 'more'],
  },
  'windows-tools': {
    title: 'Windows Administration Tools',
    subtitle: 'Fast one-click access to native Windows management utilities',
    keywords: ['tools', 'taskmgr', 'regedit', 'control panel', 'utilities', 'launcher'],
  },
  'file-unlocker': {
    title: 'Locked File Unlocker',
    subtitle: 'Bypass "File in Use" errors and schedule stubborn files to delete on restart',
    keywords: ['lock', 'in use', 'unlock', 'delete on reboot', 'cannot delete'],
  },
  'system-report': {
    title: 'PC Health Report',
    subtitle: 'A certified summary of your software footprint and registry state you can save',
    keywords: ['report', 'certificate', 'audit', 'diagnostic', 'export html', 'health'],
  },
  'registry-tools': {
    title: 'Registry Utilities',
    subtitle: 'Safely inspect, export, and back up application-specific registry keys',
    keywords: ['registry', 'regedit', 'reg file', 'hive', 'export'],
  },
  'backup-manager': {
    title: 'Backup & Recovery Manager',
    subtitle: 'Manage Registry snapshots, restore points, and recovery archives',
    keywords: ['backup', 'restore', 'snapshot', 'recovery', 'undo', 'safety'],
  },
  'system-info': {
    title: 'PC Specs & Hardware',
    subtitle: 'Your processor, memory, Windows version and disk space at a glance',
    keywords: ['specs', 'hardware', 'cpu', 'ram', 'disk', 'windows version', 'about pc', 'system information'],
  },
  notifications: {
    title: 'Notification Center',
    subtitle: 'Log of recent operations, uninstallation events, and system alerts',
    keywords: ['alerts', 'activity', 'messages', 'log', 'events'],
  },
  help: {
    title: 'Help & Beginner Guide',
    subtitle: 'Plain-English walkthrough, safety guide, glossary, and keyboard shortcuts',
    keywords: ['help', 'guide', 'how to', 'tutorial', 'faq', 'learn', 'beginner', 'support'],
  },
  settings: {
    title: 'Application Settings',
    subtitle: 'Configure theme, scanning depth, safety backups, and preferences',
    keywords: ['settings', 'preferences', 'options', 'config', 'theme'],
  },
  about: {
    title: 'About Syntax Uninstaller',
    subtitle: 'Product details, architecture, license, and version status',
    keywords: ['about', 'version', 'license', 'credits', 'info'],
  },
};
