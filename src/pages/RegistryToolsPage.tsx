import React, { useState } from 'react';
import { KeyRound, Search, Download, ShieldCheck, Folder, FileCode, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';

interface RegistryToolsPageProps {
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

interface RegHivePath {
  name: string;
  hive: string;
  path: string;
  description: string;
}

export const RegistryToolsPage: React.FC<RegistryToolsPageProps> = ({ onLogNotification }) => {
  const [search, setSearch] = useState('');
  const [customKey, setCustomKey] = useState('');

  const knownPaths: RegHivePath[] = [
    {
      name: 'Uninstall Entries (64-bit)',
      hive: 'HKLM',
      path: 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      description: 'System-wide 64-bit application registration database',
    },
    {
      name: 'Uninstall Entries (32-bit WOW64)',
      hive: 'HKLM',
      path: 'SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      description: '32-bit legacy application registration database',
    },
    {
      name: 'Per-User Applications',
      hive: 'HKCU',
      path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      description: 'Applications installed exclusively for the current user profile',
    },
    {
      name: 'Startup Run Keys',
      hive: 'HKCU',
      path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Run',
      description: 'Programs executed on interactive user logon',
    },
    {
      name: 'Application Binary Paths',
      hive: 'HKLM',
      path: 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths',
      description: 'Registered executable aliases for Windows Run dialog and shell execution',
    },
  ];

  const handleExport = async (item: RegHivePath) => {
    try {
      const fullPath = `${item.hive}\\${item.path}`;
      const record = await api.backupRegistryKey(fullPath, item.name);
      onLogNotification(
        'Registry Hive Exported',
        `Successfully exported ${item.name} to ${record.file_path}`,
        'success'
      );
    } catch (e: any) {
      onLogNotification('Export Failed', String(e), 'error');
    }
  };

  const handleExportCustom = async () => {
    if (!customKey.trim()) return;
    try {
      const record = await api.backupRegistryKey(customKey.trim(), 'CustomKey');
      onLogNotification('Key Exported', `Exported ${customKey} to backup directory.`, 'success');
      setCustomKey('');
    } catch (e: any) {
      onLogNotification('Export Failed', String(e), 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-5xl">
      <div className="p-5 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-primary/20 text-primary rounded-xl">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Windows Registry Utilities</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Inspect application registration hives, export .REG backups, and diagnose orphaned keys safely.
            </p>
          </div>
        </div>
      </div>

      {/* Custom Key Export Bar */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
          Export Custom Registry Subkey
        </h4>
        <div className="flex gap-3">
          <input
            type="text"
            value={customKey}
            onChange={(e) => setCustomKey(e.target.value)}
            placeholder="e.g. HKEY_CURRENT_USER\Software\VendorName"
            className="flex-1 bg-surface border border-border rounded-xl px-4 py-2 text-xs text-text-primary focus:outline-none focus:border-primary font-mono"
          />
          <button
            onClick={handleExportCustom}
            disabled={!customKey.trim()}
            className="flex items-center space-x-1.5 px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-primary/20"
          >
            <Download className="w-4 h-4" />
            <span>Export .REG</span>
          </button>
        </div>
      </div>

      {/* Catalog of Key Locations */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {knownPaths.map((item) => (
          <div
            key={item.name}
            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface/50 transition-colors text-xs"
          >
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-text-primary">{item.name}</span>
                <StatusBadge status={item.hive} variant="info" />
              </div>
              <p className="font-mono text-[11px] text-text-muted truncate max-w-xl">
                {item.hive}\{item.path}
              </p>
              <p className="text-[11px] text-text-secondary">{item.description}</p>
            </div>

            <button
              onClick={() => handleExport(item)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-surface hover:bg-surface-elevated border border-border rounded-xl text-xs font-semibold text-text-primary self-end sm:self-center transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              <span>Export Key</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
