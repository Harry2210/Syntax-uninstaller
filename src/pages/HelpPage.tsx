import React, { useState } from 'react';
import { motion, Variants } from 'framer-motion';
import { PageId } from '../types';
import {
  Sparkles,
  Layers,
  Trash2,
  Zap,
  ShieldCheck,
  Keyboard,
  BookOpen,
  PlayCircle,
  Search,
  ChevronDown,
  ArrowRight,
  DownloadCloud,
  ShieldAlert,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
} from 'lucide-react';

interface HelpPageProps {
  onNavigate: (page: PageId) => void;
  onReplayTour: () => void;
  onOpenPalette: () => void;
}

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

const STEPS = [
  {
    icon: Layers,
    title: 'Uninstall a program',
    body: 'Open Uninstall Apps, find the program, click Uninstall. Syntax runs the official uninstaller, then scans for leftover files and registry keys.',
    page: 'all-programs' as PageId,
    cta: 'Open Uninstall Apps',
  },
  {
    icon: Trash2,
    title: 'Free up disk space',
    body: 'Open Clean Junk Files, review what was found, and click Clean. Only temporary caches are touched — never your documents.',
    page: 'junk-cleaner' as PageId,
    cta: 'Open Junk Cleaner',
  },
  {
    icon: Zap,
    title: 'Make Windows start faster',
    body: 'Open Speed Up PC to see every program that launches at login. Turn off the ones you do not need. Nothing is deleted — you can re-enable them.',
    page: 'startup-manager' as PageId,
    cta: 'Open Startup Manager',
  },
];

const GLOSSARY = [
  {
    term: 'Leftover',
    definition:
      'Files, folders or registry keys an uninstaller forgot to delete. They waste space and can slow Windows down.',
  },
  {
    term: 'Registry',
    definition:
      'A large configuration database inside Windows. Programs store their settings there. Deleting the wrong key can break software, which is why Syntax takes a backup first.',
  },
  {
    term: 'Startup item',
    definition:
      'A program Windows launches automatically when you sign in. Too many of them make booting slow.',
  },
  {
    term: 'Service',
    definition:
      'A background program that runs without a window (for example Windows Update). Some can be stopped safely; system-critical ones should not be touched.',
  },
  {
    term: 'Restore point',
    definition:
      'A saved snapshot of your system settings that Windows can roll back to. Syntax creates one before risky operations.',
  },
  {
    term: 'Secure delete (shredding)',
    definition:
      'Overwriting a file several times before deleting it so recovery tools cannot bring it back. Irreversible.',
  },
];

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], action: 'Search every tool' },
  { keys: ['↑', '↓'], action: 'Move through search results' },
  { keys: ['Enter'], action: 'Open the selected tool' },
  { keys: ['Esc'], action: 'Close search or dialog' },
  { keys: ['Ctrl', 'R'], action: 'Refresh system data' },
];

const FAQ = [
  {
    q: 'Is it safe to delete everything the scanner finds?',
    a: 'Items marked “Safe” are safe for almost everyone. “Moderate” items may belong to another program that shares a folder, and “Advanced” items should only be removed if you understand what they are. Review before deleting.',
  },
  {
    q: 'What happens if I remove something I needed?',
    a: 'Syntax exports a .REG backup and creates a restore point before destructive actions. You can restore either one from Backup & Recovery Manager.',
  },
  {
    q: 'Why do some actions ask for administrator rights?',
    a: 'Removing machine-wide software, editing HKLM registry keys or controlling Windows services requires elevation. If you see “Standard” in the header, restart the app with “Run as administrator”.',
  },
  {
    q: 'Where do I find a tool that is not in the sidebar?',
    a: 'The six items under “Everyday care” cover the common jobs. Everything else lives on the “All tools” page — it lists every tool by group and has its own search box. You can also press Ctrl+K and type what you want to do.',
  },
  {
    q: 'Does the app send my data anywhere?',
    a: 'No. All scanning happens locally on this PC. Nothing is uploaded, and the database is stored on your own disk.',
  },
];

const TROUBLESHOOTING = [
  {
    problem: 'A list is empty or says “scanning failed”',
    fix: 'Click the refresh icon in the top bar. If it stays empty, some data sources (PowerShell, winget) may be disabled on this PC.',
  },
  {
    problem: 'A program will not uninstall',
    fix: 'Try Quick Silent Uninstall, then Forced Uninstall. Forced mode targets programs whose official uninstaller is missing or broken.',
  },
  {
    problem: '“File is in use” when deleting',
    fix: 'Open Process Unlocker from All tools › Tools & Recovery to find the process holding the file, or schedule the file for deletion on the next restart.',
  },
  {
    problem: 'The unread badge keeps showing a number',
    fix: 'Open Notification Center — visiting it marks everything as read.',
  },
];

export const HelpPage: React.FC<HelpPageProps> = ({ onNavigate, onReplayTour, onOpenPalette }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-12 max-w-4xl"
    >
      {/* Hero */}
      <motion.div
        variants={item}
        className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-secondary/10 p-6"
      >
        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-primary">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Beginner's guide</span>
            </div>
            <h2 className="text-lg font-bold text-text-primary tracking-tight">
              Everything here is safe to explore.
            </h2>
            <p className="text-xs text-text-secondary max-w-lg leading-relaxed">
              Nothing is deleted until you confirm it, and every risky action can be undone. Start with the three
              routines below — they cover most PC maintenance.
            </p>
          </div>

          <div className="flex sm:flex-col gap-2 flex-shrink-0">
            <button
              onClick={onReplayTour}
              className="flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-[11px] font-bold shadow-glow-primary transition-all hover:scale-[1.03] active:scale-95"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Replay welcome tour</span>
            </button>
            <button
              onClick={onOpenPalette}
              className="flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-surface hover:bg-surface-elevated border border-border text-[11px] font-semibold text-text-secondary hover:text-text-primary transition-all"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search tools (Ctrl+K)</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Quick start */}
      <motion.section variants={item} className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Start here — three everyday routines</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="card-surface card-surface-hover p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-text-muted">STEP {index + 1}</span>
                  </div>
                  <h4 className="text-xs font-bold text-text-primary">{step.title}</h4>
                  <p className="text-[11px] text-text-secondary leading-relaxed">{step.body}</p>
                </div>
                <button
                  onClick={() => onNavigate(step.page)}
                  className="flex items-center justify-between w-full pt-2 border-t border-border/60 text-[11px] font-semibold text-primary hover:text-primary-hover group"
                >
                  <span>{step.cta}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Where to find things */}
      <motion.section variants={item} className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center space-x-1.5">
          <Search className="w-3.5 h-3.5 text-info" />
          <span>Where to find things</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-surface p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <h4 className="text-xs font-bold text-text-primary">Everyday care</h4>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              The six buttons at the top of the sidebar: Smart Care, Uninstall Apps, Clean Junk, Speed Up PC, Update
              Software and Privacy Shield. Most maintenance is done here.
            </p>
          </div>

          <div className="card-surface p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <h4 className="text-xs font-bold text-text-primary">All tools</h4>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              One page lists everything else — batch uninstall, Hunter Mode, services, registry tools, backups — grouped
              by task, with a search box at the top.
            </p>
          </div>

          <div className="card-surface p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-info" />
              <h4 className="text-xs font-bold text-text-primary">Search</h4>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              Press <span className="font-mono text-text-primary">Ctrl + K</span> and describe the task. Results show
              a one-line explanation, so you never have to guess what a tool does.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Safety promises */}
      <motion.section variants={item} className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] p-5 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>What Syntax will never do</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            'Delete Windows system folders (System32, WinSxS, …)',
            'Touch drive roots like C:\\ or D:\\',
            'Run anything without a typed, allow-listed command',
            'Upload your data to a server',
            'Remove software before making a restore point',
            'Skip confirmation on destructive actions',
          ].map((line) => (
            <div key={line} className="flex items-start space-x-2 text-[11px] text-text-secondary">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>{line}</span>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Glossary */}
      <motion.section variants={item} className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center space-x-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
          <span>Plain-English glossary</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GLOSSARY.map((entry) => (
            <div key={entry.term} className="card-surface p-3.5">
              <p className="text-[11px] font-bold text-text-primary">{entry.term}</p>
              <p className="text-[11px] text-text-muted leading-relaxed mt-1">{entry.definition}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Shortcuts */}
      <motion.section variants={item} className="card-surface p-5 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center space-x-1.5">
          <Keyboard className="w-3.5 h-3.5 text-info" />
          <span>Keyboard shortcuts</span>
        </h3>
        <div className="space-y-1.5">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.action}
              className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0"
            >
              <span className="text-[11px] text-text-secondary">{shortcut.action}</span>
              <div className="flex items-center space-x-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="px-1.5 py-0.5 rounded border border-border bg-background/60 text-[10px] font-mono text-text-primary"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* FAQ */}
      <motion.section variants={item} className="card-surface overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Frequently asked questions</h3>
        </div>
        <div className="divide-y divide-border">
          {FAQ.map((entry, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={entry.q}>
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface/40 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="text-[11px] font-semibold text-text-primary pr-3">{entry.q}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-text-muted flex-shrink-0 transition-transform ${
                      isOpen ? 'rotate-180 text-primary' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="px-4 pb-3 -mt-1 text-[11px] text-text-secondary leading-relaxed animate-fade-in">
                    {entry.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Troubleshooting */}
      <motion.section variants={item} className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center space-x-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-warning" />
          <span>Something not working?</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TROUBLESHOOTING.map((entry) => (
            <div key={entry.problem} className="card-surface p-3.5 space-y-1">
              <p className="text-[11px] font-bold text-text-primary">{entry.problem}</p>
              <p className="text-[11px] text-text-muted leading-relaxed">{entry.fix}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Footer shortcuts to key pages */}
      <motion.section variants={item} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { page: 'backup-manager' as PageId, label: 'Backup & Recovery', icon: ShieldCheck },
          { page: 'software-updater' as PageId, label: 'Update Software', icon: DownloadCloud },
          { page: 'privacy-debloater' as PageId, label: 'Privacy Shield', icon: ShieldAlert },
          { page: 'system-info' as PageId, label: 'Hardware Specs', icon: BookOpen },
        ].map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.page}
              onClick={() => onNavigate(link.page)}
              className="flex flex-col items-center justify-center space-y-1.5 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-surface/60 transition-all group"
            >
              <Icon className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" />
              <span className="text-[10px] font-semibold text-text-secondary group-hover:text-text-primary text-center">
                {link.label}
              </span>
            </button>
          );
        })}
      </motion.section>
    </motion.div>
  );
};
