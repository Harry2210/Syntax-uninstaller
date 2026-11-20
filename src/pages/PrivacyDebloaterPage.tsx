import React, { useState, useEffect } from 'react';
import { DebloatItem } from '../types';
import { api } from '../services/api';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Zap,
  RotateCcw,
  CheckCircle2,
  Lock,
  Cpu,
  Search,
  Eye,
  Sliders,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

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
      onLogNotification(
        nextState ? 'Privacy Shield Activated' : 'Privacy Shield Deactivated',
        `Rule "${item.name}" has been ${nextState ? 'enabled' : 'disabled'} in Windows registry.`,
        nextState ? 'success' : 'info'
      );
      if (onRefresh) onRefresh();
    } catch {
      // Revert on error
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_shielded: item.is_shielded } : i))
      );
      onLogNotification('Error', `Failed to modify privacy shield for ${item.name}`, 'error');
    }
  };

  const handleApplyRecommended = async () => {
    setIsProcessing(true);
    try {
      const count = await api.applyRecommendedDebloat();
      await loadDebloatItems();
      onLogNotification(
        'Recommended Privacy Applied',
        `Successfully enabled all ${count} recommended privacy & anti-telemetry shields!`,
        'success'
      );
      if (onRefresh) onRefresh();
    } catch {
      onLogNotification('Error', 'Failed to apply recommended privacy rules.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreDefaults = async () => {
    setShowRestoreConfirm(false);
    setIsProcessing(true);
    try {
      const count = await api.restoreWindowsDefaults();
      await loadDebloatItems();
      onLogNotification(
        'Windows Defaults Restored',
        `Restored ${count} privacy & telemetry keys to standard Windows operating defaults.`,
        'info'
      );
      if (onRefresh) onRefresh();
    } catch {
      onLogNotification('Error', 'Failed to restore default Windows settings.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const categories = ['all', ...Array.from(new Set(items.map((i) => i.category)))];

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalShielded = items.filter((i) => i.is_shielded).length;
  const totalRecommended = items.filter((i) => i.recommended).length;
  const shieldedPercentage = items.length > 0 ? Math.round((totalShielded / items.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-gradient-to-r from-card via-card to-primary/10 border border-border rounded-2xl p-6 relative overflow-hidden shadow-lg">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-primary/15 to-transparent pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-inner">
                <ShieldAlert className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-primary tracking-tight">
                  Windows Privacy & AI Debloater
                </h1>
                <p className="text-xs text-text-muted">
                  Silence diagnostic telemetry, background Copilot AI indexing, advertising tracking, and pre-launchers
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleApplyRecommended}
              disabled={isProcessing}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-primary to-accent-secondary hover:from-primary/90 hover:to-accent-secondary/90 text-white rounded-xl text-xs font-semibold shadow-md shadow-primary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Apply Recommended Shields ({totalRecommended})</span>
            </button>

            <button
              onClick={() => setShowRestoreConfirm(true)}
              disabled={isProcessing}
              className="flex items-center space-x-2 px-3 py-2 bg-surface hover:bg-surface/80 border border-border text-text-secondary hover:text-text-primary rounded-xl text-xs font-medium transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Defaults</span>
            </button>

            <button
              onClick={loadDebloatItems}
              disabled={isLoading}
              className="p-2 bg-surface hover:bg-surface/80 border border-border text-text-secondary hover:text-text-primary rounded-xl text-xs transition-all"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-primary' : ''}`} />
            </button>
          </div>
        </div>

        {/* Live Protection Barometer */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/60">
          <div className="bg-surface/50 rounded-xl p-3 border border-border/40">
            <div className="text-[11px] text-text-muted font-medium">Privacy Status</div>
            <div className="text-lg font-bold text-text-primary mt-1 flex items-center space-x-2">
              <span className={shieldedPercentage >= 70 ? 'text-accent-secondary' : 'text-amber-400'}>
                {shieldedPercentage}% Protected
              </span>
              <CheckCircle2 className="w-4 h-4 text-accent-secondary" />
            </div>
            <div className="w-full bg-surface-elevated h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary to-accent-secondary h-full transition-all duration-500 rounded-full"
                style={{ width: `${shieldedPercentage}%` }}
              />
            </div>
          </div>

          <div className="bg-surface/50 rounded-xl p-3 border border-border/40">
            <div className="text-[11px] text-text-muted font-medium">Active Shields</div>
            <div className="text-lg font-bold text-accent-secondary mt-1">
              {totalShielded} <span className="text-xs font-normal text-text-muted">/ {items.length} Rules</span>
            </div>
            <p className="text-[10px] text-text-muted mt-1">Registry policies active</p>
          </div>

          <div className="bg-surface/50 rounded-xl p-3 border border-border/40">
            <div className="text-[11px] text-text-muted font-medium">AI & Copilot Status</div>
            <div className="text-lg font-bold text-primary mt-1">
              {items.find((i) => i.id === 'windows_copilot')?.is_shielded ? 'Blocked' : 'Unrestricted'}
            </div>
            <p className="text-[10px] text-text-muted mt-1">Recall & background indexing</p>
          </div>

          <div className="bg-surface/50 rounded-xl p-3 border border-border/40">
            <div className="text-[11px] text-text-muted font-medium">Telemetry Level</div>
            <div className="text-lg font-bold text-blue-400 mt-1">
              {items.find((i) => i.id === 'telemetry')?.is_shielded ? 'Minimal (Security)' : 'Full Diagnostics'}
            </div>
            <p className="text-[10px] text-text-muted mt-1">DiagTrack service policy</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-primary text-white font-bold shadow-md shadow-primary/20'
                  : 'bg-card border border-border text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
            >
              {cat === 'all' ? 'All Rules' : cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search privacy rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Debloat Rules Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs text-text-muted font-medium">Querying Windows registry policies...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <ShieldCheck className="w-12 h-12 text-accent-secondary mx-auto mb-3 opacity-60" />
          <h3 className="text-sm font-semibold text-text-primary">No Matching Privacy Rules</h3>
          <p className="text-xs text-text-muted mt-1">Try broadening your search query or category filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-card rounded-2xl border transition-all p-5 flex flex-col justify-between hover:shadow-lg ${
                item.is_shielded
                  ? 'border-accent-secondary/30 bg-accent-secondary/[0.02] shadow-sm'
                  : 'border-border hover:border-border/80'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                        item.is_shielded
                          ? 'bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/30'
                          : 'bg-surface text-text-muted border border-border'
                      }`}
                    >
                      {item.is_shielded ? (
                        <ShieldCheck className="w-4 h-4 text-accent-secondary" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-text-muted" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-text-primary">{item.name}</h3>
                      <span className="text-[10px] text-text-muted">{item.category}</span>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleToggle(item)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                      item.is_shielded ? 'bg-accent-secondary' : 'bg-surface border border-border'
                    }`}
                    title={item.is_shielded ? 'Click to disable shield' : 'Click to enable shield'}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        item.is_shielded ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed mt-2.5">
                  {item.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/40 text-[11px]">
                <div className="flex items-center space-x-2">
                  {item.recommended && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold border border-primary/20">
                      Recommended
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      item.is_shielded
                        ? 'bg-accent-secondary/15 text-accent-secondary border border-accent-secondary/30'
                        : 'bg-surface text-text-muted border border-border'
                    }`}
                  >
                    {item.is_shielded ? 'Shield Active' : 'Default (Exposed)'}
                  </span>
                </div>

                <span className="text-[10px] text-text-muted">
                  {item.is_shielded ? 'Registry Locked' : 'Standard API'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Dialog for Restoring Defaults */}
      <ConfirmationDialog
        isOpen={showRestoreConfirm}
        title="Restore Windows Privacy Defaults?"
        message="This will re-enable standard Windows diagnostic telemetry, Copilot indexing, advertising ID, and Bing search suggestions across HKLM and HKCU registry hives."
        confirmLabel="Restore Defaults"
        isDangerous={true}
        onConfirm={handleRestoreDefaults}
        onCancel={() => setShowRestoreConfirm(false)}
      />
    </div>
  );
};
