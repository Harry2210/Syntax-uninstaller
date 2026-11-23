import React, { useState, useEffect } from 'react';
import { DebloatItem } from '../types';
import { api } from '../services/api';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Server,
  WifiOff,
  Gamepad2,
  Bot,
  Globe,
  Power,
  Sparkles,
  Search,
  Check,
} from 'lucide-react';

interface PrivacyDebloaterPageProps {
  onRefresh?: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const PrivacyDebloaterPage: React.FC<PrivacyDebloaterPageProps> = ({
  onRefresh,
  onLogNotification,
}) => {
  const [items, setItems] = useState<DebloatItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDebloatItems = async () => {
    setIsLoading(true);
    try {
      const data = await api.getDebloatItems();
      setItems(data);
    } catch (err) {
      console.error('Failed to load debloat settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDebloatItems();
  }, []);

  const handleToggle = async (item: DebloatItem) => {
    const nextState = !item.is_shielded;
    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_shielded: nextState } : i))
    );

    try {
      await api.setDebloatItem(item.id, nextState);
      const actionWord = nextState ? 'Disconnected & Cleaned' : 'Reconnected & Enabled';
      onLogNotification(
        `Debloatware: ${actionWord}`,
        `"${item.name}" has been ${nextState ? 'safely disconnected' : 're-enabled'}.`,
        nextState ? 'success' : 'info'
      );
      if (onRefresh) onRefresh();
    } catch (err: any) {
      // Revert state on error
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_shielded: item.is_shielded } : i))
      );
      onLogNotification(
        'Debloat Error',
        String(err) || `Failed to modify ${item.name}. Administrator privileges may be required.`,
        'error'
      );
    }
  };

  const getItemIcon = (item: DebloatItem) => {
    if (item.category === 'Windows Services') {
      if (item.id === 'xbox_services') return <Gamepad2 className="w-4 h-4" />;
      if (item.id === 'location_sensor') return <WifiOff className="w-4 h-4" />;
      return <Server className="w-4 h-4" />;
    }
    if (item.category === 'Windows AI & Bloat') {
      if (item.id.includes('copilot') || item.id === 'cortana') return <Bot className="w-4 h-4" />;
      return <Sparkles className="w-4 h-4" />;
    }
    if (item.category === 'Taskbar & Search') {
      return <Search className="w-4 h-4" />;
    }
    if (item.category === 'Edge & Background') {
      return <Globe className="w-4 h-4" />;
    }
    return <ShieldCheck className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6 pb-12 select-none animate-fade-in max-w-6xl">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#141A2E]/95 via-[#111628]/95 to-[#1A1838]/90 border border-white/[0.08] rounded-3xl p-6 relative overflow-hidden shadow-2xl">
        {/* Glow Effects */}
        <div className="absolute -left-12 -top-12 w-64 h-64 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />

        <div className="flex items-start sm:items-center space-x-4 relative z-10">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-[0_0_25px_rgba(99,102,241,0.4)] flex-shrink-0">
            <Power className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                Windows Debloatware
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 text-[10px] font-bold border border-cyan-500/30">
                Speed Boost & PC Cleaner
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                {items.length} Options
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5 max-w-2xl leading-relaxed">
              Make your PC run significantly faster and cleaner: disconnect non-essential background Windows services, silence telemetry, free up RAM, and block AI bloatware with one click.
            </p>
          </div>
        </div>
      </div>

      {/* Debloat Rules Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20 space-y-4">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-xs text-slate-400 font-semibold">Inspecting Windows services and debloat policies...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[#13192B]/80 border border-white/[0.06] rounded-3xl p-12 text-center">
          <ShieldCheck className="w-12 h-12 text-cyan-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-sm font-bold text-white">No Debloat Options Found</h3>
          <p className="text-xs text-slate-400 mt-1">
            Unable to query Windows debloat policies.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border transition-all p-4.5 flex flex-col justify-between hover:shadow-xl ${
                item.is_shielded
                  ? 'bg-gradient-to-br from-[#101F38]/95 to-[#0E1B30]/90 border-cyan-500/35 shadow-[0_0_20px_rgba(6,182,212,0.12)]'
                  : 'bg-[#10162A]/80 border-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all flex-shrink-0 ${
                        item.is_shielded
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                          : 'bg-white/[0.04] text-slate-400 border border-white/[0.08]'
                      }`}
                    >
                      {getItemIcon(item)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-xs font-bold text-white leading-tight">{item.name}</h3>
                      </div>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-medium">{item.category}</span>
                        {item.service_name && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                            Service: {item.service_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Clean Modern Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => handleToggle(item)}
                    className={`w-12 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer flex-shrink-0 ${
                      item.is_shielded
                        ? 'bg-gradient-to-r from-cyan-500 to-teal-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                        : 'bg-white/10 border border-white/10'
                    }`}
                    title={item.is_shielded ? 'Click to re-enable (Windows default)' : 'Click to disconnect & debloat'}
                  >
                    <div
                      className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 flex items-center justify-center ${
                        item.is_shielded ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    >
                      {item.is_shielded && <Check className="w-3 h-3 text-teal-600 stroke-[3]" />}
                    </div>
                  </button>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mt-2">
                  {item.description}
                </p>
              </div>

              {/* Bottom Card Badges */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.06] text-[11px]">
                <div className="flex items-center space-x-2">
                  {item.recommended && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 text-[10px] font-bold border border-purple-500/25">
                      Recommended
                    </span>
                  )}
                  {item.category === 'Windows Services' && (
                    <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 text-[10px] font-bold border border-cyan-500/25">
                      Windows Service
                    </span>
                  )}
                  {!item.recommended && item.category !== 'Windows Services' && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-500/15 text-slate-400 text-[10px] font-medium border border-slate-500/25">
                      Optional
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      item.is_shielded
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-white/[0.04] text-slate-400 border border-white/[0.08]'
                    }`}
                  >
                    {item.is_shielded
                      ? item.category === 'Windows Services'
                        ? 'Disconnected'
                        : 'Cleaned & Blocked'
                      : 'Active (Stock)'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
