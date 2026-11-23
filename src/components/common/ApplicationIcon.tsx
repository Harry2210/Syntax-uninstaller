import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  Code2,
  Terminal,
  Folder,
  Globe,
  Music,
  MessageSquare,
  Play,
  HardDrive,
  Calculator,
  Palette,
  Package,
  Layers,
  FileCode,
  FileText,
  Boxes,
  Compass,
  Cpu,
  Gamepad2,
  Shield,
  Database,
  Film,
  Headphones,
  Settings,
  Scissors,
  Camera,
  Mic,
  Sun,
  MapPin,
  Clock,
  ShoppingBag,
  Wrench,
  Sparkles,
  FileSpreadsheet,
} from 'lucide-react';

interface ApplicationIconProps {
  name: string;
  publisher?: string;
  iconPath?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/*
 * PERFORMANCE: application lists render the same icon many times (installed
 * apps, Windows apps, dashboard cards). Every row used to invoke the native
 * extractor independently. These module-level maps keep the resolved data URL
 * and share one in-flight request per icon path, so scrolling and re-renders
 * never re-extract the same executable.
 */
const ICON_CACHE_LIMIT = 400;
const iconCache = new Map<string, string | null>();
const iconRequests = new Map<string, Promise<string | null>>();

function rememberIcon(iconPath: string, dataUrl: string | null) {
  if (iconCache.size >= ICON_CACHE_LIMIT && !iconCache.has(iconPath)) {
    const oldest = iconCache.keys().next().value;
    if (oldest !== undefined) iconCache.delete(oldest);
  }
  iconCache.set(iconPath, dataUrl);
}

function loadApplicationIcon(iconPath: string): Promise<string | null> {
  if (iconCache.has(iconPath)) {
    return Promise.resolve(iconCache.get(iconPath) ?? null);
  }

  const pending = iconRequests.get(iconPath);
  if (pending) return pending;

  const request = api
    .getApplicationIcon(iconPath)
    .then((dataUrl) => {
      rememberIcon(iconPath, dataUrl);
      return dataUrl;
    })
    .catch(() => {
      rememberIcon(iconPath, null);
      return null;
    })
    .finally(() => {
      iconRequests.delete(iconPath);
    });

  iconRequests.set(iconPath, request);
  return request;
}

export const ApplicationIcon: React.FC<ApplicationIconProps> = ({
  name,
  publisher = '',
  iconPath = '',
  size = 'md',
  className = '',
}) => {
  const normName = (name || '').toLowerCase();
  const normPub = (publisher || '').toLowerCase();

  // Normalize tokens to strip versions, architecture, and extra punctuation
  const cleanTokens = normName
    .replace(/^microsoft\./g, '')
    .replace(/\bversion\b/g, '')
    .replace(/\b\d+([._]\d+)*\b/g, '')
    .replace(/\(x\d+\)/g, '')
    .replace(/\(64-bit\)/g, '')
    .replace(/\(32-bit\)/g, '')
    .replace(/[()_-]/g, ' ')
    .trim();

  const containerSizes = {
    sm: 'w-6 h-6 rounded-md',
    md: 'w-9 h-9 rounded-xl',
    lg: 'w-11 h-11 rounded-2xl',
    xl: 'w-16 h-16 rounded-2xl',
  };

  const pSize = size === 'sm' ? 'p-1' : size === 'md' ? 'p-1.5' : size === 'lg' ? 'p-2' : 'p-3';

  // State for resolved real Windows icon
  const [extractedIcon, setExtractedIcon] = useState<string | null>(() => {
    if (iconPath && (iconPath.startsWith('data:image/') || iconPath.startsWith('http'))) {
      return iconPath;
    }
    return null;
  });
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);

    if (!iconPath) {
      setExtractedIcon(null);
      return;
    }

    if (iconPath.startsWith('data:image/') || iconPath.startsWith('http')) {
      setExtractedIcon(iconPath);
      return;
    }

    // Call the shared, cached backend extractor for native Windows icon paths.
    let active = true;
    setExtractedIcon(null);
    loadApplicationIcon(iconPath).then((dataUrl) => {
      if (active && dataUrl) {
        setExtractedIcon(dataUrl);
      }
    });

    return () => {
      active = false;
    };
  }, [iconPath]);

  // 1. If an authentic real icon is available from Windows, render it directly!
  if (extractedIcon && !imgError) {
    return (
      <div
        className={`${containerSizes[size]} flex items-center justify-center bg-card border border-border flex-shrink-0 shadow-sm p-1 overflow-hidden relative ${className}`}
      >
        <img
          src={extractedIcon}
          alt={name}
          className="w-full h-full object-contain"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // --- 2. VECTOR BRAND LOGOS ---

  // Google Chrome
  if (normName.includes('chrome')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#4285F4]/15 border border-[#4285F4]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`}>
          <circle cx="12" cy="12" r="10" fill="#EA4335" />
          <path d="M12 2C6.48 2 2 6.48 2 12C2 12.34 2.02 12.67 2.06 13L9 13L12 7.8L21.94 12C21.98 11.67 22 11.34 22 11C22 6.03 17.97 2 12 2Z" fill="#FBBC05" />
          <path d="M12 22C16.48 22 20.35 19.06 21.6 15L14.7 15L12 20.2L5.06 12C4.02 13.67 3.5 15.65 3.5 17.5C3.5 19.98 7.3 22 12 22Z" fill="#34A853" />
          <circle cx="12" cy="12" r="4.5" fill="#FFFFFF" />
          <circle cx="12" cy="12" r="3.2" fill="#4285F4" />
        </svg>
      </div>
    );
  }

  // Mozilla Firefox
  if (normName.includes('firefox')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#FF7139]/15 border border-[#FF7139]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`}>
          <circle cx="12" cy="12" r="10" fill="#20123A" />
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm6.2 6.5c-.4 1.8-1.5 3.3-3.2 4.1.8-.7 1.3-1.6 1.4-2.6-1.1 2.2-3.3 3.5-5.6 3.2 1.3-.9 2.1-2.4 2-4-.4.8-1.2 1.4-2.1 1.6.4-1.3.1-2.8-.8-3.8-.4 1.2-1.3 2.1-2.5 2.4.6-.9.8-2 .4-3-1 1.8-1.2 4-.6 5.9C5.3 14 4.8 11.8 5.4 9.8c-.8 2.3-.6 4.9.7 7 1.8 2.8 5.2 4.3 8.4 3.6 3.2-.7 5.6-3.3 6-6.5.1-1.8-.6-3.6-2.3-5.4z" fill="#FF7139" />
          <circle cx="11.5" cy="12" r="4.5" fill="#3F88E8" />
        </svg>
      </div>
    );
  }

  // Microsoft Edge
  if (normName.includes('edge')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#0078D7]/15 border border-[#0078D7]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`}>
          <path d="M12 2C6.48 2 2 6.48 2 12c0 3.7 2.01 6.94 5 8.65V16c0-3.31 2.69-6 6-6s6 2.69 6 6v.2c1.84-1.6 3-3.96 3-6.2 0-4.41-3.59-8-8-8z" fill="#0078D7" />
          <path d="M12 10c-3.31 0-6 2.69-6 6 0 3.31 2.69 6 6 6 4.41 0 8-3.59 8-8v-2c0-1.1-.9-2-2-2h-6z" fill="#00BCF2" />
        </svg>
      </div>
    );
  }

  // Brave Browser
  if (normName.includes('brave')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#FB542B]/15 border border-[#FB542B]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="#FB542B">
          <path d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3zm0 4.2c1.9 0 3.5 1.6 3.5 3.5S13.9 13.2 12 13.2s-3.5-1.6-3.5-3.5 1.6-3.5 3.5-3.5zm4 9.8c-.8.8-2.3 1.5-4 1.5s-3.2-.7-4-1.5v-1.2c1 .7 2.4 1.2 4 1.2s3-.5 4-1.2v1.2z" />
        </svg>
      </div>
    );
  }

  // Opera
  if (normName.includes('opera')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#FF1B2D]/15 border border-[#FF1B2D]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="#FF1B2D">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 17c-2.76 0-5-3.13-5-7s2.24-7 5-7 5 3.13 5 7-2.24 7-5 7z" />
        </svg>
      </div>
    );
  }

  // Visual Studio Code
  if (normName.includes('visual studio code') || normName.includes('vscode') || normName === 'code' || cleanTokens.includes('vscode')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#007ACC]/15 border border-[#007ACC]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="none">
          <path d="M17.5 2.5L7.5 10.5L3 7L1.5 8L4.5 12L1.5 16L3 17L7.5 13.5L17.5 21.5L22.5 19V5L17.5 2.5ZM17.5 16.5L10 12L17.5 7.5V16.5Z" fill="#007ACC" />
        </svg>
      </div>
    );
  }

  // Visual Studio IDE
  if (normName.includes('visual studio') && !normName.includes('code')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#5C2D91]/15 border border-[#5C2D91]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="#5C2D91">
          <path d="M17 2l-6 5.5-4-3.5L2 6.5v11l5 2.5 4-3.5L17 22l5-2V4l-5-2zm0 14.5L10.5 12 17 7.5v9z" />
        </svg>
      </div>
    );
  }

  // Git
  if (cleanTokens.includes('git') || normName.startsWith('git') || normName.includes('git version') || normName.includes('git-scm')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#F05032]/15 border border-[#F05032]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="#F05032">
          <path d="M23.546 10.93L13.067.452a1.5 1.5 0 0 0-2.126 0L8.808 2.585l2.833 2.834a1.78 1.78 0 0 1 2.253 2.263l2.727 2.727a1.78 1.78 0 0 1 1.758 2.37l-3.328 3.328a1.78 1.78 0 1 1-1.07-1.07l3.29-3.29a1.78 1.78 0 0 1-.417-1.428L14.2 7.643a1.78 1.78 0 0 1-1.428-.417L9.94 10.06a1.78 1.78 0 0 1 .453 1.954L6.96 15.446a1.78 1.78 0 1 1-1.06-1.06l3.432-3.432a1.78 1.78 0 0 1-.397-1.517L6.1 6.603.454 12.25a1.5 1.5 0 0 0 0 2.126l10.479 10.478a1.5 1.5 0 0 0 2.126 0l10.487-10.486a1.5 1.5 0 0 0 0-2.126v-.001z" />
        </svg>
      </div>
    );
  }

  // Node.js
  if (normName.includes('node') || normName.includes('nodejs')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#339933]/15 border border-[#339933]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="#339933">
          <path d="M12 1L2 6.77v10.46L12 23l10-5.77V6.77L12 1zm7.8 15.02L12 20.4l-7.8-4.38V7.98L12 3.6l7.8 4.38v8.04z" />
        </svg>
      </div>
    );
  }

  // Python
  if (normName.includes('python')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#3776AB]/15 border border-[#3776AB]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`}>
          <path d="M11.9 2c-3.1 0-4.9.4-4.9 1.8v2.3h5V7H4.8C3.3 7 2 8.3 2 9.8c0 2.1 1.2 3.2 2.8 3.2h1.4v-1.6c0-1.8 1.5-3.3 3.3-3.3h5.4c1.5 0 2.7-1.2 2.7-2.7V4.7c0-1.4-2.6-2.7-5.7-2.7z" fill="#3776AB" />
          <path d="M12.1 22c3.1 0 4.9-.4 4.9-1.8v-2.3h-5V17h7.2c1.5 0 2.8-1.3 2.8-2.8 0-2.1-1.2-3.2-2.8-3.2h-1.4v1.6c0 1.8-1.5 3.3-3.3 3.3H9.1c-1.5 0-2.7 1.2-2.7 2.7v2.7c0 1.4 2.6 2.7 5.7 2.7z" fill="#FFD43B" />
        </svg>
      </div>
    );
  }

  // Docker
  if (normName.includes('docker')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#2496ED]/15 border border-[#2496ED]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="#2496ED">
          <path d="M13 6h2v2h-2V6zm-3 0h2v2h-2V6zm-3 0h2v2H7V6zm6 3h2v2h-2V9zm-3 0h2v2h-2V9zm-3 0h2v2H7V9zm-3 0h2v2H4V9zm9 3h2v2h-2v-2zm-3 0h2v2h-2v-2zm-3 0h2v2H7v-2zm-3 0h2v2H4v-2zm-3 0h2v2H1v-2zm21.9 2.5c-.3-.2-1.2-.4-2.2-.3-.5.1-1 .3-1.4.5-.4-1.2-1.5-2.1-2.8-2.4l-.5-.1v1.5c0 .3.2.6.4.8.9.7 1.4 1.7 1.4 2.8 0 3.3-3.1 6-7.8 6-3.8 0-7.1-1.8-7.9-4.5-.3-1-.1-2.1.5-3 .6-.9 1.7-1.5 2.8-1.5h14.3c.7 0 1.3-.2 1.8-.6.5-.4.9-1 1-1.7.3.3.4.6.4.8 0 .6-.4 1.2-1 1.6z" />
        </svg>
      </div>
    );
  }

  // Java / Oracle
  if (normName.includes('java') || normPub.includes('oracle')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#E76F00]/15 border border-[#E76F00]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="#E76F00">
          <path d="M8.8 17.5c-2.4.2-3.7-.4-3.7-.4s1.2-.5 3-.6c2.3-.2 4.4.1 6.5-.1 1.7-.2 2.3-.8 2.3-.8s-.6.5-2.2.8c-2.1.4-3.8.4-5.9.6v.5zm.9 2.2c-1.9.2-2.8-.3-2.8-.3s.9-.4 2.3-.5c1.7-.1 3.4.1 5.1-.1 1.4-.2 1.8-.7 1.8-.7s-.5.4-1.7.6c-1.6.4-3 .4-4.7.6v.4zM12 2C8 2 4.5 4.5 4.5 9c0 3.3 2 5.5 3.5 6.7 0 0-.6-.6-.6-1.5 0-2.3 3.6-4.2 3.6-6.7 0-1.7-.7-3.1-1.3-4.2C10.7 3.5 11.5 3 12 3c1.5 0 3.5 1.5 3.5 4 0 2.2-1.2 3.8-1.2 5.5 0 1.2.7 2 1.8 2.6.8-.7 1.4-1.7 1.4-2.9 0-3.5-3-6.2-5.5-10.2z" />
        </svg>
      </div>
    );
  }

  // Postman
  if (normName.includes('postman')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#FF6C37]/15 border border-[#FF6C37]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="#FF6C37">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6zm0 2c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4z" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }

  // Discord
  if (normName.includes('discord')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#5865F2]/15 border border-[#5865F2]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="#5865F2">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      </div>
    );
  }

  // Slack
  if (normName.includes('slack')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#E01E5A]/15 border border-[#E01E5A]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`}>
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A" />
          <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0" />
          <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D" />
          <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#ECB22E" />
        </svg>
      </div>
    );
  }

  // Microsoft Teams
  if (normName.includes('teams')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#464EB8]/15 border border-[#464EB8]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="#464EB8">
          <path d="M19.5 7.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-14 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2C3 12.5 0 14 0 16.5V19h11v-2.5c0-2.5-3-4-5.5-4zm14-1c-1.8 0-3.3.9-4.1 2.2.8.8 1.4 1.8 1.5 2.8H24v-1.5c0-2-2.5-3.5-4.5-3.5z" />
        </svg>
      </div>
    );
  }

  // Zoom
  if (normName.includes('zoom')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#2D8CFF]/15 border border-[#2D8CFF]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="#2D8CFF">
          <path d="M4 6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H4zm13 3.5l5-3.5v12l-5-3.5v-5z" />
        </svg>
      </div>
    );
  }

  // Telegram
  if (normName.includes('telegram')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#26A5E4]/15 border border-[#26A5E4]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="#26A5E4">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.9 8.94c-.14.64-.53.8-1.07.5l-2.92-2.15-1.41 1.36c-.16.15-.29.29-.6.29l.21-2.98 5.43-4.9c.24-.21-.05-.33-.37-.12l-6.71 4.22-2.89-.9c-.63-.2-.64-.63.13-.93l11.29-4.35c.52-.19.98.13.82.94z" />
        </svg>
      </div>
    );
  }

  // WhatsApp
  if (normName.includes('whatsapp')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#25D366]/15 border border-[#25D366]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="#25D366">
          <path d="M12 2C6.48 2 2 6.48 2 12c0 1.94.51 3.76 1.4 5.34L2 22l4.82-1.36A9.95 9.95 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.73 14.53c-.24.67-1.19 1.25-1.97 1.35-.53.07-1.22.13-3.55-.83-2.98-1.23-4.9-4.24-5.05-4.44-.15-.2-1.2-1.6-1.2-3.05s.76-2.17 1.03-2.46c.27-.3.59-.37.79-.37.2 0 .4 0 .57.01.18.01.42-.07.66.5.24.58.82 2 .89 2.15.07.15.12.33.02.53-.1.2-.15.33-.3.5-.15.18-.32.4-.46.54-.15.15-.31.31-.13.62.18.31.8 1.32 1.72 2.14 1.18 1.05 2.17 1.37 2.48 1.52.31.15.49.13.67-.08.18-.21.79-.92 1-1.23.21-.31.42-.26.71-.15.29.11 1.83.86 2.15 1.02.31.16.52.24.6.37.08.14.08.79-.16 1.46z" />
        </svg>
      </div>
    );
  }

  // Spotify
  if (normName.includes('spotify')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#1ED760]/15 border border-[#1ED760]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="#1ED760">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.498 17.296c-.217.356-.677.47-1.033.253-2.83-1.728-6.393-2.119-10.59-1.161-.408.093-.814-.162-.907-.57-.094-.408.162-.814.57-.907 4.595-1.049 8.529-.607 11.707 1.332.356.217.47.677.253 1.033zm1.467-3.26c-.273.444-.855.586-1.299.313-3.24-1.992-8.18-2.569-12.012-1.406-.5.152-1.033-.133-1.185-.633-.152-.5.133-1.033.633-1.185 4.383-1.33 9.827-.687 13.55 1.603.444.273.586.855.313 1.299zm.126-3.41c-3.886-2.308-10.298-2.52-14.004-1.394-.597.182-1.229-.164-1.411-.76-.182-.597.164-1.229.76-1.411 4.263-1.294 11.341-1.046 15.817 1.611.537.319.713 1.015.394 1.552-.319.537-1.015.713-1.552.394l-.004.008z" />
        </svg>
      </div>
    );
  }

  // Steam
  if (normName.includes('steam')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#171A21] border border-[#2A475E] flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="#66C0F4">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.23 11.41l3.52-5.11a3.5 3.5 0 0 1-.75-2.2c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5c-.2 0-.4-.02-.59-.06l-5.06 3.56C9.9 23.8 10.93 24 12 24c6.63 0 12-5.37 12-12S18.63 0 12 0z" />
        </svg>
      </div>
    );
  }

  // VLC Media Player
  if (normName.includes('vlc')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#FF8800]/15 border border-[#FF8800]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="none">
          <path d="M4 20L8.5 4H15.5L20 20H4Z" fill="#FF8800" />
          <path d="M6.2 16L7.4 12H16.6L17.8 16H6.2Z" fill="#FFFFFF" />
          <path d="M8.6 8L9.8 4H14.2L15.4 8H8.6Z" fill="#FFFFFF" />
          <rect x="2" y="20" width="20" height="2" rx="1" fill="#FF8800" />
        </svg>
      </div>
    );
  }

  // Epic Games
  if (normName.includes('epic')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-black border border-border flex-shrink-0 shadow-sm ${className}`}>
        <span className="font-mono font-black text-white text-xs tracking-tighter">EPIC</span>
      </div>
    );
  }

  // OBS Studio
  if (normName.includes('obs') || normName.includes('open broadcaster')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-card border border-border flex-shrink-0 shadow-sm ${className}`}>
        <div className="w-4/5 h-4/5 rounded-full border-2 border-text-primary border-t-primary animate-spin" />
      </div>
    );
  }

  // Office Suite: Word, Excel, PowerPoint, Office 365, Acrobat
  if (normName.includes('word')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#2B579A]/15 border border-[#2B579A]/30 flex-shrink-0 shadow-sm font-bold text-[#2B579A] ${className}`}>
        <span className="font-mono text-sm font-black">W</span>
      </div>
    );
  }

  if (normName.includes('excel')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#217346]/15 border border-[#217346]/30 flex-shrink-0 shadow-sm font-bold text-[#217346] ${className}`}>
        <span className="font-mono text-sm font-black">X</span>
      </div>
    );
  }

  if (normName.includes('powerpoint')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#D24726]/15 border border-[#D24726]/30 flex-shrink-0 shadow-sm font-bold text-[#D24726] ${className}`}>
        <span className="font-mono text-sm font-black">P</span>
      </div>
    );
  }

  if (normName.includes('office') || normName.includes('365')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#EB3C00]/15 border border-[#EB3C00]/30 flex-shrink-0 shadow-sm font-bold text-[#EB3C00] ${className}`}>
        <FileSpreadsheet className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('acrobat') || normName.includes('adobe reader') || normName.includes('pdf')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#FF0000]/15 border border-[#FF0000]/30 flex-shrink-0 shadow-sm font-bold text-[#FF0000] ${className}`}>
        <span className="font-mono text-xs font-black">PDF</span>
      </div>
    );
  }

  // 7-Zip
  if (normName.includes('7-zip') || normName.includes('7zip') || cleanTokens.includes('7z')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-card border border-border flex-shrink-0 shadow-sm font-mono font-black text-secondary ${className}`}>
        <span className="tracking-tighter text-xs">7z</span>
      </div>
    );
  }

  // WinRAR
  if (normName.includes('winrar') || cleanTokens.includes('rar')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#1D71B8]/15 border border-[#1D71B8]/30 flex-shrink-0 shadow-sm font-bold text-[#1D71B8] ${className}`}>
        <Package className="w-4/5 h-4/5" />
      </div>
    );
  }

  // Hardware utilities: NVIDIA, AMD, Intel, Realtek
  if (normName.includes('nvidia') || normName.includes('geforce')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#76B900]/15 border border-[#76B900]/30 flex-shrink-0 shadow-sm text-[#76B900] ${className}`}>
        <Cpu className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('amd') || normName.includes('radeon')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#ED1C24]/15 border border-[#ED1C24]/30 flex-shrink-0 shadow-sm text-[#ED1C24] ${className}`}>
        <Cpu className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('intel')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#0071C5]/15 border border-[#0071C5]/30 flex-shrink-0 shadow-sm text-[#0071C5] ${className}`}>
        <Cpu className="w-4/5 h-4/5" />
      </div>
    );
  }

  // Blender
  if (normName.includes('blender')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#E87D0D]/15 border border-[#E87D0D]/30 flex-shrink-0 shadow-sm ${className}`}>
        <svg viewBox="0 0 24 24" className={`w-full h-full ${pSize}`} fill="#E87D0D">
          <circle cx="12" cy="12" r="5" fill="#265787" />
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
        </svg>
      </div>
    );
  }

  // Adobe Creative Suite
  if (normName.includes('photoshop')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#001E36] border border-[#31A8FF]/40 flex-shrink-0 shadow-sm font-black text-[#31A8FF] ${className}`}>
        <span className="font-mono text-xs">Ps</span>
      </div>
    );
  }

  if (normName.includes('illustrator')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#330000] border border-[#FF9A00]/40 flex-shrink-0 shadow-sm font-black text-[#FF9A00] ${className}`}>
        <span className="font-mono text-xs">Ai</span>
      </div>
    );
  }

  if (normName.includes('premiere')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#00005B] border border-[#9999FF]/40 flex-shrink-0 shadow-sm font-black text-[#9999FF] ${className}`}>
        <span className="font-mono text-xs">Pr</span>
      </div>
    );
  }

  // JetBrains IDEs: IntelliJ, PyCharm, WebStorm, Rider, CLion, RustRover
  if (normName.includes('intellij') || normName.includes('pycharm') || normName.includes('webstorm') || normName.includes('rider') || normName.includes('clion') || normName.includes('jetbrains')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#080808] border border-[#FF318C]/40 flex-shrink-0 shadow-sm font-mono font-bold text-white ${className}`}>
        <span className="text-[10px] text-transparent bg-clip-text bg-gradient-to-tr from-[#21D789] via-[#000000] to-[#FF318C]">JB</span>
      </div>
    );
  }

  // Rust & Cargo
  if (cleanTokens.includes('rust') || cleanTokens.includes('cargo') || normName.startsWith('rust')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#DEA584]/15 border border-[#DEA584]/30 flex-shrink-0 shadow-sm font-mono font-black text-[#DEA584] ${className}`}>
        <span className="text-xs">RS</span>
      </div>
    );
  }

  // Go / Golang
  if (cleanTokens.includes('golang') || cleanTokens.includes('go programming')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#00ADD8]/15 border border-[#00ADD8]/30 flex-shrink-0 shadow-sm font-bold text-[#00ADD8] ${className}`}>
        <span className="font-mono text-xs font-black">GO</span>
      </div>
    );
  }

  // Database tools: PostgreSQL, MySQL, SQLite
  if (normName.includes('postgres') || normName.includes('psql')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#336791]/15 border border-[#336791]/30 flex-shrink-0 shadow-sm font-black text-[#336791] ${className}`}>
        <Database className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('mysql')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#00758F]/15 border border-[#F29111]/30 flex-shrink-0 shadow-sm font-black text-[#F29111] ${className}`}>
        <Database className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('sqlite')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#003B57]/15 border border-[#003B57]/30 flex-shrink-0 shadow-sm font-black text-[#003B57] ${className}`}>
        <Database className="w-4/5 h-4/5" />
      </div>
    );
  }

  // Security & Password Managers: Bitwarden, 1Password, KeePass
  if (normName.includes('bitwarden') || normName.includes('1password') || normName.includes('keepass')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#175DDC]/15 border border-[#175DDC]/30 flex-shrink-0 shadow-sm text-[#175DDC] ${className}`}>
        <Shield className="w-4/5 h-4/5" />
      </div>
    );
  }

  // Productivity: Obsidian, Notion
  if (normName.includes('obsidian')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#7C3AED]/15 border border-[#7C3AED]/30 flex-shrink-0 shadow-sm text-[#A78BFA] ${className}`}>
        <Sparkles className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('notion')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-card border border-border flex-shrink-0 shadow-sm font-mono font-black text-text-primary ${className}`}>
        <span className="text-sm font-bold">N</span>
      </div>
    );
  }

  // Remote Desktop: AnyDesk, TeamViewer
  if (normName.includes('anydesk')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#EF443B]/15 border border-[#EF443B]/30 flex-shrink-0 shadow-sm font-bold text-[#EF443B] ${className}`}>
        <span className="font-mono text-xs font-black">AD</span>
      </div>
    );
  }

  if (normName.includes('teamviewer')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#0E80E5]/15 border border-[#0E80E5]/30 flex-shrink-0 shadow-sm font-bold text-[#0E80E5] ${className}`}>
        <span className="font-mono text-xs font-black">TV</span>
      </div>
    );
  }

  // PowerToys, ShareX, Everything, Rufus, Wireshark, Audacity, Torrents
  if (normName.includes('powertoys')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-primary/15 border border-primary/30 flex-shrink-0 shadow-sm text-primary ${className}`}>
        <Wrench className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('sharex')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-secondary/15 border border-secondary/30 flex-shrink-0 shadow-sm text-secondary ${className}`}>
        <Scissors className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('everything') && !normName.includes('microsoft')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-warning/15 border border-warning/30 flex-shrink-0 shadow-sm text-warning ${className}`}>
        <Compass className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('rufus')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-surface border border-border flex-shrink-0 shadow-sm text-secondary ${className}`}>
        <HardDrive className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('wireshark')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#167AC6]/15 border border-[#167AC6]/30 flex-shrink-0 shadow-sm text-[#167AC6] ${className}`}>
        <Layers className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('torrent')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-primary/15 border border-primary/30 flex-shrink-0 shadow-sm text-primary ${className}`}>
        <Package className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('audacity')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#0000EE]/15 border border-[#0000EE]/30 flex-shrink-0 shadow-sm text-[#FFA500] ${className}`}>
        <Headphones className="w-4/5 h-4/5" />
      </div>
    );
  }

  // Windows Apps: Calculator, Terminal, Paint, Snipping Tool, Camera, Voice Recorder, Defender, Store, Xbox, Weather, Maps, Notepad
  if (normName.includes('calculator') || normName.includes('calc')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#0078D7]/15 border border-[#0078D7]/30 flex-shrink-0 shadow-sm text-[#0078D7] ${className}`}>
        <Calculator className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('terminal') || normName.includes('powershell') || normName.includes('cmd')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-card border border-border flex-shrink-0 shadow-sm text-text-primary ${className}`}>
        <Terminal className="w-4/5 h-4/5 text-primary" />
      </div>
    );
  }

  if (normName.includes('paint')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-secondary/15 border border-secondary/30 flex-shrink-0 shadow-sm text-secondary ${className}`}>
        <Palette className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('snippingtool') || normName.includes('snip')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-info/15 border border-info/30 flex-shrink-0 shadow-sm text-info ${className}`}>
        <Scissors className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('camera')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-warning/15 border border-warning/30 flex-shrink-0 shadow-sm text-warning ${className}`}>
        <Camera className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('voice') || normName.includes('recorder') || normName.includes('soundrecorder')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-danger/15 border border-danger/30 flex-shrink-0 shadow-sm text-danger ${className}`}>
        <Mic className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('security') || normName.includes('defender') || normName.includes('antivirus')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-secondary/15 border border-secondary/30 flex-shrink-0 shadow-sm text-secondary ${className}`}>
        <Shield className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('store') || normName.includes('windowsstore')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-primary/15 border border-primary/30 flex-shrink-0 shadow-sm text-primary ${className}`}>
        <ShoppingBag className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('xbox')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#107C10]/15 border border-[#107C10]/30 flex-shrink-0 shadow-sm text-[#107C10] ${className}`}>
        <Gamepad2 className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('weather')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-warning/15 border border-warning/30 flex-shrink-0 shadow-sm text-warning ${className}`}>
        <Sun className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('maps')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-danger/15 border border-danger/30 flex-shrink-0 shadow-sm text-danger ${className}`}>
        <MapPin className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('alarms') || normName.includes('clock')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-info/15 border border-info/30 flex-shrink-0 shadow-sm text-info ${className}`}>
        <Clock className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('notepad')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-info/15 border border-info/30 flex-shrink-0 shadow-sm text-info ${className}`}>
        <FileText className="w-4/5 h-4/5" />
      </div>
    );
  }

  // Windows Media & Communication
  if (normName.includes('photo')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#0078D7]/15 border border-[#0078D7]/30 flex-shrink-0 shadow-sm text-[#0078D7] ${className}`}>
        <Palette className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('media player') || normName.includes('zune') || normName.includes('films & tv')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#EA005E]/15 border border-[#EA005E]/30 flex-shrink-0 shadow-sm text-[#EA005E] ${className}`}>
        <Play className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('phone') || normName.includes('yourphone')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#0078D7]/15 border border-[#0078D7]/30 flex-shrink-0 shadow-sm text-[#0078D7] ${className}`}>
        <MessageSquare className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('sticky')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#FFB900]/15 border border-[#FFB900]/30 flex-shrink-0 shadow-sm text-[#FFB900] ${className}`}>
        <FileText className="w-4/5 h-4/5" />
      </div>
    );
  }

  // Utilities: Revo, Android Studio, GIGABYTE, IDM, Wondershare, Moho
  if (normName.includes('revo')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#0080FF]/15 border border-[#0080FF]/30 flex-shrink-0 shadow-sm text-[#0080FF] ${className}`}>
        <Layers className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('android')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#3DDC84]/15 border border-[#3DDC84]/30 flex-shrink-0 shadow-sm text-[#3DDC84] ${className}`}>
        <Compass className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('gigabyte') || normName.includes('gbt_')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#FA6400]/15 border border-[#FA6400]/30 flex-shrink-0 shadow-sm text-[#FA6400] font-black text-xs ${className}`}>
        <span>GCC</span>
      </div>
    );
  }

  if (normName.includes('internet download manager') || normName.includes('idman') || normName === 'idm') {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#00A859]/15 border border-[#00A859]/30 flex-shrink-0 shadow-sm text-[#00A859] font-black text-xs ${className}`}>
        <span>IDM</span>
      </div>
    );
  }

  if (normName.includes('filmora')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#00E5FF]/15 border border-[#00E5FF]/30 flex-shrink-0 shadow-sm text-[#00E5FF] ${className}`}>
        <Film className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('pdfelement') || normName.includes('wondershare')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#0052D9]/15 border border-[#0052D9]/30 flex-shrink-0 shadow-sm text-[#0052D9] ${className}`}>
        <FileText className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('moho')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#FF4500]/15 border border-[#FF4500]/30 flex-shrink-0 shadow-sm text-[#FF4500] ${className}`}>
        <Sparkles className="w-4/5 h-4/5" />
      </div>
    );
  }

  // AI & Developer tools
  if (normName.includes('deepseek')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#0066FF]/15 border border-[#0066FF]/30 flex-shrink-0 shadow-sm text-[#0066FF] ${className}`}>
        <Boxes className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('antigravity')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#6366F1]/15 border border-[#6366F1]/30 flex-shrink-0 shadow-sm text-[#6366F1] ${className}`}>
        <Sparkles className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('opencode')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#10B981]/15 border border-[#10B981]/30 flex-shrink-0 shadow-sm text-[#10B981] ${className}`}>
        <Code2 className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('claude')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#CC785C]/15 border border-[#CC785C]/30 flex-shrink-0 shadow-sm text-[#CC785C] ${className}`}>
        <Sparkles className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('copilot') || normName.includes('officehub')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#2563EB]/15 border border-[#2563EB]/30 flex-shrink-0 shadow-sm text-[#2563EB] ${className}`}>
        <Sparkles className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('msys') || normName.includes('winlibs') || normName.includes('mingw') || normName.includes('rustup')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-[#E11D48]/15 border border-[#E11D48]/30 flex-shrink-0 shadow-sm text-[#E11D48] ${className}`}>
        <Wrench className="w-4/5 h-4/5" />
      </div>
    );
  }

  // --- 3. SMART CATEGORY DETECTION FALLBACK ---
  if (normName.includes('driver') || normName.includes('audio') || normName.includes('chipset') || normName.includes('realtek')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex-shrink-0 shadow-sm ${className}`}>
        <Cpu className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('game') || normName.includes('play') || normName.includes('craft') || normName.includes('strike')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-violet-500/15 border border-violet-500/30 text-violet-400 flex-shrink-0 shadow-sm ${className}`}>
        <Gamepad2 className="w-4/5 h-4/5" />
      </div>
    );
  }

  if (normName.includes('sql') || normName.includes('server') || normName.includes('database') || normName.includes('postgres') || normName.includes('mongo')) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center bg-amber-500/15 border border-amber-500/30 text-amber-400 flex-shrink-0 shadow-sm ${className}`}>
        <Database className="w-4/5 h-4/5" />
      </div>
    );
  }

  // --- 4. GLASSMOROPHIC APP TILE FALLBACK ---
  const firstLetter = (name.replace(/^Microsoft\./i, '').trim().charAt(0) || 'A').toUpperCase();
  const colorThemes = [
    { bg: 'bg-primary/20', border: 'border-primary/40', text: 'text-primary' },
    { bg: 'bg-secondary/20', border: 'border-secondary/40', text: 'text-secondary' },
    { bg: 'bg-info/20', border: 'border-info/40', text: 'text-info' },
    { bg: 'bg-warning/20', border: 'border-warning/40', text: 'text-warning' },
    { bg: 'bg-rose-500/20', border: 'border-rose-500/40', text: 'text-rose-400' },
  ];
  const charCode = firstLetter.charCodeAt(0);
  const theme = colorThemes[charCode % colorThemes.length];

  return (
    <div
      className={`${containerSizes[size]} flex items-center justify-center ${theme.bg} border ${theme.border} ${theme.text} font-bold flex-shrink-0 shadow-sm relative overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
      <span className="font-mono tracking-tight text-xs">{firstLetter}</span>
    </div>
  );
};
