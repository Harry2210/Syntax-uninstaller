import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SoftwareUpdate,
  UpdateOutcome,
  UpdateProgress,
  UpdateScan,
  UpdateStatus,
} from '../types';
import { api, isTauriRuntime } from '../services/api';
import { ApplicationIcon } from '../components/common/ApplicationIcon';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  DownloadCloud,
  Package,
  PackageCheck,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  X,
  XCircle,
} from 'lucide-react';

interface SoftwareUpdaterPageProps {
  onRefresh?: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

type Filter = 'all' | 'pending' | 'done' | 'failed';
type LogTone = 'muted' | 'info' | 'success' | 'warning' | 'error';

interface LogLine {
  id: number;
  time: string;
  text: string;
  tone: LogTone;
}

interface BatchState {
  active: boolean;
  ids: string[];
  total: number;
  currentMessage: string;
}

const TERMINAL: UpdateStatus[] = ['succeeded', 'failed', 'already-current', 'skipped'];

function isTerminal(status?: UpdateStatus): boolean {
  return Boolean(status && TERMINAL.includes(status));
}

function statusLabel(status?: UpdateStatus): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Updating';
    case 'succeeded':
      return 'Updated';
    case 'failed':
      return 'Failed';
    case 'already-current':
      return 'Up to date';
    case 'skipped':
      return 'Skipped';
    default:
      return 'Available';
  }
}

function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatScanTime(scannedAt?: string): string {
  if (!scannedAt) return 'Not scanned yet';
  const date = new Date(scannedAt);
  if (Number.isNaN(date.getTime())) return 'Not scanned yet';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function statusPill(status: UpdateStatus, requiresReboot: boolean): string {
  if (status === 'succeeded' && requiresReboot) {
    return 'bg-warning/10 text-warning border-warning/30';
  }
  switch (status) {
    case 'succeeded':
      return 'bg-success/10 text-success border-success/30';
    case 'failed':
      return 'bg-danger/10 text-danger border-danger/30';
    case 'running':
      return 'bg-secondary/10 text-secondary border-secondary/30';
    case 'queued':
      return 'bg-surface text-text-muted border-border';
    default:
      return 'bg-surface text-text-muted border-border';
  }
}

const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: React.ReactNode;
  tone?: string;
}> = ({ label, value, hint, icon, tone = 'text-text-primary' }) => (
  <div className="bg-surface/50 rounded-xl p-3 border border-border/50">
    <div className="flex items-center justify-between">
      <div className="text-[11px] text-text-muted font-medium">{label}</div>
      <div className="text-text-muted/70">{icon}</div>
    </div>
    <div className={`text-lg font-bold mt-1 ${tone}`}>{value}</div>
    <p className="text-[10px] text-text-muted mt-1">{hint}</p>
  </div>
);

export const SoftwareUpdaterPage: React.FC<SoftwareUpdaterPageProps> = ({
  onRefresh,
  onLogNotification,
}) => {
  const [scan, setScan] = useState<UpdateScan | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [scanError, setScanError] = useState<string | null>(null);
  const [rowStates, setRowStates] = useState<Record<string, UpdateProgress>>({});
  const [outcomes, setOutcomes] = useState<Record<string, UpdateOutcome>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [batch, setBatch] = useState<BatchState | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rebootNeeded, setRebootNeeded] = useState(false);
  const [rebootDismissed, setRebootDismissed] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const busyRef = useRef(false);
  const initialScanDone = useRef(false);
  const logKeys = useRef<Record<string, string>>({});
  const logCounter = useRef(0);
  const startedAt = useRef<number | null>(null);

  const busy = Boolean(busyId) || Boolean(batch?.active);

  const addLog = useCallback((text: string, tone: LogTone = 'muted') => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    const id = ++logCounter.current;
    setLogs((prev) => [{ id, time, text, tone }, ...prev].slice(0, 120));
  }, []);

  // Elapsed clock for long installers (Visual Studio can take many minutes).
  useEffect(() => {
    if (!busy) {
      startedAt.current = null;
      setElapsed(0);
      return;
    }
    if (startedAt.current === null) startedAt.current = Date.now();
    const timer = window.setInterval(() => {
      if (startedAt.current !== null) {
        setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  // Live milestones streamed by the Rust backend while WinGet runs.
  useEffect(() => {
    if (!isTauriRuntime()) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<UpdateProgress>('software-update-progress', (event) => {
          if (cancelled) return;
          const payload = event.payload;

          setRowStates((prev) => ({ ...prev, [payload.id]: payload }));

          if (payload.requires_reboot) {
            setRebootNeeded(true);
            setRebootDismissed(false);
          }

          setBatch((prev) => {
            if (!prev?.active) return prev;
            if (payload.status === 'queued') {
              return { ...prev, currentMessage: `Queued ${payload.index} of ${payload.total} packages…` };
            }
            return {
              ...prev,
              currentMessage: `${payload.name} — ${payload.message || statusLabel(payload.status)}`,
            };
          });

          if (payload.status === 'queued') return;

          const key = `${payload.status}|${payload.message}`;
          if (logKeys.current[payload.id] === key) return;
          logKeys.current[payload.id] = key;

          const tone: LogTone =
            payload.status === 'failed'
              ? 'error'
              : payload.status === 'succeeded'
                ? 'success'
                : payload.status === 'already-current' || payload.status === 'skipped'
                  ? 'warning'
                  : 'info';
          addLog(
            `[${payload.name}] ${payload.message || statusLabel(payload.status)}`,
            tone
          );
        })
      )
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch(() => {
        // Progress is a nicety; the final outcome still reaches the page.
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [addLog]);

  const runScan = useCallback(
    async (force: boolean, quiet = false) => {
      if (busyRef.current) return;
      setIsScanning(true);
      setScanError(null);
      if (!quiet) {
        addLog(
          force
            ? '[Scan] Forcing a fresh WinGet inventory (cache bypassed)…'
            : '[Scan] Asking WinGet for packages with an available upgrade…',
          'info'
        );
      }

      try {
        const result = await api.checkSoftwareUpdates(force);
        setScan(result);
        // Row statuses belong to the previous scan; session totals are kept.
        setRowStates({});
        logKeys.current = {};
        if (result.updates.length === 0) {
          addLog('[Scan] No installed package has a newer version on the configured sources.', 'success');
        } else {
          addLog(
            `[Scan] ${result.updates.length} update${result.updates.length === 1 ? '' : 's'} available.`,
            'success'
          );
        }
        result.warnings.forEach((warning) => addLog(`[Scan] ${warning}`, 'warning'));
      } catch (error) {
        const message = errorMessage(error);
        setScanError(message);
        addLog(`[Scan] ${message}`, 'error');
        // Keep any previous successful scan visible and clearly marked stale.
      } finally {
        setIsScanning(false);
      }
    },
    [addLog]
  );

  useEffect(() => {
    if (initialScanDone.current) return;
    initialScanDone.current = true;
    void runScan(false);
  }, [runScan]);

  const applyOutcome = useCallback((outcome: UpdateOutcome, index = 1, total = 1) => {
    setOutcomes((prev) => ({ ...prev, [outcome.id]: outcome }));
    setRowStates((prev) => ({
      ...prev,
      [outcome.id]: {
        id: outcome.id,
        name: outcome.name,
        status: outcome.status,
        message: outcome.message,
        detail: outcome.logs[outcome.logs.length - 1] ?? '',
        index,
        total,
        requires_reboot: outcome.requires_reboot,
      },
    }));
    if (outcome.requires_reboot) {
      setRebootNeeded(true);
      setRebootDismissed(false);
    }
  }, []);

  const notifyOutcome = useCallback(
    (outcome: UpdateOutcome) => {
      switch (outcome.status) {
        case 'succeeded':
          onLogNotification(
            outcome.requires_reboot ? 'Update installed — restart required' : 'Update installed',
            `${outcome.name} was updated${
              outcome.new_version ? ` to ${outcome.new_version}` : ''
            }.${outcome.requires_reboot ? ' Restart Windows to finish applying it.' : ''}`,
            outcome.requires_reboot ? 'warning' : 'success'
          );
          break;
        case 'already-current':
          onLogNotification('Already up to date', `${outcome.name} has no newer version.`, 'info');
          break;
        case 'skipped':
          onLogNotification('Update skipped', `${outcome.name}: ${outcome.message}`, 'warning');
          break;
        case 'failed':
          onLogNotification('Update failed', `${outcome.name}: ${outcome.message}`, 'error');
          break;
        default:
          break;
      }
    },
    [onLogNotification]
  );

  const logOutcome = useCallback(
    (outcome: UpdateOutcome) => {
      const tone: LogTone =
        outcome.status === 'failed'
          ? 'error'
          : outcome.status === 'succeeded'
            ? 'success'
            : outcome.status === 'already-current' || outcome.status === 'skipped'
              ? 'warning'
              : 'info';
      addLog(`[${outcome.name}] ${outcome.message}`, tone);
      if (outcome.status === 'failed') {
        outcome.logs.slice(-4).forEach((line) => addLog(`  ${line}`, 'muted'));
      }
    },
    [addLog]
  );

  const updateOne = useCallback(
    async (pkg: SoftwareUpdate, interactive = false) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusyId(pkg.id);
      setOutcomes((prev) => {
        const next = { ...prev };
        delete next[pkg.id];
        return next;
      });
      setRowStates((prev) => ({
        ...prev,
        [pkg.id]: {
          id: pkg.id,
          name: pkg.name,
          status: 'running',
          message: interactive ? 'Opening the installer window…' : 'Starting update…',
          detail: '',
          index: 1,
          total: 1,
          requires_reboot: false,
        },
      }));
      addLog(
        `[${pkg.name}] ${interactive ? 'Retrying with the installer UI' : 'Starting silent upgrade'} (${pkg.current_version} → ${pkg.available_version})…`,
        'info'
      );

      try {
        const outcome = await api.upgradeSoftware(pkg, interactive, 1, 1);
        applyOutcome(outcome);
        logOutcome(outcome);
        notifyOutcome(outcome);
        if (outcome.status === 'succeeded' || outcome.status === 'already-current') {
          onRefresh?.();
        }
      } catch (error) {
        const message = errorMessage(error);
        const failed: UpdateOutcome = {
          id: pkg.id,
          name: pkg.name,
          status: 'failed',
          message,
          new_version: '',
          logs: [],
          requires_reboot: false,
          interactive_retry: false,
        };
        applyOutcome(failed);
        addLog(`[${pkg.name}] ${message}`, 'error');
        onLogNotification('Update failed', `${pkg.name}: ${message}`, 'error');
      } finally {
        busyRef.current = false;
        setBusyId(null);
      }
    },
    [addLog, applyOutcome, logOutcome, notifyOutcome, onLogNotification, onRefresh]
  );

  const updateMany = useCallback(
    async (items: SoftwareUpdate[]) => {
      if (!items.length || busyRef.current) return;
      busyRef.current = true;
      const ids = items.map((item) => item.id);
      setBatch({
        active: true,
        ids,
        total: items.length,
        currentMessage: `Preparing ${items.length} package${items.length === 1 ? '' : 's'}…`,
      });
      setOutcomes((prev) => {
        const next = { ...prev };
        ids.forEach((id) => delete next[id]);
        return next;
      });
      setRowStates((prev) => {
        const next = { ...prev };
        items.forEach((item, index) => {
          next[item.id] = {
            id: item.id,
            name: item.name,
            status: 'queued',
            message: `Queued ${index + 1} of ${items.length}`,
            detail: '',
            index: index + 1,
            total: items.length,
            requires_reboot: false,
          };
        });
        return next;
      });
      addLog(
        `[Queue] Starting ${items.length} update${items.length === 1 ? '' : 's'} sequentially. WinGet installs one package at a time.`,
        'info'
      );

      try {
        const summary = await api.upgradeAllSoftware(items);
        summary.outcomes.forEach((outcome, index) =>
          applyOutcome(outcome, index + 1, summary.outcomes.length)
        );
        summary.outcomes.forEach(logOutcome);
        setBatch((prev) =>
          prev
            ? {
                ...prev,
                active: false,
                currentMessage: summary.reboot_required
                  ? 'Paused — restart Windows to continue.'
                  : 'Queue finished.',
              }
            : prev
        );

        addLog(
          `[Queue] Finished: ${summary.succeeded} updated, ${summary.already_current} already current, ${summary.skipped} skipped, ${summary.failed} failed.`,
          summary.failed > 0 ? 'warning' : 'success'
        );
        if (summary.reboot_required) {
          addLog('[Queue] Windows needs a restart before the remaining updates can be installed.', 'warning');
        }

        const level = summary.failed > 0 ? 'warning' : summary.reboot_required ? 'warning' : 'success';
        onLogNotification(
          summary.failed > 0 ? 'Updates finished with errors' : 'Updates installed',
          `${summary.succeeded} updated${summary.failed ? `, ${summary.failed} failed` : ''}${
            summary.reboot_required ? '. Restart Windows to finish.' : '.'
          }`,
          level
        );

        if (summary.succeeded > 0) onRefresh?.();
      } catch (error) {
        const message = errorMessage(error);
        setRowStates((prev) => {
          const next = { ...prev };
          ids.forEach((id) => {
            const current = next[id];
            if (current && !isTerminal(current.status)) {
              next[id] = {
                ...current,
                status: 'failed',
                message,
              };
            }
          });
          return next;
        });
        setBatch((prev) => (prev ? { ...prev, active: false, currentMessage: message } : prev));
        addLog(`[Queue] ${message}`, 'error');
        onLogNotification('Batch update failed', message, 'error');
      } finally {
        busyRef.current = false;
      }
    },
    [addLog, applyOutcome, logOutcome, notifyOutcome, onLogNotification, onRefresh]
  );

  const updates = scan?.updates ?? [];

  const pending = useMemo(
    () =>
      updates.filter((pkg) => {
        const status = rowStates[pkg.id]?.status;
        return !status || !['succeeded', 'already-current', 'skipped'].includes(status);
      }),
    [updates, rowStates]
  );

  const failedItems = useMemo(
    () => updates.filter((pkg) => rowStates[pkg.id]?.status === 'failed'),
    [updates, rowStates]
  );

  const session = useMemo(() => {
    const list = Object.values(outcomes);
    return {
      updated: list.filter((outcome) => outcome.status === 'succeeded').length,
      failed: list.filter((outcome) => outcome.status === 'failed').length,
      current: list.filter((outcome) => outcome.status === 'already-current').length,
    };
  }, [outcomes]);

  const counts = useMemo(() => {
    let pendingCount = 0;
    let doneCount = 0;
    let failedCount = 0;
    for (const pkg of updates) {
      const status = rowStates[pkg.id]?.status;
      if (status === 'failed') failedCount += 1;
      else if (status === 'succeeded' || status === 'already-current') doneCount += 1;
      else pendingCount += 1;
    }
    return { all: updates.length, pending: pendingCount, done: doneCount, failed: failedCount };
  }, [updates, rowStates]);

  const visibleUpdates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return updates.filter((pkg) => {
      const status = rowStates[pkg.id]?.status;
      if (filter === 'pending' && (status === 'failed' || status === 'succeeded' || status === 'already-current')) {
        return false;
      }
      if (filter === 'done' && status !== 'succeeded' && status !== 'already-current') return false;
      if (filter === 'failed' && status !== 'failed') return false;
      if (!query) return true;
      return (
        pkg.name.toLowerCase().includes(query) ||
        pkg.id.toLowerCase().includes(query) ||
        pkg.available_version.toLowerCase().includes(query)
      );
    });
  }, [updates, rowStates, filter, searchQuery]);

  const batchDone = batch
    ? batch.ids.filter((id) => isTerminal(rowStates[id]?.status)).length
    : 0;
  const batchPercent = batch && batch.total > 0 ? Math.round((batchDone / batch.total) * 100) : 0;

  const copyOutcomeLogs = useCallback(
    async (outcome: UpdateOutcome) => {
      const text = [
        `${outcome.name} (${outcome.id})`,
        `Status: ${outcome.status}`,
        `Message: ${outcome.message}`,
        '',
        ...outcome.logs,
      ].join('\n');

      let copied = false;
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        try {
          const area = document.createElement('textarea');
          area.value = text;
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          copied = document.execCommand('copy');
          document.body.removeChild(area);
        } catch {
          copied = false;
        }
      }

      if (copied) {
        setCopiedId(outcome.id);
        window.setTimeout(() => setCopiedId((current) => (current === outcome.id ? null : current)), 1600);
      } else {
        onLogNotification('Copy failed', 'The log could not be copied to the clipboard.', 'error');
      }
    },
    [onLogNotification]
  );

  const filters: Array<{ id: Filter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'pending', label: 'Needs update', count: counts.pending },
    { id: 'done', label: 'Done', count: counts.done },
    { id: 'failed', label: 'Failed', count: counts.failed },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="bg-gradient-to-r from-card via-card to-secondary/10 border border-border rounded-2xl p-6 relative overflow-hidden shadow-card">
        <div className="absolute -right-16 -top-24 w-80 h-80 rounded-full bg-secondary/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-white shadow-glow-secondary">
                <DownloadCloud className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-primary tracking-tight">Software Updater</h1>
                <p className="text-xs text-text-muted">
                  Checks installed packages against Microsoft WinGet, then installs updates one at a time.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-4 text-[11px]">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-border bg-surface/70 text-text-secondary">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    scanError ? 'bg-danger' : scan ? 'bg-success' : 'bg-text-muted'
                  }`}
                />
                Microsoft WinGet {scan?.engine_version ? `· ${scan.engine_version}` : ''}
              </span>
              {scan && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border ${
                    scan.is_admin
                      ? 'border-success/30 bg-success/10 text-success'
                      : 'border-warning/30 bg-warning/10 text-warning'
                  }`}
                  title={
                    scan.is_admin
                      ? 'The app can install machine-wide updates without a separate elevation prompt.'
                      : 'Windows will ask for administrator approval for machine-wide installers.'
                  }
                >
                  {scan.is_admin ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                  {scan.is_admin ? 'Administrator' : 'Standard user'}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-border bg-surface/70 text-text-muted">
                <Clock className="w-3 h-3" />
                Checked {formatScanTime(scan?.scanned_at)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void runScan(true)}
              disabled={isScanning || busy}
              className="flex items-center space-x-2 px-4 py-2 bg-surface hover:bg-surface-elevated border border-border text-text-secondary hover:text-text-primary rounded-xl text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Forces a fresh WinGet scan (bypasses the short cache)"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin text-secondary' : ''}`} />
              <span>{isScanning ? 'Checking…' : 'Check again'}</span>
            </button>

            <button
              onClick={() => void updateMany(pending)}
              disabled={busy || pending.length === 0 || isScanning}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-secondary to-primary hover:opacity-95 text-white rounded-xl text-xs font-semibold shadow-md shadow-secondary/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {busy ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <DownloadCloud className="w-4 h-4" />
              )}
              <span>
                {busy
                  ? `Updating… ${formatDuration(elapsed)}`
                  : `Update all (${pending.length})`}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mt-6 pt-5 border-t border-border/60">
          <StatCard
            label="Pending updates"
            value={`${pending.length} package${pending.length === 1 ? '' : 's'}`}
            hint="Packages with a newer published version"
            icon={<Package className="w-4 h-4" />}
            tone={pending.length > 0 ? 'text-secondary' : 'text-success'}
          />
          <StatCard
            label="Updated this session"
            value={session.updated}
            hint={session.current > 0 ? `${session.current} already up to date` : 'Installed through WinGet'}
            icon={<PackageCheck className="w-4 h-4" />}
            tone="text-success"
          />
          <StatCard
            label="Needs attention"
            value={session.failed}
            hint={session.failed > 0 ? 'Retry the failed rows below' : 'No failures in this session'}
            icon={<AlertCircle className="w-4 h-4" />}
            tone={session.failed > 0 ? 'text-danger' : 'text-text-primary'}
          />
          <StatCard
            label="Package source"
            value={scan?.engine_version || 'WinGet'}
            hint="Exact package IDs, official manifests"
            icon={<ShieldCheck className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Restart required */}
      {rebootNeeded && !rebootDismissed && (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-text-primary">Restart Windows to finish</p>
              <p className="text-xs text-text-muted mt-0.5">
                An update was installed but needs a restart before it is fully applied. Save your work, then
                restart from the Start menu. Syntax Uninstaller will not restart your PC on its own.
              </p>
            </div>
          </div>
          <button
            onClick={() => setRebootDismissed(true)}
            className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg border border-warning/40 text-warning text-xs font-semibold hover:bg-warning/10 transition-colors self-start sm:self-auto"
          >
            <X className="w-3.5 h-3.5" />
            <span>Restart later</span>
          </button>
        </div>
      )}

      {/* Scan error */}
      {scanError && (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 animate-fade-in">
          <div className="flex items-start space-x-3">
            <XCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-text-primary">Could not check for updates</p>
              <p className="text-xs text-text-secondary mt-0.5 break-words">{scanError}</p>
              {scan && (
                <p className="text-[11px] text-text-muted mt-1">
                  Showing the last successful scan from {formatScanTime(scan.scanned_at)}. It may be out of date.
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => void runScan(true)}
            disabled={isScanning || busy}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-danger/15 border border-danger/30 text-danger text-xs font-semibold hover:bg-danger/25 transition-colors disabled:opacity-50 self-start"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Try again</span>
          </button>
        </div>
      )}

      {/* Standard-user guidance */}
      {scan && !scan.is_admin && updates.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface/60 p-3.5 flex items-start space-x-3">
          <ShieldAlert className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-text-secondary leading-relaxed">
            <span className="font-semibold text-text-primary">Running as a standard user.</span> Per-user apps update
            silently. Machine-wide installers will ask for administrator approval through their own Windows prompt —
            approve it to continue. If a package refuses to install, restart Syntax Uninstaller as administrator and
            retry it.
          </p>
        </div>
      )}

      {/* Batch progress */}
      {batch && (batch.active || batchDone > 0) && (
        <div className="rounded-2xl border border-secondary/30 bg-secondary/5 p-4 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2 min-w-0">
              {batch.active ? (
                <RefreshCw className="w-4 h-4 text-secondary animate-spin flex-shrink-0" />
              ) : batchPercent === 100 ? (
                <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
              )}
              <span className="text-xs font-semibold text-text-primary truncate">
                {batch.active
                  ? batch.currentMessage
                  : batch.currentMessage || 'Queue finished'}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-secondary flex-shrink-0">
              {batchDone}/{batch.total}
            </span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-secondary to-primary transition-all duration-500"
              style={{ width: `${Math.max(2, batchPercent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-text-muted">
            <span>
              {batch.active
                ? `Elapsed ${formatDuration(elapsed)} · WinGet installs one package at a time`
                : `${batchPercent}% complete${rebootNeeded ? ' · restart required before continuing' : ''}`}
            </span>
            {!batch.active && batchPercent < 100 && (
              <button
                onClick={() => void updateMany(failedItems)}
                disabled={busy || failedItems.length === 0}
                className="inline-flex items-center space-x-1 text-warning hover:text-warning/80 font-semibold disabled:opacity-50"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry failed ({failedItems.length})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Failed summary with retry */}
      {!batch?.active && failedItems.length > 0 && (
        <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
            <p className="text-xs text-text-secondary">
              <span className="font-semibold text-text-primary">
                {failedItems.length} update{failedItems.length === 1 ? '' : 's'} failed.
              </span>{' '}
              Open a row for the WinGet log, then retry. If the installer needs its own window, use{' '}
              <span className="font-medium text-text-primary">Retry with installer UI</span>.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => void updateMany(failedItems)}
              disabled={busy}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-danger/15 border border-danger/30 text-danger text-xs font-semibold hover:bg-danger/25 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry failed</span>
            </button>
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                filter === item.id
                  ? 'bg-secondary/15 border-secondary/40 text-secondary'
                  : 'bg-surface border-border text-text-muted hover:text-text-primary'
              }`}
            >
              {item.label}
              <span className="ml-1.5 font-mono opacity-80">{item.count}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search software, ID or version…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-secondary transition-all"
          />
        </div>
      </div>

      {/* Updates list */}
      {isScanning && updates.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="bg-card border border-border rounded-xl p-4 flex items-center space-x-4">
              <div className="w-9 h-9 rounded-xl bg-surface animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-48 rounded bg-surface animate-pulse" />
                <div className="h-2.5 w-32 rounded bg-surface animate-pulse" />
              </div>
              <div className="h-7 w-24 rounded-lg bg-surface animate-pulse" />
            </div>
          ))}
          <p className="text-center text-[11px] text-text-muted pt-1">
            Querying WinGet manifests for installed packages…
          </p>
        </div>
      ) : visibleUpdates.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          {updates.length === 0 && scan && !scanError ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-success" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary">Everything is up to date</h3>
              <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
                WinGet found no installed package with a newer version on your configured sources. Packages pinned
                in WinGet are intentionally skipped by Windows.
              </p>
            </>
          ) : updates.length === 0 && !scan && !isScanning ? (
            <>
              <AlertCircle className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-text-primary">No scan results yet</h3>
              <p className="text-xs text-text-muted mt-1">Run a scan to check for available updates.</p>
              <button
                onClick={() => void runScan(true)}
                disabled={isScanning || busy}
                className="mt-4 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-secondary/15 border border-secondary/30 text-secondary text-xs font-semibold hover:bg-secondary/25 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check for updates</span>
              </button>
            </>
          ) : (
            <>
              <Search className="w-8 h-8 text-text-muted mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-text-primary">No matching updates</h3>
              <p className="text-xs text-text-muted mt-1">
                Try a different search term or switch back to the All filter.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {visibleUpdates.map((pkg) => {
            const state = rowStates[pkg.id];
            const outcome = outcomes[pkg.id];
            const status = state?.status;
            const isRunning = status === 'running';
            const isQueued = status === 'queued';
            const isFailed = status === 'failed';
            const isSucceeded = status === 'succeeded';
            const isAlreadyCurrent = status === 'already-current';
            const isSkipped = status === 'skipped';
            const isExpanded = expandedId === pkg.id;
            const canExpand = Boolean(outcome && outcome.logs.length > 0);

            return (
              <div key={pkg.id} className={isExpanded ? 'bg-surface/30' : ''}>
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface/30 transition-colors">
                  <div className="flex items-start space-x-3.5 min-w-0">
                    <ApplicationIcon name={pkg.name} size="md" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xs font-bold text-text-primary truncate">{pkg.name}</h3>
                        <span className="text-[10px] font-mono text-text-muted bg-surface px-1.5 py-0.5 rounded border border-border/60 truncate max-w-[260px]">
                          {pkg.id}
                        </span>
                        {pkg.source && (
                          <span className="text-[10px] text-text-muted border border-border/60 rounded px-1.5 py-0.5">
                            {pkg.source}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
                        <span className="text-text-muted font-mono">{pkg.current_version || 'Unknown'}</span>
                        <ArrowRight className="w-3 h-3 text-text-muted" />
                        <span className="text-secondary font-mono font-bold bg-secondary/10 px-1.5 py-0.5 rounded border border-secondary/20">
                          {pkg.available_version}
                        </span>
                        {status && status !== 'running' && status !== 'queued' && (
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${statusPill(
                              status,
                              Boolean(state?.requires_reboot)
                            )}`}
                          >
                            {isSucceeded && <CheckCircle2 className="w-3 h-3" />}
                            {isFailed && <XCircle className="w-3 h-3" />}
                            {isAlreadyCurrent && <CheckCircle2 className="w-3 h-3" />}
                            {statusLabel(status)}
                            {isSucceeded && state?.requires_reboot ? ' · restart needed' : ''}
                          </span>
                        )}
                        {(isRunning || isQueued) && (
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${statusPill(
                              status as UpdateStatus,
                              false
                            )}`}
                          >
                            {isRunning ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            {statusLabel(status)}
                          </span>
                        )}
                      </div>

                      {(isRunning || isQueued || isFailed || isSucceeded || isSkipped) && state?.message && (
                        <p
                          className={`text-[11px] mt-1.5 leading-relaxed ${
                            isFailed
                              ? 'text-danger'
                              : isSucceeded
                                ? 'text-success'
                                : status === 'running'
                                  ? 'text-secondary'
                                  : 'text-text-muted'
                          }`}
                        >
                          {state.message}
                          {isRunning ? ` · ${formatDuration(elapsed)}` : ''}
                        </p>
                      )}
                      {isAlreadyCurrent && (
                        <p className="text-[11px] text-text-muted mt-1.5">
                          The installed version already matches the newest published version.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:flex-shrink-0 self-end sm:self-auto">
                    {isFailed ? (
                      <>
                        <button
                          onClick={() => void updateOne(pkg)}
                          disabled={busy}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50"
                          title="Retry this update silently"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
                        {outcome?.interactive_retry && (
                          <button
                            onClick={() => void updateOne(pkg, true)}
                            disabled={busy}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-surface hover:bg-surface-elevated text-text-secondary border border-border rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50"
                            title="Run the installer with its own window so you can respond to prompts"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Installer UI</span>
                          </button>
                        )}
                      </>
                    ) : isRunning ? (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-secondary/10 text-secondary border border-secondary/30 rounded-lg text-[11px] font-semibold">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating…</span>
                      </span>
                    ) : isQueued ? (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-surface text-text-muted border border-border rounded-lg text-[11px] font-semibold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Queued</span>
                      </span>
                    ) : isSucceeded || isAlreadyCurrent || isSkipped ? (
                      <span
                        className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border ${statusPill(
                          status as UpdateStatus,
                          Boolean(state?.requires_reboot)
                        )}`}
                      >
                        {isSucceeded ? <CheckCircle2 className="w-3.5 h-3.5" /> : <PackageCheck className="w-3.5 h-3.5" />}
                        <span>{isSucceeded ? 'Done' : statusLabel(status)}</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => void updateOne(pkg)}
                        disabled={busy}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-secondary/15 hover:bg-secondary/25 text-secondary border border-secondary/30 rounded-lg text-[11px] font-semibold transition-all hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:hover:scale-100"
                      >
                        <DownloadCloud className="w-3.5 h-3.5" />
                        <span>Update</span>
                      </button>
                    )}

                    {canExpand && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : pkg.id)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
                        title={isExpanded ? 'Hide WinGet log' : 'Show WinGet log'}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && outcome && (
                  <div className="px-4 pb-4">
                    <div className="rounded-xl border border-border bg-background/60 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface/60">
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                          WinGet output · {outcome.status}
                        </span>
                        <button
                          onClick={() => void copyOutcomeLogs(outcome)}
                          className="inline-flex items-center space-x-1 text-[10px] text-text-muted hover:text-text-primary transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedId === outcome.id ? 'Copied' : 'Copy log'}</span>
                        </button>
                      </div>
                      <pre className="px-3 py-2.5 text-[10.5px] leading-relaxed font-mono text-text-secondary whitespace-pre-wrap max-h-56 overflow-y-auto select-text">
                        {outcome.logs.length > 0 ? outcome.logs.join('\n') : 'No installer output was captured.'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Execution log */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
        <div className="bg-surface/80 px-4 py-2.5 flex items-center justify-between border-b border-border">
          <button
            onClick={() => setShowConsole((value) => !value)}
            className="flex items-center space-x-2 select-none text-left"
            aria-expanded={showConsole}
          >
            <Terminal className="w-4 h-4 text-secondary" />
            <span className="text-xs font-bold text-text-primary">Updater log</span>
            <span className="text-[10px] bg-card px-2 py-0.5 rounded-full text-text-muted border border-border">
              {logs.length} events
            </span>
          </button>
          <div className="flex items-center space-x-3">
            {logs.length > 0 && (
              <button
                onClick={() => setLogs([])}
                className="text-[10px] text-text-muted hover:text-text-primary transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setShowConsole((value) => !value)}
              className="text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              {showConsole ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        {showConsole && (
          <div className="bg-surface p-4 font-mono text-[11px] max-h-56 overflow-y-auto space-y-1 select-text">
            {logs.length === 0 ? (
              <div className="text-text-muted italic">No events yet. Scans and installs are recorded here.</div>
            ) : (
              logs.map((line) => (
                <div key={line.id} className="flex items-start space-x-2 leading-relaxed">
                  <span className="text-text-muted/70 flex-shrink-0">{line.time}</span>
                  <span
                    className={
                      line.tone === 'error'
                        ? 'text-danger'
                        : line.tone === 'success'
                          ? 'text-success'
                          : line.tone === 'warning'
                            ? 'text-warning'
                            : line.tone === 'info'
                              ? 'text-text-secondary'
                              : 'text-text-muted'
                    }
                  >
                    {line.text}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-text-muted text-center leading-relaxed">
        Updates are downloaded and verified by Microsoft WinGet. Installers that need a restart are flagged here;
        Syntax Uninstaller never restarts Windows without your permission.
      </p>
    </div>
  );
};
