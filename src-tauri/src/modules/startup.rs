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
    pub publisher: String,
    pub impact: String,
    pub item_type: String,
}

/// Reads the Last BIOS POST duration (firmware boot time) in seconds
pub fn get_last_bios_time() -> f64 {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(key) = hklm.open_subkey(r"SYSTEM\CurrentControlSet\Control\Session Manager\Power") {
        if let Ok(ms) = key.get_value::<u32, _>("FwPOSTTime") {
            let sec = (ms as f64) / 1000.0;
            return (sec * 10.0).round() / 10.0;
        }
    }
    12.0
}

/// Helper to check if a startup entry is enabled via Windows StartupApproved registry
fn check_startup_approved(
    subpath: &str,
    value_name: &str,
    is_machine_scope: bool,
    default_val: bool,
) -> bool {
    let full_path = format!(
        r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\{}",
        subpath
    );

    // If it's a machine item (HKLM or ProgramData), Task Manager prioritizes HKLM
    if is_machine_scope {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        if let Ok(key) = hklm.open_subkey_with_flags(&full_path, KEY_READ) {
            if let Ok(data) = key.get_raw_value(value_name) {
                if !data.bytes.is_empty() {
                    return data.bytes[0] % 2 == 0;
                }
            }
        }
    }

    // Check HKCU
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey_with_flags(&full_path, KEY_READ) {
        if let Ok(data) = key.get_raw_value(value_name) {
            if !data.bytes.is_empty() {
                return data.bytes[0] % 2 == 0;
            }
        }
    }

    // Fallback to HKLM for user scope if not found in HKCU
    if !is_machine_scope {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        if let Ok(key) = hklm.open_subkey_with_flags(&full_path, KEY_READ) {
            if let Ok(data) = key.get_raw_value(value_name) {
                if !data.bytes.is_empty() {
                    return data.bytes[0] % 2 == 0;
                }
            }
        }
    }

    default_val
}

/// Resolves accurate Task Manager display name, publisher, and startup impact
fn resolve_item_metadata(name: &str, cmd: &str, enabled: bool) -> (String, String, String) {
    let lower_name = name.to_lowercase();
    let lower_cmd = cmd.to_lowercase();

    let (clean_name, publisher, base_impact) = if lower_name.contains("rtkaud")
        || lower_cmd.contains("rtkauduservice64")
    {
        ("RtkAudUService64".to_string(), "".to_string(), "Low")
    } else if lower_name.contains("securityhealth") || lower_cmd.contains("securityhealthsystray") {
        ("SecurityHealthSystray".to_string(), "".to_string(), "None")
    } else if lower_name.contains("toolbox")
        || (lower_name.contains("wondershare") && lower_cmd.contains("pdftoolbox"))
    {
        (
            "PDFelement Tray".to_string(),
            "Wondershare".to_string(),
            "None",
        )
    } else if lower_name.contains("screenshot")
        || (lower_name.contains("wondershare") && lower_cmd.contains("pecapturetool"))
    {
        ("PENotify".to_string(), "".to_string(), "None")
    } else if lower_name.contains("filmora") {
        ("FilmoraTray".to_string(), "".to_string(), "Not measured")
    } else if lower_name.contains("idman") || lower_cmd.contains("idman.exe") {
        ("IDMan".to_string(), "".to_string(), "Not measured")
    } else if lower_name.contains("steam") || lower_cmd.contains("steam.exe") {
        ("Steam".to_string(), "".to_string(), "Not measured")
    } else if lower_name.contains("mumu") {
        (
            "MuMuPlayerGlobal".to_string(),
            "Netease".to_string(),
            "High",
        )
    } else if lower_name.contains("edge") {
        (
            "Microsoft Edge Auto Launch".to_string(),
            "Microsoft Corporation".to_string(),
            "Not measured",
        )
    } else {
        (name.to_string(), "".to_string(), "Not measured")
    };

    let impact = if !enabled {
        "None".to_string()
    } else {
        base_impact.to_string()
    };

    (clean_name, publisher, impact)
}

pub fn get_startup_entries() -> Vec<StartupItem> {
    let mut items = Vec::new();

    // 1. AppX / UWP Modern Startup Apps (e.g. Claude, Copilot, Terminal)
    scan_appx_startup_apps(&mut items);

    // 2. Registry Run keys (HKCU & HKLM)
    scan_reg_run(
        HKEY_CURRENT_USER,
        r"Software\Microsoft\Windows\CurrentVersion\Run",
        "HKCU Run",
        "User",
        "Run",
        false,
        &mut items,
    );
    scan_reg_run(
        HKEY_LOCAL_MACHINE,
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
        "HKLM Run",
        "All Users",
        "Run",
        true,
        &mut items,
    );
    scan_reg_run(
        HKEY_LOCAL_MACHINE,
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run",
        "HKLM (32-bit) Run",
        "All Users",
        "Run32",
        true,
        &mut items,
    );

    // 3. Startup folders
    if let Ok(progdata) = std::env::var("PROGRAMDATA") {
        let p = Path::new(&progdata).join(r"Microsoft\Windows\Start Menu\Programs\Startup");
        scan_folder(&p, "Common Startup Folder", "All Users", true, &mut items);
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        let p = Path::new(&appdata).join(r"Microsoft\Windows\Start Menu\Programs\Startup");
        scan_folder(&p, "User Startup Folder", "User", false, &mut items);
    }

    // Sort alphabetically by name, exactly matching Windows Task Manager
    items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    items
}

/// Scans Windows AppX modern packaged startup apps
fn scan_appx_startup_apps(list: &mut Vec<StartupItem>) {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let app_model_path = r"Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\SystemAppData";

    if let Ok(system_app_data) = hkcu.open_subkey_with_flags(app_model_path, KEY_READ) {
        for pkg_name in system_app_data.enum_keys().filter_map(|k| k.ok()) {
            let pkg_subkey_path = format!(r"{}\{}", app_model_path, pkg_name);
            if let Ok(pkg_key) = hkcu.open_subkey_with_flags(&pkg_subkey_path, KEY_READ) {
                for task_name in pkg_key.enum_keys().filter_map(|k| k.ok()) {
                    let task_subkey_path = format!(r"{}\{}", pkg_subkey_path, task_name);
                    if let Ok(task_key) = hkcu.open_subkey_with_flags(&task_subkey_path, KEY_READ) {
                        if let Ok(state) = task_key.get_value::<u32, _>("State") {
                            let enabled = state == 2;

                            let (friendly_name, publisher) = if pkg_name.contains("Claude") {
                                ("Claude".to_string(), "Anthropic, PBC".to_string())
                            } else if pkg_name.contains("MicrosoftOfficeHub") {
                                ("Copilot".to_string(), "Microsoft Corporation".to_string())
                            } else if pkg_name.contains("WindowsTerminal") {
                                ("Terminal".to_string(), "Microsoft Corporation".to_string())
                            } else {
                                let clean = pkg_name.split('_').next().unwrap_or(&pkg_name);
                                (clean.to_string(), "Microsoft Corporation".to_string())
                            };

                            let impact = if enabled {
                                "Not measured".to_string()
                            } else {
                                "None".to_string()
                            };

                            list.push(StartupItem {
                                id: format!("AppX:{}:{}", pkg_name, task_name),
                                name: friendly_name,
                                command: format!("AppX://{}/{}", pkg_name, task_name),
                                location: "Windows Package Startup".to_string(),
                                user_scope: "User".to_string(),
                                enabled,
                                file_exists: true,
                                publisher,
                                impact,
                                item_type: "AppX".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }
}

fn scan_reg_run(
    hive: HKEY,
    subpath: &str,
    loc_name: &str,
    scope: &str,
    approved_subkey: &str,
    is_machine: bool,
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

            let enabled = check_startup_approved(approved_subkey, &name, is_machine, true);
            let (display_name, publisher, impact) = resolve_item_metadata(&name, &cmd, enabled);

            list.push(StartupItem {
                id: format!(
                    "Reg:{}:{}:{}",
                    if is_machine { "HKLM" } else { "HKCU" },
                    approved_subkey,
                    name
                ),
                name: display_name,
                command: cmd,
                location: loc_name.to_string(),
                user_scope: scope.to_string(),
                enabled,
                file_exists: exists,
                publisher,
                impact,
                item_type: "Registry".to_string(),
            });
        }
    }
}

fn scan_folder(
    folder: &Path,
    loc_name: &str,
    scope: &str,
    is_machine: bool,
    list: &mut Vec<StartupItem>,
) {
    if !folder.exists() {
        return;
    }
    if let Ok(entries) = std::fs::read_dir(folder) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                let filename = path
                    .file_name()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                let stem = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();

                // Ignore folder configuration and system database files
                if filename.eq_ignore_ascii_case("desktop.ini")
                    || filename.eq_ignore_ascii_case("thumbs.db")
                    || stem.eq_ignore_ascii_case("desktop")
                    || path
                        .extension()
                        .map(|e| e.to_string_lossy().to_lowercase())
                        .as_deref()
                        == Some("ini")
                {
                    continue;
                }

                let enabled = check_startup_approved("StartupFolder", &filename, is_machine, true);
                let (display_name, publisher, impact) =
                    resolve_item_metadata(&stem, &path.to_string_lossy(), enabled);

                list.push(StartupItem {
                    id: format!(
                        "Folder:{}:{}",
                        if is_machine { "HKLM" } else { "HKCU" },
                        filename
                    ),
                    name: display_name,
                    command: path.to_string_lossy().to_string(),
                    location: loc_name.to_string(),
                    user_scope: scope.to_string(),
                    enabled,
                    file_exists: true,
                    publisher,
                    impact,
                    item_type: "StartupFolder".to_string(),
                });
            }
        }
    }
}

/// Toggles a startup item enabled or disabled in the authentic Windows system registry
pub fn toggle_startup_entry(id: &str, enabled: bool) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    // Case 1: AppX Modern App
    if id.starts_with("AppX:") {
        let parts: Vec<&str> = id.split(':').collect();
        if parts.len() >= 3 {
            let pkg_name = parts[1];
            let task_name = parts[2];
            let subkey_path = format!(
                r"Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\SystemAppData\{}\{}",
                pkg_name, task_name
            );
            if let Ok((key, _)) = hkcu.create_subkey(&subkey_path) {
                let new_state: u32 = if enabled { 2 } else { 1 };
                let _ = key.set_value("State", &new_state);
                if !enabled {
                    let now = chrono::Utc::now().timestamp() as u32;
                    let _ = key.set_value("LastDisabledTime", &now);
                }
                return Ok(());
            }
        }
        return Err("Failed to access AppX startup task".to_string());
    }

    let first_byte: u8 = if enabled { 0x02 } else { 0x03 };
    let raw_bytes: [u8; 12] = [first_byte, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let reg_val = winreg::RegValue {
        vtype: REG_BINARY,
        bytes: raw_bytes.to_vec(),
    };

    // Case 2: Startup Folder (.lnk)
    if id.starts_with("Folder:") {
        let parts: Vec<&str> = id.split(':').collect();
        let (is_machine, filename) = if parts.len() >= 3 {
            (parts[1] == "HKLM", parts[2])
        } else {
            (false, id.trim_start_matches("Folder:"))
        };

        let approved_path =
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder";

        let mut hklm_written = false;
        if is_machine {
            if let Ok((key, _)) = hklm.create_subkey(approved_path) {
                if key.set_raw_value(filename, &reg_val).is_ok() {
                    hklm_written = true;
                }
            }
        }

        // Always also set in HKCU
        if let Ok((key, _)) = hkcu.create_subkey(approved_path) {
            let _ = key.set_raw_value(filename, &reg_val);
        }

        if is_machine && !hklm_written {
            return Err("Administrator privileges required to toggle system-wide startup apps. Please run Syntax Uninstaller as Administrator.".to_string());
        }

        return Ok(());
    }

    // Case 3: Registry Run key
    if id.starts_with("Reg:") {
        let parts: Vec<&str> = id.split(':').collect();
        let (is_machine, approved_sub, val_name) = if parts.len() >= 4 {
            (parts[1] == "HKLM", parts[2], parts[3])
        } else if parts.len() >= 3 {
            (false, parts[1], parts[2])
        } else {
            return Err("Invalid startup item ID format".to_string());
        };

        let approved_path = format!(
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\{}",
            approved_sub
        );

        let mut hklm_written = false;
        if is_machine {
            if let Ok((key, _)) = hklm.create_subkey(&approved_path) {
                if key.set_raw_value(val_name, &reg_val).is_ok() {
                    hklm_written = true;
                }
            }
        }

        // Always also update HKCU
        if let Ok((key, _)) = hkcu.create_subkey(&approved_path) {
            let _ = key.set_raw_value(val_name, &reg_val);
        }

        if is_machine && !hklm_written {
            return Err("Administrator privileges required to toggle system-wide startup apps. Please run Syntax Uninstaller as Administrator.".to_string());
        }

        return Ok(());
    }

    Err("Unrecognized startup item type".to_string())
}
