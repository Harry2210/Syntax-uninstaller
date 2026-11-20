import React from 'react';
import { SystemSpecs } from '../types';
import { Info, Cpu, HardDrive, ShieldCheck, Monitor, User, Server } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

interface SystemInfoPageProps {
  specs: SystemSpecs | null;
}

export const SystemInfoPage: React.FC<SystemInfoPageProps> = ({ specs }) => {
  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-5xl">
      <div className="p-5 bg-card border border-border rounded-2xl flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-primary/20 text-primary rounded-xl">
            <Info className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">System Information & Hardware Diagnostics</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Detailed machine architecture, Windows environment build, RAM allocation, and mounted volumes.
            </p>
          </div>
        </div>

        <StatusBadge
          status={specs?.is_admin ? 'Elevated Administrator' : 'Standard User Token'}
          variant={specs?.is_admin ? 'success' : 'warning'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* OS Specs */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center space-x-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Monitor className="w-4 h-4" />
            <span>Operating System</span>
          </div>

          <div className="space-y-2 pt-1 font-mono">
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-text-muted">OS Edition:</span>
              <span className="text-text-primary font-semibold">{specs?.os_name || 'Not detected'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-text-muted">Build / Version:</span>
              <span className="text-text-primary">{specs?.os_version || 'Not detected'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-text-muted">Architecture:</span>
              <span className="text-text-primary">{specs?.architecture || 'Not detected'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-text-muted">Computer Name:</span>
              <span className="text-text-primary">{specs?.computer_name || 'Not detected'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-text-muted">Current User:</span>
              <span className="text-text-primary">{specs?.username || 'Not detected'}</span>
            </div>
          </div>
        </div>

        {/* CPU & Memory Specs */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center space-x-2 text-secondary font-bold text-xs uppercase tracking-wider">
            <Cpu className="w-4 h-4" />
            <span>Processor & Memory</span>
          </div>

          <div className="space-y-2 pt-1 font-mono">
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-text-muted">CPU Model:</span>
              <span className="text-text-primary truncate max-w-[220px] font-semibold">{specs?.cpu_name || 'Not detected'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-text-muted">Logical Cores:</span>
              <span className="text-text-primary">{specs?.cpu_cores ? `${specs.cpu_cores} Cores` : 'Not detected'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-text-muted">Total Physical RAM:</span>
              <span className="text-text-primary font-semibold">{specs?.total_ram_mb ? `${Math.round(specs.total_ram_mb / 1024)} GB` : 'Not detected'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-text-muted">Used Memory:</span>
              <span className="text-text-primary">{specs?.used_ram_mb ? `${Math.round(specs.used_ram_mb / 1024)} GB` : 'Not detected'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-text-muted">Available Memory:</span>
              <span className="text-secondary font-semibold">{specs?.available_ram_mb ? `${Math.round(specs.available_ram_mb / 1024)} GB` : 'Not detected'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Disks */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center space-x-2 text-primary font-bold text-xs uppercase tracking-wider">
          <HardDrive className="w-4 h-4" />
          <span>Mounted Storage Volumes</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(specs?.disks || []).map((disk) => {
            const usedBytes = disk.total_space_bytes - disk.available_space_bytes;
            const pct = disk.total_space_bytes > 0 ? Math.round((usedBytes / disk.total_space_bytes) * 100) : 0;
            return (
              <div key={disk.mount_point} className="p-4 bg-surface rounded-xl border border-border space-y-2 text-xs">
                <div className="flex justify-between font-bold text-text-primary">
                  <span>{disk.name || disk.mount_point}</span>
                  <span className="font-mono text-text-muted">{disk.file_system}</span>
                </div>
                <div className="w-full h-2 bg-card rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-text-muted">
                  <span>{(disk.available_space_bytes / (1024**3)).toFixed(0)} GB Free</span>
                  <span>{(disk.total_space_bytes / (1024**3)).toFixed(0)} GB Total</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
