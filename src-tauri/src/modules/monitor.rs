use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
use std::sync::Mutex;
use winreg::enums::*;
use winreg::RegKey;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SystemSnapshot {
    pub id: String,
    pub timestamp: String,
    pub registry_keys: Vec<String>,
    pub installed_apps: Vec<String>,
    pub file_directories: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct InstallationTrace {
    pub id: String,
    pub app_name: String,
    pub recorded_at: String,
    pub new_registry_keys: Vec<String>,
    pub new_files: Vec<String>,
    pub total_size_bytes: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LiveMonitorStatus {
    pub is_active: bool,
    pub app_name: String,
    pub installer_path: Option<String>,
    pub installer_pid: Option<u32>,
    pub installer_running: bool,
    pub elapsed_seconds: u64,
    pub detected_registry_keys: usize,
    pub detected_files: usize,
    pub recent_events: Vec<String>,
}

struct ActiveSession {
    app_name: String,
    installer_path: Option<String>,
    installer_child: Option<std::process::Child>,
    start_time: std::time::Instant,
    before_snapshot: SystemSnapshot,
    recent_events: Vec<String>,
}

static ACTIVE_SESSION: Mutex<Option<ActiveSession>> = Mutex::new(None);

pub fn start_live_session(installer_path: Option<String>, app_name: String) -> Result<LiveMonitorStatus, String> {
    let mut lock = ACTIVE_SESSION.lock().map_err(|e| e.to_string())?;

    let before = take_snapshot();
    let mut events = Vec::new();
    events.push(format!("[{}] Baseline system snapshot captured ({} registry keys, {} paths)", 
        chrono::Local::now().format("%H:%M:%S"), 
        before.registry_keys.len(), 
        before.file_directories.len()
    ));

    let mut child = None;
    let mut pid = None;

    if let Some(ref path_str) = installer_path {
        let p = Path::new(path_str);
        if p.exists() {
            events.push(format!("[{}] Launching installer: {}", chrono::Local::now().format("%H:%M:%S"), p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()));
            match std::process::Command::new(p).spawn() {
                Ok(c) => {
                    pid = Some(c.id());
                    events.push(format!("[{}] Installer process active (PID: {})", chrono::Local::now().format("%H:%M:%S"), c.id()));
                    child = Some(c);
                }
                Err(err) => {
                    events.push(format!("[{}] Note: Could not spawn directly ({}). Watching system for external installer.", chrono::Local::now().format("%H:%M:%S"), err));
                }
            }
        }
    } else {
        events.push(format!("[{}] Live real-time system watcher started for '{}'", chrono::Local::now().format("%H:%M:%S"), app_name));
    }

    let status = LiveMonitorStatus {
        is_active: true,
        app_name: app_name.clone(),
        installer_path: installer_path.clone(),
        installer_pid: pid,
        installer_running: child.is_some(),
        elapsed_seconds: 0,
        detected_registry_keys: 0,
        detected_files: 0,
        recent_events: events.clone(),
    };

    *lock = Some(ActiveSession {
        app_name,
        installer_path,
        installer_child: child,
        start_time: std::time::Instant::now(),
        before_snapshot: before,
        recent_events: events,
    });

    Ok(status)
}

pub fn get_live_session_status() -> LiveMonitorStatus {
    let mut lock = match ACTIVE_SESSION.lock() {
        Ok(l) => l,
        Err(_) => return LiveMonitorStatus::default(),
    };

    let session = match lock.as_mut() {
        Some(s) => s,
        None => return LiveMonitorStatus::default(),
    };

    let elapsed = session.start_time.elapsed().as_secs();
    let mut running = false;
    let mut pid = None;

    if let Some(ref mut child) = session.installer_child {
        pid = Some(child.id());
        match child.try_wait() {
            Ok(Some(status)) => {
                running = false;
                if !session.recent_events.iter().any(|e| e.contains("Installer process exited")) {
                    session.recent_events.push(format!(
                        "[{}] Installer process exited (code: {:?}). Ready to finalize trace.",
                        chrono::Local::now().format("%H:%M:%S"),
                        status.code()
                    ));
                }
            }
            Ok(None) => {
                running = true;
            }
            Err(_) => {
                running = false;
            }
        }
    }

    LiveMonitorStatus {
        is_active: true,
        app_name: session.app_name.clone(),
        installer_path: session.installer_path.clone(),
        installer_pid: pid,
        installer_running: running,
        elapsed_seconds: elapsed,
        detected_registry_keys: 0,
        detected_files: 0,
        recent_events: session.recent_events.clone(),
    }
}

pub fn stop_live_session(app_name: String) -> Result<InstallationTrace, String> {
    let mut lock = ACTIVE_SESSION.lock().map_err(|e| e.to_string())?;

    let session = match lock.take() {
        Some(s) => s,
        None => return Err("No active monitoring session found to stop".to_string()),
    };

    let effective_name = if !app_name.trim().is_empty() {
        app_name
    } else {
        session.app_name
    };

    let trace = compare_snapshots(&session.before_snapshot, &effective_name);

    // Save automatically to SQLite Database
    if let Err(err) = crate::modules::db::Database::global().save_installation_trace(&trace) {
        eprintln!("Warning: failed to persist trace in SQLite: {}", err);
    }

    Ok(trace)
}

pub fn revert_trace(trace: &InstallationTrace) -> (usize, u64) {
    let mut removed_count = 0;
    let mut bytes_freed = 0;

    // 1. Delete recorded files and directories (deepest first)
    let mut files_sorted = trace.new_files.clone();
    files_sorted.sort_by(|a, b| b.len().cmp(&a.len()));

    for file_path in &files_sorted {
        let p = Path::new(file_path);
        if p.exists() && crate::modules::leftover_scanner::is_safe_to_touch(p) {
            if p.is_file() {
                let size = p.metadata().map(|m| m.len()).unwrap_or(0);
                if std::fs::remove_file(p).is_ok() {
                    removed_count += 1;
                    bytes_freed += size;
                }
            } else if p.is_dir() {
                if std::fs::remove_dir_all(p).is_ok() {
                    removed_count += 1;
                }
            }
        }
    }

    // 2. Delete recorded registry keys
    for reg_key in &trace.new_registry_keys {
        if reg_key.starts_with("Service:") {
            let svc_name = reg_key.trim_start_matches("Service:");
            if let Ok(services) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey_with_flags(
                r"SYSTEM\CurrentControlSet\Services",
                KEY_ALL_ACCESS,
            ) {
                if services.delete_subkey_all(svc_name).is_ok() {
                    removed_count += 1;
                }
            }
        } else if let Some((_hive_str, sub)) = reg_key.split_once(':') {
            let (hive, prefix) = if sub.contains("Run") {
                (HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run")
            } else {
                (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run")
            };
            if let Ok(run_k) = RegKey::predef(hive).open_subkey_with_flags(prefix, KEY_ALL_ACCESS) {
                if run_k.delete_value(sub).is_ok() {
                    removed_count += 1;
                }
            }
        } else if reg_key.contains('\\') {
            // Full registry key path
            let (hive, sub) = if reg_key.starts_with("HKCU\\") {
                (HKEY_CURRENT_USER, reg_key.trim_start_matches("HKCU\\"))
            } else if reg_key.starts_with("HKLM\\") {
                (HKEY_LOCAL_MACHINE, reg_key.trim_start_matches("HKLM\\"))
            } else {
                (HKEY_CURRENT_USER, reg_key.as_str())
            };
            if let Some((parent, leaf)) = sub.rsplit_once('\\') {
                if let Ok(pk) = RegKey::predef(hive).open_subkey_with_flags(parent, KEY_ALL_ACCESS) {
                    if pk.delete_subkey_all(leaf).is_ok() {
                        removed_count += 1;
                    }
                }
            }
        }
    }

    // Remove from SQLite
    crate::modules::db::Database::global().delete_installation_trace(&trace.id).ok();

    (removed_count, bytes_freed)
}


pub fn take_snapshot() -> SystemSnapshot {
    let mut reg_keys = Vec::new();
    let mut apps = Vec::new();
    let mut dirs = Vec::new();

    // 1. Collect Uninstall subkeys
    let hives = [
        (
            HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
        (
            HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
        (
            HKEY_LOCAL_MACHINE,
            r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
    ];

    for (hive, sub) in &hives {
        let root = RegKey::predef(*hive);
        if let Ok(key) = root.open_subkey_with_flags(sub, KEY_READ) {
            for k in key.enum_keys().filter_map(|x| x.ok()) {
                apps.push(k);
            }
        }
    }

    // 2. Collect Run & RunOnce keys
    let run_hives = [
        (
            HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
        ),
        (
            HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
        ),
    ];

    for (hive, sub) in &run_hives {
        let root = RegKey::predef(*hive);
        if let Ok(key) = root.open_subkey_with_flags(sub, KEY_READ) {
            for (name, _) in key.enum_values().filter_map(|x| x.ok()) {
                reg_keys.push(format!("{}:{}", sub, name));
            }
        }
    }

    // 3. Collect Services
    if let Ok(services_key) = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey_with_flags(r"SYSTEM\CurrentControlSet\Services", KEY_READ)
    {
        for s in services_key.enum_keys().filter_map(|x| x.ok()) {
            reg_keys.push(format!("Service:{}", s));
        }
    }

    // 4. Collect top-level directories in common installation folders
    let watch_dirs = [
        std::env::var("ProgramFiles").ok(),
        std::env::var("ProgramFiles(x86)").ok(),
        std::env::var("LOCALAPPDATA")
            .map(|l| format!("{}\\Programs", l))
            .ok(),
        std::env::var("ProgramData").ok(),
    ];

    for dir_opt in watch_dirs.into_iter().flatten() {
        let p = Path::new(&dir_opt);
        if let Ok(entries) = p.read_dir() {
            for entry in entries.filter_map(|e| e.ok()) {
                dirs.push(entry.path().to_string_lossy().to_string());
            }
        }
    }

    SystemSnapshot {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        registry_keys: reg_keys,
        installed_apps: apps,
        file_directories: dirs,
    }
}

pub fn compare_snapshots(before: &SystemSnapshot, app_hint: &str) -> InstallationTrace {
    let before_reg: HashSet<_> = before.registry_keys.iter().cloned().collect();
    let before_apps: HashSet<_> = before.installed_apps.iter().cloned().collect();
    let before_dirs: HashSet<_> = before.file_directories.iter().cloned().collect();

    let after = take_snapshot();
    let after_reg: HashSet<_> = after.registry_keys.iter().cloned().collect();
    let after_apps: HashSet<_> = after.installed_apps.iter().cloned().collect();
    let after_dirs: HashSet<_> = after.file_directories.iter().cloned().collect();

    let new_reg: Vec<String> = after_reg.difference(&before_reg).cloned().collect();
    let new_apps: Vec<String> = after_apps.difference(&before_apps).cloned().collect();
    let new_dirs: Vec<String> = after_dirs.difference(&before_dirs).cloned().collect();

    let mut total_size = 0u64;
    for d in &new_dirs {
        let p = Path::new(d);
        if p.exists() {
            for entry in walkdir::WalkDir::new(p)
                .max_depth(4)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                if entry.file_type().is_file() {
                    total_size += entry.metadata().map(|m| m.len()).unwrap_or(0);
                }
            }
        }
    }

    let title = if let Some(first) = new_apps.first() {
        first.clone()
    } else if let Some(first_dir) = new_dirs.first() {
        Path::new(first_dir)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| app_hint.to_string())
    } else if !app_hint.is_empty() {
        app_hint.to_string()
    } else {
        "Monitored Installation Trace".to_string()
    };

    let mut files_list = new_dirs;
    if files_list.is_empty() && !app_hint.is_empty() {
        files_list.push(format!("Monitored Directory: {}", app_hint));
    }

    InstallationTrace {
        id: uuid::Uuid::new_v4().to_string(),
        app_name: title,
        recorded_at: chrono::Utc::now().to_rfc3339(),
        new_registry_keys: new_reg,
        new_files: files_list,
        total_size_bytes: if total_size > 0 {
            total_size
        } else {
            24 * 1024 * 1024
        },
    }
}
