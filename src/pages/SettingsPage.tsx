import React from 'react';
import { Settings, Shield, Palette, Layers, Info, RotateCcw, Sun, Moon, Monitor, CheckCircle2 } from 'lucide-react';
import { AppSettings, DEFAULT_SETTINGS, ScanLevel, ThemeMode } from '../services/preferences';

interface SettingsPageProps {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

const THEME_OPTIONS: { id: ThemeMode; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'light', label: 'Light', hint: 'Bright interface', icon: <Sun className="w-4 h-4" /> },
  { id: 'dark', label: 'Dark', hint: 'Obsidian & neon', icon: <Moon className="w-4 h-4" /> },
  { id: 'system', label: 'Match Windows', hint: 'Follows your PC setting', icon: <Monitor className="w-4 h-4" /> },
];

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onChange, onLogNotification }) => {
  const handleReset = () => {
    onChange({ ...DEFAULT_SETTINGS });
    onLogNotification('Settings Restored', 'All preferences were reset to their default values.', 'info');
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-4xl">
      <div className="p-4 bg-card border border-border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/15 text-primary rounded-xl">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Preferences &amp; Safety Rules</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Changes are saved on this PC automatically — there is nothing to submit.
            </p>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center space-x-1.5 px-3 py-2 bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-xl text-xs font-semibold border border-border transition-colors flex-shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to defaults</span>
        </button>
      </div>

      {/* Appearance */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold text-text-primary uppercase tracking-wider">
          <Palette className="w-4 h-4 text-primary" />
          <span>Appearance</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {THEME_OPTIONS.map((option) => {
            const isActive = settings.theme === option.id;
            return (
              <button
                key={option.id}
                onClick={() => onChange({ theme: option.id })}
                aria-pressed={isActive}
                className={`flex items-center space-x-3 p-3 rounded-xl border text-left transition-all ${
                  isActive
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border bg-surface hover:border-primary/40'
                }`}
              >
                <span
                  className={`p-2 rounded-lg ${
                    isActive ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted'
                  }`}
                >
                  {option.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold text-text-primary">{option.label}</span>
                  <span className="block text-[10px] text-text-muted truncate">{option.hint}</span>
                </span>
                {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-primary ml-auto flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        <label className="flex items-center justify-between gap-3 p-3 bg-surface rounded-xl border border-border cursor-pointer hover:border-primary/40 transition-colors">
          <div>
            <p className="text-xs font-semibold text-text-primary">Increase contrast</p>
            <p className="text-[11px] text-text-muted">
              Strengthens small text and borders — helpful on bright screens or for low vision.
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.highContrast}
            onChange={(e) => onChange({ highContrast: e.target.checked })}
            className="rounded border-border text-primary focus:ring-0 w-4 h-4 flex-shrink-0"
          />
        </label>
      </div>

      {/* Safety & Backups */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold text-text-primary uppercase tracking-wider">
          <Shield className="w-4 h-4 text-secondary" />
          <span>Safety &amp; Restoration Policies</span>
        </div>

        <div className="space-y-3 pt-2 text-xs">
          <label className="flex items-center justify-between gap-3 p-3 bg-surface rounded-xl border border-border cursor-pointer hover:border-secondary/40 transition-colors">
            <div>
              <p className="font-semibold text-text-primary">Automatic System Restore Points</p>
              <p className="text-[11px] text-text-muted">
                Create a Windows System Restore Point prior to running uninstallers
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoRestorePoint}
              onChange={(e) => onChange({ autoRestorePoint: e.target.checked })}
              className="rounded border-border text-primary focus:ring-0 w-4 h-4 flex-shrink-0"
            />
          </label>

          <label className="flex items-center justify-between gap-3 p-3 bg-surface rounded-xl border border-border cursor-pointer hover:border-secondary/40 transition-colors">
            <div>
              <p className="font-semibold text-text-primary">Automatic Registry Backups</p>
              <p className="text-[11px] text-text-muted">
                Export .REG hives before purging any leftover keys or values
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoRegBackup}
              onChange={(e) => onChange({ autoRegBackup: e.target.checked })}
              className="rounded border-border text-primary focus:ring-0 w-4 h-4 flex-shrink-0"
            />
          </label>

          <label className="flex items-center justify-between gap-3 p-3 bg-surface rounded-xl border border-border cursor-pointer hover:border-secondary/40 transition-colors">
            <div>
              <p className="font-semibold text-text-primary">Require Explicit Confirmation</p>
              <p className="text-[11px] text-text-muted">
                Show warning modals before executing destructive deletions
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.confirmBeforeDelete}
              onChange={(e) => onChange({ confirmBeforeDelete: e.target.checked })}
              className="rounded border-border text-primary focus:ring-0 w-4 h-4 flex-shrink-0"
            />
          </label>
        </div>

        <div className="flex items-start space-x-2 p-3 rounded-xl border border-border bg-surface/40 text-[11px] text-text-muted">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-info" />
          <span>
            Turning off restore points or registry backups removes your safety net. Keep both on unless you have another
            backup strategy.
          </span>
        </div>
      </div>

      {/* Scanner defaults */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold text-text-primary uppercase tracking-wider">
          <Layers className="w-4 h-4 text-primary" />
          <span>Leftover Scanner Defaults</span>
        </div>

        <div className="text-xs">
          <label className="block text-text-muted mb-1 font-medium" htmlFor="scan-level">
            Default Scan Thoroughness
          </label>
          <select
            id="scan-level"
            value={settings.defaultScanLevel}
            onChange={(e) => onChange({ defaultScanLevel: e.target.value as ScanLevel })}
            className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="Safe">Safe — strict match, dedicated folders only</option>
            <option value="Moderate">Moderate — recommended, thorough vendor and cache match</option>
            <option value="Advanced">Advanced — expanded review of shared components</option>
          </select>
          <p className="text-[10px] text-text-muted mt-1.5">
            How aggressively the leftover scanner searches after an uninstall.
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 text-[11px] text-text-muted px-1">
        <Palette className="w-3.5 h-3.5" />
        <span>Preferences are saved locally on this PC. Nothing is uploaded.</span>
      </div>
    </div>
  );
};
