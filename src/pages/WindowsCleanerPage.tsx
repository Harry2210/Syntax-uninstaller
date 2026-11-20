import React, { useState } from 'react';
import { CleanCategory } from '../types';
import { api } from '../services/api';
import { Sparkles, RefreshCw, Trash2, ShieldCheck, History } from 'lucide-react';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';

interface WindowsCleanerPageProps {
  onRefresh: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const WindowsCleanerPage: React.FC<WindowsCleanerPageProps> = ({
  onRefresh,
  onLogNotification,
}) => {
  const [categories, setCategories] = useState<CleanCategory[]>([
    {
      id: 'win_recent',
      name: 'Recent Document History',
      description: 'Shortcuts and links to recently opened files in Windows Explorer',
      target_paths: ['C:\\Users\\User\\AppData\\Roaming\\Microsoft\\Windows\\Recent'],
      file_count: 140,
      total_size_bytes: 12500000,
      selected: true,
    },
    {
      id: 'win_thumbs',
      name: 'Explorer Thumbnail Cache',
      description: 'Cached picture and media thumbnails in File Explorer',
      target_paths: ['C:\\Users\\User\\AppData\\Local\\Microsoft\\Windows\\Explorer'],
      file_count: 12,
      total_size_bytes: 185000000,
      selected: false,
    },
    {
      id: 'win_run_mru',
      name: 'Explorer Run & Search MRU',
      description: 'History of commands executed via the Windows Run dialog (Win+R)',
      target_paths: [],
      file_count: 18,
      total_size_bytes: 2048,
      selected: true,
    },
  ]);

  const [isCleaning, setIsCleaning] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const toggleCategory = (id: string) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleClean = async () => {
    setShowConfirm(false);
    setIsCleaning(true);
    try {
      const allPaths = categories.filter((c) => c.selected).flatMap((c) => c.target_paths);
      const [count, bytes] = await api.cleanFiles(allPaths);
      onLogNotification(
        'Windows Traces Cleaned',
        `Successfully wiped Windows activity traces (${(bytes / (1024 * 1024)).toFixed(1)} MB cleared).`,
        'success'
      );
      setCategories((prev) =>
        prev.map((c) => (c.selected ? { ...c, file_count: 0, total_size_bytes: 0 } : c))
      );
      onRefresh();
    } finally {
      setIsCleaning(false);
    }
  };

  const selectedCount = categories.filter((c) => c.selected).length;

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-5xl">
      <div className="p-5 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-primary/20 text-primary rounded-xl">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Windows Privacy & Activity Cleaner</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Remove recent documents history, explorer jump lists, and desktop activity traces.
            </p>
          </div>
        </div>

        <button
          disabled={selectedCount === 0 || isCleaning}
          onClick={() => setShowConfirm(true)}
          className="flex items-center space-x-2 px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/20 transition-all"
        >
          <Trash2 className="w-4 h-4" />
          <span>Wipe Windows Traces</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat) => (
          <div
            key={cat.id}
            onClick={() => toggleCategory(cat.id)}
            className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start space-x-3.5 ${
              cat.selected
                ? 'bg-card border-primary/50 shadow-sm'
                : 'bg-card/50 border-border opacity-70 hover:opacity-100'
            }`}
          >
            <input
              type="checkbox"
              checked={cat.selected}
              onChange={() => {}}
              className="mt-1 rounded border-border text-primary focus:ring-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-text-primary">{cat.name}</h4>
                <span className="font-mono text-xs font-bold text-secondary">
                  {(cat.total_size_bytes / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-1">{cat.description}</p>
            </div>
          </div>
        ))}
      </div>

      <ConfirmationDialog
        isOpen={showConfirm}
        title="Confirm Windows Trace Wipe"
        message="Are you sure you want to clear your recent document history and Windows activity logs?"
        confirmText="Clear History"
        cancelText="Cancel"
        onConfirm={handleClean}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
};
