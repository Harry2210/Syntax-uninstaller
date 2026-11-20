//! Diagnostic probe for the WinGet update engine.
//!
//! Run with: `cargo run --example updater_probe`
//!
//! It performs a read-only scan (no installs) so the parser, engine discovery
//! and error reporting can be verified against the real WinGet on this PC.

use syntax_uninstaller_lib::modules::software_updater;

fn main() {
    match software_updater::check_software_updates(true) {
        Ok(scan) => {
            println!(
                "engine={} admin={} updates={} scanned_at={}",
                scan.engine_version,
                scan.is_admin,
                scan.updates.len(),
                scan.scanned_at
            );
            for warning in &scan.warnings {
                println!("warning: {}", warning);
            }
            for update in &scan.updates {
                println!(
                    "{} | {} | {} -> {} | {}",
                    update.name,
                    update.id,
                    update.current_version,
                    update.available_version,
                    update.source
                );
            }
        }
        Err(error) => {
            eprintln!("scan error: {}", error);
            std::process::exit(1);
        }
    }
}
