import React, { useEffect, useState, useMemo } from 'react';
import { StartupItem } from '../types';
import { api } from '../services/api';
import { ApplicationIcon } from '../components/common/ApplicationIcon';
import {
  Cpu,
  Search,
  Timer,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
  Sliders,
  AlertTriangle,
  ArrowUpDown,
  Filter,
} from 'lucide-react';

interface StartupManagerPageProps {
  items: StartupItem[];
  onRefresh: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

type FilterTab = 'all' | 'enabled' | 'disabled';

export const StartupManagerPage: React.FC<StartupManagerPageProps> = ({
  items,
  onRefresh,
  onLogNotification,
}) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [startupItems, setStartupItems] = useState<StartupItem[]>(items);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [biosTime, setBiosTime] = useState<number>(12.0);

  // Sync prop changes
  useEffect(() => {
    setStartupItems(items);
  }, [items]);

  // Load actual Last BIOS POST time
  useEffect(() => {
    api.getLastBiosTime().then((time) => {
      if (time > 0) setBiosTime(time);
    });
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await api.getStartupItems();
      setStartupItems(fresh);
      const time = await api.getLastBiosTime();
      if (time > 0) setBiosTime(time);
      onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const handleToggle = async (item: StartupItem) => {
    const nextState = !item.enabled;

    // Optimistic UI update
    setStartupItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              enabled: nextState,
              impact: nextState ? (i.impact === 'None' ? 'Low' : i.impact) : 'None',
            }
          : i
      )
    );

    try {
      await api.toggleStartupItem(item.id, nextState);
      onLogNotification(
        nextState ? 'Startup App Enabled' : 'Startup App Disabled',
        `${item.name} is now ${nextState ? 'enabled' : 'disabled'} for Windows boot.`,
        nextState ? 'info' : 'success'
      );
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      // Revert if error
      setStartupItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, enabled: item.enabled } : i))
      );
      const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Administrator privileges required to toggle system-wide startup apps. Please run as Administrator.';
      onLogNotification('Permission Required', msg, 'warning');
    }
  };

  const isRealStartupItem = (item: StartupItem) => {
    const nameLower = item.name.trim().toLowerCase();
    const cmdLower = item.command.trim().toLowerCase();
    return (
      nameLower !== 'desktop' &&
      nameLower !== 'desktop.ini' &&
      !cmdLower.endsWith('desktop.ini') &&
      !cmdLower.endsWith('thumbs.db')
    );
  };

  const validItems = useMemo(() => startupItems.filter(isRealStartupItem), [startupItems]);
  const enabledCount = validItems.filter((i) => i.enabled).length;
  const disabledCount = validItems.filter((i) => !i.enabled).length;

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return validItems.filter((item) => {
      if (activeTab === 'enabled' && !item.enabled) return false;
      if (activeTab === 'disabled' && item.enabled) return false;

      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.publisher && item.publisher.toLowerCase().includes(q)) ||
        item.command.toLowerCase().includes(q)
      );
    });
  }, [validItems, activeTab, search]);

  return (
    <div className="space-y-4 pb-12 animate-fade-in max-w-5xl select-none">
      {/* Top Header Card matching Windows 11 Task Manager */}
      <div className="p-5 bg-[#13192B]/90 border border-white/[0.06] rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0 shadow-[0_0_16px_rgba(245,158,11,0.2)]">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-base font-bold text-white tracking-wide">
                Startup Apps
              </h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-slate-300">
                Speed Up PC
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Control apps that launch on Windows boot. Disabling unneeded startup items significantly reduces startup lag.
            </p>
          </div>
        </div>

        {/* Right side: Last BIOS time & refresh */}
        <div className="flex items-center space-x-3 flex-shrink-0 w-full md:w-auto justify-between md:justify-end">
          {/* Last BIOS Time display */}
          <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 shadow-inner">
            <Timer className="w-4 h-4 text-cyan-400" />
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-medium">Last BIOS time</div>
              <div className="text-xs font-mono font-bold text-white">
                {biosTime.toFixed(1)} seconds
              </div>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
            title="Refresh startup applications"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 p-1 bg-[#13192B]/80 border border-white/[0.06] rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            All <span className="font-mono text-[10px] ml-1 opacity-80">({validItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('enabled')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'enabled'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Enabled <span className="font-mono text-[10px] ml-1 opacity-80">({enabledCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('disabled')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'disabled'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Disabled <span className="font-mono text-[10px] ml-1 opacity-80">({disabledCount})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search startup apps..."
            className="w-full bg-[#13192B]/80 border border-white/[0.06] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors shadow-inner"
          />
        </div>
      </div>

      {/* Task Manager Style Table View */}
      <div className="bg-[#13192B]/90 border border-white/[0.06] rounded-2xl overflow-hidden shadow-xl">
        {/* Table Header Columns */}
        <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-white/[0.06] bg-black/25 text-[11px] font-bold text-slate-400 tracking-wider uppercase">
          <div className="col-span-5 md:col-span-4">Name</div>
          <div className="hidden md:block col-span-3">Publisher</div>
          <div className="col-span-4 md:col-span-3">Status</div>
          <div className="col-span-3 md:col-span-2 text-right">Start-up impact</div>
        </div>

        {/* List of Applications */}
        <div className="divide-y divide-white/[0.04]">
          {filteredItems.map((item) => {
            const isEnabled = item.enabled;

            return (
              <div
                key={item.id}
                className="grid grid-cols-12 gap-3 px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors text-xs group"
              >
                {/* Column 1: App Icon + Name */}
                <div className="col-span-5 md:col-span-4 flex items-center space-x-3 min-w-0">
                  <div className="flex-shrink-0">
                    <ApplicationIcon
                      name={item.name}
                      publisher={item.publisher}
                      iconPath={item.command}
                      size="sm"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                      {item.name}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]" title={item.command}>
                      {item.location}
                    </div>
                  </div>
                </div>

                {/* Column 2: Publisher */}
                <div className="hidden md:block col-span-3 text-slate-400 truncate">
                  {item.publisher || <span className="text-slate-600">—</span>}
                </div>

                {/* Column 3: Status + Toggle Switch */}
                <div className="col-span-4 md:col-span-3 flex items-center space-x-3">
                  {/* Custom Toggle Switch */}
                  <button
                    onClick={() => handleToggle(item)}
                    className={`relative w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer flex-shrink-0 ${
                      isEnabled
                        ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                        : 'bg-slate-700/80 border border-white/10'
                    }`}
                    title={isEnabled ? 'Click to disable' : 'Click to enable'}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>

                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      isEnabled
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-white/[0.04] text-slate-400 border border-white/[0.06]'
                    }`}
                  >
                    {isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                {/* Column 4: Start-up impact */}
                <div className="col-span-3 md:col-span-2 text-right">
                  <span
                    className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-lg ${
                      !isEnabled || item.impact === 'None'
                        ? 'text-slate-500'
                        : item.impact === 'High'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : item.impact === 'Medium'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    }`}
                  >
                    {item.impact || 'None'}
                  </span>
                </div>
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-xs">
              No startup applications match your search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
