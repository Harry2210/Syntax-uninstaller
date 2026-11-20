import React from 'react';

/**
 * Suspense fallback for lazily-loaded pages.
 * Rendered instantly while a page chunk is fetched, so switching tabs never
 * shows a blank screen (which previously happened because every page was
 * bundled together and the whole app waited on one big script).
 */
export const PageSkeleton: React.FC = () => (
  <div className="space-y-4 pb-12 animate-fade-in" aria-busy="true" aria-live="polite">
    <div className="flex items-center space-x-3">
      <div className="skeleton w-10 h-10 rounded-xl" />
      <div className="space-y-2">
        <div className="skeleton h-3.5 w-52" />
        <div className="skeleton h-2.5 w-72" />
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border bg-card p-4 space-y-3"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="skeleton h-8 w-8 rounded-lg" />
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-2 w-16" />
        </div>
      ))}
    </div>

    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="skeleton h-3 w-40" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <div className="skeleton w-9 h-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-2.5 w-1/3" />
            <div className="skeleton h-2 w-1/5" />
          </div>
          <div className="skeleton h-7 w-20 rounded-lg" />
        </div>
      ))}
    </div>

    <span className="sr-only">Loading page…</span>
  </div>
);
