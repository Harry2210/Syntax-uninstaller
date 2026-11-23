//! End-to-end probe for the WinGet upgrade engine.
//!
//! It never forces an install: use packages that are already current or do not
//! exist to verify argument construction, streaming, exit-code classification
//! and the batch summary without modifying the machine.
//!
//!   cargo run --example updater_upgrade_probe -- <package-id> [name]
//!   cargo run --example updater_upgrade_probe -- --batch <id1> <id2> ...

use syntax_uninstaller_lib::modules::software_updater::{self, SoftwareUpdate};

fn make_update(id: &str, name: Option<&str>) -> SoftwareUpdate {
    SoftwareUpdate {
        id: id.to_string(),
        name: name.unwrap_or(id).to_string(),
        current_version: "0.0.0".to_string(),
        available_version: "0.0.1".to_string(),
        source: "winget".to_string(),
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.is_empty() {
        eprintln!(
            "usage:\n  updater_upgrade_probe <package-id> [name]\n  updater_upgrade_probe --batch <id1> <id2> ..."
        );
        std::process::exit(2);
    }

    let progress = |update: software_updater::UpdateProgress| {
        println!(
            "[progress {}/{}] {} | {} | {}",
            update.index, update.total, update.name, update.status, update.message
        );
    };

    if args[0] == "--batch" {
        let updates: Vec<SoftwareUpdate> =
            args[1..].iter().map(|id| make_update(id, None)).collect();
        if updates.is_empty() {
            eprintln!("--batch needs at least one package id");
            std::process::exit(2);
        }

        match software_updater::upgrade_all_software(&updates, Some(&progress)) {
            Ok(summary) => {
                println!(
                    "summary: succeeded={} failed={} already_current={} skipped={} reboot={}",
                    summary.succeeded,
                    summary.failed,
                    summary.already_current,
                    summary.skipped,
                    summary.reboot_required
                );
                for outcome in &summary.outcomes {
                    println!(
                        "outcome: {} [{}] -> {} | {}",
                        outcome.name, outcome.status, outcome.new_version, outcome.message
                    );
                }
            }
            Err(error) => {
                eprintln!("batch error: {}", error);
                std::process::exit(1);
            }
        }
        return;
    }

    let update = make_update(&args[0], args.get(1).map(String::as_str));
    match software_updater::upgrade_software(&update, false, 1, 1, Some(&progress)) {
        Ok(outcome) => {
            println!(
                "outcome: status={} reboot={} interactive_retry={} message={}",
                outcome.status, outcome.requires_reboot, outcome.interactive_retry, outcome.message
            );
            for line in &outcome.logs {
                println!("log: {}", line);
            }
        }
        Err(error) => {
            eprintln!("upgrade error: {}", error);
            std::process::exit(1);
        }
    }
}
