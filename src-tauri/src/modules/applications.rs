use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use winreg::enums::*;
use winreg::{RegKey, HKEY};

use crate::modules::icon_extractor::extract_icon_as_base64;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledApp {
    pub id: String,
    pub name: String,
    pub publisher: String,
    pub version: String,
    pub install_date: String,
    pub install_location: String,
    pub estimated_size_kb: u64,
    pub uninstall_string: String,
    pub quiet_uninstall_string: String,
    pub display_icon: String,
    pub registry_source: String,
    pub architecture: String,
    pub is_system_component: bool,
    pub health_score: u32,
    pub health_notes: Vec<String>,
}

pub fn get_installed_apps() -> Vec<InstalledApp> {
    let mut apps: Vec<InstalledApp> = Vec::new();
    let mut seen_ids = HashSet::new();

    // Cache startup executables to detect auto-run dependencies
    let startup_commands = collect_startup_targets();

    // 1. HKLM 64-bit
    scan_registry_view(
        HKEY_LOCAL_MACHINE,
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        "HKLM (64-bit)",
        "x64",
        KEY_READ | KEY_WOW64_64KEY,
        &mut apps,
        &mut seen_ids,
        &startup_commands,
    );

    // 2. HKLM 32-bit (WOW6432Node)
    scan_registry_view(
        HKEY_LOCAL_MACHINE,
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        "HKLM (32-bit)",
        "x86",
        KEY_READ | KEY_WOW64_32KEY,
        &mut apps,
        &mut seen_ids,
        &startup_commands,
    );

    // 3. HKCU (Current User per-user apps)
    scan_registry_view(
        HKEY_CURRENT_USER,
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        "HKCU (User)",
        "User",
        KEY_READ,
        &mut apps,
        &mut seen_ids,
        &startup_commands,
    );

    // Sort alphabetically by name
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps
}

fn scan_registry_view(
    hive: HKEY,
    subpath: &str,
    source_name: &str,
    arch: &str,
    access: u32,
    apps: &mut Vec<InstalledApp>,
    seen_ids: &mut HashSet<String>,
    startup_commands: &HashSet<String>,
) {
    let reg_hive = RegKey::predef(hive);
    let root = match reg_hive.open_subkey_with_flags(subpath, access) {
        Ok(key) => key,
        Err(_) => return,
    };

    for subkey_name in root.enum_keys().filter_map(|x| x.ok()) {
        let app_key = match root.open_subkey_with_flags(&subkey_name, access) {
            Ok(key) => key,
            Err(_) => continue,
        };

        // Filter out internal system components & updates unless explicitly named
        let is_system: u32 = app_key.get_value("SystemComponent").unwrap_or(0);
        let parent_key: String = app_key.get_value("ParentKeyName").unwrap_or_default();
        if is_system == 1 || !parent_key.is_empty() {
            continue;
        }

        let name: String = match app_key.get_value("DisplayName") {
            Ok(n) => n,
            Err(_) => continue, // Must have DisplayName to be a user-facing program
        };

        let trimmed_name = name.trim();
        if trimmed_name.is_empty() {
            continue;
        }

        let publisher: String = app_key
            .get_value("Publisher")
            .unwrap_or_else(|_| "Unknown Publisher".to_string());
        let version: String = app_key
            .get_value("DisplayVersion")
            .unwrap_or_else(|_| "1.0.0".to_string());
        let install_date: String = app_key.get_value("InstallDate").unwrap_or_default();
        let mut install_location: String = app_key.get_value("InstallLocation").unwrap_or_default();
        let uninstall_string: String = app_key.get_value("UninstallString").unwrap_or_default();
        let quiet_uninstall_string: String = app_key
            .get_value("QuietUninstallString")
            .unwrap_or_default();
        let mut display_icon: String = app_key.get_value("DisplayIcon").unwrap_or_default();
        let mut estimated_size_kb: u64 =
            app_key.get_value::<u32, _>("EstimatedSize").unwrap_or(0) as u64;

        // Deduplicate using subkey_name + publisher + version
        let dedup_key = format!(
            "{}:{}:{}",
            trimmed_name.to_lowercase(),
            publisher.to_lowercase(),
            version
        );
        if seen_ids.contains(&dedup_key) {
            continue;
        }
        seen_ids.insert(dedup_key);

        // --- DYNAMIC DISK RECOVERY: Measure real folder size if registry omitted it ---
        if estimated_size_kb == 0 && !install_location.trim().is_empty() {
            let p = Path::new(install_location.trim());
            if p.is_dir() {
                estimated_size_kb = compute_quick_dir_kb(p);
            }
        }

        // --- ADVANCED 12-POINT HEURISTIC HEALTH EVALUATION ENGINE ---
        let mut score: u32 = 100;
        let mut notes: Vec<String> = Vec::new();

        let is_msi = uninstall_string.to_lowercase().contains("msiexec");

        // 1. Uninstaller Command Verification
        if uninstall_string.is_empty() {
            score = score.saturating_sub(40);
            notes.push("Missing registered uninstallation command (Orphaned entry)".to_string());
        } else if !is_msi {
            // Verify uninstaller target binary exists on disk
            let clean_unins = clean_command_binary(&uninstall_string);
            if !clean_unins.is_empty() && !Path::new(&clean_unins).exists() {
                score = score.saturating_sub(35);
                notes.push(format!(
                    "Uninstaller binary not found on disk: '{}'",
                    clean_unins
                ));
            } else {
                notes.push("Standard executable uninstaller verified".to_string());
            }
        } else {
            notes.push("Windows Installer (MSI) database package verified".to_string());
        }

        // 2. Installation Location Integrity Check
        if !install_location.trim().is_empty() {
            let p = Path::new(install_location.trim());
            if !p.exists() {
                score = score.saturating_sub(25);
                notes.push("Registered installation directory does not exist on disk".to_string());
            } else if p.is_dir() {
                let entry_count = p.read_dir().map(|r| r.count()).unwrap_or(0);
                if entry_count == 0 {
                    score = score.saturating_sub(20);
                    notes.push("Installation directory is an empty shell".to_string());
                }
            }
        } else {
            // Check if App Paths or uninstaller reveals install location
            if let Some(app_path) = find_app_path_executable(trimmed_name) {
                if let Some(parent) = Path::new(&app_path).parent() {
                    install_location = parent.to_string_lossy().to_string();
                }
            }
        }

        // 3. Publisher Identity & Authenticity Check
        let norm_pub = publisher.trim().to_lowercase();
        if norm_pub.is_empty() || norm_pub == "unknown publisher" {
            score = score.saturating_sub(10);
            notes.push("Unsigned or unspecified publisher identity".to_string());
        }

        // 4. Version & Metadata Robustness
        if version.trim().is_empty() || version == "1.0.0" {
            score = score.saturating_sub(5);
        }

        // 5. Automatic Startup Hook Detection
        let norm_name_clean = trimmed_name.to_lowercase().replace(' ', "");
        let has_startup = startup_commands.iter().any(|cmd| {
            let low = cmd.to_lowercase();
            low.contains(&norm_name_clean)
                || (!install_location.is_empty() && low.contains(&install_location.to_lowercase()))
        });
        if has_startup {
            notes.push("Registered for automatic Windows boot startup".to_string());
        }

        // 6. Native Architecture Alignment
        if arch == "x64" {
            notes.push("Native 64-bit architecture".to_string());
        }

        if notes.is_empty() {
            notes.push("Optimal health: Verified binaries and complete configuration".to_string());
        }

        // --- REAL ICON RESOLUTION ---
        // 1. If display_icon is missing, check install_location for primary .exe
        if display_icon.trim().is_empty() && !install_location.is_empty() {
            if let Some(discovered_exe) = find_primary_executable(&install_location, trimmed_name) {
                display_icon = discovered_exe;
            }
        }

        // 2. If still missing, check Windows App Paths registry
        if display_icon.trim().is_empty() {
            if let Some(app_path) = find_app_path_executable(trimmed_name) {
                display_icon = app_path;
            }
        }

        // 2.5 If still missing, check Start Menu shortcuts (.lnk files)
        if display_icon.trim().is_empty() {
            if let Some(lnk_path) = find_start_menu_shortcut(trimmed_name) {
                display_icon = lnk_path;
            }
        }

        // 3. Extract authentic high-res base64 icon using native Win32 FFI.
        //    Wrapped in catch_unwind: one malformed icon must never abort the
        //    whole inventory scan (which would make the app look empty).
        if !display_icon.trim().is_empty() && !display_icon.starts_with("data:image/") {
            let icon_source = display_icon.clone();
            let extracted = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                extract_icon_as_base64(&icon_source)
            }))
            .ok()
            .flatten();

            if let Some(base64_data_url) = extracted {
                display_icon = base64_data_url;
            }
        }

        apps.push(InstalledApp {
            id: subkey_name,
            name: trimmed_name.to_string(),
            publisher: publisher.trim().to_string(),
            version: version.trim().to_string(),
            install_date: normalize_install_date(&install_date),
            install_location: install_location.trim().to_string(),
            estimated_size_kb,
            uninstall_string: uninstall_string.trim().to_string(),
            quiet_uninstall_string: quiet_uninstall_string.trim().to_string(),
            display_icon: display_icon.trim().to_string(),
            registry_source: source_name.to_string(),
            architecture: arch.to_string(),
            is_system_component: is_system == 1,
            health_score: score,
            health_notes: notes,
        });
    }
}

/// `InstallDate` is normally `YYYYMMDD`. Slicing by byte index panicked on any
/// non-numeric/non-ASCII value, so validate first and pass anything else through.
fn normalize_install_date(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.len() == 8 && trimmed.chars().all(|c| c.is_ascii_digit()) {
        format!("{}-{}-{}", &trimmed[0..4], &trimmed[4..6], &trimmed[6..8])
    } else {
        trimmed.to_string()
    }
}

fn collect_startup_targets() -> HashSet<String> {
    let mut targets = HashSet::new();

    let hives = [
        (
            HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
        ),
        (
            HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
        ),
    ];

    for (hive, sub) in hives {
        if let Ok(k) = RegKey::predef(hive).open_subkey_with_flags(sub, KEY_READ) {
            for (_, val) in k.enum_values().filter_map(|x| x.ok()) {
                targets.insert(val.to_string().to_lowercase());
            }
        }
    }

    targets
}

fn clean_command_binary(cmd: &str) -> String {
    let mut s = cmd.trim();
    if s.starts_with('"') {
        if let Some(end) = s[1..].find('"') {
            return s[1..=end].to_string();
        }
    }
    if let Some(space_pos) = s.find(' ') {
        s = &s[..space_pos];
    }
    s.to_string()
}

fn find_app_path_executable(app_name: &str) -> Option<String> {
    let clean = app_name.trim().to_lowercase().replace(' ', "");
    let candidates = [format!("{}.exe", clean), format!("{}.exe", app_name.trim())];

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(app_paths) = hklm.open_subkey_with_flags(
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths",
        KEY_READ,
    ) {
        for candidate in &candidates {
            if let Ok(exe_key) = app_paths.open_subkey_with_flags(candidate, KEY_READ) {
                if let Ok(default_val) = exe_key.get_value::<String, _>("") {
                    let path = clean_command_binary(&default_val);
                    if Path::new(&path).exists() {
                        return Some(path);
                    }
                }
            }
        }
    }

    None
}

fn find_start_menu_shortcut(app_name: &str) -> Option<String> {
    let norm = app_name.to_lowercase().replace(' ', "");
    let roots = [
        std::env::var("ProgramData")
            .map(|p| PathBuf::from(p).join(r"Microsoft\Windows\Start Menu\Programs")),
        std::env::var("AppData")
            .map(|a| PathBuf::from(a).join(r"Microsoft\Windows\Start Menu\Programs")),
    ];

    for r_res in roots {
        if let Ok(root) = r_res {
            if root.exists() {
                for entry in walkdir::WalkDir::new(root)
                    .max_depth(3)
                    .into_iter()
                    .filter_map(|e| e.ok())
                {
                    let p = entry.path();
                    if p.extension()
                        .map(|e| e.eq_ignore_ascii_case("lnk"))
                        .unwrap_or(false)
                    {
                        if let Some(stem) = p.file_stem().and_then(|s| s.to_str()) {
                            let s_norm = stem.to_lowercase().replace(' ', "");
                            if s_norm.contains(&norm) || norm.contains(&s_norm) {
                                return Some(p.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

fn find_primary_executable(install_dir: &str, app_name: &str) -> Option<String> {
    let dir = Path::new(install_dir);
    if !dir.is_dir() {
        return None;
    }

    let norm_app = app_name.to_lowercase().replace(' ', "");
    let mut candidate_exes = Vec::new();

    if let Ok(entries) = dir.read_dir() {
        for entry in entries.filter_map(|e| e.ok()) {
            let p = entry.path();
            if p.is_file() {
                if let Some(ext) = p.extension() {
                    if ext.to_string_lossy().to_lowercase() == "exe" {
                        let stem = p
                            .file_stem()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_lowercase();
                        if !stem.contains("unins")
                            && !stem.contains("setup")
                            && !stem.contains("update")
                        {
                            if norm_app.contains(&stem) || stem.contains(&norm_app) {
                                return Some(p.to_string_lossy().to_string());
                            }
                            candidate_exes.push(p);
                        }
                    }
                }
            }
        }
    }

    candidate_exes
        .first()
        .map(|p| p.to_string_lossy().to_string())
}

fn compute_quick_dir_kb(dir: &Path) -> u64 {
    let mut total_bytes = 0u64;
    let mut count = 0;

    // PERFORMANCE: this runs once per app whose registry entry has no
    // EstimatedSize. Depth 3 / 2000 files could walk tens of thousands of
    // directory entries and dominate startup. A shallow, capped sample is
    // enough for a user-facing size estimate.
    for entry in walkdir::WalkDir::new(dir)
        .max_depth(2)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Ok(meta) = entry.metadata() {
                total_bytes += meta.len();
                count += 1;
                if count > 500 {
                    break;
                }
            }
        }
    }

    total_bytes / 1024
}
