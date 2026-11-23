import React from 'react';
import { motion } from 'framer-motion';

/**
 * 3D-styled Friendly Robot Cleaner with Sweeping Broom and Floating Sparkles
 * Directly matching the hero illustration in the design reference.
 */
export const RobotCleanerIllustration: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative w-44 h-40 flex items-center justify-center select-none ${className}`}>
      {/* Soft background glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 via-purple-500/15 to-transparent rounded-full blur-2xl pointer-events-none" />

      {/* Floating Sparkles & Crystals */}
      <motion.div
        animate={{ y: [-4, 4, -4], opacity: [0.7, 1, 0.7], rotate: [0, 8, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-2 left-6 pointer-events-none"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" fill="#C4B5FD" />
        </svg>
      </motion.div>

      <motion.div
        animate={{ y: [4, -5, 4], opacity: [0.6, 1, 0.6], scale: [0.9, 1.1, 0.9] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        className="absolute top-6 left-16 pointer-events-none"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" fill="#38BDF8" />
        </svg>
      </motion.div>

      <motion.div
        animate={{ y: [-3, 5, -3], rotate: [0, -12, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute top-8 right-10 pointer-events-none"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" fill="#818CF8" />
        </svg>
      </motion.div>

      {/* Floating Swept Geometric Crystals on the floor */}
      <motion.div
        animate={{ y: [-2, 2, -2], rotate: [-10, 10, -10] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-2 left-10 pointer-events-none"
      >
        <div className="w-3.5 h-3.5 bg-gradient-to-tr from-purple-500 to-indigo-300 rounded-sm transform rotate-45 shadow-sm shadow-purple-500/50" />
      </motion.div>

      <motion.div
        animate={{ y: [2, -2, 2], scale: [0.9, 1.05, 0.9] }}
        transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
        className="absolute bottom-3 left-18 pointer-events-none"
      >
        <div className="w-2.5 h-2.5 bg-gradient-to-tr from-cyan-400 to-teal-200 rounded-sm transform -rotate-12 shadow-sm shadow-cyan-400/50" />
      </motion.div>

      <motion.div
        animate={{ y: [-1, 3, -1], rotate: [20, 0, 20] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }}
        className="absolute bottom-2 right-12 pointer-events-none"
      >
        <div className="w-3 h-3 bg-gradient-to-tr from-violet-400 to-fuchsia-300 rounded-sm transform rotate-12 shadow-sm shadow-violet-500/50" />
      </motion.div>

      {/* Main Floating Robot & Broom Assembly */}
      <motion.div
        animate={{ y: [-5, 5, -5] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        className="relative z-10 flex items-center"
      >
        {/* Robot Body */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          {/* Shadow underneath */}
          <div className="absolute -bottom-2 w-20 h-4 bg-black/40 rounded-full blur-md" />

          {/* Antenna */}
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8] animate-pulse" />
            <div className="w-1 h-3 bg-slate-300" />
          </div>

          {/* Main Rounded Vacuum Chassis */}
          <div className="w-22 h-20 rounded-full bg-gradient-to-b from-slate-100 via-slate-200 to-slate-400 p-1 shadow-xl shadow-cyan-950/40 relative border border-white/60">
            {/* Top Gloss highlight */}
            <div className="absolute top-1 inset-x-3 h-4 bg-gradient-to-b from-white/80 to-transparent rounded-full" />

            {/* Inner Dark Visor Face */}
            <div className="w-full h-full rounded-full bg-gradient-to-b from-[#0F172A] to-[#1E293B] flex items-center justify-center relative overflow-hidden shadow-inner border border-slate-700/60">
              {/* Friendly Glowing Blue Eyes */}
              <div className="flex items-center space-x-3">
                <div className="w-3.5 h-4 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-white" />
                </div>
                <div className="w-3.5 h-4 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-white" />
                </div>
              </div>

              {/* Cute smiling mouth */}
              <div className="absolute bottom-2.5 w-3 h-1.5 border-b-2 border-cyan-300/80 rounded-full" />

              {/* Visor reflection sweep */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-400/10 to-transparent" />
            </div>

            {/* Cyan Accent Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-cyan-400/40 pointer-events-none" />
          </div>
        </div>

        {/* Sweeping Broom */}
        <motion.div
          animate={{ rotate: [-6, 6, -6], x: [-1, 2, -1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="relative -ml-2 -mt-4 origin-bottom-right"
        >
          {/* Wooden Broom Handle */}
          <div className="w-2.5 h-20 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 rounded-full shadow-md transform rotate-[28deg] origin-bottom relative">
            <div className="absolute inset-y-0 left-0.5 w-0.5 bg-amber-200/40 rounded-full" />
          </div>

          {/* Broom Head / Straw Bristles */}
          <div className="absolute bottom-0 -right-2 w-10 h-10 flex flex-col items-center">
            {/* Metal Ferrule Band */}
            <div className="w-5 h-2.5 bg-gradient-to-r from-slate-400 via-slate-200 to-slate-500 rounded-sm shadow-sm" />
            {/* Straw Fan */}
            <div className="w-9 h-7 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 rounded-b-xl shadow-md border-t border-amber-600 relative overflow-hidden flex justify-around">
              <div className="w-0.5 h-full bg-amber-700/40" />
              <div className="w-0.5 h-full bg-amber-700/40" />
              <div className="w-0.5 h-full bg-amber-700/40" />
              <div className="w-0.5 h-full bg-amber-700/40" />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

/**
 * 3D Isometric Layered Application Plates with Floating Purple Sparkles
 * For the "Uninstall Programs" featured card.
 */
export const IsometricLayersIllustration: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <motion.div
      animate={{ y: [-3, 3, -3] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      className={`relative w-28 h-24 flex items-center justify-center select-none ${className}`}
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-purple-600/20 rounded-full blur-xl pointer-events-none" />

      {/* Floating Sparkles */}
      <motion.div
        animate={{ y: [-2, 2, -2], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1 right-2 pointer-events-none"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" fill="#C084FC" />
        </svg>
      </motion.div>

      <motion.div
        animate={{ y: [2, -2, 2], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        className="absolute bottom-2 left-1 pointer-events-none"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" fill="#E879F9" />
        </svg>
      </motion.div>

      {/* Isometric 3D Plates Stack */}
      <div className="relative w-20 h-16 transform -rotate-12 skew-y-6">
        {/* Bottom Plate */}
        <div className="absolute bottom-0 inset-x-0 h-9 rounded-xl bg-gradient-to-tr from-[#4C1D95] to-[#7C3AED] shadow-lg border border-purple-400/30 transform translate-y-3 opacity-70" />

        {/* Middle Plate */}
        <div className="absolute bottom-0 inset-x-0 h-9 rounded-xl bg-gradient-to-tr from-[#6D28D9] to-[#8B5CF6] shadow-md border border-purple-400/40 transform translate-y-1.5 opacity-85" />

        {/* Top Plate */}
        <div className="absolute bottom-0 inset-x-0 h-9 rounded-xl bg-gradient-to-tr from-[#8B5CF6] via-[#A855F7] to-[#C084FC] shadow-xl border border-white/50 flex items-center justify-center p-1">
          {/* Top Plate Inner Glass Highlight */}
          <div className="w-full h-full rounded-lg bg-gradient-to-br from-white/30 via-transparent to-transparent flex items-center justify-center">
            <div className="w-5 h-5 rounded-md bg-white/20 border border-white/40 flex items-center justify-center shadow-inner">
              <div className="w-2 h-2 rounded-sm bg-white" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * 3D Cyan Junk Basket overflowing with Colorful Candy / Marshmallow Junk Spheres
 * For the "Clean Junk Files" featured card.
 */
export const CandyJunkBucketIllustration: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <motion.div
      animate={{ y: [-3, 3, -3] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      className={`relative w-28 h-24 flex items-center justify-center select-none ${className}`}
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl pointer-events-none" />

      {/* Overflowing Candy Junk Balls */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Top Candies cluster */}
        <div className="relative -mb-3 z-20 flex items-center space-x-1">
          {/* Pink Candy */}
          <motion.div
            animate={{ scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-5 h-5 rounded-full bg-gradient-to-tr from-pink-500 to-rose-300 shadow-md shadow-pink-500/40 border border-white/40"
          />
          {/* Cyan Candy */}
          <motion.div
            animate={{ scale: [1.05, 0.95, 1.05] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-400 to-teal-200 shadow-md shadow-cyan-400/40 border border-white/50 -ml-1"
          />
          {/* Purple Pill */}
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-300 shadow-md shadow-purple-500/40 border border-white/40 -ml-1" />
        </div>

        {/* 3D Cyan Bin Body */}
        <div className="w-14 h-14 rounded-b-2xl rounded-t-lg bg-gradient-to-b from-[#06B6D4] via-[#0891B2] to-[#155E75] p-1 shadow-xl shadow-cyan-950/50 border border-cyan-300/60 relative overflow-hidden flex justify-around">
          {/* Vertical Rib lines */}
          <div className="w-1 h-full bg-white/20 rounded-full" />
          <div className="w-1 h-full bg-white/20 rounded-full" />
          <div className="w-1 h-full bg-white/20 rounded-full" />

          {/* Gloss highlight */}
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-b from-white/50 to-transparent" />
        </div>
      </div>
    </motion.div>
  );
};

/**
 * 3D Golden CPU Processor with Blasting Rocket
 * For the "Speed Up Windows Boot" featured card.
 */
export const RocketCpuIllustration: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <motion.div
      animate={{ y: [-3, 3, -3] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      className={`relative w-28 h-24 flex items-center justify-center select-none ${className}`}
    >
      {/* Amber/Gold background glow */}
      <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl pointer-events-none" />

      {/* Golden CPU Base Die */}
      <div className="relative w-16 h-16 rounded-xl bg-gradient-to-tr from-[#D97706] via-[#F59E0B] to-[#FDE68A] p-1 shadow-xl shadow-amber-950/40 border border-amber-300/70 transform rotate-6">
        {/* Silicon core inner plate */}
        <div className="w-full h-full rounded-lg bg-gradient-to-tr from-[#78350F] to-[#92400E] border border-amber-500/40 flex items-center justify-center relative overflow-hidden">
          {/* Circuit traces */}
          <div className="absolute inset-x-2 top-2 h-0.5 bg-amber-400/40" />
          <div className="absolute inset-x-2 bottom-2 h-0.5 bg-amber-400/40" />
          <div className="absolute inset-y-2 left-2 w-0.5 bg-amber-400/40" />
          <div className="absolute inset-y-2 right-2 w-0.5 bg-amber-400/40" />
        </div>

        {/* Outer Gold Pins */}
        <div className="absolute -top-1 inset-x-2 flex justify-between">
          <div className="w-1 h-1 bg-amber-200 rounded-sm" />
          <div className="w-1 h-1 bg-amber-200 rounded-sm" />
          <div className="w-1 h-1 bg-amber-200 rounded-sm" />
        </div>
        <div className="absolute -bottom-1 inset-x-2 flex justify-between">
          <div className="w-1 h-1 bg-amber-200 rounded-sm" />
          <div className="w-1 h-1 bg-amber-200 rounded-sm" />
          <div className="w-1 h-1 bg-amber-200 rounded-sm" />
        </div>
      </div>

      {/* Blasting Space Rocket */}
      <motion.div
        animate={{ y: [-4, 2, -4], x: [2, -2, 2] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-1 -right-1 z-20 flex flex-col items-center transform rotate-12"
      >
        {/* Rocket Body */}
        <div className="w-7 h-11 bg-gradient-to-b from-white via-slate-100 to-slate-200 rounded-t-full rounded-b-md shadow-lg border border-slate-300 relative flex flex-col items-center">
          {/* Red Rocket Nose Cone */}
          <div className="w-3.5 h-3.5 rounded-t-full bg-rose-500" />

          {/* Cyan Cabin Window */}
          <div className="w-3 h-3 rounded-full bg-cyan-400 border border-slate-400 shadow-inner mt-0.5 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-white" />
          </div>

          {/* Rocket Fins */}
          <div className="absolute -left-2 bottom-1 w-2.5 h-3 bg-rose-500 rounded-l-md transform -skew-y-12" />
          <div className="absolute -right-2 bottom-1 w-2.5 h-3 bg-rose-500 rounded-r-md transform skew-y-12" />
        </div>

        {/* Rocket Thruster Flames */}
        <motion.div
          animate={{ scaleY: [0.85, 1.3, 0.85], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 0.4, repeat: Infinity, ease: 'easeInOut' }}
          className="w-4 h-6 bg-gradient-to-b from-yellow-300 via-orange-500 to-transparent rounded-b-full shadow-[0_0_12px_#f59e0b] -mt-1 origin-top"
        />
      </motion.div>
    </motion.div>
  );
};
