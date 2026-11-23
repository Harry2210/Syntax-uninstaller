import React from 'react';
import { PageId } from '../../types';
import {
  Sparkles,
  Layers,
  Trash2,
  Cpu,
  DownloadCloud,
  ShieldAlert,
  Settings,
  Info,
  Power,
} from 'lucide-react';

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  unreadNotificationsCount?: number;
}

interface NavItem {
  id: PageId;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  activeBg: string;
  activeBorder: string;
  activeGlow: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Smart Care',
    desc: 'Check PC health in one click',
    icon: Sparkles,
    iconColor: 'text-[#22D3EE]',
    activeBg: 'bg-gradient-to-r from-purple-600/35 to-indigo-600/25',
    activeBorder: 'border-purple-500/50',
    activeGlow: 'shadow-[0_0_20px_rgba(168,85,247,0.25)]',
  },
  {
    id: 'all-programs',
    label: 'Uninstall Apps',
    desc: 'Remove programs without leftovers',
    icon: Layers,
    iconColor: 'text-[#A78BFA]',
    activeBg: 'bg-gradient-to-r from-violet-600/35 to-purple-600/25',
    activeBorder: 'border-violet-500/50',
    activeGlow: 'shadow-[0_0_20px_rgba(139,92,246,0.25)]',
  },
  {
    id: 'junk-cleaner',
    label: 'Clean Junk Files',
    desc: 'Free up disk space safely',
    icon: Trash2,
    iconColor: 'text-[#22D3EE]',
    activeBg: 'bg-gradient-to-r from-cyan-600/35 to-teal-600/25',
    activeBorder: 'border-cyan-500/50',
    activeGlow: 'shadow-[0_0_20px_rgba(6,182,212,0.25)]',
  },
  {
    id: 'startup-manager',
    label: 'Speed Up PC',
    desc: 'Make Windows start faster',
    icon: Cpu,
    iconColor: 'text-[#FBBF24]',
    activeBg: 'bg-gradient-to-r from-amber-600/35 to-orange-600/25',
    activeBorder: 'border-amber-500/50',
    activeGlow: 'shadow-[0_0_20px_rgba(245,158,11,0.25)]',
  },
  {
    id: 'software-updater',
    label: 'Update Software',
    desc: 'Patch outdated apps',
    icon: DownloadCloud,
    iconColor: 'text-[#38BDF8]',
    activeBg: 'bg-gradient-to-r from-sky-600/35 to-blue-600/25',
    activeBorder: 'border-sky-500/50',
    activeGlow: 'shadow-[0_0_20px_rgba(56,189,248,0.25)]',
  },
  {
    id: 'privacy-debloater',
    label: 'Debloatware',
    desc: 'Disconnect bloat & services',
    icon: Power,
    iconColor: 'text-cyan-400',
    activeBg: 'bg-gradient-to-r from-cyan-600/35 to-indigo-600/25',
    activeBorder: 'border-cyan-500/50',
    activeGlow: 'shadow-[0_0_20px_rgba(6,182,212,0.25)]',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
}) => {
  return (
    <aside className="w-64 h-full bg-[#0B0F1A] border-r border-white/[0.05] flex flex-col justify-between select-none flex-shrink-0 p-3 py-4 z-20">
      {/* Everyday Care Navigation Links */}
      <div className="space-y-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectPage(item.id)}
              className={`w-full text-left p-3 rounded-2xl flex items-center justify-between transition-all duration-200 border ${
                isActive
                  ? `${item.activeBg} ${item.activeBorder} ${item.activeGlow} text-white`
                  : 'bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/[0.06] text-text-secondary hover:text-text-primary'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <Icon className={`w-5 h-5 flex-shrink-0 ${item.iconColor}`} />
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate leading-tight text-text-primary">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-text-muted truncate mt-0.5 leading-tight">
                    {item.desc}
                  </div>
                </div>
              </div>

              {/* Star Badge for Smart Care */}
              {item.id === 'dashboard' && (
                <div className="w-5 h-5 rounded-full bg-purple-500/25 border border-purple-400/40 flex items-center justify-center flex-shrink-0 ml-1.5 shadow-sm shadow-purple-500/30">
                  <span className="text-[10px] text-amber-300">★</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Utility Actions */}
      <div className="pt-3 border-t border-white/[0.05] space-y-1">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onSelectPage('settings')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              currentPage === 'settings'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-text-muted" />
            <span className="truncate">Settings</span>
          </button>

          <button
            onClick={() => onSelectPage('about')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              currentPage === 'about'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
            }`}
          >
            <Info className="w-3.5 h-3.5 text-text-muted" />
            <span className="truncate">About</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
