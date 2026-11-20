use serde::{Deserialize, Serialize};

use crate::modules::winproc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WinTool {
    pub id: String,
    pub name: String,
    pub command: String,
    pub description: String,
    pub category: String,
    pub icon_name: String,
}

pub fn get_available_tools() -> Vec<WinTool> {
    vec![
        WinTool {
            id: "taskmgr".into(),
            name: "Task Manager".into(),
            command: "taskmgr.exe".into(),
            description: "View running apps, background processes, and real-time CPU/GPU loads"
                .into(),
            category: "Diagnostics".into(),
            icon_name: "Activity".into(),
        },
        WinTool {
            id: "cleanmgr".into(),
            name: "Disk Cleanup".into(),
            command: "cleanmgr.exe".into(),
            description:
                "Built-in Windows drive cleaner for system dumps, shadow copies, and temp files"
                    .into(),
            category: "Maintenance".into(),
            icon_name: "HardDrive".into(),
        },
        WinTool {
            id: "services".into(),
            name: "Services Console".into(),
            command: "services.msc".into(),
            description: "Manage core Windows service start types and recovery policies".into(),
            category: "Administration".into(),
            icon_name: "Sliders".into(),
        },
        WinTool {
            id: "devmgmt".into(),
            name: "Device Manager".into(),
            command: "devmgmt.msc".into(),
            description: "Inspect hardware drivers, USB controllers, and display adapters".into(),
            category: "Hardware".into(),
            icon_name: "Cpu".into(),
        },
        WinTool {
            id: "diskmgmt".into(),
            name: "Disk Management".into(),
            command: "diskmgmt.msc".into(),
            description: "Partition, format, mount and allocate physical and virtual drives".into(),
            category: "Storage".into(),
            icon_name: "Database".into(),
        },
        WinTool {
            id: "eventvwr".into(),
            name: "Event Viewer".into(),
            command: "eventvwr.msc".into(),
            description: "Inspect Windows Application, System, and Security event logs".into(),
            category: "Diagnostics".into(),
            icon_name: "FileText".into(),
        },
        WinTool {
            id: "resmon".into(),
            name: "Resource Monitor".into(),
            command: "resmon.exe".into(),
            description: "Deep per-process thread, disk queue, and network socket inspection"
                .into(),
            category: "Diagnostics".into(),
            icon_name: "TrendingUp".into(),
        },
        WinTool {
            id: "taskschd".into(),
            name: "Task Scheduler".into(),
            command: "taskschd.msc".into(),
            description: "Automated recurring system scripts and trigger management".into(),
            category: "Administration".into(),
            icon_name: "Clock".into(),
        },
        WinTool {
            id: "msinfo32".into(),
            name: "System Information".into(),
            command: "msinfo32.exe".into(),
            description: "Comprehensive hardware resources, BIOS version, and environment specs"
                .into(),
            category: "System".into(),
            icon_name: "Info".into(),
        },
        WinTool {
            id: "rstrui".into(),
            name: "System Restore GUI".into(),
            command: "rstrui.exe".into(),
            description: "Roll back system state to an earlier restore snapshot".into(),
            category: "Recovery".into(),
            icon_name: "RotateCcw".into(),
        },
        WinTool {
            id: "regedit".into(),
            name: "Registry Editor".into(),
            command: "regedit.exe".into(),
            description: "Windows Registry hive viewer and manual editor".into(),
            category: "Advanced".into(),
            icon_name: "Layers".into(),
        },
        WinTool {
            id: "dxdiag".into(),
            name: "DirectX Diagnostic Tool".into(),
            command: "dxdiag.exe".into(),
            description: "DirectX graphics pipeline, sound devices, and driver validation".into(),
            category: "Hardware".into(),
            icon_name: "Monitor".into(),
        },
    ]
}

pub fn launch_tool(command: &str) -> Result<(), String> {
    // ShellExecuteW opens .msc / .exe / control-panel targets directly, without
    // spawning cmd.exe (which used to flash a console window on every launch).
    winproc::shell_open(command)
}
