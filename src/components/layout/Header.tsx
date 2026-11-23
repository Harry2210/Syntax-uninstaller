import React from 'react';
import { PageId } from '../../types';
import { PAGE_META } from '../../data/pages';
import {
  Search,
  Shield,
  Settings,
  Wrench,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
  Command,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';
import { PAGE_TO_HUB, HUB_CONFIG } from './HubTabBar';
import { Tooltip } from '../common/Tooltip';
import { ResolvedTheme, ThemeMode } from '../../services/preferences';
import { AppUpdateManifest } from '../../services/appUpdater';

interface HeaderProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  isAdmin: boolean;
  unreadNotificationsCount: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenPalette?: () => void;
  availableUpdate?: AppUpdateManifest | null;
  onOpenUpdateModal?: () => void;
  theme?: ThemeMode;
  resolvedTheme?: ResolvedTheme;
  onSetTheme?: (theme: ThemeMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  onNavigate,
  isAdmin,
  unreadNotificationsCount,
  onRefresh,
  isRefreshing,
  onOpenPalette,
  availableUpdate,
  onOpenUpdateModal,
  resolvedTheme = 'dark',
  onSetTheme,
}) => {
  const current = PAGE_META[currentPage] || {
    title: 'Syntax Uninstaller',
    subtitle: 'Smart Windows System Care',
    keywords: [],
  };
  const currentHub = PAGE_TO_HUB[currentPage];
  const hubTitle = currentHub ? HUB_CONFIG[currentHub]?.title : null;

  return (
    <header className="h-16 border-b border-border bg-sidebar/50 backdrop-blur-md px-6 flex items-center justify-between select-none flex-shrink-0 relative">
      {/* Colour accent line */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-primary via-fuchsia-500 to-secondary opacity-70" />
      {/* Title & Subtitle with Breadcrumb */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center space-x-2.5">
          {hubTitle && (
            <div className="hidden sm:flex items-center space-x-1.5 text-xs text-text-muted font-medium">
              <span>{hubTitle}</span>
              <ChevronRight className="w-3.5 h-3.5 text-border" />
            </div>
          )}
          <h1 className="text-sm font-bold text-text-primary tracking-tight truncate">{current.title}</h1>
          {isAdmin ? (
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
              <ShieldCheck className="w-3 h-3" />
              <span>Admin</span>
            </span>
          ) : (
            <span
              className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0"
              title="Some system actions need 'Run as administrator'"
            >
              <Shield className="w-3 h-3" />
              <span>Standard</span>
            </span>
          )}
        </div>
        <p className="text-[11px] text-text-muted hidden sm:block truncate max-w-xl">{current.subtitle}</p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-2 flex-shrink-0">
        {/* Appearance switch — sits directly to the left of the search button */}
        {onSetTheme && (
          <div
            className="flex items-center rounded-xl border border-border bg-surface/60 p-0.5 shadow-sm"
            role="group"
            aria-label="Colour theme"
          >
            <Tooltip content="Light mode" position="bottom">
              <button
                onClick={() => onSetTheme('light')}
                aria-pressed={resolvedTheme === 'light'}
                aria-label="Use light mode"
                className={`p-1.5 rounded-lg transition-all ${
                  resolvedTheme === 'light'
                    ? 'bg-card text-amber-500 shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            <Tooltip content="Dark mode" position="bottom">
              <button
                onClick={() => onSetTheme('dark')}
                aria-pressed={resolvedTheme === 'dark'}
                aria-label="Use dark mode"
                className={`p-1.5 rounded-lg transition-all ${
                  resolvedTheme === 'dark'
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </div>
        )}

        {/* Universal search / command palette */}
        {onOpenPalette && (
          <Tooltip content="Search all 36 tools  (Ctrl + K)" position="bottom">
            <button
              onClick={onOpenPalette}
              className="hidden lg:flex items-center space-x-2 pl-2.5 pr-2 py-1.5 rounded-lg bg-surface/60 hover:bg-surface border border-border text-text-muted hover:text-text-primary transition-colors"
              aria-label="Search tools"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">Search</span>
              <kbd className="flex items-center space-x-0.5 px-1.5 py-0.5 rounded border border-border bg-background/60 text-[9px] font-mono">
                <Command className="w-2.5 h-2.5" />
                <span>K</span>
              </kbd>
            </button>
          </Tooltip>
        )}

        {onRefresh && (
          <Tooltip content="Re-scan this PC" position="bottom">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface rounded-lg border border-border transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50"
              aria-label="Refresh system data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            </button>
          </Tooltip>
        )}

        {/* App Update Available Button */}
        {availableUpdate && onOpenUpdateModal && (
          <button
            onClick={onOpenUpdateModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 animate-pulse transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
            title={`Syntax Uninstaller v${availableUpdate.version} is available!`}
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span className="hidden sm:inline">Update Ready</span>
            <span className="font-mono text-[10px] bg-black/25 px-1.5 py-0.5 rounded">v{availableUpdate.version}</span>
          </button>
        )}

        {/* Quick escape hatch for apps that refuse to uninstall */}
        <Tooltip content="Deep purge for broken or corrupted apps" position="bottom">
          <button
            onClick={() => onNavigate('forced-uninstall')}
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-semibold transition-all duration-150 hover:scale-105 active:scale-95 shadow-sm"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Stuck app?</span>
          </button>
        </Tooltip>

        {/* Settings Icon */}
        <Tooltip content="Application Settings" position="bottom">
          <button
            onClick={() => onNavigate('settings')}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface rounded-lg border border-border transition-all duration-150 hover:scale-105 active:scale-95"
            aria-label="Open settings"
          >
            <Settings className="w-4 h-4 transition-transform duration-300 hover:rotate-45" />
          </button>
        </Tooltip>
      </div>
    </header>
  );
};
