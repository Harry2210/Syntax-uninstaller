use serde::{Deserialize, Serialize};
use std::path::Path;
use winreg::enums::*;
use winreg::{RegKey, HKEY};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupItem {
    pub id: String,
    pub name: String,
    pub command: String,
    pub location: String,
    pub user_scope: String,
    pub enabled: bool,
    pub file_exists: bool,
}

pub fn get_startup_entries() -> Vec<StartupItem> {
    let mut items = Vec::new();

    // Registry Run keys
    scan_reg_run(
        HKEY_CURRENT_USER,
        r"Software\Microsoft\Windows\CurrentVersion\Run",
        "HKCU Run",
        "User",
        &mut items,
    );
    scan_reg_run(
        HKEY_LOCAL_MACHINE,
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
        "HKLM Run",
        "All Users",
        &mut items,
    );
    scan_reg_run(
        HKEY_LOCAL_MACHINE,
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run",
        "HKLM (32-bit) Run",
        "All Users",
        &mut items,
    );

    // Startup folders
    if let Ok(appdata) = std::env::var("APPDATA") {
        let p = Path::new(&appdata).join(r"Microsoft\Windows\Start Menu\Programs\Startup");
        scan_folder(&p, "User Startup Folder", "User", &mut items);
    }
    if let Ok(progdata) = std::env::var("PROGRAMDATA") {
        let p = Path::new(&progdata).join(r"Microsoft\Windows\Start Menu\Programs\Startup");
        scan_folder(&p, "Common Startup Folder", "All Users", &mut items);
    }

    items
}

fn scan_reg_run(
    hive: HKEY,
    subpath: &str,
    loc_name: &str,
    scope: &str,
    list: &mut Vec<StartupItem>,
) {
    let root = RegKey::predef(hive);
    if let Ok(key) = root.open_subkey_with_flags(subpath, KEY_READ) {
        for (name, val) in key.enum_values().filter_map(|x| x.ok()) {
            let cmd = val.to_string();
            let clean_cmd = cmd
                .trim_matches('"')
                .split(".exe")
                .next()
                .map(|s| format!("{}.exe", s))
                .unwrap_or_else(|| cmd.clone());
            let exists = Path::new(&clean_cmd).exists();

            list.push(StartupItem {
                id: format!("{}:{}", loc_name, name),
                name,
                command: cmd,
                location: loc_name.to_string(),
                user_scope: scope.to_string(),
                enabled: true,
                file_exists: exists,
            });
        }
    }
}

fn scan_folder(folder: &Path, loc_name: &str, scope: &str, list: &mut Vec<StartupItem>) {
    if !folder.exists() {
        return;
    }
    if let Ok(entries) = std::fs::read_dir(folder) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                let name = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                list.push(StartupItem {
                    id: format!("{}:{}", loc_name, name),
                    name,
                    command: path.to_string_lossy().to_string(),
                    location: loc_name.to_string(),
                    user_scope: scope.to_string(),
                    enabled: true,
                    file_exists: true,
                });
            }
        }
    }
}
