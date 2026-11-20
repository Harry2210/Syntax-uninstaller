import React from 'react';

interface CpuIllustrationProps {
  className?: string;
  size?: number;
}

export const CpuIllustration: React.FC<CpuIllustrationProps> = ({
  className = '',
  size = 52,
}) => {
  return (
    <div
      className={`relative flex items-center justify-center flex-shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Ambient Pulsing Aura */}
      <div className="absolute inset-1 rounded-xl bg-gradient-to-tr from-primary/30 to-secondary/30 blur-md animate-chip-aura pointer-events-none" />

      {/* Isometric 3D Silicon Processor Package */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
      >
        {/* Outer Green/Dark Substrate PCB Base (Isometric Diamond) */}
        <path
          d="M50 12 L88 34 L88 66 L50 88 L12 66 L12 34 Z"
          fill="#0D1626"
          stroke="#22C7A9"
          strokeWidth="1.2"
          strokeOpacity="0.4"
        />

        {/* Outer Gold Surface Pins / Contact Pads along top & right edges */}
        <g stroke="#F5B942" strokeWidth="1.5" strokeLinecap="round" opacity="0.8">
          <line x1="28" y1="21" x2="31" y2="23" />
          <line x1="36" y1="18" x2="39" y2="20" />
          <line x1="44" y1="15" x2="47" y2="17" />
          <line x1="53" y1="15" x2="56" y2="17" />
          <line x1="61" y1="18" x2="64" y2="20" />
          <line x1="69" y1="21" x2="72" y2="23" />

          {/* Right side contact pads */}
          <line x1="83" y1="40" x2="80" y2="42" />
          <line x1="83" y1="48" x2="80" y2="50" />
          <line x1="83" y1="56" x2="80" y2="58" />

          {/* Left side contact pads */}
          <line x1="17" y1="40" x2="20" y2="42" />
          <line x1="17" y1="48" x2="20" y2="50" />
          <line x1="17" y1="56" x2="20" y2="58" />
        </g>

        {/* Integrated Heat Spreader (IHS) - Metallic Silver-Gunmetal Plate */}
        <path
          d="M50 24 L76 39 L76 61 L50 76 L24 61 L24 39 Z"
          fill="url(#ihsGradient)"
          stroke="#475569"
          strokeWidth="1"
        />

        {/* IHS Top Chamfer Bevel Highlight */}
        <path
          d="M50 25 L75 39.5 L73 41 L50 27 L27 41 L25 39.5 Z"
          fill="white"
          fillOpacity="0.25"
        />

        {/* Central Die Core / Laser Inscribed Silicon Area */}
        <path
          d="M50 36 L64 44 L64 56 L50 64 L36 56 L36 44 Z"
          fill="#101726"
          stroke="#7C5CFC"
          strokeWidth="1"
          strokeDasharray="2 1"
        />

        {/* Laser Etch Branding / Model Mark */}
        <text
          x="50"
          y="49"
          fill="#7C5CFC"
          fontSize="4.5"
          fontWeight="bold"
          fontFamily="monospace"
          textAnchor="middle"
          letterSpacing="0.8"
        >
          SYNTAX
        </text>
        <text
          x="50"
          y="54"
          fill="#22C7A9"
          fontSize="4"
          fontWeight="bold"
          fontFamily="monospace"
          textAnchor="middle"
        >
          7600X
        </text>

        {/* Animated Micro-Circuit Traces with Light Pulses */}
        <g strokeLinecap="round">
          {/* Trace 1: Top-left into die */}
          <path
            d="M20 45 L32 45 L36 47"
            stroke="#22C7A9"
            strokeWidth="1"
            strokeDasharray="30"
            className="animate-pulse"
          />
          {/* Trace 2: Bottom-right from die */}
          <path
            d="M64 53 L68 55 L80 55"
            stroke="#7C5CFC"
            strokeWidth="1"
            strokeDasharray="30"
            className="animate-pulse delay-200"
          />
          {/* Trace 3: Bottom-left into die */}
          <path
            d="M30 65 L42 65 L46 63"
            stroke="#4DA3FF"
            strokeWidth="0.8"
            strokeDasharray="20"
            className="animate-pulse delay-500"
          />
          {/* Trace 4: Top-right into die */}
          <path
            d="M54 34 L54 38 L58 40"
            stroke="#22C7A9"
            strokeWidth="0.8"
            strokeDasharray="16"
            className="animate-pulse delay-700"
          />
        </g>

        {/* Surface Mount Decoupling Capacitors (SMD components) */}
        <rect x="29" y="33" width="3" height="4" rx="0.5" fill="#E2E8F0" stroke="#64748B" strokeWidth="0.5" />
        <rect x="68" y="33" width="3" height="4" rx="0.5" fill="#E2E8F0" stroke="#64748B" strokeWidth="0.5" />
        <rect x="48.5" y="66" width="3" height="4" rx="0.5" fill="#F5B942" stroke="#B45309" strokeWidth="0.5" />

        {/* Live Active Power Status Micro-LED */}
        <circle cx="50" cy="27" r="1.5" fill="#22C7A9" className="animate-ping" opacity="0.75" />
        <circle cx="50" cy="27" r="1.2" fill="#22C7A9" />

        {/* Gradients */}
        <defs>
          <linearGradient id="ihsGradient" x1="24" y1="24" x2="76" y2="76" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2D3A4F" />
            <stop offset="0.5" stopColor="#1E2838" />
            <stop offset="1" stopColor="#151E2E" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};
