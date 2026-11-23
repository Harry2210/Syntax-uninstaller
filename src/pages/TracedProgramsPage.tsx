import React, { useState, useEffect } from 'react';
import { InstallationTrace } from '../types';
import { FileSearch, Trash2, Database, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

interface TracedProgramsPageProps {
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const TracedProgramsPage: React.FC<TracedProgramsPageProps> = ({ onLogNotification }) => {
  const [traces, setTraces] = useState<InstallationTrace[]>([]);
  const [activeTrace, setActiveTrace] = useState<InstallationTrace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReverting, setIsReverting] = useState(false);

  const loadTraces = async () => {
    setIsLoading(true);
    try {
      const list = await api.getInstallationTraces();
      setTraces(list);
      if (list.length > 0 && (!activeTrace || !list.find(t => t.id === activeTrace.id))) {
        setActiveTrace(list[0]);
      } else if (list.length === 0) {
        setActiveTrace(null);
      }
    } catch (err: any) {
      console.error('Failed to load installation traces:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTraces();
  }, []);

  const handleRevertTraced = async (trace: InstallationTrace) => {
    setIsReverting(true);
    try {
      const [count, bytes] = await api.revertInstallationTrace(trace);
      onLogNotification(
        'Installation Completely Reverted',
        `Reverted ${count} recorded files and registry keys for ${trace.app_name}, reclaiming ${(bytes / (1024 * 1024)).toFixed(1)} MB.`,
        'success'
      );
      await loadTraces();
    } catch (err: any) {
      onLogNotification('Reversion Error', String(err), 'error');
    } finally {
      setIsReverting(false);
    }
  };

  const handleDeleteTraceOnly = async (id: string, name: string) => {
    try {
      await api.deleteInstallationTrace(id);
      onLogNotification('Trace Removed', `Removed recording for ${name} from SQLite database.`, 'info');
      await loadTraces();
    } catch (err: any) {
      onLogNotification('Error', String(err), 'error');
    }
  };

  return (
    <div className="space-y-4 pb-12 animate-fade-in max-w-5xl">
      <div className="p-4 bg-card border border-border rounded-2xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/20 text-primary rounded-xl">
            <FileSearch className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Recorded Installation Traces (SQLite)</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Review and completely revert installation logs captured in real time by Syntax Installation Monitor.
            </p>
          </div>
        </div>

        <button
          onClick={loadTraces}
          className="px-3 py-1.5 bg-surface hover:bg-surface-elevated text-xs font-medium text-text-secondary rounded-lg border border-border"
        >
          Refresh Traces
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Trace List */}
        <div className="bg-card border border-border rounded-xl p-3 space-y-2">
          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider px-1">
            Recorded Traces ({traces.length})
          </h4>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-6 text-xs text-text-muted">Loading recorded traces from SQLite...</div>
            ) : traces.length === 0 ? (
              <div className="p-4 bg-surface/50 border border-border rounded-xl text-center text-xs text-text-muted">
                No recorded traces in database yet. Use the Real-Time Installation Monitor to capture setups.
              </div>
            ) : (
              traces.map((trace) => {
                const isSelected = activeTrace?.id === trace.id;
                return (
                  <div
                    key={trace.id}
                    onClick={() => setActiveTrace(trace)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors text-xs ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-text-primary'
                        : 'bg-surface/50 border-border hover:bg-surface text-text-secondary'
                    }`}
                  >
                    <p className="font-semibold truncate">{trace.app_name}</p>
                    <p className="text-[10px] text-text-muted mt-0.5 font-mono">
                      {new Date(trace.recorded_at).toLocaleDateString()} • {(trace.total_size_bytes / (1024 * 1024)).toFixed(0)} MB
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Trace Inspector */}
        {activeTrace ? (
          <div className="md:col-span-2 bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h4 className="text-sm font-bold text-text-primary">{activeTrace.app_name}</h4>
                <p className="text-xs text-text-muted mt-0.5 font-mono">
                  Captured on {new Date(activeTrace.recorded_at).toLocaleString()} • {(activeTrace.total_size_bytes / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDeleteTraceOnly(activeTrace.id, activeTrace.app_name)}
                  className="px-2.5 py-1.5 bg-surface hover:bg-surface-elevated text-text-muted hover:text-text-primary rounded-lg border border-border text-xs transition-colors"
                  title="Remove log from SQLite without deleting files"
                >
                  Delete Log
                </button>
                <button
                  disabled={isReverting}
                  onClick={() => handleRevertTraced(activeTrace)}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-danger hover:bg-rose-600 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isReverting ? 'animate-spin' : ''}`} />
                  <span>{isReverting ? 'Reverting...' : 'Completely Revert App'}</span>
                </button>
              </div>
            </div>

            {/* Registry Keys Section */}
            <div className="space-y-1.5">
              <h5 className="text-xs font-semibold text-text-primary">
                Recorded Registry Keys ({activeTrace.new_registry_keys.length})
              </h5>
              <div className="p-3 bg-surface rounded-lg border border-border max-h-40 overflow-y-auto space-y-1 text-xs font-mono text-text-secondary">
                {activeTrace.new_registry_keys.length === 0 ? (
                  <div className="text-text-muted italic">No registry keys recorded.</div>
                ) : (
                  activeTrace.new_registry_keys.map((k, i) => (
                    <div key={i} className="truncate text-emerald-400/90">• {k}</div>
                  ))
                )}
              </div>
            </div>

            {/* Files Section */}
            <div className="space-y-1.5">
              <h5 className="text-xs font-semibold text-text-primary">
                Recorded File System Modifications ({activeTrace.new_files.length})
              </h5>
              <div className="p-3 bg-surface rounded-lg border border-border max-h-40 overflow-y-auto space-y-1 text-xs font-mono text-text-secondary">
                {activeTrace.new_files.length === 0 ? (
                  <div className="text-text-muted italic">No files recorded.</div>
                ) : (
                  activeTrace.new_files.map((f, i) => (
                    <div key={i} className="truncate">• {f}</div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="md:col-span-2 bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-2">
            <Database className="w-8 h-8 text-text-muted" />
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">No Trace Selected</h4>
            <p className="text-xs text-text-muted max-w-sm">
              Select an installation trace from the list to review created files and registry entries, or revert them completely.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

