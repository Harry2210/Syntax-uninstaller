import React, { useState } from 'react';
import { InstallationTrace } from '../types';
import { FileSearch, Download, Trash2, ArrowRight, Eye, ShieldCheck, Database } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

interface TracedProgramsPageProps {
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const TracedProgramsPage: React.FC<TracedProgramsPageProps> = ({ onLogNotification }) => {
  const [traces, setTraces] = useState<InstallationTrace[]>([
    {
      id: 'trace-1',
      app_name: 'Visual Studio Code 1.96',
      recorded_at: '2026-01-14T10:30:00Z',
      new_registry_keys: [
        'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{VSCode}',
        'HKCU\\Software\\Classes\\*\\shell\\VSCode',
        'HKCU\\Software\\Microsoft\\VSCode',
      ],
      new_files: [
        'C:\\Program Files\\Microsoft VS Code\\Code.exe',
        'C:\\Program Files\\Microsoft VS Code\\resources.pak',
        'C:\\Users\\User\\AppData\\Roaming\\Code\\User\\settings.json',
      ],
      total_size_bytes: 382450000,
    },
    {
      id: 'trace-2',
      app_name: 'Discord Desktop Client',
      recorded_at: '2026-01-28T14:15:00Z',
      new_registry_keys: [
        'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\Discord',
        'HKCU\\Software\\Discord',
      ],
      new_files: [
        'C:\\Users\\User\\AppData\\Local\\Discord\\Update.exe',
        'C:\\Users\\User\\AppData\\Local\\Discord\\app-1.0.9175\\Discord.exe',
        'C:\\Users\\User\\AppData\\Roaming\\discord\\settings.json',
      ],
      total_size_bytes: 218900000,
    },
  ]);

  const [activeTrace, setActiveTrace] = useState<InstallationTrace | null>(traces[0]);

  const handleUninstallTraced = (trace: InstallationTrace) => {
    onLogNotification(
      'Trace Reversal Initiated',
      `Reverting ${trace.new_registry_keys.length} recorded keys and ${trace.new_files.length} recorded files for ${trace.app_name}.`,
      'success'
    );
  };

  return (
    <div className="space-y-4 pb-12 animate-fade-in max-w-5xl">
      <div className="p-4 bg-card border border-border rounded-2xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/20 text-primary rounded-xl">
            <FileSearch className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Recorded Installation Traces</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Review and completely revert installation logs captured by Syntax Installation Monitor.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Trace List */}
        <div className="bg-card border border-border rounded-xl p-3 space-y-2">
          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider px-1">
            Recorded Traces ({traces.length})
          </h4>
          <div className="space-y-1.5">
            {traces.map((trace) => {
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
            })}
          </div>
        </div>

        {/* Trace Inspector */}
        {activeTrace && (
          <div className="md:col-span-2 bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h4 className="text-sm font-bold text-text-primary">{activeTrace.app_name}</h4>
                <p className="text-xs text-text-muted mt-0.5 font-mono">
                  Captured on {new Date(activeTrace.recorded_at).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => handleUninstallTraced(activeTrace)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-danger hover:bg-rose-600 text-white font-bold rounded-lg text-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Revert Changes</span>
              </button>
            </div>

            {/* Registry Keys Section */}
            <div className="space-y-1.5">
              <h5 className="text-xs font-semibold text-text-primary">
                Recorded Registry Keys ({activeTrace.new_registry_keys.length})
              </h5>
              <div className="p-3 bg-surface rounded-lg border border-border max-h-36 overflow-y-auto space-y-1 text-xs font-mono text-text-secondary">
                {activeTrace.new_registry_keys.map((k, i) => (
                  <div key={i} className="truncate">• {k}</div>
                ))}
              </div>
            </div>

            {/* Files Section */}
            <div className="space-y-1.5">
              <h5 className="text-xs font-semibold text-text-primary">
                Recorded File System Modifications ({activeTrace.new_files.length})
              </h5>
              <div className="p-3 bg-surface rounded-lg border border-border max-h-36 overflow-y-auto space-y-1 text-xs font-mono text-text-secondary">
                {activeTrace.new_files.map((f, i) => (
                  <div key={i} className="truncate">• {f}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
