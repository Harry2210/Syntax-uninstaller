//! Diagnostic: prints the service and scheduled-task inventories.
//!
//! Run with:  cargo run --example scan_system

use syntax_uninstaller_lib::modules::{scheduled_tasks, services};

fn main() {
    let svc = services::get_windows_services();
    println!("=== services: {} ===", svc.len());
    for s in svc.iter().take(5) {
        println!(
            "{:<28} | {:<32} | {} / {}",
            s.name, s.display_name, s.status, s.start_type
        );
    }

    let tasks = scheduled_tasks::get_scheduled_tasks();
    println!("=== scheduled tasks: {} ===", tasks.len());
    for t in tasks.iter().take(5) {
        println!("{:<40} | {:<10} | {}", t.name, t.state, t.author);
    }
}
