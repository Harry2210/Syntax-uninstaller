//! Diagnostic: prints the full installed-application inventory that the
//! "Installed Apps" page receives.
//!
//! Run with:  cargo run --example scan_apps

use syntax_uninstaller_lib::modules::applications;

fn main() {
    let apps = applications::get_installed_apps();

    println!("=== installed applications: {} ===", apps.len());
    for app in &apps {
        println!(
            "{:<45} | {:<12} | {:<10} | health {:>3}",
            app.name.chars().take(45).collect::<String>(),
            app.version.chars().take(12).collect::<String>(),
            app.registry_source,
            app.health_score
        );
    }
}
