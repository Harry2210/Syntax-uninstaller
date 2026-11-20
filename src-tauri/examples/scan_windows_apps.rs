//! Diagnostic: prints the Windows Store / MSIX package inventory.
//!
//! Run with:  cargo run --example scan_windows_apps

use syntax_uninstaller_lib::modules::windows_apps;

fn main() {
    let apps = windows_apps::get_installed_windows_apps();

    println!("=== windows (MSIX) apps: {} ===", apps.len());
    for app in &apps {
        println!(
            "{:<45} | {:<14} | icon {}",
            app.name.chars().take(45).collect::<String>(),
            app.version.chars().take(14).collect::<String>(),
            if app.display_icon.is_empty() {
                "none".to_string()
            } else {
                format!("{} KB", app.display_icon.len() / 1024)
            }
        );
    }
}
