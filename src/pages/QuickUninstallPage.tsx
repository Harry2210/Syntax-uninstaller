import React, { useState } from 'react';
import { InstalledApp } from '../types';
import { api } from '../services/api';
import { FastForward, Search, ShieldCheck, Zap, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { ProgressDialog, UninstallationStep } from '../components/common/ProgressDialog';
import { ApplicationIcon } from '../components/common/ApplicationIcon';

interface QuickUninstallPageProps {
  apps: InstalledApp[];
  onRefresh: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const QuickUninstallPage: React.FC<QuickUninstallPageProps> = ({
  apps,
  onRefresh,
  onLogNotification,
}) => {
  const [search, setSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentApp, setCurrentApp] = useState<InstalledApp | null>(null);
  const [steps, setSteps] = useState<UninstallationStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [canClose, setCanClose] = useState(false);

  const filtered = apps.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.publisher.toLowerCase().includes(search.toLowerCase())
  );

  const handleQuickUninstall = async (app: InstalledApp) => {
    setCurrentApp(app);
    setIsProcessing(true);
    setCanClose(false);

    const initialSteps: UninstallationStep[] = [
      { title: 'Silent Switch Preparation', description: 'Configuring non-interactive uninstall parameters', state: 'in-progress' },
      { title: 'Silent Execution', description: `Running quiet uninstaller for ${app.name}`, state: 'pending' },
      { title: 'Automatic Leftover Sweep', description: 'Detecting and removing verified leftover items', state: 'pending' },
    ];
    setSteps(initialSteps);
    setStepIdx(0);

    try {
      // Step 1: Silent flag prep
      await new Promise((r) => setTimeout(r, 600));
      setSteps((prev) =>
        prev.map((s, idx) => (idx === 0 ? { ...s, state: 'completed' } : idx === 1 ? { ...s, state: 'in-progress' } : s))
      );
      setStepIdx(1);

      // Step 2: Run quiet uninstaller
      const cmd = app.quiet_uninstall_string || app.uninstall_string;
      await api.runUninstaller(cmd, true);
      setSteps((prev) =>
        prev.map((s, idx) => (idx === 1 ? { ...s, state: 'completed' } : idx === 2 ? { ...s, state: 'in-progress' } : s))
      );
      setStepIdx(2);

      // Step 3: Auto leftover sweep
      const leftovers = await api.scanLeftovers(app.name, app.publisher, app.install_location, 'Safe');
      const [count, bytes] = await api.removeLeftovers(leftovers);
      setSteps((prev) =>
        prev.map((s, idx) => (idx === 2 ? { ...s, state: 'completed' } : s))
      );

      onLogNotification(
        'Quick Uninstall Finished',
        `Quietly removed ${app.name} and purged ${count} leftover traces (${(bytes / 1024).toFixed(0)} KB freed).`,
        'success'
      );
      onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onLogNotification('Quick Uninstall Error', `Failed to remove ${app.name}: ${msg}`, 'error');
    } finally {
      setCanClose(true);
    }
  };

  return (
    <div className="space-y-4 pb-12 animate-fade-in max-w-5xl">
      <div className="p-4 bg-primary/10 border border-primary/25 rounded-2xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/20 text-primary rounded-xl">
            <FastForward className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Automated Quick Uninstaller</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Click any application below to immediately invoke its silent uninstaller and automatically sweep safe leftover files.
            </p>
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter programs for quick silent removal..."
          className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
        />
      </div>

      <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
        {filtered.map((app) => (
          <div
            key={app.id}
            className="p-3.5 flex items-center justify-between hover:bg-surface/50 transition-colors text-xs"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <ApplicationIcon name={app.name} publisher={app.publisher} iconPath={app.display_icon} size="md" />
              <div className="min-w-0">
                <span className="font-semibold text-text-primary block truncate max-w-xs">{app.name}</span>
                <span className="text-[11px] text-text-muted truncate max-w-xs block">{app.publisher} • v{app.version}</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-text-muted font-mono hidden sm:inline">
                {app.estimated_size_kb > 0 ? `${(app.estimated_size_kb / 1024).toFixed(1)} MB` : '—'}
              </span>
              <button
                disabled={isProcessing}
                onClick={() => handleQuickUninstall(app)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary-hover text-background font-bold rounded-lg text-xs transition-all shadow-sm disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Quick Uninstall</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <ProgressDialog
        isOpen={isProcessing}
        title={`Quick Uninstalling ${currentApp?.name}`}
        subtitle="Automated background uninstaller sequence"
        steps={steps}
        currentStepIndex={stepIdx}
        canClose={canClose}
        onClose={() => setIsProcessing(false)}
      />
    </div>
  );
};
