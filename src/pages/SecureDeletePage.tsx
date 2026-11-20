import React, { useState } from 'react';
import { Flame, FileText, Folder, Trash2, Plus, AlertTriangle, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';

interface SecureDeletePageProps {
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export const SecureDeletePage: React.FC<SecureDeletePageProps> = ({ onLogNotification }) => {
  const [fileList, setFileList] = useState<string[]>([
    'C:\\Users\\User\\AppData\\Local\\Temp\\confidential_export.csv',
    'C:\\Users\\User\\AppData\\Local\\Temp\\session_token_cache.tmp',
  ]);
  const [inputPath, setInputPath] = useState('');
  const [passes, setPasses] = useState<number>(3);
  const [isShredding, setIsShredding] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const addPath = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPath.trim()) return;
    setFileList((prev) => [...prev, inputPath.trim()]);
    setInputPath('');
  };

  const removePath = (idx: number) => {
    setFileList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleShred = async () => {
    setShowConfirm(false);
    setIsShredding(true);
    try {
      const [count, bytes] = await api.secureShredFiles(fileList, passes);
      onLogNotification(
        'Files Permanently Shredded',
        `Securely destroyed ${count} files with ${passes}-pass overwrite pattern (${(bytes / 1024).toFixed(0)} KB overwritten).`,
        'success'
      );
      setFileList([]);
    } catch (e: any) {
      onLogNotification('Shredding Error', String(e), 'error');
    } finally {
      setIsShredding(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-5xl">
      <div className="p-5 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-danger/15 text-danger rounded-2xl">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Secure File Shredder</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Permanently overwrite sensitive files with multi-pass random data before filesystem unlinking.
            </p>
          </div>
        </div>

        <button
          disabled={fileList.length === 0 || isShredding}
          onClick={() => setShowConfirm(true)}
          className="flex items-center space-x-2 px-5 py-2.5 bg-danger hover:bg-rose-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-lg transition-all"
        >
          <Flame className="w-4 h-4 fill-current" />
          <span>Shred {fileList.length} Files</span>
        </button>
      </div>

      <form onSubmit={addPath} className="flex gap-3">
        <input
          type="text"
          value={inputPath}
          onChange={(e) => setInputPath(e.target.value)}
          placeholder="Paste full file path to queue for shredding..."
          className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary font-mono"
        />
        <button
          type="submit"
          className="flex items-center space-x-1.5 px-4 py-2.5 bg-surface hover:bg-surface-elevated text-xs font-semibold text-text-primary rounded-xl border border-border transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Target</span>
        </button>
      </form>

      {/* Target Queue */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Files Queued for Shredding ({fileList.length})
          </h4>
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-text-muted">Overwrite Passes:</span>
            <select
              value={passes}
              onChange={(e) => setPasses(Number(e.target.value))}
              className="bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-primary"
            >
              <option value={1}>1-Pass (Zero Fill)</option>
              <option value={3}>3-Pass (DoD 5220.22-M)</option>
              <option value={7}>7-Pass (Gutmann subset)</option>
            </select>
          </div>
        </div>

        {fileList.length === 0 ? (
          <div className="text-center py-8 text-xs text-text-muted">
            No files queued for shredding. Add file paths using the input above.
          </div>
        ) : (
          <div className="space-y-2">
            {fileList.map((path, idx) => (
              <div
                key={idx}
                className="p-3 bg-surface border border-border rounded-xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-text-muted flex-shrink-0" />
                  <span className="font-mono text-text-primary truncate">{path}</span>
                </div>
                <button
                  onClick={() => removePath(idx)}
                  className="text-text-muted hover:text-danger p-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmationDialog
        isOpen={showConfirm}
        title="Confirm Irreversible File Shredding"
        message={`You are about to permanently destroy ${fileList.length} files using a ${passes}-pass overwrite sequence. These files cannot be recovered by forensic software or undelete tools.`}
        details={fileList}
        confirmText="Irreversibly Shred Files"
        cancelText="Cancel"
        isDangerous={true}
        requireCheckbox={true}
        onConfirm={handleShred}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
};
