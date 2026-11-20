//! Diagnostic: times every native inventory scanner so performance work can
//! be measured instead of guessed.
//!
//! Run with:  cargo run --release --example bench_scans

use std::time::Instant;
use syntax_uninstaller_lib::modules::{
    applications, browser, cleaner, processes, scheduled_tasks, services, space_analyzer, startup,
    system_info, windows_apps,
};

fn timed<T>(label: &str, scan: impl FnOnce() -> T) -> T {
    let start = Instant::now();
    let value = scan();
    println!(
        "{:<22} {:>8.1} ms",
        label,
        start.elapsed().as_secs_f64() * 1000.0
    );
    value
}

fn main() {
    println!("=== Syntax Uninstaller scan benchmark ===");

    let apps = timed("applications", applications::get_installed_apps);
    timed("system specs", system_info::get_system_specs);
    timed("processes", processes::get_running_processes);
    timed("startup items", startup::get_startup_entries);
    timed("services", services::get_windows_services);
    timed("scheduled tasks", scheduled_tasks::get_scheduled_tasks);
    timed("browser extensions", browser::get_installed_extensions);
    timed("junk files", cleaner::scan_junk_categories);
    timed("windows traces", cleaner::scan_windows_traces);
    timed("browser traces", cleaner::scan_browser_traces);
    timed("office traces", cleaner::scan_office_traces);
    timed("windows apps", windows_apps::get_installed_windows_apps);

    let source_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let _ = timed("space analysis (src)", || {
        space_analyzer::analyze(&source_dir.to_string_lossy(), None)
    });

    println!("(installed apps: {})", apps.len());
}
