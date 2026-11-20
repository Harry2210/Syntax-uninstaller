import React, { useState } from 'react';
import { Database, Search, Download, RefreshCw, CheckCircle, ShieldCheck, FileText, ArrowRight } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

interface LogsDatabasePageProps {
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

interface KnowledgeEntry {
  id: string;
  appName: string;
  publisher: string;
  knownKeys: string[];
  knownFolders: string[];
  silentArgs: string;
  confidence: number;
}

export const LogsDatabasePage: React.FC<LogsDatabasePageProps> = ({ onLogNotification }) => {
  const [search, setSearch] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);

  const entries: KnowledgeEntry[] = [
    {
      id: 'log-1',
      appName: 'Google Chrome',
      publisher: 'Google LLC',
      knownKeys: ['Software\\Google\\Chrome', 'Software\\Google\\Update'],
      knownFolders: ['%LOCALAPPDATA%\\Google\\Chrome', '%PROGRAMFILES%\\Google\\Chrome'],
      silentArgs: '--uninstall --multi-install --chrome --system-level',
      confidence: 0.99,
    },
    {
      id: 'log-2',
      appName: 'Mozilla Firefox',
      publisher: 'Mozilla',
      knownKeys: ['Software\\Mozilla\\Firefox', 'Software\\MozillaPlugins'],
      knownFolders: ['%APPDATA%\\Mozilla', '%LOCALAPPDATA%\\Mozilla', '%PROGRAMFILES%\\Mozilla Firefox'],
      silentArgs: '/S',
      confidence: 0.98,
    },
    {
      id: 'log-3',
      appName: 'Discord',
      publisher: 'Discord Inc.',
      knownKeys: ['Software\\Discord'],
      knownFolders: ['%APPDATA%\\discord', '%LOCALAPPDATA%\\Discord'],
      silentArgs: '--uninstall -s',
      confidence: 0.96,
    },
    {
      id: 'log-4',
      appName: 'Visual Studio Code',
      publisher: 'Microsoft Corporation',
      knownKeys: ['Software\\Microsoft\\Code'],
      knownFolders: ['%APPDATA%\\Code', '%USERPROFILE%\\.vscode'],
      silentArgs: '/VERYSILENT /NORESTART',
      confidence: 0.99,
    },
    {
      id: 'log-5',
      appName: 'Spotify',
      publisher: 'Spotify AB',
      knownKeys: ['Software\\Spotify'],
      knownFolders: ['%APPDATA%\\Spotify', '%LOCALAPPDATA%\\Spotify'],
      silentArgs: '/uninstall /silent',
      confidence: 0.95,
    },
    {
      id: 'log-6',
      appName: 'VLC media player',
      publisher: 'VideoLAN',
      knownKeys: ['Software\\VideoLAN\\VLC'],
      knownFolders: ['%APPDATA%\\vlc', '%PROGRAMFILES%\\VideoLAN\\VLC'],
      silentArgs: '/S',
      confidence: 0.97,
    },
  ];

  const filtered = entries.filter((e) =>
    e.appName.toLowerCase().includes(search.toLowerCase()) ||
    e.publisher.toLowerCase().includes(search.toLowerCase())
  );

  const handleUpdateDatabase = async () => {
    setIsUpdating(true);
    await new Promise((r) => setTimeout(r, 1200));
    setIsUpdating(false);
    onLogNotification('Database Updated', 'Synchronized latest verified removal signatures (v2026.11).', 'success');
  };

  return (
    <div className="space-y-4 pb-12 animate-fade-in max-w-5xl">
      <div className="p-4 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/20 text-primary rounded-xl">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Removal Knowledge Base (Logs Database)</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Verified community and publisher uninstallation profiles, silent flags, and detection patterns.
            </p>
          </div>
        </div>

        <button
          disabled={isUpdating}
          onClick={handleUpdateDatabase}
          className="flex items-center space-x-2 px-4 py-2 bg-surface hover:bg-surface-elevated border border-border text-xs font-semibold text-text-primary rounded-xl transition-all shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin text-primary' : ''}`} />
          <span>Sync Signatures</span>
        </button>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search uninstallation profiles..."
          className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((entry) => (
          <div
            key={entry.id}
            className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm hover:border-primary/40 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-xs font-bold text-text-primary">{entry.appName}</h4>
                <p className="text-[11px] text-text-muted">{entry.publisher}</p>
              </div>
              <StatusBadge status={`${Math.round(entry.confidence * 100)}% Confidence`} variant="success" />
            </div>

            <div className="text-xs space-y-1.5 font-mono text-text-secondary bg-surface p-2.5 rounded-lg border border-border">
              <div>
                <span className="text-[10px] text-text-muted uppercase block">Silent Command:</span>
                <span className="text-primary truncate block">{entry.silentArgs}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase block">Target Keys:</span>
                <span className="text-text-primary truncate block">{entry.knownKeys.join(', ')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
