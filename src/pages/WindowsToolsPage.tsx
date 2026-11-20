import React, { useState } from 'react';
import { WinTool } from '../types';
import { api } from '../services/api';
import { Wrench, Search, ExternalLink, Activity, HardDrive, Sliders, Cpu, Database, FileText, TrendingUp, Clock, Info, RotateCcw, Layers, Monitor } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

interface WindowsToolsPageProps {
  onLogNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Activity,
  HardDrive,
  Sliders,
  Cpu,
  Database,
  FileText,
  TrendingUp,
  Clock,
  Info,
  RotateCcw,
  Layers,
  Monitor,
};

export const WindowsToolsPage: React.FC<WindowsToolsPageProps> = ({ onLogNotification }) => {
  const [search, setSearch] = useState('');
  const [tools, setTools] = useState<WinTool[]>([
    { id: "taskmgr", name: "Task Manager", command: "taskmgr.exe", description: "View running apps, background processes, and real-time CPU/GPU loads", category: "Diagnostics", icon_name: "Activity" },
    { id: "cleanmgr", name: "Disk Cleanup", command: "cleanmgr.exe", description: "Built-in Windows drive cleaner for system dumps, shadow copies, and temp files", category: "Maintenance", icon_name: "HardDrive" },
    { id: "services", name: "Services Console", command: "services.msc", description: "Manage core Windows service start types and recovery policies", category: "Administration", icon_name: "Sliders" },
    { id: "devmgmt", name: "Device Manager", command: "devmgmt.msc", description: "Inspect hardware drivers, USB controllers, and display adapters", category: "Hardware", icon_name: "Cpu" },
    { id: "diskmgmt", name: "Disk Management", command: "diskmgmt.msc", description: "Partition, format, mount and allocate physical and virtual drives", category: "Storage", icon_name: "Database" },
    { id: "eventvwr", name: "Event Viewer", command: "eventvwr.msc", description: "Inspect Windows Application, System, and Security event logs", category: "Diagnostics", icon_name: "FileText" },
    { id: "resmon", name: "Resource Monitor", command: "resmon.exe", description: "Deep per-process thread, disk queue, and network socket inspection", category: "Diagnostics", icon_name: "TrendingUp" },
    { id: "taskschd", name: "Task Scheduler", command: "taskschd.msc", description: "Automated recurring system scripts and trigger management", category: "Administration", icon_name: "Clock" },
    { id: "msinfo32", name: "System Information", command: "msinfo32.exe", description: "Comprehensive hardware resources, BIOS version, and environment specs", category: "System", icon_name: "Info" },
    { id: "rstrui", name: "System Restore GUI", command: "rstrui.exe", description: "Roll back system state to an earlier restore snapshot", category: "Recovery", icon_name: "RotateCcw" },
    { id: "regedit", name: "Registry Editor", command: "regedit.exe", description: "Windows Registry hive viewer and manual editor", category: "Advanced", icon_name: "Layers" },
    { id: "dxdiag", name: "DirectX Diagnostic Tool", command: "dxdiag.exe", description: "DirectX graphics pipeline, sound devices, and driver validation", category: "Hardware", icon_name: "Monitor" },
  ]);

  const filtered = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleLaunch = async (tool: WinTool) => {
    try {
      await api.launchTool(tool.command);
      onLogNotification('Tool Launched', `Started Windows utility: ${tool.name}`, 'info');
    } catch (e: any) {
      onLogNotification('Launch Error', String(e), 'error');
    }
  };

  return (
    <div className="space-y-4 pb-12 animate-fade-in max-w-5xl">
      <div className="p-4 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-warning/20 text-warning rounded-xl">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Windows Administration Toolbox</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Instant one-click access to built-in Microsoft Windows maintenance, diagnostic, and recovery tools.
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Windows tools..."
            className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((tool) => {
          const IconComp = ICON_MAP[tool.icon_name] || Wrench;
          return (
            <div
              key={tool.id}
              onClick={() => handleLaunch(tool)}
              className="bg-card border border-border hover:border-primary/50 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-lg flex flex-col justify-between group space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-surface border border-border text-primary group-hover:scale-105 transition-transform">
                    <IconComp className="w-5 h-5" />
                  </div>
                  <StatusBadge status={tool.category} variant="neutral" />
                </div>

                <div>
                  <h4 className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                    {tool.name}
                  </h4>
                  <p className="text-[11px] text-text-muted leading-relaxed mt-1">
                    {tool.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-text-muted font-mono">
                <span>{tool.command}</span>
                <span className="flex items-center space-x-1 text-primary font-medium group-hover:translate-x-0.5 transition-transform">
                  <span>Launch</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
