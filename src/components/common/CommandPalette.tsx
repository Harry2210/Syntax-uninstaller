import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PageId } from '../../types';
import { PAGE_META } from '../../data/pages';
import { HUB_CONFIG, PAGE_TO_HUB, HubId } from '../layout/HubTabBar';
import { Search, CornerDownLeft, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: PageId) => void;
}

interface Entry {
  id: PageId;
  title: string;
  subtitle: string;
  group: string;
}

const GENERAL_PAGES: PageId[] = ['dashboard', 'notifications', 'settings', 'about'];

function buildEntries(): Entry[] {
  const entries: Entry[] = [];

  entries.push({
    id: 'dashboard',
    title: PAGE_META.dashboard.title,
    subtitle: PAGE_META.dashboard.subtitle,
    group: 'Overview & Help',
  });

  (Object.keys(HUB_CONFIG) as HubId[]).forEach((hubId) => {
    const meta = HUB_CONFIG[hubId];
    meta.tabs.forEach((tab) => {
      entries.push({
        id: tab.id,
        title: PAGE_META[tab.id].title,
        subtitle: PAGE_META[tab.id].subtitle,
        group: meta.title.replace(' Workspace', '').replace(' Center', ''),
      });
    });
  });

  GENERAL_PAGES.filter((p) => p !== 'dashboard').forEach((id) => {
    entries.push({
      id,
      title: PAGE_META[id].title,
      subtitle: PAGE_META[id].subtitle,
      group: 'Overview & Help',
    });
  });

  // De-duplicate (a page can appear in both a hub and the general list).
  const seen = new Set<PageId>();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

const ALL_ENTRIES = buildEntries();

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_ENTRIES;

    const scored = ALL_ENTRIES.map((entry) => {
      const title = entry.title.toLowerCase();
      const subtitle = entry.subtitle.toLowerCase();
      const keywords = (PAGE_META[entry.id].keywords || []).join(' ').toLowerCase();

      let score = 0;
      if (title.startsWith(q)) score += 100;
      if (title.includes(q)) score += 50;
      if (keywords.includes(q)) score += 25;
      if (subtitle.includes(q)) score += 10;
      return { entry, score };
    })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.map((item) => item.entry);
  }, [query]);

  const { visibleGroups, orderedEntries } = useMemo(() => {
    const groups: { title: string; items: { entry: Entry; visualIndex: number }[] }[] = [];
    results.forEach((entry) => {
      let group = groups.find((g) => g.title === entry.group);
      if (!group) {
        group = { title: entry.group, items: [] };
        groups.push(group);
      }
      group.items.push({ entry, visualIndex: 0 });
    });

    const ordered: Entry[] = [];
    let count = 0;
    groups.forEach((g) => {
      g.items.forEach((item) => {
        item.visualIndex = count++;
        ordered.push(item.entry);
      });
    });

    return { visibleGroups: groups, orderedEntries: ordered };
  }, [results]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      // Allow the dialog to mount before focusing.
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) => (orderedEntries.length === 0 ? 0 : (prev + 1) % orderedEntries.length));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) => (orderedEntries.length === 0 ? 0 : (prev - 1 + orderedEntries.length) % orderedEntries.length));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const target = orderedEntries[activeIndex];
        if (target) {
          onNavigate(target.id);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, orderedEntries, activeIndex, onNavigate, onClose]);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh] px-4 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Search tools and pages"
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl rounded-2xl border border-border bg-sidebar shadow-2xl overflow-hidden"
          >
            <div className="flex items-center space-x-3 px-4 py-3 border-b border-border">
              <Search className="w-4 h-4 text-text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tools… try 'uninstall', 'junk', 'startup'"
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="px-1.5 py-0.5 rounded border border-border text-[10px] font-mono text-text-muted">
                ESC
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
              {results.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-xs font-semibold text-text-secondary">No matching tool</p>
                  <p className="text-[11px] text-text-muted mt-1">
                    Try a task instead: “uninstall”, “disk space”, “speed up”, “privacy”.
                  </p>
                </div>
              ) : (
                visibleGroups.map((group) => (
                  <div key={group.title} className="mb-1">
                    <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted/70">
                      {group.title}
                    </p>
                    {group.items.map(({ entry, visualIndex }) => {
                      const isActive = visualIndex === activeIndex;
                      return (
                        <button
                          key={entry.id}
                          data-active={isActive}
                          onMouseEnter={() => setActiveIndex(visualIndex)}
                          onClick={() => {
                            onNavigate(entry.id);
                            onClose();
                          }}
                          className={`w-full text-left px-4 py-2 flex items-center justify-between transition-colors ${
                            isActive ? 'bg-primary/15' : 'hover:bg-surface/60'
                          }`}
                        >
                          <div className="min-w-0">
                            <p
                              className={`text-xs font-semibold truncate ${
                                isActive ? 'text-primary' : 'text-text-primary'
                              }`}
                            >
                              {entry.title}
                            </p>
                            <p className="text-[10px] text-text-muted truncate">{entry.subtitle}</p>
                          </div>
                          {isActive && <CornerDownLeft className="w-3.5 h-3.5 text-primary flex-shrink-0 ml-3" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-surface/30 text-[10px] text-text-muted">
              <div className="flex items-center space-x-3">
                <span className="flex items-center space-x-1">
                  <ArrowUp className="w-3 h-3" />
                  <ArrowDown className="w-3 h-3" />
                  <span>navigate</span>
                </span>
                <span className="flex items-center space-x-1">
                  <CornerDownLeft className="w-3 h-3" />
                  <span>open</span>
                </span>
              </div>
              <span className="flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Syntax Uninstaller</span>
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
