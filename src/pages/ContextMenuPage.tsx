import React, { useState, useEffect } from 'react';
import { ContextMenuItem } from '../types';
import { api } from '../services/api';
import {
  MousePointerClick,
  RefreshCw,
  Search,
  Trash2,
  Shield,
  FileCode,
  Folder,
  Layers,
  HardDrive,
  Monitor,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';

interface ContextMenuPageProps {
  onRefresh?: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ContextMenuPage: React.FC<ContextMenuPageProps> = ({
  onRefresh,
  onLogNotification,
}) => {
  const [items, setItems] = useState<ContextMenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScope, setSelectedScope] = useState<string>('all');
  const [itemToDelete, setItemToDelete] = useState<ContextMenuItem | null>(null);

  const loadContextMenuItems = async () => {
    setIsLoading(true);
    try {
      const data = await api.getContextMenuItems();
      setItems(data);
    } catch (err) {
      console.error('Failed to load context menu items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadContextMenuItems();
  }, []);

  const handleToggle = async (item: ContextMenuItem) => {
    const nextState = !item.enabled;
    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, enabled: nextState } : i))
    );

    try {
      const newPath = await api.toggleContextMenuItem(item.registry_path, nextState);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, registry_path: newPath } : i))
      );
      onLogNotification(
        nextState ? 'Context Menu Item Enabled' : 'Context Menu Item Disabled',
        `Shell handler "${item.name}" is now ${nextState ? 'visible' : 'hidden'} in Explorer.`,
        'info'
      );
      if (onRefresh) onRefresh();
    } catch {
      // Revert on error
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, enabled: item.enabled } : i))
      );
      onLogNotification('Error', `Failed to toggle shell handler ${item.name}`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    const target = itemToDelete;
    setItemToDelete(null);

    try {
      await api.deleteContextMenuItem(target.registry_path);
      setItems((prev) => prev.filter((i) => i.id !== target.id));
      onLogNotification(
        'Handler Removed',
        `Registry key for "${target.name}" has been permanently expunged.`,
        'success'
      );
      if (onRefresh) onRefresh();
    } catch {
      onLogNotification('Error', `Failed to delete handler ${target.name}`, 'error');
    }
  };

  const scopes = [
    { id: 'all', label: 'All Handlers', icon: Layers },
    { id: 'files', label: 'Files (*)', icon: FileCode },
    { id: 'folders', label: 'Folders', icon: Folder },
    { id: 'desktop', label: 'Desktop / Background', icon: Monitor },
    { id: 'drives', label: 'Drives', icon: HardDrive },
  ];

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.registry_path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.clsid.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesScope = true;
    if (selectedScope === 'files') matchesScope = item.menu_type.includes('Files');
    else if (selectedScope === 'folders') matchesScope = item.menu_type.includes('Folders') || item.menu_type.includes('Directory');
    else if (selectedScope === 'desktop') matchesScope = item.menu_type.includes('Background');
    else if (selectedScope === 'drives') matchesScope = item.menu_type.includes('Drive');

    return matchesSearch && matchesScope;
  });

  const totalDisabled = items.filter((i) => !i.enabled).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-card via-card to-primary/10 border border-border rounded-2xl p-6 relative overflow-hidden shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-inner">
                <MousePointerClick className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-primary tracking-tight">
                  Windows Context Menu Cleaner
                </h1>
                <p className="text-xs text-text-muted">
                  Declutter right-click menus in File Explorer • Disable or eradicate invasive shell extension handlers
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadContextMenuItems}
              disabled={isLoading}
              className="flex items-center space-x-2 px-3.5 py-2 bg-surface hover:bg-surface/80 border border-border text-text-secondary hover:text-text-primary rounded-xl text-xs font-medium transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-primary' : ''}`} />
              <span>Rescan Registry</span>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/60">
          <div className="bg-surface/50 rounded-xl p-3 border border-border/40">
            <div className="text-[11px] text-text-muted font-medium">Total Registered Handlers</div>
            <div className="text-lg font-bold text-text-primary mt-1">{items.length}</div>
            <p className="text-[10px] text-text-muted mt-1">Across all shell scope locations</p>
          </div>

          <div className="bg-surface/50 rounded-xl p-3 border border-border/40">
            <div className="text-[11px] text-text-muted font-medium">Cleaned / Disabled</div>
            <div className="text-lg font-bold text-accent-secondary mt-1">{totalDisabled} Disabled</div>
            <p className="text-[10px] text-text-muted mt-1">Hidden from right-click context</p>
          </div>

          <div className="bg-surface/50 rounded-xl p-3 border border-border/40">
            <div className="text-[11px] text-text-muted font-medium">Protection Strategy</div>
            <div className="text-lg font-bold text-primary mt-1">Safe Key Inversion</div>
            <p className="text-[10px] text-text-muted mt-1">Prefix disabling allows instant restore</p>
          </div>

          <div className="bg-surface/50 rounded-xl p-3 border border-border/40">
            <div className="text-[11px] text-text-muted font-medium">Explorer Responsiveness</div>
            <div className="text-lg font-bold text-blue-400 mt-1">
              {totalDisabled > 3 ? 'High Speed' : 'Optimal'}
            </div>
            <p className="text-[10px] text-text-muted mt-1">Reduced COM shell query latency</p>
          </div>
        </div>
      </div>

      {/* Scope Filter Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-1">
          {scopes.map((s) => {
            const Icon = s.icon;
            const isSelected = selectedScope === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedScope(s.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-primary text-white font-bold shadow-md shadow-primary/20'
                    : 'bg-card border border-border text-text-secondary hover:text-text-primary hover:bg-surface'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search handlers, paths, CLSIDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Handlers List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs text-text-muted font-medium">Scanning HKCR shell extension keys...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-accent-secondary mx-auto mb-3 opacity-60" />
          <h3 className="text-sm font-semibold text-text-primary">No Shell Handlers Found</h3>
          <p className="text-xs text-text-muted mt-1">No items match the current search or scope filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-card border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md ${
                !item.enabled
                  ? 'border-border/60 opacity-60 bg-surface/30'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <div className="flex items-start space-x-3.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    item.is_system
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-primary/10 text-primary border border-primary/20'
                  }`}
                >
                  <MousePointerClick className="w-4 h-4" />
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xs font-bold text-text-primary">{item.name}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-text-muted border border-border font-medium">
                      {item.menu_type}
                    </span>
                    {item.is_system && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center space-x-1 font-semibold">
                        <Shield className="w-2.5 h-2.5" />
                        <span>System</span>
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] font-mono text-text-muted mt-1 select-all break-all">
                    {item.registry_path}
                  </p>
                  {item.clsid && (
                    <p className="text-[10px] font-mono text-text-muted/70 mt-0.5">
                      CLSID: {item.clsid}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-3 self-end md:self-center">
                {/* Enable/Disable Toggle */}
                <button
                  onClick={() => handleToggle(item)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                    item.enabled ? 'bg-primary' : 'bg-surface border border-border'
                  }`}
                  title={item.enabled ? 'Disable context menu item' : 'Enable context menu item'}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      item.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>

                {/* Permanent Delete Button */}
                <button
                  onClick={() => setItemToDelete(item)}
                  className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  title="Permanently remove from registry"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!itemToDelete}
        title="Permanently Eradicate Context Menu Handler?"
        message={`Are you sure you want to permanently delete the registry key for "${itemToDelete?.name}"? ${
          itemToDelete?.is_system
            ? 'WARNING: This is a Windows native shell handler. Disabling is recommended instead of permanent deletion.'
            : 'This will purge the shell extension from the Windows Registry.'
        }`}
        confirmLabel="Permanently Delete"
        isDangerous={true}
        onConfirm={handleDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};
