pub mod commands;
pub mod modules;

use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;

/// Logs go next to the SQLite database in %LOCALAPPDATA%\SyntaxUninstaller.
/// They used to be written to the current working directory, which is often
/// read-only for an installed app, and every window event appended a line.
fn log_path(file: &str) -> PathBuf {
    let base = match std::env::var("LOCALAPPDATA") {
        Ok(dir) => PathBuf::from(dir).join("SyntaxUninstaller"),
        Err(_) => PathBuf::from("./data"),
    };
    std::fs::create_dir_all(&base).ok();
    base.join(file)
}

/// Appends a timestamped line to a log file in the app-data folder.
/// `pub(crate)` so command handlers can record background-task failures.
pub(crate) fn log_line(file: &str, message: &str) {
    let path = log_path(file);
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(
            f,
            "[{}] {}",
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
            message
        );
    }
}

pub fn run() {
    std::panic::set_hook(Box::new(|info| {
        // Capture the panic message and the source location in one line.
        let location = info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "unknown".to_string());
        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "unknown panic".to_string()
        };
        log_line("crash.log", &format!("PANIC at {}: {}", location, payload));
    }));

    log_line("app.log", "Syntax Uninstaller starting");

    let app = match tauri::Builder::default()
        .setup(|app| {
            log_line("app.log", "Entered setup hook");
            // Initialize SQLite DB
            log_line("app.log", "Calling Database::init");
            if let Err(e) = modules::db::Database::init() {
                log_line("app.log", &format!("Database initialization error: {}", e));
            }
            log_line("app.log", "Database::init finished, getting main window");
            if let Some(window) = app.get_webview_window("main") {
                log_line("app.log", "Found main window, showing");
                let _ = window.show();
                let _ = window.set_focus();
            } else {
                log_line("app.log", "Main window not found in setup");
            }
            log_line("app.log", "Setup finished successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_installed_applications,
            commands::get_windows_apps,
            commands::uninstall_windows_app,
            commands::run_uninstaller,
            commands::check_app_processes,
            commands::kill_app_process,
            commands::create_restore_point,
            commands::scan_leftovers,
            commands::remove_leftovers,
            commands::get_startup_items,
            commands::toggle_startup_item,
            commands::get_last_bios_time,
            commands::get_services,
            commands::manage_service,
            commands::get_scheduled_tasks,
            commands::toggle_task,
            commands::get_processes,
            commands::terminate_process,
            commands::get_browser_extensions,
            commands::scan_junk_files,
            commands::scan_windows_traces,
            commands::scan_browser_traces,
            commands::scan_office_traces,
            commands::clean_files,
            commands::secure_delete_files,
            commands::get_windows_tools,
            commands::launch_tool,
            commands::get_system_specs,
            commands::backup_registry_key,
            commands::restore_registry_backup,
            commands::take_monitor_snapshot,
            commands::compare_monitor_snapshot,
            commands::get_application_icon,
            // Next-Gen Powersuite commands
            commands::get_debloat_items,
            commands::set_debloat_item,
            commands::apply_recommended_debloat,
            commands::restore_windows_defaults,
            commands::check_software_updates,
            commands::upgrade_software,
            commands::upgrade_all_software,
            commands::get_context_menu_items,
            commands::toggle_context_menu_item,
            commands::delete_context_menu_item,
            commands::inspect_locked_path,
            commands::unlock_and_delete,
            commands::schedule_reboot_deletion,
            commands::get_pending_reboot_deletions,
            commands::clear_pending_reboot_deletions,
            commands::generate_audit_html,
            commands::export_audit_report,
            commands::analyze_disk_space,
            commands::window_minimize,
            commands::window_toggle_maximize,
            commands::window_close,
            commands::window_is_maximized,
            commands::download_and_install_update,
            commands::start_live_monitor,
            commands::get_live_monitor_status,
            commands::stop_live_monitor,
            commands::get_installation_traces,
            commands::delete_installation_trace,
            commands::revert_installation_trace,
            commands::get_database_footprints,
        ])
        .build(tauri::generate_context!())
    {
        Ok(app) => app,
        Err(e) => {
            log_line("app.log", &format!("Builder build error: {:?}", e));
            return;
        }
    };

    app.run(|_app_handle, event| {
        // Previously EVERY runtime event (including hundreds of
        // MainEventsCleared per minute) opened, wrote and flushed a file.
        // That was pure disk churn; log only meaningful lifecycle events.
        match event {
            tauri::RunEvent::Exit => log_line("app.log", "Syntax Uninstaller stopped"),
            tauri::RunEvent::WindowEvent {
                event: tauri::WindowEvent::CloseRequested { .. },
                ..
            } => log_line("app.log", "Main window close requested"),
            tauri::RunEvent::ExitRequested { .. } => log_line("app.log", "Exit requested"),
            _ => {}
        }
    });
}
