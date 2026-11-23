use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use winreg::enums::*;
use winreg::RegKey;

#[link(name = "kernel32")]
extern "system" {
    fn MoveFileExW(
        lpExistingFileName: *const u16,
        lpNewFileName: *const u16,
        dwFlags: u32,
    ) -> i32;
    fn SetFileAttributesW(
        lpFileName: *const u16,
        dwFileAttributes: u32,
    ) -> i32;
}

const MOVEFILE_DELAY_UNTIL_REBOOT: u32 = 0x00000004;
const FILE_ATTRIBUTE_NORMAL: u32 = 0x00000080;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeftoverItem {
    pub id: String,
    pub path: String,
    pub item_type: String,  // "RegistryKey", "RegistryValue", "Folder", "File", "Service"
    pub scan_level: String, // "Safe", "Moderate", "Advanced"
    pub confidence: f32,
    pub size_bytes: u64,
    pub reason: String,
    pub is_shared: bool,
    pub eligible_for_deletion: bool,
    pub selected: bool,
}

pub fn scan_application_leftovers(
    app_name: &str,
    publisher: &str,
    install_location: &str,
    scan_level: &str, // "Safe", "Moderate", "Advanced"
) -> Vec<LeftoverItem> {
    let mut findings: Vec<LeftoverItem> = Vec::new();
    let mut seen_paths: HashSet<String> = HashSet::new();

    let tokens = derive_search_tokens(app_name, publisher, install_location);
    let norm_pub = publisher.trim().to_lowercase();

    let is_generic_pub = norm_pub.is_empty()
        || norm_pub.contains("microsoft")
        || norm_pub.contains("google")
        || norm_pub.contains("apple")
        || norm_pub == "unknown publisher";

    // 0. Query SQLite Software Footprint Signature Database
    let footprints = crate::modules::db::Database::global().find_matching_footprints(app_name, publisher);
    for fp in footprints {
        for folder_pattern in &fp.known_folders {
            let expanded = expand_env_vars(folder_pattern);
            let p = Path::new(&expanded);
            if p.exists() && is_safe_to_touch(p) {
                let path_str = p.to_string_lossy().to_string();
                if !seen_paths.contains(&path_str) {
                    seen_paths.insert(path_str.clone());
                    let size = if p.is_dir() { dir_size(p) } else { p.metadata().map(|m| m.len()).unwrap_or(0) };
                    findings.push(LeftoverItem {
                        id: uuid::Uuid::new_v4().to_string(),
                        path: path_str,
                        item_type: if p.is_dir() { "Folder".into() } else { "File".into() },
                        scan_level: "Safe".into(),
                        confidence: 1.0,
                        size_bytes: size,
                        reason: format!("Verified footprint in SQLite Database ({})", fp.app_name),
                        is_shared: false,
                        eligible_for_deletion: true,
                        selected: true,
                    });
                }
            }
        }

        for key_pattern in &fp.known_keys {
            let hives = [
                (HKEY_CURRENT_USER, "HKCU"),
                (HKEY_LOCAL_MACHINE, "HKLM"),
                (HKEY_LOCAL_MACHINE, "HKLM (32-bit)"),
            ];
            for (hive, hive_name) in &hives {
                let actual_sub = if *hive_name == "HKLM (32-bit)" {
                    format!(r"SOFTWARE\WOW6432Node\{}", key_pattern)
                } else {
                    key_pattern.clone()
                };
                if let Ok(_) = RegKey::predef(*hive).open_subkey_with_flags(&actual_sub, KEY_READ) {
                    let reg_path = format!(r"{}\{}", hive_name, actual_sub);
                    if !seen_paths.contains(&reg_path) {
                        seen_paths.insert(reg_path.clone());
                        findings.push(LeftoverItem {
                            id: uuid::Uuid::new_v4().to_string(),
                            path: reg_path,
                            item_type: "RegistryKey".into(),
                            scan_level: "Safe".into(),
                            confidence: 1.0,
                            size_bytes: 0,
                            reason: format!("Verified registry footprint in SQLite Database ({})", fp.app_name),
                            is_shared: false,
                            eligible_for_deletion: true,
                            selected: true,
                        });
                    }
                }
            }
        }
    }

    // 1. Dedicated Install Location (Safe, 1.0 confidence)
    if !install_location.trim().is_empty() {
        let p = Path::new(install_location.trim());
        if p.exists() && is_safe_to_touch(p) {
            let size = dir_size(p);
            let path_str = install_location.to_string();
            if !seen_paths.contains(&path_str) {
                seen_paths.insert(path_str.clone());
                findings.push(LeftoverItem {
                    id: uuid::Uuid::new_v4().to_string(),
                    path: path_str,
                    item_type: if p.is_dir() { "Folder".into() } else { "File".into() },
                    scan_level: "Safe".into(),
                    confidence: 1.0,
                    size_bytes: size,
                    reason: "Remaining installation directory detected after uninstall".into(),
                    is_shared: false,
                    eligible_for_deletion: true,
                    selected: true,
                });
            }
        }
    }

    // 2. Multi-Folder Filesystem Crawler: AppData, LocalAppData, LocalLow, ProgramData, Program Files
    let mut env_roots: Vec<(&str, PathBuf, &str)> = Vec::new();
    if let Ok(appdata) = std::env::var("APPDATA") {
        env_roots.push(("Roaming AppData", PathBuf::from(appdata), "Safe"));
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let local_path = PathBuf::from(&local);
        env_roots.push(("Local AppData", local_path.clone(), "Safe"));
        let locallow = local_path.join(r"..\LocalLow");
        if locallow.exists() {
            env_roots.push(("LocalLow AppData", locallow, "Safe"));
        }
    }
    if let Ok(progdata) = std::env::var("PROGRAMDATA") {
        env_roots.push(("ProgramData", PathBuf::from(progdata), "Safe"));
    }
    if let Ok(progfiles) = std::env::var("ProgramFiles") {
        env_roots.push(("Program Files", PathBuf::from(progfiles), "Safe"));
    }
    if let Ok(progfiles86) = std::env::var("ProgramFiles(x86)") {
        env_roots.push(("Program Files (x86)", PathBuf::from(progfiles86), "Safe"));
    }

    for (label, base_path, default_level) in &env_roots {
        if !base_path.exists() {
            continue;
        }

        for token in &tokens {
            let norm_token = token.to_lowercase();

            // Direct: %ROOT%\<Token>
            let direct_app = base_path.join(token);
            if direct_app.exists() && is_safe_to_touch(&direct_app) {
                let path_str = direct_app.to_string_lossy().to_string();
                if !seen_paths.contains(&path_str) {
                    seen_paths.insert(path_str.clone());
                    let size = dir_size(&direct_app);
                    findings.push(LeftoverItem {
                        id: uuid::Uuid::new_v4().to_string(),
                        path: path_str,
                        item_type: if direct_app.is_dir() { "Folder".into() } else { "File".into() },
                        scan_level: (*default_level).into(),
                        confidence: 0.98,
                        size_bytes: size,
                        reason: format!("Dedicated application cache/data directory in {}", label),
                        is_shared: false,
                        eligible_for_deletion: true,
                        selected: true,
                    });
                }
            }

            // Vendor Subfolder: %ROOT%\<Publisher>\<Token>
            if !is_generic_pub && !publisher.trim().is_empty() {
                let pub_folder = base_path.join(publisher.trim());
                if pub_folder.exists() {
                    let sub_app = pub_folder.join(token);
                    if sub_app.exists() && is_safe_to_touch(&sub_app) {
                        let path_str = sub_app.to_string_lossy().to_string();
                        if !seen_paths.contains(&path_str) {
                            seen_paths.insert(path_str.clone());
                            let size = dir_size(&sub_app);
                            findings.push(LeftoverItem {
                                id: uuid::Uuid::new_v4().to_string(),
                                path: path_str,
                                item_type: "Folder".into(),
                                scan_level: "Safe".into(),
                                confidence: 0.99,
                                size_bytes: size,
                                reason: format!("Application profile directory under vendor path in {}", label),
                                is_shared: false,
                                eligible_for_deletion: true,
                                selected: true,
                            });
                        }
                    }
                }
            }

            // Heuristic directory scan: Match child folders that start with token
            if let Ok(entries) = fs::read_dir(base_path) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let path = entry.path();
                    if path.is_dir() && is_safe_to_touch(&path) {
                        if let Some(folder_name) = path.file_name().and_then(|n| n.to_str()) {
                            let folder_low = folder_name.to_lowercase();
                            if folder_low == norm_token
                                || folder_low.starts_with(&format!("{}_", norm_token))
                                || folder_low.starts_with(&format!("{}-", norm_token))
                            {
                                let path_str = path.to_string_lossy().to_string();
                                if !seen_paths.contains(&path_str) {
                                    seen_paths.insert(path_str.clone());
                                    let size = dir_size(&path);
                                    findings.push(LeftoverItem {
                                        id: uuid::Uuid::new_v4().to_string(),
                                        path: path_str,
                                        item_type: "Folder".into(),
                                        scan_level: "Safe".into(),
                                        confidence: 0.95,
                                        size_bytes: size,
                                        reason: format!("Heuristically matched application folder in {}", label),
                                        is_shared: false,
                                        eligible_for_deletion: true,
                                        selected: true,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // Check Modern Per-User App Folder: %LOCALAPPDATA%\Programs\<Token>
        if *label == "Local AppData" {
            let programs_dir = base_path.join("Programs");
            if programs_dir.exists() {
                for token in &tokens {
                    let prog_path = programs_dir.join(token);
                    if prog_path.exists() && is_safe_to_touch(&prog_path) {
                        let path_str = prog_path.to_string_lossy().to_string();
                        if !seen_paths.contains(&path_str) {
                            seen_paths.insert(path_str.clone());
                            let size = dir_size(&prog_path);
                            findings.push(LeftoverItem {
                                id: uuid::Uuid::new_v4().to_string(),
                                path: path_str,
                                item_type: "Folder".into(),
                                scan_level: "Safe".into(),
                                confidence: 0.99,
                                size_bytes: size,
                                reason: "Per-user application installation directory in LocalAppData\\Programs".into(),
                                is_shared: false,
                                eligible_for_deletion: true,
                                selected: true,
                            });
                        }
                    }
                }
            }
        }
    }

    // 3. UserProfile Dot-Folders (~/.<token> e.g. ~/.android, ~/.vscode)
    if let Ok(user_home) = std::env::var("USERPROFILE") {
        let home_path = PathBuf::from(&user_home);
        for token in &tokens {
            let dot_folder = home_path.join(format!(".{}", token.to_lowercase()));
            if dot_folder.exists() && is_safe_to_touch(&dot_folder) {
                let path_str = dot_folder.to_string_lossy().to_string();
                if !seen_paths.contains(&path_str) {
                    seen_paths.insert(path_str.clone());
                    findings.push(LeftoverItem {
                        id: uuid::Uuid::new_v4().to_string(),
                        path: path_str,
                        item_type: "Folder".into(),
                        scan_level: "Moderate".into(),
                        confidence: 0.93,
                        size_bytes: dir_size(&dot_folder),
                        reason: "User profile developer/configuration dot-folder".into(),
                        is_shared: false,
                        eligible_for_deletion: true,
                        selected: scan_level != "Safe",
                    });
                }
            }
        }
    }

    // 4. Start Menu Shortcuts & Folders Crawler
    let start_menu_roots = [
        std::env::var("APPDATA")
            .map(|a| PathBuf::from(a).join(r"Microsoft\Windows\Start Menu\Programs")),
        std::env::var("PROGRAMDATA")
            .map(|p| PathBuf::from(p).join(r"Microsoft\Windows\Start Menu\Programs")),
    ];

    for root_res in start_menu_roots {
        if let Ok(root) = root_res {
            if root.exists() {
                for token in &tokens {
                    // Check folder: Start Menu\Programs\<Token>
                    let token_folder = root.join(token);
                    if token_folder.exists() && is_safe_to_touch(&token_folder) {
                        let path_str = token_folder.to_string_lossy().to_string();
                        if !seen_paths.contains(&path_str) {
                            seen_paths.insert(path_str.clone());
                            findings.push(LeftoverItem {
                                id: uuid::Uuid::new_v4().to_string(),
                                path: path_str,
                                item_type: "Folder".into(),
                                scan_level: "Safe".into(),
                                confidence: 0.99,
                                size_bytes: dir_size(&token_folder),
                                reason: "Orphaned application folder in Start Menu".into(),
                                is_shared: false,
                                eligible_for_deletion: true,
                                selected: true,
                            });
                        }
                    }

                    // Check single shortcut: Start Menu\Programs\<Token>.lnk
                    let token_lnk = root.join(format!("{}.lnk", token));
                    if token_lnk.exists() {
                        let path_str = token_lnk.to_string_lossy().to_string();
                        if !seen_paths.contains(&path_str) {
                            seen_paths.insert(path_str.clone());
                            findings.push(LeftoverItem {
                                id: uuid::Uuid::new_v4().to_string(),
                                path: path_str,
                                item_type: "File".into(),
                                scan_level: "Safe".into(),
                                confidence: 0.99,
                                size_bytes: 4096,
                                reason: "Orphaned application Start Menu shortcut (.lnk)".into(),
                                is_shared: false,
                                eligible_for_deletion: true,
                                selected: true,
                            });
                        }
                    }
                }
            }
        }
    }

    // 5. Desktop Shortcuts Crawler (User & Public)
    let desktop_dirs = [
        std::env::var("USERPROFILE").map(|u| PathBuf::from(u).join("Desktop")),
        std::env::var("PUBLIC").map(|p| PathBuf::from(p).join("Desktop")),
    ];

    for d_res in desktop_dirs {
        if let Ok(desktop) = d_res {
            if desktop.exists() {
                for token in &tokens {
                    let shortcut = desktop.join(format!("{}.lnk", token));
                    if shortcut.exists() {
                        let path_str = shortcut.to_string_lossy().to_string();
                        if !seen_paths.contains(&path_str) {
                            seen_paths.insert(path_str.clone());
                            findings.push(LeftoverItem {
                                id: uuid::Uuid::new_v4().to_string(),
                                path: path_str,
                                item_type: "File".into(),
                                scan_level: "Safe".into(),
                                confidence: 0.99,
                                size_bytes: 4096,
                                reason: "Orphaned Desktop application shortcut (.lnk)".into(),
                                is_shared: false,
                                eligible_for_deletion: true,
                                selected: true,
                            });
                        }
                    }
                }
            }
        }
    }

    // 6. Prefetch Crawler (C:\Windows\Prefetch\<TOKEN>*.pf)
    let prefetch_dir = PathBuf::from(r"C:\Windows\Prefetch");
    if prefetch_dir.exists() {
        if let Ok(entries) = fs::read_dir(&prefetch_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    let file_low = file_name.to_lowercase();
                    if file_low.ends_with(".pf") {
                        for token in &tokens {
                            let tok_low = token.to_lowercase();
                            if file_low.starts_with(&tok_low) {
                                let path_str = path.to_string_lossy().to_string();
                                if !seen_paths.contains(&path_str) {
                                    seen_paths.insert(path_str.clone());
                                    let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                                    findings.push(LeftoverItem {
                                        id: uuid::Uuid::new_v4().to_string(),
                                        path: path_str,
                                        item_type: "File".into(),
                                        scan_level: "Moderate".into(),
                                        confidence: 0.95,
                                        size_bytes: size,
                                        reason: "Windows execution trace prefetch file (.pf)".into(),
                                        is_shared: false,
                                        eligible_for_deletion: true,
                                        selected: scan_level != "Safe",
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 7. Application CrashDumps
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let dumps_dir = PathBuf::from(&local).join("CrashDumps");
        if dumps_dir.exists() {
            if let Ok(entries) = fs::read_dir(&dumps_dir) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let path = entry.path();
                    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                        let file_low = file_name.to_lowercase();
                        for token in &tokens {
                            if file_low.starts_with(&token.to_lowercase())
                                && file_low.ends_with(".dmp")
                            {
                                let path_str = path.to_string_lossy().to_string();
                                if !seen_paths.contains(&path_str) {
                                    seen_paths.insert(path_str.clone());
                                    let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                                    findings.push(LeftoverItem {
                                        id: uuid::Uuid::new_v4().to_string(),
                                        path: path_str,
                                        item_type: "File".into(),
                                        scan_level: "Safe".into(),
                                        confidence: 0.98,
                                        size_bytes: size,
                                        reason: "Orphaned application crash memory dump file (.dmp)".into(),
                                        is_shared: false,
                                        eligible_for_deletion: true,
                                        selected: true,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 8. Deep Registry Hive Sweep (HKCU, HKLM, HKLM 32-bit)
    let hives = [
        (HKEY_CURRENT_USER, "HKCU", r"Software"),
        (HKEY_LOCAL_MACHINE, "HKLM", r"SOFTWARE"),
        (HKEY_LOCAL_MACHINE, "HKLM (32-bit)", r"SOFTWARE\WOW6432Node"),
    ];

    for (hive, hive_name, subpath) in &hives {
        let reg = RegKey::predef(*hive);
        if let Ok(software) = reg.open_subkey_with_flags(subpath, KEY_READ) {
            for token in &tokens {
                // Direct: Software\<Token>
                if let Ok(_) = software.open_subkey_with_flags(token, KEY_READ) {
                    let reg_path = format!(r"{}\{}\{}", hive_name, subpath, token);
                    if !seen_paths.contains(&reg_path) {
                        seen_paths.insert(reg_path.clone());
                        findings.push(LeftoverItem {
                            id: uuid::Uuid::new_v4().to_string(),
                            path: reg_path,
                            item_type: "RegistryKey".into(),
                            scan_level: "Safe".into(),
                            confidence: 0.96,
                            size_bytes: 0,
                            reason: "Orphaned application registry configuration tree".into(),
                            is_shared: false,
                            eligible_for_deletion: true,
                            selected: true,
                        });
                    }
                }

                // Vendor: Software\<Publisher>\<Token>
                if !is_generic_pub && !publisher.trim().is_empty() {
                    if let Ok(pub_key) = software.open_subkey_with_flags(publisher.trim(), KEY_READ) {
                        if let Ok(_) = pub_key.open_subkey_with_flags(token, KEY_READ) {
                            let reg_path = format!(
                                r"{}\{}\{}\{}",
                                hive_name,
                                subpath,
                                publisher.trim(),
                                token
                            );
                            if !seen_paths.contains(&reg_path) {
                                seen_paths.insert(reg_path.clone());
                                findings.push(LeftoverItem {
                                    id: uuid::Uuid::new_v4().to_string(),
                                    path: reg_path,
                                    item_type: "RegistryKey".into(),
                                    scan_level: "Safe".into(),
                                    confidence: 0.98,
                                    size_bytes: 0,
                                    reason: "Orphaned vendor subkey in Windows registry".into(),
                                    is_shared: false,
                                    eligible_for_deletion: true,
                                    selected: true,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // 9. Registry App Paths Execution Redirects (HKLM & HKCU)
    let app_paths_hives = [
        (HKEY_LOCAL_MACHINE, "HKLM"),
        (HKEY_CURRENT_USER, "HKCU"),
    ];
    for (hive, hive_name) in &app_paths_hives {
        if let Ok(paths_key) = RegKey::predef(*hive).open_subkey_with_flags(
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths",
            KEY_READ,
        ) {
            for token in &tokens {
                let exe_key = format!("{}.exe", token);
                if let Ok(_) = paths_key.open_subkey_with_flags(&exe_key, KEY_READ) {
                    let reg_path = format!(
                        r"{}\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\{}",
                        hive_name, exe_key
                    );
                    if !seen_paths.contains(&reg_path) {
                        seen_paths.insert(reg_path.clone());
                        findings.push(LeftoverItem {
                            id: uuid::Uuid::new_v4().to_string(),
                            path: reg_path,
                            item_type: "RegistryKey".into(),
                            scan_level: "Moderate".into(),
                            confidence: 0.95,
                            size_bytes: 0,
                            reason: "Registered Windows App Path execution redirect".into(),
                            is_shared: false,
                            eligible_for_deletion: true,
                            selected: scan_level != "Safe",
                        });
                    }
                }
            }
        }
    }

    // 10. Auto-Run Startup Registry Values (Run & RunOnce)
    let run_hives = [
        (HKEY_CURRENT_USER, "HKCU", r"Software\Microsoft\Windows\CurrentVersion\Run"),
        (HKEY_LOCAL_MACHINE, "HKLM", r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"),
        (HKEY_LOCAL_MACHINE, "HKLM", r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run"),
    ];

    for (hive, hive_name, subpath) in &run_hives {
        if let Ok(run_key) = RegKey::predef(*hive).open_subkey_with_flags(subpath, KEY_READ) {
            for (val_name, val_data) in run_key.enum_values().filter_map(|x| x.ok()) {
                let data_str = val_data.to_string().to_lowercase();
                let name_low = val_name.to_lowercase();

                let matched = tokens.iter().any(|token| {
                    let tok_low = token.to_lowercase();
                    name_low.contains(&tok_low) || data_str.contains(&tok_low)
                });

                if matched {
                    let reg_path = format!(r"{}\{}\{}", hive_name, subpath, val_name);
                    if !seen_paths.contains(&reg_path) {
                        seen_paths.insert(reg_path.clone());
                        findings.push(LeftoverItem {
                            id: uuid::Uuid::new_v4().to_string(),
                            path: reg_path,
                            item_type: "RegistryValue".into(),
                            scan_level: "Moderate".into(),
                            confidence: 0.94,
                            size_bytes: 0,
                            reason: "Lingering auto-start value in Windows Run registry key".into(),
                            is_shared: false,
                            eligible_for_deletion: true,
                            selected: scan_level != "Safe",
                        });
                    }
                }
            }
        }
    }

    // 11. Orphaned Windows Services Sweep (HKLM\SYSTEM\CurrentControlSet\Services)
    if let Ok(services_key) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey_with_flags(
        r"SYSTEM\CurrentControlSet\Services",
        KEY_READ,
    ) {
        for s_name in services_key.enum_keys().filter_map(|x| x.ok()) {
            if let Ok(sk) = services_key.open_subkey_with_flags(&s_name, KEY_READ) {
                let image_path: String = sk.get_value("ImagePath").unwrap_or_default();
                let image_low = image_path.to_lowercase();
                let s_name_low = s_name.to_lowercase();

                let matched = tokens.iter().any(|token| {
                    let tok_low = token.to_lowercase();
                    s_name_low.contains(&tok_low) || (!image_low.is_empty() && image_low.contains(&tok_low))
                });

                if matched && !s_name_low.starts_with("ms") && !s_name_low.starts_with("win") {
                    let reg_path = format!(r"HKLM\SYSTEM\CurrentControlSet\Services\{}", s_name);
                    if !seen_paths.contains(&reg_path) {
                        seen_paths.insert(reg_path.clone());
                        findings.push(LeftoverItem {
                            id: uuid::Uuid::new_v4().to_string(),
                            path: reg_path,
                            item_type: "RegistryKey".into(),
                            scan_level: "Moderate".into(),
                            confidence: 0.93,
                            size_bytes: 0,
                            reason: format!("Orphaned Windows background service ({})", s_name),
                            is_shared: false,
                            eligible_for_deletion: true,
                            selected: scan_level != "Safe",
                        });
                    }
                }
            }
        }
    }

    // 12. Orphaned Uninstall Registry Keys
    let uninstall_hives = [
        (HKEY_LOCAL_MACHINE, "HKLM", r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_LOCAL_MACHINE, "HKLM (32-bit)", r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_CURRENT_USER, "HKCU", r"Software\Microsoft\Windows\CurrentVersion\Uninstall"),
    ];

    for (hive, hive_name, subpath) in &uninstall_hives {
        if let Ok(uninst_key) = RegKey::predef(*hive).open_subkey_with_flags(subpath, KEY_READ) {
            for entry_name in uninst_key.enum_keys().filter_map(|x| x.ok()) {
                let entry_low = entry_name.to_lowercase();
                for token in &tokens {
                    let tok_low = token.to_lowercase();
                    if entry_low == tok_low || entry_low.starts_with(&format!("{}_", tok_low)) {
                        let reg_path = format!(r"{}\{}\{}", hive_name, subpath, entry_name);
                        if !seen_paths.contains(&reg_path) {
                            seen_paths.insert(reg_path.clone());
                            findings.push(LeftoverItem {
                                id: uuid::Uuid::new_v4().to_string(),
                                path: reg_path,
                                item_type: "RegistryKey".into(),
                                scan_level: "Safe".into(),
                                confidence: 0.99,
                                size_bytes: 0,
                                reason: "Orphaned uninstallation registry entry".into(),
                                is_shared: false,
                                eligible_for_deletion: true,
                                selected: true,
                            });
                        }
                    }
                }
            }
        }
    }

    // 13. Aggressive Forensic Sweep: COM CLSID, Shell Handlers, Driver Services
    if scan_level == "Aggressive" || scan_level == "Forensic" || scan_level.is_empty() {
        // A. Shell Context Menu Handlers (HKLM & HKCU)
        let shell_roots = [
            (HKEY_LOCAL_MACHINE, "HKLM", r"SOFTWARE\Classes\*\shellex\ContextMenuHandlers"),
            (HKEY_LOCAL_MACHINE, "HKLM", r"SOFTWARE\Classes\Directory\shellex\ContextMenuHandlers"),
            (HKEY_CURRENT_USER, "HKCU", r"Software\Classes\*\shellex\ContextMenuHandlers"),
        ];

        for (hive, hive_name, subpath) in &shell_roots {
            if let Ok(shellex_key) = RegKey::predef(*hive).open_subkey_with_flags(subpath, KEY_READ) {
                for handler_name in shellex_key.enum_keys().filter_map(|x| x.ok()) {
                    let h_low = handler_name.to_lowercase();
                    let matched = tokens.iter().any(|t| h_low.contains(&t.to_lowercase()));
                    if matched {
                        let reg_path = format!(r"{}\{}\{}", hive_name, subpath, handler_name);
                        if !seen_paths.contains(&reg_path) {
                            seen_paths.insert(reg_path.clone());
                            findings.push(LeftoverItem {
                                id: uuid::Uuid::new_v4().to_string(),
                                path: reg_path,
                                item_type: "RegistryKey".into(),
                                scan_level: "Aggressive".into(),
                                confidence: 0.91,
                                size_bytes: 0,
                                reason: "Explorer Shell Context Menu Handler extension".into(),
                                is_shared: false,
                                eligible_for_deletion: true,
                                selected: true,
                            });
                        }
                    }
                }
            }
        }

        // B. COM Class Registration (CLSID) InprocServer32 checking install location
        if !install_location.trim().is_empty() {
            let inst_low = install_location.to_lowercase();
            if let Ok(clsid_key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(
                r"Software\Classes\CLSID",
                KEY_READ,
            ) {
                for clsid in clsid_key.enum_keys().filter_map(|x| x.ok()).take(200) {
                    if let Ok(inproc) = clsid_key.open_subkey_with_flags(&format!(r"{}\InprocServer32", clsid), KEY_READ) {
                        let path_val: String = inproc.get_value("").unwrap_or_default();
                        if !path_val.is_empty() && path_val.to_lowercase().contains(&inst_low) {
                            let reg_path = format!(r"HKCU\Software\Classes\CLSID\{}", clsid);
                            if !seen_paths.contains(&reg_path) {
                                seen_paths.insert(reg_path.clone());
                                findings.push(LeftoverItem {
                                    id: uuid::Uuid::new_v4().to_string(),
                                    path: reg_path,
                                    item_type: "RegistryKey".into(),
                                    scan_level: "Aggressive".into(),
                                    confidence: 0.94,
                                    size_bytes: 0,
                                    reason: "Orphaned COM/ActiveX Class Object (CLSID)".into(),
                                    is_shared: false,
                                    eligible_for_deletion: true,
                                    selected: true,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // Filter by scan level if requested
    match scan_level {
        "Safe" => findings
            .into_iter()
            .filter(|f| f.scan_level == "Safe")
            .collect(),
        "Moderate" => findings
            .into_iter()
            .filter(|f| f.scan_level == "Safe" || f.scan_level == "Moderate")
            .collect(),
        "Advanced" => findings
            .into_iter()
            .filter(|f| f.scan_level == "Safe" || f.scan_level == "Moderate" || f.scan_level == "Advanced")
            .collect(),
        _ => findings, // "Aggressive" / "Forensic" returns all four tiers (Safe, Moderate, Advanced, Aggressive)
    }
}

fn expand_env_vars(raw: &str) -> String {
    let mut out = raw.to_string();
    let vars = [
        ("APPDATA", std::env::var("APPDATA").unwrap_or_default()),
        ("LOCALAPPDATA", std::env::var("LOCALAPPDATA").unwrap_or_default()),
        ("PROGRAMFILES(X86)", std::env::var("ProgramFiles(x86)").unwrap_or_default()),
        ("PROGRAMFILES", std::env::var("ProgramFiles").unwrap_or_default()),
        ("PROGRAMDATA", std::env::var("ProgramData").unwrap_or_default()),
        ("USERPROFILE", std::env::var("USERPROFILE").unwrap_or_default()),
        ("WINDIR", std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".to_string())),
    ];

    for (k, v) in &vars {
        if !v.is_empty() {
            out = out.replace(&format!("%{}%", k), v);
        }
    }
    out
}

/// Tokenizer that derives clean, search-ready product identifiers
fn derive_search_tokens(app_name: &str, _publisher: &str, install_location: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut seen = HashSet::new();

    let mut add_token = |t: String| {
        let clean = t.trim().to_string();
        if clean.len() >= 2
            && !clean.eq_ignore_ascii_case("microsoft")
            && !clean.eq_ignore_ascii_case("windows")
        {
            let lower = clean.to_lowercase();
            if !seen.contains(&lower) {
                seen.insert(lower);
                tokens.push(clean);
            }
        }
    };

    let base_name = app_name
        .replace("(x86)", "")
        .replace("(x64)", "")
        .replace("(64-bit)", "")
        .replace("(32-bit)", "");

    // 1. Full cleaned name
    add_token(base_name.trim().to_string());

    // 2. Tokenize words, stripping version strings
    for word in base_name.split_whitespace() {
        let is_version = word.chars().any(|c| c.is_ascii_digit()) && word.contains('.');
        if !is_version && word.len() >= 3 {
            add_token(word.to_string());
        }
    }

    // 3. Name without spaces
    let nospace = base_name.replace(' ', "");
    if nospace.len() >= 3 {
        add_token(nospace);
    }

    // 4. Install folder name if available
    if !install_location.trim().is_empty() {
        if let Some(folder_name) = Path::new(install_location.trim()).file_name() {
            add_token(folder_name.to_string_lossy().to_string());
        }
    }

    tokens
}

/// Defensive safety barrier: prevents critical Windows system paths from ever being flagged
pub fn is_safe_to_touch(path: &Path) -> bool {
    let norm = path.to_string_lossy().to_lowercase().replace('/', "\\");

    let forbidden_exact = [
        "c:\\",
        "c:\\windows",
        "c:\\windows\\system32",
        "c:\\windows\\syswow64",
        "c:\\windows\\winsxs",
        "c:\\program files",
        "c:\\program files (x86)",
        "c:\\programdata",
        "c:\\users",
    ];

    for f in &forbidden_exact {
        if norm == *f || norm == format!("{}\\", f) {
            return false;
        }
    }

    let forbidden_prefixes = [
        "c:\\windows\\system32",
        "c:\\windows\\syswow64",
        "c:\\windows\\winsxs",
        "c:\\program files\\windowsapps",
        "c:\\program files\\common files",
        "c:\\program files (x86)\\common files",
        "c:\\programdata\\microsoft",
    ];

    for f in &forbidden_prefixes {
        if norm.starts_with(f) {
            return false;
        }
    }

    // Reject bare user profile roots
    if let Ok(user) = std::env::var("USERPROFILE") {
        let user_norm = user.to_lowercase();
        if norm == user_norm
            || norm == format!("{}\\desktop", user_norm)
            || norm == format!("{}\\documents", user_norm)
        {
            return false;
        }
    }

    true
}

fn dir_size(path: &Path) -> u64 {
    if path.is_file() {
        return path.metadata().map(|m| m.len()).unwrap_or(0);
    }

    let mut total = 0u64;
    for entry in walkdir::WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    total
}

/// Force-deletes a single file. If locked by Windows or in use by another process,
/// strips attributes and registers it for kernel-level deletion on reboot using Win32 MoveFileExW.
fn force_delete_file_or_schedule(path: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        SetFileAttributesW(wide.as_ptr(), FILE_ATTRIBUTE_NORMAL);
    }

    if fs::remove_file(path).is_ok() {
        return Ok(());
    }

    // If immediate delete fails, schedule for kernel deletion on next reboot (Revo / IObit mechanism)
    let res = unsafe {
        MoveFileExW(wide.as_ptr(), std::ptr::null(), MOVEFILE_DELAY_UNTIL_REBOOT)
    };

    if res != 0 {
        Ok(())
    } else {
        Err(format!("Could not remove or schedule file '{}'", path.display()))
    }
}

/// Force-deletes a directory. If in use or containing locked files, recursively strips attributes,
/// deletes what can be removed now, and registers the remaining locked files and the directory itself
/// for deletion upon reboot using Win32 MoveFileExW.
fn force_delete_folder_or_schedule(dir: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;

    // Fast path: try normal directory removal
    if fs::remove_dir_all(dir).is_ok() {
        return Ok(());
    }

    // Robust path: walk contents and force-delete or schedule each file and subdirectory
    for entry in walkdir::WalkDir::new(dir)
        .contents_first(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let p = entry.path();
        let wide: Vec<u16> = p
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        unsafe {
            SetFileAttributesW(wide.as_ptr(), FILE_ATTRIBUTE_NORMAL);
        }

        if p.is_file() {
            if fs::remove_file(p).is_err() {
                unsafe {
                    MoveFileExW(wide.as_ptr(), std::ptr::null(), MOVEFILE_DELAY_UNTIL_REBOOT);
                }
            }
        } else if p.is_dir() {
            if fs::remove_dir(p).is_err() {
                unsafe {
                    MoveFileExW(wide.as_ptr(), std::ptr::null(), MOVEFILE_DELAY_UNTIL_REBOOT);
                }
            }
        }
    }

    // Schedule root directory itself if still exists
    if dir.exists() {
        let dir_wide: Vec<u16> = dir
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        unsafe {
            SetFileAttributesW(dir_wide.as_ptr(), FILE_ATTRIBUTE_NORMAL);
            if fs::remove_dir_all(dir).is_err() {
                MoveFileExW(dir_wide.as_ptr(), std::ptr::null(), MOVEFILE_DELAY_UNTIL_REBOOT);
            }
        }
    }

    Ok(())
}

pub fn remove_leftovers_safely(items: &[LeftoverItem]) -> (usize, u64, Vec<String>) {
    let mut deleted_count = 0;
    let mut freed_bytes = 0u64;
    let mut errors = Vec::new();

    for item in items {
        if !item.selected || !item.eligible_for_deletion {
            continue;
        }

        match item.item_type.as_str() {
            "Folder" => {
                let p = Path::new(&item.path);
                if p.exists() && is_safe_to_touch(p) {
                    match force_delete_folder_or_schedule(p) {
                        Ok(_) => {
                            deleted_count += 1;
                            freed_bytes += item.size_bytes;
                        }
                        Err(e) => errors.push(format!("Folder '{}': {}", item.path, e)),
                    }
                }
            }
            "File" => {
                let p = Path::new(&item.path);
                if p.exists() && is_safe_to_touch(p) {
                    match force_delete_file_or_schedule(p) {
                        Ok(_) => {
                            deleted_count += 1;
                            freed_bytes += item.size_bytes;
                        }
                        Err(e) => errors.push(format!("File '{}': {}", item.path, e)),
                    }
                }
            }
            "RegistryKey" => {
                if let Err(e) = delete_registry_key_by_path(&item.path) {
                    errors.push(format!("Registry Key '{}': {}", item.path, e));
                } else {
                    deleted_count += 1;
                }
            }
            "RegistryValue" => {
                if let Err(e) = delete_registry_value_by_path(&item.path) {
                    errors.push(format!("Registry Value '{}': {}", item.path, e));
                } else {
                    deleted_count += 1;
                }
            }
            _ => {}
        }
    }

    (deleted_count, freed_bytes, errors)
}

fn delete_registry_key_by_path(path: &str) -> Result<(), String> {
    let (hive_predef, subkey) = parse_hive_path(path)?;
    let last_slash = subkey
        .rfind('\\')
        .ok_or_else(|| "Invalid registry path".to_string())?;
    let parent_path = &subkey[..last_slash];
    let key_to_delete = &subkey[last_slash + 1..];

    let parent_key = RegKey::predef(hive_predef)
        .open_subkey_with_flags(parent_path, KEY_WRITE)
        .map_err(|e| format!("Cannot open parent key '{}': {}", parent_path, e))?;

    parent_key
        .delete_subkey_all(key_to_delete)
        .map_err(|e| format!("Failed to delete subkey '{}': {}", key_to_delete, e))
}

fn delete_registry_value_by_path(path: &str) -> Result<(), String> {
    let (hive_predef, subkey) = parse_hive_path(path)?;
    let last_slash = subkey
        .rfind('\\')
        .ok_or_else(|| "Invalid registry path".to_string())?;
    let parent_path = &subkey[..last_slash];
    let value_name = &subkey[last_slash + 1..];

    let parent_key = RegKey::predef(hive_predef)
        .open_subkey_with_flags(parent_path, KEY_SET_VALUE)
        .map_err(|e| format!("Cannot open parent key '{}': {}", parent_path, e))?;

    parent_key
        .delete_value(value_name)
        .map_err(|e| format!("Failed to delete value '{}': {}", value_name, e))
}

fn parse_hive_path(path: &str) -> Result<(winreg::HKEY, String), String> {
    if path.starts_with(r"HKCU\") {
        Ok((HKEY_CURRENT_USER, path[5..].to_string()))
    } else if path.starts_with(r"HKLM\SOFTWARE\WOW6432Node\") {
        Ok((HKEY_LOCAL_MACHINE, path[5..].to_string()))
    } else if path.starts_with(r"HKLM (32-bit)\") {
        Ok((HKEY_LOCAL_MACHINE, path[14..].to_string()))
    } else if path.starts_with(r"HKLM\") {
        Ok((HKEY_LOCAL_MACHINE, path[5..].to_string()))
    } else {
        Err(format!("Unsupported hive in path '{}'", path))
    }
}
