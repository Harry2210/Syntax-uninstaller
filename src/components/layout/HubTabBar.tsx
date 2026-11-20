import React from 'react';
import { PageId } from '../../types';
import {
  Layers,
  AppWindow,
  Zap,
  FastForward,
  CheckSquare,
  Crosshair,
  FileSearch,
  Activity,
  Database,
  Trash2,
  Sparkles,
  Compass,
  FileSpreadsheet,
  EyeOff,
  Flame,
  PlaySquare,
  Cpu,
  Sliders,
  Clock,
  Globe,
  Wrench,
  KeyRound,
  History,
  Info,
  ShieldAlert,
  DownloadCloud,
  MousePointerClick,
  Unlock,
  FileCheck,
  PieChart,
} from 'lucide-react';

export type HubId = 'uninstaller' | 'cleanup' | 'management' | 'tools';

interface SubTab {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const HUB_CONFIG: Record<HubId, { title: string; subtitle: string; tabs: SubTab[] }> = {
  uninstaller: {
    title: 'Uninstaller Workspace',
    subtitle: 'Complete application removal, Windows app store packages, and surgical leftover cleanup',
    tabs: [
      { id: 'all-programs', label: 'Installed Apps', icon: Layers },
      { id: 'windows-apps', label: 'Windows Apps', icon: AppWindow },
      { id: 'quick-uninstall', label: 'Quick Uninstall', icon: FastForward },
      { id: 'multiple-uninstall', label: 'Batch Uninstall', icon: CheckSquare },
      { id: 'forced-uninstall', label: 'Stuck Apps', icon: Zap },
      { id: 'hunter-mode', label: 'Hunter Mode', icon: Crosshair },
      { id: 'installation-monitor', label: 'Install Monitor', icon: Activity },
      { id: 'traced-programs', label: 'Tracked Setups', icon: FileSearch },
      { id: 'logs-database', label: 'Removal Logs', icon: Database },
    ],
  },
  cleanup: {
    title: 'Clean & Privacy Center',
    subtitle: 'Purge junk files, temporary caches, browsing traces, and shred sensitive data',
    tabs: [
      { id: 'junk-cleaner', label: 'Junk Files', icon: Trash2 },
      { id: 'space-analyzer', label: 'Disk Space Map', icon: PieChart },
      { id: 'windows-cleaner', label: 'Windows Privacy', icon: Sparkles },
      { id: 'privacy-debloater', label: 'Privacy Shield', icon: ShieldAlert },
      { id: 'browser-cleaner', label: 'Browser Cache', icon: Compass },
      { id: 'office-cleaner', label: 'Office Clutter', icon: FileSpreadsheet },
      { id: 'evidence-remover', label: 'Deleted-File Wiper', icon: EyeOff },
      { id: 'secure-delete', label: 'File Shredder', icon: Flame },
    ],
  },
  management: {
    title: 'System Optimization Hub',
    subtitle: 'Optimize boot velocity, audit background services, and monitor active processes',
    tabs: [
      { id: 'startup-manager', label: 'Startup Programs', icon: PlaySquare },
      { id: 'software-updater', label: 'Software Updater', icon: DownloadCloud },
      { id: 'context-menu', label: 'Right-Click Menu', icon: MousePointerClick },
      { id: 'process-manager', label: 'Running Apps', icon: Cpu },
      { id: 'services-manager', label: 'Windows Services', icon: Sliders },
      { id: 'scheduled-tasks', label: 'Scheduled Tasks', icon: Clock },
      { id: 'browser-extensions', label: 'Browser Extensions', icon: Globe },
    ],
  },
  tools: {
    title: 'Tools & Recovery Center',
    subtitle: 'Administrative utilities, deep registry management, and system restore snapshots',
    tabs: [
      { id: 'windows-tools', label: 'Windows Tools', icon: Wrench },
      { id: 'file-unlocker', label: 'Locked Files', icon: Unlock },
      { id: 'system-report', label: 'Health Report', icon: FileCheck },
      { id: 'registry-tools', label: 'Registry Tools', icon: KeyRound },
      { id: 'backup-manager', label: 'Backup & Restore', icon: History },
      { id: 'system-info', label: 'PC Specs', icon: Info },
    ],
  },
};

export const PAGE_TO_HUB: Partial<Record<PageId, HubId>> = {
  'all-programs': 'uninstaller',
  'windows-apps': 'uninstaller',
  'quick-uninstall': 'uninstaller',
  'multiple-uninstall': 'uninstaller',
  'forced-uninstall': 'uninstaller',
  'hunter-mode': 'uninstaller',
  'installation-monitor': 'uninstaller',
  'traced-programs': 'uninstaller',
  'logs-database': 'uninstaller',

  'junk-cleaner': 'cleanup',
  'space-analyzer': 'cleanup',
  'windows-cleaner': 'cleanup',
  'privacy-debloater': 'cleanup',
  'browser-cleaner': 'cleanup',
  'office-cleaner': 'cleanup',
  'evidence-remover': 'cleanup',
  'secure-delete': 'cleanup',

  'startup-manager': 'management',
  'software-updater': 'management',
  'context-menu': 'management',
  'process-manager': 'management',
  'services-manager': 'management',
  'scheduled-tasks': 'management',
  'browser-extensions': 'management',

  'windows-tools': 'tools',
  'file-unlocker': 'tools',
  'system-report': 'tools',
  'registry-tools': 'tools',
  'backup-manager': 'tools',
  'system-info': 'tools',
};

interface HubTabBarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export const HubTabBar: React.FC<HubTabBarProps> = ({ currentPage, onNavigate }) => {
  const currentHub = PAGE_TO_HUB[currentPage];
  if (!currentHub) return null;

  const hubConfig = HUB_CONFIG[currentHub];
  if (!hubConfig) return null;

  return (
    <div className="bg-card/70 border-b border-border px-6 py-2.5 flex items-center space-x-1.5 overflow-x-auto select-none backdrop-blur-md">
      {hubConfig.tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentPage === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              isActive
                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md shadow-primary/30 font-bold scale-[1.02]'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface/80'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-text-muted'}`} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
