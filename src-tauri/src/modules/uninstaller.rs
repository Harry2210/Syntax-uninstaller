use serde::{Deserialize, Serialize};
use sysinfo::{ProcessesToUpdate, System};

use crate::modules::winproc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessMatch {
    pub pid: u32,
    pub name: String,
    pub exe_path: String,
}

pub fn check_running_processes(app_name: &str, install_dir: &str) -> Vec<ProcessMatch> {
    let mut s = System::new_all();
    s.refresh_processes(ProcessesToUpdate::All, true);

    let norm_app = app_name.trim().to_lowercase();
    let norm_dir = install_dir.trim().to_lowercase();
    let mut matches = Vec::new();

    for (pid, process) in s.processes() {
        let p_name = process.name().to_string_lossy().to_lowercase();
        let exe_str = process
            .exe()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        let mut hit = false;
        if !norm_dir.is_empty() && exe_str.starts_with(&norm_dir) {
            hit = true;
        } else if p_name.contains(&norm_app) || (!norm_app.is_empty() && norm_app.contains(&p_name))
        {
            hit = true;
        }

        if hit {
            matches.push(ProcessMatch {
                pid: pid.as_u32(),
                name: process.name().to_string_lossy().to_string(),
                exe_path: process
                    .exe()
                    .map(|e| e.to_string_lossy().to_string())
                    .unwrap_or_default(),
            });
        }
    }

    matches
}

pub fn kill_process_by_pid(pid: u32) -> Result<(), String> {
    let mut s = System::new_all();
    s.refresh_processes(ProcessesToUpdate::All, true);
    let sys_pid = sysinfo::Pid::from_u32(pid);

    if let Some(process) = s.process(sys_pid) {
        if process.kill() {
            Ok(())
        } else {
            Err(format!("Could not terminate process with PID {}", pid))
        }
    } else {
        Err(format!("Process with PID {} not found", pid))
    }
}

pub fn create_system_restore_point(description: &str) -> Result<String, String> {
    let script = format!(
        "Checkpoint-Computer -Description {} -RestorePointType 'APPLICATION_UNINSTALL'",
        winproc::ps_string(&format!("Syntax Uninstaller: {}", description))
    );

    winproc::powershell(&script, std::time::Duration::from_secs(180))
        .map(|_| "System restore point created successfully".to_string())
        .map_err(|e| {
            format!(
                "Could not create restore point (requires administrator): {}",
                e
            )
        })
}

pub fn execute_uninstaller_command(cmd_string: &str, quiet: bool) -> Result<i32, String> {
    if cmd_string.trim().is_empty() {
        return Err("No uninstall string registered for this application".to_string());
    }

    let mut final_cmd = cmd_string.to_string();
    if quiet {
        // If MSI
        if final_cmd.to_lowercase().contains("msiexec") {
            if !final_cmd.contains("/qn") {
                final_cmd.push_str(" /qn /norestart");
            }
        } else if !final_cmd.contains("/S")
            && !final_cmd.contains("/silent")
            && !final_cmd.contains("/VERYSILENT")
        {
            // Typical installer silent flags
            final_cmd.push_str(" /S");
        }
    }

    // Execute through cmd so quoted paths and switches are handled by the
    // Windows command parser, but keep the console window invisible.
    let mut cmd = winproc::hidden_inherit("cmd");
    cmd.args(["/C", &final_cmd]);
    // The uninstaller draws its own window; cmd itself must stay hidden.
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to launch uninstaller: {}", e))?;

    let status = child
        .wait()
        .map_err(|e| format!("Error waiting for uninstaller to complete: {}", e))?;

    Ok(status.code().unwrap_or(0))
}
