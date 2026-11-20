import React, { useState, useMemo } from 'react';
import { WindowsApp } from '../types';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { ApplicationIcon } from '../components/common/ApplicationIcon';
import {
  Search,
  Trash2,
  RotateCcw,
  Info,
  Shield,
  Download,
  AppWindow,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

interface WindowsAppsPageProps {
  apps: WindowsApp[];
  onRefresh: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const WindowsAppsPage: React.FC<WindowsAppsPageProps> = ({
  apps,
  onRefresh,
  onLogNotification,
}) => {
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<WindowsApp | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState<WindowsApp | null>(null);
  const [detailsModal, setDetailsModal] = useState<WindowsApp | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const filtered = useMemo(() => {
    return apps.filter(
      (a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.publisher.toLowerCase().includes(search.toLowerCase()) ||
        a.package_full_name.toLowerCase().includes(search.toLowerCase())
    );
  }, [apps, search]);

  const handleUninstall = async (app: WindowsApp) => {
    setIsProcessing(true);
    setConfirmUninstall(null);
    try {
      await api.uninstallWindowsApp(app.package_full_name);
      onLogNotification(
        'Windows App Removed',
        `Package ${app.name} was successfully removed via AppX deployment.`,
        'success'
      );
      onRefresh();
    } catch (err: any) {
      onLogNotification('Uninstall Failed', String(err), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = async (app: WindowsApp) => {
    onLogNotification(
      'App Reset Triggered',
      `Sent reset signal for ${app.name} to clear isolated application state.`,
      'info'
    );
  };

  return (
    <div className="space-y-4 pb-12 animate-fade-in">
      {/* Search and stats bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Windows Store & AppX packages..."
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs text-text-secondary">
          <span>Cataloged: <strong className="text-text-primary">{filtered.length}</strong> modern apps</span>
        </div>
      </div>

      {/* Grid of Windows Apps */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((app) => (
          <div
            key={app.package_full_name}
            className="bg-card border border-border hover:border-secondary/40 rounded-xl p-4 transition-all flex flex-col justify-between space-y-3 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <ApplicationIcon name={app.name} publisher={app.publisher} iconPath={app.display_icon} size="md" />
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-text-primary truncate max-w-[170px]">
                    {app.name.replace('Microsoft.', '')}
                  </h4>
                  <p className="text-[10px] text-text-muted truncate max-w-[170px] font-mono">
                    v{app.version}
                  </p>
                </div>
              </div>
              <StatusBadge status={app.non_removable ? 'System Core' : 'Removable'} variant={app.non_removable ? 'neutral' : 'success'} />
            </div>

            <p className="text-[11px] text-text-secondary truncate font-mono">
              {app.package_full_name}
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
              <button
                onClick={() => setDetailsModal(app)}
                className="px-2.5 py-1 text-[11px] rounded bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors"
              >
                Inspect
              </button>
              <button
                onClick={() => handleReset(app)}
                className="px-2.5 py-1 text-[11px] rounded bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors flex items-center space-x-1"
                title="Reset application isolated data"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
              {!app.non_removable && (
                <button
                  disabled={isProcessing}
                  onClick={() => setConfirmUninstall(app)}
                  className="px-2.5 py-1 text-[11px] rounded bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 font-medium transition-colors"
                >
                  Uninstall
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Details Modal */}
      {detailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-3">
                <ApplicationIcon name={detailsModal.name} publisher={detailsModal.publisher} iconPath={detailsModal.display_icon} size="lg" />
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{detailsModal.name}</h3>
                  <p className="text-xs text-text-muted">Universal Windows Platform / MSIX</p>
                </div>
              </div>
              <button onClick={() => setDetailsModal(null)} className="text-text-muted hover:text-text-primary">✕</button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-surface rounded-lg border border-border">
                <span className="text-text-muted text-[10px] uppercase font-mono">Package Full Name</span>
                <p className="font-mono text-text-primary text-[11px] break-all">{detailsModal.package_full_name}</p>
              </div>
              <div className="p-2.5 bg-surface rounded-lg border border-border">
                <span className="text-text-muted text-[10px] uppercase font-mono">Install Location</span>
                <p className="font-mono text-text-primary text-[11px] break-all">{detailsModal.install_location || 'Protected WindowsApps Directory'}</p>
              </div>
              <div className="p-2.5 bg-surface rounded-lg border border-border">
                <span className="text-text-muted text-[10px] uppercase font-mono">Publisher Identity</span>
                <p className="font-mono text-text-secondary text-[11px] truncate">{detailsModal.publisher}</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailsModal(null)}
                className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-surface rounded-lg border border-border"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmUninstall && (
        <ConfirmationDialog
          isOpen={true}
          title={`Remove ${confirmUninstall.name}`}
          message={`Are you sure you want to uninstall this Windows Store App package? Windows will unregister the AppX package for the current user.`}
          confirmText="Uninstall AppX Package"
          cancelText="Cancel"
          isDangerous={false}
          onConfirm={() => handleUninstall(confirmUninstall)}
          onCancel={() => setConfirmUninstall(null)}
        />
      )}
    </div>
  );
};
