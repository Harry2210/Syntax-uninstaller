import React, { useState, useEffect } from 'react';
import { CleanCategory } from '../types';
import { api } from '../services/api';
import { FileSpreadsheet, Trash2, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';

interface OfficeCleanerPageProps {
  onRefresh: () => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const OfficeCleanerPage: React.FC<OfficeCleanerPageProps> = ({
  onRefresh,
  onLogNotification,
}) => {
  const [categories, setCategories] = useState<CleanCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadTraces = async () => {
    setIsLoading(true);
    try {
      const items = await api.scanOfficeTraces();
      if (items && items.length > 0) {
        setCategories(items.map((i) => ({ ...i, selected: true })));
      }
    } catch (err) {
      console.error('Failed to scan office traces:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTraces();
  }, []);

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
        'Office Caches Cleaned',
        `Cleaned Microsoft Office temporary files and synchronization caches.`,
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
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Microsoft Office Cache Cleaner</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Purge bloated document cache databases and recent shortcuts without touching your actual documents or templates.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadTraces}
            disabled={isLoading || isCleaning}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-background border border-border hover:bg-card text-text-primary rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
            title="Rescan Office traces"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Scan</span>
          </button>
          <button
            disabled={selectedCount === 0 || isCleaning || isLoading}
            onClick={() => setShowConfirm(true)}
            className="flex items-center space-x-2 px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/20 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clean Office Cache</span>
          </button>
        </div>
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
        title="Confirm Office Cache Cleanup"
        message="Are you sure you want to clean Microsoft Office temporary sync caches? Your actual files and documents will remain untouched."
        confirmText="Clean Cache"
        cancelText="Cancel"
        onConfirm={handleClean}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
};
