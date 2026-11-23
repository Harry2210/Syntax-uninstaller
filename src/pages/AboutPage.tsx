import React from 'react';

export const AboutPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] py-12 animate-fade-in max-w-xl mx-auto">
      <div className="bg-card/70 border border-border/70 rounded-3xl p-10 text-center space-y-5 relative overflow-hidden shadow-2xl backdrop-blur-md w-full">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-32 bg-primary/15 blur-3xl pointer-events-none rounded-full" />

        <img
          src="/logo.svg"
          alt="Syntax Uninstaller logo"
          className="w-24 h-24 mx-auto relative z-10 rounded-2xl shadow-xl shadow-primary/20"
        />

        <div className="space-y-2 relative z-10">
          <div className="flex items-center justify-center space-x-2.5">
            <h2 className="text-2xl font-black text-white tracking-tight">
              Syntax Uninstaller
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-md bg-[#252047] text-[#9D8CFC] border border-[#3E3474] font-mono font-medium">
              v1.1.0
            </span>
          </div>

          <p className="text-xs sm:text-sm font-extrabold text-[#19E4B9] uppercase tracking-wider font-sans">
            "UNINSTALL CLEAN. MAINTAIN SMART. STAY IN CONTROL."
          </p>
        </div>
      </div>
    </div>
  );
};
