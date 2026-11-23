import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Download, ExternalLink, Calendar, CheckCircle2, AlertCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { AppUpdateManifest, CURRENT_APP_VERSION } from '../../services/appUpdater';
import { api } from '../../services/api';

interface AppUpdateModalProps {
  isOpen: boolean;
  manifest: AppUpdateManifest | null;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({ isOpen, manifest }) => {
  if (!isOpen || !manifest) return null;

  const [isUpdating, setIsUpdating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Connecting to update server...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUpdate = async () => {
    if (!manifest.download_url) {
      setErrorMessage('No download URL provided in update manifest.');
      return;
    }

    setIsUpdating(true);
    setErrorMessage(null);
    setProgressPercent(15);
    setStatusMessage('Connecting to update server...');

    try {
      // Listen for download & installation progress from Rust backend
      try {
        const { listen } = await import('@tauri-apps/api/event');
        await listen<{ percent: number; status: string }>(
          'app-update-progress',
          (event) => {
            if (event.payload?.percent) setProgressPercent(event.payload.percent);
            if (event.payload?.status) setStatusMessage(event.payload.status);
          }
        );
      } catch {}

      await api.downloadAndInstallUpdate(manifest.download_url);
    } catch (err: any) {
      setIsUpdating(false);
      setErrorMessage(err?.message || String(err));
    }
  };

  const changelogItems = Array.isArray(manifest.changelog)
    ? manifest.changelog
    : typeof manifest.changelog === 'string'
    ? manifest.changelog.split('\n').filter((l) => l.trim().length > 0)
    : [];

  return (
    <AnimatePresence>
      {/* Non-dismissible backdrop ensuring mandatory update */}
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg bg-[#0F1424] border border-emerald-500/30 rounded-3xl p-7 shadow-2xl relative overflow-hidden"
        >
          {/* Ambient Glow */}
          <div className="absolute top-0 right-1/4 w-80 h-36 bg-emerald-500/20 blur-3xl pointer-events-none rounded-full" />

          {/* Header */}
          <div className="flex items-start space-x-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-xl shadow-emerald-500/30 flex-shrink-0">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-black text-white tracking-wide">
                  Mandatory Update Required
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  v{manifest.version}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                A critical new version of Syntax Uninstaller is ready. Please update now to continue using the application.
              </p>
            </div>
          </div>

          {/* Version comparison row */}
          <div className="my-5 p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-between text-xs relative z-10">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Installed</span>
              <p className="font-mono font-bold text-slate-400 mt-0.5">v{CURRENT_APP_VERSION}</p>
            </div>
            <div className="text-slate-600 font-mono text-sm">➔</div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Required</span>
              <p className="font-mono font-bold text-emerald-300 mt-0.5">v{manifest.version}</p>
            </div>
            {manifest.release_date && (
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center space-x-1 justify-end">
                  <Calendar className="w-3 h-3" />
                  <span>Release Date</span>
                </span>
                <p className="text-slate-300 mt-0.5 font-medium">{manifest.release_date}</p>
              </div>
            )}
          </div>

          {/* Changelog section */}
          {changelogItems.length > 0 && !isUpdating && (
            <div className="space-y-2 relative z-10">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Release Highlights in v{manifest.version}
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-1.5 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] text-xs">
                {changelogItems.map((item, idx) => (
                  <div key={idx} className="flex items-start space-x-2 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="leading-snug">{item.replace(/^[-*•]\s*/, '')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress / Updating State */}
          {isUpdating && (
            <div className="my-4 p-5 rounded-2xl bg-white/[0.03] border border-emerald-500/20 space-y-3 relative z-10">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-200 flex items-center space-x-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>{statusMessage}</span>
                </span>
                <span className="font-mono text-emerald-400">{progressPercent}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="my-3 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 flex items-start space-x-2 relative z-10">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Update Notice: </span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end relative z-10">
            <button
              type="button"
              onClick={handleUpdate}
              disabled={isUpdating}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white font-extrabold text-sm rounded-xl shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Download className={`w-4 h-4 ${isUpdating ? 'animate-bounce' : ''}`} />
              <span>{isUpdating ? 'Installing Update...' : 'Download & Install Update'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
