import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Copy, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import { AppUpdateManifest } from '../../services/appUpdater';

interface TitleBarProps {
  availableUpdate?: AppUpdateManifest | null;
  onOpenUpdateModal?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ availableUpdate, onOpenUpdateModal }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let isCleanedUp = false;
    let unlisten: (() => void) | undefined;

    const checkMaximized = async () => {
      try {
        const max = await api.isWindowMaximized();
        if (!isCleanedUp) setIsMaximized(max);
      } catch {}
    };

    checkMaximized();

    // Listen for resize events if Tauri window is available
    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        const fn = await win.onResized(async () => {
          if (!isCleanedUp) {
            setIsMaximized(await win.isMaximized());
          }
        });
        if (isCleanedUp) {
          fn();
        } else {
          unlisten = fn;
        }
      } catch {}
    })();

    return () => {
      isCleanedUp = true;
      if (unlisten) unlisten();
    };
  }, []);

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.windowMinimize();
    } catch (err) {
      console.error('Minimize error:', err);
    }
  };

  const handleToggleMaximize = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.windowToggleMaximize();
      const max = await api.isWindowMaximized();
      setIsMaximized(max);
    } catch (err) {
      console.error('Toggle maximize error:', err);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.windowClose();
    } catch (err) {
      console.error('Close error:', err);
    }
  };

  return (
    <header
      className="h-9 w-full bg-[#0A0E1A] border-b border-white/[0.04] flex items-center justify-between select-none z-50 flex-shrink-0"
    >
      {/* Left App Logo & Title (Draggable) */}
      <div
        data-tauri-drag-region
        className="flex items-center space-x-2.5 h-full px-3.5 cursor-default flex-shrink-0"
      >
        <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-[#6366F1] to-[#A855F7] flex items-center justify-center shadow-[0_0_10px_rgba(139,92,246,0.5)] pointer-events-none">
          <span className="font-mono font-black text-[11px] text-white">S</span>
        </div>
        <span className="text-xs font-semibold text-slate-200 tracking-wide font-sans pointer-events-none">
          Syntax Uninstaller
        </span>

        {/* Update Available Badge */}
        {availableUpdate && onOpenUpdateModal && (
          <button
            type="button"
            onClick={onOpenUpdateModal}
            className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)] hover:bg-emerald-500/30 transition-all cursor-pointer animate-pulse pointer-events-auto ml-1"
          >
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Update Available (v{availableUpdate.version})</span>
          </button>
        )}
      </div>

      {/* Middle Draggable Space */}
      <div
        data-tauri-drag-region
        className="flex-1 h-full cursor-default"
      />

      {/* Right Window Controls (Windows 11 Native Aesthetic - Strictly Non-draggable) */}
      <div className="flex items-center h-full flex-shrink-0 pointer-events-auto">
        <button
          type="button"
          onClick={handleMinimize}
          className="w-11 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer"
          title="Minimize"
          aria-label="Minimize"
        >
          <Minus className="w-3.5 h-3.5 stroke-[1.5]" />
        </button>

        <button
          type="button"
          onClick={handleToggleMaximize}
          className="w-11 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer"
          title={isMaximized ? 'Restore' : 'Maximize'}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <Copy className="w-3 h-3 stroke-[1.5] rotate-90" />
          ) : (
            <Square className="w-3.5 h-3.5 stroke-[1.5]" />
          )}
        </button>

        <button
          type="button"
          onClick={handleClose}
          className="w-12 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#E81123] active:bg-[#C90E1D] transition-colors cursor-pointer"
          title="Close"
          aria-label="Close"
        >
          <X className="w-4 h-4 stroke-[1.5]" />
        </button>
      </div>
    </header>
  );
};
