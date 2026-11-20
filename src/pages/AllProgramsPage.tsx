import React, { useState, useMemo } from 'react';
import { InstalledApp, LeftoverItem } from '../types';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { ProgressDialog, UninstallationStep } from '../components/common/ProgressDialog';
import { ApplicationIcon } from '../components/common/ApplicationIcon';
import { LaserScanline } from '../components/common/ProcessAnimation';
import {
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Trash2,
  Zap,
  FolderOpen,
  Globe,
  Info,
  ShieldCheck,
  LayoutGrid,
  List,
  AlignJustify,
  ExternalLink,
  Check,
  AlertTriangle,
  RotateCcw,
  Loader2,
  PackageSearch,
} from 'lucide-react';

interface AllProgramsPageProps {
  apps: InstalledApp[];
  onRefresh: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
  isLoading?: boolean;
}

type ViewMode = 'details' | 'grid' | 'compact';

export const AllProgramsPage: React.FC<AllProgramsPageProps> = ({
  apps,
  onRefresh,
  onLogNotification,
  isLoading = false,
}) => {
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'large' | 'warning'>('all');
  const [filterArch, setFilterArch] = useState<string>('all');
  const [filterHealth, setFilterHealth] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date' | 'health'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('details');
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());

  // Modal states
  const [detailsApp, setDetailsApp] = useState<InstalledApp | null>(null);
  const [confirmUninstallApp, setConfirmUninstallApp] = useState<InstalledApp | null>(null);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [uninstallSteps, setUninstallSteps] = useState<UninstallationStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [canCloseProgress, setCanCloseProgress] = useState(false);

  // Leftovers review state
  const [scannedLeftovers, setScannedLeftovers] = useState<LeftoverItem[]>([]);
  const [showLeftoversModal, setShowLeftoversModal] = useState(false);
  const [activeUninstallingApp, setActiveUninstallingApp] = useState<InstalledApp | null>(null);

  // Filtered & Sorted Apps
  const filteredApps = useMemo(() => {
    return apps
      .filter((app) => {
        const matchesSearch =
          app.name.toLowerCase().includes(search.toLowerCase()) ||
          app.publisher.toLowerCase().includes(search.toLowerCase());

        const matchesArch =
          filterArch === 'all' ||
          (filterArch === 'x64' && app.architecture === 'x64') ||
          (filterArch === 'x86' && app.architecture === 'x86') ||
          (filterArch === 'user' && app.registry_source.includes('User'));

        const matchesHealth =
          filterHealth === 'all' ||
          (filterHealth === 'healthy' && app.health_score >= 80) ||
          (filterHealth === 'warning' && app.health_score < 80);

        let matchesQuick = true;
        if (quickFilter === 'large') {
          matchesQuick = app.estimated_size_kb >= 500 * 1024;
        } else if (quickFilter === 'warning') {
          matchesQuick = app.health_score < 80;
        }

        return matchesSearch && matchesArch && matchesHealth && matchesQuick;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'name') diff = a.name.localeCompare(b.name);
        if (sortBy === 'size') diff = a.estimated_size_kb - b.estimated_size_kb;
        if (sortBy === 'date') diff = a.install_date.localeCompare(b.install_date);
        if (sortBy === 'health') diff = a.health_score - b.health_score;
        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [apps, search, filterArch, filterHealth, quickFilter, sortBy, sortOrder]);

  const clearFilters = () => {
    setSearch('');
    setQuickFilter('all');
    setFilterArch('all');
    setFilterHealth('all');
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedAppIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedAppIds(next);
  };

  const selectAll = () => {
    if (selectedAppIds.size === filteredApps.length) setSelectedAppIds(new Set());
    else setSelectedAppIds(new Set(filteredApps.map((a) => a.id)));
  };

  const handleStartUninstall = async (app: InstalledApp, quiet: boolean = false) => {
    setConfirmUninstallApp(null);
    setActiveUninstallingApp(app);
    setIsUninstalling(true);
    setCanCloseProgress(false);

    const initialSteps: UninstallationStep[] = [
      { title: 'System Restore Point & Registry Snapshot', description: 'Creating safety rollback snapshot', state: 'in-progress' },
      { title: 'Process Verification', description: 'Checking and closing related active application processes', state: 'pending' },
      { title: 'Executing Official Uninstaller', description: `Running ${app.name} uninstaller`, state: 'pending' },
      { title: 'Advanced Leftover Scanner', description: 'Scanning Registry hives, AppData, and ProgramData', state: 'pending' },
      { title: 'Cleanup & Knowledge Record', description: 'Finalizing safe leftover removal and audit logging', state: 'pending' },
    ];
    setUninstallSteps(initialSteps);
    setCurrentStepIndex(0);

    // Step 1: Restore point
    await api.createRestorePoint(`Syntax Uninstaller: ${app.name}`);
    setUninstallSteps((prev) =>
      prev.map((s, idx) => (idx === 0 ? { ...s, state: 'completed' } : idx === 1 ? { ...s, state: 'in-progress' } : s))
    );
    setCurrentStepIndex(1);

    // Step 2: Process check
    const procs = await api.checkAppProcesses(app.name, app.install_location);
    for (const p of procs) {
      await api.killAppProcess(p.pid);
    }
    setUninstallSteps((prev) =>
      prev.map((s, idx) => (idx === 1 ? { ...s, state: 'completed' } : idx === 2 ? { ...s, state: 'in-progress' } : s))
    );
    setCurrentStepIndex(2);

    // Step 3: Run the official uninstaller — or the AppX remover for Store apps
    if (app.package_full_name) {
      await api.uninstallWindowsApp(app.package_full_name);
    } else {
      await api.runUninstaller(app.uninstall_string || app.quiet_uninstall_string, quiet);
    }
    setUninstallSteps((prev) =>
      prev.map((s, idx) => (idx === 2 ? { ...s, state: 'completed' } : idx === 3 ? { ...s, state: 'in-progress' } : s))
    );
    setCurrentStepIndex(3);

    // Step 4: Leftover scan. MSIX packages are removed by the AppX deployment
    // service and do not leave registry leftovers behind.
    const leftovers = app.package_full_name
      ? []
      : await api.scanLeftovers(app.name, app.publisher, app.install_location, 'Moderate');
    setScannedLeftovers(leftovers);
    setUninstallSteps((prev) =>
      prev.map((s, idx) => (idx === 3 ? { ...s, state: 'completed' } : idx === 4 ? { ...s, state: 'completed' } : s))
    );
    setCurrentStepIndex(4);
    setCanCloseProgress(true);

    if (leftovers.length > 0) {
      setIsUninstalling(false);
      setShowLeftoversModal(true);
    } else {
      onLogNotification('Uninstall Complete', `Successfully uninstalled ${app.name} with no leftovers remaining.`, 'success');
      onRefresh();
    }
  };

  const handlePurgeLeftovers = async () => {
    const [count, bytes] = await api.removeLeftovers(scannedLeftovers);
    setShowLeftoversModal(false);
    onLogNotification(
      'Leftovers Removed',
      `Safely removed ${count} leftovers freeing ${(bytes / (1024 * 1024)).toFixed(1)} MB.`,
      'success'
    );
    onRefresh();
  };

  const exportInventory = (format: 'json' | 'csv') => {
    let content = '';
    let filename = `syntax_apps_${Date.now()}.${format}`;
    let mime = 'text/plain';

    if (format === 'json') {
      content = JSON.stringify(filteredApps, null, 2);
      mime = 'application/json';
    } else {
      const headers = ['Name', 'Publisher', 'Version', 'Size_KB', 'Architecture', 'InstallLocation'];
      const rows = filteredApps.map((a) => [
        `"${a.name.replace(/"/g, '""')}"`,
        `"${a.publisher.replace(/"/g, '""')}"`,
        `"${a.version}"`,
        a.estimated_size_kb,
        a.architecture,
        `"${a.install_location.replace(/"/g, '""')}"`,
      ]);
      content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      mime = 'text/csv';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    onLogNotification('Inventory Exported', `Exported ${filteredApps.length} applications to ${filename}`, 'info');
  };

  return (
    <div className="space-y-4 pb-12 animate-fade-in">
      {/* Search & Action Bar */}
      <div className="space-y-3 bg-card border border-border p-3 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search installed programs or publishers..."
              className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Filters and View toggles */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <select
                  value={filterArch}
                  onChange={(e) => setFilterArch(e.target.value)}
                  className="bg-surface border border-border rounded-xl px-2.5 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="all">All Architectures</option>
                  <option value="x64">64-bit (x64)</option>
                  <option value="x86">32-bit (x86)</option>
                  <option value="user">Per-User Installs</option>
                </select>

                <select
                  value={filterHealth}
                  onChange={(e) => setFilterHealth(e.target.value)}
                  className="bg-surface border border-border rounded-xl px-2.5 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="all">All Health Scores</option>
                  <option value="healthy">Healthy (80%+)</option>
                  <option value="warning">Review Needed (&lt;80%)</option>
                </select>

            {/* Sort order toggle */}
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 bg-surface hover:bg-surface-elevated border border-border rounded-xl text-text-secondary hover:text-text-primary transition-colors"
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>

                <button
                  onClick={() => exportInventory('csv')}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-surface hover:bg-surface-elevated border border-border rounded-xl text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => exportInventory('json')}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-surface hover:bg-surface-elevated border border-border rounded-xl text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>JSON</span>
                </button>

            {/* View Mode buttons */}
            <div className="flex items-center border border-border rounded-xl overflow-hidden bg-surface">
              <button
                onClick={() => setViewMode('details')}
                className={`p-2 transition-colors ${viewMode === 'details' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'}`}
                title="Details View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'}`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Filter Chips (Beginner Friendly) */}
        <div className="flex items-center space-x-2 pt-1 overflow-x-auto pb-0.5 border-t border-border/40">
          <button
            onClick={() => setQuickFilter('all')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
              quickFilter === 'all'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface hover:bg-surface-elevated text-text-muted hover:text-text-primary border border-border'
            }`}
          >
            All Programs ({apps.length})
          </button>
          <button
            onClick={() => setQuickFilter('large')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
              quickFilter === 'large'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface hover:bg-surface-elevated text-text-muted hover:text-text-primary border border-border'
            }`}
          >
            Heavy Apps (&gt; 500 MB)
          </button>
          <button
            onClick={() => setQuickFilter('warning')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
              quickFilter === 'warning'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-surface hover:bg-surface-elevated text-text-muted hover:text-text-primary border border-border'
            }`}
          >
            Needs Review
          </button>
        </div>
      </div>

      {/* Summary Row */}
      <div className="flex items-center justify-between text-xs text-text-secondary px-1">
        <span>
          Showing <strong className="text-text-primary">{filteredApps.length}</strong> of {apps.length} programs
          {selectedAppIds.size > 0 && ` • ${selectedAppIds.size} selected`}
        </span>
        <button
          onClick={selectAll}
          className="text-primary hover:underline font-medium text-xs"
        >
          {selectedAppIds.size === filteredApps.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Scanning state — the page used to look empty while the registry scan ran */}
      {isLoading && apps.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-xs font-bold text-text-primary">Scanning installed programs…</p>
          <p className="text-[11px] text-text-muted">
            Reading the Windows registry and application icons. This takes a few seconds.
          </p>
        </div>
      )}

      {/* Empty / filtered-out state with an obvious way back */}
      {!isLoading && filteredApps.length === 0 && (
        <EmptyState
          icon={PackageSearch}
          title={apps.length === 0 ? 'No programs were found' : 'No programs match these filters'}
          description={
            apps.length === 0
              ? 'The scan returned no entries. Use the refresh button in the top bar, or restart the app as administrator.'
              : `All ${apps.length} installed programs are hidden by the current search or quick filter.`
          }
          actionText={apps.length === 0 ? undefined : 'Clear all filters'}
          onAction={apps.length === 0 ? undefined : clearFilters}
        />
      )}

      {/* Main Apps View */}
      {filteredApps.length > 0 && viewMode === 'details' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface/80 border-b border-border text-text-secondary font-medium">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredApps.length > 0 && selectedAppIds.size === filteredApps.length}
                      onChange={selectAll}
                      className="rounded border-border text-primary focus:ring-0"
                    />
                  </th>
                  <th
                    className="p-3 cursor-pointer hover:text-text-primary transition-colors"
                    onClick={() => {
                      setSortBy('name');
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    Application Name
                  </th>
                  <th className="p-3">Publisher</th>
                  <th className="p-3">Version</th>
                  <th
                    className="p-3 cursor-pointer hover:text-text-primary transition-colors"
                    onClick={() => {
                      setSortBy('size');
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    Size
                  </th>
                  <th
                    className="p-3 cursor-pointer hover:text-text-primary transition-colors"
                    onClick={() => {
                      setSortBy('health');
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    Health Score
                  </th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredApps.map((app) => {
                  const isSelected = selectedAppIds.has(app.id);
                  return (
                    <tr
                      key={app.id}
                      className={`hover:bg-surface/50 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(app.id)}
                          className="rounded border-border text-primary focus:ring-0"
                        />
                      </td>
                      <td className="p-3 font-medium text-text-primary">
                        <div className="flex items-center space-x-3">
                          <ApplicationIcon name={app.name} publisher={app.publisher} iconPath={app.display_icon} size="md" />
                          <div className="min-w-0">
                            <span className="font-semibold block truncate max-w-xs text-xs">
                              {app.name}
                              {app.package_full_name && (
                                <span className="ml-1.5 align-middle text-[9px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/25 font-bold">
                                  STORE
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-text-muted truncate block">
                              {app.publisher || 'Unknown Publisher'} • v{app.version}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-text-secondary truncate max-w-[140px]">{app.publisher}</td>
                      <td className="p-3 text-text-muted font-mono">{app.version}</td>
                      <td className="p-3 text-text-secondary font-mono font-bold">
                        {app.estimated_size_kb > 0 ? `${(app.estimated_size_kb / 1024).toFixed(1)} MB` : '—'}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-16 h-1.5 bg-surface rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                app.health_score >= 80 ? 'bg-secondary' : app.health_score >= 60 ? 'bg-warning' : 'bg-danger'
                              }`}
                              style={{ width: `${app.health_score}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-text-muted">{app.health_score}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setConfirmUninstallApp(app)}
                            className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm"
                            title="Uninstall application and clean leftovers"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Uninstall</span>
                          </button>
                          <button
                            onClick={() => setDetailsApp(app)}
                            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface rounded-xl border border-border transition-colors"
                            title="Inspect Properties & Health"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid View */}
      {filteredApps.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="bg-card border border-border hover:border-primary/50 rounded-xl p-4 transition-all duration-200 flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <ApplicationIcon name={app.name} publisher={app.publisher} iconPath={app.display_icon} size="md" />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-text-primary truncate max-w-[170px]">{app.name}</h4>
                    <p className="text-[11px] text-text-muted truncate max-w-[170px]">{app.publisher}</p>
                  </div>
                </div>
                <StatusBadge status={`${app.health_score}%`} variant={app.health_score >= 80 ? 'success' : 'warning'} />
              </div>

              <div className="text-[11px] space-y-1 text-text-muted font-mono pt-1">
                <div className="flex justify-between">
                  <span>Version:</span>
                  <span className="text-text-secondary">{app.version}</span>
                </div>
                <div className="flex justify-between">
                  <span>Size:</span>
                  <span className="text-text-secondary">
                    {app.estimated_size_kb > 0 ? `${(app.estimated_size_kb / 1024).toFixed(1)} MB` : '—'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
                <button
                  onClick={() => setDetailsApp(app)}
                  className="px-2.5 py-1 text-[11px] rounded bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors"
                >
                  Details
                </button>
                <button
                  onClick={() => setConfirmUninstallApp(app)}
                  className="px-2.5 py-1 text-[11px] rounded bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 font-medium transition-colors"
                >
                  Uninstall
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compact View */}
      {filteredApps.length > 0 && viewMode === 'compact' && (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {filteredApps.map((app) => (
            <div key={app.id} className="p-2.5 flex items-center justify-between hover:bg-surface/40 text-xs">
              <div className="flex items-center space-x-3">
                <ApplicationIcon name={app.name} publisher={app.publisher} iconPath={app.display_icon} size="sm" />
                <span className="font-semibold text-text-primary">{app.name}</span>
                <span className="text-text-muted font-mono">v{app.version}</span>
                <span className="text-text-muted">({app.publisher})</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="font-mono text-text-secondary">
                  {app.estimated_size_kb > 0 ? `${(app.estimated_size_kb / 1024).toFixed(1)} MB` : ''}
                </span>
                <button
                  onClick={() => setConfirmUninstallApp(app)}
                  className="text-danger hover:text-rose-400 font-medium"
                >
                  Uninstall
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Application Properties / Health Score Details Modal */}
      {detailsApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div className="flex items-center space-x-3">
                <ApplicationIcon name={detailsApp.name} publisher={detailsApp.publisher} iconPath={detailsApp.display_icon} size="lg" />
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{detailsApp.name}</h3>
                  <p className="text-xs text-text-muted">{detailsApp.publisher}</p>
                </div>
              </div>
              <button
                onClick={() => setDetailsApp(null)}
                className="text-text-muted hover:text-text-primary p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-surface border border-border space-y-1">
                <span className="text-text-muted text-[10px] uppercase font-mono">Version</span>
                <p className="text-text-primary font-semibold">{detailsApp.version}</p>
              </div>
              <div className="p-3 rounded-lg bg-surface border border-border space-y-1">
                <span className="text-text-muted text-[10px] uppercase font-mono">Architecture</span>
                <p className="text-text-primary font-semibold">{detailsApp.architecture} ({detailsApp.registry_source})</p>
              </div>
              <div className="p-3 rounded-lg bg-surface border border-border space-y-1 col-span-2">
                <span className="text-text-muted text-[10px] uppercase font-mono">Installation Folder</span>
                <p className="text-text-primary font-mono text-[11px] truncate">{detailsApp.install_location || 'Not explicitly registered'}</p>
              </div>
              <div className="p-3 rounded-lg bg-surface border border-border space-y-1 col-span-2">
                <span className="text-text-muted text-[10px] uppercase font-mono">Uninstall Command</span>
                <p className="text-text-primary font-mono text-[11px] truncate">{detailsApp.uninstall_string || 'None'}</p>
              </div>
            </div>

            {/* Health Score Breakdown */}
            <div className="p-4 rounded-xl bg-surface/50 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary">Application Health Score</span>
                <StatusBadge status={`${detailsApp.health_score}/100`} variant={detailsApp.health_score >= 80 ? 'success' : 'warning'} />
              </div>
              <div className="space-y-1 pt-1">
                {detailsApp.health_notes.map((note, idx) => (
                  <p key={idx} className="text-xs text-text-secondary flex items-center space-x-1.5">
                    <span className="text-secondary">•</span>
                    <span>{note}</span>
                  </p>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setDetailsApp(null)}
                className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-surface rounded-lg border border-border"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmUninstallApp && (
        <ConfirmationDialog
          isOpen={true}
          title={`Uninstall ${confirmUninstallApp.name}`}
          message={`Are you sure you want to uninstall ${confirmUninstallApp.name}? Syntax Uninstaller will automatically create a System Restore Point, execute the official uninstaller, and scan for leftover Registry keys and files.`}
          details={[
            `Publisher: ${confirmUninstallApp.publisher}`,
            `Install Path: ${confirmUninstallApp.install_location || 'Default system location'}`,
            `Registered Command: ${confirmUninstallApp.uninstall_string}`,
          ]}
          confirmText="Start Complete Uninstall"
          cancelText="Cancel"
          isDangerous={false}
          onConfirm={() => handleStartUninstall(confirmUninstallApp, false)}
          onCancel={() => setConfirmUninstallApp(null)}
        />
      )}

      {/* Uninstallation & Scanning Progress Dialog */}
      <ProgressDialog
        isOpen={isUninstalling}
        title={`Uninstalling ${activeUninstallingApp?.name || 'Program'}`}
        subtitle="Executing multi-stage verified uninstaller and leftover detection engine"
        steps={uninstallSteps}
        currentStepIndex={currentStepIndex}
        canClose={canCloseProgress}
        onClose={() => setIsUninstalling(false)}
      />

      {/* Leftovers Review & Removal Modal */}
      {showLeftoversModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-text-primary flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-secondary" />
                  <span>Leftovers Detected for {activeUninstallingApp?.name}</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Review orphaned Registry keys and files discovered after uninstaller execution.
                </p>
              </div>
              <button
                onClick={() => setShowLeftoversModal(false)}
                className="text-text-muted hover:text-text-primary p-1"
              >
                ✕
              </button>
            </div>

            {/* Leftovers List */}
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {scannedLeftovers.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-surface border border-border flex items-start space-x-3"
                >
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={(e) => {
                      const next = [...scannedLeftovers];
                      next[idx].selected = e.target.checked;
                      setScannedLeftovers(next);
                    }}
                    className="mt-1 rounded border-border text-primary focus:ring-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-primary truncate max-w-md font-mono">
                        {item.path}
                      </span>
                      <StatusBadge status={item.item_type} variant="info" />
                    </div>
                    <p className="text-[11px] text-text-secondary mt-0.5">{item.reason}</p>
                    {item.size_bytes > 0 && (
                      <span className="text-[10px] text-text-muted font-mono">
                        Size: {(item.size_bytes / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-xs text-text-muted">
                {scannedLeftovers.filter((i) => i.selected).length} items selected for safe removal
              </span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowLeftoversModal(false)}
                  className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-surface rounded-lg border border-border"
                >
                  Skip Remaining
                </button>
                <button
                  onClick={handlePurgeLeftovers}
                  className="px-4 py-2 text-xs font-medium text-white bg-danger hover:bg-rose-600 rounded-lg shadow-md transition-colors"
                >
                  Purge Selected Leftovers
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
