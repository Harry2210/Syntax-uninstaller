/**
 * Persisted user preferences and appearance handling.
 *
 * The app ships a dark and a light theme plus an optional high-contrast mode.
 * The theme is stored in localStorage and applied to <html> as a class, where
 * the CSS variables in styles/index.css swap the entire palette.
 */

export type ScanLevel = 'Safe' | 'Moderate' | 'Advanced';
export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export interface AppSettings {
  theme: ThemeMode;
  highContrast: boolean;
  defaultScanLevel: ScanLevel;
  autoRestorePoint: boolean;
  autoRegBackup: boolean;
  confirmBeforeDelete: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  highContrast: false,
  defaultScanLevel: 'Moderate',
  autoRestorePoint: true,
  autoRegBackup: true,
  confirmBeforeDelete: true,
};

const STORAGE_KEY = 'syntax_settings';
const THEME_MODES: ThemeMode[] = ['dark', 'light', 'system'];

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      // Never trust a stale/unknown value from an older build.
      theme: THEME_MODES.includes(parsed.theme as ThemeMode) ? (parsed.theme as ThemeMode) : 'dark',
      highContrast: parsed.highContrast === true,
      defaultScanLevel:
        parsed.defaultScanLevel === 'Safe' || parsed.defaultScanLevel === 'Advanced'
          ? parsed.defaultScanLevel
          : 'Moderate',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable in limited contexts; the app still works.
  }
}

/** Turns the stored preference into the theme that should actually be shown. */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    try {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }
  return mode;
}

/**
 * Applies theme + contrast to <html> and returns the resolved theme, so callers
 * can render the correct sun/moon state when "match Windows" is selected.
 */
export function applyAppearance(settings: Pick<AppSettings, 'theme' | 'highContrast'>): ResolvedTheme {
  if (typeof document === 'undefined') return 'dark';

  const resolved = resolveTheme(settings.theme);
  const root = document.documentElement;

  root.classList.toggle('light', resolved === 'light');
  root.classList.toggle('dark', resolved === 'dark');
  root.classList.toggle('high-contrast', settings.highContrast);
  root.style.colorScheme = resolved;

  return resolved;
}

/**
 * Subscribes to Windows light/dark changes. The callback is only useful while
 * the user has selected "Match Windows", but subscribing unconditionally keeps
 * the handler simple.
 */
export function watchSystemTheme(callback: () => void): () => void {
  try {
    const query = window.matchMedia('(prefers-color-scheme: light)');
    query.addEventListener('change', callback);
    return () => query.removeEventListener('change', callback);
  } catch {
    return () => {};
  }
}
