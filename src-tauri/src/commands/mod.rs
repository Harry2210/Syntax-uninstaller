use crate::modules::{
    applications::{self, InstalledApp},
    backup::{self, BackupRecord},
    browser::{self, BrowserExtension},
    cache,
    cleaner::{self, CleanCategory},
    context_menu::{self, ContextMenuItem},
    debloater::{self, DebloatItem},
    icon_extractor,
    leftover_scanner::{self, LeftoverItem},
    monitor::{self, InstallationTrace, SystemSnapshot},
    processes::{self, ProcessInfo},
    report_generator,
    scheduled_tasks::{self, ScheduledTaskItem},
    services::{self, WinService},
    software_updater::{
        self, SoftwareUpdate, UpdateOutcome, UpdateProgress, UpdateScan, UpdateSummary,
    },
    space_analyzer::{self, SpaceReport, SpaceScanProgress},
    startup::{self, StartupItem},
    system_info::{self, SystemSpecs},
    tools::{self, WinTool},
    uninstaller::{self, ProcessMatch},
    unlocker::{self, LockedFileStatus},
    windows_apps::{self, WindowsApp},
};
use tauri::Emitter;

/*
 * PERFORMANCE NOTE
 * ----------------
 * Tauri executes synchronous commands on the main (UI) thread, so every
 * registry scan, PowerShell spawn and disk walk used to freeze the window for
 * seconds. Every command that touches the registry, the file system, PowerShell
 * or a child process is now `async` and delegates to `spawn_blocking`, which
 * runs it on the blocking thread pool while the WebView keeps painting.
 */

#[tauri::command]
pub async fn get_installed_applications() -> Vec<InstalledApp> {
    match tauri::async_runtime::spawn_blocking(applications::get_installed_apps).await {
        Ok(apps) => {
            crate::log_line(
                "app.log",
                &format!("Application scan returned {} entries", apps.len()),
            );
            apps
        }
        // A panic inside the scan is logged instead of vanishing into an empty
        // list that looks like "no software is installed".
        Err(e) => {
            crate::log_line("app.log", &format!("Application scan failed: {}", e));
            Vec::new()
        }
    }
}

#[tauri::command]
pub async fn get_windows_apps() -> Vec<WindowsApp> {
    tauri::async_runtime::spawn_blocking(windows_apps::get_installed_windows_apps)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn uninstall_windows_app(package_full_name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        windows_apps::remove_windows_app(&package_full_name)
    })
    .await
    .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn run_uninstaller(cmd: String, quiet: bool) -> Result<i32, String> {
    tauri::async_runtime::spawn_blocking(move || {
        uninstaller::execute_uninstaller_command(&cmd, quiet)
    })
    .await
    .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn check_app_processes(app_name: String, install_dir: String) -> Vec<ProcessMatch> {
    tauri::async_runtime::spawn_blocking(move || {
        uninstaller::check_running_processes(&app_name, &install_dir)
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
pub async fn kill_app_process(pid: u32) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || uninstaller::kill_process_by_pid(pid))
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn create_restore_point(description: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        uninstaller::create_system_restore_point(&description)
    })
    .await
    .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn scan_leftovers(
    app_name: String,
    publisher: String,
    install_location: String,
    scan_level: String,
) -> Vec<LeftoverItem> {
    tauri::async_runtime::spawn_blocking(move || {
        leftover_scanner::scan_application_leftovers(
            &app_name,
            &publisher,
            &install_location,
            &scan_level,
        )
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
pub async fn remove_leftovers(items: Vec<LeftoverItem>) -> (usize, u64, Vec<String>) {
    tauri::async_runtime::spawn_blocking(move || leftover_scanner::remove_leftovers_safely(&items))
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn get_startup_items() -> Vec<StartupItem> {
    tauri::async_runtime::spawn_blocking(startup::get_startup_entries)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn toggle_startup_item(id: String, enabled: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || startup::toggle_startup_entry(&id, enabled))
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn get_last_bios_time() -> f64 {
    tauri::async_runtime::spawn_blocking(startup::get_last_bios_time)
        .await
        .unwrap_or(12.0)
}

#[tauri::command]
pub async fn get_services() -> Vec<WinService> {
    tauri::async_runtime::spawn_blocking(services::get_windows_services)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn manage_service(service_name: String, action: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || services::manage_service(&service_name, &action))
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn get_scheduled_tasks() -> Vec<ScheduledTaskItem> {
    tauri::async_runtime::spawn_blocking(scheduled_tasks::get_scheduled_tasks)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn toggle_task(task_name: String, enable: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        scheduled_tasks::toggle_scheduled_task(&task_name, enable)
    })
    .await
    .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn get_processes() -> Vec<ProcessInfo> {
    tauri::async_runtime::spawn_blocking(processes::get_running_processes)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn terminate_process(pid: u32) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || processes::terminate_process(pid))
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn get_browser_extensions() -> Vec<BrowserExtension> {
    tauri::async_runtime::spawn_blocking(browser::get_installed_extensions)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn scan_junk_files() -> Vec<CleanCategory> {
    tauri::async_runtime::spawn_blocking(cleaner::scan_junk_categories)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn scan_windows_traces() -> Vec<CleanCategory> {
    tauri::async_runtime::spawn_blocking(cleaner::scan_windows_traces)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn scan_browser_traces() -> Vec<CleanCategory> {
    tauri::async_runtime::spawn_blocking(cleaner::scan_browser_traces)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn scan_office_traces() -> Vec<CleanCategory> {
    tauri::async_runtime::spawn_blocking(cleaner::scan_office_traces)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn clean_files(file_paths: Vec<String>) -> (usize, u64, Vec<String>) {
    tauri::async_runtime::spawn_blocking(move || cleaner::clean_files(&file_paths))
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn secure_delete_files(
    file_paths: Vec<String>,
    passes: u32,
) -> (usize, u64, Vec<String>) {
    tauri::async_runtime::spawn_blocking(move || cleaner::secure_shred_files(&file_paths, passes))
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn get_windows_tools() -> Vec<WinTool> {
    tools::get_available_tools()
}

#[tauri::command]
pub async fn launch_tool(command: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || tools::launch_tool(&command))
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn get_system_specs() -> SystemSpecs {
    tauri::async_runtime::spawn_blocking(system_info::get_system_specs)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn backup_registry_key(
    reg_key_path: String,
    target_name: String,
) -> Result<BackupRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
        backup::create_registry_backup(&reg_key_path, &target_name)
    })
    .await
    .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn restore_registry_backup(file_path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || backup::restore_registry_backup(&file_path))
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn take_monitor_snapshot() -> SystemSnapshot {
    tauri::async_runtime::spawn_blocking(monitor::take_snapshot)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn compare_monitor_snapshot(
    before: SystemSnapshot,
    app_hint: String,
) -> InstallationTrace {
    tauri::async_runtime::spawn_blocking(move || monitor::compare_snapshots(&before, &app_hint))
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn start_live_monitor(
    installer_path: Option<String>,
    app_name: String,
) -> Result<monitor::LiveMonitorStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        monitor::start_live_session(installer_path, app_name)
    })
    .await
    .map_err(|e| format!("Failed to spawn monitor: {}", e))?
}

#[tauri::command]
pub async fn get_live_monitor_status() -> monitor::LiveMonitorStatus {
    tauri::async_runtime::spawn_blocking(monitor::get_live_session_status)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn stop_live_monitor(app_name: String) -> Result<InstallationTrace, String> {
    tauri::async_runtime::spawn_blocking(move || monitor::stop_live_session(app_name))
        .await
        .map_err(|e| format!("Failed to stop monitor: {}", e))?
}

#[tauri::command]
pub async fn get_installation_traces() -> Result<Vec<InstallationTrace>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::modules::db::Database::global().get_installation_traces()
    })
    .await
    .map_err(|e| format!("Database task failed: {}", e))?
}

#[tauri::command]
pub async fn delete_installation_trace(id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::modules::db::Database::global().delete_installation_trace(&id)
    })
    .await
    .map_err(|e| format!("Database task failed: {}", e))?
}

#[tauri::command]
pub async fn revert_installation_trace(trace: InstallationTrace) -> Result<(usize, u64), String> {
    tauri::async_runtime::spawn_blocking(move || Ok(monitor::revert_trace(&trace)))
        .await
        .map_err(|e| format!("Revert task failed: {}", e))?
}

#[tauri::command]
pub async fn get_database_footprints() -> Result<Vec<crate::modules::db::KnownAppFootprint>, String>
{
    tauri::async_runtime::spawn_blocking(|| {
        crate::modules::db::Database::global().get_all_footprints()
    })
    .await
    .map_err(|e| format!("Database task failed: {}", e))?
}

#[tauri::command]
pub async fn get_application_icon(icon_path: String) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || icon_extractor::extract_icon_as_base64(&icon_path))
        .await
        .unwrap_or_default()
}

// --- NEW NEXT-GEN POWERSUITE COMMANDS ---

#[tauri::command]
pub async fn get_debloat_items() -> Vec<DebloatItem> {
    debloater::get_debloat_items()
}

#[tauri::command]
pub async fn set_debloat_item(id: String, enable_shield: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || debloater::set_debloat_item(&id, enable_shield))
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn apply_recommended_debloat() -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(debloater::apply_recommended_debloat)
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn restore_windows_defaults() -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(debloater::restore_windows_defaults)
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

/// Scans for available WinGet upgrades.
///
/// Errors are returned to the UI instead of being swallowed: an unavailable
/// engine must not look like "your PC is fully up to date".
#[tauri::command]
pub async fn check_software_updates(force: Option<bool>) -> Result<UpdateScan, String> {
    let force = force.unwrap_or(false);
    // winget enumeration can take several seconds: never on the UI thread.
    tauri::async_runtime::spawn_blocking(move || software_updater::check_software_updates(force))
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

/// Upgrades a single package and streams live milestones to the UI.
#[tauri::command]
pub async fn upgrade_software(
    app: tauri::AppHandle,
    update: SoftwareUpdate,
    interactive: Option<bool>,
    index: Option<usize>,
    total: Option<usize>,
) -> Result<UpdateOutcome, String> {
    let interactive = interactive.unwrap_or(false);
    let index = index.unwrap_or(1);
    let total = total.unwrap_or(1).max(index);

    tauri::async_runtime::spawn_blocking(move || {
        let progress_app = app;
        let progress = move |update_progress: UpdateProgress| {
            let _ = progress_app.emit("software-update-progress", update_progress);
        };

        software_updater::upgrade_software(&update, interactive, index, total, Some(&progress))
    })
    .await
    .map_err(|e| format!("Background task failed: {}", e))?
}

/// Upgrades a queue of packages sequentially.
///
/// WinGet serialises installs with a global mutex, so parallel upgrades would
/// only fail with "another installation is in progress". The queue stops after
/// a package that requires a restart; the remaining entries are reported as
/// skipped instead of being silently dropped.
#[tauri::command]
pub async fn upgrade_all_software(
    app: tauri::AppHandle,
    updates: Vec<SoftwareUpdate>,
) -> Result<UpdateSummary, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let progress_app = app;
        let progress = move |update_progress: UpdateProgress| {
            let _ = progress_app.emit("software-update-progress", update_progress);
        };

        software_updater::upgrade_all_software(&updates, Some(&progress))
    })
    .await
    .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn get_context_menu_items() -> Vec<ContextMenuItem> {
    tauri::async_runtime::spawn_blocking(context_menu::get_context_menu_items)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn toggle_context_menu_item(
    registry_path: String,
    enable: bool,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        context_menu::toggle_context_menu_item(&registry_path, enable)
    })
    .await
    .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn delete_context_menu_item(registry_path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        context_menu::delete_context_menu_item(&registry_path)
    })
    .await
    .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn inspect_locked_path(path_str: String) -> LockedFileStatus {
    tauri::async_runtime::spawn_blocking(move || unlocker::inspect_path(&path_str))
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn unlock_and_delete(path_str: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || unlocker::unlock_and_delete(&path_str))
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn schedule_reboot_deletion(path_str: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || unlocker::schedule_reboot_deletion(&path_str))
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn get_pending_reboot_deletions() -> Vec<String> {
    tauri::async_runtime::spawn_blocking(unlocker::get_pending_reboot_deletions)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn clear_pending_reboot_deletions() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(unlocker::clear_pending_reboot_deletions)
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

#[tauri::command]
pub async fn generate_audit_html() -> String {
    tauri::async_runtime::spawn_blocking(report_generator::generate_audit_html)
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn export_audit_report(dest_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || report_generator::export_audit_report(&dest_path))
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

/// Read-only disk space analysis for a drive or folder.
///
/// Results are cached for a short while so drilling into folders and going
/// back is instant, while `refresh: true` (the Rescan button) forces a fresh
/// walk. Worker threads report throttled progress through `space-scan-progress`.
#[tauri::command]
pub async fn analyze_disk_space(
    app: tauri::AppHandle,
    path: String,
    refresh: Option<bool>,
) -> Result<SpaceReport, String> {
    let key = space_analyzer::cache_key(&path);

    if refresh.unwrap_or(false) {
        cache::invalidate(&key);
    } else if let Some(cached) = cache::get::<SpaceReport>(&key, space_analyzer::CACHE_TTL) {
        return Ok(cached);
    }

    tauri::async_runtime::spawn_blocking(move || {
        let progress_app = app;
        let progress = move |update: SpaceScanProgress| {
            let _ = progress_app.emit("space-scan-progress", update);
        };

        let report = space_analyzer::analyze(&path, Some(&progress))?;
        cache::put(&key, &report);
        Ok(report)
    })
    .await
    .map_err(|e| format!("Background task failed: {}", e))?
}

// Window management commands for frameless custom titlebar
#[tauri::command]
pub fn window_minimize(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
pub fn window_toggle_maximize(window: tauri::Window) {
    if let Ok(is_max) = window.is_maximized() {
        if is_max {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[tauri::command]
pub fn window_close(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
pub fn window_is_maximized(window: tauri::Window) -> bool {
    window.is_maximized().unwrap_or(false)
}

#[tauri::command]
pub async fn download_and_install_update(
    app: tauri::AppHandle,
    download_url: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let temp_dir = std::env::temp_dir();
        let installer_path = temp_dir.join("Syntax-Uninstaller-Setup.exe");
        let installer_str = installer_path.to_string_lossy().to_string();

        let _ = app.emit(
            "app-update-progress",
            serde_json::json!({
                "percent": 15,
                "status": "Connecting to update server..."
            }),
        );

        let _ = std::fs::remove_file(&installer_path);

        let _ = app.emit(
            "app-update-progress",
            serde_json::json!({
                "percent": 35,
                "status": "Downloading update package..."
            }),
        );

        // First attempt with built-in curl.exe
        let curl_res = std::process::Command::new("curl.exe")
            .args(["-L", "-f", "-s", "-o", &installer_str, &download_url])
            .output();

        let mut success = match curl_res {
            Ok(out) => {
                out.status.success()
                    && installer_path.exists()
                    && std::fs::metadata(&installer_path)
                        .map(|m| m.len() > 1024)
                        .unwrap_or(false)
            }
            Err(_) => false,
        };

        if !success {
            // Fallback: PowerShell WebClient
            let ps_script = format!(
                r#"$ProgressPreference = 'SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('{0}', '{1}')"#,
                download_url, installer_str
            );
            let ps_res = std::process::Command::new("powershell")
                .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps_script])
                .status();

            success = match ps_res {
                Ok(s) => {
                    s.success()
                        && installer_path.exists()
                        && std::fs::metadata(&installer_path)
                            .map(|m| m.len() > 1024)
                            .unwrap_or(false)
                }
                Err(_) => false,
            };
        }

        if !success {
            return Err("Failed to download the update installer. Please check your internet connection.".to_string());
        }

        let _ = app.emit(
            "app-update-progress",
            serde_json::json!({
                "percent": 85,
                "status": "Launching updated installer..."
            }),
        );

        // Execute the installer
        let spawn_res = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-WindowStyle",
                "Hidden",
                "-Command",
                &format!("Start-Process -FilePath '{}'", installer_str),
            ])
            .spawn();

        if let Err(e) = spawn_res {
            return Err(format!("Downloaded update but failed to launch installer: {}", e));
        }

        let _ = app.emit(
            "app-update-progress",
            serde_json::json!({
                "percent": 100,
                "status": "Update launched! Restarting..."
            }),
        );

        std::thread::sleep(std::time::Duration::from_millis(800));
        std::process::exit(0);
    })
    .await
    .map_err(|e| format!("Update error: {}", e))?
}
