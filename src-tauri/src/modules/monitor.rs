use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
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
