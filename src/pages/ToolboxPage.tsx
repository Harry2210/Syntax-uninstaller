import React, { useMemo, useState } from 'react';
import { motion, Variants } from 'framer-motion';
import { PageId } from '../types';
import { PAGE_META } from '../data/pages';
import { HUB_CONFIG, HubId } from '../components/layout/HubTabBar';
import { Search, ArrowRight, Sparkles } from 'lucide-react';

interface ToolboxPageProps {
  onNavigate: (page: PageId) => void;
}

/** Tools people reach for every day — shown first, everything else follows. */
const EVERYDAY: PageId[] = [
  'dashboard',
  'all-programs',
  'junk-cleaner',
  'startup-manager',
  'software-updater',
  'privacy-debloater',
];

const HUB_ACCENT: Record<HubId, { tile: string; icon: string }> = {
  uninstaller: { tile: 'bg-violet-500/15 border-violet-500/30', icon: 'text-violet-500' },
  cleanup: { tile: 'bg-teal-500/15 border-teal-500/30', icon: 'text-teal-500' },
  management: { tile: 'bg-amber-500/15 border-amber-500/30', icon: 'text-amber-500' },
  tools: { tile: 'bg-sky-500/15 border-sky-500/30', icon: 'text-sky-500' },
};

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.02 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0 },
};

export const ToolboxPage: React.FC<ToolboxPageProps> = ({ onNavigate }) => {
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();

    const matches = (id: PageId) => {
      if (!query) return true;
      const meta = PAGE_META[id];
      return (
        meta.title.toLowerCase().includes(query) ||
        meta.subtitle.toLowerCase().includes(query) ||
        meta.keywords.some((keyword) => keyword.includes(query))
      );
    };

    return (Object.keys(HUB_CONFIG) as HubId[])
      .map((hubId) => ({
        hubId,
        title: HUB_CONFIG[hubId].title,
        // Everyday tools are already listed above — do not repeat them.
        tabs: HUB_CONFIG[hubId].tabs.filter((tab) => !EVERYDAY.includes(tab.id) && matches(tab.id)),
      }))
      .filter((group) => group.tabs.length > 0);
  }, [search]);

  const everydayMatches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return EVERYDAY;
    return EVERYDAY.filter((id) => {
      const meta = PAGE_META[id];
      return (
        meta.title.toLowerCase().includes(query) ||
        meta.subtitle.toLowerCase().includes(query) ||
        meta.keywords.some((keyword) => keyword.includes(query))
      );
    });
  }, [search]);

  const totalResults = everydayMatches.length + groups.reduce((sum, g) => sum + g.tabs.length, 0);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 pb-12 max-w-5xl">
      {/* Search header */}
      <motion.div
        variants={item}
        className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-5"
      >
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              <span>All tools</span>
            </div>
            <h2 className="text-base font-bold text-text-primary">Everything the app can do</h2>
            <p className="text-xs text-text-secondary max-w-md">
              {totalResults} tools, grouped by task. The six everyday ones are always in the sidebar.
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tools…"
              className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>
      </motion.div>

      {/* Everyday */}
      {everydayMatches.length > 0 && (
        <motion.section variants={item} className="space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 px-1">Everyday care</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {everydayMatches.map((id) => (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className="card-surface card-surface-hover p-3.5 flex items-center justify-between text-left group"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-text-primary truncate">{PAGE_META[id].title}</span>
                  <span className="block text-[10px] text-text-muted truncate">{PAGE_META[id].subtitle}</span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-2" />
              </button>
            ))}
          </div>
        </motion.section>
      )}

      {/* Hub groups */}
      {groups.map((group) => {
        const accent = HUB_ACCENT[group.hubId];
        return (
          <motion.section key={group.hubId} variants={item} className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-1">{group.title}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onNavigate(tab.id)}
                    className="card-surface card-surface-hover p-3.5 flex items-start space-x-3 text-left group"
                  >
                    <span className={`p-2 rounded-xl border flex-shrink-0 ${accent.tile}`}>
                      <Icon className={`w-4 h-4 ${accent.icon}`} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-text-primary truncate">
                        {PAGE_META[tab.id].title}
                      </span>
                      <span className="block text-[10px] text-text-muted leading-snug line-clamp-2">
                        {PAGE_META[tab.id].subtitle}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.section>
        );
      })}

      {totalResults === 0 && (
        <div className="card-surface p-10 text-center space-y-1">
          <p className="text-sm font-bold text-text-primary">No tool matches “{search}”</p>
          <p className="text-xs text-text-muted">
            Try a task instead: “uninstall”, “startup”, “privacy”, “backup”.
          </p>
        </div>
      )}

      <p className="text-[11px] text-text-muted px-1">
        Tip: press <span className="font-mono text-text-primary">Ctrl + K</span> anywhere to jump to a tool.
      </p>
    </motion.div>
  );
};
