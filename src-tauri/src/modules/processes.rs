use serde::{Deserialize, Serialize};
use std::time::Duration;
use sysinfo::{ProcessesToUpdate, System};

use crate::modules::cache;

const PROCESS_TTL: Duration = Duration::from_millis(1500);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_usage: f32,
    pub memory_mb: u64,
    pub exe_path: String,
}

pub fn get_running_processes() -> Vec<ProcessInfo> {
    // React StrictMode, the dashboard and the process page can request the
    // process table in the same render pass. A 1.5 s cache keeps refreshes
    // feeling live while avoiding duplicate full-system scans.
    cache::cached(
        "processes:list",
        PROCESS_TTL,
        get_running_processes_uncached,
    )
}

fn get_running_processes_uncached() -> Vec<ProcessInfo> {
    let mut s = System::new_all();
    s.refresh_processes(ProcessesToUpdate::All, true);

    let mut list = Vec::new();
    for (pid, process) in s.processes() {
        let mem = process.memory() / (1024 * 1024);
        list.push(ProcessInfo {
            pid: pid.as_u32(),
            name: process.name().to_string_lossy().to_string(),
            cpu_usage: process.cpu_usage(),
            memory_mb: mem,
            exe_path: process
                .exe()
                .map(|e| e.to_string_lossy().to_string())
                .unwrap_or_default(),
        });
    }

    // Sort by memory descending
    list.sort_by(|a, b| b.memory_mb.cmp(&a.memory_mb));
    list
}

pub fn terminate_process(pid: u32) -> Result<(), String> {
    let mut s = System::new_all();
    s.refresh_processes(ProcessesToUpdate::All, true);
    let sys_pid = sysinfo::Pid::from_u32(pid);

    if let Some(process) = s.process(sys_pid) {
        if process.kill() {
            cache::invalidate("processes:");
            Ok(())
        } else {
            Err(format!("Could not terminate process PID {}", pid))
        }
    } else {
        Err(format!("Process PID {} not found", pid))
    }
}
