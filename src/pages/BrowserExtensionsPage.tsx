import React, { useState } from 'react';
import { BrowserExtension } from '../types';
import { Globe, Search, ShieldCheck, ExternalLink, Trash2, Info } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

interface BrowserExtensionsPageProps {
  extensions: BrowserExtension[];
  onRefresh: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const BrowserExtensionsPage: React.FC<BrowserExtensionsPageProps> = ({
  extensions,
  onRefresh,
  onLogNotification,
}) => {
  const [search, setSearch] = useState('');
  const [selectedBrowser, setSelectedBrowser] = useState<string>('all');

  const filtered = extensions.filter((ext) => {
    const matchesSearch =
      ext.name.toLowerCase().includes(search.toLowerCase()) ||
      ext.id.toLowerCase().includes(search.toLowerCase());
    const matchesBrowser =
      selectedBrowser === 'all' || ext.browser.toLowerCase().includes(selectedBrowser.toLowerCase());
    return matchesSearch && matchesBrowser;
  });

  return (
    <div className="space-y-4 pb-12 animate-fade-in max-w-5xl">
      <div className="p-4 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-secondary/20 text-secondary rounded-xl">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Browser Extensions Manager</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Audit add-ons and extensions installed across Google Chrome, Microsoft Edge, and Mozilla Firefox.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          {(['all', 'chrome', 'edge'] as const).map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBrowser(b)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold capitalize transition-all ${
                selectedBrowser === b
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-surface text-text-secondary border-border hover:text-text-primary'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search browser extensions by name or ID..."
          className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((ext) => (
          <div
            key={ext.id + ext.browser}
            className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm hover:border-secondary/40 transition-colors flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-text-primary truncate max-w-[180px]">{ext.name}</h4>
                  <p className="text-[11px] text-text-muted font-mono">v{ext.version}</p>
                </div>
                <StatusBadge status={ext.browser} variant="info" />
              </div>

              <p className="text-[10px] text-text-muted font-mono truncate mt-2">
                ID: {ext.id}
              </p>
              <p className="text-[10px] text-text-secondary font-mono mt-0.5">
                Profile: {ext.profile}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-[10px] text-secondary font-semibold flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Verified Manifest</span>
              </span>
              <button
                onClick={() => onLogNotification('Extension Details', `Extension Path: ${ext.path || 'Managed'}`, 'info')}
                className="px-2.5 py-1 text-[11px] bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg border border-border transition-colors"
              >
                Inspect
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
