import React, { useEffect, useState } from 'react';
import { PageId } from '../../types';
import { PAGE_TO_HUB } from './HubTabBar';
import { Tooltip } from '../common/Tooltip';
import {
  Sparkles,
  Layers,
  Trash2,
  Cpu,
  Bell,
  Settings,
  HelpCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  DownloadCloud,
  ShieldAlert,
  LayoutGrid,
} from 'lucide-react';

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  unreadNotificationsCount?: number;
}

type AccentKey = 'emerald' | 'violet' | 'teal' | 'amber' | 'sky' | 'rose' | 'indigo';

const ACCENTS: Record<AccentKey, { icon: string; activeRow: string; activeLabel: string }> = {
  emerald: {
    icon: 'text-emerald-500',
    activeRow: 'bg-emerald-500/10 border-emerald-500/40',
    activeLabel: 'text-emerald-600 dark:text-emerald-300',
  },
  violet: {
    icon: 'text-violet-500',
    activeRow: 'bg-violet-500/10 border-violet-500/40',
    activeLabel: 'text-violet-600 dark:text-violet-300',
  },
  teal: {
    icon: 'text-teal-500',
    activeRow: 'bg-teal-500/10 border-teal-500/40',
    activeLabel: 'text-teal-600 dark:text-teal-300',
  },
  amber: {
    icon: 'text-amber-500',
    activeRow: 'bg-amber-500/10 border-amber-500/40',
    activeLabel: 'text-amber-600 dark:text-amber-300',
  },
  sky: {
    icon: 'text-sky-500',
    activeRow: 'bg-sky-500/10 border-sky-500/40',
    activeLabel: 'text-sky-600 dark:text-sky-300',
  },
  rose: {
    icon: 'text-rose-500',
    activeRow: 'bg-rose-500/10 border-rose-500/40',
    activeLabel: 'text-rose-600 dark:text-rose-300',
  },
  indigo: {
    icon: 'text-indigo-500',
    activeRow: 'bg-indigo-500/10 border-indigo-500/40',
    activeLabel: 'text-indigo-600 dark:text-indigo-300',
  },
};

interface NavItem {
  id: PageId;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: AccentKey;
}

/**
 * The sidebar is intentionally short: six everyday tools plus a single "All
 * tools" entry that opens a searchable directory. Everything else lives there,
 * so the first screen never looks like a control panel.
 */
const EVERYDAY_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Smart Care', desc: 'Check PC health in one click', icon: Sparkles, accent: 'emerald' },
  { id: 'all-programs', label: 'Uninstall Apps', desc: 'Remove programs without leftovers', icon: Layers, accent: 'violet' },
  { id: 'junk-cleaner', label: 'Clean Junk Files', desc: 'Free up disk space safely', icon: Trash2, accent: 'teal' },
  { id: 'startup-manager', label: 'Speed Up PC', desc: 'Make Windows start faster', icon: Cpu, accent: 'amber' },
  { id: 'software-updater', label: 'Update Software', desc: 'Patch outdated apps', icon: DownloadCloud, accent: 'sky' },
  { id: 'privacy-debloater', label: 'Privacy Shield', desc: 'Stop Windows tracking you', icon: ShieldAlert, accent: 'rose' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
  unreadNotificationsCount = 0,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('syntax_sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('syntax_sidebar_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  // "All tools" is highlighted whenever the current page came from that list.
  const isToolboxActive = currentPage === 'toolbox' || Boolean(PAGE_TO_HUB[currentPage]);

  return (
    <aside
      className={`h-screen border-r border-border bg-sidebar flex flex-col justify-between transition-all duration-300 relative select-none z-30 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        <div
          className="flex items-center space-x-3 overflow-hidden cursor-pointer"
          onClick={() => onSelectPage('dashboard')}
        >
          <img
            src="/logo.svg"
            alt="Syntax Uninstaller"
            className="w-9 h-9 rounded-xl flex-shrink-0 shadow-lg shadow-primary/30"
          />

          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm tracking-tight text-text-primary">SYNTAX</span>
              <span className="text-[10px] font-medium truncate bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Smart PC Care
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-surface transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {!isCollapsed && (
          <p className="px-3 pb-1 text-[10px] font-bold tracking-wider uppercase text-emerald-500 flex items-center space-x-1">
            <Sparkles className="w-3 h-3" />
            <span>Everyday care</span>
          </p>
        )}

        {EVERYDAY_ITEMS.map((navItem) => {
          const Icon = navItem.icon;
          const accent = ACCENTS[navItem.accent];
          const isActive = currentPage === navItem.id;
          return (
            <Tooltip
              key={navItem.id}
              content={`${navItem.label} — ${navItem.desc}`}
              position="right"
              className={isCollapsed ? 'w-full' : ''}
            >
              <button
                onClick={() => onSelectPage(navItem.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold nav-link-interactive relative border ${
                  isActive
                    ? `${accent.activeRow} ${accent.activeLabel} shadow-sm`
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface/80 border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${accent.icon}`} />
                {!isCollapsed && (
                  <span className="flex flex-col text-left min-w-0">
                    <span className="truncate">{navItem.label}</span>
                    <span className="text-[10px] font-normal truncate text-text-muted">{navItem.desc}</span>
                  </span>
                )}
              </button>
            </Tooltip>
          );
        })}

        {/* Single entry point for everything else */}
        <div className="pt-2">
          <Tooltip content="All tools — searchable list" position="right" className={isCollapsed ? 'w-full' : ''}>
            <button
              onClick={() => onSelectPage('toolbox')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-bold nav-link-interactive border ${
                isToolboxActive
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface/80 border-border'
              }`}
            >
              <LayoutGrid className="w-4 h-4 flex-shrink-0 text-primary" />
              {!isCollapsed && (
                <span className="flex flex-col text-left min-w-0">
                  <span className="truncate">All tools</span>
                  <span className="text-[10px] font-normal truncate text-text-muted">
                    Services, backups, registry &amp; more
                  </span>
                </span>
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Bottom utilities */}
      <div className="p-2 border-t border-border space-y-1 bg-surface/20">
        <Tooltip content="Notifications" position="right" className={isCollapsed ? 'w-full' : ''}>
          <button
            onClick={() => onSelectPage('notifications')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium nav-link-interactive relative ${
              currentPage === 'notifications'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300 font-semibold border border-amber-500/30'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface border border-transparent'
            }`}
          >
            <Bell className="w-4 h-4 flex-shrink-0 text-amber-500" />
            {!isCollapsed && <span className="truncate">Notifications</span>}
            {unreadNotificationsCount > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-danger text-white ${
                  isCollapsed ? 'absolute -top-1 -right-1' : 'ml-auto'
                }`}
              >
                {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
              </span>
            )}
          </button>
        </Tooltip>

        <Tooltip content="Help & Guide" position="right" className={isCollapsed ? 'w-full' : ''}>
          <button
            onClick={() => onSelectPage('help')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium nav-link-interactive ${
              currentPage === 'help'
                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-semibold border border-indigo-500/30'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface border border-transparent'
            }`}
          >
            <BookOpen className="w-4 h-4 flex-shrink-0 text-indigo-500" />
            {!isCollapsed && <span className="truncate">Help & Guide</span>}
          </button>
        </Tooltip>

        <Tooltip content="Settings" position="right" className={isCollapsed ? 'w-full' : ''}>
          <button
            onClick={() => onSelectPage('settings')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium nav-link-interactive ${
              currentPage === 'settings'
                ? 'bg-slate-500/10 text-slate-600 dark:text-slate-300 font-semibold border border-slate-500/30'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface border border-transparent'
            }`}
          >
            <Settings className="w-4 h-4 flex-shrink-0 text-slate-400" />
            {!isCollapsed && <span className="truncate">Settings</span>}
          </button>
        </Tooltip>

        <Tooltip content="About Syntax Uninstaller" position="right" className={isCollapsed ? 'w-full' : ''}>
          <button
            onClick={() => onSelectPage('about')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium nav-link-interactive ${
              currentPage === 'about'
                ? 'bg-primary/10 text-primary font-semibold border border-primary/30'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface border border-transparent'
            }`}
          >
            <HelpCircle className="w-4 h-4 flex-shrink-0 text-primary/80" />
            {!isCollapsed && <span className="truncate">About</span>}
          </button>
        </Tooltip>
      </div>
    </aside>
  );
};
