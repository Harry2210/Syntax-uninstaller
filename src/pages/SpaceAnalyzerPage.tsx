import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Copy,
  File,
  FolderOpen,
  FolderTree,
  HardDrive,
  PieChart,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { SystemSpecs } from '../types';
import { SpaceReport, SpaceScanProgress } from '../types';
import { api, isTauriRuntime } from '../services/api';
import { ScanningRadar } from '../components/common/ProcessAnimation';

interface SpaceAnalyzerPageProps {
  specs: SystemSpecs | null;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  const digits = value >= 100 || exponent === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[exponent]}`;
}

const NUMBER_FORMAT = new Intl.NumberFormat();

function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value);
}

/** Returns the parent folder, or null at a drive root. */
function parentPath(path: string): string | null {
  if (!path) return null;
  const cleaned = path.replace(/[\\/]+$/, '');
  if (!cleaned || /^[A-Za-z]:$/.test(cleaned) || /^\\\\[^\\]+$/.test(cleaned)) return null;
  const index = Math.max(cleaned.lastIndexOf('\\'), cleaned.lastIndexOf('/'));
  if (index < 0) return null;
  const parent = cleaned.slice(0, index);
  if (!parent) return null;
  return /^[A-Za-z]:$/.test(parent) ? `${parent}\\` : parent;
}

/**
 * Copy text with a fallback for embedded webviews where the async clipboard
 * API is unavailable or blocked. Returns true when the text was copied.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path below.
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

function buildBreadcrumbs(root: string): { label: string; path: string }[] {
  if (!root) return [];
  const normalized = root.replace(/\//g, '\\').replace(/\\+$/, '');
  const parts = normalized.split('\\').filter(Boolean);
  const crumbs: { label: string; path: string }[] = [];
  let accumulated = '';

  for (const part of parts) {
    accumulated = accumulated ? `${accumulated}\\${part}` : part;
    crumbs.push({
      label: part,
      path: /^[A-Za-z]:$/.test(accumulated) ? `${accumulated}\\` : accumulated,
    });
  }

  return crumbs;
}

export const SpaceAnalyzerPage: React.FC<SpaceAnalyzerPageProps> = ({ specs, onLogNotification }) => {
  const [pathInput, setPathInput] = useState('C:\\');
  const [activeRoot, setActiveRoot] = useState('C:\\');
  const [report, setReport] = useState<SpaceReport | null>(null);
  const [progress, setProgress] = useState<SpaceScanProgress | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const copyTimer = useRef<number | null>(null);
  const scanningRef = useRef(false);

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  // Live progress from the native scanner. The event only exists inside the
  // desktop shell, so the browser preview simply skips it.
  useEffect(() => {
    if (!isTauriRuntime()) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<SpaceScanProgress>('space-scan-progress', (event) => {
          if (!cancelled) setProgress(event.payload);
        })
      )
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch(() => {
        // Progress is a nicety; the scan itself still completes.
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const runScan = useCallback(
    async (target: string, refresh = false, notify = true) => {
      const trimmed = target.trim();
      if (!trimmed) {
        setError('Enter a folder or drive to scan.');
        return;
      }
      if (scanningRef.current) return;

      scanningRef.current = true;
      setIsScanning(true);
      setError(null);
      setProgress(null);

      try {
        const result = await api.analyzeDiskSpace(trimmed, refresh);
        const resolvedRoot = result.root || trimmed;
        setReport(result);
        setActiveRoot(resolvedRoot);
        setPathInput(resolvedRoot);
        if (notify) {
          onLogNotification(
            'Disk Space Map Ready',
            `Scanned ${formatBytes(result.total_bytes)} across ${formatNumber(result.file_count)} files in ${(
              result.duration_ms / 1000
            ).toFixed(1)}s without changing anything.`,
            'success'
          );
        }
      } catch (scanError) {
        const message = scanError instanceof Error ? scanError.message : String(scanError);
        setError(message);
        onLogNotification('Disk Space Scan Failed', message, 'error');
      } finally {
        scanningRef.current = false;
        setIsScanning(false);
        setProgress(null);
      }
    },
    [onLogNotification]
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // The main action labeled "Scan Again" should bypass the short result
    // cache; first-time scans have nothing cached anyway.
    void runScan(pathInput, report !== null);
  };

  const openFolder = (path: string) => {
    setPathInput(path);
    // Drill-down is a navigation action, not an audited operation, so it
    // should stay quiet and reuse the cache when possible.
    void runScan(path, false, false);
  };

  const copyPath = async (path: string) => {
    const copied = await copyToClipboard(path);
    if (copied) {
      setCopiedPath(path);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopiedPath(null), 1600);
    } else {
      onLogNotification('Copy Failed', 'The clipboard is not available in this window.', 'warning');
    }
  };

  const drives = specs?.disks ?? [];
  const breadcrumbs = useMemo(() => buildBreadcrumbs(activeRoot), [activeRoot]);
  const up = useMemo(() => (report ? parentPath(report.root) : null), [report]);

  const largestFolderBytes = useMemo(() => {
    if (!report || report.top_folders.length === 0) return 0;
    return Math.max(...report.top_folders.map((entry) => entry.size_bytes));
  }, [report]);

  const largestCategoryBytes = useMemo(() => {
    if (!report || report.categories.length === 0) return 0;
    return Math.max(...report.categories.map((entry) => entry.size_bytes));
  }, [report]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-6xl">
      {/* Header */}
      <div className="p-5 bg-card border border-border rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-teal-500/15 text-teal-500 rounded-2xl">
            <PieChart className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Disk Space Map</h3>
            <p className="text-xs text-text-muted mt-0.5">
              See which folders and file types occupy your drive. This tool is strictly read-only.
            </p>
          </div>
        </div>

        <span className="inline-flex items-center space-x-1.5 self-start lg:self-auto px-3 py-1.5 rounded-full bg-secondary/10 border border-secondary/30 text-[11px] font-semibold text-secondary">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Read-only · nothing is deleted</span>
        </span>
      </div>

      {/* Path picker */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FolderOpen className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={pathInput}
              onChange={(event) => setPathInput(event.target.value)}
              placeholder="Drive or folder, e.g. C:\ or %USERPROFILE%"
              spellCheck={false}
              className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isScanning}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 transition-all"
          >
            {isScanning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : report ? (
              <RefreshCw className="w-4 h-4" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>{isScanning ? 'Scanning…' : report ? 'Scan Again' : 'Scan Disk'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Shortcuts</span>

          {drives.map((drive) => (
            <button
              key={drive.mount_point}
              type="button"
              disabled={isScanning}
              onClick={() => {
                setPathInput(drive.mount_point);
                void runScan(drive.mount_point);
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-[11px] text-text-secondary hover:text-text-primary hover:border-primary/40 disabled:opacity-50 transition-colors"
              title={`${formatBytes(drive.available_space_bytes)} free of ${formatBytes(drive.total_space_bytes)}`}
            >
              <HardDrive className="w-3.5 h-3.5 text-text-muted" />
              <span className="font-mono font-semibold">{drive.name || drive.mount_point}</span>
              <span className="text-text-muted">{formatBytes(drive.available_space_bytes)} free</span>
            </button>
          ))}

          {[
            { label: 'User profile', value: '%USERPROFILE%' },
            { label: 'Temp folder', value: '%TEMP%' },
          ].map((shortcut) => (
            <button
              key={shortcut.value}
              type="button"
              disabled={isScanning}
              onClick={() => {
                setPathInput(shortcut.value);
                void runScan(shortcut.value);
              }}
              className="px-3 py-1.5 rounded-lg bg-surface border border-border text-[11px] text-text-secondary hover:text-text-primary hover:border-primary/40 disabled:opacity-50 transition-colors"
            >
              {shortcut.label}
            </button>
          ))}
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-start space-x-3 p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold">Could not scan that location</p>
            <p className="text-[11px] mt-0.5 break-words">{error}</p>
          </div>
        </div>
      )}

      {/* Scan progress */}
      {isScanning && (
        <div className="bg-card border border-primary/30 rounded-2xl p-5 space-y-3 shadow-lg shadow-primary/5">
          <ScanningRadar
            label={progress ? `Scanning ${progress.current_path}` : 'Counting files and folder sizes…'}
            sublabel={
              progress
                ? `${formatBytes(progress.scanned_bytes)} · ${formatNumber(progress.file_count)} files · ${formatNumber(
                    progress.folder_count
                  )} folders · ${(progress.elapsed_ms / 1000).toFixed(1)}s`
                : 'Large drives stop automatically at a safe time limit. Nothing on disk is modified.'
            }
          />
          <p className="text-[10px] text-text-muted font-mono break-all px-1">
            {progress?.current_path || activeRoot}
          </p>
        </div>
      )}

      {/* First-run explanation */}
      {!report && !isScanning && !error && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
            <div className="p-2 w-fit rounded-xl bg-primary/10 text-primary border border-primary/20">
              <FolderTree className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-text-primary">Folder-by-folder view</h4>
            <p className="text-[11px] text-text-muted leading-relaxed">
              The largest folders are listed first. Click one to drill into it, then use the breadcrumb to go back.
            </p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
            <div className="p-2 w-fit rounded-xl bg-secondary/10 text-secondary border border-secondary/20">
              <File className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-text-primary">Largest files</h4>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Find the individual files taking the most space, plus a file-type breakdown for photos, video, archives, and more.
            </p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
            <div className="p-2 w-fit rounded-xl bg-teal-500/10 text-teal-500 border border-teal-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-text-primary">Safe by design</h4>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Junctions, symlinks, and reparse points are skipped. Inaccessible folders are counted, never guessed at.
            </p>
          </div>
        </div>
      )}

      {/* Report */}
      {report && !isScanning && (
        <>
          {(report.truncated || report.inaccessible > 0) && (
            <div className="flex items-start space-x-3 p-4 rounded-xl border border-warning/30 bg-warning/10 text-warning">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                {report.truncated && (
                  <p className="font-semibold">
                    This scan hit its time or entry limit, so the totals below are partial. Scan a subfolder for a complete picture.
                  </p>
                )}
                {report.inaccessible > 0 && (
                  <p className={report.truncated ? 'mt-1' : ''}>
                    {formatNumber(report.inaccessible)} item{report.inaccessible === 1 ? '' : 's'} could not be read
                    (usually protected system folders). Everything readable was counted normally.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Root / breadcrumbs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center flex-wrap gap-1 min-w-0">
              {up && (
                <button
                  type="button"
                  onClick={() => openFolder(up)}
                  className="mr-1 px-2.5 py-1.5 rounded-lg bg-surface border border-border text-[11px] font-semibold text-text-secondary hover:text-text-primary hover:border-primary/40 transition-colors"
                >
                  Up one level
                </button>
              )}
              <HardDrive className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={crumb.path}>
                  {index > 0 && <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />}
                  <button
                    type="button"
                    onClick={() => openFolder(crumb.path)}
                    className="px-1.5 py-1 rounded text-[11px] font-mono font-semibold text-text-secondary hover:text-primary transition-colors truncate max-w-[220px]"
                    title={crumb.path}
                  >
                    {crumb.label}
                  </button>
                </React.Fragment>
              ))}
            </div>

            <p className="text-[10px] text-text-muted font-mono flex items-center space-x-1.5 flex-shrink-0">
              <Clock className="w-3 h-3" />
              <span>
                {new Date(report.scanned_at).toLocaleTimeString()} · {(report.duration_ms / 1000).toFixed(1)}s
              </span>
            </p>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-[10px] text-text-muted uppercase font-mono">Total size</span>
              <p className="text-xl font-bold text-text-primary mt-1">{formatBytes(report.total_bytes)}</p>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-[10px] text-text-muted uppercase font-mono">Files</span>
              <p className="text-xl font-bold text-text-primary mt-1">{formatNumber(report.file_count)}</p>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-[10px] text-text-muted uppercase font-mono">Folders</span>
              <p className="text-xl font-bold text-text-primary mt-1">{formatNumber(report.folder_count)}</p>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-[10px] text-text-muted uppercase font-mono">Folder coverage</span>
              <p className="text-xl font-bold text-secondary mt-1">
                {report.top_folders.length >= 40 ? 'Top 40 folders' : `${report.top_folders.length} folders`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Folder map */}
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center space-x-2">
                  <FolderTree className="w-4 h-4 text-primary" />
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Biggest folders</h4>
                </div>
                <span className="text-[10px] text-text-muted">Click a folder to open it</span>
              </div>

              {report.top_folders.length === 0 ? (
                <p className="text-xs text-text-muted py-6 text-center">
                  No files were found in this folder.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {report.top_folders.map((entry) => {
                    const width = largestFolderBytes > 0 ? Math.max(1, (entry.size_bytes / largestFolderBytes) * 100) : 0;
                    const share = report.total_bytes > 0 ? (entry.size_bytes / report.total_bytes) * 100 : 0;

                    return (
                      <button
                        key={`${entry.path}-${entry.name}`}
                        type="button"
                        disabled={!entry.is_dir}
                        onClick={() => entry.is_dir && openFolder(entry.path)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          entry.is_dir
                            ? 'bg-surface/50 border-border hover:border-primary/40 hover:bg-surface'
                            : 'bg-surface/30 border-border/60 cursor-default'
                        }`}
                        title={entry.path}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center space-x-2 min-w-0">
                            <FolderOpen className={`w-3.5 h-3.5 flex-shrink-0 ${entry.is_dir ? 'text-primary' : 'text-text-muted'}`} />
                            <span className="text-xs font-semibold text-text-primary truncate">{entry.name}</span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-xs font-mono font-bold text-secondary">{formatBytes(entry.size_bytes)}</span>
                            <span className="text-[10px] text-text-muted block font-mono">
                              {share.toFixed(1)}% · {formatNumber(entry.file_count)} files
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 w-full h-1.5 bg-card rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* File types */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <div className="flex items-center space-x-2 border-b border-border pb-3">
                <PieChart className="w-4 h-4 text-secondary" />
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">File types</h4>
              </div>

              {report.categories.length === 0 ? (
                <p className="text-xs text-text-muted py-6 text-center">No files to categorise.</p>
              ) : (
                <div className="space-y-3">
                  {report.categories.map((category) => {
                    const width =
                      largestCategoryBytes > 0 ? Math.max(1, (category.size_bytes / largestCategoryBytes) * 100) : 0;
                    return (
                      <div key={category.name} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-text-primary">{category.name}</span>
                          <span className="font-mono text-text-muted">{formatBytes(category.size_bytes)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-secondary/80" style={{ width: `${width}%` }} />
                        </div>
                        <p className="text-[10px] text-text-muted font-mono">
                          {formatNumber(category.file_count)} files
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Largest files */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <File className="w-4 h-4 text-warning" />
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Largest files</h4>
              </div>
              <span className="text-[10px] text-text-muted">Top {report.top_files.length}</span>
            </div>

            {report.top_files.length === 0 ? (
              <p className="text-xs text-text-muted py-6 text-center">No files were found in this folder.</p>
            ) : (
              <div className="divide-y divide-border">
                {report.top_files.map((entry, index) => (
                  <div key={entry.path} className="flex items-center gap-3 py-2.5">
                    <span className="w-6 text-[10px] font-mono text-text-muted flex-shrink-0 text-right">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-text-primary truncate">{entry.name}</p>
                      <p className="text-[10px] text-text-muted font-mono truncate" title={entry.path}>
                        {entry.path}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-secondary flex-shrink-0">
                      {formatBytes(entry.size_bytes)}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyPath(entry.path)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-surface transition-colors flex-shrink-0"
                      title="Copy full path"
                      aria-label={`Copy path of ${entry.name}`}
                    >
                      <Copy className={`w-3.5 h-3.5 ${copiedPath === entry.path ? 'text-secondary' : ''}`} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[11px] text-text-muted px-1 flex items-start space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-secondary flex-shrink-0 mt-0.5" />
            <span>
              This map is a snapshot of the scanned folder. Files changed or deleted by other apps afterwards may not be
              reflected until you scan again.
            </span>
          </p>
        </>
      )}
    </div>
  );
};
