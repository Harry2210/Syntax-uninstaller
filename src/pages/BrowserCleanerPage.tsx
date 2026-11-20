import React, { useState } from 'react';
import { CleanCategory } from '../types';
import { api } from '../services/api';
import { Compass, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';

interface BrowserCleanerPageProps {
  onRefresh: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const BrowserCleanerPage: React.FC<BrowserCleanerPageProps> = ({
  onRefresh,
  onLogNotification,
}) => {
  const [categories, setCategories] = useState<CleanCategory[]>([
    {
      id: 'chrome_cache',
      name: 'Google Chrome Web Cache',
      description: 'Cached webpage assets, images, and temporary scripts',
      target_paths: [],
      file_count: 1420,
      total_size_bytes: 650000000,
      selected: true,
    },
    {
      id: 'edge_cache',
      name: 'Microsoft Edge Web Cache',
      description: 'Edge browser cached data and script resources',
      target_paths: [],
      file_count: 890,
      total_size_bytes: 320000000,
      selected: true,
    },
    {
      id: 'browser_cookies',
      name: 'Browser Cookies & Web Storage',
      description: 'Saved login sessions and tracker cookies (May require logging into websites again)',
      target_paths: [],
      file_count: 450,
      total_size_bytes: 14000000,
      selected: false,
    },
    {
      id: 'download_history',
      name: 'Download List History',
      description: 'Record of downloaded files (Does not delete downloaded files)',
      target_paths: [],
      file_count: 75,
      total_size_bytes: 1024000,
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
        'Browser Data Cleaned',
        `Cleaned browser cache and history, freeing ${(bytes / (1024 * 1024)).toFixed(1)} MB.`,
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

  const totalBytes = categories
    .filter((c) => c.selected)
    .reduce((acc, c) => acc + c.total_size_bytes, 0);

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-5xl">
      <div className="p-5 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-secondary/15 text-secondary rounded-2xl">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Web Browser Data Cleaner</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Reclaim gigabytes of space by sweeping cached web pages and browsing traces across all installed browsers.
            </p>
          </div>
        </div>

        <button
          disabled={totalBytes === 0 || isCleaning}
          onClick={() => setShowConfirm(true)}
          className="flex items-center space-x-2 px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/20 transition-all"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clean Browsers ({(totalBytes / (1024 * 1024)).toFixed(0)} MB)</span>
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
        title="Confirm Browser Data Clean"
        message="Are you sure you want to clean selected browser caches? If cookies were selected, you may need to sign into some websites again."
        confirmText="Clean Selected"
        cancelText="Cancel"
        onConfirm={handleClean}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
};
