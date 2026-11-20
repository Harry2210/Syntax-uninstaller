import React from 'react';
import { ShieldCheck, Code2, Cpu, Database, CheckCircle2, Heart } from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-4xl">
      <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-28 bg-primary/10 blur-3xl pointer-events-none rounded-full" />

        <img
          src="/logo.svg"
          alt="Syntax Uninstaller logo"
          className="w-20 h-20 mx-auto relative z-10 rounded-2xl shadow-lg shadow-primary/25"
        />

        <div className="space-y-1 relative z-10">
          <h2 className="text-xl font-bold text-text-primary tracking-wide">
            Syntax Uninstaller <span className="text-xs px-2 py-0.5 rounded bg-primary/15 text-primary font-mono ml-1">v1.1.0</span>
          </h2>
          <p className="text-xs font-semibold text-secondary uppercase tracking-widest">
            "Uninstall Clean. Maintain Smart. Stay in Control."
          </p>
        </div>

        <p className="text-xs text-text-secondary max-w-lg mx-auto leading-relaxed">
          Syntax Uninstaller is a next-generation Windows software-management and uninstallation suite engineered with a native Rust backend and an intuitive modern interface. Designed to thoroughly eradicate application leftovers, registry clutter, and maintain system stability.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-4 bg-card border border-border rounded-2xl space-y-2">
          <div className="flex items-center space-x-2 text-primary font-bold">
            <Cpu className="w-4 h-4" />
            <span>Core Engine</span>
          </div>
          <p className="text-text-muted leading-relaxed">
            Rust-powered Windows API and Registry integration providing memory safety, transactional file checks, and secure IPC.
          </p>
        </div>

        <div className="p-4 bg-card border border-border rounded-2xl space-y-2">
          <div className="flex items-center space-x-2 text-secondary font-bold">
            <Database className="w-4 h-4" />
            <span>SQLite Knowledge Store</span>
          </div>
          <p className="text-text-muted leading-relaxed">
            Local embedded SQLite database tracking installation snapshots, community uninstaller flags, and audit histories.
          </p>
        </div>

        <div className="p-4 bg-card border border-border rounded-2xl space-y-2">
          <div className="flex items-center space-x-2 text-info font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>Safety-First Design</span>
          </div>
          <p className="text-text-muted leading-relaxed">
            Automatic System Restore Points, .REG exports prior to deletion, and strict protections preventing accidental system file corruption.
          </p>
        </div>
      </div>
    </div>
  );
};
